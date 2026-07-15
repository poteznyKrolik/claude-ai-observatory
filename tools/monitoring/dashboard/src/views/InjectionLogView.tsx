import { Brain } from 'lucide-react'
import { useInjectionLog, type InjectionLogEntry } from '../api/useInjectionLog'
import SectionHeader from '../components/SectionHeader'
import { timeAgo } from '../utils/time'

function ScoreCell({ score }: { score: number | null }) {
  if (score === null) {
    return <span className="text-[var(--text-muted)]">—</span>
  }
  let color: string
  if (score >= 0.8) {
    color = 'text-emerald-400'
  } else if (score >= 0.5) {
    color = 'text-amber-400'
  } else {
    color = 'text-rose-400'
  }
  return (
    <span className={`font-mono tabular-nums font-medium ${color}`}>
      {score.toFixed(3)}
    </span>
  )
}

function SkeletonRows() {
  return (
    <>
      {[...Array(6)].map((_, i) => (
        <tr key={i} className="border-b border-[var(--border)]">
          <td className="px-5 py-3"><div className="h-4 rounded bg-[var(--bg-secondary)] animate-pulse w-16" /></td>
          <td className="px-5 py-3"><div className="h-4 rounded bg-[var(--bg-secondary)] animate-pulse w-24" /></td>
          <td className="px-5 py-3"><div className="h-4 rounded bg-[var(--bg-secondary)] animate-pulse w-12" /></td>
          <td className="px-5 py-3"><div className="h-4 rounded bg-[var(--bg-secondary)] animate-pulse w-20" /></td>
        </tr>
      ))}
    </>
  )
}

export default function InjectionLogView() {
  const { data, isLoading } = useInjectionLog()
  const entries: InjectionLogEntry[] = data?.entries ?? []

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      <SectionHeader
        as="h1"
        kicker="memory injection"
        title="Injection Log"
        icon={<Brain className="w-5 h-5" />}
        description="Per-fact retrieval scores for memory injection"
      />

      {/* Table */}
      <div className="bento-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[480px]" aria-label="Injection log entries">
            <thead>
              <tr className="border-b border-[var(--border)]">
                <th scope="col" className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">Fact ID</th>
                <th scope="col" className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">Session</th>
                <th scope="col" className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">Score</th>
                <th scope="col" className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">Injected At</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <SkeletonRows />
              ) : entries.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-5 py-10 text-center text-xs text-[var(--text-muted)]">
                    No injection log entries yet
                  </td>
                </tr>
              ) : (
                entries.map((entry) => (
                  <tr key={entry.id} className="border-b border-[var(--border)] hover:bg-[var(--bg-tertiary)] transition-colors">
                    <td className="px-5 py-2.5 text-xs font-mono text-[var(--text-secondary)] tabular-nums">
                      {entry.fact_id}
                    </td>
                    <td className="px-5 py-2.5 text-xs font-mono text-[var(--text-muted)]">
                      {entry.session_id ? entry.session_id.slice(0, 12) + '…' : '—'}
                    </td>
                    <td className="px-5 py-2.5 text-xs">
                      <ScoreCell score={entry.score} />
                    </td>
                    <td className="px-5 py-2.5 text-xs text-[var(--text-muted)] tabular-nums whitespace-nowrap">
                      {timeAgo(entry.injected_at)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
