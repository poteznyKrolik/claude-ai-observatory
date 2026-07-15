import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReactNode } from 'react'

vi.mock('../api/useExecutiveSummary', () => ({
  useExecutiveSummary: vi.fn(),
}))

import { useExecutiveSummary } from '../api/useExecutiveSummary'
import ExecutiveSummaryView from './ExecutiveSummaryView'

function Wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
}

const MOCK_SUMMARY = {
  range: 'today' as const,
  generatedAt: new Date().toISOString(),
  runs: {
    total: 5,
    byStatus: { DONE: 3, DONE_WITH_CONCERNS: 1, BLOCKED: 1, NEEDS_CONTEXT: 0, RUNNING: 0, OTHER: 0 },
  },
  cost: { todayUsd: 0.023, weekUsd: 0.15, vsPrior7dPct: 12.5 },
  topAgents: [
    { agent: 'code-writer', count: 3, costUsd: 0.015 },
    { agent: 'code-reviewer', count: 2, costUsd: 0.008 },
  ],
  blockers: [
    { id: 1, agent: 'debugger', status: 'BLOCKED', started_at: new Date(Date.now() - 3600_000).toISOString(), work_log_snippet: 'Cannot resolve import' },
    { id: 2, agent: 'test-writer', status: 'DONE_WITH_CONCERNS', started_at: new Date(Date.now() - 1800_000).toISOString(), work_log_snippet: 'Tests pass but coverage low' },
  ],
  highlights: { plansActive: 2, hookFailures24h: 1, qualityGatePassRate: 66.7 },
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('ExecutiveSummaryView', () => {
  it('renders page heading', () => {
    vi.mocked(useExecutiveSummary).mockReturnValue({
      data: MOCK_SUMMARY,
      isLoading: false,
      error: null,
    } as ReturnType<typeof useExecutiveSummary>)

    render(<ExecutiveSummaryView />, { wrapper: Wrapper })

    expect(screen.getByText('Executive Summary')).toBeTruthy()
  })

  it('renders four headline metric cards', () => {
    vi.mocked(useExecutiveSummary).mockReturnValue({
      data: MOCK_SUMMARY,
      isLoading: false,
      error: null,
    } as ReturnType<typeof useExecutiveSummary>)

    render(<ExecutiveSummaryView />, { wrapper: Wrapper })

    // Runs card label is visible
    expect(screen.getByText(/Runs \(today\)/)).toBeTruthy()
    // Blockers card label visible
    expect(screen.getByText('Blockers')).toBeTruthy()
    // Pass rate label visible
    expect(screen.getByText('Pass rate')).toBeTruthy()
    // Cost label visible
    expect(screen.getByText('Cost today')).toBeTruthy()
  })

  it('renders blocker entries with status badges', () => {
    vi.mocked(useExecutiveSummary).mockReturnValue({
      data: MOCK_SUMMARY,
      isLoading: false,
      error: null,
    } as ReturnType<typeof useExecutiveSummary>)

    render(<ExecutiveSummaryView />, { wrapper: Wrapper })

    expect(screen.getByText('debugger')).toBeTruthy()
    expect(screen.getByText('test-writer')).toBeTruthy()
    // Status badge text (lowercase with spaces due to replace)
    expect(screen.getByText('BLOCKED')).toBeTruthy()
    expect(screen.getByText('DONE WITH CONCERNS')).toBeTruthy()
  })

  it('renders top agents list', () => {
    vi.mocked(useExecutiveSummary).mockReturnValue({
      data: MOCK_SUMMARY,
      isLoading: false,
      error: null,
    } as ReturnType<typeof useExecutiveSummary>)

    render(<ExecutiveSummaryView />, { wrapper: Wrapper })

    expect(screen.getByText('code-writer')).toBeTruthy()
    expect(screen.getByText('code-reviewer')).toBeTruthy()
  })

  it('renders highlights section with correct values', () => {
    vi.mocked(useExecutiveSummary).mockReturnValue({
      data: MOCK_SUMMARY,
      isLoading: false,
      error: null,
    } as ReturnType<typeof useExecutiveSummary>)

    render(<ExecutiveSummaryView />, { wrapper: Wrapper })

    // Plans active
    expect(screen.getByText('Plans Active')).toBeTruthy()
    // Hook failures
    expect(screen.getByText('Hook Failures 24h')).toBeTruthy()
    // Gate pass rate
    expect(screen.getByText('Gate Pass Rate')).toBeTruthy()
  })

  it('shows loading skeleton when isLoading=true', () => {
    vi.mocked(useExecutiveSummary).mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
    } as ReturnType<typeof useExecutiveSummary>)

    render(<ExecutiveSummaryView />, { wrapper: Wrapper })

    // Content is not rendered while loading
    expect(screen.queryByText('Executive Summary')).toBeNull()
  })

  it('shows error alert when fetch fails', () => {
    vi.mocked(useExecutiveSummary).mockReturnValue({
      data: undefined,
      isLoading: false,
      error: new Error('Network error'),
    } as ReturnType<typeof useExecutiveSummary>)

    render(<ExecutiveSummaryView />, { wrapper: Wrapper })

    expect(screen.getByRole('alert')).toBeTruthy()
    expect(screen.getByText('Network error')).toBeTruthy()
  })

  it('shows empty state for blockers when none present', () => {
    vi.mocked(useExecutiveSummary).mockReturnValue({
      data: { ...MOCK_SUMMARY, blockers: [] },
      isLoading: false,
      error: null,
    } as unknown as ReturnType<typeof useExecutiveSummary>)

    render(<ExecutiveSummaryView />, { wrapper: Wrapper })

    expect(screen.getByText('No blockers in this window')).toBeTruthy()
  })

  it('shows empty state for top agents when none present', () => {
    vi.mocked(useExecutiveSummary).mockReturnValue({
      data: { ...MOCK_SUMMARY, topAgents: [] },
      isLoading: false,
      error: null,
    } as unknown as ReturnType<typeof useExecutiveSummary>)

    render(<ExecutiveSummaryView />, { wrapper: Wrapper })

    expect(screen.getByText('No agent runs in this window')).toBeTruthy()
  })

  it('range toggle switches between Today and Week', () => {
    vi.mocked(useExecutiveSummary).mockReturnValue({
      data: MOCK_SUMMARY,
      isLoading: false,
      error: null,
    } as ReturnType<typeof useExecutiveSummary>)

    render(<ExecutiveSummaryView />, { wrapper: Wrapper })

    const weekButton = screen.getByRole('button', { name: 'Week' })
    fireEvent.click(weekButton)

    // useExecutiveSummary should be called with 'week'
    expect(vi.mocked(useExecutiveSummary)).toHaveBeenCalledWith('week')
  })

  it('shows dash for pass rate when qualityGatePassRate is null and no runs', () => {
    vi.mocked(useExecutiveSummary).mockReturnValue({
      data: {
        ...MOCK_SUMMARY,
        runs: { total: 0, byStatus: { DONE: 0, DONE_WITH_CONCERNS: 0, BLOCKED: 0, NEEDS_CONTEXT: 0, RUNNING: 0, OTHER: 0 } },
        highlights: { ...MOCK_SUMMARY.highlights, qualityGatePassRate: null },
      },
      isLoading: false,
      error: null,
    } as ReturnType<typeof useExecutiveSummary>)

    render(<ExecutiveSummaryView />, { wrapper: Wrapper })

    // When there's no data for pass rate, show —
    const dashes = screen.getAllByText('—')
    expect(dashes.length).toBeGreaterThanOrEqual(1)
  })

  it('renders cost delta trend indicator', () => {
    vi.mocked(useExecutiveSummary).mockReturnValue({
      data: MOCK_SUMMARY,
      isLoading: false,
      error: null,
    } as ReturnType<typeof useExecutiveSummary>)

    render(<ExecutiveSummaryView />, { wrapper: Wrapper })

    // vsPrior7dPct is 12.5 → should show "12.5% vs prior"
    expect(screen.getByText(/12\.5% vs prior/)).toBeTruthy()
  })
})
