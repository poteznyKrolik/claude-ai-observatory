import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, Bot, AlertTriangle } from 'lucide-react'
import { useAgentProfile } from '../api/useAgentProfile'
import type { AgentRunRow } from '../api/useAgentProfile'
import { formatDuration } from '../utils/time'
import { formatCost, formatTokens } from '../utils/costEstimate'
import { useChartColors } from '../lib/useChartColors'

function StatusBadge({ status }: { status: string }) {
  const upper = status.toUpperCase()
  let classes = 'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium '
  if (upper === 'DONE') {
    classes += 'bg-emerald-500/15 text-emerald-400'
  } else if (upper === 'DONE_WITH_CONCERNS') {
    classes += 'bg-amber-500/15 text-amber-400'
  } else if (upper === 'BLOCKED') {
    classes += 'bg-rose-500/15 text-rose-400'
  } else if (upper === 'NEEDS_CONTEXT') {
    classes += 'bg-sky-500/15 text-sky-400'
  } else {
    classes += 'bg-[var(--bg-tertiary)] text-[var(--text-muted)]'
  }
  return <span className={classes}>{status}</span>
}

function formatDate(ts: string): string {
  try {
    return new Date(ts).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' })
  } catch {
    return ts
  }
}

function RunRow({ run }: { run: AgentRunRow }) {
  const [expanded, setExpanded] = useState(false)
  const hasSummary = !!run.task_summary?.trim()

  return (
    <>
      <tr
        className={`border-b border-[var(--border)] transition-colors ${hasSummary ? 'cursor-pointer hover:bg-[var(--bg-tertiary)]' : ''}`}
        onClick={() => hasSummary && setExpanded(prev => !prev)}
        role={hasSummary ? 'button' : undefined}
        tabIndex={hasSummary ? 0 : undefined}
        aria-expanded={hasSummary ? expanded : undefined}
        onKeyDown={(e) => { if (hasSummary && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); setExpanded(prev => !prev) } }}
      >
        <td className="px-4 py-3 text-xs text-[var(--text-muted)] tabular-nums whitespace-nowrap">
          {formatDate(run.started_at)}
        </td>
        <td className="px-4 py-3">
          <div className="flex items-center gap-1.5 flex-wrap">
            <StatusBadge status={run.status} />
            {run.is_truncated === 1 && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-500/15 text-amber-400">
                TRUNCATED
              </span>
            )}
          </div>
        </td>
        <td className="px-4 py-3 text-xs text-[var(--text-secondary)] tabular-nums text-right">
          {formatDuration(run.duration_ms)}
        </td>
        <td className="px-4 py-3 text-xs text-[var(--text-muted)] tabular-nums text-right hidden md:table-cell">
          {run.input_tokens != null ? formatTokens(run.input_tokens) : '—'}
        </td>
        <td className="px-4 py-3 text-xs text-[var(--text-muted)] tabular-nums text-right hidden md:table-cell">
          {run.output_tokens != null ? formatTokens(run.output_tokens) : '—'}
        </td>
        <td className="px-4 py-3 text-xs font-mono text-right tabular-nums text-[var(--text-secondary)]">
          {formatCost(run.cost_usd)}
        </td>
        <td className="px-4 py-3 text-xs text-[var(--text-muted)] hidden lg:table-cell truncate max-w-[160px]">
          {run.model ? run.model.replace('claude-', '').replace(/-\d{8}$/, '') : '—'}
        </td>
        <td className="px-4 py-3 text-xs text-[var(--text-muted)] text-center w-6">
          {hasSummary && (
            <span className="text-[var(--accent)] text-xs">{expanded ? '▲' : '▼'}</span>
          )}
        </td>
      </tr>
      {expanded && hasSummary && (
        <tr className="border-b border-[var(--border)] bg-[var(--bg-tertiary)]">
          <td colSpan={8} className="px-6 py-3 text-xs text-[var(--text-secondary)] leading-relaxed whitespace-pre-wrap">
            {run.task_summary}
          </td>
        </tr>
      )}
    </>
  )
}

