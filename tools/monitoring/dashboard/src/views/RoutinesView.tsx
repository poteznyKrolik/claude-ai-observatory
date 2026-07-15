import React, { useState } from 'react'
import { Clock } from 'lucide-react'
import { useRoutines, type RoutineRow } from '../api/useRoutines'
import SectionHeader from '../components/SectionHeader'
import { timeAgo } from '../utils/time'

function StatusBadge({ status }: { status: string | null }) {
  if (!status) {
    return <span className="text-[var(--text-muted)]">—</span>
  }
  const lower = status.toLowerCase()
  const color = lower === 'success'
    ? 'bg-emerald-500/20 text-emerald-400'
    : lower === 'failure' || lower === 'error'
    ? 'bg-rose-500/20 text-rose-400'
    : 'bg-amber-500/20 text-amber-400'
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${color}`}>
      {status}
    </span>
  )
}

function EnabledDot({ enabled }: { enabled: number }) {
  return (
    <span className="flex items-center gap-1.5">
      <span
        className={`inline-flex h-2 w-2 rounded-full ${enabled ? 'bg-emerald-400' : 'bg-[var(--text-muted)]'}`}
        aria-label={enabled ? 'Enabled' : 'Disabled'}
      />
      <span className="text-xs text-[var(--text-muted)]">{enabled ? 'On' : 'Off'}</span>
    </span>
  )
}

function ExpandedRow({ routine }: { routine: RoutineRow }) {
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    if (!routine.last_run_output_path) return
    try {
      await navigator.clipboard.writeText(routine.last_run_output_path)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // clipboard not available
    }
  }

  return (
    <tr className="border-b border-[var(--border)] bg-[var(--bg-tertiary)]">
      <td colSpan={6} className="px-6 py-3">
        {routine.last_run_output_path ? (
          <div className="flex items-center gap-3">
            <span className="text-xs text-[var(--text-muted)]">Last output:</span>
            <code className="text-xs font-mono text-[var(--text-secondary)] bg-[var(--bg-secondary)] px-2 py-1 rounded">
              {routine.last_run_output_path}
            </code>
            <button
              onClick={handleCopy}
              className="text-xs text-[var(--accent)] hover:underline"
              aria-label="Copy output path"
            >
              {copied ? 'Copied!' : 'Copy'}
            </button>
          </div>
        ) : (
          <span className="text-xs text-[var(--text-muted)]">No output path recorded</span>
        )}
      </td>
    </tr>
  )
}

function SkeletonRows() {
  return (
    <>
      {[...Array(5)].map((_, i) => (
        <tr key={i} className="border-b border-[var(--border)]">
          <td className="px-4 py-3"><div className="h-4 rounded bg-[var(--bg-secondary)] animate-pulse w-32" /></td>
          <td className="px-4 py-3"><div className="h-4 rounded bg-[var(--bg-secondary)] animate-pulse w-28" /></td>
          <td className="px-4 py-3"><div className="h-4 rounded bg-[var(--bg-secondary)] animate-pulse w-24" /></td>
          <td className="px-4 py-3"><div className="h-4 rounded bg-[var(--bg-secondary)] animate-pulse w-16" /></td>
          <td className="px-4 py-3"><div className="h-4 rounded bg-[var(--bg-secondary)] animate-pulse w-20" /></td>
          <td className="px-4 py-3"><div className="h-4 rounded bg-[var(--bg-secondary)] animate-pulse w-10" /></td>
        </tr>
      ))}
    </>
  )
}

export default function RoutinesView() {
  const { data, isLoading } = useRoutines()
  const routines = data?.routines ?? []
  const [expandedId, setExpandedId] = useState<string | null>(null)

  function toggleExpand(id: string) {
    setExpandedId(prev => prev === id ? null : id)
  }

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      <SectionHeader
        as="h1"
        kicker="scheduled jobs"
        title="Routines"
        icon={<Clock className="w-5 h-5" />}
        description="Scheduled agent dispatches"
      />

      {/* Table */}
      <div className="bento-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[600px]" aria-label="Scheduled routines">
            <thead>
              <tr className="border-b border-[var(--border)]">
                <th scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">Name</th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">Schedule</th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">Agent</th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">Last Run</th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">Status</th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">Enabled</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <SkeletonRows />
              ) : routines.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-xs text-[var(--text-muted)]">
                    No routines configured yet
                  </td>
                </tr>
              ) : (
                routines.map(routine => (
                  <React.Fragment key={routine.id}>
                    <tr
                      key={routine.id}
                      className="border-b border-[var(--border)] hover:bg-[var(--bg-tertiary)] transition-colors cursor-pointer"
                      onClick={() => toggleExpand(routine.id)}
                      role="button"
                      tabIndex={0}
                      aria-expanded={expandedId === routine.id}
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleExpand(routine.id) } }}
                    >
                      <td className="px-4 py-2.5 font-mono text-xs text-[var(--text-primary)] font-medium">
                        {routine.name}
                      </td>
                      <td className="px-4 py-2.5 text-xs font-mono text-[var(--text-secondary)]">
                        {routine.trigger_value ?? <span className="text-[var(--text-muted)]">{routine.trigger_type}</span>}
                      </td>
                      <td className="px-4 py-2.5 text-xs text-[var(--text-secondary)]">
                        {routine.agent_to_dispatch}
                      </td>
                      <td className="px-4 py-2.5 text-xs text-[var(--text-muted)] tabular-nums whitespace-nowrap">
                        {routine.last_run_at ? timeAgo(routine.last_run_at) : '—'}
                      </td>
                      <td className="px-4 py-2.5">
                        <StatusBadge status={routine.last_run_status} />
                      </td>
                      <td className="px-4 py-2.5">
                        <EnabledDot enabled={routine.enabled} />
                      </td>
                    </tr>
                    {expandedId === routine.id && (
                      <ExpandedRow key={`${routine.id}-expanded`} routine={routine} />
                    )}
                  </React.Fragment>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
