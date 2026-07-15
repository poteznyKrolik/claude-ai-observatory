import { useState } from 'react'
import { motion } from 'framer-motion'
import SectionHeader from '../components/SectionHeader'
import { fadeUpItem } from '../lib/motion'
import {
  FileText,
  DollarSign,
  ShieldCheck,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Bot,
  Webhook,
  BookOpen,
  CheckCircle2,
  XCircle,
  Clock,
} from 'lucide-react'
import {
  useExecutiveSummary,
  type SummaryRange,
  type BlockerEntry,
  type TopAgent,
} from '../api/useExecutiveSummary'
import { formatCost } from '../utils/costEstimate'
import { timeAgo } from '../utils/time'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function statusColor(status: string): string {
  const s = status.toLowerCase()
  if (s === 'done') return 'text-emerald-400'
  if (s === 'done_with_concerns') return 'text-amber-400'
  if (s === 'blocked') return 'text-rose-400'
  if (s === 'needs_context') return 'text-violet-400'
  if (s === 'running') return 'text-blue-400'
  return 'text-zinc-400'
}

function statusBadge(status: string) {
  const s = status.toLowerCase()
  const colorMap: Record<string, string> = {
    done: 'bg-emerald-400/10 text-emerald-400 border-emerald-400/20',
    done_with_concerns: 'bg-amber-400/10 text-amber-400 border-amber-400/20',
    blocked: 'bg-rose-400/10 text-rose-400 border-rose-400/20',
    needs_context: 'bg-violet-400/10 text-violet-400 border-violet-400/20',
    running: 'bg-blue-400/10 text-blue-400 border-blue-400/20',
  }
  const cls = colorMap[s] ?? 'bg-zinc-400/10 text-zinc-400 border-zinc-400/20'
  const label = status.replace(/_/g, ' ')
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold uppercase tracking-wide border ${cls}`}>
      {label}
    </span>
  )
}

function todayLabel() {
  return new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

// ─── Subcomponents ────────────────────────────────────────────────────────────

function HeadlineCard({
  icon: Icon,
  label,
  value,
  sub,
  accent,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: string
  sub?: React.ReactNode
  accent?: string
}) {
  return (
    <div className="bento-card p-5 flex items-start gap-4">
      <div className={`p-2.5 rounded-lg shrink-0 ${accent ?? 'bg-[var(--accent-subtle)]'}`}>
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

function HeadlineCardSkeleton() {
  return (
    <div className="bento-card p-5">
      <div className="h-3 w-20 rounded bg-[var(--bg-secondary)] animate-pulse mb-3" />
      <div className="h-7 w-14 rounded bg-[var(--bg-secondary)] animate-pulse" />
    </div>
  )
}

function BlockerItem({ entry }: { entry: BlockerEntry }) {
  return (
    <div className="flex items-start gap-3 py-3 border-b border-[var(--border)]/50 last:border-0">
      <div className={`mt-0.5 shrink-0 ${statusColor(entry.status)}`}>
        {entry.status.toLowerCase() === 'blocked' ? (
          <XCircle className="w-4 h-4" />
        ) : (
          <AlertTriangle className="w-4 h-4" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-mono text-sm text-[var(--text-primary)]">{entry.agent}</span>
          {statusBadge(entry.status)}
        </div>
        {entry.work_log_snippet && (
          <p className="text-xs text-[var(--text-muted)] mt-1 truncate">
            {entry.work_log_snippet}
          </p>
        )}
      </div>
      <div className="shrink-0 text-xs text-[var(--text-muted)] flex items-center gap-1">
        <Clock className="w-3 h-3" />
        {timeAgo(entry.started_at)}
      </div>
    </div>
  )
}

function TopAgentRow({ agent, rank }: { agent: TopAgent; rank: number }) {
  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-[var(--border)]/50 last:border-0">
      <span className="w-5 text-xs text-[var(--text-muted)] text-right tabular-nums shrink-0">
        {rank}
      </span>
      <Bot className="w-4 h-4 text-[var(--accent)] shrink-0" />
      <span className="font-mono text-sm text-[var(--text-primary)] flex-1 truncate">{agent.agent}</span>
      <span className="text-sm tabular-nums text-[var(--text-secondary)] shrink-0">{agent.count} runs</span>
      <span className="text-xs tabular-nums text-[var(--text-muted)] shrink-0 w-16 text-right">
        {formatCost(agent.costUsd)}
      </span>
    </div>
  )
}

// ─── Main View ────────────────────────────────────────────────────────────────

export default function ExecutiveSummaryView() {
  const [range, setRange] = useState<SummaryRange>('today')
  const { data, isLoading, error } = useExecutiveSummary(range)

  // ── Loading state ──
  if (isLoading) {
    return (
      <div className="p-6 max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="h-6 w-48 rounded bg-[var(--bg-secondary)] animate-pulse mb-2" />
            <div className="h-3 w-32 rounded bg-[var(--bg-secondary)] animate-pulse" />
          </div>
        </div>
        {/* Headline cards */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {[...Array(4)].map((_, i) => <HeadlineCardSkeleton key={i} />)}
        </div>
      </div>
    )
  }

  // ── Error state ──
  if (error) {
    return (
      <div className="p-6 max-w-5xl mx-auto">
        <div role="alert" className="bento-card p-6 text-center space-y-2">
          <AlertTriangle className="w-8 h-8 text-rose-400 mx-auto" />
          <p className="text-sm text-[var(--text-secondary)]">Failed to load executive summary</p>
          <p className="text-xs text-[var(--text-muted)] font-mono">{(error as Error).message}</p>
        </div>
      </div>
    )
  }

  const summary = data ?? {
    range,
    generatedAt: new Date().toISOString(),
    runs: { total: 0, byStatus: { DONE: 0, DONE_WITH_CONCERNS: 0, BLOCKED: 0, NEEDS_CONTEXT: 0, RUNNING: 0, OTHER: 0 } },
    cost: { todayUsd: 0, weekUsd: 0, vsPrior7dPct: null },
    topAgents: [],
    blockers: [],
    highlights: { plansActive: 0, hookFailures24h: 0, qualityGatePassRate: null },
  }

  const { runs, cost, topAgents, blockers, highlights } = summary

  // Compute pass rate from byStatus when quality_gates unavailable
  const done = runs.byStatus.DONE
  const total = runs.total
  const passRateFromRuns = total > 0 ? Math.round((done / total) * 1000) / 10 : null
  const displayPassRate = highlights.qualityGatePassRate ?? passRateFromRuns

  // Cost delta display
  const costDelta = cost.vsPrior7dPct !== null ? (
    <span className={`flex items-center gap-0.5 ${cost.vsPrior7dPct >= 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
      {cost.vsPrior7dPct >= 0
        ? <TrendingUp className="w-3 h-3" />
        : <TrendingDown className="w-3 h-3" />}
      {Math.abs(cost.vsPrior7dPct)}% vs prior
    </span>
  ) : null

  const blockerCount = blockers.length
  const hasBlockers = blockerCount > 0
  const hasTopAgents = topAgents.length > 0

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* ── Page header ── */}
      <SectionHeader
        as="h1"
        kicker="daily digest"
        title="Executive Summary"
        icon={<FileText className="w-5 h-5" />}
        description={todayLabel()}
        actions={
          <div role="group" aria-label="Summary range" className="flex items-center gap-1 rounded-lg border border-[var(--border)] p-1 bg-[var(--bg-secondary)]">
            {(['today', 'week'] as SummaryRange[]).map(r => (
              <button
                key={r}
                onClick={() => setRange(r)}
                aria-pressed={range === r}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                  range === r
                    ? 'bg-[var(--accent)] text-[var(--primary-foreground)]'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
              >
                {r === 'today' ? 'Today' : 'Week'}
              </button>
            ))}
          </div>
        }
      />

      {/* ── Headline metrics row ── */}
      <motion.div
        className="grid grid-cols-2 gap-4 sm:grid-cols-4"
        variants={fadeUpItem}
        initial="hidden"
        animate="show"
      >
        <HeadlineCard
          icon={Bot}
          label={`Runs (${range})`}
          value={String(runs.total)}
          sub={runs.total === 0 ? 'No agent runs' : `${runs.byStatus.DONE} done · ${runs.byStatus.RUNNING} running`}
        />
        <HeadlineCard
          icon={DollarSign}
          label="Cost today"
          value={formatCost(cost.todayUsd)}
          sub={costDelta}
        />
        <HeadlineCard
          icon={ShieldCheck}
          label="Pass rate"
          value={displayPassRate !== null ? `${displayPassRate}%` : '—'}
          sub={displayPassRate === null ? 'No data' : `${done} of ${total} done`}
        />
        <HeadlineCard
          icon={AlertTriangle}
          label="Blockers"
          value={String(blockerCount)}
          sub={blockerCount === 0 ? 'None in window' : `${runs.byStatus.BLOCKED} blocked · ${runs.byStatus.DONE_WITH_CONCERNS} concerns`}
          accent={hasBlockers ? 'bg-rose-400/10' : undefined}
        />
      </motion.div>

      {/* ── Two-column middle section ── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Blockers & Concerns */}
        <section className="bento-card p-5">
          <h2 className="text-sm font-semibold text-[var(--text-primary)] mb-3 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-400" />
            Blockers &amp; Concerns
            {hasBlockers && (
              <span className="ml-auto text-xs text-[var(--text-muted)] font-normal">
                {blockerCount} item{blockerCount !== 1 ? 's' : ''}
              </span>
            )}
          </h2>
          {hasBlockers ? (
            <div>
              {blockers.map(entry => (
                <BlockerItem key={entry.id} entry={entry} />
              ))}
            </div>
          ) : (
            <div className="py-8 text-center text-sm text-[var(--text-muted)]">
              <CheckCircle2 className="w-6 h-6 text-emerald-400 mx-auto mb-2" />
              No blockers in this window
            </div>
          )}
        </section>

        {/* Top Agents */}
        <section className="bento-card p-5">
          <h2 className="text-sm font-semibold text-[var(--text-primary)] mb-3 flex items-center gap-2">
            <Bot className="w-4 h-4 text-[var(--accent)]" />
            Top Agents
          </h2>
          {hasTopAgents ? (
            <div>
              {topAgents.map((agent, i) => (
                <TopAgentRow key={agent.agent} agent={agent} rank={i + 1} />
              ))}
            </div>
          ) : (
            <div className="py-8 text-center text-sm text-[var(--text-muted)]">
              No agent runs in this window
            </div>
          )}
        </section>
      </div>

      {/* ── Highlights footer row ── */}
      <section className="bento-card p-5">
        <h2 className="text-sm font-semibold text-[var(--text-primary)] mb-4 flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-[var(--accent)]" />
          Highlights
        </h2>
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center">
            <div className="flex items-center justify-center gap-1.5 mb-1">
              <BookOpen className="w-4 h-4 text-[var(--accent)]" />
              <span className="text-xs text-[var(--text-muted)]">Plans Active</span>
            </div>
            <div className="text-xl font-bold text-[var(--text-primary)] tabular-nums">
              {highlights.plansActive}
            </div>
          </div>
          <div className="text-center border-x border-[var(--border)]">
            <div className="flex items-center justify-center gap-1.5 mb-1">
              <Webhook className="w-4 h-4 text-rose-400" />
              <span className="text-xs text-[var(--text-muted)]">Hook Failures 24h</span>
            </div>
            <div className={`text-xl font-bold tabular-nums ${highlights.hookFailures24h > 0 ? 'text-rose-400' : 'text-[var(--text-primary)]'}`}>
              {highlights.hookFailures24h}
            </div>
          </div>
          <div className="text-center">
            <div className="flex items-center justify-center gap-1.5 mb-1">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span className="text-xs text-[var(--text-muted)]">Gate Pass Rate</span>
            </div>
            <div className="text-xl font-bold text-[var(--text-primary)] tabular-nums">
              {highlights.qualityGatePassRate !== null ? `${highlights.qualityGatePassRate}%` : '—'}
            </div>
          </div>
        </div>
      </section>

      {/* Generated at */}
      <p className="text-[10px] text-[var(--text-muted)] text-right font-mono">
        Generated {new Date(summary.generatedAt).toLocaleTimeString()}
      </p>
    </div>
  )
}
