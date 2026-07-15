import { useRef } from 'react'
import type { ComponentType, KeyboardEvent, ReactNode } from 'react'

export interface TabItem {
  id: string
  label: string
  icon?: ComponentType<{ className?: string; 'aria-hidden'?: boolean }>
}

interface TabsProps {
  tabs: TabItem[]
  activeTab: string
  onChange: (id: string) => void
  /** Accessible name for the tablist — required (WCAG 4.1.2). */
  ariaLabel: string
  /** Unique prefix used to wire tab ids ↔ the panel's aria-labelledby. */
  idBase: string
  variant?: 'underline' | 'pill'
  size?: 'xs' | 'sm'
  /** Tab panel content, rendered inside a wired role="tabpanel". */
  children?: ReactNode
  /** Extra classes for the tablist container. */
  className?: string
  /** Extra classes for the tab panel. */
  panelClassName?: string
}

/**
 * Accessible tab bar implementing the WAI-ARIA Tabs pattern:
 * role="tablist"/"tab"/"tabpanel", aria-selected, roving tabindex, and
 * ArrowLeft/Right/Up/Down + Home/End keyboard navigation.
 *
 * Uses MANUAL activation (arrow keys move focus only; Enter/Space/click
 * selects) — the safe choice because several consumers mount data-fetching
 * panels, so automatic activation would fire a burst of requests while a
 * keyboard user arrows across the bar.
 */
export default function Tabs({
  tabs,
  activeTab,
  onChange,
  ariaLabel,
  idBase,
  variant = 'underline',
  size = 'sm',
  children,
  className = '',
  panelClassName = '',
}: TabsProps) {
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([])

  function handleKeyDown(e: KeyboardEvent<HTMLButtonElement>, index: number) {
    const count = tabs.length
    let next = -1
    switch (e.key) {
      case 'ArrowRight':
      case 'ArrowDown':
        next = (index + 1) % count
        break
      case 'ArrowLeft':
      case 'ArrowUp':
        next = (index - 1 + count) % count
        break
      case 'Home':
        next = 0
        break
      case 'End':
        next = count - 1
        break
      default:
        return
    }
    e.preventDefault()
    tabRefs.current[next]?.focus()
  }

  const sizeCls = size === 'xs' ? 'text-xs' : 'text-sm'
  const listCls =
    variant === 'pill'
      ? 'flex gap-1 p-1 rounded-lg bg-[var(--bg-secondary)] w-fit'
      : 'flex border-b border-[var(--border)] overflow-x-auto'

  return (
    <>
      <div role="tablist" aria-label={ariaLabel} aria-orientation="horizontal" className={`${listCls} ${className}`}>
        {tabs.map((tab, i) => {
          const selected = tab.id === activeTab
          const Icon = tab.icon
          const base = `relative flex items-center gap-1.5 font-medium transition-colors whitespace-nowrap focus-visible:z-10 ${sizeCls}`
          const variantCls =
            variant === 'pill'
              ? `px-3 py-1.5 rounded-md ${
                  selected
                    ? 'bg-[var(--accent)] text-[var(--primary-foreground)] shadow-sm'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`
              : `px-4 py-2 border-b-2 -mb-px ${
                  selected
                    ? 'border-[var(--accent)] text-[var(--accent)]'
                    : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
                }`
          return (
            <button
              key={tab.id}
              ref={(el) => {
                tabRefs.current[i] = el
              }}
              id={`${idBase}-tab-${tab.id}`}
              role="tab"
              type="button"
              aria-selected={selected}
              aria-controls={`${idBase}-panel`}
              tabIndex={selected ? 0 : -1}
              onClick={() => onChange(tab.id)}
              onKeyDown={(e) => handleKeyDown(e, i)}
              className={`${base} ${variantCls}`}
            >
              {Icon && <Icon className="w-3.5 h-3.5" aria-hidden={true} />}
              {tab.label}
            </button>
          )
        })}
      </div>
      {children !== undefined && (
        <div
          role="tabpanel"
          id={`${idBase}-panel`}
          aria-labelledby={`${idBase}-tab-${activeTab}`}
          className={panelClassName}
        >
          {children}
        </div>
      )}
    </>
  )
}
