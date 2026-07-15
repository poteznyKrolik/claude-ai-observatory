import { AlertTriangle } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { useReducedMotion } from 'framer-motion'
import { useToolFailures, useToolFailureStats } from '../../api/useCastData'
import { useChartColors } from '../../lib/useChartColors'

const tooltipStyle = {
  background: 'var(--bg-secondary)',
  border: '1px solid var(--border)',
  borderRadius: 6,
  fontSize: 11,
}

export default function ToolFailuresPanel() {
  const { data: stats, isLoading: statsLoading } = useToolFailureStats()
  const { data: failuresData, isLoading: failuresLoading } = useToolFailures({ limit: 20 })
  const reduced = useReducedMotion()
  const c = useChartColors()

  const isLoading = statsLoading || failuresLoading

  if (isLoading) {
    return (
      <div className="bento-card p-6">
        <div className="h-6 w-40 bg-[var(--bg-tertiary)] rounded animate-pulse mb-4" />
        <div className="h-48 bg-[var(--bg-tertiary)] rounded animate-pulse" />
      </div>
    )
  }

  if (!stats || stats.total === 0) {
    return (
      <div className="bento-card p-6">
        <div className="flex items-center gap-2.5 mb-4">
          <AlertTriangle className="w-4 h-4 text-amber-400" />
          <h2 className="text-base font-semibold text-[var(--text-primary)]">Tool Failures</h2>
        </div>
        <p className="text-sm text-[var(--text-muted)] py-8 text-center">No tool failures recorded</p>
      </div>
    )
  }

  const topTools = Object.entries(stats.byTool)
    .map(([tool, count]) => ({ tool, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10)

  const failures = failuresData?.failures ?? []

  return (
    <div className="bento-card p-6">
      <div className="flex items-center gap-2.5 mb-4">
        <AlertTriangle className="w-4 h-4 text-amber-400" />
        <h2 className="text-base font-semibold text-[var(--text-primary)]">Tool Failures</h2>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="bg-[var(--bg-tertiary)] rounded-lg p-3 text-center">
          <div className="text-2xl font-bold text-[var(--text-primary)] tabular-nums">{stats.total}</div>
          <div className="text-xs text-[var(--text-muted)]">Total Failures</div>
        </div>
        <div className="bg-[var(--bg-tertiary)] rounded-lg p-3 text-center">
          <div className="text-2xl font-bold text-amber-400 tabular-nums">{stats.last24h}</div>
          <div className="text-xs text-[var(--text-muted)]">Last 24h</div>
        </div>
      </div>

      {/* Top failing tools */}
      {topTools.length > 0 && (
        <div className="mb-6">
          <h3 className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-3">Top Failing Tools</h3>
          <div role="img" aria-label="Bar chart of the top failing tools by failure count">
          <ResponsiveContainer width="100%" height={Math.max(150, topTools.length * 26)}>
            <BarChart data={topTools} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis type="number" tick={{ fill: '#88A3D6', fontSize: 11 }} axisLine={{ stroke: 'rgba(255,255,255,0.1)' }} />
              <YAxis
                type="category"
                dataKey="tool"
                width={100}
                tick={{ fill: '#E6E8EE', fontSize: 10, fontFamily: 'Geist Mono, monospace' }}
                axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
              />
              <Tooltip contentStyle={tooltipStyle} />
              <Bar dataKey="count" name="Failures" fill={c.chart4} radius={[0, 4, 4, 0]} isAnimationActive={!reduced} />
            </BarChart>
          </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Recent failures table */}
      {failures.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-3">Recent Failures</h3>
          <div className="space-y-1">
            {failures.slice(0, 8).map((f, i) => (
              <div key={i} className="flex items-center gap-3 text-xs bg-[var(--bg-tertiary)] rounded px-3 py-2">
                <span className="text-[var(--text-muted)] shrink-0 w-20 truncate">
                  {f.timestamp ? new Date(f.timestamp).toLocaleTimeString() : '--'}
                </span>
                <span className="font-mono text-[var(--text-primary)] shrink-0 w-24 truncate">{f.tool ?? 'unknown'}</span>
                <span className="text-rose-400 truncate flex-1">{f.error ?? 'Unknown error'}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
