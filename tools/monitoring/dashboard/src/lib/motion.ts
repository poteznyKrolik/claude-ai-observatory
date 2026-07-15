import type { Variants } from 'framer-motion'

/**
 * Canonical CAST motion language — shared with cast-website (`src/lib/motion.ts`)
 * and the Edward_Kubiak portfolio. Use these variants for view/section entrances
 * instead of ad-hoc CSS transitions so motion feels consistent across the app.
 *
 * All entrances are gated by the app-level <MotionConfig reducedMotion="user">
 * in App.tsx, so they auto-disable under prefers-reduced-motion.
 */

/** The signature easing curve — a soft, confident ease-out. */
export const easeOutQuint = [0.22, 1, 0.36, 1] as const

/** A single item fading up into place. */
export const fadeUpItem: Variants = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: easeOutQuint } },
}

/** Parent that staggers its children's entrance. */
export const staggerContainer: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06 } },
}

/** A card/panel revealing on scroll-into-view. */
export const cardReveal: Variants = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.45, ease: easeOutQuint } },
}

/** Standard whileInView viewport config — fire once, slightly before fully visible. */
export const inViewOnce = { once: true, margin: '-60px' } as const
