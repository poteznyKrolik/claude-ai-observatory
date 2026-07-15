/**
 * Tests for src/utils/time.ts
 *
 * Covers:
 * - parseTimestamp: space-format → ISO UTC conversion; ISO passthrough; fractional seconds
 * - timeAgo: relative output sanity on a fixed reference
 * - formatTimeOfDay: space-format input renders correctly
 */

import { describe, it, expect, vi, afterEach } from 'vitest'
import { parseTimestamp, timeAgo, formatTimeOfDay } from './time.js'

// ---------------------------------------------------------------------------
// parseTimestamp
// ---------------------------------------------------------------------------

describe('parseTimestamp', () => {
  it('converts space-format (no zone) to ISO UTC', () => {
    expect(parseTimestamp('2026-07-02 18:54:34')).toBe('2026-07-02T18:54:34Z')
  })

  it('handles fractional seconds in space-format', () => {
    expect(parseTimestamp('2026-07-02 18:54:34.123')).toBe('2026-07-02T18:54:34.123Z')
  })

  it('passes ISO string with T and Z through unchanged', () => {
    const iso = '2026-06-29T21:31:45.681Z'
    expect(parseTimestamp(iso)).toBe(iso)
  })

  it('passes ISO string with T and no Z through unchanged', () => {
    const iso = '2026-06-29T21:31:45'
    expect(parseTimestamp(iso)).toBe(iso)
  })

  it('does not double-append Z if input already ends with Z', () => {
    // Space-format with trailing Z would be unusual but must not get a double Z
    // The regex requires no suffix after the optional .fff, so this passes through
    const weirdInput = '2026-07-02 18:54:34Z'
    // Not matched by the strict regex (has trailing Z) → passthrough
    expect(parseTimestamp(weirdInput)).toBe(weirdInput)
  })

  it('passes unrelated strings through unchanged', () => {
    expect(parseTimestamp('not-a-date')).toBe('not-a-date')
    expect(parseTimestamp('')).toBe('')
  })

  it('produces a valid Date from space-format (no UTC offset error)', () => {
    const converted = parseTimestamp('2026-07-02 00:00:00')
    const d = new Date(converted)
    expect(d.getTime()).not.toBeNaN()
    // Should parse as UTC midnight, not local midnight
    expect(d.getUTCFullYear()).toBe(2026)
    expect(d.getUTCMonth()).toBe(6) // July = 6
    expect(d.getUTCDate()).toBe(2)
    expect(d.getUTCHours()).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// timeAgo — relative output on a fixed reference
// ---------------------------------------------------------------------------

describe('timeAgo', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns "just now" for a timestamp in the future', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-02T10:00:00Z'))
    expect(timeAgo('2026-07-02T10:00:01Z')).toBe('just now')
  })

  it('returns "just now" for a timestamp <60s ago', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-02T10:00:30Z'))
    expect(timeAgo('2026-07-02T10:00:00Z')).toBe('just now')
  })

  it('returns "Xm ago" for a timestamp 3 minutes ago', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-02T10:03:00Z'))
    expect(timeAgo('2026-07-02T10:00:00Z')).toBe('3m ago')
  })

  it('returns "Xh ago" for a timestamp 2 hours ago', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-02T12:00:00Z'))
    expect(timeAgo('2026-07-02T10:00:00Z')).toBe('2h ago')
  })

  it('returns "Yesterday" for a timestamp 25 hours ago', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-03T11:00:00Z'))
    expect(timeAgo('2026-07-02T10:00:00Z')).toBe('Yesterday')
  })

  it('accepts SQLite space-format and parses as UTC (no local-time artifact)', () => {
    vi.useFakeTimers()
    // Set "now" to 2h after the space-format timestamp (interpreted as UTC)
    vi.setSystemTime(new Date('2026-07-02T20:54:34Z'))
    // space-format: 2026-07-02 18:54:34 (UTC) → 2h ago
    expect(timeAgo('2026-07-02 18:54:34')).toBe('2h ago')
  })

  it('accepts fractional space-format', () => {
    vi.useFakeTimers()
    // Set now 2h 5m after the space-format timestamp so floor(diffMs/3600000) == 2
    vi.setSystemTime(new Date('2026-07-02T21:00:00.000Z'))
    // 2026-07-02 18:54:34.123 UTC → 2h 5m 25.877s ago → '2h ago'
    expect(timeAgo('2026-07-02 18:54:34.123')).toBe('2h ago')
  })
})

// ---------------------------------------------------------------------------
// formatTimeOfDay — space-format renders correctly
// ---------------------------------------------------------------------------

describe('formatTimeOfDay', () => {
  it('returns empty string for null', () => {
    expect(formatTimeOfDay(null)).toBe('')
  })

  it('returns a non-empty string for an ISO timestamp', () => {
    const result = formatTimeOfDay('2026-07-02T18:54:34Z')
    expect(result).toBeTruthy()
    expect(typeof result).toBe('string')
  })

  it('returns a non-empty string for a space-format timestamp', () => {
    const result = formatTimeOfDay('2026-07-02 18:54:34')
    expect(result).toBeTruthy()
    expect(typeof result).toBe('string')
  })
})
