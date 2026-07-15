/**
 * Normalizes a timestamp string for safe Date construction.
 *
 * SQLite's datetime('now') returns space-format (e.g. '2026-07-02 18:54:34', no zone
 * marker). Browsers and Node parse space-format as LOCAL time, not UTC — causing
 * "in X hours" artifacts on UTC-offset machines. This helper converts space-format to
 * ISO UTC ('T' separator + 'Z' suffix) so Date construction is always interpreted as UTC.
 *
 * ISO strings (containing 'T') and epoch numbers (via .toISOString()) pass through
 * unchanged. Handles the fractional-seconds variant ('2026-07-02 18:54:34.123').
 */
export function parseTimestamp(ts: string): string {
  // Match space-format with no zone suffix: 'YYYY-MM-DD HH:MM:SS' or 'YYYY-MM-DD HH:MM:SS.fff'
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}(\.\d+)?$/.test(ts)) {
    return ts.replace(' ', 'T') + 'Z'
  }
  return ts
}

/**
 * Returns a relative time string like "2h ago", "3d ago", "just now".
 * Accepts an ISO date string or SQLite space-format UTC string.
 */
export function timeAgo(date: string): string {
  const now = Date.now()
  const then = new Date(parseTimestamp(date)).getTime()
  const diffMs = now - then

  if (diffMs < 0) return 'just now'

  const seconds = Math.floor(diffMs / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)
  const weeks = Math.floor(days / 7)

  if (seconds < 60) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  if (hours < 24) return `${hours}h ago`
  if (days === 1) return 'Yesterday'
  if (days < 7) return `${days}d ago`
  if (weeks < 5) return `${weeks}w ago`

  return new Date(parseTimestamp(date)).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

/**
 * Formats an ISO timestamp as a locale time string (HH:MM:SS).
 * Returns '' for null/invalid input.
 */
export function formatTimeOfDay(iso: string | null): string {
  if (!iso) return ''
  try {
    return new Date(parseTimestamp(iso)).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  } catch { return '' }
}

/**
 * Formats a duration in milliseconds as "Xm Ys" or "Xh Ym".
 * Accepts null (returns '--').
 */
export function formatDuration(ms: number | null): string {
  if (ms === null) return '--'
  if (ms < 0) return '0s'
  if (ms < 1000) return '<1s'

  const totalSeconds = Math.floor(ms / 1000)
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60

  if (hours > 0) return `${hours}h ${minutes}m`
  if (minutes > 0) return `${minutes}m ${seconds}s`
  return `${seconds}s`
}