export default function AnalyticsAgentDetailView() {
  const { agent } = useParams<{ agent: string }>()
  const { data, isLoading, error } = useAgentProfile(agent ?? '')
  const c = useChartColors()

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <div className="h-4 w-32 bg-[var(--bg-tertiary)] rounded animate-pulse" />
        <div className="bento-card p-6 space-y-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-6 rounded bg-[var(--bg-secondary)] animate-pulse" style={{ width: `${90 - i * 8}%` }} />
          ))}
        </div>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="p-6 space-y-6">
        <Link
          to="/analytics"
          className="inline-flex items-center gap-2 text-sm text-[var(--accent)] hover:text-[var(--accent-hover)] transition-colors no-underline"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Analytics
        </Link>
        <div className="bento-card p-6 text-[var(--error)] text-sm">
          {error ? 'Unable to load agent data' : `No runs found for agent: ${agent}`}
        </div>
      </div>
    )
  }

  const barColor = data.success_rate >= 80 ? c.mint : data.success_rate >= 70 ? c.amber : c.rose
  const barPct = Math.max(0, Math.min(100, data.success_rate))

  return (
    <div className="p-6 space-y-6">
      {/* Back link */}
      <Link
        to="/analytics"
        className="inline-flex items-center gap-2 text-sm text-[var(--accent)] hover:text-[var(--accent-hover)] transition-colors no-underline"
      >
        <ArrowLeft className="w-4 h-4" /> Back to Analytics
      </Link>

      {/* Header */}
      <div className="bento-card p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 rounded-lg bg-[var(--accent-subtle)]">
            <Bot className="w-5 h-5 text-[var(--accent)]" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-[var(--text-primary)]">{data.name}</h1>
            <p className="text-xs text-[var(--text-muted)] mt-0.5">Last 50 runs</p>
          </div>
        </div>

        {/* Summary stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="space-y-1">
            <div className="text-xs text-[var(--text-muted)] uppercase tracking-wider">Total Runs</div>
            <div className="text-2xl font-bold tabular-nums text-[var(--text-primary)]">{data.runs}</div>
          </div>
          <div className="space-y-1">
            <div className="text-xs text-[var(--text-muted)] uppercase tracking-wider">Success Rate</div>
            <div className="flex items-center gap-2">
              <div
                className="flex-1 h-2 rounded-full bg-[var(--bg-secondary)] overflow-hidden"
                role="progressbar"
                aria-valuenow={barPct}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={`Success rate: ${data.success_rate}%`}
              >
                <div className="h-full rounded-full" style={{ width: `${barPct}%`, backgroundColor: barColor }} />
              </div>
              <span className="text-sm font-bold tabular-nums" style={{ color: barColor }}>
                {data.success_rate}%
              </span>
            </div>
          </div>
          <div className="space-y-1">
            <div className="text-xs text-[var(--text-muted)] uppercase tracking-wider">Blocked</div>
            <div
              className="text-2xl font-bold tabular-nums"
              style={{ color: data.blocked_count > 5 ? c.rose : 'var(--text-primary)' }}
            >
              {data.blocked_count > 5 && <AlertTriangle className="inline w-4 h-4 mr-1 text-rose-400" aria-hidden="true" />}
              {data.blocked_count}
            </div>
          </div>
          <div className="space-y-1">
            <div className="text-xs text-[var(--text-muted)] uppercase tracking-wider">Avg Cost</div>
            <div className="text-2xl font-bold tabular-nums text-[var(--text-primary)] font-mono">
              {formatCost(data.avg_cost_usd)}
            </div>
          </div>
        </div>
      </div>

      {/* Runs table */}
      <div className="bento-card overflow-hidden">
        <div className="px-6 py-4 border-b border-[var(--border)]">
          <h2 className="text-sm font-semibold text-[var(--text-muted)] uppercase tracking-wider">
            Recent Runs ({data.last_runs?.length ?? 0})
          </h2>
          <p className="text-xs text-[var(--text-muted)] mt-1">Click a row with a summary to expand task details</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[560px]" aria-label="Recent runs for this agent">
            <thead>
              <tr className="border-b border-[var(--border)]">
                <th scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">Started</th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">Status</th>
                <th scope="col" className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">Duration</th>
                <th scope="col" className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)] hidden md:table-cell">In Tokens</th>
                <th scope="col" className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)] hidden md:table-cell">Out Tokens</th>
                <th scope="col" className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">Cost</th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)] hidden lg:table-cell">Model</th>
                <th scope="col" className="w-6" />
              </tr>
            </thead>
            <tbody>
              {!data.last_runs || data.last_runs.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-8 text-center text-[var(--text-muted)] text-xs">
                    No runs recorded yet.
                  </td>
                </tr>
              ) : (
                (data.last_runs ?? []).map((run, i) => <RunRow key={i} run={run} />)
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
