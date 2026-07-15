import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { Activity, Bot, DollarSign, Zap, CheckCircle2, AlertTriangle, Clock, Shield, Brain, BookOpen, LayoutDashboard } from 'lucide-react'
import { useSystemHealth } from '../api/useSystem'
import { useAgentRuns } from '../api/useAgentRuns'
import { useActiveAgents } from '../api/useActiveAgents'
import { useTokenSpend } from '../api/useTokenSpend'
import { useQualityGateStats, useToolFailureStats, useDbMemories, useResearchCacheStats } from '../api/useCastData'
import { formatCost, formatTokens } from '../utils/costEstimate'
import { timeAgo } from '../utils/time'
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { motion, useReducedMotion } from 'framer-motion'
import SectionHeader from '../components/SectionHeader'
import { staggerContainer, fadeUpItem } from '../lib/motion'
import { useChartColors } from '../lib/useChartColors'

// ─── Stat Card ────────────────────────────────────────────────────────────────

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  to,
  accent,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: string
  sub?: string
  to?: string
  accent?: string
}) {
  const inner = (
    <div className="bento-card h-full p-5 flex items-start gap-4 hover:border-[var(--accent)]/30 transition-colors">
      <div className={`p-2.5 rounded-lg ${accent ?? 'bg-[var(--accent-subtle)]'} shrink-0`}>
        <Icon className="w-5 h-5 text-[var(--accent)]" />
      </div>
      <div className="min-w-0">
        <div className="text-2xl font-bold text-[var(--text-primary)] tabular-nums">{value}</div>
        <div className="text-xs text-[var(--text-muted)] mt-0.5">{label}</div>
        {sub && <div className="text-xs text-[var(--text-secondary)] mt-1">{sub}</div>}
      </div>
    </div>
  )

  return to ? <Link to={to} className="block no-underline h-full">{inner}</Link> : inner
}

function StatCardSkeleton() {
  return (
    <div className="bento-card p-5">
      <div className="h-4 w-24 rounded bg-[var(--bg-secondary)] animate-pulse mb-2" />
      <div className="h-8 w-16 rounded bg-[var(--bg-secondary)] animate-pulse" />
    </div>
  )
}

// ─── Mini Activity Feed ────────────────────────────────────────────────────────

function MiniActivityFeed() {
  const today = useMemo(() => {
    const d = new Date()
    d.setHours(0, 0, 0, 0)
    return d.toISOString()
  }, [])

  const { data, isLoading } = useAgentRuns({ since: today, limit: 10 })
  const runs = data?.runs ?? []

  function statusDot(status: string) {
    const s = status.toLowerCase()
    if (s === 'done') return 'bg-emerald-400'
    if (s === 'done_with_concerns') return 'bg-amber-400'
    if (s === 'blocked' || s === 'failed') return 'bg-rose-400'
    if (s === 'running') return 'bg-blue-400 animate-pulse'
    return 'bg-zinc-500'
  }

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-8 rounded bg-[var(--bg-secondary)] animate-pulse" />
        ))}
      </div>
    )
  }

  if (runs.length === 0) {
    return (
      <div className="py-8 text-center text-sm text-[var(--text-muted)] font-mono">
        No agent runs today
      </div>
    )
  }

  return (
    <div className="divide-y divide-[var(--border)]/50">
      {runs.slice(0, 8).map(run => (
        <div key={run.id} className="flex items-center gap-3 py-2.5 text-sm">
          <span role="img" aria-label={`Status: ${run.status.replace(/_/g, ' ')}`} className={`w-2 h-2 rounded-full shrink-0 ${statusDot(run.status)}`} />
          <span className="font-mono text-xs text-[var(--text-primary)] truncate flex-1">
            {run.agent}
          </span>
          {run.cost_usd > 0 && (
            <span className="text-xs tabular-nums text-[var(--text-muted)] font-mono">
              {formatCost(run.cost_usd)}
            </span>
          )}
          <span className="text-xs text-[var(--text-muted)] whitespace-nowrap shrink-0">
            {timeAgo(run.started_at)}
          </span>
        </div>
      ))}
    </div>
  )
}

// ─── Cost Sparkline ───────────────────────────────────────────────────────────

