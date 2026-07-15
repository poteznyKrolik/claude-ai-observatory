import type { ReactNode, ElementType } from 'react'

interface SectionHeaderProps {
  /** Small mono uppercase eyebrow above the title (the portfolio's signature detail). */
  kicker?: string
  title: string
  description?: string
  /** Optional leading icon (rendered in accent color). */
  icon?: ReactNode
  /** Heading element to render — defaults to h2. Use h1 for page titles. */
  as?: ElementType
  /** Optional right-aligned actions (filters, buttons). */
  actions?: ReactNode
  className?: string
}

/**
 * Section header with a mono kicker + accent underline — the repeatable header
 * pattern ported from Edward_Kubiak `ui/SectionHeader.jsx` and cast-website.
 */
export default function SectionHeader({
  kicker,
  title,
  description,
  icon,
  as: Heading = 'h2',
  actions,
  className = '',
}: SectionHeaderProps) {
  return (
    <div className={`mb-5 ${className}`}>
      <div className="flex items-start justify-between gap-4">
        <div>
          {kicker && <p className="kicker mb-1.5">{kicker}</p>}
          <div className="flex items-center gap-2.5">
            {icon && (
              <span className="text-[var(--accent)]" aria-hidden="true">
                {icon}
              </span>
            )}
            <Heading className="text-xl font-bold text-[var(--text-primary)] tracking-tight">
              {title}
            </Heading>
          </div>
          {description && (
            <p className="text-sm text-[var(--text-muted)] mt-1">{description}</p>
          )}
        </div>
        {actions && <div className="shrink-0">{actions}</div>}
      </div>
      <div className="mt-3 h-0.5 w-16 rounded-full bg-[var(--accent)]/60" aria-hidden="true" />
    </div>
  )
}
