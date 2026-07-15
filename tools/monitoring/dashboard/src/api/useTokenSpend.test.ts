import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createElement } from 'react'
import { useTokenSpend } from './useTokenSpend'
import type { TokenSpendData } from './useTokenSpend'

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

const MOCK_TOKEN_SPEND: TokenSpendData = {
  daily: [
    { date: '2026-03-01', inputTokens: 1000, outputTokens: 500, costUsd: 0.005 },
  ],
  totals: { inputTokens: 1000, outputTokens: 500, cacheCreationTokens: 0, cacheReadTokens: 0, costUsd: 0.005, sessionCount: 1 },
}

const EMPTY_TOKEN_SPEND: TokenSpendData = {
  daily: [],
  totals: { inputTokens: 0, outputTokens: 0, cacheCreationTokens: 0, cacheReadTokens: 0, costUsd: 0, sessionCount: 0 },
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('useTokenSpend', () => {
  beforeEach(() => {
    global.fetch = makeFetchOk(MOCK_TOKEN_SPEND)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('starts in loading state before the fetch resolves', () => {
    const { result } = renderHook(() => useTokenSpend(), { wrapper: makeWrapper() })
    expect(result.current.isLoading).toBe(true)
    expect(result.current.data).toBeUndefined()
  })

  it('fetches from /api/cast/token-spend', async () => {
    const { result } = renderHook(() => useTokenSpend(), { wrapper: makeWrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(global.fetch).toHaveBeenCalledWith('/api/cast/token-spend')
  })

  it('returns the correct data shape on success', async () => {
    const { result } = renderHook(() => useTokenSpend(), { wrapper: makeWrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    const data = result.current.data!
    expect(Array.isArray(data.daily)).toBe(true)
    expect(data.daily[0]).toMatchObject({ date: '2026-03-01', inputTokens: 1000 })
    expect(data.totals.sessionCount).toBe(1)
  })

  it('returns an error when the fetch is not ok', async () => {
    global.fetch = makeFetchError()
    const { result } = renderHook(() => useTokenSpend(), { wrapper: makeWrapper() })
    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(result.current.error).toBeTruthy()
  })

  it('returns empty daily array when API returns empty data', async () => {
    global.fetch = makeFetchOk(EMPTY_TOKEN_SPEND)
    const { result } = renderHook(() => useTokenSpend(), { wrapper: makeWrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data!.daily).toHaveLength(0)
    expect(result.current.data!.totals.costUsd).toBe(0)
  })
})
