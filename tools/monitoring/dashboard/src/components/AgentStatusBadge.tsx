interface AgentStatusBadgeProps {
  status: string
  className?: string
}

/**
 * Renders a color-coded badge for an agent status string.
 * Handles: DONE, DONE_WITH_CONCERNS, BLOCKED, NEEDS_CONTEXT, IN_PROGRESS, RUNNING.
 */
export default function AgentStatusBadge({ status, className = '' }: AgentStatusBadgeProps) {
  const s = status?.toUpperCase() ?? ''
  let colors = 'bg-zinc-500/20 text-zinc-400 border-zinc-500/30'

  if (s === 'DONE') colors = 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
  else if (s === 'DONE_WITH_CONCERNS') colors = 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30'
  else if (s === 'BLOCKED') colors = 'bg-rose-500/20 text-rose-300 border-rose-500/30'
  else if (s === 'NEEDS_CONTEXT') colors = 'bg-blue-500/20 text-blue-300 border-blue-500/30'
  else if (s === 'IN_PROGRESS' || s === 'RUNNING') colors = 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30'

  return (
    <span
      className={`inline-block px-2 py-0.5 rounded-full border text-[10px] font-medium ${colors} ${className}`}
    >
      {status ?? 'unknown'}
    </span>
  )
}
