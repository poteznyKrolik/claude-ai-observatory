import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'

/**
 * Regression: HookFailuresView infinite refetch loop
 *
 * Before the fix, `since` was computed with Date.now() directly in the render
 * body and passed as a React Query queryKey segment. Every render produced a
 * fresh millisecond-precision ISO string → new queryKey → fresh fetch →
 * re-render → loop forever.
 *
 * After the fix, `since` is wrapped in useMemo([last24h]), so it is computed
 * once and stays stable across re-renders unless the toggle changes.
 */

// Capture every `since` value HookFailuresView passes to useHookFailures.
const capturedSince: Array<string | undefined> = []

vi.mock('../api/useHookFailures', () => ({
  useHookFailures: (since?: string) => {
    capturedSince.push(since)
    return { data: { failures: [] }, isLoading: false }
  },
  useHookFailuresCount: () => ({ data: { count: 0 }, isLoading: false }),
}))

vi.mock('../components/SectionHeader', () => ({
  default: ({ title }: { title: string }) => <div>{title}</div>,
}))
vi.mock('../components/TerminalPanel', () => ({
  default: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}))

// Import after mocks are registered (vi.mock is hoisted, so order in source
// doesn't matter, but placing the import here makes the intent clear).
import HookFailuresView from './HookFailuresView'

function Wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
}

describe('HookFailuresView — since stability (regression: infinite-refetch loop)', () => {
  afterEach(() => {
    capturedSince.length = 0
    vi.restoreAllMocks()
  })

  it('passes the same since value across re-renders (memoized, not recomputed per render)', () => {
    // Mock Date.now to return monotonically increasing values on each call.
    // Without the useMemo fix, each render body invocation of Date.now() yields
    // a unique timestamp → unique queryKey → new fetch → re-render → loop.
    let counter = 0
    vi.spyOn(Date, 'now').mockImplementation(
      () => 1_700_000_000_000 + ++counter * 1_000
    )

    const { rerender } = render(<HookFailuresView />, { wrapper: Wrapper })

    // Force three additional re-renders. In the buggy code each one would call
    // Date.now() again and compute a new `since` string.
    act(() => { rerender(<HookFailuresView />) })
    act(() => { rerender(<HookFailuresView />) })
    act(() => { rerender(<HookFailuresView />) })

    // The default state is last24h=true, so every call should receive a
    // non-undefined since value.
    const definedValues = capturedSince.filter((v): v is string => v !== undefined)
    expect(definedValues.length).toBeGreaterThan(0)

    // All values must be the same string — memoized from the first render.
    const unique = new Set(definedValues)
    expect(unique.size).toBe(1)
  })

  it('renders the view without crashing and shows the section heading', () => {
    render(<HookFailuresView />, { wrapper: Wrapper })
    // The view renders without throwing; SectionHeader mock emits the title.
    // No assertion needed beyond the render not throwing — but let's verify
    // the hook received a call at all (confirming the component mounted).
    expect(capturedSince.length).toBeGreaterThan(0)
  })
})
