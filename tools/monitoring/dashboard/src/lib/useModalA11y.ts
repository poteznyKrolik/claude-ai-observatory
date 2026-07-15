import { useEffect, useRef } from 'react'

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'textarea:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',')

/**
 * Accessibility plumbing shared by every hand-rolled modal/dialog:
 *  - moves focus into the dialog when it opens,
 *  - traps Tab / Shift+Tab inside it,
 *  - closes on Escape,
 *  - restores focus to the triggering element on close.
 *
 * Attach the returned ref to the dialog container and pair it with
 * `role="dialog" aria-modal="true" aria-labelledby={titleId}`.
 *
 * `onClose` is read through a ref so the effect runs only on open/close
 * transitions — the modals pass fresh inline closures every render, and
 * depending on `onClose` directly would re-fire the effect (and steal focus)
 * on every parent re-render.
 */
export function useModalA11y<T extends HTMLElement = HTMLDivElement>(
  isOpen: boolean,
  onClose: () => void,
) {
  const containerRef = useRef<T>(null)
  const onCloseRef = useRef(onClose)
  const previouslyFocused = useRef<HTMLElement | null>(null)

  useEffect(() => {
    onCloseRef.current = onClose
  })

  useEffect(() => {
    if (!isOpen) return

    previouslyFocused.current = document.activeElement as HTMLElement | null
    const container = containerRef.current

    const focusable = () =>
      container
        ? Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
            (el) => el.offsetWidth > 0 || el.offsetHeight > 0 || el === document.activeElement,
          )
        : []

    // Move focus into the dialog (first control, else the container itself).
    const first = focusable()[0]
    if (first) {
      first.focus()
    } else if (container) {
      container.setAttribute('tabindex', '-1')
      container.focus()
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onCloseRef.current()
        return
      }
      if (e.key !== 'Tab') return

      const items = focusable()
      if (items.length === 0) {
        e.preventDefault()
        return
      }
      const firstEl = items[0]
      const lastEl = items[items.length - 1]
      const active = document.activeElement

      if (e.shiftKey) {
        if (active === firstEl || !container?.contains(active)) {
          e.preventDefault()
          lastEl.focus()
        }
      } else if (active === lastEl || !container?.contains(active)) {
        e.preventDefault()
        firstEl.focus()
      }
    }

    document.addEventListener('keydown', handleKeyDown, true)
    return () => {
      document.removeEventListener('keydown', handleKeyDown, true)
      previouslyFocused.current?.focus?.()
    }
  }, [isOpen])

  return containerRef
}
