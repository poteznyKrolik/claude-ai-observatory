import { useState, useMemo, useEffect } from 'react'
import { Link } from 'react-router-dom'
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts'
import { Activity, Coins, TrendingUp, Clock, Zap, AlertTriangle, RefreshCw, Layers } from 'lucide-react'
import { motion, useReducedMotion } from 'framer-motion'
import { useAnalytics } from '../api/useAnalytics'
import type { DelegationSavings } from '../api/useAnalytics'
import { useCompactionEvents } from '../api/useCompactionEvents'
import { useSeed } from '../api/useSeed'
import { formatTokens, formatCost } from '../utils/costEstimate'
import { formatDuration, timeAgo } from '../utils/time'
import { useRoutingEventsByType } from '../api/useRoutingEventsByType'
import { useDispatchEvents, useRoutingStats } from '../api/useRouting'
import { useAgentScorecard } from '../api/useAgentProfile'
import StatusPill from '../components/StatusPill'
import Tabs from '../components/Tabs'
import SectionHeader from '../components/SectionHeader'
import { fadeUpItem } from '../lib/motion'

import { useTokenSpend } from '../api/useTokenSpend'
import { useBudgetStatus } from '../api/useBudgetStatus'

import QualityGatesPanel from '../components/analytics/QualityGatesPanel'
import MemoryAnalyticsPanel from '../components/analytics/MemoryAnalyticsPanel'
import ToolFailuresPanel from '../components/analytics/ToolFailuresPanel'
import CompactionTimeline from '../components/analytics/CompactionTimeline'
import { useChartColors } from '../lib/useChartColors'

