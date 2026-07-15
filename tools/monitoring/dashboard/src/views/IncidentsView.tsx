import React, { useState } from 'react'
import { AlertCircle, ChevronDown, ChevronRight } from 'lucide-react'
import { useIncidents, type IncidentRow } from '../api/useIncidents'
import SectionHeader from '../components/SectionHeader'
import { motion } from 'framer-motion'
import { staggerContainer, fadeUpItem } from '../lib/motion'

function formatDate(ts: string): string {
  try {
    return new Date(ts).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' })
  } catch {
    return ts
  }
}

function StatusBadge({ status }: { status: string | null }) {
  const val = (status ?? '').toLowerCase()
  const color = val === 'fixed'
    ? 'bg-emerald-500/20 text-emerald-400'
    : val === 'open'
    ? 'bg-rose-500/20 text-rose-400'
    : 'bg-amber-500/20 text-amber-400'
  const label = val === 'fixed' ? 'fixed' : val === 'open' ? 'open' : 'open'
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${color}`}>
      {label}
    </span>
  )
}

function SkeletonRows() {
  return (
    <div className="space-y-2 p-4">
      {[...Array(4)].map((_, i) => (
        <div key={i} className="h-12 rounded bg-[var(--bg-secondary)] animate-pulse" style={{ width: `${95 - i * 5}%` }} />
      ))}
    </div>
  )
}

function DetailRow({ label, value, mono = false }: { label: string; value: string | null; mono?: boolean }) {
  if (!value) return (
    <div className="flex gap-3 text-xs">
      <span className="text-[var(--text-muted)] w-28 shrink-0">{label}</span>
      <span className="text-[var(--text-muted)] opacity-50">—</span>
    </div>
  )
  return (
    <div className="flex gap-3 text-xs">
      <span className="text-[var(--text-muted)] w-28 shrink-0">{label}</span>
      <span className={`text-[var(--text-secondary)] ${mono ? 'font-mono' : ''}`}>
        {mono ? value.slice(0, 7) : value}
      </span>
    </div>
  )
}

function countByStatus(incidents: IncidentRow[]): { fixed: number; open: number } {
  let fixed = 0
  let open = 0
  for (const inc of incidents) {
    const s = (inc.resolution_status ?? '').toLowerCase()
    if (s === 'fixed') fixed++
    else open++
  }
  return { fixed, open }
}

export default function IncidentsView() {
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const { data, isLoading } = useIncidents()
  const incidents = data?.incidents ?? []
  const { fixed, open } = countByStatus(incidents)

  function toggleRow(id: string) {
    setExpandedId(prev => (prev === id ? null : id))
  }

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      <SectionHeader
        as="h1"
        kicker="incident log"
        title="Incidents"
        icon={<AlertCircle className="w-5 h-5 text-rose-400" />}
        description="Manually recorded system incidents and root cause log"
      />

      {/* Stat bar */}
      {!isLoading && (
        <motion.div className="flex items-center gap-6" variants={staggerContainer} initial="hidden" animate="show">
          <motion.div variants={fadeUpItem} className="bento-card px-4 py-3 flex items-center gap-2">
            <span className="text-2xl font-bold text-[var(--text-primary)]">{incidents.length}</span>
            <span className="text-xs text-[var(--text-muted)]">total</span>
          </motion.div>
          <motion.div variants={fadeUpItem} className="bento-card px-4 py-3 flex items-center gap-2">
            <span className="text-2xl font-bold text-emerald-400">{fixed}</span>
            <span className="text-xs text-[var(--text-muted)]">fixed</span>
          </motion.div>
          <motion.div variants={fadeUpItem} className="bento-card px-4 py-3 flex items-center gap-2">
            <span className="text-2xl font-bold text-rose-400">{open}</span>
            <span className="text-xs text-[var(--text-muted)]">open</span>
          </motion.div>
        </motion.div>
      )}

      {/* Table */}
      <div className="bento-card overflow-hidden">
        {isLoading ? (
          <SkeletonRows />
        ) : incidents.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center text-[var(--text-muted)]">
            <AlertCircle className="w-10 h-10 mb-3 opacity-20" aria-hidden="true" />
            <div className="font-medium">No incidents recorded</div>
            <div className="text-xs mt-1 opacity-60">The incidents table is empty</div>
          </div>
        ) : (
          <table className="w-full text-xs" aria-label="Incidents">
            <thead className="bg-[var(--bg-secondary)]">
              <tr className="border-b border-[var(--glass-border)]">
                <th className="w-6 px-3 py-2" />
                <th className="px-3 py-2 text-left font-semibold text-[var(--text-muted)]">Date</th>
                <th className="px-3 py-2 text-left font-semibold text-[var(--text-muted)]">Problem</th>
                <th className="px-3 py-2 text-left font-semibold text-[var(--text-muted)]">Status</th>
                <th className="px-3 py-2 text-left font-semibold text-[var(--text-muted)]">Surfaced By</th>
              </tr>
            </thead>
            <tbody>
              {incidents.map(inc => (
                <React.Fragment key={inc.id}>
                  <tr
                    className="border-b border-[var(--glass-border)] hover:bg-[var(--accent-subtle)] transition-colors cursor-pointer"
                    onClick={() => toggleRow(inc.id)}
                    role="button"
                    tabIndex={0}
                    aria-expanded={expandedId === inc.id}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleRow(inc.id) } }}
                  >
                    <td className="px-3 py-2 text-[var(--text-muted)]">
                      {expandedId === inc.id
                        ? <ChevronDown className="w-3.5 h-3.5" aria-hidden="true" />
                        : <ChevronRight className="w-3.5 h-3.5" aria-hidden="true" />
                      }
                    </td>
                    <td className="px-3 py-2 text-[var(--text-muted)] whitespace-nowrap">{formatDate(inc.occurred_at)}</td>
                    <td className="px-3 py-2 text-[var(--text-secondary)] max-w-sm">{inc.problem_summary}</td>
                    <td className="px-3 py-2"><StatusBadge status={inc.resolution_status} /></td>
                    <td className="px-3 py-2 text-[var(--text-muted)]">{inc.surfaced_by ?? '—'}</td>
                  </tr>
                  {expandedId === inc.id && (
                    <tr className="border-b border-[var(--glass-border)] bg-[var(--bg-secondary)]">
                      <td />
                      <td colSpan={4} className="px-4 py-4">
                        <div className="space-y-2">
                          <DetailRow label="Fix summary" value={inc.fix_summary} />
                          <DetailRow label="Related files" value={inc.related_files} />
                          <DetailRow label="Related commit" value={inc.related_commit} mono />
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
