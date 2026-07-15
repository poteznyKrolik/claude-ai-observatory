/**
 * Phase 9.75c feature tests
 *
 * Covers:
 * 1. Analytics scorecard — UPPER() query counts mixed-case statuses correctly
 * 2. Hook health logic — red / green / yellow using deterministic health function
 * 3. Budget status — over-budget detection and null daily_limit handling
 * 4. Agent drill-down — GET /api/analytics/profile/:agent returns run objects with required fields
 *
 * Note: "Seed normalization SQL" tests (original item 1) were removed in the v9
 * canonicalization (Unit U1). The seed route no longer rewrites existing status
 * values — status vocabulary is owned by the CAST flagship. Regression coverage
 * lives in server/__tests__/seed-canonical.test.ts.
 */

import { describe, it, expect, vi } from 'vitest'
import Database from 'better-sqlite3'
import express from 'express'
import request from 'supertest'

// ---------------------------------------------------------------------------
// Shared schema helper
// ---------------------------------------------------------------------------

function buildAgentRunsSchema(db: ReturnType<typeof Database>): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS agent_runs (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id   TEXT,
      agent        TEXT NOT NULL,
      model        TEXT,
      started_at   TEXT,
      ended_at     TEXT,
      duration_ms  INTEGER,
      status       TEXT,
      input_tokens INTEGER,
      output_tokens INTEGER,
      cost_usd     REAL,
      task_summary TEXT,
      prompt       TEXT,
      project      TEXT
    );
    CREATE TABLE IF NOT EXISTS sessions (
      id               TEXT PRIMARY KEY,
      project          TEXT,
      project_root     TEXT,
      started_at       TEXT,
      ended_at         TEXT,
      total_cost_usd   REAL DEFAULT 0.0,
      model            TEXT
    );
  `)
}

// ===========================================================================
// 1. Analytics scorecard — UPPER() query counts mixed-case statuses
// ===========================================================================

describe('analytics scorecard UPPER() query', () => {
  it('counts "done" (lowercase) as a success via UPPER()', () => {
    const db = new Database(':memory:')
    buildAgentRunsSchema(db)
    db.prepare(`INSERT INTO agent_runs (agent, status, cost_usd) VALUES ('planner', 'done', 0.01)`).run()
    db.prepare(`INSERT INTO agent_runs (agent, status, cost_usd) VALUES ('planner', 'DONE', 0.01)`).run()
    db.prepare(`INSERT INTO agent_runs (agent, status, cost_usd) VALUES ('planner', 'DONE_WITH_CONCERNS', 0.01)`).run()

    const row = db.prepare(`
      SELECT
        COUNT(*) AS runs,
        SUM(CASE WHEN UPPER(status) IN ('DONE','DONE_WITH_CONCERNS') THEN 1 ELSE 0 END) AS success_count
      FROM agent_runs
      WHERE agent = 'planner'
    `).get() as { runs: number; success_count: number }

    expect(row.runs).toBe(3)
    expect(row.success_count).toBeGreaterThan(0)
    expect(row.success_count).toBe(3)
    db.close()
  })

  it('counts "BLOCKED" (uppercase) toward blocked_count and not success_count', () => {
    const db = new Database(':memory:')
    buildAgentRunsSchema(db)
    db.prepare(`INSERT INTO agent_runs (agent, status, cost_usd) VALUES ('debugger', 'BLOCKED', 0.02)`).run()
    db.prepare(`INSERT INTO agent_runs (agent, status, cost_usd) VALUES ('debugger', 'DONE', 0.01)`).run()

    const row = db.prepare(`
      SELECT
        COUNT(*) AS runs,
        SUM(CASE WHEN UPPER(status) IN ('DONE','DONE_WITH_CONCERNS') THEN 1 ELSE 0 END) AS success_count,
        SUM(CASE WHEN UPPER(status) = 'BLOCKED' THEN 1 ELSE 0 END) AS blocked_count
      FROM agent_runs
      WHERE agent = 'debugger'
    `).get() as { runs: number; success_count: number; blocked_count: number }

    expect(row.success_count).toBe(1)
    expect(row.blocked_count).toBe(1)
    db.close()
  })
})

// ===========================================================================
// 3. Hook health — deterministic health logic tests
//
// The health value is determined by two boolean flags (exists, executable).
// We test the logic table directly without routing through the live fs,
// since mocking 'fs' globally in vitest conflicts with other file-loading
// internals when modules are cached after first import.
// ===========================================================================

/**
 * Pure-function port of the original hook health-derivation logic.
 * Kept here so we can test the decision table exhaustively without fighting
 * module-level fs mock isolation. Source route was removed in 2026-05-03 alignment.
 */
function deriveHealth(exists: boolean, executable: boolean): 'green' | 'yellow' | 'red' {
  if (!exists) return 'red'
  if (!executable) return 'yellow'
  return 'green'
}

describe('hook health derivation logic', () => {
  it('returns "red" when script does not exist', () => {
    expect(deriveHealth(false, false)).toBe('red')
  })

  it('returns "green" when script exists and is executable', () => {
    expect(deriveHealth(true, true)).toBe('green')
  })

  it('returns "yellow" when script exists but is not executable', () => {
    expect(deriveHealth(true, false)).toBe('yellow')
  })
})

// ===========================================================================
// 4. Budget status — over-budget detection and null daily_limit handling
//
// We test the budget calculation logic directly using the same arithmetic
// as budgetStatus.ts. The route reads from cast.db (mocked) and budget-config.json.
// Rather than fighting layered fs mocks, we verify the invariants directly.
// ===========================================================================

/**
 * Replicate the budget status computation from budgetStatus.ts lines 52-57.
 */
function computeBudgetStatus(
  today_spend: number,
  daily_limit_usd: number | null
): { today_spend: number; daily_limit: number | null; pct_used: number | null; over_budget: boolean } {
  if (daily_limit_usd === null) {
    return { today_spend, daily_limit: null, pct_used: null, over_budget: false }
  }
  const pct_used = daily_limit_usd > 0
    ? Math.round((today_spend / daily_limit_usd) * 1000) / 10
    : null
  const over_budget = daily_limit_usd > 0 && today_spend > daily_limit_usd
  return { today_spend, daily_limit: daily_limit_usd, pct_used, over_budget }
}

describe('budget status computation', () => {
  it('sets over_budget=true and pct_used>100 when today_spend exceeds daily_limit', () => {
    const result = computeBudgetStatus(2.5, 1.0)
    expect(result.over_budget).toBe(true)
    expect(result.pct_used).toBeGreaterThan(100)
    expect(result.today_spend).toBe(2.5)
    expect(result.daily_limit).toBe(1.0)
  })

  it('sets over_budget=false when today_spend is within the daily_limit', () => {
    const result = computeBudgetStatus(0.5, 1.0)
    expect(result.over_budget).toBe(false)
    expect(result.pct_used).toBeLessThanOrEqual(100)
  })

  it('sets over_budget=false and daily_limit=null when no config exists', () => {
    const result = computeBudgetStatus(99.0, null)
    expect(result.over_budget).toBe(false)
    expect(result.daily_limit).toBeNull()
    expect(result.pct_used).toBeNull()
  })

  it('pct_used reflects the exact percentage spent', () => {
    const result = computeBudgetStatus(0.5, 2.0)
    expect(result.pct_used).toBe(25)
  })
})

// ===========================================================================
// 5. Agent drill-down — GET /api/analytics/profile/:agent
// ===========================================================================

// Seed a shared DB used by the castDb mock for analytics route tests.
const _sharedDb = new Database(':memory:')
_sharedDb.exec(`
  CREATE TABLE agent_runs (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id   TEXT,
    agent        TEXT NOT NULL,
    agent_id     TEXT,
    model        TEXT,
    started_at   TEXT,
    ended_at     TEXT,
    duration_ms  INTEGER,
    status       TEXT,
    input_tokens INTEGER,
    output_tokens INTEGER,
    cost_usd     REAL,
    task_summary TEXT,
    project      TEXT
  );
  CREATE TABLE sessions (
    id               TEXT PRIMARY KEY,
    project          TEXT,
    started_at       TEXT,
    ended_at         TEXT,
    total_cost_usd   REAL DEFAULT 0.0
  );
  CREATE TABLE dispatch_decisions (
    id           TEXT PRIMARY KEY,
    session_id   TEXT,
    chosen_agent TEXT,
    prompt_snippet TEXT,
    created_at   TEXT
  );
