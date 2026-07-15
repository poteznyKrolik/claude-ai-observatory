import { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Bot, Search, Activity, ArrowUpDown, ChevronDown, ChevronRight, Route } from 'lucide-react'
import { useAgents } from '../api/useAgents'
import { useActiveAgents } from '../api/useActiveAgents'
import { useAgentRuns } from '../api/useAgentRuns'
import type { AgentRun } from '../api/useAgentRuns'
import { useAgentRoster } from '../api/useAgentRoster'
import { useDispatchDecisions } from '../api/useDispatchDecisions'
import { useInjectionLog } from '../api/useInjectionLog'
import { timeAgo, formatDuration } from '../utils/time'
import { formatCost } from '../utils/costEstimate'
import { modelBadgeClasses } from '../utils/modelBadge'
import AgentStatusBadge from '../components/AgentStatusBadge'
import StatusPill from '../components/StatusPill'
import Tabs from '../components/Tabs'
import SectionHeader from '../components/SectionHeader'

// ── Loading skeleton ──────────────────────────────────────────────────────────
function RegistrySkeleton() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="bento-card p-4 space-y-3">
          <div className="h-4 w-24 rounded animate-pulse bg-[var(--bg-tertiary)]" />
          <div className="h-3 w-16 rounded animate-pulse bg-[var(--bg-tertiary)]" />
          <div className="h-3 w-full rounded animate-pulse bg-[var(--bg-tertiary)]" />
        </div>
      ))}
    </div>
  )
}

// ── Scorecard types ───────────────────────────────────────────────────────────
interface AgentScorecard {
  agent: string
  totalRuns: number
  successRate: number
  avgCost: number
  lastRun: string | null
}

type SortKey = 'agent' | 'totalRuns' | 'successRate' | 'avgCost' | 'lastRun'

// ── Routing Intel Section ─────────────────────────────────────────────────────

type RoutingTab = 'decisions' | 'injection'

