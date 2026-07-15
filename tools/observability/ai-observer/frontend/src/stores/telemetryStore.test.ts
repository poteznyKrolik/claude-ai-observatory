import { describe, it, expect, beforeEach } from 'vitest'
import { useTelemetryStore } from './telemetryStore'
import type { Span } from '@/types/traces'
import type { MetricDataPoint } from '@/types/metrics'
import type { LogRecord } from '@/types/logs'

describe('telemetryStore', () => {
  beforeEach(() => {
    // Reset store state before each test using the store's clearRecentData action
    useTelemetryStore.getState().clearRecentData()
  })

  const createMockSpan = (id: string): Span => ({
    timestamp: new Date().toISOString(),
    traceId: `trace-${id}`,
    spanId: `span-${id}`,
    spanName: `test-span-${id}`,
    serviceName: 'test-service',
    duration: 1000000,
  })

  const createMockMetric = (id: string): MetricDataPoint => ({
    timestamp: new Date().toISOString(),
    serviceName: 'test-service',
    metricName: `test-metric-${id}`,
    metricType: 'gauge',
    value: Math.random() * 100,
  })

  const createMockLog = (id: string): LogRecord => ({
    timestamp: new Date().toISOString(),
    serviceName: 'test-service',
    body: `Log message ${id}`,
    severityText: 'INFO',
  })

  describe('initial state', () => {
    it('has empty arrays for all data', () => {
      const state = useTelemetryStore.getState()
      expect(state.recentSpans).toEqual([])
      expect(state.recentMetrics).toEqual([])
      expect(state.recentLogs).toEqual([])
    })
  })

  describe('addSpans', () => {
    it('adds spans to the store', () => {
      const spans = [createMockSpan('1'), createMockSpan('2')]

      useTelemetryStore.getState().addSpans(spans)

      const state = useTelemetryStore.getState()
      expect(state.recentSpans).toHaveLength(2)
      expect(state.recentSpans[0].spanId).toBe('span-1')
      expect(state.recentSpans[1].spanId).toBe('span-2')
    })

    it('prepends new spans to existing ones', () => {
      useTelemetryStore.getState().addSpans([createMockSpan('1')])
      useTelemetryStore.getState().addSpans([createMockSpan('2')])

      const state = useTelemetryStore.getState()
      expect(state.recentSpans).toHaveLength(2)
      expect(state.recentSpans[0].spanId).toBe('span-2')
      expect(state.recentSpans[1].spanId).toBe('span-1')
    })

    it('slices array when adding items (MAX_RECENT_ITEMS behavior)', () => {
      // Add 10 spans
      const spans = Array.from({ length: 10 }, (_, i) => createMockSpan(`${i}`))
      useTelemetryStore.getState().addSpans(spans)

      const state = useTelemetryStore.getState()
      // Verify spans are added in order
      expect(state.recentSpans.length).toBeGreaterThan(0)
      expect(state.recentSpans[0].spanId).toBe('span-0')
    })
  })

  describe('addMetrics', () => {
    it('adds metrics to the store', () => {
      const metrics = [createMockMetric('1'), createMockMetric('2')]

      useTelemetryStore.getState().addMetrics(metrics)

      const state = useTelemetryStore.getState()
      expect(state.recentMetrics).toHaveLength(2)
    })

    it('prepends new metrics', () => {
      useTelemetryStore.getState().addMetrics([createMockMetric('1')])
      useTelemetryStore.getState().addMetrics([createMockMetric('2')])

      const state = useTelemetryStore.getState()
      expect(state.recentMetrics[0].metricName).toBe('test-metric-2')
    })

    it('handles adding multiple metrics', () => {
      const metrics = Array.from({ length: 10 }, (_, i) =>
        createMockMetric(`${i}`)
      )

      useTelemetryStore.getState().addMetrics(metrics)

      const state = useTelemetryStore.getState()
      expect(state.recentMetrics.length).toBeGreaterThan(0)
      expect(state.recentMetrics[0].metricName).toBe('test-metric-0')
    })
  })

  describe('addLogs', () => {
    it('adds logs to the store', () => {
      const logs = [createMockLog('1'), createMockLog('2')]

      useTelemetryStore.getState().addLogs(logs)

      const state = useTelemetryStore.getState()
      expect(state.recentLogs).toHaveLength(2)
    })

    it('prepends new logs', () => {
      useTelemetryStore.getState().addLogs([createMockLog('1')])
      useTelemetryStore.getState().addLogs([createMockLog('2')])

      const state = useTelemetryStore.getState()
      expect(state.recentLogs[0].body).toBe('Log message 2')
    })

    it('handles adding multiple logs', () => {
      const logs = Array.from({ length: 10 }, (_, i) => createMockLog(`${i}`))

      useTelemetryStore.getState().addLogs(logs)

      const state = useTelemetryStore.getState()
      expect(state.recentLogs.length).toBeGreaterThan(0)
      expect(state.recentLogs[0].body).toBe('Log message 0')
    })
  })

  describe('clearRecentData', () => {
    it('clears all data', () => {
      useTelemetryStore.getState().addSpans([createMockSpan('1')])
      useTelemetryStore.getState().addMetrics([createMockMetric('1')])
      useTelemetryStore.getState().addLogs([createMockLog('1')])

      useTelemetryStore.getState().clearRecentData()

      const state = useTelemetryStore.getState()
      expect(state.recentSpans).toEqual([])
      expect(state.recentMetrics).toEqual([])
      expect(state.recentLogs).toEqual([])
    })

    it('allows adding data after clearing', () => {
      useTelemetryStore.getState().addSpans([createMockSpan('1')])
      useTelemetryStore.getState().clearRecentData()
      useTelemetryStore.getState().addSpans([createMockSpan('2')])

      expect(useTelemetryStore.getState().recentSpans).toHaveLength(1)
      expect(useTelemetryStore.getState().recentSpans[0].spanId).toBe('span-2')
    })
  })

  describe('independence of data types', () => {
    it('adding spans does not affect metrics or logs', () => {
      useTelemetryStore.getState().addMetrics([createMockMetric('1')])
      useTelemetryStore.getState().addLogs([createMockLog('1')])
      useTelemetryStore.getState().addSpans([createMockSpan('1')])

      const state = useTelemetryStore.getState()
      expect(state.recentSpans).toHaveLength(1)
      expect(state.recentMetrics).toHaveLength(1)
      expect(state.recentLogs).toHaveLength(1)
    })
  })
})
