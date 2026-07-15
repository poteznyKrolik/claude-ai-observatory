import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReactNode } from 'react'

// ── Mocks ──────────────────────────────────────────────────────────────────

// useCommands hook (used by SlashCommandsSection)
vi.mock('../api/useKnowledge', () => ({
  useCommands: vi.fn(),
  useSkills: vi.fn(),
  useRules: vi.fn(),
  useFileContent: vi.fn(),
}))

import { useCommands } from '../api/useKnowledge'

// Stub global fetch for the inline useQuery calls in AgentsSection and SkillsSection
const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

function Wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  })
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}

// Helper: build a minimal fetch response
function makeFetchResponse(data: unknown, ok = true) {
  return Promise.resolve({
    ok,
    json: () => Promise.resolve(data),
    status: ok ? 200 : 500,
    statusText: ok ? 'OK' : 'Internal Server Error',
  } as Response)
}

const MOCK_COMMANDS = [
  { name: 'bash',   preview: 'Routes to: bash-specialist', path: '/a', modifiedAt: '2026-01-01T00:00:00.000Z' },
  { name: 'commit', preview: 'Routes to: commit',          path: '/b', modifiedAt: '2026-01-01T00:00:00.000Z' },
  { name: 'ci-watch', preview: 'Watch CI checks...',       path: '/c', modifiedAt: '2026-01-01T00:00:00.000Z' },
]

const MOCK_AGENTS = [
  { name: 'api-contract', model: 'haiku', description: 'API contract guardian' },
  { name: 'code-writer',  model: 'sonnet', description: 'Code changes and implementations' },
  { name: 'migration-reviewer', model: 'opus', description: 'Database schema change review' },
]

const MOCK_SKILLS = [
  { name: 'careful-mode', description: 'Require confirmation before writes', invocable: true,  path: '/s', modifiedAt: '' },
  { name: 'cast-conventions', description: 'Shared CAST conventions', invocable: false, path: '/s2', modifiedAt: '' },
]

beforeEach(() => {
  vi.clearAllMocks()
  // Default: agents and skills succeed
  mockFetch.mockImplementation((url: string) => {
    if (url === '/api/agents') return makeFetchResponse(MOCK_AGENTS)
    if (url === '/api/skills') return makeFetchResponse(MOCK_SKILLS)
    return makeFetchResponse([], false)
  })
})

// ── Import after mocks ─────────────────────────────────────────────────────
import DocsView from './DocsView'

// ── Tests ──────────────────────────────────────────────────────────────────

describe('DocsView — SlashCommandsSection', () => {
  it('renders live commands from API when available', async () => {
    vi.mocked(useCommands).mockReturnValue({
      data: MOCK_COMMANDS,
      isError: false,
      isLoading: false,
      isPending: false,
    } as ReturnType<typeof useCommands>)

    render(<DocsView />, { wrapper: Wrapper })

    // Live commands appear with slash prefix
    expect(await screen.findByText('/bash')).toBeTruthy()
    expect(screen.getByText('/ci-watch')).toBeTruthy()
    // Wait for the live /api/agents query to settle so the 23-entry fallback
    // roster (which also contains "bash-specialist") is no longer rendered.
    await screen.findByText('api-contract')
    // Agent extracted from "Routes to: bash-specialist" (commands Agent column only)
    expect(screen.getByText('bash-specialist')).toBeTruthy()
  })

  it('renders fallback commands when API errors', () => {
    vi.mocked(useCommands).mockReturnValue({
      data: undefined,
      isError: true,
      isLoading: false,
      isPending: false,
    } as ReturnType<typeof useCommands>)

    render(<DocsView />, { wrapper: Wrapper })

    // Hardcoded fallback includes /ci-watch (verified 2026-07-02)
    expect(screen.getByText('/ci-watch')).toBeTruthy()
    expect(screen.getByText('/feature')).toBeTruthy()
    expect(screen.getByText('/laconic')).toBeTruthy()
    // 21 commands in fallback list (3 headers vs prior 18)
    const commandCells = screen.getAllByText(/^\/[a-z-]+$/)
    expect(commandCells.length).toBe(21)
  })

  it('shows "static snapshot — API unreachable" badge on error', () => {
    vi.mocked(useCommands).mockReturnValue({
      data: undefined,
      isError: true,
      isLoading: false,
      isPending: false,
    } as ReturnType<typeof useCommands>)

    render(<DocsView />, { wrapper: Wrapper })

    const badges = screen.getAllByText('static snapshot — API unreachable')
    // At least one badge visible (SlashCommands section has one)
    expect(badges.length).toBeGreaterThan(0)
  })

  it('does NOT show fallback badge when API succeeds', async () => {
    vi.mocked(useCommands).mockReturnValue({
      data: MOCK_COMMANDS,
      isError: false,
      isLoading: false,
      isPending: false,
    } as ReturnType<typeof useCommands>)

    render(<DocsView />, { wrapper: Wrapper })

    await screen.findByText('/bash')
    expect(screen.queryByText('static snapshot — API unreachable')).toBeNull()
  })
})

