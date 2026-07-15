import { useState } from 'react'
import { FolderOpen } from 'lucide-react'
import { useOutputs } from '../api/useOutputs'
import type { OutputFile } from '../types'
import SectionHeader from '../components/SectionHeader'
import Tabs from '../components/Tabs'
import { timeAgo } from '../utils/time'

type OutputCategory = OutputFile['category']

const TABS: { id: OutputCategory; label: string }[] = [
  { id: 'briefings', label: 'Briefings' },
  { id: 'meetings', label: 'Meetings' },
  { id: 'reports', label: 'Reports' },
]

function SkeletonCards() {
  return (
    <div className="space-y-3" role="status" aria-label="Loading outputs">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="bento-card p-4 space-y-2">
          <div className="h-4 w-48 rounded animate-pulse bg-[var(--bg-tertiary)]" />
          <div className="h-3 w-20 rounded animate-pulse bg-[var(--bg-tertiary)]" />
          <div className="h-3 w-full rounded animate-pulse bg-[var(--bg-tertiary)]" />
          <div className="h-3 w-4/5 rounded animate-pulse bg-[var(--bg-tertiary)]" />
        </div>
      ))}
    </div>
  )
}

function EmptyState({ category }: { category: OutputCategory }) {
  return (
    <div className="bento-card p-12 flex flex-col items-center justify-center gap-2" role="status" aria-label={`No ${category}`}>
      <FolderOpen className="w-8 h-8 text-[var(--text-muted)]" aria-hidden="true" />
      <p className="text-sm text-[var(--text-muted)]">No {category} yet.</p>
    </div>
  )
}

function OutputCard({ file }: { file: OutputFile }) {
  const preview = file.preview.length > 200 ? file.preview.slice(0, 200) + '…' : file.preview

  return (
    <article className="bento-card p-4 space-y-1.5">
      <div className="flex items-start justify-between gap-4">
        <h2 className="text-sm font-semibold text-[var(--text-primary)] font-mono leading-snug break-all">
          {file.filename}
        </h2>
        <span className="text-xs text-[var(--text-muted)] whitespace-nowrap shrink-0 tabular-nums">
          {timeAgo(file.modifiedAt)}
        </span>
      </div>
      {preview && (
        <p className="text-xs text-[var(--text-muted)] leading-relaxed line-clamp-3">
          {preview}
        </p>
      )}
    </article>
  )
}

function CategoryPanel({ category }: { category: OutputCategory }) {
  const { data, isLoading } = useOutputs(category)
  const files = data ?? []

  if (isLoading) return <SkeletonCards />
  if (files.length === 0) return <EmptyState category={category} />

  return (
    <div className="space-y-3">
      {files.map((file) => (
        <OutputCard key={file.path} file={file} />
      ))}
    </div>
  )
}

export default function OutputsView() {
  const [activeTab, setActiveTab] = useState<OutputCategory>('briefings')

  // Per-category counts for the badge indicator
  const briefingsQuery = useOutputs('briefings')
  const meetingsQuery = useOutputs('meetings')
  const reportsQuery = useOutputs('reports')

  const counts: Record<OutputCategory, number | undefined> = {
    briefings: briefingsQuery.data?.length,
    meetings: meetingsQuery.data?.length,
    reports: reportsQuery.data?.length,
  }

  const tabsWithCount = TABS.map((t) => ({
    ...t,
    label:
      counts[t.id] !== undefined
        ? `${t.label} (${counts[t.id]})`
        : t.label,
  }))

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      <SectionHeader
        as="h1"
        kicker="cast outputs"
        title="Outputs"
        icon={<FolderOpen className="w-5 h-5" />}
        description="Agent-generated briefings, meetings, and reports."
      />

      <Tabs
        tabs={tabsWithCount}
        activeTab={activeTab}
        onChange={(id) => setActiveTab(id as OutputCategory)}
        ariaLabel="Output categories"
        idBase="outputs"
        panelClassName="mt-4"
      >
        <CategoryPanel category={activeTab} />
      </Tabs>
    </div>
  )
}
