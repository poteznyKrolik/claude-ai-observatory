// Shared chart utilities and constants

export const CHART_COLORS = [
  '#3b82f6', // blue
  '#10b981', // emerald
  '#f59e0b', // amber
  '#ef4444', // red
  '#8b5cf6', // violet
  '#ec4899', // pink
  '#14b8a6', // teal
  '#f97316', // orange
]

// Compact tooltip styling for dashboard widgets
export const compactTooltipStyle = {
  contentStyle: {
    backgroundColor: 'hsl(var(--background) / 0.85)',
    backdropFilter: 'blur(8px)',
    WebkitBackdropFilter: 'blur(8px)',
    border: '1px solid hsl(var(--border))',
    borderRadius: '6px',
    fontSize: '11px',
    padding: '6px 8px',
    boxShadow: '0 4px 12px hsl(var(--foreground) / 0.1)',
  },
  itemStyle: { fontSize: '11px', padding: '1px 0' },
  labelStyle: {
    fontSize: '11px',
    fontWeight: 500,
    marginBottom: '4px',
  },
}

// Standard tooltip styling for full-page charts
export const standardTooltipStyle = {
  contentStyle: {
    backgroundColor: 'hsl(var(--background) / 0.85)',
    backdropFilter: 'blur(8px)',
    WebkitBackdropFilter: 'blur(8px)',
    border: '1px solid hsl(var(--border))',
    borderRadius: '6px',
    fontSize: '14px',
    padding: '8px 12px',
    boxShadow: '0 4px 12px hsl(var(--foreground) / 0.1)',
  },
  itemStyle: { fontSize: '14px', padding: '2px 0' },
  labelStyle: {
    fontSize: '14px',
    fontWeight: 500,
    marginBottom: '4px',
  },
}

// Axis styling for compact charts
export const compactAxisStyle = {
  stroke: 'var(--color-muted-foreground)',
  axisLine: { stroke: 'var(--color-muted-foreground)', strokeWidth: 1 },
  tickLine: { stroke: 'var(--color-muted-foreground)', strokeWidth: 1 },
}

// Common series data type
export interface ChartSeries {
  key: string
  label: string
}

// Common props interface for metric charts
export interface MetricChartProps {
  data: Array<Record<string, unknown>>
  series: ChartSeries[]
  colorMap: Map<string, string>
  formatYAxis: (value: number) => string
  tooltipFormatter: (value: number | undefined, name: string | undefined) => [string, string]
  xAxisInterval?: number
  compact?: boolean
  showLegend?: boolean
  stacked?: boolean
}
