import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createElement } from 'react'
import { useCastdStatus } from './useCastdControl'
import type { CastdStatus } from './useCastdControl'

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

const CRON_ACTIVE_RESPONSE = { entries: ['*/5 * * * * bash ~/.claude/scripts/cast-cost-tracker.sh'], count: 1 }
const CRON_EMPTY_RESPONSE = { entries: [], count: 0 }

// ─── useCastdStatus ───────────────────────────────────────────────────────────

describe('useCastdStatus', () => {
  beforeEach(() => {
    global.fetch = makeFetchOk(CRON_ACTIVE_RESPONSE)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('starts in loading state before the fetch resolves', () => {
    const { result } = renderHook(() => useCastdStatus(), { wrapper: makeWrapper() })
    expect(result.current.isLoading).toBe(true)
    expect(result.current.data).toBeUndefined()
  })

  it('fetches from /api/castd/status', async () => {
    const { result } = renderHook(() => useCastdStatus(), { wrapper: makeWrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(global.fetch).toHaveBeenCalledWith('/api/castd/status')
  })

  it('derives running=true when cron entries exist', async () => {
    const { result } = renderHook(() => useCastdStatus(), { wrapper: makeWrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    const data = result.current.data!
    expect(data.running).toBe(true)
    expect(data.count).toBe(1)
    expect(data.entries).toHaveLength(1)
  })

  it('derives running=false when no cron entries exist', async () => {
    global.fetch = makeFetchOk(CRON_EMPTY_RESPONSE)
    const { result } = renderHook(() => useCastdStatus(), { wrapper: makeWrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data!.running).toBe(false)
    expect(result.current.data!.count).toBe(0)
  })

  it('returns an error when the fetch is not ok', async () => {
    global.fetch = makeFetchError()
    const { result } = renderHook(() => useCastdStatus(), { wrapper: makeWrapper() })
    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(result.current.error).toBeTruthy()
  })
})
