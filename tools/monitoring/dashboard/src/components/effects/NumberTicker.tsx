import { useEffect, useRef } from 'react'
import { useInView, motionValue, animate, useReducedMotion } from 'framer-motion'

interface NumberTickerProps {
  value: number
  decimalPlaces?: number
  prefix?: string
  suffix?: string
  className?: string
}

export function NumberTicker({ value, decimalPlaces = 0, prefix = '', suffix = '', className }: NumberTickerProps) {
  const ref = useRef<HTMLSpanElement>(null)
  const isInView = useInView(ref, { once: true, margin: '0px 0px -50px 0px' })
  const reduced = useReducedMotion()

  useEffect(() => {
    if (!isInView || !ref.current) return
    const finalText = prefix + value.toFixed(decimalPlaces) + suffix
    // Respect prefers-reduced-motion: skip the count-up, show the value instantly.
    if (reduced) {
      ref.current.textContent = finalText
      return
    }
    const mv = motionValue(0)
    const controls = animate(mv, value, {
      duration: 1.4,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (v) => {
        if (ref.current) {
          ref.current.textContent = prefix + v.toFixed(decimalPlaces) + suffix
        }
      },
    })
    return () => controls.stop()
  }, [isInView, value, decimalPlaces, prefix, suffix, reduced])

  return <span ref={ref} className={className}>{prefix}0{suffix}</span>
}