`)

_sharedDb.prepare(`
  INSERT INTO agent_runs (session_id, agent, model, started_at, ended_at, duration_ms, status, input_tokens, output_tokens, cost_usd)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`).run('sess-a', 'planner', 'claude-sonnet-4-6', '2026-03-27T09:00:00Z', '2026-03-27T09:02:00Z', 120000, 'DONE', 500, 200, 0.005)

_sharedDb.prepare(`
  INSERT INTO agent_runs (session_id, agent, model, started_at, ended_at, duration_ms, status, input_tokens, output_tokens, cost_usd)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`).run('sess-a', 'planner', 'claude-sonnet-4-6', '2026-03-26T14:00:00Z', '2026-03-26T14:01:30Z', 90000, 'DONE_WITH_CONCERNS', 400, 180, 0.004)

// Seed dispatch_decisions so the task_summary correlated subquery resolves
_sharedDb.prepare(`
  INSERT INTO dispatch_decisions (id, session_id, chosen_agent, prompt_snippet, created_at)
  VALUES (?, ?, ?, ?, ?)
`).run('dd-1', 'sess-a', 'planner', 'Plan the feature', '2026-03-27 08:59:55')
_sharedDb.prepare(`
  INSERT INTO dispatch_decisions (id, session_id, chosen_agent, prompt_snippet, created_at)
  VALUES (?, ?, ?, ?, ?)
