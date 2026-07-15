import type { ReactNode } from 'react'

interface TerminalPanelProps {
  /** Optional title shown in the window chrome bar. */
  title?: string
  children: ReactNode
  className?: string
  /** Class applied to the scrollable body (e.g. max-height). */
  bodyClassName?: string
}

/**
 * macOS-style terminal panel: traffic-light chrome dots over a dark surface,
 * mono body. Ported from cast-website `TerminalDemo.tsx` — use for log/output
 * surfaces (WorkLog feed, hook failures, live output).
 */
export default function TerminalPanel({ title, children, className = '', bodyClassName = '' }: TerminalPanelProps) {
  return (
    <div
      className={`overflow-hidden rounded-[var(--radius-card)] border border-[var(--glass-border)] bg-[var(--terminal-bg)] ${className}`}
    >
      <div className="flex items-center gap-2 border-b border-[var(--glass-border)] bg-[var(--bg-tertiary)] px-3 py-2">
        <span className="flex gap-1.5" aria-hidden="true">
          <span className="h-3 w-3 rounded-full" style={{ background: 'var(--chrome-red)' }} />
          <span className="h-3 w-3 rounded-full" style={{ background: 'var(--chrome-yellow)' }} />
          <span className="h-3 w-3 rounded-full" style={{ background: 'var(--chrome-green)' }} />
        </span>
        {title && (
          <span className="ml-1 truncate font-mono text-xs text-[var(--text-muted)]">{title}</span>
        )}
      </div>
      <div className={`overflow-x-auto p-4 font-mono text-sm text-[var(--text-secondary)] ${bodyClassName}`}>
        {children}
      </div>
    </div>
  )
}
