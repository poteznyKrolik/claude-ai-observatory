import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { ReactNode } from 'react'

// Mock all hooks consumed by HomeView so it renders fully offline.
vi.mock('../api/useSystem', () => ({
  useSystemHealth: vi.fn(() => ({
    data: {
      agentCount: 5,
      commandCount: 3,
      skillCount: 2,
      ruleCount: 1,
      planCount: 0,
      projectMemoryCount: 0,
      agentMemoryCount: 0,
      sessionCount: 10,
      groupCount: 0,
      directiveCount: 0,
      hooks: [],
      env: {},
      model: 'claude-sonnet',
      version: '2.6.0',
    },
    isLoading: false,
  })),
}))

vi.mock('../api/useAgentRuns', () => ({
  useAgentRuns: vi.fn(() => ({
    data: {
      runs: [],
      stats: {
        totalRuns: 5,
        totalCostUsd: 0,
        byAgent: {},
        byStatus: { running: 19 },
      },
    },
    isLoading: false,
  })),
}))

vi.mock('../api/useActiveAgents', () => ({
  useActiveAgents: vi.fn(() => ({ data: [] })),
}))

vi.mock('../api/useTokenSpend', () => ({
  useTokenSpend: vi.fn(() => ({
    data: { daily: [] },
    isLoading: false,
  })),
}))

vi.mock('../lib/useChartColors', () => ({
  useChartColors: vi.fn(() => ({
    mint: '#00FFC2',
    blue: '#3B82F6',
    amber: '#F59E0B',
    rose: '#F43F5E',
  })),
}))

vi.mock('../api/useCastData', () => ({
  useQualityGateStats: vi.fn(() => ({ data: null })),
  useToolFailureStats: vi.fn(() => ({ data: null })),
  useDbMemories: vi.fn(() => ({ data: [] })),
  useResearchCacheStats: vi.fn(() => ({ data: null })),
}))

// Import hooks after mocking so vi.mocked() resolves correctly.
import { useActiveAgents } from '../api/useActiveAgents'
import { useAgentRuns } from '../api/useAgentRuns'
import HomeView from './HomeView'

function Wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return (
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>{children}</MemoryRouter>
    </QueryClientProvider>
  )
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('HomeView — Active Agents count correctness', () => {
  it('shows the windowed active-agents count (2), NOT the stale byStatus.running count (19)', () => {
    // useAgentRuns has 19 stale running rows; useActiveAgents has 2 live ones.
    vi.mocked(useAgentRuns).mockReturnValue({
      data: {
        runs: [],
        stats: {
          totalRuns: 5,
          totalCostUsd: 0,
          byAgent: {},
          byStatus: { running: 19 },
        },
      },
      isLoading: false,
    } as ReturnType<typeof useAgentRuns>)

    vi.mocked(useActiveAgents).mockReturnValue({
      data: [
        {
          id: '1', session_id: 's1', agent: 'code-writer', model: 'sonnet',
          started_at: new Date().toISOString(), ended_at: null,
          status: 'running', input_tokens: 0, output_tokens: 0,
          cost_usd: 0, task_summary: null, project: null,
        },
        {
          id: '2', session_id: 's2', agent: 'commit', model: 'haiku',
          started_at: new Date().toISOString(), ended_at: null,
          status: 'running', input_tokens: 0, output_tokens: 0,
          cost_usd: 0, task_summary: null, project: null,
        },
      ],
    } as ReturnType<typeof useActiveAgents>)

    render(<HomeView />, { wrapper: Wrapper })

    // Find the "Active Agents" label then assert the displayed count is "2".
    // getAllByText guards against "2" appearing in multiple places.
    const label = screen.getByText('Active Agents')
    // The value node is a sibling rendered inside the same bento-card container.
    // Walking up to the card and checking for "2" is robust against layout changes.
    const card = label.closest('.bento-card') ?? label.parentElement?.parentElement
    expect(card).toBeTruthy()
    // The value "2" must appear somewhere inside the card.
    expect(card!.textContent).toContain('2')
    // And "19" must NOT appear as the stat — the whole card text should not say 19
    // as the primary count (note: "19" may exist elsewhere on the page; we only
    // care that the Active Agents card does not surface it as a count).
    expect(card!.querySelector('.text-2xl')?.textContent).toBe('2')
  })

  it('shows "0" and "none running" when no active agents are windowed', () => {
    vi.mocked(useAgentRuns).mockReturnValue({
      data: {
        runs: [],
        stats: { totalRuns: 0, totalCostUsd: 0, byAgent: {}, byStatus: {} },
      },
      isLoading: false,
    } as ReturnType<typeof useAgentRuns>)

    vi.mocked(useActiveAgents).mockReturnValue({
      data: [],
    } as ReturnType<typeof useActiveAgents>)

    render(<HomeView />, { wrapper: Wrapper })

    const label = screen.getByText('Active Agents')
    const card = label.closest('.bento-card') ?? label.parentElement?.parentElement
    expect(card).toBeTruthy()
    expect(card!.querySelector('.text-2xl')?.textContent).toBe('0')
    expect(card!.textContent).toContain('none running')
  })
})