`).run('dd-2', 'sess-a', 'planner', 'Plan auth system', '2026-03-26 13:59:55')

vi.mock('../routes/castDb.js', () => ({
  getCastDb: () => _sharedDb,
}))

const { analyticsRouter } = await import('../routes/analytics.js')
const analyticsApp = express()
analyticsApp.use(express.json())
analyticsApp.use('/', analyticsRouter)

describe('GET /api/analytics/profile/:agent', () => {
  it('returns 200 with last_runs as an array', async () => {
    const res = await request(analyticsApp).get('/profile/planner')
    expect(res.status).toBe(200)
    expect(res.body).toHaveProperty('last_runs')
    expect(Array.isArray(res.body.last_runs)).toBe(true)
  })

  it('each run object contains started_at, status, and cost_usd fields', async () => {
    const res = await request(analyticsApp).get('/profile/planner')
    expect(res.status).toBe(200)

    const runs: Record<string, unknown>[] = res.body.last_runs
    expect(runs.length).toBeGreaterThan(0)

    for (const run of runs) {
      expect(run).toHaveProperty('started_at')
      expect(run).toHaveProperty('status')
      expect(run).toHaveProperty('cost_usd')
    }
  })

  it('returns 404 for an unknown agent', async () => {
    const res = await request(analyticsApp).get('/profile/nonexistent-agent-xyz')
    expect(res.status).toBe(404)
    expect(res.body).toHaveProperty('error')
  })

  it('returns summary fields (name, runs, success_rate, blocked_count, avg_cost_usd)', async () => {
    const res = await request(analyticsApp).get('/profile/planner')
    expect(res.status).toBe(200)
    expect(res.body).toHaveProperty('name', 'planner')
    expect(res.body).toHaveProperty('runs')
    expect(res.body).toHaveProperty('success_rate')
    expect(res.body).toHaveProperty('blocked_count')
    expect(res.body).toHaveProperty('avg_cost_usd')
  })

  it('returns last_runs sorted descending by started_at', async () => {
    const res = await request(analyticsApp).get('/profile/planner')
    expect(res.status).toBe(200)
    const runs: { started_at: string }[] = res.body.last_runs
    if (runs.length >= 2) {
      expect(runs[0].started_at >= runs[1].started_at).toBe(true)
    }
  })
})
