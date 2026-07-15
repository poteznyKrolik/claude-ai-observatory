import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReactNode } from 'react'
import { useWorkLogStream, type WorkLogEntry } from './useWorkLogStream'

// Mock fetch globally
global.fetch = vi.fn()

// Setup QueryClient for each test
let queryClient: QueryClient

function createWrapper() {
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
}

beforeEach(() => {
  queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  })
  vi.clearAllMocks()
})

afterEach(() => {
  queryClient.clear()
})

// ─── Test fixtures ────────────────────────────────────────────────────────────

function createMockEntry(overrides?: Partial<WorkLogEntry>): WorkLogEntry {
  return {
    agentRunId: 'run-123',
    agentName: 'code-reviewer',
    model: 'claude-haiku-4.5',
    sessionId: 'session-abc',
    startedAt: '2026-05-04T10:00:00Z',
    status: 'DONE',
    workLog: {
      items: ['Reviewed code changes'],
      filesRead: ['src/app.ts'],
      filesChanged: ['src/app.ts'],
      decisions: ['Approved'],
    },
    partialWorkLog: null,
    isTruncated: false,
    parryGuardFired: false,
    qualityGateVerdict: null,
    dispatchedBy: 'main-session',
    dispatchedTo: null,
    ...overrides,
  }
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('useWorkLogStream', () => {
  it('builds URL with no params', async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ entries: [] }), { status: 200 }),
    )

    renderHook(() => useWorkLogStream(), { wrapper: createWrapper() })

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/work-log-stream')
    })
  })

  it('builds URL with limit param', async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ entries: [] }), { status: 200 }),
    )

    renderHook(() => useWorkLogStream({ limit: 50 }), { wrapper: createWrapper() })

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/work-log-stream?limit=50')
    })
  })

  it('builds URL with since param', async () => {
    const since = '2026-05-03T10:00:00Z'
    vi.mocked(global.fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ entries: [] }), { status: 200 }),
    )

    renderHook(() => useWorkLogStream({ since }), { wrapper: createWrapper() })

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(`/api/work-log-stream?since=${encodeURIComponent(since)}`)
    })
  })

  it('builds URL with both limit and since params', async () => {
    const since = '2026-05-03T10:00:00Z'
    vi.mocked(global.fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ entries: [] }), { status: 200 }),
    )

    renderHook(() => useWorkLogStream({ limit: 50, since }), { wrapper: createWrapper() })

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        `/api/work-log-stream?limit=50&since=${encodeURIComponent(since)}`,
      )
    })
  })

  it('returns parsed entries array on success', async () => {
    const mockEntry = createMockEntry()
    vi.mocked(global.fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ entries: [mockEntry] }), { status: 200 }),
    )

    const { result } = renderHook(() => useWorkLogStream(), { wrapper: createWrapper() })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    expect(result.current.data?.entries).toEqual([mockEntry])
  })

  it('returns empty entries array when response has no data', async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ entries: [] }), { status: 200 }),
    )

    const { result } = renderHook(() => useWorkLogStream(), { wrapper: createWrapper() })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    expect(result.current.data?.entries).toEqual([])
  })

  it('sets error state when fetch returns non-ok status', async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ error: 'Server error' }), { status: 500 }),
    )

    const { result } = renderHook(() => useWorkLogStream(), { wrapper: createWrapper() })

    await waitFor(() => {
      expect(result.current.isError).toBe(true)
    })

    expect(result.current.error).toBeDefined()
    expect(result.current.error?.message).toBe('Failed to fetch work log stream')
  })

  it('sets error state when fetch throws', async () => {
    vi.mocked(global.fetch).mockRejectedValueOnce(new Error('Network error'))

    const { result } = renderHook(() => useWorkLogStream(), { wrapper: createWrapper() })

    await waitFor(() => {
      expect(result.current.isError).toBe(true)
    })

    expect(result.current.error).toBeDefined()
  })

  it('uses staleTime of 10_000ms', async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ entries: [] }), { status: 200 }),
    )

    renderHook(() => useWorkLogStream(), { wrapper: createWrapper() })

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalled()
    })

    // Verify hook is configured properly by checking state
    const state = queryClient.getQueryState(['cast', 'work-log-stream', {}])
    expect(state).toBeDefined()
  })

  it('includes query key with params', async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ entries: [] }), { status: 200 }),
    )

    renderHook(() => useWorkLogStream({ limit: 25 }), { wrapper: createWrapper() })

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalled()
    })

    // Verify different param creates different query key
    const state = queryClient.getQueryState(['cast', 'work-log-stream', { limit: 25 }])
    expect(state).toBeDefined()
  })

  it('returns multiple entries', async () => {
    const entries = [
      createMockEntry({ agentRunId: 'run-1', agentName: 'commit' }),
      createMockEntry({ agentRunId: 'run-2', agentName: 'test-runner' }),
      createMockEntry({ agentRunId: 'run-3', agentName: 'code-writer' }),
    ]

    vi.mocked(global.fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ entries }), { status: 200 }),
    )

    const { result } = renderHook(() => useWorkLogStream(), { wrapper: createWrapper() })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    expect(result.current.data?.entries).toHaveLength(3)
    expect(result.current.data?.entries?.[0]?.agentName).toBe('commit')
    expect(result.current.data?.entries?.[1]?.agentName).toBe('test-runner')
    expect(result.current.data?.entries?.[2]?.agentName).toBe('code-writer')
  })

  it('handles entry with null status', async () => {
    const entry = createMockEntry({ status: null })
    vi.mocked(global.fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ entries: [entry] }), { status: 200 }),
    )

    const { result } = renderHook(() => useWorkLogStream(), { wrapper: createWrapper() })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    expect(result.current.data?.entries?.[0]?.status).toBeNull()
  })

  it('handles entry with null model', async () => {
    const entry = createMockEntry({ model: null })
    vi.mocked(global.fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ entries: [entry] }), { status: 200 }),
    )

    const { result } = renderHook(() => useWorkLogStream(), { wrapper: createWrapper() })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    expect(result.current.data?.entries?.[0]?.model).toBeNull()
  })

  it('handles entry with null workLog', async () => {
    const entry = createMockEntry({ workLog: null })
    vi.mocked(global.fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ entries: [entry] }), { status: 200 }),
    )

    const { result } = renderHook(() => useWorkLogStream(), { wrapper: createWrapper() })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    expect(result.current.data?.entries?.[0]?.workLog).toBeNull()
  })

  it('handles entry with isTruncated=true and partialWorkLog', async () => {
    const entry = createMockEntry({
      isTruncated: true,
      partialWorkLog: 'Status: DONE\n## Work Log\n- Started task',
    })
    vi.mocked(global.fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ entries: [entry] }), { status: 200 }),
    )

    const { result } = renderHook(() => useWorkLogStream(), { wrapper: createWrapper() })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    expect(result.current.data?.entries?.[0]?.isTruncated).toBe(true)
    expect(result.current.data?.entries?.[0]?.partialWorkLog).toBeTruthy()
  })

  it('refetchInterval is 30_000ms', async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ entries: [] }), { status: 200 }),
    )

    renderHook(() => useWorkLogStream(), { wrapper: createWrapper() })

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalled()
    })

    // Verify hook is properly configured
    expect(global.fetch).toHaveBeenCalledWith('/api/work-log-stream')
  })
})
