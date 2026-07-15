import { Link } from 'react-router-dom'
import { ArrowUpRight } from 'lucide-react'
import { motion } from 'framer-motion'
import { NumberTicker } from './effects/NumberTicker'

interface StatCardProps {
  label: string
  value: number | string
  icon: React.ReactNode
  to?: string
  layoutId?: string
}

function isNumericValue(value: number | string): boolean {
  return typeof value === 'number' || /^\d+\.?\d*$/.test(String(value))
}

export default function StatCard({ label, value, icon, to, layoutId }: StatCardProps) {
  const numericValue = isNumericValue(value) ? Number(value) : null

  const content = (
    <>
      <div className="absolute top-5 right-5 text-[var(--text-muted)] opacity-60" aria-hidden="true">
        {icon}
      </div>
      {numericValue !== null ? (
        <NumberTicker value={numericValue} className="text-3xl font-bold tracking-tight" />
      ) : (
        <span className="text-3xl font-bold tracking-tight">{value}</span>
      )}
      <span className="text-sm text-[var(--text-secondary)]">{label}</span>
      {to && (
        <ArrowUpRight aria-hidden="true" className="absolute bottom-4 right-4 w-3.5 h-3.5 text-[var(--accent)] opacity-0 group-hover:opacity-100 transition-opacity" />
      )}
    </>
  )

  const baseClasses = "h-full border border-[var(--glass-border)] rounded-xl p-6 flex flex-col gap-2 relative overflow-hidden backdrop-blur-sm"

  if (to) {
    const MotionLink = motion.create(Link)
    return (
      <MotionLink
        to={to}
        className={`${baseClasses} group cursor-pointer transition-all duration-200 hover:scale-[1.02] hover:border-[var(--accent)]/30 no-underline`}
        style={{ background: 'linear-gradient(135deg, var(--bg-secondary) 0%, var(--bg-tertiary) 100%)' }}
        layoutId={layoutId}
      >
        {content}
      </MotionLink>
    )
  }

  return (
    <motion.div
      className={baseClasses}
      style={{ background: 'linear-gradient(135deg, var(--bg-secondary) 0%, var(--bg-tertiary) 100%)' }}
      layoutId={layoutId}
    >
      {content}
    </motion.div>
  )
}

export function StatCardSkeleton() {
  return (
    <div className="border border-[var(--glass-border)] rounded-xl p-6 flex flex-col gap-2 animate-pulse" style={{ background: 'linear-gradient(135deg, var(--bg-secondary) 0%, var(--bg-tertiary) 100%)' }}>
      <div className="h-9 w-16 bg-[var(--bg-tertiary)] rounded" />
      <div className="h-4 w-24 bg-[var(--bg-tertiary)] rounded" />
    </div>
  )
}
