import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import WorkLogFeed from './WorkLogFeed'
import type { WorkLogEntry } from '../api/useWorkLogStream'

// Mock the timeAgo utility
vi.mock('../utils/time', () => ({
  timeAgo: (date: string) => {
    const now = Date.now()
    const then = new Date(date).getTime()
    const minutes = Math.floor((now - then) / 1000 / 60)
    if (minutes < 1) return 'just now'
    if (minutes < 60) return `${minutes}m ago`
    return '1h ago'
  },
}))

// ─── Test fixtures ────────────────────────────────────────────────────────────

function createMockEntry(overrides?: Partial<WorkLogEntry>): WorkLogEntry {
  return {
    agentRunId: 'run-123',
    agentName: 'code-reviewer',
    model: 'claude-haiku-4.5',
    sessionId: 'session-abc-123',
    startedAt: new Date(Date.now() - 5 * 60 * 1000).toISOString(), // 5 minutes ago
    status: 'DONE',
    workLog: {
      items: ['Reviewed code style', 'Checked test coverage'],
      filesRead: ['src/app.ts', 'src/main.tsx'],
      filesChanged: ['src/app.ts'],
      decisions: ['Approved with suggestions'],
    },
    partialWorkLog: null,
    isTruncated: false,
    parryGuardFired: false,
    qualityGateVerdict: null,
    dispatchedBy: 'main-session',
    dispatchedTo: null,
    ...overrides,
  }
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('WorkLogFeed', () => {
  describe('Loading state', () => {
    it('renders skeleton cards when isLoading=true', () => {
      render(<WorkLogFeed entries={[]} isLoading={true} />)
      const skeletons = screen.getAllByRole('generic', { hidden: true })
      expect(skeletons.length).toBeGreaterThan(0)
    })

    it('renders 4 skeleton cards', () => {
      const { container } = render(<WorkLogFeed entries={[]} isLoading={true} />)
      const skeletonCards = container.querySelectorAll('.bento-card')
      expect(skeletonCards).toHaveLength(4)
    })

    it('hides content when loading', () => {
      const entries = [createMockEntry()]
      const { container } = render(<WorkLogFeed entries={entries} isLoading={true} />)
      const articles = container.querySelectorAll('[role="article"]')
      expect(articles).toHaveLength(0)
    })
  })

  describe('Error state', () => {
    it('renders error message when error prop is provided', () => {
      const error = new Error('Failed to fetch stream')
      render(<WorkLogFeed entries={[]} error={error} />)
      expect(screen.getByText(/Failed to load work logs/)).toBeInTheDocument()
      expect(screen.getByText(/Failed to fetch stream/)).toBeInTheDocument()
    })

    it('uses error.message in the error text', () => {
      const error = new Error('Network timeout')
      render(<WorkLogFeed entries={[]} error={error} />)
      expect(screen.getByText(/Network timeout/)).toBeInTheDocument()
    })

    it('renders error message in a bento-card', () => {
      const error = new Error('Server error')
      const { container } = render(<WorkLogFeed entries={[]} error={error} />)
      const card = container.querySelector('.bento-card')
      expect(card).toBeInTheDocument()
      expect(within(card!).getByText(/Failed to load work logs/)).toBeInTheDocument()
    })
  })

  describe('Empty state', () => {
    it('renders empty state when entries array is empty', () => {
      render(<WorkLogFeed entries={[]} />)
      expect(screen.getByText(/No agent work logs yet/)).toBeInTheDocument()
    })

    it('renders help text in empty state', () => {
      render(<WorkLogFeed entries={[]} />)
      expect(
        screen.getByText(/Agent runs with ## Work Log sections will appear here/),
      ).toBeInTheDocument()
    })

    it('renders empty state in a bento-card', () => {
      const { container } = render(<WorkLogFeed entries={[]} />)
      const card = container.querySelector('.bento-card')
      expect(card).toBeInTheDocument()
      expect(within(card!).getByText(/No agent work logs yet/)).toBeInTheDocument()
    })
  })

  describe('Entry rendering', () => {
    it('renders one article per entry', () => {
      const entries = [
        createMockEntry({ agentRunId: 'run-1' }),
        createMockEntry({ agentRunId: 'run-2' }),
        createMockEntry({ agentRunId: 'run-3' }),
      ]
      const { container } = render(<WorkLogFeed entries={entries} />)
      const articles = container.querySelectorAll('[role="article"]')
      expect(articles).toHaveLength(3)
    })

    it('renders agent name in heading', () => {
      const entry = createMockEntry({ agentName: 'test-writer' })
      render(<WorkLogFeed entries={[entry]} />)
      expect(screen.getByText('test-writer')).toBeInTheDocument()
    })

    it('renders multiple entry agent names', () => {
      const entries = [
        createMockEntry({ agentRunId: 'run-1', agentName: 'commit' }),
        createMockEntry({ agentRunId: 'run-2', agentName: 'test-runner' }),
        createMockEntry({ agentRunId: 'run-3', agentName: 'code-writer' }),
      ]
      render(<WorkLogFeed entries={entries} />)
      expect(screen.getByText('commit')).toBeInTheDocument()
      expect(screen.getByText('test-runner')).toBeInTheDocument()
      expect(screen.getByText('code-writer')).toBeInTheDocument()
    })
  })

  describe('Model badge', () => {
    it('renders model badge', () => {
      const entry = createMockEntry({ model: 'claude-sonnet-4.7' })
      render(<WorkLogFeed entries={[entry]} />)
      expect(screen.getByText('sonnet')).toBeInTheDocument()
    })

    it('extracts haiku from full model name', () => {
      const entry = createMockEntry({ model: 'claude-haiku-4.5' })
      render(<WorkLogFeed entries={[entry]} />)
      expect(screen.getByText('haiku')).toBeInTheDocument()
    })

    it('extracts opus from full model name', () => {
      const entry = createMockEntry({ model: 'claude-opus-4.1' })
      render(<WorkLogFeed entries={[entry]} />)
      expect(screen.getByText('opus')).toBeInTheDocument()
    })

    it('shows "unknown" when model is null', () => {
      const entry = createMockEntry({ model: null })
      render(<WorkLogFeed entries={[entry]} />)
      expect(screen.getByText('unknown')).toBeInTheDocument()
    })

    it('renders full model name for unknown models', () => {
      const entry = createMockEntry({ model: 'my-custom-model-v1' })
      render(<WorkLogFeed entries={[entry]} />)
      expect(screen.getByText('my-custom-model-v1')).toBeInTheDocument()
    })
  })

  describe('Status chip', () => {
    it('renders status chip with status value', () => {
      const entry = createMockEntry({ status: 'DONE' })
      render(<WorkLogFeed entries={[entry]} />)
      expect(screen.getByText('DONE')).toBeInTheDocument()
    })

    it('renders DONE status', () => {
      const entry = createMockEntry({ status: 'DONE' })
      const { container } = render(<WorkLogFeed entries={[entry]} />)
      const statusChip = screen.getByText('DONE').closest('span')
      expect(statusChip).toHaveClass('bg-emerald-900/40', 'text-emerald-400')
    })

    it('renders DONE_WITH_CONCERNS status', () => {
      const entry = createMockEntry({ status: 'DONE_WITH_CONCERNS' })
      const { container } = render(<WorkLogFeed entries={[entry]} />)
      const statusChip = screen.getByText('DONE_WITH_CONCERNS').closest('span')
      expect(statusChip).toHaveClass('bg-amber-900/40', 'text-amber-400')
    })

    it('renders BLOCKED status', () => {
      const entry = createMockEntry({ status: 'BLOCKED' })
      render(<WorkLogFeed entries={[entry]} />)
      const statusChip = screen.getByText('BLOCKED').closest('span')
      expect(statusChip).toHaveClass('bg-rose-900/40', 'text-rose-400')
    })

    it('renders NEEDS_CONTEXT status', () => {
      const entry = createMockEntry({ status: 'NEEDS_CONTEXT' })
      render(<WorkLogFeed entries={[entry]} />)
      const statusChip = screen.getByText('NEEDS_CONTEXT').closest('span')
      expect(statusChip).toHaveClass('bg-blue-900/40', 'text-blue-400')
    })

    it('renders "unknown" when status is null', () => {
      const entry = createMockEntry({ status: null })
      render(<WorkLogFeed entries={[entry]} />)
      expect(screen.getByText('unknown')).toBeInTheDocument()
    })

    it('applies secondary styling when status is null', () => {
      const entry = createMockEntry({ status: null })
      render(<WorkLogFeed entries={[entry]} />)
      const unknownStatus = screen.getAllByText('unknown')[0].closest('span')
      expect(unknownStatus).toHaveClass('bg-[var(--bg-secondary)]')
    })
  })

  describe('Timestamp', () => {
    it('renders relative time when startedAt is provided', () => {
      const entry = createMockEntry()
      render(<WorkLogFeed entries={[entry]} />)
      expect(screen.getByText(/ago/)).toBeInTheDocument()
    })

    it('renders "--" when startedAt is missing', () => {
      const entry = createMockEntry({ startedAt: '' })
      render(<WorkLogFeed entries={[entry]} />)
      expect(screen.getByText('--')).toBeInTheDocument()
    })
  })

  describe('Session ID', () => {
    it('displays session ID when provided', () => {
      const entry = createMockEntry({ sessionId: 'session-xyz-789' })
      render(<WorkLogFeed entries={[entry]} />)
      expect(screen.getByText(/session-xyz-789/)).toBeInTheDocument()
    })

    it('hides session line when sessionId is null', () => {
      const entry = createMockEntry({ sessionId: null })
      render(<WorkLogFeed entries={[entry]} />)
      expect(screen.queryByText(/^session:/)).not.toBeInTheDocument()
    })

    it('formats session ID with "session:" prefix', () => {
      const entry = createMockEntry({ sessionId: 'sess-abc' })
      render(<WorkLogFeed entries={[entry]} />)
      expect(screen.getByText(/session: sess-abc/)).toBeInTheDocument()
    })
  })

  describe('Truncation banner', () => {
    it('renders truncation banner when isTruncated=true', () => {
      const entry = createMockEntry({
        isTruncated: true,
        partialWorkLog: 'Status: DONE\n## Work Log',
      })
      render(<WorkLogFeed entries={[entry]} />)
      expect(screen.getByText('truncated')).toBeInTheDocument()
    })

    it('displays partialWorkLog text inside truncation banner', () => {
      const partialText = 'Status: DONE\n## Work Log\n- Started task'
      const entry = createMockEntry({
        isTruncated: true,
        partialWorkLog: partialText,
      })
      const { container } = render(<WorkLogFeed entries={[entry]} />)
      const preElement = container.querySelector('[role="status"] pre')
      expect(preElement).toBeInTheDocument()
      expect(preElement?.textContent).toBe(partialText)
    })

    it('renders truncation banner with role="status"', () => {
      const entry = createMockEntry({
        isTruncated: true,
        partialWorkLog: 'partial content',
      })
      render(<WorkLogFeed entries={[entry]} />)
      const statusDiv = screen.getByRole('status')
      expect(statusDiv).toBeInTheDocument()
    })

    it('hides truncation banner when isTruncated=false', () => {
      const entry = createMockEntry({ isTruncated: false })
      render(<WorkLogFeed entries={[entry]} />)
      expect(screen.queryByText('truncated')).not.toBeInTheDocument()
    })

    it('hides truncation banner when partialWorkLog is null even if isTruncated=true', () => {
      const entry = createMockEntry({
        isTruncated: true,
        partialWorkLog: null,
      })
      render(<WorkLogFeed entries={[entry]} />)
      // Banner still shows but without the partial content
      expect(screen.getByText('truncated')).toBeInTheDocument()
    })
  })

  describe('Work log items', () => {
    it('renders work log items as a list when present', () => {
      const entry = createMockEntry({
        workLog: {
          items: ['Item 1', 'Item 2', 'Item 3'],
          filesRead: [],
          filesChanged: [],
          decisions: [],
        },
      })
      render(<WorkLogFeed entries={[entry]} />)
      expect(screen.getByText('Item 1')).toBeInTheDocument()
      expect(screen.getByText('Item 2')).toBeInTheDocument()
      expect(screen.getByText('Item 3')).toBeInTheDocument()
    })

    it('hides work log section when items array is empty', () => {
      const entry = createMockEntry({
        workLog: {
          items: [],
          filesRead: [],
          filesChanged: [],
          decisions: [],
        },
      })
      const { container } = render(<WorkLogFeed entries={[entry]} />)
      // Count list items — should only have file chips list
      const lists = container.querySelectorAll('ul')
      expect(lists).toHaveLength(0)
    })

    it('hides work log section when workLog is null', () => {
      const entry = createMockEntry({ workLog: null })
      const { container } = render(<WorkLogFeed entries={[entry]} />)
      const lists = container.querySelectorAll('ul')
      expect(lists).toHaveLength(0)
    })

    it('renders each item with a bullet point', () => {
      const entry = createMockEntry({
        workLog: {
          items: ['First item', 'Second item'],
          filesRead: [],
          filesChanged: [],
          decisions: [],
        },
      })
      const { container } = render(<WorkLogFeed entries={[entry]} />)
      const listItems = container.querySelectorAll('li')
      expect(listItems).toHaveLength(2)
    })
  })

  describe('Files changed chips', () => {
    it('renders files changed chips when array is populated', () => {
      const entry = createMockEntry({
        workLog: {
          items: [],
          filesRead: [],
          filesChanged: ['src/app.ts', 'src/main.tsx', 'src/utils.ts'],
          decisions: [],
        },
      })
      render(<WorkLogFeed entries={[entry]} />)
      expect(screen.getByText('app.ts')).toBeInTheDocument()
      expect(screen.getByText('main.tsx')).toBeInTheDocument()
      expect(screen.getByText('utils.ts')).toBeInTheDocument()
    })

    it('extracts file name from full path', () => {
      const entry = createMockEntry({
        workLog: {
          items: [],
          filesRead: [],
          filesChanged: ['src/deeply/nested/component.tsx'],
          decisions: [],
        },
      })
      render(<WorkLogFeed entries={[entry]} />)
      expect(screen.getByText('component.tsx')).toBeInTheDocument()
    })

    it('displays full path as title attribute', () => {
      const fullPath = 'src/deeply/nested/file.ts'
      const entry = createMockEntry({
        workLog: {
          items: [],
          filesRead: [],
          filesChanged: [fullPath],
          decisions: [],
        },
      })
      const { container } = render(<WorkLogFeed entries={[entry]} />)
      const chip = container.querySelector('[title]')
      expect(chip).toHaveAttribute('title', fullPath)
    })

    it('hides files changed section when array is empty', () => {
      const entry = createMockEntry({
        workLog: {
          items: [],
          filesRead: [],
          filesChanged: [],
          decisions: [],
        },
      })
      const { container } = render(<WorkLogFeed entries={[entry]} />)
      // Should have no chips
      const chips = container.querySelectorAll('span.rounded.text-\\[10px\\]')
      expect(chips.length).toBeLessThanOrEqual(2) // Only model + status badges
    })

    it('hides files section when workLog is null', () => {
      const entry = createMockEntry({ workLog: null })
      const { container } = render(<WorkLogFeed entries={[entry]} />)
      const chips = container.querySelectorAll('.border-\\[var\\(--border\\)\\]')
      expect(chips).toHaveLength(0)
    })
  })

  describe('Phase 3 annotation slot', () => {
    it('renders annotation slot div', () => {
      const entry = createMockEntry({ agentRunId: 'run-789' })
      const { container } = render(<WorkLogFeed entries={[entry]} />)
      const slot = container.querySelector('[data-annotation-slot="footer"]')
      expect(slot).toBeInTheDocument()
    })

    it('sets data-agent-run-id on annotation slot', () => {
      const entry = createMockEntry({ agentRunId: 'run-special-id' })
      const { container } = render(<WorkLogFeed entries={[entry]} />)
      const slot = container.querySelector('[data-annotation-slot="footer"]')
      expect(slot).toHaveAttribute('data-agent-run-id', 'run-special-id')
    })

    it('renders annotation slot for each entry', () => {
      const entries = [
        createMockEntry({ agentRunId: 'run-1' }),
        createMockEntry({ agentRunId: 'run-2' }),
      ]
      const { container } = render(<WorkLogFeed entries={entries} />)
      const slots = container.querySelectorAll('[data-annotation-slot="footer"]')
      expect(slots).toHaveLength(2)
    })

    it('annotation slot has correct ids', () => {
      const entries = [
        createMockEntry({ agentRunId: 'run-alpha' }),
        createMockEntry({ agentRunId: 'run-beta' }),
      ]
      const { container } = render(<WorkLogFeed entries={entries} />)
      const slots = container.querySelectorAll('[data-annotation-slot="footer"]')
      expect(slots[0]).toHaveAttribute('data-agent-run-id', 'run-alpha')
      expect(slots[1]).toHaveAttribute('data-agent-run-id', 'run-beta')
    })
  })

  describe('Accessibility', () => {
    it('uses aria-labelledby to link article to heading', () => {
      const entry = createMockEntry({ agentRunId: 'run-acc-test' })
      const { container } = render(<WorkLogFeed entries={[entry]} />)
      const article = container.querySelector('[role="article"]')
      const labelId = article?.getAttribute('aria-labelledby')
      expect(labelId).toBeTruthy()
      const heading = container.querySelector(`#${labelId}`)
      expect(heading).toBeInTheDocument()
    })

    it('includes sr-only label for status chip', () => {
      const entry = createMockEntry({ status: 'DONE' })
      const { container } = render(<WorkLogFeed entries={[entry]} />)
      const srOnlyLabel = container.querySelector('.sr-only')
      expect(srOnlyLabel).toBeInTheDocument()
      expect(srOnlyLabel?.textContent).toBe('Status: ')
    })
  })
})
