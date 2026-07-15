import { describe, it, expect, vi } from 'vitest'
import { screen } from '@testing-library/react'
import { render } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import type { EvalRun } from '../api/useEvalRuns'

// ── Mocks ─────────────────────────────────────────────────────────────────────

let mockRuns: EvalRun[] = []

vi.mock('../api/useEvalRuns', () => ({
  useEvalRuns: () => ({ data: { runs: mockRuns }, isLoading: false }),
}))

vi.mock('../components/SectionHeader', () => ({
  default: ({ title }: { title: string }) => <div>{title}</div>,
}))

vi.mock('../components/StatusPill', () => ({
  default: ({ status }: { status: string }) => <span>{status}</span>,
}))

import EvalRunsView from './EvalRunsView'

function Wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
}

function makeRun(overrides: Partial<EvalRun> = {}): EvalRun {
  return {
    id: '1',
    eval_id: 'eval-1',
    agent: 'code-writer',
    attempt: 1,
    agent_run_id: null,
    status: 'done',
    grader_results: null,
    pass_at_k: null,
    k: null,
    duration_ms: null,
    started_at: '2026-07-01T10:00:00Z',
    ended_at: null,
    model: null,
    cost_tier: null,
    ...overrides,
  }
}

describe('EvalRunsView — graderSummary', () => {
  it('counts graders with status=pass (live writer format)', () => {
    mockRuns = [makeRun({
      grader_results: JSON.stringify([
        { grader_id: 'g1', status: 'pass' },
        { grader_id: 'g2', status: 'fail' },
        { grader_id: 'g3', status: 'pass' },
      ]),
    })]
    render(<Wrapper><EvalRunsView /></Wrapper>)
    expect(screen.getByText('2/3')).toBeInTheDocument()
  })

  it('falls back to legacy passed/outcome fields', () => {
    mockRuns = [makeRun({
      grader_results: JSON.stringify([
        { passed: true },
        { outcome: 'pass' },
        { outcome: 'fail' },
      ]),
    })]
    render(<Wrapper><EvalRunsView /></Wrapper>)
    expect(screen.getByText('2/3')).toBeInTheDocument()
  })

  it('shows em dash for null grader_results', () => {
    mockRuns = [makeRun({ grader_results: null })]
    render(<Wrapper><EvalRunsView /></Wrapper>)
    // Multiple em dashes may appear (model col, graders col etc)
    const dashes = screen.getAllByText('—')
    expect(dashes.length).toBeGreaterThan(0)
  })
})

describe('EvalRunsView — model column', () => {
  it('renders em dash for empty model string', () => {
    mockRuns = [makeRun({ model: '' })]
    render(<Wrapper><EvalRunsView /></Wrapper>)
    const dashes = screen.getAllByText('—')
    expect(dashes.length).toBeGreaterThan(0)
  })

  it('renders em dash for null model', () => {
    mockRuns = [makeRun({ model: null })]
    render(<Wrapper><EvalRunsView /></Wrapper>)
    const dashes = screen.getAllByText('—')
    expect(dashes.length).toBeGreaterThan(0)
  })

  it('renders model id when present', () => {
    mockRuns = [makeRun({ model: 'claude-fable-5' })]
    render(<Wrapper><EvalRunsView /></Wrapper>)
    expect(screen.getByText('claude-fable-5')).toBeInTheDocument()
  })
})
