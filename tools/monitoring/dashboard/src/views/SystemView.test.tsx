import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { ReactNode } from 'react'

/**
 * useModelPricing is made a vi.fn() so individual tests can override its
 * return value without disturbing the default (null → "no data" state used by
 * the basic render-without-crash tests).
 */
const { mockUseModelPricing } = vi.hoisted(() => ({
  mockUseModelPricing: vi.fn(() => ({ data: null, isLoading: false })),
}))

// Stub out every hook SystemView uses so we test render-without-crash
vi.mock('../api/useSystem', () => ({
  useSystemHealth: () => ({ data: null, isLoading: false }),
  useConfig: () => ({ data: null, isLoading: false }),
}))
vi.mock('../api/useAgents', () => ({
  useAgents: () => ({ data: [], isLoading: false }),
  useAgent: () => ({ data: null, isLoading: false }),
}))
vi.mock('../api/useKnowledge', () => ({
  useRules: () => ({ data: [], isLoading: false }),
  useSkills: () => ({ data: [], isLoading: false }),
  useCommands: () => ({ data: [], isLoading: false }),
}))
vi.mock('../api/useMemory', () => ({
  useAgentMemory: () => ({ data: [], isLoading: false }),
  useProjectMemory: () => ({ data: [], isLoading: false }),
}))
vi.mock('../api/usePlans', () => ({
  usePlans: () => ({ data: [], isLoading: false }),
  usePlan: () => ({ data: null, isLoading: false }),
}))
vi.mock('../api/useCastData', () => ({
  useChainMap: () => ({ data: null, isLoading: false }),
  usePolicies: () => ({ data: null, isLoading: false }),
  useModelPricing: mockUseModelPricing,
}))
vi.mock('../api/useParryGuard', () => ({
  useParryGuard: () => ({ data: { events: [] }, isLoading: false }),
}))
vi.mock('../api/useAgentTruncations', () => ({
  useAgentTruncations: () => ({ data: { truncations: [] }, isLoading: false }),
}))
vi.mock('../api/useCostSummary', () => ({
  useCostSummary: () => ({ data: null, isLoading: false }),
}))
vi.mock('../components/StatCard', () => ({
  default: ({ label }: { label: string }) => <div>{label}</div>,
  StatCardSkeleton: () => <div />,
}))
vi.mock('../components/CopyButton', () => ({
  default: () => <button>Copy</button>,
}))
// SqliteExplorerView is lazy-loaded — stub it
vi.mock('./SqliteExplorerView', () => ({
  default: () => <div>DB Explorer</div>,
}))

import SystemView from './SystemView'

function Wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return (
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>{children}</MemoryRouter>
    </QueryClientProvider>
  )
}

describe('SystemView', () => {
  beforeEach(() => {
    mockUseModelPricing.mockReturnValue({ data: null, isLoading: false })
  })

  it('renders without crashing', () => {
    render(<SystemView />, { wrapper: Wrapper })
    // The "System" heading should appear in one of the tabs
    expect(screen.getByRole('heading', { name: /system/i })).toBeTruthy()
  })

  it('renders tab navigation', () => {
    render(<SystemView />, { wrapper: Wrapper })
    // Tabs expose the WAI-ARIA tablist pattern (role="tab" within a tablist)
    expect(screen.getByRole('tablist', { name: /system sections/i })).toBeTruthy()
    expect(screen.getByRole('tab', { name: /agents/i })).toBeTruthy()
    expect(screen.getByRole('tab', { name: /memory/i })).toBeTruthy()
    expect(screen.getByRole('tab', { name: /plans/i })).toBeTruthy()
  })
})

describe('SystemView — Pricing tab field mapping (regression: "$--" shown for all models)', () => {
  /**
   * Before the fix, PricingTab read `r.input` and `r.input_per_1m` — neither
   * of which exists in model-pricing.json. The actual fields are
   * `cost_per_million_input` / `cost_per_million_output`.  Every cell fell
   * through to the `'--'` fallback → the table showed "$--" for every row.
   *
   * After the fix, `cost_per_million_input` / `cost_per_million_output` are
   * checked first in the fallback chain so the real values appear.
   */
  it('renders actual price values (not "$--") when model-pricing uses cost_per_million_* fields', () => {
    mockUseModelPricing.mockReturnValue({
      data: {
        models: {
          'claude-sonnet-4-5': {
            cost_per_million_input: 3.00,
            cost_per_million_output: 15.00,
            tier: 'cloud',
            provider: 'anthropic',
          },
        },
      },
      isLoading: false,
    })

    render(<SystemView />, { wrapper: Wrapper })

    // Navigate to the Pricing tab
    fireEvent.click(screen.getByRole('tab', { name: /pricing/i }))

    // The model name should appear in the table
    expect(screen.getByText('claude-sonnet-4-5')).toBeTruthy()

    // Actual price values must be rendered — "$--" means the field was not found
    expect(screen.getByText('$3')).toBeTruthy()
    expect(screen.getByText('$15')).toBeTruthy()

    // The "$--" fallback must NOT appear
    expect(screen.queryByText('$--')).toBeNull()
  })
})
