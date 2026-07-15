import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { ReactNode } from 'react'

// Virtualizer relies on real layout (absent in jsdom); mock it to render no rows so the
// test asserts the header/stats/loading/error behavior (C7), not virtualization internals.
vi.mock('@tanstack/react-virtual', () => ({
  useVirtualizer: () => ({
    getVirtualItems: () => [],
    getTotalSize: () => 0,
    measureElement: () => {},
  }),
}))
// react-resizable-panels needs real layout / ResizeObserver (absent in jsdom); render
// its wrappers as plain passthroughs so the loaded view mounts.
vi.mock('../components/ui/resizable', () => ({
  ResizablePanelGroup: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  ResizablePanel: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  ResizableHandle: () => <div />,
}))
vi.mock('../api/useSessions', () => ({ useSession: vi.fn() }))
vi.mock('../api/useSessionAgents', () => ({
  useSessionAgents: () => ({ data: { runs: [] }, isLoading: false }),
  useWorktrees: () => ({ data: { worktrees: [] }, isLoading: false }),
}))

import { useSession } from '../api/useSessions'
import SessionDetailView from './SessionDetailView'

function renderView() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={['/sessions/my-project/sess-1']}>
        <Routes>
          <Route path="/sessions/:project/:sessionId" element={<SessionDetailView />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  )
}

const ENTRIES = [
  { uuid: 'u1', type: 'user', timestamp: new Date().toISOString(), message: { role: 'user', content: 'hello' } },
  {
    uuid: 'a1', type: 'assistant', timestamp: new Date().toISOString(),
    message: { role: 'assistant', content: 'hi there', model: 'claude-sonnet-4-5', usage: { input_tokens: 10, output_tokens: 5 } },
  },
]

function mockSession(value: unknown) {
  vi.mocked(useSession).mockReturnValue(value as ReturnType<typeof useSession>)
}

beforeEach(() => vi.clearAllMocks())

describe('SessionDetailView', () => {
  it('shows a loading state without the loaded chrome', () => {
    mockSession({ data: undefined, isLoading: true, error: null })
    renderView()
    expect(screen.queryByText('Export MD')).toBeNull()
    expect(screen.queryByText('Session not found')).toBeNull()
  })

  it('shows "Session not found" for an empty/error result', () => {
    mockSession({ data: [], isLoading: false, error: null })
    renderView()
    expect(screen.getByText('Session not found')).toBeInTheDocument()
  })

  it('renders the session header and stats when loaded', () => {
    mockSession({ data: ENTRIES, isLoading: false, error: null })
    renderView()
    expect(screen.getByRole('heading', { name: 'my-project' })).toBeInTheDocument()
    expect(screen.getByText('Export MD')).toBeInTheDocument()
    expect(screen.getByText('user')).toBeInTheDocument()
    expect(screen.getByText('assistant')).toBeInTheDocument()
    expect(screen.getByText('entries')).toBeInTheDocument()
  })
})
