import { ScrollText } from 'lucide-react'
import { useWorkLogStream } from '../api/useWorkLogStream'
import WorkLogFeed from '../components/WorkLogFeed'
import SectionHeader from '../components/SectionHeader'

export default function WorkLogView() {
  const { data, isLoading, error } = useWorkLogStream({ limit: 50 })

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      <SectionHeader
        as="h1"
        kicker="agent stream"
        title="Work Log"
        icon={<ScrollText className="w-5 h-5" />}
        description="Live stream of agent activity — work logs, status, and truncation events."
      />

      {/* Feed */}
      <WorkLogFeed
        entries={data?.entries ?? []}
        isLoading={isLoading}
        error={error}
      />
    </div>
  )
}
