import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReactNode } from 'react'

vi.mock('../api/useMemory', () => ({
  useAgentMemory: vi.fn(),
  useProjectMemory: vi.fn(),
}))

import { useAgentMemory, useProjectMemory } from '../api/useMemory'
import MemoryView from './MemoryView'

function Wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}

const MOCK_AGENT_MEMORIES = [
  {
    agent: 'code-writer',
    path: '/agents/code-writer/feedback_testing.md',
    filename: 'feedback_testing.md',
    name: 'feedback-testing',
    description: 'Integration tests must hit a real database',
    type: 'feedback',
    body: '# Feedback\nNo mocks for DB tests.',
    lastModified: '2026-05-01T10:00:00Z',
  },
  {
    agent: 'code-writer',
    path: '/agents/code-writer/user_role.md',
    filename: 'user_role.md',
    name: 'user-role',
    description: 'User is a senior engineer',
    type: 'user',
    body: '# User\nSenior engineer.',
    lastModified: '2026-05-02T12:00:00Z',
  },
]

const MOCK_PROJECT_MEMORIES = [
  {
    agent: 'project',
    path: '/projects/dashboard/MEMORY.md',
    filename: 'MEMORY.md',
    name: 'dashboard-refactor',
    description: '16 to 7 pages refactor',
    type: 'project',
    body: '# Project Memory\nDashboard refactor 2026-04-02.',
    lastModified: '2026-04-02T09:00:00Z',
  },
]

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(useAgentMemory).mockReturnValue({
    data: MOCK_AGENT_MEMORIES,
    isLoading: false,
    error: null,
  } as ReturnType<typeof useAgentMemory>)
  vi.mocked(useProjectMemory).mockReturnValue({
    data: MOCK_PROJECT_MEMORIES,
    isLoading: false,
    error: null,
  } as ReturnType<typeof useProjectMemory>)
})

describe('MemoryView', () => {
  it('renders memory rows with correct type badges', () => {
    render(<MemoryView />, { wrapper: Wrapper })

    expect(screen.getByText('feedback-testing')).toBeTruthy()
    expect(screen.getByText('user-role')).toBeTruthy()
    expect(screen.getByText('feedback')).toBeTruthy()
    expect(screen.getByText('user')).toBeTruthy()
  })

  it('shows memory count in header', () => {
    render(<MemoryView />, { wrapper: Wrapper })

    expect(screen.getByText('2 entries')).toBeTruthy()
  })

  it('shows loading skeleton when data is loading', () => {
    vi.mocked(useAgentMemory).mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
    } as ReturnType<typeof useAgentMemory>)
    vi.mocked(useProjectMemory).mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
    } as ReturnType<typeof useProjectMemory>)

    render(<MemoryView />, { wrapper: Wrapper })

    expect(screen.getByText('Memory')).toBeTruthy()
    expect(screen.queryByText('feedback-testing')).toBeNull()
  })

  it('defaults to agent memory source', () => {
    render(<MemoryView />, { wrapper: Wrapper })

    // Agent memories are shown by default
    expect(screen.getByText('feedback-testing')).toBeTruthy()
    // Project memory not shown
    expect(screen.queryByText('dashboard-refactor')).toBeNull()
  })

  it('toggles to project memory source', async () => {
    const user = userEvent.setup()
    render(<MemoryView />, { wrapper: Wrapper })

    const projectToggle = screen.getByRole('button', { name: 'Project Memory' })
    await user.click(projectToggle)

    expect(screen.getByText('dashboard-refactor')).toBeTruthy()
    expect(screen.queryByText('feedback-testing')).toBeNull()
  })

  it('shows empty state when no memories are found', () => {
    vi.mocked(useAgentMemory).mockReturnValue({
      data: [],
      isLoading: false,
      error: null,
    } as ReturnType<typeof useAgentMemory>)

    render(<MemoryView />, { wrapper: Wrapper })

    expect(screen.getByText('No memory files found')).toBeTruthy()
  })

  it('shows error state when fetch fails', () => {
    vi.mocked(useAgentMemory).mockReturnValue({
      data: undefined,
      isLoading: false,
      error: new Error('Network error'),
    } as ReturnType<typeof useAgentMemory>)

    render(<MemoryView />, { wrapper: Wrapper })

    expect(screen.getByRole('alert')).toBeTruthy()
  })

  it('renders descriptions as secondary text', () => {
    render(<MemoryView />, { wrapper: Wrapper })

    expect(screen.getByText('Integration tests must hit a real database')).toBeTruthy()
    expect(screen.getByText('User is a senior engineer')).toBeTruthy()
  })
})
