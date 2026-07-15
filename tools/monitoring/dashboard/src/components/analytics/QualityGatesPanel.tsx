import { Shield, CheckCircle2, XCircle } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { useReducedMotion } from 'framer-motion'
import { useQualityGateStats } from '../../api/useCastData'
import { useChartColors } from '../../lib/useChartColors'

const tooltipStyle = {
  background: 'var(--bg-secondary)',
  border: '1px solid var(--border)',
  borderRadius: 6,
  fontSize: 11,
}

export default function QualityGatesPanel() {
  const { data, isLoading } = useQualityGateStats()
  const reduced = useReducedMotion()
  const c = useChartColors()

  if (isLoading) {
    return (
      <div className="bento-card p-6">
        <div className="h-6 w-40 bg-[var(--bg-tertiary)] rounded animate-pulse mb-4" />
        <div className="h-48 bg-[var(--bg-tertiary)] rounded animate-pulse" />
      </div>
    )
  }

  if (!data || data.total === 0) {
    return (
      <div className="bento-card p-6">
        <div className="flex items-center gap-2.5 mb-4">
          <Shield className="w-4 h-4 text-[var(--accent)]" />
          <h2 className="text-base font-semibold text-[var(--text-primary)]">Quality Gates</h2>
        </div>
        <p className="text-sm text-[var(--text-muted)] py-8 text-center">No quality gate data yet</p>
      </div>
    )
  }

  const agentData = Object.entries(data.by_agent)
    .map(([name, stats]) => ({
      agent: name,
      total: stats.total,
      passed: stats.passed,
      failed: stats.total - stats.passed,
      rate: stats.rate,
    }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 12)

  return (
    <div className="bento-card p-6">
      <div className="flex items-center gap-2.5 mb-4">
        <Shield className="w-4 h-4 text-[var(--accent)]" />
        <h2 className="text-base font-semibold text-[var(--text-primary)]">Quality Gates</h2>
      </div>

      {/* Summary row */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-[var(--bg-tertiary)] rounded-lg p-3 text-center">
          <div className="text-2xl font-bold text-[var(--text-primary)] tabular-nums">{data.total}</div>
          <div className="text-xs text-[var(--text-muted)]">Total Checks</div>
        </div>
        <div className="bg-[var(--bg-tertiary)] rounded-lg p-3 text-center">
          <div className="flex items-center justify-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span className="text-2xl font-bold text-emerald-400 tabular-nums">{data.pass_rate}%</span>
          </div>
          <div className="text-xs text-[var(--text-muted)]">Pass Rate</div>
        </div>
        <div className="bg-[var(--bg-tertiary)] rounded-lg p-3 text-center">
          <div className="flex items-center justify-center gap-1.5">
            <XCircle className="w-4 h-4 text-rose-400" />
            <span className="text-2xl font-bold text-rose-400 tabular-nums">
              {data.total - Math.round((data.total * data.pass_rate) / 100)}
            </span>
          </div>
          <div className="text-xs text-[var(--text-muted)]">Blocked</div>
        </div>
      </div>

      {/* Per-agent bar chart */}
      {agentData.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-3">Per-Agent Compliance</h3>
          <div role="img" aria-label="Stacked bar chart of passed versus failed quality gates per agent">
          <ResponsiveContainer width="100%" height={Math.max(180, agentData.length * 28)}>
            <BarChart data={agentData} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis type="number" tick={{ fill: '#88A3D6', fontSize: 11 }} axisLine={{ stroke: 'rgba(255,255,255,0.1)' }} />
              <YAxis
                type="category"
                dataKey="agent"
                width={110}
                tick={{ fill: '#E6E8EE', fontSize: 10, fontFamily: 'Geist Mono, monospace' }}
                axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
              />
              <Tooltip contentStyle={tooltipStyle} />
              <Bar dataKey="passed" name="Passed" stackId="a" fill={c.success} radius={[0, 0, 0, 0]} isAnimationActive={!reduced} />
              <Bar dataKey="failed" name="Failed" stackId="a" fill={c.error} radius={[0, 4, 4, 0]} isAnimationActive={!reduced} />
            </BarChart>
          </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  )
}
