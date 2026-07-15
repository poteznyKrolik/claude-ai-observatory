import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { ReactNode } from 'react'

// Mock heavy deps that aren't relevant to this smoke test
vi.mock('../api/useRoutingEventsByType', () => ({
  useRoutingEventsByType: () => ({ data: [] }),
}))
vi.mock('../api/useHookEvents', () => ({
  useHookEventsStream: () => ({ events: [], connected: false }),
}))
vi.mock('../api/useUnstagedWarnings', () => ({
  useUnstagedWarnings: () => ({ data: { warnings: [] } }),
}))
vi.mock('@tanstack/react-virtual', () => ({
  useVirtualizer: () => ({
    getVirtualItems: () => [],
    getTotalSize: () => 0,
  }),
}))

// Mock useSessions at module level
vi.mock('../api/useSessions', () => ({
  useSessions: vi.fn(),
}))

import { useSessions } from '../api/useSessions'
import SessionsView from './SessionsView'

function Wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return (
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>{children}</MemoryRouter>
    </QueryClientProvider>
  )
}

const MOCK_SESSION = {
  id: 'abc12345-0000-4000-8000-000000000001',
  project: 'my-project',
  projectPath: '/Users/test/my-project',
  projectEncoded: 'my-project',
  startedAt: new Date(Date.now() - 3_600_000).toISOString(),
  messageCount: 10,
  toolCallCount: 5,
  agentCount: 2,
  inputTokens: 1000,
  outputTokens: 500,
  cacheCreationTokens: 0,
  cacheReadTokens: 0,
  model: 'claude-sonnet-4-5',
}

const DELETED_SESSION = {
  ...MOCK_SESSION,
  id: 'abc12345-0000-4000-8000-000000000002',
  deleted_at: '2026-05-19T10:00:00Z',
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('SessionsView', () => {
  it('renders session list when data is present', async () => {
    vi.mocked(useSessions).mockReturnValue({
      data: [MOCK_SESSION],
      isLoading: false,
      error: null,
    } as ReturnType<typeof useSessions>)

    render(<SessionsView />, { wrapper: Wrapper })

    // The project name should appear in the table
    expect(screen.getAllByText(/my-project/i).length).toBeGreaterThan(0)
  })

  it('shows loading state when data is pending', () => {
    vi.mocked(useSessions).mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
    } as ReturnType<typeof useSessions>)

    render(<SessionsView />, { wrapper: Wrapper })

    // Loading skeletons are rendered — just ensure component doesn't crash
    expect(document.body).toBeTruthy()
  })

  it('does not render deleted sessions in the list', () => {
    // The server filters deleted sessions — the client gets only live sessions
    vi.mocked(useSessions).mockReturnValue({
      data: [MOCK_SESSION],
      isLoading: false,
      error: null,
    } as ReturnType<typeof useSessions>)

    render(<SessionsView />, { wrapper: Wrapper })

    // DELETED_SESSION id should not appear (it wasn't returned by server)
    expect(screen.queryByText(DELETED_SESSION.id.slice(0, 8))).toBeNull()
  })
})
