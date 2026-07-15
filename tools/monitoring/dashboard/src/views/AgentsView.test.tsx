import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { ReactNode } from 'react'

vi.mock('../api/useAgents', () => ({
  useAgents: vi.fn(),
  useAgent: vi.fn(() => ({ data: null, isLoading: false })),
}))
vi.mock('../api/useActiveAgents', () => ({
  useActiveAgents: vi.fn(() => ({ data: [] })),
}))
vi.mock('../api/useAgentRuns', () => ({
  useAgentRuns: vi.fn(() => ({ data: { runs: [], stats: {} } })),
}))
vi.mock('../api/useAgentRoster', () => ({
  useAgentRoster: vi.fn(() => ({ data: { agents: [], count: 0, source: 'filesystem' } })),
}))
vi.mock('../api/useDispatchDecisions', () => ({
  useDispatchDecisions: vi.fn(() => ({ data: { decisions: [] } })),
}))
vi.mock('../api/useInjectionLog', () => ({
  useInjectionLog: vi.fn(() => ({ data: { entries: [] } })),
}))

import { useAgents } from '../api/useAgents'
import { useAgentRoster } from '../api/useAgentRoster'
import AgentsView from './AgentsView'

function Wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return (
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>{children}</MemoryRouter>
    </QueryClientProvider>
  )
}

const MOCK_AGENT = {
  name: 'code-writer',
  description: 'Writes and edits code files',
  model: 'sonnet',
  color: '#00FFC2',
  tools: ['Read', 'Edit'],
  maxTurns: 10,
  memory: 'local',
  filePath: '/agents/code-writer.md',
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('AgentsView', () => {
  it('renders agent registry cards when data is present', () => {
    vi.mocked(useAgents).mockReturnValue({
      data: [MOCK_AGENT],
      isLoading: false,
      error: null,
    } as ReturnType<typeof useAgents>)

    render(<AgentsView />, { wrapper: Wrapper })

    // 'code-writer' appears in both registry card and filter dropdown
    expect(screen.getAllByText('code-writer').length).toBeGreaterThan(0)
    expect(screen.getByText('Writes and edits code files')).toBeTruthy()
  })

  it('shows loading skeleton when agents are loading', () => {
    vi.mocked(useAgents).mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
    } as ReturnType<typeof useAgents>)

    render(<AgentsView />, { wrapper: Wrapper })

    // Page header should still render
    expect(screen.getByText('Agents')).toBeTruthy()
  })

  it('shows empty state message when no agents match search', () => {
    vi.mocked(useAgents).mockReturnValue({
      data: [],
      isLoading: false,
      error: null,
    } as ReturnType<typeof useAgents>)

    render(<AgentsView />, { wrapper: Wrapper })

    expect(screen.getByText(/No agents match/i)).toBeTruthy()
  })

  it('renders roster installed count when source is filesystem', () => {
    vi.mocked(useAgents).mockReturnValue({
      data: [],
      isLoading: false,
      error: null,
    } as ReturnType<typeof useAgents>)
    vi.mocked(useAgentRoster).mockReturnValue({
      data: { agents: ['code-writer', 'commit', 'debugger'], count: 3, source: 'filesystem' },
      isLoading: false,
    } as ReturnType<typeof useAgentRoster>)

    render(<AgentsView />, { wrapper: Wrapper })

    expect(screen.getByText('3 installed')).toBeTruthy()
    expect(screen.getByTitle('live roster from ~/.claude/agents')).toBeTruthy()
  })

  it('renders built-in label with accessible title when source is fallback', () => {
    vi.mocked(useAgents).mockReturnValue({
      data: [],
      isLoading: false,
      error: null,
    } as ReturnType<typeof useAgents>)
    vi.mocked(useAgentRoster).mockReturnValue({
      data: { agents: ['code-writer'], count: 12, source: 'fallback' },
      isLoading: false,
    } as ReturnType<typeof useAgentRoster>)

    render(<AgentsView />, { wrapper: Wrapper })

    expect(screen.getByText('12 built-in')).toBeTruthy()
    expect(screen.getByTitle('roster unavailable — showing built-in list')).toBeTruthy()
  })
})
