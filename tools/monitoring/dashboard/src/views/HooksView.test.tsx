import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReactNode } from 'react'

// HooksView defines useHooks inline and also calls useHookHealth (/api/hooks/health)
// — mock fetch at the module boundary, routing by URL so the two concurrent
// requests don't race over a single mockResolvedValueOnce.
const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

import HooksView from './HooksView'

function Wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}

// Per-test response for GET /api/hooks. The health endpoint always returns an
// empty roster (HookHealthPanel renders nothing) so it never affects assertions.
type FetchResult = { ok: boolean; status?: number; json?: () => Promise<unknown> }
let hooksResponse: FetchResult | Promise<never>

beforeEach(() => {
  vi.clearAllMocks()
  hooksResponse = { ok: true, json: async () => [] }
  mockFetch.mockImplementation((url: string) => {
    if (typeof url === 'string' && url.includes('/api/hooks/health')) {
      return Promise.resolve({ ok: true, json: async () => ({ hooks: [] }) })
    }
    return hooksResponse instanceof Promise ? hooksResponse : Promise.resolve(hooksResponse)
  })
})

const MOCK_HOOKS = [
  { event: 'PreToolUse', type: 'command', command: 'bash scripts/pre-tool.sh', matcher: 'Bash' },
  { event: 'PostToolUse', type: 'command', command: 'bash scripts/post-tool.sh' },
  { event: 'PostToolUse', type: 'command', command: 'bash scripts/audit.sh', timeout: 5000 },
]

describe('HooksView', () => {
  it('renders grouped hook list when data is present', async () => {
    hooksResponse = { ok: true, json: async () => MOCK_HOOKS }

    render(<HooksView />, { wrapper: Wrapper })

    // Heading always renders
    expect(screen.getByText('Hooks')).toBeTruthy()

    // Wait for data to load
    expect(await screen.findByText('PreToolUse')).toBeTruthy()
    expect(screen.getByText('PostToolUse')).toBeTruthy()
    expect(screen.getByText('bash scripts/pre-tool.sh')).toBeTruthy()
    expect(screen.getByText('bash scripts/post-tool.sh')).toBeTruthy()
  })

  it('renders hook count in header', async () => {
    hooksResponse = { ok: true, json: async () => MOCK_HOOKS }

    render(<HooksView />, { wrapper: Wrapper })

    expect(await screen.findByText('3 hooks')).toBeTruthy()
  })

  it('shows loading skeleton before data arrives', () => {
    // Never resolve — stays in loading state
    hooksResponse = new Promise(() => {})

    render(<HooksView />, { wrapper: Wrapper })

    // Header renders even during load
    expect(screen.getByText('Hooks')).toBeTruthy()
    // Hook list not yet present
    expect(screen.queryByText('PreToolUse')).toBeNull()
  })

  it('shows empty state when no hooks are configured', async () => {
    hooksResponse = { ok: true, json: async () => [] }

    render(<HooksView />, { wrapper: Wrapper })

    expect(await screen.findByText('No hooks configured')).toBeTruthy()
  })

  it('shows error state when fetch fails', async () => {
    hooksResponse = { ok: false, status: 500 }

    render(<HooksView />, { wrapper: Wrapper })

    expect(await screen.findByText('Failed to load hooks.')).toBeTruthy()
  })

  it('groups hooks under their event name', async () => {
    hooksResponse = { ok: true, json: async () => MOCK_HOOKS }

    render(<HooksView />, { wrapper: Wrapper })

    await screen.findByText('PreToolUse')

    // PostToolUse section should show count badge of 2
    const sections = screen.getAllByRole('region')
    expect(sections.length).toBe(2) // PreToolUse + PostToolUse
  })
})
