import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createElement } from 'react'
import { useAgentRuns } from './useAgentRuns'
import type { AgentRunsData } from './useAgentRuns'

// ─── Fetch mock helpers ──────────────────────────────────────────────────────

function makeFetchOk(data: unknown) {
  return vi.fn().mockResolvedValue({
    ok: true,
    json: () => Promise.resolve(data),
  })
}

function makeFetchError() {
  return vi.fn().mockResolvedValue({
    ok: false,
    json: () => Promise.resolve({}),
  })
}

// ─── Wrapper ─────────────────────────────────────────────────────────────────

function makeWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return ({ children }: { children: React.ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children)
}

// ─── Fixtures ────────────────────────────────────────────────────────────────

const MOCK_RUN = {
  id: 'run-1',
  session_id: 'sess-abc',
  agent: 'code-writer',
  model: 'claude-sonnet-4-5',
  started_at: '2026-03-26T10:00:00Z',
  ended_at: '2026-03-26T10:01:00Z',
  status: 'done',
  input_tokens: 2000,
  output_tokens: 800,
  cost_usd: 0.018,
  task_summary: 'Write auth middleware',
  project: 'my-project',
}

const MOCK_AGENT_RUNS: AgentRunsData = {
  runs: [MOCK_RUN],
  stats: {
    totalRuns: 1,
    totalCostUsd: 0.018,
    byAgent: { 'code-writer': 1 },
    byStatus: { done: 1 },
  },
}

const EMPTY_AGENT_RUNS: AgentRunsData = {
  runs: [],
  stats: { totalRuns: 0, totalCostUsd: 0, byAgent: {}, byStatus: {} },
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('useAgentRuns', () => {
  beforeEach(() => {
    global.fetch = makeFetchOk(MOCK_AGENT_RUNS)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('starts in loading state before the fetch resolves', () => {
    const { result } = renderHook(() => useAgentRuns(), { wrapper: makeWrapper() })
    expect(result.current.isLoading).toBe(true)
    expect(result.current.data).toBeUndefined()
  })

  it('fetches from /api/cast/agent-runs with no params', async () => {
    const { result } = renderHook(() => useAgentRuns(), { wrapper: makeWrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(global.fetch).toHaveBeenCalledWith('/api/cast/agent-runs')
  })

  it('appends query params when provided', async () => {
    const { result } = renderHook(
      () => useAgentRuns({ limit: 10, agent: 'code-writer', status: 'done' }),
      { wrapper: makeWrapper() }
    )
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    const url = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0][0] as string
    expect(url).toContain('limit=10')
    expect(url).toContain('agent=code-writer')
    expect(url).toContain('status=done')
  })

  it('returns runs array and stats on success', async () => {
    const { result } = renderHook(() => useAgentRuns(), { wrapper: makeWrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    const data = result.current.data!
    expect(data.runs).toHaveLength(1)
    expect(data.runs[0].agent).toBe('code-writer')
    expect(data.stats.totalRuns).toBe(1)
    expect(data.stats.byAgent['code-writer']).toBe(1)
  })

  it('returns an error when the fetch is not ok', async () => {
    global.fetch = makeFetchError()
    const { result } = renderHook(() => useAgentRuns(), { wrapper: makeWrapper() })
    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(result.current.error).toBeTruthy()
  })

  it('returns empty runs array when API returns no data', async () => {
    global.fetch = makeFetchOk(EMPTY_AGENT_RUNS)
    const { result } = renderHook(() => useAgentRuns(), { wrapper: makeWrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data!.runs).toHaveLength(0)
    expect(result.current.data!.stats.totalRuns).toBe(0)
  })
})
