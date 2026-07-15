import type { WorkLogEntry } from '../api/useWorkLogStream'
import { timeAgo } from '../utils/time'

// ── Status chip ────────────────────────────────────────────────────────────────

function statusChipClass(status: string | null): string {
  if (!status) return 'bg-[var(--bg-secondary)] text-[var(--text-muted)]'
  const s = status.toUpperCase()
  if (s === 'DONE') return 'bg-emerald-900/40 text-emerald-400'
  if (s === 'DONE_WITH_CONCERNS') return 'bg-amber-900/40 text-amber-400'
  if (s === 'BLOCKED') return 'bg-rose-900/40 text-rose-400'
  if (s === 'NEEDS_CONTEXT') return 'bg-blue-900/40 text-blue-400'
  return 'bg-[var(--bg-secondary)] text-[var(--text-muted)]'
}

function modelBadgeLabel(model: string | null): string {
  if (!model) return 'unknown'
  if (model.includes('fable'))  return 'fable'
  if (model.includes('haiku'))  return 'haiku'
  if (model.includes('opus'))   return 'opus'
  if (model.includes('sonnet')) return 'sonnet'
  return model
}

// ── Skeleton card ──────────────────────────────────────────────────────────────

function WorkLogCardSkeleton() {
  return (
    <div className="bento-card p-5 space-y-3">
      <div className="flex items-center gap-3">
        <div className="h-4 w-32 rounded bg-[var(--bg-secondary)] animate-pulse" />
        <div className="h-4 w-16 rounded bg-[var(--bg-secondary)] animate-pulse" />
        <div className="ml-auto h-4 w-20 rounded bg-[var(--bg-secondary)] animate-pulse" />
      </div>
      <div className="h-3 w-48 rounded bg-[var(--bg-secondary)] animate-pulse" />
      <div className="space-y-2">
        <div className="h-3 w-full rounded bg-[var(--bg-secondary)] animate-pulse" />
        <div className="h-3 w-5/6 rounded bg-[var(--bg-secondary)] animate-pulse" />
        <div className="h-3 w-4/6 rounded bg-[var(--bg-secondary)] animate-pulse" />
      </div>
    </div>
  )
}

// ── Individual work log card ───────────────────────────────────────────────────

function WorkLogCard({ entry }: { entry: WorkLogEntry }) {
  const headingId = `wl-heading-${entry.agentRunId}`

  return (
    <article
      role="article"
      aria-labelledby={headingId}
      className="bento-card p-5 space-y-3"
    >
      {/* Header row */}
      <div className="flex items-center gap-2 flex-wrap">
        <h3
          id={headingId}
          className="text-sm font-bold text-[var(--text-primary)] font-mono"
        >
          {entry.agentName}
        </h3>

        {/* Model badge */}
        <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-[var(--accent-subtle)] text-[var(--accent)] border border-[var(--accent)]/20">
          {modelBadgeLabel(entry.model)}
        </span>

        {/* Status chip */}
        <span
          className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${statusChipClass(entry.status)}`}
        >
          <span className="sr-only">Status: </span>
          {entry.status ?? 'unknown'}
        </span>

        {/* Timestamp */}
        <span className="ml-auto text-xs text-[var(--text-muted)] whitespace-nowrap shrink-0">
          {entry.startedAt ? timeAgo(entry.startedAt) : '--'}
        </span>
      </div>

      {/* Session reference */}
      {entry.sessionId && (
        <p className="text-[11px] text-[var(--text-muted)] font-mono truncate">
          session: {entry.sessionId}
        </p>
      )}

      {/* Truncation banner */}
      {entry.isTruncated && (
        <div
          role="status"
          className="rounded border border-amber-500/40 bg-amber-900/20 px-3 py-2 text-xs text-amber-400"
        >
          <span className="font-semibold">truncated</span>
          {entry.partialWorkLog && (
            <pre className="mt-1 whitespace-pre-wrap text-[11px] text-amber-300/80 font-mono leading-relaxed">
              {entry.partialWorkLog}
            </pre>
          )}
        </div>
      )}

      {/* Work log items */}
      {entry.workLog && entry.workLog.items.length > 0 && (
        <ul className="space-y-1 pl-0 list-none">
          {entry.workLog.items.map((item, i) => (
            <li
              key={i}
              className="flex gap-2 text-xs text-[var(--text-secondary)] leading-relaxed"
            >
              <span className="text-[var(--text-muted)] shrink-0 select-none">–</span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      )}

      {/* Files changed chips */}
      {entry.workLog && entry.workLog.filesChanged.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {entry.workLog.filesChanged.map((file, i) => (
            <span
              key={i}
              className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-[var(--bg-secondary)] text-[var(--text-secondary)] border border-[var(--border)]"
              title={file}
            >
              {file.split('/').pop() ?? file}
            </span>
          ))}
        </div>
      )}

      {/*
        Phase 3 annotation slot — intentionally empty.
        Phase 3 will inject parry-guard fired indicators and quality-gate
        verdict badges into this div, keyed by agentRunId.
      */}
      <div data-annotation-slot="footer" data-agent-run-id={entry.agentRunId} />
    </article>
  )
}

// ── Feed component ─────────────────────────────────────────────────────────────

interface WorkLogFeedProps {
  entries: WorkLogEntry[]
  isLoading?: boolean
  error?: Error | null
}

export default function WorkLogFeed({ entries, isLoading, error }: WorkLogFeedProps) {
  if (isLoading) {
    return (
      <div className="space-y-4">
        {[...Array(4)].map((_, i) => (
          <WorkLogCardSkeleton key={i} />
        ))}
      </div>
    )
  }

  if (error) {
    return (
      <div className="bento-card p-5">
        <p className="text-sm text-[var(--error)]">
          Failed to load work logs: {error.message}
        </p>
      </div>
    )
  }

  if (entries.length === 0) {
    return (
      <div className="bento-card p-8 text-center">
        <p className="text-sm text-[var(--text-muted)]">No agent work logs yet.</p>
        <p className="text-xs text-[var(--text-muted)] mt-1">
          Agent runs with ## Work Log sections will appear here.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {entries.map(entry => (
        <WorkLogCard key={entry.agentRunId} entry={entry} />
      ))}
    </div>
  )
}
