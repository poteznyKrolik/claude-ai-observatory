import { useState } from 'react'
import { FileText } from 'lucide-react'
import { usePlans, usePlan, usePlanSessions } from '../api/usePlans'
import { useModalA11y } from '../lib/useModalA11y'
import SectionHeader from '../components/SectionHeader'
import { motion } from 'framer-motion'
import { fadeUpItem } from '../lib/motion'
import type { PlanFile } from '../types'
import { timeAgo } from '../utils/time'

function SkeletonRows() {
  return (
    <div className="bento-card overflow-hidden divide-y divide-[var(--glass-border)]">
      {[...Array(4)].map((_, i) => (
        <div key={i} className="px-4 py-3 animate-pulse space-y-1.5">
          <div className="h-4 rounded bg-[var(--bg-secondary)]" style={{ width: `${60 + i * 8}%` }} />
          <div className="h-3 rounded bg-[var(--bg-secondary)]" style={{ width: `${40 + i * 5}%` }} />
        </div>
      ))}
    </div>
  )
}

interface PlanDetailModalProps {
  filename: string
  title: string
  onClose: () => void
}

function PlanDetailModal({ filename, title, onClose }: PlanDetailModalProps) {
  const { data, isLoading } = usePlan(filename)
  const dialogRef = useModalA11y<HTMLDivElement>(true, onClose)
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="plan-modal-title"
        className="bento-card max-w-3xl w-full max-h-[80vh] flex flex-col overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--glass-border)]">
          <div className="flex items-center gap-2 min-w-0">
            <FileText className="w-4 h-4 text-[var(--accent)] shrink-0" aria-hidden="true" />
            <span id="plan-modal-title" className="text-sm font-semibold text-[var(--text-primary)] truncate">{title || filename}</span>
          </div>
          <button
            onClick={onClose}
            className="shrink-0 ml-2 text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] px-2 py-1 rounded hover:bg-[var(--accent-subtle)] transition-colors"
            aria-label="Close"
          >
            Close
          </button>
        </div>
        <div className="overflow-y-auto p-4 flex-1">
          {isLoading ? (
            <div className="text-sm text-[var(--text-muted)]">Loading...</div>
          ) : (
            <pre className="text-xs text-[var(--text-secondary)] whitespace-pre-wrap leading-relaxed font-mono">
              {data?.body ?? 'No content available'}
            </pre>
          )}
        </div>
      </div>
    </div>
  )
}

interface PlanRowProps {
  plan: PlanFile
  onClick: (plan: PlanFile) => void
}

function PlanRow({ plan, onClick }: PlanRowProps) {
  return (
    <button
      type="button"
      className="w-full text-left px-4 py-3 hover:bg-[var(--accent-subtle)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--accent)] focus-visible:outline-offset-[-2px] transition-colors"
      style={{ minHeight: '44px' }}
      onClick={() => onClick(plan)}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-[var(--text-primary)] truncate">
            {plan.title || plan.filename}
          </p>
          {plan.preview && (
            <p className="text-xs text-[var(--text-muted)] truncate mt-0.5">
              {plan.preview}
            </p>
          )}
        </div>
        <span className="shrink-0 text-xs text-[var(--text-muted)]">
          {timeAgo(plan.modifiedAt)}
        </span>
      </div>
    </button>
  )
}

export default function PlansView() {
  const { data: plans = [], isLoading, error } = usePlans()
  const { data: sessionData } = usePlanSessions()
  const planSessions = sessionData?.sessions ?? []
  const [selectedPlan, setSelectedPlan] = useState<PlanFile | null>(null)

  const sorted = [...plans].sort(
    (a, b) => new Date(b.modifiedAt).getTime() - new Date(a.modifiedAt).getTime()
  )

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      <SectionHeader
        as="h1"
        kicker="plan archive"
        title="Plans"
        icon={<FileText className="w-5 h-5" />}
        description="~/.claude/plans/"
        actions={
          <span className="text-xs text-[var(--text-muted)]">
            {plans.length} plan{plans.length !== 1 ? 's' : ''}
          </span>
        }
      />

      {isLoading && <SkeletonRows />}

      {error && (
        <div role="alert" className="bento-card p-4 text-sm text-[var(--text-muted)]">
          Failed to load plans.
        </div>
      )}

      {!isLoading && !error && sorted.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <FileText className="w-10 h-10 opacity-20 text-[var(--text-muted)]" aria-hidden="true" />
          <p className="text-sm text-[var(--text-muted)]">No plans found</p>
        </div>
      )}

      {!isLoading && !error && sorted.length > 0 && (
        <motion.div
          className="bento-card overflow-hidden divide-y divide-[var(--glass-border)]"
          variants={fadeUpItem}
          initial="hidden"
          animate="show"
        >
          {sorted.map(plan => (
            <PlanRow key={plan.path} plan={plan} onClick={setSelectedPlan} />
          ))}
        </motion.div>
      )}

      {planSessions.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">Run history</h2>
            <span className="text-xs text-[var(--text-muted)]">· plan_sessions</span>
          </div>
          <div className="bento-card overflow-hidden divide-y divide-[var(--glass-border)]">
            {planSessions.map(s => (
              <div key={s.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                <span className="min-w-0 truncate text-xs font-mono text-[var(--text-secondary)]" title={s.plan_file ?? ''}>
                  {s.plan_file ? s.plan_file.split('/').pop() : '—'}
                </span>
                <span className="shrink-0 text-xs text-[var(--text-muted)] tabular-nums">{timeAgo(s.started_at)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {selectedPlan && (
        <PlanDetailModal
          filename={selectedPlan.filename}
          title={selectedPlan.title}
          onClose={() => setSelectedPlan(null)}
        />
      )}
    </div>
  )
}