function RoutingIntelSection() {
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState<RoutingTab>('decisions')
  const { data: decisionsData } = useDispatchDecisions()
  const { data: injectionData } = useInjectionLog()

  const decisions = decisionsData?.decisions ?? []
  const entries = injectionData?.entries ?? []

  function fmtTime(ts: string) {
    return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  }

  return (
    <section>
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-2 text-sm font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors mb-2"
        aria-expanded={open}
      >
        {open
          ? <ChevronDown className="w-4 h-4" />
          : <ChevronRight className="w-4 h-4" />}
        <Route className="w-4 h-4" />
        Routing Intel
      </button>

      {open && (
        <div className="bento-card overflow-hidden">
          {/* Tab bar */}
          <Tabs
            tabs={[
              { id: 'decisions', label: 'Dispatch Decisions' },
              { id: 'injection', label: 'Injection Log' },
            ]}
            activeTab={tab}
            onChange={(id) => setTab(id as RoutingTab)}
            ariaLabel="Routing intel views"
            idBase="routing"
            size="xs"
          />

          {/* Tab panels */}
          <div role="tabpanel" id="routing-panel" aria-labelledby={`routing-tab-${tab}`}>
          {/* Dispatch Decisions */}
          {tab === 'decisions' && (
            <div className="overflow-x-auto max-h-64 overflow-y-auto">
              <table className="w-full text-xs" aria-label="Dispatch decisions">
                <thead className="sticky top-0 bg-[var(--bg-secondary)] z-10">
                  <tr className="border-b border-[var(--border)]">
                    <th className="text-left px-3 py-2 font-medium text-[var(--text-muted)]">Time</th>
                    <th className="text-left px-3 py-2 font-medium text-[var(--text-muted)]">Backend</th>
                    <th className="text-left px-3 py-2 font-medium text-[var(--text-muted)]">Plan File</th>
                    <th className="text-left px-3 py-2 font-medium text-[var(--text-muted)]">Session</th>
                  </tr>
                </thead>
                <tbody>
                  {decisions.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-3 py-4 text-center text-[var(--text-muted)]">No dispatch decisions</td>
                    </tr>
                  ) : decisions.map(d => (
                    <tr key={d.id} className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--bg-tertiary)] transition-colors">
                      <td className="px-3 py-2 tabular-nums text-[var(--text-muted)]">{fmtTime(d.timestamp)}</td>
                      <td className="px-3 py-2 font-medium text-[var(--accent)]">{d.dispatch_backend ?? '—'}</td>
                      <td className="px-3 py-2 text-[var(--text-secondary)] truncate max-w-[180px]" title={d.plan_file ?? undefined}>{d.plan_file ?? '—'}</td>
                      <td className="px-3 py-2 text-[var(--text-muted)] font-mono">{d.session_id ? d.session_id.slice(0, 8) : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Injection Log */}
          {tab === 'injection' && (
            <div className="overflow-x-auto max-h-64 overflow-y-auto">
              <table className="w-full text-xs" aria-label="Injection log">
                <thead className="sticky top-0 bg-[var(--bg-secondary)] z-10">
                  <tr className="border-b border-[var(--border)]">
                    <th className="text-left px-3 py-2 font-medium text-[var(--text-muted)]">Injected At</th>
                    <th className="text-left px-3 py-2 font-medium text-[var(--text-muted)]">Fact ID</th>
                    <th className="text-left px-3 py-2 font-medium text-[var(--text-muted)]">Score / Prompt Hash</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="px-3 py-4 text-center text-[var(--text-muted)]">No injection log entries</td>
                    </tr>
                  ) : entries.map(e => (
                    <tr key={e.id} className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--bg-tertiary)] transition-colors">
                      <td className="px-3 py-2 tabular-nums text-[var(--text-muted)]">{fmtTime(e.injected_at)}</td>
                      <td className="px-3 py-2 text-[var(--accent)]">{e.fact_id}</td>
                      <td className="px-3 py-2 text-[var(--text-secondary)] truncate max-w-[300px]" title={e.prompt_hash}>
                        {e.score != null ? `${e.score.toFixed(2)} · ` : ''}{e.prompt_hash.slice(0, 12)}…
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          </div>
        </div>
      )}
    </section>
  )
}

// ── AgentsView ────────────────────────────────────────────────────────────────
export default function AgentsView() {
  const { data: agents, isLoading: agentsLoading } = useAgents()
  const { data: activeAgents } = useActiveAgents()
  const { data: roster } = useAgentRoster()
  const { data: runsData } = useAgentRuns({ limit: 500 })
  const { data: recentRunsData } = useAgentRuns({ limit: 50 })

  // Search filter for registry
  const [search, setSearch] = useState('')

  // Scorecard sort
  const [sortKey, setSortKey] = useState<SortKey>('totalRuns')
  const [sortAsc, setSortAsc] = useState(false)

  // Recent runs filters
  const [runAgentFilter, setRunAgentFilter] = useState('')
  const [runStatusFilter, setRunStatusFilter] = useState('')

  // Active agent names set
  const activeNames = useMemo(() => {
    if (!activeAgents) return new Set<string>()
    return new Set(activeAgents.map((a) => a.agent))
  }, [activeAgents])

  // Filtered registry
  const filteredAgents = useMemo(() => {
    if (!agents) return []
    const q = search.toLowerCase()
    if (!q) return agents
    return agents.filter(
      (a) => a.name.toLowerCase().includes(q) || a.description.toLowerCase().includes(q)
    )
  }, [agents, search])

  // Filtered registry sorted with active agents first
  const sortedFilteredAgents = useMemo(() => {
    return [...filteredAgents].sort((a, b) => {
      const aActive = activeNames.has(a.name) ? 1 : 0
      const bActive = activeNames.has(b.name) ? 1 : 0
      return bActive - aActive
    })
  }, [filteredAgents, activeNames])

  // Scorecard aggregation
  const scorecard = useMemo<AgentScorecard[]>(() => {
    if (!runsData?.runs) return []
    const map = new Map<string, { total: number; success: number; cost: number; last: string | null }>()
    for (const run of runsData.runs) {
      const entry = map.get(run.agent) ?? { total: 0, success: 0, cost: 0, last: null }
      entry.total++
      if (run.status?.toUpperCase() === 'DONE' || run.status?.toUpperCase() === 'DONE_WITH_CONCERNS') {
        entry.success++
      }
      entry.cost += run.cost_usd ?? 0
      if (!entry.last || (run.started_at && run.started_at > entry.last)) {
        entry.last = run.started_at
      }
      map.set(run.agent, entry)
    }
    return Array.from(map.entries()).map(([agent, s]) => ({
      agent,
      totalRuns: s.total,
      successRate: s.total > 0 ? (s.success / s.total) * 100 : 0,
      avgCost: s.total > 0 ? s.cost / s.total : 0,
      lastRun: s.last,
    }))
  }, [runsData])

  // Sorted scorecard
  const sortedScorecard = useMemo(() => {
    const sorted = [...scorecard]
    sorted.sort((a, b) => {
      const av = a[sortKey]
      const bv = b[sortKey]
      if (av == null && bv == null) return 0
      if (av == null) return 1
      if (bv == null) return -1
      if (typeof av === 'string' && typeof bv === 'string') return sortAsc ? av.localeCompare(bv) : bv.localeCompare(av)
      return sortAsc ? (av as number) - (bv as number) : (bv as number) - (av as number)
    })
    return sorted
  }, [scorecard, sortKey, sortAsc])

  // Recent runs filtered
  const filteredRuns = useMemo(() => {
    if (!recentRunsData?.runs) return []
    return recentRunsData.runs.filter((r) => {
      if (runAgentFilter && r.agent !== runAgentFilter) return false
      if (runStatusFilter && r.status?.toUpperCase() !== runStatusFilter.toUpperCase()) return false
      return true
    })
  }, [recentRunsData, runAgentFilter, runStatusFilter])

  // Sort toggle handler
  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortAsc(!sortAsc)
    } else {
      setSortKey(key)
      setSortAsc(false)
    }
  }

  // Success rate color
  function rateColor(rate: number) {
    if (rate >= 90) return 'text-emerald-400'
    if (rate >= 70) return 'text-yellow-400'
    return 'text-rose-400'
  }

  // Duration from started_at / ended_at
  function runDuration(run: AgentRun) {
    if (!run.started_at || !run.ended_at) return '--'
    const ms = new Date(run.ended_at).getTime() - new Date(run.started_at).getTime()
    return formatDuration(ms)
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="p-6 space-y-6 max-w-screen-xl mx-auto"
    >
      {/* ── Page header ── */}
      <SectionHeader
        as="h1"
        kicker="agent fleet"
        title="Agents"
        icon={<Bot className="w-5 h-5" />}
        description="Registered agents, live activity, scorecards, and recent runs."
        actions={
          <div className="flex items-center gap-2">
            <span className="text-xs text-[var(--text-muted)]">
              {agents?.length ?? 0} registered
            </span>
            {roster && (
              <span
                title={
                  roster.source === 'filesystem'
                    ? 'live roster from ~/.claude/agents'
                    : 'roster unavailable — showing built-in list'
                }
              >
                <StatusPill
                  status={roster.source === 'filesystem' ? 'live' : 'warning'}
                  label={
                    roster.source === 'filesystem'
                      ? `${roster.count} installed`
                      : `${roster.count} built-in`
                  }
                />
              </span>
            )}
          </div>
        }
      />

      {/* ── Active Agents ── */}
      <section>
        <h2 className="text-sm font-semibold text-[var(--text-secondary)] mb-2 flex items-center gap-2">
          <Activity className="w-4 h-4" /> Active Agents
        </h2>
        {!activeAgents || activeAgents.length === 0 ? (
          <div className="bento-card p-3 text-xs text-[var(--text-muted)] text-center">
            No agents running
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {activeAgents.map((a) => (
              <div
                key={`${a.agent}-${a.session_id}`}
                className="bento-card px-3 py-2 flex items-center gap-2"
              >
                <span role="img" aria-label="Active" className="relative flex h-2 w-2 shrink-0">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400" />
                </span>
                <span className="text-xs font-medium text-[var(--text-primary)]">{a.agent}</span>
                {a.started_at && (
                  <span className="text-[10px] text-[var(--text-muted)]">{timeAgo(a.started_at)}</span>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ── Agent Registry ── */}
      <section>
        <div className="flex items-center gap-3 mb-3">
          <h2 className="text-sm font-semibold text-[var(--text-secondary)]">Agent Registry</h2>
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--text-muted)]" />
            <input
              type="text"
              placeholder="Filter agents..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Filter agents by name or description"
              className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg bg-[var(--bg-secondary)] border border-[var(--border)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
            />
          </div>
        </div>
        {agentsLoading ? (
          <RegistrySkeleton />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <AnimatePresence>
              {sortedFilteredAgents.map((agent) => (
                <motion.div
                  layout
                  key={agent.name}
                  className={`bento-card p-4 space-y-2 transition-all duration-300 ${
                    activeNames.has(agent.name)
                      ? 'border-emerald-500/40 shadow-emerald-500/10 shadow-lg'
                      : ''
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-[var(--text-primary)]">{agent.name}</span>
                    {activeNames.has(agent.name) && (
                      <span role="img" aria-label="Active" className="relative flex h-2 w-2 shrink-0">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400" />
                      </span>
                    )}
                  </div>
                  <span
                    className={`inline-block text-[10px] px-2 py-0.5 rounded-full border ${modelBadgeClasses(agent.model)}`}
                  >
                    {agent.model}
                  </span>
                  <p className="text-xs text-[var(--text-muted)] line-clamp-2">{agent.description}</p>
                </motion.div>
              ))}
            </AnimatePresence>
            {sortedFilteredAgents.length === 0 && (
              <div role="status" className="col-span-full text-xs text-[var(--text-muted)] text-center py-6">
                No agents match your search
              </div>
            )}
          </div>
        )}
      </section>

      {/* ── Scorecard Table ── */}
      <section>
        <h2 className="text-sm font-semibold text-[var(--text-secondary)] mb-2">Agent Scorecard</h2>
        <div className="bento-card overflow-auto max-h-80">
          <table className="w-full text-xs" aria-label="Agent scorecard">
            <thead className="sticky top-0 bg-[var(--bg-secondary)] z-10">
              <tr className="border-b border-[var(--border)]">
                {([
                  ['agent', 'Agent'],
                  ['totalRuns', 'Total Runs'],
                  ['successRate', 'Success Rate'],
                  ['avgCost', 'Avg Cost'],
                  ['lastRun', 'Last Run'],
                ] as [SortKey, string][]).map(([key, label]) => (
                  <th
                    key={key}
                    scope="col"
                    className="text-left px-3 py-2 font-medium text-[var(--text-muted)]"
                    aria-sort={sortKey === key ? (sortAsc ? 'ascending' : 'descending') : 'none'}
                  >
                    <button
                      type="button"
                      onClick={() => toggleSort(key)}
                      className="flex items-center gap-1 select-none hover:text-[var(--text-primary)] transition-colors"
                    >
                      {label}
                      {sortKey === key && <ArrowUpDown className="w-3 h-3 text-[var(--accent)]" aria-hidden="true" />}
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sortedScorecard.map((row) => (
                <tr key={row.agent} className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--bg-tertiary)] transition-colors">
                  <td className="px-3 py-2 font-medium text-[var(--text-primary)]">{row.agent}</td>
                  <td className="px-3 py-2 tabular-nums text-[var(--text-secondary)]">{row.totalRuns}</td>
                  <td className={`px-3 py-2 tabular-nums font-medium ${rateColor(row.successRate)}`}>
                    {row.successRate.toFixed(0)}%
                  </td>
                  <td className="px-3 py-2 tabular-nums text-[var(--text-secondary)]">{formatCost(row.avgCost)}</td>
                  <td className="px-3 py-2 text-[var(--text-muted)]">{row.lastRun ? timeAgo(row.lastRun) : '--'}</td>
                </tr>
              ))}
              {sortedScorecard.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-3 py-6 text-center text-[var(--text-muted)]">
                    No agent run data available
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* ── Routing Intel ── */}
      <RoutingIntelSection />

      {/* ── Recent Runs ── */}
      <section>
        <h2 className="text-sm font-semibold text-[var(--text-secondary)] mb-2">Recent Runs</h2>
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <select
            value={runAgentFilter}
            onChange={(e) => setRunAgentFilter(e.target.value)}
            aria-label="Filter by agent"
            className="text-xs px-2 py-1.5 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border)] text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
          >
            <option value="">All agents</option>
            {agents?.map((a) => (
              <option key={a.name} value={a.name}>{a.name}</option>
            ))}
          </select>
          <select
            value={runStatusFilter}
            onChange={(e) => setRunStatusFilter(e.target.value)}
            aria-label="Filter by status"
            className="text-xs px-2 py-1.5 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border)] text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
          >
            <option value="">All statuses</option>
            <option value="DONE">DONE</option>
            <option value="DONE_WITH_CONCERNS">DONE_WITH_CONCERNS</option>
            <option value="BLOCKED">BLOCKED</option>
            <option value="NEEDS_CONTEXT">NEEDS_CONTEXT</option>
          </select>
        </div>
        <div className="bento-card divide-y divide-[var(--border)] max-h-96 overflow-auto">
          {filteredRuns.map((run) => (
            <div
              key={`${run.id}-${run.started_at}`}
              className="flex items-center gap-3 px-4 py-2.5 hover:bg-[var(--bg-tertiary)] transition-colors text-xs"
            >
              <span className="text-[var(--text-muted)] tabular-nums shrink-0 w-16">
                {run.started_at ? timeAgo(run.started_at) : '--'}
              </span>
              <span
                className={`inline-block px-2 py-0.5 rounded-full border text-[10px] font-medium shrink-0 ${modelBadgeClasses(run.model)}`}
              >
                {run.agent}
              </span>
              <AgentStatusBadge status={run.status} className="shrink-0" />
              <span className="text-[var(--text-muted)] tabular-nums shrink-0 w-14 text-right">
                {runDuration(run)}
              </span>
              <span className="text-[var(--text-secondary)] tabular-nums shrink-0 w-16 text-right">
                {formatCost(run.cost_usd ?? 0)}
              </span>
              {run.task_summary && (
                <span className="text-[var(--text-muted)] truncate flex-1" title={run.task_summary}>
                  {run.task_summary}
                </span>
              )}
            </div>
          ))}
          {filteredRuns.length === 0 && (
            <div role="status" className="px-4 py-6 text-xs text-[var(--text-muted)] text-center">
              No runs match the selected filters
            </div>
          )}
        </div>
      </section>
    </motion.div>
  )
}
