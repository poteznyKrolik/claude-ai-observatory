import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useLiveEvents } from './useLive'
import type { LiveEvent } from '../types'

// ─── EventSource mock ────────────────────────────────────────────────────────

type ESHandler = (e: MessageEvent) => void

class MockEventSource {
  static instances: MockEventSource[] = []
  url: string
  onopen: (() => void) | null = null
  onerror: (() => void) | null = null
  onmessage: ESHandler | null = null
  closed = false

  constructor(url: string) {
    this.url = url
    MockEventSource.instances.push(this)
  }

  emit(event: LiveEvent) {
    this.onmessage?.({ data: JSON.stringify(event) } as MessageEvent)
  }

  triggerOpen() { this.onopen?.() }
  triggerError() { this.onerror?.() }

  close() { this.closed = true }
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('useLiveEvents', () => {
  beforeEach(() => {
    MockEventSource.instances = []
    vi.stubGlobal('EventSource', MockEventSource)
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('starts disconnected and connected=false', () => {
    const { result } = renderHook(() => useLiveEvents())
    expect(result.current.connected).toBe(false)
  })

  it('sets connected=true on open', () => {
    const { result } = renderHook(() => useLiveEvents())
    act(() => MockEventSource.instances[0]!.triggerOpen())
    expect(result.current.connected).toBe(true)
  })

  it('sets connected=false on error', () => {
    const { result } = renderHook(() => useLiveEvents())
    act(() => MockEventSource.instances[0]!.triggerOpen())
    act(() => MockEventSource.instances[0]!.triggerError())
    expect(result.current.connected).toBe(false)
  })

  it('starts with lastDbEventMs=null', () => {
    const { result } = renderHook(() => useLiveEvents())
    expect(result.current.lastDbEventMs).toBeNull()
  })

  it('sets lastDbEventMs when a db_change_agent_run event arrives', async () => {
    const before = Date.now()
    const { result } = renderHook(() => useLiveEvents())

    act(() => {
      MockEventSource.instances[0]!.emit({
        type: 'db_change_agent_run',
        timestamp: new Date().toISOString(),
        dbChangeTable: 'agent_runs',
        dbChangeRowId: 1,
      })
    })

    await waitFor(() => expect(result.current.lastDbEventMs).not.toBeNull())
    expect(result.current.lastDbEventMs).toBeGreaterThanOrEqual(before)
  })

  it('sets lastDbEventMs when a db_change_session event arrives', async () => {
    const { result } = renderHook(() => useLiveEvents())

    act(() => {
      MockEventSource.instances[0]!.emit({
        type: 'db_change_session',
        timestamp: new Date().toISOString(),
        dbChangeTable: 'sessions',
        dbChangeRowId: 2,
      })
    })

    await waitFor(() => expect(result.current.lastDbEventMs).not.toBeNull())
  })

  it('does NOT set lastDbEventMs for non-db_change events', async () => {
    const { result } = renderHook(() => useLiveEvents())

    act(() => {
      MockEventSource.instances[0]!.emit({ type: 'heartbeat', timestamp: new Date().toISOString() })
    })

    // Give React a tick to flush any state updates
    await act(async () => {})
    expect(result.current.lastDbEventMs).toBeNull()
  })

  it('calls onEvent callback for every received event', () => {
    const onEvent = vi.fn()
    renderHook(() => useLiveEvents(onEvent))

    const event: LiveEvent = { type: 'heartbeat', timestamp: new Date().toISOString() }
    act(() => MockEventSource.instances[0]!.emit(event))

    expect(onEvent).toHaveBeenCalledTimes(1)
    expect(onEvent).toHaveBeenCalledWith(event)
  })

  it('closes the EventSource on unmount', () => {
    const { unmount } = renderHook(() => useLiveEvents())
    unmount()
    expect(MockEventSource.instances[0]!.closed).toBe(true)
  })

  it('opens exactly one EventSource to /api/events', () => {
    renderHook(() => useLiveEvents())
    expect(MockEventSource.instances).toHaveLength(1)
    expect(MockEventSource.instances[0]!.url).toBe('/api/events')
  })
})