function TokenSpendInline() {
  const { data, isLoading } = useTokenSpend()
  const { data: budget } = useBudgetStatus()
  const reduced = useReducedMotion()
  const c = useChartColors()

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <div key={i} className="bento-card p-5 h-24 animate-pulse" />)}
        </div>
        <div className="bento-card p-6 h-64 animate-pulse" />
      </div>
    )
  }

  if (!data) return <div className="p-6 text-[var(--text-muted)]">No token spend data available.</div>

  const { totals, daily } = data

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bento-card p-5">
          <div className="text-2xl font-bold text-[var(--text-primary)] tabular-nums">{formatCost(totals.costUsd)}</div>
          <div className="text-xs text-[var(--text-muted)] mt-0.5">Total Cost (30d)</div>
          {budget?.daily_limit != null && (
            <div className="text-xs text-[var(--text-secondary)] mt-1">
              Daily limit: {formatCost(budget.daily_limit)}
            </div>
          )}
        </div>
        <div className="bento-card p-5">
          <div className="text-2xl font-bold text-[var(--text-primary)] tabular-nums">{formatTokens(totals.inputTokens)}</div>
          <div className="text-xs text-[var(--text-muted)] mt-0.5">Input Tokens</div>
        </div>
        <div className="bento-card p-5">
          <div className="text-2xl font-bold text-[var(--text-primary)] tabular-nums">{formatTokens(totals.outputTokens)}</div>
          <div className="text-xs text-[var(--text-muted)] mt-0.5">Output Tokens</div>
        </div>
        <div className="bento-card p-5">
          <div className="text-2xl font-bold text-[var(--text-primary)] tabular-nums">{totals.sessionCount}</div>
          <div className="text-xs text-[var(--text-muted)] mt-0.5">Sessions</div>
        </div>
      </div>

      {/* Daily cost chart */}
      {daily.length > 0 && (
        <div className="bento-card p-6">
          <h2 className="text-sm font-semibold text-[var(--text-primary)] mb-4">Daily Token Spend</h2>
          <div role="img" aria-label="Area chart of daily token spend over the last 30 days">
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={daily}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#88A3D6' }} tickFormatter={d => d.slice(5)} />
              <YAxis tick={{ fontSize: 10, fill: '#88A3D6' }} tickFormatter={v => `$${Number(v).toFixed(2)}`} />
              <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => [`$${v.toFixed(4)}`, 'Cost']} />
              <Area type="monotone" dataKey="costUsd" stroke={c.mint} fill={c.mintDim} strokeWidth={2} isAnimationActive={!reduced} />
            </AreaChart>
          </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Cache token info */}
      {(totals.cacheCreationTokens > 0 || totals.cacheReadTokens > 0) && (
        <div className="bento-card p-5">
          <h2 className="text-sm font-semibold text-[var(--text-primary)] mb-2">Cache Tokens</h2>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-[var(--text-muted)]">Cache Creation:</span>
              <span className="ml-2 font-mono text-[var(--text-secondary)]">{formatTokens(totals.cacheCreationTokens)}</span>
            </div>
            <div>
              <span className="text-[var(--text-muted)]">Cache Reads:</span>
              <span className="ml-2 font-mono text-[var(--text-secondary)]">{formatTokens(totals.cacheReadTokens)}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function AgentScorecard() {
  const { data, isLoading: loading, error } = useAgentScorecard()
  const agents = data?.agents ?? []
  const c = useChartColors()

  if (loading) {
    return (
      <div className="bento-card p-6 space-y-3">
        <div className="h-4 w-40 rounded bg-[var(--bg-secondary)] animate-pulse" />
        {[...Array(4)].map((_, i) => <div key={i} className="h-8 rounded bg-[var(--bg-secondary)] animate-pulse" />)}
      </div>
    )
  }

  if (error) {
    return <div className="bento-card p-6 text-[var(--error)] text-sm">{error instanceof Error ? error.message : 'Failed to load'}</div>
  }

  if (!agents.length) {
    return (
      <div className="bento-card p-6 text-center text-[var(--text-muted)] text-sm">
        No agent runs in cast.db yet.
      </div>
    )
  }

  return (
    <div className="bento-card overflow-hidden">
      <div className="px-6 py-4 border-b border-[var(--border)]">
        <h2 className="text-sm font-semibold text-[var(--text-muted)] uppercase tracking-wider">Agent Scorecard</h2>
        <p className="text-xs text-[var(--text-muted)] mt-1">Per-agent success rate, blocked count, and avg cost from cast.db</p>
      </div>
      <div className="overflow-x-auto" role="region" aria-label="Agent scorecard table — per-agent runs, success rate, blocked count, and average cost">
        <table className="w-full text-sm min-w-[340px] md:min-w-[560px]">
          <thead>
            <tr className="border-b border-[var(--border)]">
              <th scope="col" className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">Agent</th>
              <th scope="col" className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">Runs</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)] min-w-[120px] md:min-w-[160px]">Success Rate</th>
              {/* Hidden on mobile — shown at md+ */}
              <th scope="col" className="hidden md:table-cell px-6 py-3 text-right text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">Blocked</th>
              <th scope="col" className="hidden md:table-cell px-6 py-3 text-right text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">Avg Cost</th>
            </tr>
          </thead>
          <tbody>
            {agents.map(a => {
              const underperformer = a.success_rate < 70 && a.blocked_count > 5
              const barColor = a.success_rate >= 80 ? c.mint : a.success_rate >= 70 ? c.amber : c.rose
              const barPct = Math.max(0, Math.min(100, a.success_rate))
              return (
                <tr key={a.name} className="border-b border-[var(--border)] hover:bg-[var(--bg-tertiary)] transition-colors">
                  <td className="px-6 py-3 font-medium text-[var(--text-primary)]">
                    <div className="flex items-center gap-2">
                      {underperformer && (
                        <AlertTriangle
                          className="w-3.5 h-3.5 text-rose-400 shrink-0"
                          aria-label="Underperformer: below 70% success and over 5 blocked"
                        />
                      )}
                      <Link
                        to={`/analytics/agents/${encodeURIComponent(a.name)}`}
                        className="hover:text-[var(--accent)] transition-colors no-underline"
                      >
                        {a.name}
                      </Link>
                    </div>
                  </td>
                  <td className="px-6 py-3 text-right text-[var(--text-secondary)] tabular-nums">{a.runs}</td>
                  <td className="px-6 py-3">
                    <div className="flex items-center gap-2">
                      <div
                        className="flex-1 h-2 rounded-full bg-[var(--bg-secondary)] overflow-hidden min-w-[60px] md:min-w-[80px]"
                        role="progressbar"
                        aria-valuenow={barPct}
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-label={`Success rate: ${a.success_rate}%`}
                      >
                        <div className="h-full rounded-full transition-all" style={{ width: `${barPct}%`, backgroundColor: barColor }} />
                      </div>
                      <span className="text-xs tabular-nums" style={{ color: barColor }}>{a.success_rate}%</span>
                    </div>
                  </td>
                  {/* Hidden on mobile */}
                  <td className="hidden md:table-cell px-6 py-3 text-right tabular-nums" style={{ color: a.blocked_count > 5 ? c.rose : 'var(--text-secondary)' }}>
                    {a.blocked_count}
                  </td>
                  <td className="hidden md:table-cell px-6 py-3 text-right text-[var(--text-muted)] tabular-nums font-mono text-xs">
                    {a.avg_cost_usd > 0 ? `$${a.avg_cost_usd.toFixed(4)}` : '$0.0000'}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <div className="px-6 py-2 border-t border-[var(--border)] text-xs text-[var(--text-muted)] flex items-center gap-1" aria-label="Legend: triangle icon indicates underperformer">
        <AlertTriangle className="w-3 h-3 text-rose-400" aria-hidden="true" />
        = underperformer (&lt;70% success AND &gt;5 blocked)
      </div>
    </div>
  )
}

// Dispatch overview from cast.db agent_runs (via /api/routing/{stats,events}).
function DispatchActivityPanel() {
  const { data: stats } = useRoutingStats()
  const { data: events = [] } = useDispatchEvents(50)

  const recent = events.slice(0, 8)
  const statusEntries = Object.entries(stats?.byStatus ?? {}).sort((a, b) => b[1] - a[1])

  if ((stats?.total ?? 0) === 0 && recent.length === 0) return null

  return (
    <div className="bento-card overflow-hidden">
      <div className="px-6 py-4 border-b border-[var(--border)]">
        <h2 className="text-sm font-semibold text-[var(--text-muted)] uppercase tracking-wider">Dispatch Activity</h2>
        <p className="text-xs text-[var(--text-muted)] mt-1">Agent dispatches recorded in cast.db (agent_runs)</p>
      </div>

      {/* Stat strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-[var(--border)]">
        <div className="bg-[var(--bg-secondary)] px-4 py-3">
          <div className="text-xl font-bold text-[var(--text-primary)] tabular-nums">{stats?.total ?? 0}</div>
          <div className="text-xs text-[var(--text-muted)]">Total dispatches</div>
        </div>
        <div className="bg-[var(--bg-secondary)] px-4 py-3">
          <div className="text-xl font-bold text-[var(--accent)] tabular-nums">{stats?.last24hCount ?? 0}</div>
          <div className="text-xs text-[var(--text-muted)]">Last 24h</div>
        </div>
        <div className="bg-[var(--bg-secondary)] px-4 py-3 col-span-2">
          <div className="text-xl font-bold text-[var(--text-primary)] truncate" title={stats?.topAgent ?? undefined}>
            {stats?.topAgent ?? '—'}
          </div>
          <div className="text-xs text-[var(--text-muted)]">Most dispatched agent</div>
        </div>
      </div>

      {/* Status breakdown */}
      {statusEntries.length > 0 && (
        <div className="flex flex-wrap gap-2 px-6 py-3 border-t border-[var(--border)]">
          {statusEntries.map(([status, count]) => (
            <StatusPill key={status} status={status} label={`${status} · ${count}`} />
          ))}
        </div>
      )}

      {/* Recent dispatches */}
      {recent.length > 0 && (
        <div className="border-t border-[var(--border)] divide-y divide-[var(--border)]">
          {recent.map(ev => (
            <div key={ev.id} className="flex items-center gap-3 px-6 py-2.5">
              <span className="font-medium text-sm text-[var(--text-primary)] truncate flex-1" title={ev.prompt_preview ?? undefined}>
                {ev.agent}
              </span>
              <StatusPill status={ev.status} />
              {ev.duration_ms != null && (
                <span className="text-xs text-[var(--text-muted)] tabular-nums w-14 text-right">{formatDuration(ev.duration_ms)}</span>
              )}
              <span className="text-xs text-[var(--text-muted)] tabular-nums whitespace-nowrap w-20 text-right">{timeAgo(ev.started_at)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

const MODEL_COLORS: Record<string, string> = {
  fable:  '#F87171', // rose-400 — matches badge palette
  sonnet: '#00FFC2',
  haiku:  '#60A5FA',
  opus:   '#A78BFA',
}

function getModelColor(model: string): string {
  if (model.includes('fable'))  return MODEL_COLORS.fable
  if (model.includes('sonnet')) return MODEL_COLORS.sonnet
  if (model.includes('haiku'))  return MODEL_COLORS.haiku
  if (model.includes('opus'))   return MODEL_COLORS.opus
  return '#6B7280' // neutral gray — legible in both themes
}

function getModelShort(model: string): string {
  return model.replace('claude-', '').replace(/-\d{8}$/, '')
}

// Custom tooltip styles
const tooltipStyle = {
  backgroundColor: '#1A1D23',
  border: '1px solid rgba(0,255,194,0.2)',
  borderRadius: '8px',
  fontSize: '12px',
  color: '#E6E8EE',
}

function StatCard({ icon: Icon, label, value, sub }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string; sub?: string }) {
  return (
    <div className="bento-card p-5 flex items-start gap-4">
      <div className="p-2.5 rounded-lg bg-[var(--accent-subtle)] shrink-0">
        <Icon className="w-5 h-5 text-[var(--accent)]" />
      </div>
      <div className="min-w-0">
        <div className="text-2xl font-bold text-[var(--text-primary)] tabular-nums">{value}</div>
        <div className="text-xs text-[var(--text-muted)] mt-0.5">{label}</div>
        {sub && <div className="text-xs text-[var(--text-secondary)] mt-1">{sub}</div>}
      </div>
    </div>
  )
}

const PIXEL_FONT = { fontFamily: "'Press Start 2P', monospace" }

function PixelBar({ pct, color, bg }: { pct: number; color: string; bg: string }) {
  const filled = Math.round(pct / 10)
  const empty = 10 - filled
  return (
    <span style={{ ...PIXEL_FONT, fontSize: 8, letterSpacing: 1 }}>
      <span style={{ color }}>{'\u2588'.repeat(filled)}</span>
      <span style={{ color: bg }}>{'\u2591'.repeat(empty)}</span>
    </span>
  )
}

function DelegationSavingsPanel({ savings }: { savings: DelegationSavings }) {
  const c = useChartColors()
  const total = savings.dispatches.haiku + savings.dispatches.sonnet + savings.dispatches.opus
  const haikuPct = total > 0 ? Math.round((savings.dispatches.haiku / total) * 100) : 0
  const sonnetPct = total > 0 ? Math.round((savings.dispatches.sonnet / total) * 100) : 0
  const opusPct = total > 0 ? Math.round((savings.dispatches.opus / total) * 100) : 0

  return (
    <div
      className="bento-card p-6"
      style={{
        background: 'repeating-linear-gradient(0deg, rgba(0,0,0,0.08) 0px, rgba(0,0,0,0.08) 1px, transparent 1px, transparent 3px), var(--bg-secondary)',
        border: '2px solid rgba(0,255,194,0.15)',
      }}
    >
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 rounded-lg bg-[var(--accent-subtle)]">
          <Zap className="w-4 h-4 text-[var(--accent)]" />
        </div>
        <div>
          <h2 style={{ ...PIXEL_FONT, fontSize: 9, color: c.mint, lineHeight: 2 }}>
            DELEGATION SAVINGS
          </h2>
          <p className="text-xs text-[var(--text-muted)]">Haiku dispatch vs all-sonnet baseline</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Left: Savings + Haiku util */}
        <div className="space-y-5">
          {/* Saved amount */}
          <div>
            <div className="text-xs text-[var(--text-muted)] mb-1">SAVED VS ALL-SONNET</div>
            <div style={{ ...PIXEL_FONT, fontSize: 14, color: c.mint, lineHeight: 2 }}>
              ${savings.savedUSD.toFixed(4)}
            </div>
            <div className="text-xs text-[var(--text-muted)] mt-0.5">
              actual ${savings.actualCostUSD.toFixed(4)} · baseline ${savings.hypotheticalSonnetCostUSD.toFixed(4)}
            </div>
          </div>

          {/* Haiku utilization */}
          <div>
            <div className="text-xs text-[var(--text-muted)] mb-2">HAIKU UTIL</div>
            <div className="flex items-center gap-3">
              <PixelBar pct={savings.haikuUtilizationPct} color={c.blue} bg={c.barTrack} />
              <span style={{ ...PIXEL_FONT, fontSize: 8, color: c.blue }}>
                {savings.haikuUtilizationPct}%
              </span>
            </div>
          </div>
        </div>

        {/* Right: Per-model dispatch chips */}
        <div>
          <div className="text-xs text-[var(--text-muted)] mb-3">MODEL DISPATCH SPLIT</div>
          <div className="space-y-3">
            {[
              { label: 'HAIKU', count: savings.dispatches.haiku, pct: haikuPct, color: c.blue },
              { label: 'SONNET', count: savings.dispatches.sonnet, pct: sonnetPct, color: c.mint },
              { label: 'OPUS', count: savings.dispatches.opus, pct: opusPct, color: c.purple },
            ].map(({ label, count, pct, color }) => (
              <div key={label} className="flex items-center gap-3">
                <span
                  className="px-2 py-1 rounded"
                  style={{ ...PIXEL_FONT, fontSize: 6, color, background: `${color}15`, minWidth: 52, textAlign: 'center' }}
                >
                  {label}
                </span>
                <div className="flex-1 h-1.5 rounded-full bg-[var(--bg-tertiary)] overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{ width: `${pct}%`, backgroundColor: color }}
                  />
                </div>
                <span className="text-xs text-[var(--text-muted)] w-8 text-right">{count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function CacheBreakdownPanel({ totalCacheCreationTokens, totalCacheReadTokens }: { totalCacheCreationTokens: number; totalCacheReadTokens: number }) {
  const c = useChartColors()
  const total = totalCacheCreationTokens + totalCacheReadTokens
  const hitRatio = total > 0 ? Math.round((totalCacheReadTokens / total) * 100) : 0

  // Cache savings: tokens read at $0.30/M vs what they'd cost at $3.00/M input rate (Sonnet)
  const inputRatePerM = 3.00
  const cacheReadRatePerM = 0.30
  const cacheSavingsUSD = (totalCacheReadTokens * (inputRatePerM - cacheReadRatePerM)) / 1_000_000

  const creationPct = total > 0 ? Math.round((totalCacheCreationTokens / total) * 100) : 0
  const readPct = total > 0 ? Math.round((totalCacheReadTokens / total) * 100) : 0

  return (
    <div
      className="bento-card p-6"
      style={{
        background: 'repeating-linear-gradient(0deg, rgba(0,0,0,0.08) 0px, rgba(0,0,0,0.08) 1px, transparent 1px, transparent 3px), var(--bg-secondary)',
        border: '2px solid rgba(96,165,250,0.15)',
      }}
    >
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 rounded-lg bg-blue-500/10">
          <Activity className="w-4 h-4 text-blue-400" />
        </div>
        <div>
          <h2 style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 9, color: c.blue, lineHeight: 2 }}>
            CACHE EFFICIENCY
          </h2>
          <p className="text-xs text-[var(--text-muted)]">Prompt cache creation vs read ratio</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-5">
          <div>
            <div className="text-xs text-[var(--text-muted)] mb-1">HIT RATIO</div>
            <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 14, color: c.blue, lineHeight: 2 }}>
              {hitRatio}%
            </div>
            <div className="text-xs text-[var(--text-muted)] mt-0.5">
              {formatTokens(totalCacheReadTokens)} reads · {formatTokens(totalCacheCreationTokens)} writes
            </div>
          </div>
          <div>
            <div className="text-xs text-[var(--text-muted)] mb-1">CACHE SAVINGS</div>
            <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 11, color: c.mint, lineHeight: 2 }}>
              {formatCost(cacheSavingsUSD)}
            </div>
            <div className="text-xs text-[var(--text-muted)] mt-0.5">vs paying full input rate for cache reads</div>
          </div>
        </div>

        <div>
          <div className="text-xs text-[var(--text-muted)] mb-3">TOKEN BREAKDOWN</div>
          <div className="space-y-3">
            {[
              { label: 'CACHE WRITE', count: totalCacheCreationTokens, pct: creationPct, color: c.amber },
              { label: 'CACHE READ', count: totalCacheReadTokens, pct: readPct, color: c.mint },
            ].map(({ label, count, pct, color }) => (
              <div key={label} className="flex items-center gap-3">
                <span
                  className="px-2 py-1 rounded"
                  style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 6, color, background: `${color}15`, minWidth: 72, textAlign: 'center' }}
                >
                  {label}
                </span>
                <div className="flex-1 h-1.5 rounded-full bg-[var(--bg-tertiary)] overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{ width: `${pct}%`, backgroundColor: color }}
                  />
                </div>
                <span className="text-xs text-[var(--text-muted)] w-14 text-right">{formatTokens(count)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

type SortKey = 'project' | 'sessions' | 'tokens' | 'cost'
type SortDir = 'asc' | 'desc'
type AnalyticsTab = 'agents' | 'cost' | 'compaction'

const ANALYTICS_TABS: { key: AnalyticsTab; label: string }[] = [
  { key: 'agents', label: 'Agents & Usage' },
  { key: 'cost', label: 'Cost & Tokens' },
  { key: 'compaction', label: 'Compaction' },
]

function CompactionTab() {
  const { data, isLoading } = useCompactionEvents({ limit: 200 })
  const c = useChartColors()

  const { totalCount, chartData, recentEvents } = useMemo(() => {
    const events = data?.events ?? []
    const total = events.length

    // Build 30-day chart: count events per day
    const today = new Date()
    const cutoff = new Date(today)
    cutoff.setDate(today.getDate() - 29)
    const counts: Record<string, number> = {}
    for (let i = 0; i < 30; i++) {
      const d = new Date(cutoff)
      d.setDate(cutoff.getDate() + i)
      counts[d.toISOString().slice(0, 10)] = 0
    }
    for (const ev of events) {
      const day = (ev.timestamp ?? '').slice(0, 10)
      if (day in counts) counts[day] = (counts[day] ?? 0) + 1
    }
    const chart = Object.entries(counts)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, count]) => ({ date, count }))

    // Recent 20 for table
    const recent = events.slice(0, 20)

    return { totalCount: total, chartData: chart, recentEvents: recent }
  }, [data])

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="bento-card p-5 h-24 animate-pulse" />
        <div className="bento-card p-6 h-64 animate-pulse" />
        <div className="bento-card p-6 h-48 animate-pulse" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Stat card */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={Layers}
          label="Total Compaction Events"
          value={String(totalCount)}
          sub="last 200 events"
        />
      </div>

      {/* Bar chart: events per day (last 30 days) */}
      <div className="bento-card p-6">
        <h2 className="text-sm font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-4">
          Compaction Events per Day (Last 30 Days)
        </h2>
        <div
          className="min-h-[180px]"
          role="img"
          aria-label="Bar chart showing compaction events per day over the last 30 days"
        >
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis
                dataKey="date"
                tick={{ fill: '#88A3D6', fontSize: 10 }}
                tickFormatter={(d: string) => d.slice(5)}
                axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
                interval="preserveStartEnd"
              />
              <YAxis
                tick={{ fill: '#88A3D6', fontSize: 11 }}
                allowDecimals={false}
                axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
              />
              <Tooltip contentStyle={tooltipStyle} />
              <Bar dataKey="count" name="Compactions" fill={c.purple} radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Recent events table */}
      {recentEvents.length > 0 ? (
        <div className="bento-card overflow-hidden">
          <div className="px-6 py-4 border-b border-[var(--border)]">
            <h2 className="text-sm font-semibold text-[var(--text-muted)] uppercase tracking-wider">
              Recent Compaction Events
            </h2>
          </div>
          <div
            className="overflow-x-auto"
            role="region"
            aria-label="Recent compaction events table"
          >
            <table className="w-full text-sm min-w-[480px]">
              <thead>
                <tr className="border-b border-[var(--border)]">
                  <th scope="col" className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                    Session ID
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                    Trigger
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                    Tier
                  </th>
                  <th scope="col" className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                    Timestamp
                  </th>
                </tr>
              </thead>
              <tbody>
                {recentEvents.map((ev) => (
                  <tr
                    key={ev.id}
                    className="border-b border-[var(--border)] hover:bg-[var(--bg-tertiary)] transition-colors"
                  >
                    <td className="px-6 py-3 font-mono text-xs text-[var(--text-secondary)]">
                      {ev.session_id ? ev.session_id.slice(0, 12) : '—'}
                    </td>
                    <td className="px-6 py-3 text-[var(--text-primary)]">
                      {ev.trigger || '—'}
                    </td>
                    <td className="px-6 py-3 text-[var(--text-secondary)]">
                      {ev.compaction_tier || '—'}
                    </td>
                    <td className="px-6 py-3 text-right text-[var(--text-muted)] tabular-nums text-xs">
                      {ev.timestamp ? ev.timestamp.slice(0, 19).replace('T', ' ') : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="bento-card p-6 text-center text-[var(--text-muted)] text-sm">
          No compaction events found.
        </div>
      )}
    </div>
  )
}

export default function AnalyticsView() {
  const [activeTab, setActiveTab] = useState<AnalyticsTab>('agents')
  const { data, isLoading, error } = useAnalytics()
  const c = useChartColors()
  const { loading: seedLoading, result: seedResult, error: seedError, trigger: runSeed } = useSeed()
  const [sortKey, setSortKey] = useState<SortKey>('cost')
  const { data: promptEvents } = useRoutingEventsByType('user_prompt_submit', 200)

  const promptActivityData = useMemo(() => {
    if (!promptEvents || promptEvents.length === 0) return []
    const today = new Date()
    const cutoff = new Date(today)
    cutoff.setDate(today.getDate() - 13) // 14 days including today
    const counts: Record<string, number> = {}
    for (let i = 0; i < 14; i++) {
      const d = new Date(cutoff)
      d.setDate(cutoff.getDate() + i)
      counts[d.toISOString().slice(0, 10)] = 0
    }
    for (const ev of promptEvents) {
      const day = ev.timestamp.slice(0, 10)
      if (day in counts) counts[day] = (counts[day] ?? 0) + 1
    }
    return Object.entries(counts)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, count]) => ({ date, count }))
  }, [promptEvents])

  useEffect(() => {
    const link = document.createElement('link')
    link.href = 'https://fonts.googleapis.com/css2?family=Press+Start+2P&display=swap'
    link.rel = 'stylesheet'
    document.head.appendChild(link)
    return () => { document.head.removeChild(link) }
  }, [])
  const [sortDir, setSortDir] = useState<SortDir>('desc')

  const sortedProjects = useMemo(() => {
    if (!data?.sessionsByProject) return []
    return [...data.sessionsByProject].sort((a, b) => {
      const mul = sortDir === 'asc' ? 1 : -1
      if (sortKey === 'project') return mul * a.project.localeCompare(b.project)
      return mul * ((a[sortKey] as number) - (b[sortKey] as number))
    })
  }, [data?.sessionsByProject, sortKey, sortDir])

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortKey(key)
      setSortDir('desc')
    }
  }

  function sortIndicator(key: SortKey) {
    if (sortKey !== key) return ''
    return sortDir === 'asc' ? ' \u2191' : ' \u2193'
  }

  if (isLoading) {
    return (
      <div className="space-y-6 animate-in">
        <div><h1 className="text-2xl font-bold">Analytics</h1></div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bento-card p-5 animate-pulse">
              <div className="h-8 w-20 bg-[var(--bg-tertiary)] rounded mb-2" />
              <div className="h-4 w-28 bg-[var(--bg-tertiary)] rounded" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Analytics</h1>
        <div className="rounded-xl bg-[var(--bg-secondary)] border border-[var(--error)]/30 px-5 py-4 text-sm text-[var(--error)]">
          Failed to load analytics: {(error as Error).message}
        </div>
      </div>
    )
  }

  if (!data) return null

  const totalTokens = data.totalInputTokens + data.totalOutputTokens

  return (
    <motion.div className="space-y-6" variants={fadeUpItem} initial="hidden" animate="show">
      <SectionHeader
        as="h1"
        kicker="cost & usage"
        title="Analytics"
        icon={<TrendingUp className="w-5 h-5" />}
        description={data.monthPrefix
          ? `Token usage and costs for ${data.monthPrefix} (current billing month)`
          : 'Token usage, costs, and tool breakdown across all sessions'}
      />

      {/* Tab bar + panels */}
      <Tabs
        tabs={ANALYTICS_TABS.map(t => ({ id: t.key, label: t.label }))}
        activeTab={activeTab}
        onChange={(id) => setActiveTab(id as AnalyticsTab)}
        ariaLabel="Analytics views"
        idBase="analytics"
      >
      {/* Cost & Tokens tab */}
      {activeTab === 'cost' && <TokenSpendInline />}

      {/* Compaction tab */}
      {activeTab === 'compaction' && <CompactionTab />}

      {/* Agents & Usage tab */}
      {activeTab === 'agents' && <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div />
        <div className="flex flex-col items-end gap-1 shrink-0">
          <button
            onClick={runSeed}
            disabled={seedLoading}
            aria-busy={seedLoading}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-[var(--bg-secondary)] border border-[var(--glass-border)] text-[var(--text-secondary)] hover:border-[var(--accent)]/40 hover:text-[var(--accent)] transition-all disabled:opacity-50 disabled:cursor-not-allowed focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:outline-none"
          >
            <RefreshCw className={`w-4 h-4 ${seedLoading ? 'animate-spin' : ''}`} />
            {seedLoading ? 'Seeding…' : 'Refresh Data'}
          </button>
          <div aria-live="polite" aria-atomic="true" className="text-xs">
            {seedResult && (
              <span className="text-emerald-400">
                +{seedResult.seeded.sessions} sessions, +{seedResult.seeded.agentRuns} runs
              </span>
            )}
            {seedError && (
              <span className="text-[var(--error)]">{seedError}</span>
            )}
          </div>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={Activity}
          label="Total Sessions"
          value={String(data.totalSessions)}
          sub={data.avgSessionDurationMs > 0 ? `avg ${formatDuration(data.avgSessionDurationMs)}` : undefined}
        />
        <StatCard
          icon={TrendingUp}
          label="Total Tokens"
          value={formatTokens(totalTokens)}
          sub={`${formatTokens(data.totalInputTokens)} in · ${formatTokens(data.totalOutputTokens)} out`}
        />
        <StatCard
          icon={Coins}
          label="Estimated Spend"
          value={formatCost(data.estimatedCostUSD)}
          sub={data.totalSessions > 0 ? `avg ${formatCost(data.estimatedCostUSD / data.totalSessions)} / session${data.monthPrefix ? ' · this month' : ''}` : undefined}
        />
        <StatCard
          icon={Clock}
          label="Avg Tokens / Session"
          value={formatTokens(data.avgTokensPerSession)}
          sub={data.totalCacheReadTokens > 0 ? `${formatTokens(data.totalCacheReadTokens)} cache hits` : undefined}
        />
      </div>

      {/* Delegation Savings */}
      {data.delegationSavings && (
        <DelegationSavingsPanel savings={data.delegationSavings} />
      )}

      {/* Cache Efficiency */}
      {(data.totalCacheCreationTokens > 0 || data.totalCacheReadTokens > 0) && (
        <CacheBreakdownPanel
          totalCacheCreationTokens={data.totalCacheCreationTokens}
          totalCacheReadTokens={data.totalCacheReadTokens}
        />
      )}

      {/* Daily Token Burn Chart */}
      {data.sessionsByDay.length > 1 && (
        <div className="bento-card p-6">
          <h2 className="text-sm font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-4">Daily Token Usage (Last 90 Days)</h2>
          <div className="min-h-[180px]" role="img" aria-label="Area chart showing daily input and output token usage over the last 90 days">
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={data.sessionsByDay}>
              <defs>
                <linearGradient id="gradientMint" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={c.mint} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={c.mint} stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gradientAmber" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={c.amber} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={c.amber} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis
                dataKey="date"
                tick={{ fill: '#88A3D6', fontSize: 11 }}
                tickFormatter={(d: string) => d.slice(5)}
                axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
              />
              <YAxis
                tick={{ fill: '#88A3D6', fontSize: 11 }}
                tickFormatter={(v: number) => formatTokens(v)}
                axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
              />
              <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => formatTokens(v)} />
              <Legend iconType="circle" wrapperStyle={{ fontSize: 12, color: '#88A3D6' }} />
              <Area type="monotone" dataKey="inputTokens" name="Input" stroke={c.mint} fill="url(#gradientMint)" strokeWidth={2} />
              <Area type="monotone" dataKey="outputTokens" name="Output" stroke={c.amber} fill="url(#gradientAmber)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Two-column: Tool Usage + Model Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Tool Usage Bar Chart */}
        {data.toolUsage.length > 0 && (
          <div className="bento-card p-6">
            <h2 className="text-sm font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-4">Top Tools by Usage</h2>
            <div className="min-h-[180px]" role="img" aria-label="Horizontal bar chart showing the top 10 most-used tools by call count">
            <ResponsiveContainer width="100%" height={Math.max(250, data.toolUsage.slice(0, 10).length * 32)}>
              <BarChart data={data.toolUsage.slice(0, 10)} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis type="number" tick={{ fill: '#88A3D6', fontSize: 11 }} axisLine={{ stroke: 'rgba(255,255,255,0.1)' }} />
                <YAxis
                  type="category"
                  dataKey="tool"
                  width={120}
                  tick={{ fill: '#E6E8EE', fontSize: 11, fontFamily: 'Geist Mono, monospace' }}
                  axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
                />
                <Tooltip contentStyle={tooltipStyle} />
                <Bar dataKey="count" name="Calls" fill={c.mint} radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Model Breakdown Pie */}
        {data.modelBreakdown.length > 0 && (
          <div className="bento-card p-6">
            <h2 className="text-sm font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-4">Cost by Model</h2>
            <div className="min-h-[180px]" role="img" aria-label="Donut chart showing estimated cost breakdown by Claude model (Haiku, Sonnet, Opus)">
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie
                  data={data.modelBreakdown.filter(e => e.cost > 0)}
                  cx="50%"
                  cy="45%"
                  innerRadius={55}
                  outerRadius={90}
                  dataKey="cost"
                  nameKey="model"
                  label={false}
                >
                  {data.modelBreakdown.filter(e => e.cost > 0).map((entry) => (
                    <Cell key={entry.model} fill={getModelColor(entry.model)} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={tooltipStyle}
                  formatter={(v: number, _name: string, props: unknown) => {
                    const p = props as { payload?: { model?: string; sessions?: number; tokens?: number } }
                    const model = p.payload?.model || ''
                    const sessions = p.payload?.sessions ?? 0
                    const tokens = p.payload?.tokens ?? 0
                    return [`${formatCost(v)} (${sessions} sessions, ${formatTokens(tokens)} tokens)`, getModelShort(model)]
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
            </div>
            {/* Legend below chart — avoids label overlap */}
            <div className="flex flex-wrap justify-center gap-4 mt-2">
              {data.modelBreakdown.filter(e => e.cost > 0).map((entry) => {
                const totalCost = data.modelBreakdown.filter(e => e.cost > 0).reduce((s, e) => s + e.cost, 0)
                const pct = totalCost > 0 ? ((entry.cost / totalCost) * 100).toFixed(1) : '0'
                return (
                  <div key={entry.model} className="flex items-center gap-2 text-xs">
                    <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: getModelColor(entry.model) }} />
                    <span className="text-[var(--text-secondary)]">{getModelShort(entry.model)}</span>
                    <span className="text-[var(--accent)] font-medium tabular-nums">{formatCost(entry.cost)}</span>
                    <span className="text-[var(--text-muted)]">({pct}%)</span>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {/* Daily Token Burn — last 30 days */}
      {data.sessionsByDay.length > 1 && (
        <div className="bento-card p-6">
          <h2 className="text-sm font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-4">
            Daily Token Burn (Last 30 Days)
          </h2>
          <div className="min-h-[180px]" role="img" aria-label="Stacked bar chart showing daily input and output token burn over the last 30 days">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={data.sessionsByDay.slice(-30)}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis
                dataKey="date"
                tick={{ fill: '#88A3D6', fontSize: 10 }}
                tickFormatter={(d: string) => d.slice(5)}
                axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
                interval="preserveStartEnd"
              />
              <YAxis
                tick={{ fill: '#88A3D6', fontSize: 11 }}
                tickFormatter={(v: number) => formatTokens(v)}
                axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
              />
              <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => [formatTokens(v)]} />
              <Legend iconType="circle" wrapperStyle={{ fontSize: 12, color: '#88A3D6' }} />
              <Bar dataKey="inputTokens" name="Input" stackId="a" fill={c.mint} opacity={0.85} />
              <Bar dataKey="outputTokens" name="Output" stackId="a" fill={c.amber} opacity={0.85} radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Dispatch Activity */}
      <DispatchActivityPanel />

      {/* Agent Scorecard */}
      <AgentScorecard />

      {/* Prompt Activity */}
      {promptActivityData.length > 0 && (
        <div className="bento-card p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-[var(--text-muted)] uppercase tracking-wider">Prompt Activity (Last 14 Days)</h2>
            <span className="text-xs text-[var(--text-secondary)] tabular-nums">
              {promptActivityData.reduce((s, d) => s + d.count, 0)} total
            </span>
          </div>
          <div className="min-h-[160px]" role="img" aria-label="Bar chart showing daily user prompt submissions over the last 14 days">
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={promptActivityData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis
                  dataKey="date"
                  tick={{ fill: '#88A3D6', fontSize: 10 }}
                  tickFormatter={(d: string) => d.slice(5)}
                  axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
                  interval="preserveStartEnd"
                />
                <YAxis
                  tick={{ fill: '#88A3D6', fontSize: 11 }}
                  allowDecimals={false}
                  axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
                />
                <Tooltip contentStyle={tooltipStyle} />
                <Bar dataKey="count" name="Prompts" fill={c.purple} radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Project Cost Table */}
      {sortedProjects.length > 0 && (
        <div className="bento-card overflow-hidden">
          <div className="px-6 py-4 border-b border-[var(--border)]">
            <h2 className="text-sm font-semibold text-[var(--text-muted)] uppercase tracking-wider">Cost by Project</h2>
          </div>
          <div className="overflow-x-auto" role="region" aria-label="Cost by project — sortable table">
            <table className="w-full text-sm min-w-[480px]">
              <thead>
                <tr className="border-b border-[var(--border)]">
                  <th scope="col" aria-sort={sortKey === 'project' ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'} className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                    <button type="button" onClick={() => toggleSort('project')} className="inline-flex items-center gap-1 uppercase tracking-wider hover:text-[var(--accent)] transition-colors">
                      Project{sortIndicator('project')}
                    </button>
                  </th>
                  <th scope="col" aria-sort={sortKey === 'sessions' ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'} className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                    <button type="button" onClick={() => toggleSort('sessions')} className="inline-flex items-center gap-1 uppercase tracking-wider hover:text-[var(--accent)] transition-colors">
                      Sessions{sortIndicator('sessions')}
                    </button>
                  </th>
                  <th scope="col" aria-sort={sortKey === 'tokens' ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'} className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                    <button type="button" onClick={() => toggleSort('tokens')} className="inline-flex items-center gap-1 uppercase tracking-wider hover:text-[var(--accent)] transition-colors">
                      Tokens{sortIndicator('tokens')}
                    </button>
                  </th>
                  <th scope="col" aria-sort={sortKey === 'cost' ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'} className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                    <button type="button" onClick={() => toggleSort('cost')} className="inline-flex items-center gap-1 uppercase tracking-wider hover:text-[var(--accent)] transition-colors">
                      Est. Cost{sortIndicator('cost')}
                    </button>
                  </th>
                </tr>
              </thead>
              <tbody>
                {sortedProjects.map(({ project, sessions, tokens, cost }) => (
                  <tr key={project} className="border-b border-[var(--border)] hover:bg-[var(--bg-tertiary)] transition-colors">
                    <td className="px-6 py-3 font-semibold text-[var(--text-primary)]">{project}</td>
                    <td className="px-6 py-3 text-right text-[var(--text-secondary)] tabular-nums">{sessions}</td>
                    <td className="px-6 py-3 text-right text-[var(--text-secondary)] tabular-nums">{formatTokens(tokens)}</td>
                    <td className="px-6 py-3 text-right text-[var(--accent)] tabular-nums font-medium">{formatCost(cost)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      </div>}
      </Tabs>

      {/* CAST Observability Panels — visible on both tabs */}
      <div className="space-y-6 mt-6">
        <h2 className="text-sm font-semibold text-[var(--text-muted)] uppercase tracking-wider">CAST Observability</h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <QualityGatesPanel />
          <ToolFailuresPanel />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <MemoryAnalyticsPanel />
          <CompactionTimeline />
        </div>
      </div>
    </motion.div>
  )
}