describe('DocsView — AgentsSection', () => {
  beforeEach(() => {
    vi.mocked(useCommands).mockReturnValue({
      data: MOCK_COMMANDS,
      isError: false,
      isLoading: false,
      isPending: false,
    } as ReturnType<typeof useCommands>)
  })

  it('renders live agents from /api/agents', async () => {
    render(<DocsView />, { wrapper: Wrapper })

    expect(await screen.findByText('api-contract')).toBeTruthy()
    expect(screen.getByText('migration-reviewer')).toBeTruthy()
    // opus badge should render
    expect(screen.getByText('opus')).toBeTruthy()
  })

  it('renders 23-entry fallback roster when /api/agents fails', async () => {
    mockFetch.mockImplementation((url: string) => {
      if (url === '/api/agents') return makeFetchResponse([], false)
      if (url === '/api/skills') return makeFetchResponse(MOCK_SKILLS)
      return makeFetchResponse([])
    })

    render(<DocsView />, { wrapper: Wrapper })

    // Fallback contains agents that weren't in v7/v8 roster
    expect(await screen.findByText('eval-writer')).toBeTruthy()
    expect(screen.getByText('dep-auditor')).toBeTruthy()
    expect(screen.getByText('migration-reviewer')).toBeTruthy()
    expect(screen.getByText('pr-reviewer')).toBeTruthy()
    expect(screen.getByText('perf-sentinel')).toBeTruthy()
    // No retired 'orchestrator' agent in v9 roster
    expect(screen.queryByText('orchestrator')).toBeNull()
  })
})

describe('DocsView — SkillsSection', () => {
  beforeEach(() => {
    vi.mocked(useCommands).mockReturnValue({
      data: MOCK_COMMANDS,
      isError: false,
      isLoading: false,
      isPending: false,
    } as ReturnType<typeof useCommands>)
  })

  it('renders invocable column driven by API field', async () => {
    render(<DocsView />, { wrapper: Wrapper })

    // careful-mode → invocable: true → "Yes"
    expect(await screen.findByText('careful-mode')).toBeTruthy()

    // The InvocableBadge text for invocable=true is "Yes", false is "No"
    const yesBadges = screen.getAllByText('Yes')
    const noBadges = screen.getAllByText('No')
    expect(yesBadges.length).toBeGreaterThan(0)
    expect(noBadges.length).toBeGreaterThan(0)
  })

  it('shows fallback badge when /api/skills fails', async () => {
    mockFetch.mockImplementation((url: string) => {
      if (url === '/api/agents') return makeFetchResponse(MOCK_AGENTS)
      if (url === '/api/skills') return makeFetchResponse([], false)
      return makeFetchResponse([])
    })

    render(<DocsView />, { wrapper: Wrapper })

    // Wait for the failed /api/skills query to flip to its error state and
    // render the fallback badge (agents succeed, so only Skills shows it).
    const badge = await screen.findByText('static snapshot — API unreachable')
    expect(badge).toBeTruthy()
  })
})
