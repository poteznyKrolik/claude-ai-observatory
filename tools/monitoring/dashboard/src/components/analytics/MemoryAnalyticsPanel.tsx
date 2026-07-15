import { useMemo } from 'react'
import { Brain } from 'lucide-react'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'
import { useReducedMotion } from 'framer-motion'
import { useDbMemories } from '../../api/useCastData'

const TYPE_COLORS: Record<string, string> = {
  procedural: '#00FFC2',
  project: '#60A5FA',
  feedback: '#FBBF24',
  reference: '#A78BFA',
  'agent-memory': '#F87171',
}

const tooltipStyle = {
  background: 'var(--bg-secondary)',
  border: '1px solid var(--border)',
  borderRadius: 6,
  fontSize: 11,
}

export default function MemoryAnalyticsPanel() {
  const { data: memories, isLoading } = useDbMemories()
  const reduced = useReducedMotion()

  const { byType, topRetrieved, avgImportance } = useMemo(() => {
    if (!memories || memories.length === 0) {
      return { byType: [], topRetrieved: [], avgImportance: 0 }
    }

    // Count by type
    const typeCounts: Record<string, number> = {}
    let importanceSum = 0
    let importanceCount = 0

    for (const m of memories) {
      const t = m.type ?? 'unknown'
      typeCounts[t] = (typeCounts[t] ?? 0) + 1
      if (m.importance != null) {
        importanceSum += m.importance
        importanceCount++
      }
    }

    const byType = Object.entries(typeCounts).map(([name, value]) => ({
      name,
      value,
      color: TYPE_COLORS[name] ?? '#6B7280',
    }))

    // Top by importance (retrieval_count not available in schema; use importance as proxy)
    const topRetrieved = [...memories]
      .filter(m => m.importance != null && m.importance > 0)
      .sort((a, b) => (b.importance ?? 0) - (a.importance ?? 0))
      .slice(0, 10)

    const avgImportance = importanceCount > 0
      ? Math.round((importanceSum / importanceCount) * 100) / 100
      : 0

    return { byType, topRetrieved, avgImportance }
  }, [memories])

  if (isLoading) {
    return (
      <div className="bento-card p-6">
        <div className="h-6 w-40 bg-[var(--bg-tertiary)] rounded animate-pulse mb-4" />
        <div className="h-48 bg-[var(--bg-tertiary)] rounded animate-pulse" />
      </div>
    )
  }

  if (!memories || memories.length === 0) {
    return (
      <div className="bento-card p-6">
        <div className="flex items-center gap-2.5 mb-4">
          <Brain className="w-4 h-4 text-[var(--accent)]" />
          <h2 className="text-base font-semibold text-[var(--text-primary)]">Memory Analytics</h2>
        </div>
        <p className="text-sm text-[var(--text-muted)] py-8 text-center">No memory data in cast.db</p>
      </div>
    )
  }

  return (
    <div className="bento-card p-6">
      <div className="flex items-center gap-2.5 mb-4">
        <Brain className="w-4 h-4 text-[var(--accent)]" />
        <h2 className="text-base font-semibold text-[var(--text-primary)]">Memory Analytics</h2>
        <span className="text-xs text-[var(--text-muted)] ml-auto tabular-nums">{memories.length} memories</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Type distribution pie chart */}
        <div>
          <h3 className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-3">By Type</h3>
          {byType.length > 0 && (
            <>
              <div role="img" aria-label="Pie chart of memory entries by type">
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie data={byType} cx="50%" cy="50%" innerRadius={40} outerRadius={70} dataKey="value" nameKey="name" isAnimationActive={!reduced}>
                    {byType.map(entry => (
                      <Cell key={entry.name} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={tooltipStyle} />
                </PieChart>
              </ResponsiveContainer>
              </div>
              <div className="flex flex-wrap justify-center gap-3 mt-1">
                {byType.map(entry => (
                  <div key={entry.name} className="flex items-center gap-1.5 text-xs">
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: entry.color }} />
                    <span className="text-[var(--text-secondary)]">{entry.name}</span>
                    <span className="text-[var(--text-muted)] tabular-nums">({entry.value})</span>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* Avg importance */}
          <div className="mt-4 bg-[var(--bg-tertiary)] rounded-lg p-3 text-center">
            <div className="text-lg font-bold text-[var(--accent)] tabular-nums">{avgImportance}</div>
            <div className="text-xs text-[var(--text-muted)]">Avg Importance Score</div>
          </div>
        </div>

        {/* Top retrieved memories */}
        <div>
          <h3 className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-3">Top by Importance</h3>
          {topRetrieved.length === 0 ? (
            <p className="text-xs text-[var(--text-muted)] py-4 text-center">No importance data</p>
          ) : (
            <div className="space-y-1.5">
              {topRetrieved.map(m => (
                <div key={m.id} className="flex items-center gap-2 text-xs bg-[var(--bg-tertiary)] rounded px-3 py-2">
                  <span className="font-mono text-[var(--text-primary)] truncate flex-1">{m.name}</span>
                  <span className="text-[var(--text-muted)] shrink-0">{m.agent}</span>
                  <span className="text-[var(--accent)] font-bold tabular-nums shrink-0">{m.importance?.toFixed(2) ?? '—'}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
