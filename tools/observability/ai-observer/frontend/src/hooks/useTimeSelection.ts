import { useState, useMemo, useCallback } from 'react'
import {
  TIMEFRAME_OPTIONS,
  isAbsoluteTimeSelection,
  type TimeSelection,
} from '@/types/dashboard'
import { calculateInterval, calculateTickInterval } from '@/lib/timeUtils'
import { getLocalStorageValue } from '@/hooks/useLocalStorage'

interface StoredTimeSelection {
  type: string
  timeframeValue?: string
  from?: string
  to?: string
}

interface UseTimeSelectionOptions {
  /** localStorage key for persisting the selection */
  storageKey: string
  /** URLSearchParams for reading initial URL values */
  searchParams: URLSearchParams
  /** Default timeframe value (default: '7d') */
  defaultTimeframe?: string
}

interface UseTimeSelectionResult {
  /** Current time selection state */
  timeSelection: TimeSelection
  /** Update time selection (also persists to localStorage) */
  setTimeSelection: (selection: TimeSelection) => void
  /** Computed start time based on selection */
  fromTime: Date
  /** Computed end time based on selection */
  toTime: Date
  /** Whether the current selection is an absolute date range */
  isAbsoluteRange: boolean
  /** Interval in seconds for data bucketing (from timeframe or calculated for absolute) */
  intervalSeconds: number
  /** Tick interval for X-axis labels */
  tickInterval: number
}

/**
 * Hook for managing time selection state with localStorage persistence.
 *
 * Loads initial value from: URL params → localStorage → default
 * Persists changes to localStorage automatically.
 *
 * Note: URL param updates are NOT handled by this hook - pages should
 * handle that separately since URL structure varies per page.
 */
export function useTimeSelection({
  storageKey,
  searchParams,
  defaultTimeframe = '7d',
}: UseTimeSelectionOptions): UseTimeSelectionResult {

  // Get initial time selection from URL or localStorage
  const getInitialTimeSelection = (): TimeSelection => {
    // Check for absolute date range in URL
    const fromParam = searchParams.get('from')
    const toParam = searchParams.get('to')
    if (fromParam && toParam) {
      const from = new Date(fromParam)
      const to = new Date(toParam)
      if (!isNaN(from.getTime()) && !isNaN(to.getTime())) {
        const intervalSeconds = calculateInterval(from, to)
        const rangeDays = (to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24)
        const bucketCount = Math.ceil((rangeDays * 86400) / intervalSeconds)
        return {
          type: 'absolute',
          range: {
            from,
            to,
            intervalSeconds,
            tickInterval: calculateTickInterval(bucketCount),
          },
        }
      }
    }

    // Check for relative timeframe in URL or localStorage
    const storedSelection = getLocalStorageValue<StoredTimeSelection | null>(storageKey, null)

    // Check URL param first, then localStorage
    const timeframeParam = searchParams.get('timeframe')
    if (timeframeParam) {
      const timeframe = TIMEFRAME_OPTIONS.find((t) => t.value === timeframeParam)
        || TIMEFRAME_OPTIONS.find((t) => t.value === defaultTimeframe)!
      return { type: 'relative', timeframe }
    }

    // Check localStorage for saved selection
    if (storedSelection) {
      if (storedSelection.type === 'absolute' && storedSelection.from && storedSelection.to) {
        const from = new Date(storedSelection.from)
        const to = new Date(storedSelection.to)
        if (!isNaN(from.getTime()) && !isNaN(to.getTime())) {
          const intervalSeconds = calculateInterval(from, to)
          const rangeDays = (to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24)
          const bucketCount = Math.ceil((rangeDays * 86400) / intervalSeconds)
          return {
            type: 'absolute',
            range: {
              from,
              to,
              intervalSeconds,
              tickInterval: calculateTickInterval(bucketCount),
            },
          }
        }
      } else if (storedSelection.timeframeValue) {
        const timeframe = TIMEFRAME_OPTIONS.find((t) => t.value === storedSelection.timeframeValue)
        if (timeframe) {
          return { type: 'relative', timeframe }
        }
      }
    }

    // Default timeframe
    const timeframe = TIMEFRAME_OPTIONS.find((t) => t.value === defaultTimeframe)!
    return { type: 'relative', timeframe }
  }

  const [timeSelection, setTimeSelectionState] = useState<TimeSelection>(getInitialTimeSelection)

  // Wrapper that also persists to localStorage
  const setTimeSelection = useCallback((selection: TimeSelection) => {
    setTimeSelectionState(selection)

    // Persist to localStorage
    try {
      if (isAbsoluteTimeSelection(selection)) {
        localStorage.setItem(
          storageKey,
          JSON.stringify({
            type: 'absolute',
            from: selection.range.from.toISOString(),
            to: selection.range.to.toISOString(),
          })
        )
      } else {
        localStorage.setItem(
          storageKey,
          JSON.stringify({ type: 'relative', timeframeValue: selection.timeframe.value })
        )
      }
    } catch {
      // Ignore storage errors
    }
  }, [storageKey])

  // Compute from/to times and intervals based on selection
  const { fromTime, toTime, intervalSeconds, tickInterval } = useMemo(() => {
    if (isAbsoluteTimeSelection(timeSelection)) {
      return {
        fromTime: timeSelection.range.from,
        toTime: timeSelection.range.to,
        intervalSeconds: timeSelection.range.intervalSeconds,
        tickInterval: timeSelection.range.tickInterval,
      }
    }
    const now = new Date()
    return {
      fromTime: new Date(now.getTime() - timeSelection.timeframe.durationSeconds * 1000),
      toTime: now,
      intervalSeconds: timeSelection.timeframe.intervalSeconds,
      tickInterval: timeSelection.timeframe.tickInterval,
    }
  }, [timeSelection])

  const isAbsoluteRange = isAbsoluteTimeSelection(timeSelection)

  return {
    timeSelection,
    setTimeSelection,
    fromTime,
    toTime,
    isAbsoluteRange,
    intervalSeconds,
    tickInterval,
  }
}
