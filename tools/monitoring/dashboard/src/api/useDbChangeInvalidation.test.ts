import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createElement } from 'react'
import { useDbChangeInvalidation } from './useDbChangeInvalidation'
import type { LiveEvent } from '../types'

// ─── EventSource mock ────────────────────────────────────────────────────────

type ESHandler = (e: MessageEvent) => void

class MockEventSource {
  static instances: MockEventSource[] = []
  url: string
  onopen: (() => void) | null = null
  onerror: (() => void) | null = null
  onmessage: ESHandler | null = null

  constructor(url: string) {
    this.url = url
    MockEventSource.instances.push(this)
  }

  /** Simulate an SSE message arriving */
  emit(event: LiveEvent) {
    this.onmessage?.({ data: JSON.stringify(event) } as MessageEvent)
  }

  close() {}
}

// ─── Wrapper ─────────────────────────────────────────────────────────────────

function makeWrapper(queryClient: QueryClient) {
  return ({ children }: { children: React.ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children)
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('useDbChangeInvalidation', () => {
  let queryClient: QueryClient

  beforeEach(() => {
    MockEventSource.instances = []
    vi.stubGlobal('EventSource', MockEventSource)
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    vi.spyOn(queryClient, 'invalidateQueries')
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('invalidates cast/agent-runs on db_change_agent_run event', () => {
    renderHook(() => useDbChangeInvalidation(), { wrapper: makeWrapper(queryClient) })

    const es = MockEventSource.instances[0]!
    act(() => {
      es.emit({
        type: 'db_change_agent_run',
        timestamp: new Date().toISOString(),
        dbChangeTable: 'agent_runs',
        dbChangeRowId: 42,
        dbChangeAgentName: 'code-writer',
        dbChangeStatus: 'DONE',
      })
    })

    expect(queryClient.invalidateQueries).toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: ['cast', 'agent-runs'] })
    )
  })

  it('invalidates sessions on db_change_session event', () => {
    renderHook(() => useDbChangeInvalidation(), { wrapper: makeWrapper(queryClient) })

    const es = MockEventSource.instances[0]!
    act(() => {
      es.emit({
        type: 'db_change_session',
        timestamp: new Date().toISOString(),
        dbChangeTable: 'sessions',
        dbChangeRowId: 7,
        dbChangeSessionId: 'sess-abc',
      })
    })

    expect(queryClient.invalidateQueries).toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: ['sessions'] })
    )
  })

  it('invalidates routing on db_change_routing_event event', () => {
    renderHook(() => useDbChangeInvalidation(), { wrapper: makeWrapper(queryClient) })

    const es = MockEventSource.instances[0]!
    act(() => {
      es.emit({
        type: 'db_change_routing_event',
        timestamp: new Date().toISOString(),
        dbChangeTable: 'routing_events',
        dbChangeRowId: 3,
      })
    })

    expect(queryClient.invalidateQueries).toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: ['routing'] })
    )
  })

  it('does not invalidate queries for non-db_change events', () => {
    renderHook(() => useDbChangeInvalidation(), { wrapper: makeWrapper(queryClient) })

    const es = MockEventSource.instances[0]!
    act(() => {
      es.emit({ type: 'heartbeat', timestamp: new Date().toISOString() })
    })

    expect(queryClient.invalidateQueries).not.toHaveBeenCalled()
  })

  it('opens exactly one EventSource connection', () => {
    renderHook(() => useDbChangeInvalidation(), { wrapper: makeWrapper(queryClient) })
    expect(MockEventSource.instances).toHaveLength(1)
    expect(MockEventSource.instances[0]!.url).toBe('/api/events')
  })
})
