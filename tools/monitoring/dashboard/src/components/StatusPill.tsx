type Tone = 'live' | 'success' | 'warning' | 'danger' | 'neutral'

const TONE: Record<Tone, { dot: string; text: string; border: string; bg: string }> = {
  live:    { dot: 'bg-[var(--accent)]',     text: 'text-[var(--accent)]',     border: 'border-[var(--accent)]/30', bg: 'bg-[var(--accent)]/10' },
  success: { dot: 'bg-emerald-400',         text: 'text-emerald-400',         border: 'border-emerald-500/30',     bg: 'bg-emerald-500/10' },
  warning: { dot: 'bg-amber-400',           text: 'text-amber-400',           border: 'border-amber-500/30',       bg: 'bg-amber-500/10' },
  danger:  { dot: 'bg-rose-400',            text: 'text-rose-400',            border: 'border-rose-500/30',        bg: 'bg-rose-500/10' },
  neutral: { dot: 'bg-[var(--text-muted)]', text: 'text-[var(--text-muted)]', border: 'border-[var(--border)]',    bg: 'bg-[var(--bg-tertiary)]' },
}

/** Map a CAST status/state string to a semantic tone. */
function toneFor(status: string): Tone {
  const s = status.toLowerCase()
  if (['running', 'in_progress', 'active', 'live', 'dispatched'].includes(s)) return 'live'
  if (['done', 'completed', 'pass', 'passed', 'success', 'ok'].includes(s)) return 'success'
  if (s.includes('concern') || ['warning', 'warn', 'retry', 'pending', 'queued'].includes(s)) return 'warning'
  if (['blocked', 'failed', 'fail', 'error', 'abandoned', 'killed'].includes(s)) return 'danger'
  return 'neutral'
}

interface StatusPillProps {
  status: string
  /** Override the computed tone. */
  tone?: Tone
  /** Override the displayed label (defaults to the status text). */
  label?: string
  /** Force the pulsing dot on/off (defaults: on for the `live` tone). */
  pulse?: boolean
  className?: string
}

/**
 * Pulse-dot status pill ported from the portfolio/cast-website hero status
 * indicator. Use for agent run states, live-connection, gate pass/fail, etc.
 */
export default function StatusPill({ status, tone, label, pulse, className = '' }: StatusPillProps) {
  const t = tone ?? toneFor(status)
  const c = TONE[t]
  const showPulse = pulse ?? t === 'live'

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium ${c.border} ${c.bg} ${c.text} ${className}`}
    >
      <span className="relative flex h-1.5 w-1.5" aria-hidden="true">
        {showPulse && (
          <span
            className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-75 motion-reduce:animate-none ${c.dot}`}
          />
        )}
        <span className={`relative inline-flex h-1.5 w-1.5 rounded-full ${c.dot}`} />
      </span>
      {label ?? status}
    </span>
  )
}