function CostSparkline() {
  const { data, isLoading } = useTokenSpend()
  const reduced = useReducedMotion()
  const c = useChartColors()

  const chartData = useMemo(() => {
    if (!data?.daily) return []
    return [...data.daily]
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(-7)
      .map(d => ({
        date: d.date.slice(5), // MM-DD
        cost: d.costUsd,
        tokens: d.inputTokens + d.outputTokens,
      }))
  }, [data])

  if (isLoading) {
    return <div className="h-32 rounded bg-[var(--bg-secondary)] animate-pulse" />
  }

  if (chartData.length === 0) {
    return (
      <div className="h-32 flex items-center justify-center text-sm text-[var(--text-muted)] font-mono">
        No spend data
      </div>
    )
  }

  return (
    <div role="img" aria-label="Area chart of daily cost over the last 7 days">
    <ResponsiveContainer width="100%" height={120}>
      <AreaChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
        <defs>
          <linearGradient id="costGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={c.mint} stopOpacity={0.3} />
            <stop offset="95%" stopColor={c.mint} stopOpacity={0} />
          </linearGradient>
        </defs>
        <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'var(--text-secondary)' }} axisLine={false} tickLine={false} />
        <YAxis hide />
        <Tooltip
          contentStyle={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 6, fontSize: 11 }}
          formatter={(v: number) => [formatCost(v), 'Cost']}
        />
        <Area type="monotone" dataKey="cost" stroke={c.mint} fill="url(#costGrad)" strokeWidth={1.5} dot={false} isAnimationActive={!reduced} />
      </AreaChart>
    </ResponsiveContainer>
    </div>
  )
}

// ─── System Health Row ─────────────────────────────────────────────────────────

function HealthRow() {
  const { data } = useSystemHealth()

  const items = [
    { label: 'Agents', value: data?.agentCount ?? '--', ok: (data?.agentCount ?? 0) > 0 },
    { label: 'Hooks', value: data?.hooks.length ?? '--', ok: (data?.hooks.length ?? 0) > 0 },
    { label: 'Skills', value: data?.skillCount ?? '--', ok: (data?.skillCount ?? 0) > 0 },
    { label: 'Plans', value: data?.planCount ?? '--', ok: true },
  ]

  return (
    <div className="flex flex-wrap gap-4">
      {items.map(item => (
        <div key={item.label} className="flex items-center gap-2 text-sm">
          {item.ok
            ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            : <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
          }
          <span className="text-[var(--text-muted)]">{item.label}:</span>
          <span className="font-mono font-semibold text-[var(--text-primary)]">{String(item.value)}</span>
        </div>
      ))}
    </div>
  )
}

// ─── CAST Observability Row ───────────────────────────────────────────────────

function CastObservabilityRow() {
  const { data: qgStats } = useQualityGateStats()
  const { data: tfStats } = useToolFailureStats()
  const { data: memories } = useDbMemories()
  const { data: rcStats } = useResearchCacheStats()

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <StatCard
        icon={Shield}
        label="Quality Gate Pass Rate"
        value={qgStats?.total ? `${qgStats.pass_rate}%` : '--'}
        sub={qgStats?.total ? `${qgStats.total} checks` : 'no data'}
        to="/analytics"
      />
      <StatCard
        icon={AlertTriangle}
        label="Tool Failures (24h)"
        value={String(tfStats?.last24h ?? '--')}
        sub={tfStats?.total ? `${tfStats.total} total` : 'no data'}
        to="/analytics"
      />
      <StatCard
        icon={Brain}
        label="Agent Memories"
        value={String(memories?.length ?? '--')}
        to="/system"
      />
      <StatCard
        icon={BookOpen}
        label="Research Cache"
        value={rcStats?.file_count ? `${rcStats.file_count} files` : '--'}
        sub={rcStats?.total_size_bytes ? `${(rcStats.total_size_bytes / 1024).toFixed(0)} KB` : undefined}
      />
    </div>
  )
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────

