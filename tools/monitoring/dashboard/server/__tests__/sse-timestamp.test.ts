/**
 * SSE stale-reconciliation timestamp comparison tests (U5)
 *
 * Validates that the SQL used in server/watchers/sse.ts for the stale-reconcile
 * query correctly includes/excludes agent_runs rows when ended_at contains
 * ISO-8601 timestamps ('T'/'Z') vs SQLite space-format timestamps (no zone marker).
 *
 * Background: lexicographic comparison of ISO ('T'=0x54) against space-format
 * (' '=0x20) is broken — the old `ended_at > datetime('now','-2 hours')` query
 * treated all same-day ISO timestamps as "inside the window" regardless of actual
 * time. The fix wraps both sides in unixepoch().
 *
 * All tests use in-memory SQLite (never ~/.claude/cast.db).
 */

import { describe, it, expect, beforeEach } from 'vitest'
import Database from 'better-sqlite3'

// ---------------------------------------------------------------------------
// The exact SQL fragment from server/watchers/sse.ts (stale reconciliation)
// ---------------------------------------------------------------------------

const STALE_RECONCILE_SQL = `
  SELECT DISTINCT session_id
  FROM agent_runs
  WHERE status IN ('DONE','DONE_WITH_CONCERNS','BLOCKED','NEEDS_CONTEXT','failed','stale')
    AND ended_at IS NOT NULL
    AND unixepoch(ended_at) > unixepoch('now', '-2 hours')
`

// ---------------------------------------------------------------------------
// Fixture DB factory
// ---------------------------------------------------------------------------

function makeFixtureDb(): ReturnType<typeof Database> {
  const db = new Database(':memory:')
  db.exec(`
    CREATE TABLE sessions (
      id TEXT PRIMARY KEY
    );
    CREATE TABLE agent_runs (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id TEXT NOT NULL,
      agent      TEXT NOT NULL,
      status     TEXT,
      started_at TEXT,
      ended_at   TEXT
    );
  `)
  return db
}

// ---------------------------------------------------------------------------
// Helper: insert an agent_run row with an explicit ended_at string
// ---------------------------------------------------------------------------

function insertRun(
  db: ReturnType<typeof Database>,
  sessionId: string,
  status: string,
  endedAt: string | null
) {
  db.prepare(`
    INSERT INTO agent_runs (session_id, agent, status, started_at, ended_at)
    VALUES (?, 'code-writer', ?, datetime('now', '-90 minutes'), ?)
  `).run(sessionId, status, endedAt)
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('SSE stale-reconcile SQL — unixepoch() comparison', () => {
  let db: ReturnType<typeof Database>

  beforeEach(() => {
    db = makeFixtureDb()
  })

  it('includes an ISO-format ended_at inside the 2-hour window', () => {
    // ended_at 30 minutes ago (ISO format, with T and Z)
    const thirtyMinsAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString()
    insertRun(db, 's-iso-inside', 'DONE', thirtyMinsAgo)

    const rows = db.prepare(STALE_RECONCILE_SQL).all() as Array<{ session_id: string }>
    expect(rows.map(r => r.session_id)).toContain('s-iso-inside')
  })

  it('excludes an ISO-format ended_at outside the 2-hour window', () => {
    // ended_at 3 hours ago (ISO format)
    const threeHoursAgo = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString()
    insertRun(db, 's-iso-outside', 'DONE', threeHoursAgo)

    const rows = db.prepare(STALE_RECONCILE_SQL).all() as Array<{ session_id: string }>
    expect(rows.map(r => r.session_id)).not.toContain('s-iso-outside')
  })

  it('includes a space-format ended_at (SQLite native) inside the 2-hour window', () => {
    // SQLite datetime('now', '-30 minutes') returns space-format
    db.prepare(`
      INSERT INTO agent_runs (session_id, agent, status, started_at, ended_at)
      VALUES ('s-space-inside', 'code-writer', 'DONE', datetime('now', '-90 minutes'), datetime('now', '-30 minutes'))
    `).run()

    const rows = db.prepare(STALE_RECONCILE_SQL).all() as Array<{ session_id: string }>
    expect(rows.map(r => r.session_id)).toContain('s-space-inside')
  })

  it('excludes a space-format ended_at outside the 2-hour window', () => {
    db.prepare(`
      INSERT INTO agent_runs (session_id, agent, status, started_at, ended_at)
      VALUES ('s-space-outside', 'code-writer', 'DONE', datetime('now', '-4 hours'), datetime('now', '-3 hours'))
    `).run()

    const rows = db.prepare(STALE_RECONCILE_SQL).all() as Array<{ session_id: string }>
    expect(rows.map(r => r.session_id)).not.toContain('s-space-outside')
  })

  it('excludes rows with null ended_at', () => {
    insertRun(db, 's-null-ended', 'DONE', null)

    const rows = db.prepare(STALE_RECONCILE_SQL).all() as Array<{ session_id: string }>
    expect(rows.map(r => r.session_id)).not.toContain('s-null-ended')
  })

  it('excludes rows with non-terminal status (running)', () => {
    const recentIso = new Date(Date.now() - 10 * 60 * 1000).toISOString()
    insertRun(db, 's-running', 'running', recentIso)

    const rows = db.prepare(STALE_RECONCILE_SQL).all() as Array<{ session_id: string }>
    expect(rows.map(r => r.session_id)).not.toContain('s-running')
  })

  it('returns DISTINCT session_ids (multiple runs for same session)', () => {
    const recentIso = new Date(Date.now() - 10 * 60 * 1000).toISOString()
    // Two runs for the same session
    insertRun(db, 's-multi', 'DONE', recentIso)
    insertRun(db, 's-multi', 'DONE_WITH_CONCERNS', recentIso)

    const rows = db.prepare(STALE_RECONCILE_SQL).all() as Array<{ session_id: string }>
    const ids = rows.map(r => r.session_id).filter(id => id === 's-multi')
    expect(ids).toHaveLength(1)
  })

  it('ISO inside window beats space-format bound — the key cross-format case', () => {
    // This was broken with the old datetime() comparison:
    // ISO '2026-07-02T10:00:00Z' vs space-format '2026-07-02 08:00:00'
    // 'T' (0x54) > ' ' (0x20), so ISO was always "greater" regardless of actual time.
    // With unixepoch(), comparison is correct.

    // Insert one row clearly inside (30m ago ISO) and one clearly outside (3h ago ISO)
    const inside = new Date(Date.now() - 30 * 60 * 1000).toISOString()
    const outside = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString()
    insertRun(db, 's-cross-inside', 'DONE', inside)
    insertRun(db, 's-cross-outside', 'DONE', outside)

    const rows = db.prepare(STALE_RECONCILE_SQL).all() as Array<{ session_id: string }>
    const ids = rows.map(r => r.session_id)
    expect(ids).toContain('s-cross-inside')
    expect(ids).not.toContain('s-cross-outside')
  })
})
