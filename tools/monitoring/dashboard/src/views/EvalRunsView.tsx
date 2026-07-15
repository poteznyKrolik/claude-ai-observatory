import { FlaskConical } from 'lucide-react'
import { useEvalRuns, type EvalRun } from '../api/useEvalRuns'
import SectionHeader from '../components/SectionHeader'
import StatusPill from '../components/StatusPill'
import { timeAgo } from '../utils/time'

const TH = 'px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]'

function fmtDuration(ms: number | null): string {
  if (ms == null) return '—'
  if (ms < 1000) return `${ms}ms`
  return `${(ms / 1000).toFixed(1)}s`
}

/** Parse the grader_results JSON into a passed/total summary. */
function graderSummary(raw: string | null): string {
  if (!raw) return '—'
  try {
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed)) {
      const passed = parsed.filter((g: { status?: string; outcome?: string; passed?: boolean }) =>
        g.status === 'pass' || g.passed === true || g.outcome === 'pass' || g.outcome === 'passed',
      ).length
      return `${passed}/${parsed.length}`
    }
  } catch {
    /* not JSON — fall through */
  }
  return '—'
}

function PassRatePill({ value }: { value: number | null }) {
  if (value == null) return <span className="text-[var(--text-muted)]">—</span>
  const pct = Math.round(value * 100)
  const tone = value >= 1 ? 'success' : value > 0 ? 'warning' : 'danger'
  return <StatusPill status={`${pct}%`} tone={tone} pulse={false} label={`${pct}%`} />
}

function StatTile({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bento-card px-4 py-3 flex items-center gap-3">
      <span className="text-2xl font-bold tabular-nums text-[var(--text-primary)] font-mono">{value}</span>
      <span className="text-xs text-[var(--text-muted)]">{label}</span>
    </div>
  )
}

export default function EvalRunsView() {
  const { data, isLoading } = useEvalRuns()
  const runs: EvalRun[] = data?.runs ?? []

  const evals = new Set(runs.map(r => r.eval_id)).size
  const agents = new Set(runs.map(r => r.agent)).size
  const withPass = runs.filter(r => r.pass_at_k != null)
  const passRate = withPass.length
    ? Math.round((withPass.filter(r => (r.pass_at_k ?? 0) >= 1).length / withPass.length) * 100)
    : null

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      <SectionHeader
        as="h1"
        kicker="cast eval"
        title="Eval Runs"
        icon={<FlaskConical className="w-5 h-5" />}
        description="Agent-behavior eval harness results — pass@k per eval, by agent and model."
      />

      <div className="flex flex-wrap items-center gap-3">
        <StatTile label="total runs" value={runs.length} />
        <StatTile label="evals" value={evals} />
        <StatTile label="agents" value={agents} />
        <StatTile label="pass rate" value={passRate == null ? '—' : `${passRate}%`} />
      </div>

      <div className="bento-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[760px]" aria-label="Eval runs">
            <thead>
              <tr className="border-b border-[var(--border)]">
                <th scope="col" className={TH}>Eval</th>
                <th scope="col" className={TH}>Agent</th>
                <th scope="col" className={TH}>Attempt</th>
                <th scope="col" className={TH}>Status</th>
                <th scope="col" className={TH}>pass@k</th>
                <th scope="col" className={TH}>Graders</th>
                <th scope="col" className={TH}>Model</th>
                <th scope="col" className={TH}>Duration</th>
                <th scope="col" className={TH}>Started</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                [...Array(4)].map((_, i) => (
                  <tr key={i} className="border-b border-[var(--border)]">
                    {[...Array(9)].map((__, j) => (
                      <td key={j} className="px-4 py-3">
                        <div className="h-4 w-16 rounded bg-[var(--bg-secondary)] animate-pulse" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : runs.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-12 text-center">
                    <FlaskConical className="w-8 h-8 text-[var(--text-muted)] mx-auto mb-2" aria-hidden="true" />
                    <p className="text-sm text-[var(--text-muted)]">No eval runs recorded yet.</p>
                    <p className="text-xs text-[var(--text-muted)] mt-1">Run <code className="font-mono">cast eval run</code> to populate this view.</p>
                  </td>
                </tr>
              ) : (
                runs.map(r => (
                  <tr key={r.id} className="border-b border-[var(--border)] hover:bg-[var(--bg-tertiary)] transition-colors">
                    <td className="px-4 py-2.5 text-xs font-mono text-[var(--text-secondary)] max-w-[200px]">
                      <span className="truncate block" title={r.eval_id}>{r.eval_id}</span>
                    </td>
                    <td className="px-4 py-2.5 text-xs font-mono text-[var(--text-secondary)]">{r.agent}</td>
                    <td className="px-4 py-2.5 text-xs tabular-nums text-[var(--text-muted)]">
                      {r.attempt}{r.k ? <span className="text-[var(--text-muted)]"> / {r.k}</span> : null}
                    </td>
                    <td className="px-4 py-2.5"><StatusPill status={r.status} /></td>
                    <td className="px-4 py-2.5"><PassRatePill value={r.pass_at_k} /></td>
                    <td className="px-4 py-2.5 text-xs tabular-nums text-[var(--text-secondary)]">{graderSummary(r.grader_results)}</td>
                    <td className="px-4 py-2.5 text-xs font-mono text-[var(--text-muted)]">{r.model || '—'}</td>
                    <td className="px-4 py-2.5 text-xs tabular-nums text-[var(--text-muted)]">{fmtDuration(r.duration_ms)}</td>
                    <td className="px-4 py-2.5 text-xs text-[var(--text-muted)] tabular-nums whitespace-nowrap">{timeAgo(r.started_at)}</td>
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
