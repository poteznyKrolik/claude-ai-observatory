import { useTheme } from '../state/themeState'

/** Theme-aware series colors for Recharts SVG presentation attributes.
 *  Call inside each component that renders chart series — not at module level,
 *  because hooks must run in component scope. */
export function useChartColors() {
  const { theme } = useTheme()
  const l = theme === 'light'
  return {
    mint:     l ? '#0A7A60' : '#00FFC2',
    mintDim:  l ? 'rgba(10,122,96,0.25)' : 'rgba(0,255,194,0.3)',
    amber:    l ? '#B45309' : '#F59E0B',
    amberDim: l ? 'rgba(180,83,9,0.25)' : 'rgba(245,158,11,0.3)',
    purple:   l ? '#7C3AED' : '#A78BFA',
    blue:     l ? '#2563EB' : '#60A5FA',
    rose:     l ? '#B91C1C' : '#FB7185',
    gray:     '#6B7280',
    success:  l ? '#047857' : '#34D399',
    error:    l ? '#B91C1C' : '#F87171',
    chart4:   l ? '#D97706' : '#FBBF24',
    barTrack: l ? '#E7ECF3' : '#1e293b',
  }
}
