import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import type { ReactNode } from 'react'

vi.mock('../api/useOutputs', () => ({
  useOutputs: vi.fn(),
}))

import { useOutputs } from '../api/useOutputs'
import OutputsView from './OutputsView'
import type { OutputFile } from '../types'

function Wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return (
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>{children}</MemoryRouter>
    </QueryClientProvider>
  )
}

const MOCK_BRIEFING: OutputFile = {
  filename: 'morning-briefing-2026-06-22.md',
  category: 'briefings',
  path: '/home/user/.claude/briefings/morning-briefing-2026-06-22.md',
  preview: 'Today CAST completed phase 14 review plumbing and all tests passed.',
  modifiedAt: new Date(Date.now() - 60_000).toISOString(),
}

const MOCK_MEETING: OutputFile = {
  filename: 'sprint-retro-2026-06-20.md',
  category: 'meetings',
  path: '/home/user/.claude/meetings/sprint-retro-2026-06-20.md',
  preview: 'Sprint retrospective notes for the week ending June 20.',
  modifiedAt: new Date(Date.now() - 7200_000).toISOString(),
}

const MOCK_REPORT: OutputFile = {
  filename: 'weekly-report-2026-06-22.md',
  category: 'reports',
  path: '/home/user/.claude/reports/weekly-report-2026-06-22.md',
  preview: 'Weekly agent performance summary.',
  modifiedAt: new Date(Date.now() - 3600_000).toISOString(),
}

function mockUseOutputs(overrides: Partial<Record<OutputFile['category'], OutputFile[]>> = {}) {
  vi.mocked(useOutputs).mockImplementation((category) => {
    const data = overrides[category] ?? []
    return { data, isLoading: false, error: null } as ReturnType<typeof useOutputs>
  })
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('OutputsView', () => {
  it('renders the page header', () => {
    mockUseOutputs()
    render(<OutputsView />, { wrapper: Wrapper })
    expect(screen.getByRole('heading', { name: 'Outputs' })).toBeTruthy()
    expect(screen.getByText('Agent-generated briefings, meetings, and reports.')).toBeTruthy()
  })

  it('renders a briefing filename and preview when data is present', () => {
    mockUseOutputs({ briefings: [MOCK_BRIEFING] })
    render(<OutputsView />, { wrapper: Wrapper })

    // Briefings tab is active by default
    expect(screen.getByText(MOCK_BRIEFING.filename)).toBeTruthy()
    expect(screen.getByText(MOCK_BRIEFING.preview)).toBeTruthy()
  })

  it('shows empty state when briefings category returns an empty array', () => {
    mockUseOutputs({ briefings: [] })
    render(<OutputsView />, { wrapper: Wrapper })

    expect(screen.getByText('No briefings yet.')).toBeTruthy()
  })

  it('switching to the Meetings tab shows meeting files', async () => {
    mockUseOutputs({
      briefings: [MOCK_BRIEFING],
      meetings: [MOCK_MEETING],
      reports: [MOCK_REPORT],
    })

    const user = userEvent.setup()
    render(<OutputsView />, { wrapper: Wrapper })

    // Click the Meetings tab
    await user.click(screen.getByRole('tab', { name: /meetings/i }))

    expect(screen.getByText(MOCK_MEETING.filename)).toBeTruthy()
    expect(screen.getByText(MOCK_MEETING.preview)).toBeTruthy()
    // Briefing file should no longer be in the panel content
    expect(screen.queryByText(MOCK_BRIEFING.filename)).toBeNull()
  })

  it('switching to the Reports tab shows report files', async () => {
    mockUseOutputs({
      briefings: [MOCK_BRIEFING],
      meetings: [MOCK_MEETING],
      reports: [MOCK_REPORT],
    })

    const user = userEvent.setup()
    render(<OutputsView />, { wrapper: Wrapper })

    await user.click(screen.getByRole('tab', { name: /reports/i }))

    expect(screen.getByText(MOCK_REPORT.filename)).toBeTruthy()
    expect(screen.queryByText(MOCK_BRIEFING.filename)).toBeNull()
  })

  it('shows empty state when meetings category returns an empty array', async () => {
    mockUseOutputs({ briefings: [MOCK_BRIEFING], meetings: [] })

    const user = userEvent.setup()
    render(<OutputsView />, { wrapper: Wrapper })

    await user.click(screen.getByRole('tab', { name: /meetings/i }))

    expect(screen.getByText('No meetings yet.')).toBeTruthy()
  })

  it('truncates preview text beyond 200 characters', () => {
    const longPreview = 'A'.repeat(250)
    const truncatedFile: OutputFile = { ...MOCK_BRIEFING, preview: longPreview }
    mockUseOutputs({ briefings: [truncatedFile] })
    render(<OutputsView />, { wrapper: Wrapper })

    // 200 'A's + ellipsis
    const expected = 'A'.repeat(200) + '…'
    expect(screen.getByText(expected)).toBeTruthy()
  })

  it('renders loading skeleton with accessible region when data is loading', () => {
    vi.mocked(useOutputs).mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
    } as ReturnType<typeof useOutputs>)

    render(<OutputsView />, { wrapper: Wrapper })

    expect(screen.getByRole('status', { name: 'Loading outputs' })).toBeTruthy()
  })
})
