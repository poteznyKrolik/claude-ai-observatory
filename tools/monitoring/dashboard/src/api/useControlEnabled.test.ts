import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createElement } from 'react'
import { useControlStatus } from './useControlEnabled'

function makeWrapper() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return ({ children }: { children: React.ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children)
}

describe('useControlStatus', () => {
  afterEach(() => vi.restoreAllMocks())

  beforeEach(() => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ enabled: true, tokenConfigured: false }),
    })
  })

  it('fetches from /api/config/control', async () => {
    const { result } = renderHook(() => useControlStatus(), { wrapper: makeWrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(global.fetch).toHaveBeenCalledWith('/api/config/control')
  })

  it('coerces the response to booleans', async () => {
    const { result } = renderHook(() => useControlStatus(), { wrapper: makeWrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual({ enabled: true, tokenConfigured: false })
  })

  it('errors when the fetch is not ok', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, json: () => Promise.resolve({}) })
    const { result } = renderHook(() => useControlStatus(), { wrapper: makeWrapper() })
    await waitFor(() => expect(result.current.isError).toBe(true))
  })
})