export default function HomeView() {
  const today = useMemo(() => {
    const d = new Date()
    d.setHours(0, 0, 0, 0)
    return d.toISOString()
  }, [])

  const { data: runsData, isLoading: runsLoading } = useAgentRuns({ since: today, limit: 200 })
  const { data: activeAgents } = useActiveAgents()
  const { data: health } = useSystemHealth()
  const { data: tokenSpend } = useTokenSpend()

  const todayLocal = useMemo(() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  }, [])

  const todayCost = useMemo(() => {
    const entry = tokenSpend?.daily.find(d => d.date === todayLocal)
    return entry?.costUsd ?? 0
  }, [tokenSpend, todayLocal])

  // Active count comes from the windowed /api/cast/active-agents source (same as
  // AgentsView) so stale orphan 'running' rows — agents that crashed or hit maxTurns
  // without a SubagentStop — don't inflate it. Raw stats.byStatus['running'] counts them.
  const activeCount = activeAgents?.length ?? 0

  // Use stats.totalRuns — avoids 3.6x undercount from limit:200 page truncation
  const todayRunCount = runsData?.stats.totalRuns ?? 0

  const todayTokens = useMemo(() => {
    const entry = tokenSpend?.daily.find(d => d.date === todayLocal)
    if (!entry) return 0
    return entry.inputTokens + entry.outputTokens
  }, [tokenSpend, todayLocal])

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <SectionHeader
        as="h1"
        kicker="live overview"
        title="Dashboard"
        icon={<LayoutDashboard className="w-5 h-5" />}
        description={new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
      />

      {/* Top stat cards */}
      <motion.div
        className="grid grid-cols-2 lg:grid-cols-4 gap-4"
        variants={staggerContainer}
        initial="hidden"
        animate="show"
      >
        {runsLoading ? (
          <>
            <StatCardSkeleton />
            <StatCardSkeleton />
            <StatCardSkeleton />
            <StatCardSkeleton />
          </>
        ) : (
          <>
            <motion.div variants={fadeUpItem} className="h-full">
              <StatCard
                icon={Activity}
                label="Agent Runs Today"
                value={String(todayRunCount)}
                to="/activity"
              />
            </motion.div>
            <motion.div variants={fadeUpItem} className="h-full">
              <StatCard
                icon={Bot}
                label="Active Agents"
                value={String(activeCount)}
                sub={activeCount > 0 ? 'currently running' : 'none running'}
                to="/activity"
              />
            </motion.div>
            <motion.div variants={fadeUpItem} className="h-full">
              <StatCard
                icon={DollarSign}
                label="Cost Today"
                value={formatCost(todayCost)}
                to="/analytics"
              />
            </motion.div>
            <motion.div variants={fadeUpItem} className="h-full">
              <StatCard
                icon={Zap}
                label="Tokens Today"
                value={formatTokens(todayTokens)}
                to="/analytics"
              />
            </motion.div>
          </>
        )}
      </motion.div>

      {/* Middle: activity feed + cost sparkline */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Mini activity feed */}
        <div className="bento-card p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-[var(--accent)]" />
              <h2 className="text-sm font-semibold text-[var(--text-primary)]">Recent Activity</h2>
            </div>
            <Link
              to="/activity"
              className="text-xs text-[var(--accent)] hover:text-[var(--accent-hover)] transition-colors no-underline"
            >
              View all →
            </Link>
          </div>
          <MiniActivityFeed />
        </div>

        {/* Cost sparkline */}
        <div className="bento-card p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-[var(--accent)]" />
              <h2 className="text-sm font-semibold text-[var(--text-primary)]">7-Day Cost</h2>
            </div>
            <Link
              to="/analytics"
              className="text-xs text-[var(--accent)] hover:text-[var(--accent-hover)] transition-colors no-underline"
            >
              View analytics →
            </Link>
          </div>
          <CostSparkline />
        </div>
      </div>

      {/* CAST Observability Widgets */}
      <CastObservabilityRow />

      {/* Bottom: system health */}
      <div className="bento-card p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-[var(--text-primary)]">System Health</h2>
          <Link
            to="/system"
            className="text-xs text-[var(--accent)] hover:text-[var(--accent-hover)] transition-colors no-underline"
          >
            System →
          </Link>
        </div>
        <HealthRow />
        {health?.version && (
          <p className="text-xs text-[var(--text-muted)] font-mono mt-3">
            Dashboard v{health.version} · Model: {health.model}
          </p>
        )}
      </div>
    </div>
  )
}
