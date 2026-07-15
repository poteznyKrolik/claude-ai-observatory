import { useState, useMemo } from 'react'
import { AlertTriangle, CheckCircle } from 'lucide-react'
import { useHookFailures, type HookFailureRow } from '../api/useHookFailures'
import SectionHeader from '../components/SectionHeader'
import TerminalPanel from '../components/TerminalPanel'
import { timeAgo } from '../utils/time'

function formatDate(ts: string): string {
  try {
    return new Date(ts).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' })
  } catch {
    return ts
  }
}

function groupByHook(failures: HookFailureRow[]): Map<string, HookFailureRow[]> {
  const map = new Map<string, HookFailureRow[]>()
  for (const f of failures) {
    const key = f.hook_name
    if (!map.has(key)) map.set(key, [])
    map.get(key)!.push(f)
  }
  return map
}

function SkeletonRows() {
  return (
    <>
      {[...Array(4)].map((_, i) => (
        <div key={i} className="h-12 rounded bg-[var(--bg-secondary)] animate-pulse" style={{ width: `${95 - i * 5}%` }} />
      ))}
    </>
  )
}

export default function HookFailuresView() {
  const [last24h, setLast24h] = useState(true)
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set())

  const since = useMemo(
    () => (last24h ? new Date(Date.now() - 86_400_000).toISOString() : undefined),
    [last24h]
  )

  const { data, isLoading } = useHookFailures(since)
  const failures = data?.failures ?? []
  const grouped = groupByHook(failures)

  function toggleRow(id: string) {
    setExpandedRows(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      <SectionHeader
        as="h1"
        kicker="hook failures"
        title="Hook Failures"
        icon={<AlertTriangle className="w-5 h-5 text-rose-400" />}
        description="Failed hook invocations logged by CAST."
        actions={
          <button
            onClick={() => setLast24h(prev => !prev)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${
              last24h
                ? 'bg-rose-500/15 text-rose-400 border-rose-500/30'
                : 'bg-[var(--bg-tertiary)] text-[var(--text-secondary)] border-[var(--border)] hover:border-[var(--glass-border)]'
            }`}
            aria-pressed={last24h}
          >
            Last 24h only
          </button>
        }
      />

      {/* Content */}
      {isLoading ? (
        <div className="bento-card p-6 space-y-3">
          <SkeletonRows />
        </div>
      ) : failures.length === 0 ? (
        <div className="bento-card p-10 flex flex-col items-center gap-3 text-center">
          <CheckCircle className="w-8 h-8 text-emerald-400" aria-hidden="true" />
          <p className="text-sm text-[var(--text-secondary)]">No hook failures in the selected period</p>
        </div>
      ) : (
        <div className="space-y-4">
          {[...grouped.entries()].map(([hookName, rows]) => (
            <div key={hookName} className="bento-card overflow-hidden">
              {/* Group header */}
              <div className="px-5 py-3 border-b border-[var(--border)] flex items-center justify-between gap-3">
                <span className="font-mono text-sm font-semibold text-[var(--text-primary)]">{hookName}</span>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-[var(--text-muted)]">
                    most recent: {timeAgo(rows[0].timestamp)}
                  </span>
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-rose-500/15 text-rose-400">
                    {rows.length} {rows.length === 1 ? 'failure' : 'failures'}
                  </span>
                </div>
              </div>

              {/* Rows */}
              <table className="w-full text-sm" aria-label="Hook failures">
                <thead>
                  <tr className="border-b border-[var(--border)]">
                    <th scope="col" className="px-5 py-2 text-left text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">Timestamp</th>
                    <th scope="col" className="px-5 py-2 text-left text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">Exit Code</th>
                    <th scope="col" className="px-5 py-2 text-left text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)] hidden sm:table-cell">Session</th>
                    <th scope="col" className="px-5 py-2 text-left text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">stderr</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => {
                    const isExpanded = expandedRows.has(row.id)
                    const hasStderr = !!row.stderr?.trim()
                    return (
                      <>
                        <tr
                          key={row.id}
                          className={`border-b border-[var(--border)] transition-colors ${hasStderr ? 'cursor-pointer hover:bg-[var(--bg-tertiary)]' : ''}`}
                          onClick={() => hasStderr && toggleRow(row.id)}
                          role={hasStderr ? 'button' : undefined}
                          tabIndex={hasStderr ? 0 : undefined}
                          aria-expanded={hasStderr ? isExpanded : undefined}
                          onKeyDown={(e) => { if (hasStderr && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); toggleRow(row.id) } }}
                        >
                          <td className="px-5 py-2.5 text-xs text-[var(--text-muted)] tabular-nums whitespace-nowrap">
                            {formatDate(row.timestamp)}
                          </td>
                          <td className="px-5 py-2.5">
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-mono font-bold bg-rose-500/15 text-rose-400">
                              {row.exit_code}
                            </span>
                          </td>
                          <td className="px-5 py-2.5 text-xs text-[var(--text-muted)] font-mono hidden sm:table-cell">
                            {row.session_id ? row.session_id.slice(0, 12) + '…' : '—'}
                          </td>
                          <td className="px-5 py-2.5 text-xs text-[var(--text-secondary)]">
                            {hasStderr ? (
                              <span className="text-[var(--accent)] text-xs">{isExpanded ? '▲ hide' : '▼ expand'}</span>
                            ) : (
                              <span className="text-[var(--text-muted)]">—</span>
                            )}
                          </td>
                        </tr>
                        {isExpanded && hasStderr && (
                          <tr key={`${row.id}-stderr`} className="border-b border-[var(--border)] bg-[var(--bg-tertiary)]">
                            <td colSpan={4} className="px-5 py-3">
                              <TerminalPanel title="stderr" bodyClassName="text-xs">
                                <pre className="whitespace-pre-wrap break-all leading-relaxed">
                                  {row.stderr}
                                </pre>
                              </TerminalPanel>
                            </td>
                          </tr>
                        )}
                      </>
                    )
                  })}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
