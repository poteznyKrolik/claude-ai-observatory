import { create } from 'zustand'
import type { Span } from '@/types/traces'
import type { MetricDataPoint } from '@/types/metrics'
import type { LogRecord } from '@/types/logs'

interface TelemetryState {
  // Real-time data buffers
  recentSpans: Span[]
  recentMetrics: MetricDataPoint[]
  recentLogs: LogRecord[]

  // Update counters (always increment, used to trigger refreshes)
  spansUpdateCount: number
  metricsUpdateCount: number
  logsUpdateCount: number

  // Actions
  addSpans: (spans: Span[]) => void
  addMetrics: (metrics: MetricDataPoint[]) => void
  addLogs: (logs: LogRecord[]) => void
  clearRecentData: () => void
  clearRecentLogs: () => void
  clearRecentSpans: () => void
}

const MAX_RECENT_ITEMS = 10000

export const useTelemetryStore = create<TelemetryState>((set) => ({
  recentSpans: [],
  recentMetrics: [],
  recentLogs: [],
  spansUpdateCount: 0,
  metricsUpdateCount: 0,
  logsUpdateCount: 0,

  addSpans: (spans) =>
    set((state) => ({
      recentSpans: [...spans, ...state.recentSpans].slice(0, MAX_RECENT_ITEMS),
      spansUpdateCount: state.spansUpdateCount + 1,
    })),

  addMetrics: (metrics) =>
    set((state) => ({
      recentMetrics: [...metrics, ...state.recentMetrics].slice(0, MAX_RECENT_ITEMS),
      metricsUpdateCount: state.metricsUpdateCount + 1,
    })),

  addLogs: (logs) =>
    set((state) => ({
      recentLogs: [...logs, ...state.recentLogs].slice(0, MAX_RECENT_ITEMS),
      logsUpdateCount: state.logsUpdateCount + 1,
    })),

  clearRecentData: () =>
    set({
      recentSpans: [],
      recentMetrics: [],
      recentLogs: [],
    }),

  clearRecentLogs: () =>
    set({
      recentLogs: [],
    }),

  clearRecentSpans: () =>
    set({
      recentSpans: [],
    }),
}))
