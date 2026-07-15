import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReactNode } from 'react'

vi.mock('../api/usePlans', () => ({
  usePlans: vi.fn(),
  usePlan: vi.fn(() => ({ data: undefined, isLoading: false })),
  usePlanSessions: vi.fn(() => ({ data: { sessions: [] } })),
}))

import { usePlans } from '../api/usePlans'
import PlansView from './PlansView'

function Wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}

const MOCK_PLANS = [
  {
    filename: 'plan-2026-05-01-feature-x.md',
    title: 'Feature X implementation plan',
    date: '2026-05-01',
    path: '/plans/plan-2026-05-01-feature-x.md',
    preview: 'Add feature X to the dashboard',
    modifiedAt: '2026-05-01T10:00:00Z',
  },
  {
    filename: 'plan-2026-04-20-refactor.md',
    title: 'Dashboard refactor plan',
    date: '2026-04-20',
    path: '/plans/plan-2026-04-20-refactor.md',
    preview: 'Reduce page count from 16 to 7',
    modifiedAt: '2026-04-20T08:00:00Z',
  },
]

beforeEach(() => {
  vi.clearAllMocks()
})

describe('PlansView', () => {
  it('renders plan list sorted newest first', () => {
    vi.mocked(usePlans).mockReturnValue({
      data: MOCK_PLANS,
      isLoading: false,
      error: null,
    } as ReturnType<typeof usePlans>)

    render(<PlansView />, { wrapper: Wrapper })

    expect(screen.getByText('Feature X implementation plan')).toBeTruthy()
    expect(screen.getByText('Dashboard refactor plan')).toBeTruthy()

    // Newest plan should appear before older one in the DOM
    const buttons = screen.getAllByRole('button')
    const planButtons = buttons.filter(b => b.textContent?.includes('plan'))
    const featureXIndex = planButtons.findIndex(b => b.textContent?.includes('Feature X'))
    const refactorIndex = planButtons.findIndex(b => b.textContent?.includes('refactor'))
    expect(featureXIndex).toBeLessThan(refactorIndex)
  })

  it('renders plan previews as secondary text', () => {
    vi.mocked(usePlans).mockReturnValue({
      data: MOCK_PLANS,
      isLoading: false,
      error: null,
    } as ReturnType<typeof usePlans>)

    render(<PlansView />, { wrapper: Wrapper })

    expect(screen.getByText('Add feature X to the dashboard')).toBeTruthy()
    expect(screen.getByText('Reduce page count from 16 to 7')).toBeTruthy()
  })

  it('shows plan count in header', () => {
    vi.mocked(usePlans).mockReturnValue({
      data: MOCK_PLANS,
      isLoading: false,
      error: null,
    } as ReturnType<typeof usePlans>)

    render(<PlansView />, { wrapper: Wrapper })

    expect(screen.getByText('2 plans')).toBeTruthy()
  })

  it('shows loading skeleton before data arrives', () => {
    vi.mocked(usePlans).mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
    } as ReturnType<typeof usePlans>)

    render(<PlansView />, { wrapper: Wrapper })

    expect(screen.getByText('Plans')).toBeTruthy()
    expect(screen.queryByText('Feature X implementation plan')).toBeNull()
  })

  it('shows empty state when no plans are found', () => {
    vi.mocked(usePlans).mockReturnValue({
      data: [],
      isLoading: false,
      error: null,
    } as ReturnType<typeof usePlans>)

    render(<PlansView />, { wrapper: Wrapper })

    expect(screen.getByText('No plans found')).toBeTruthy()
  })

  it('shows error state when fetch fails', () => {
    vi.mocked(usePlans).mockReturnValue({
      data: undefined,
      isLoading: false,
      error: new Error('Fetch failed'),
    } as ReturnType<typeof usePlans>)

    render(<PlansView />, { wrapper: Wrapper })

    expect(screen.getByRole('alert')).toBeTruthy()
  })

  it('falls back to filename when plan has no title', () => {
    vi.mocked(usePlans).mockReturnValue({
      data: [{ ...MOCK_PLANS[0], title: '' }],
      isLoading: false,
      error: null,
    } as ReturnType<typeof usePlans>)

    render(<PlansView />, { wrapper: Wrapper })

    expect(screen.getByText('plan-2026-05-01-feature-x.md')).toBeTruthy()
  })
})
