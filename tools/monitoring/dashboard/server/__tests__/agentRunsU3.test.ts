/**
 * Unit U3 regression tests — agent-runs canonical-strict batch A.
 *
 * Covers three bugs fixed in U3:
 *   1. Active-agents dedup: PARTITION BY agent_id instead of (agent, 5-min bucket)
 *      — a running row must NOT be suppressed when a DONE row for the same agent
 *      type (but different agent_id) shares the old time bucket.
 *   2. Recency filter: unixepoch() comparison replaces broken lexicographic
 *      datetime() comparison (ISO-T vs space-format mismatch).
 *   3. task_summary: correlated subquery against dispatch_decisions resolves
 *      prompt_snippet with space-format created_at; runs without a match → null.
 *
 * All tests use temp fixture DBs (never ~/.claude/cast.db).
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import Database from 'better-sqlite3'
import express from 'express'
import request from 'supertest'

// ---------------------------------------------------------------------------
// Fixture DB factory — canonical schema (no prompt, no project on agent_runs)
// ---------------------------------------------------------------------------

function makeFixtureDb(): ReturnType<typeof Database> {
  const db = new Database(':memory:')
  db.exec(`
    CREATE TABLE sessions (
      id           TEXT PRIMARY KEY,
      project      TEXT,
      project_root TEXT,
      started_at   TEXT,
      ended_at     TEXT
    );

    CREATE TABLE agent_runs (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id   TEXT REFERENCES sessions(id),
      agent        TEXT NOT NULL,
      model        TEXT,
      started_at   TEXT,
      ended_at     TEXT,
      status       TEXT,
      input_tokens INTEGER DEFAULT 0,
      output_tokens INTEGER DEFAULT 0,
      cost_usd     REAL DEFAULT 0,
      agent_id     TEXT,
      response     TEXT,
      duration_ms  INTEGER,
      tool_uses    INTEGER DEFAULT 0
    );

    CREATE TABLE dispatch_decisions (
      id           TEXT PRIMARY KEY,
      session_id   TEXT,
      chosen_agent TEXT,
      prompt_snippet TEXT,
      model        TEXT,
      effort       TEXT,
      wave_id      TEXT,
      parallel     INTEGER DEFAULT 0,
      created_at   TEXT,
      outcome      TEXT
    );
  `)
  db.prepare(`INSERT INTO sessions (id, project, started_at) VALUES ('s1', 'test-proj', '2026-07-02T10:00:00Z')`).run()
  return db
}

// ---------------------------------------------------------------------------
// Bug 1 — active-agents dedup: PARTITION BY agent_id, not (agent, time bucket)
// ---------------------------------------------------------------------------

describe('Bug 1: active-agents dedup — running row not suppressed by same-bucket DONE', () => {
  let db: ReturnType<typeof Database>

  beforeEach(() => {
    vi.resetModules()
    db = makeFixtureDb()
    // Both rows: same agent type, same 5-min time bucket, but DIFFERENT agent_ids
    // started_at is ISO-T format, within the 15-minute recency window
    db.prepare(`
      INSERT INTO agent_runs (session_id, agent, model, started_at, status, agent_id)
      VALUES ('s1', 'code-writer', 'sonnet',
        strftime('%Y-%m-%dT%H:%M:%SZ', datetime('now', '-3 minutes')),
        'running', 'aid-run-1')
    `).run()
    db.prepare(`
      INSERT INTO agent_runs (session_id, agent, model, started_at, ended_at, status, agent_id)
      VALUES ('s1', 'code-writer', 'sonnet',
        strftime('%Y-%m-%dT%H:%M:%SZ', datetime('now', '-4 minutes')),
        strftime('%Y-%m-%dT%H:%M:%SZ', datetime('now', '-2 minutes')),
        'DONE', 'aid-run-2')
    `).run()

    vi.doMock('../routes/castDb.js', () => ({ getCastDb: () => db }))
  })

  afterEach(() => {
    db.close()
    vi.restoreAllMocks()
  })

  it('returns the running row even when a DONE row for the same agent type exists in the bucket', async () => {
    const { activeAgentsRouter } = await import('../routes/agentRuns.js')
    const app = express()
    app.use('/', activeAgentsRouter)

    const res = await request(app).get('/')
    expect(res.status).toBe(200)
    expect(Array.isArray(res.body.runs)).toBe(true)

    const runningRow = res.body.runs.find((r: { status: string; agent: string }) =>
      r.status === 'running' && r.agent === 'code-writer'
    )
    expect(runningRow, 'running code-writer row must appear (not suppressed by DONE row)').toBeDefined()
  })
})

// ---------------------------------------------------------------------------
// Bug 2 — recency filter uses unixepoch() for ISO-T vs space-format safety
// ---------------------------------------------------------------------------

describe('Bug 2: recency filter — ISO-T timestamps inside/outside 15 min', () => {
  let db: ReturnType<typeof Database>

  beforeEach(() => {
    vi.resetModules()
    db = makeFixtureDb()
    // Recent: 5 min ago — should appear
    db.prepare(`
      INSERT INTO agent_runs (session_id, agent, model, started_at, status, agent_id)
      VALUES ('s1', 'debugger', 'sonnet',
        strftime('%Y-%m-%dT%H:%M:%SZ', datetime('now', '-5 minutes')),
        'running', 'aid-recent')
    `).run()
    // Stale: 30 min ago — must NOT appear
    db.prepare(`
      INSERT INTO agent_runs (session_id, agent, model, started_at, status, agent_id)
      VALUES ('s1', 'researcher', 'haiku',
        strftime('%Y-%m-%dT%H:%M:%SZ', datetime('now', '-30 minutes')),
        'running', 'aid-stale')
    `).run()

    vi.doMock('../routes/castDb.js', () => ({ getCastDb: () => db }))
  })

  afterEach(() => {
    db.close()
    vi.restoreAllMocks()
  })

  it('returns the row started 5 min ago', async () => {
    const { activeAgentsRouter } = await import('../routes/agentRuns.js')
    const app = express()
    app.use('/', activeAgentsRouter)

    const res = await request(app).get('/')
    expect(res.status).toBe(200)

    const recent = res.body.runs.find((r: { agent: string }) => r.agent === 'debugger')
    expect(recent, 'row started 5 min ago must be visible').toBeDefined()
  })

  it('excludes the row started 30 min ago', async () => {
    const { activeAgentsRouter } = await import('../routes/agentRuns.js')
    const app = express()
    app.use('/', activeAgentsRouter)

    const res = await request(app).get('/')
    expect(res.status).toBe(200)

    const stale = res.body.runs.find((r: { agent: string }) => r.agent === 'researcher')
    expect(stale, 'row started 30 min ago must be excluded').toBeUndefined()
  })
})

// ---------------------------------------------------------------------------
// Bug 3 — task_summary correlated subquery (space-format dispatch_decisions.created_at)
// ---------------------------------------------------------------------------

describe('Bug 3: task_summary from dispatch_decisions (space-format created_at)', () => {
  let db: ReturnType<typeof Database>

  beforeEach(() => {
    vi.resetModules()
    db = makeFixtureDb()
    // Run with a matching dispatch_decisions row (space-format created_at, within 60s)
    db.prepare(`
      INSERT INTO agent_runs (session_id, agent, model, started_at, status, agent_id)
      VALUES ('s1', 'planner', 'sonnet', '2026-07-02T10:01:00Z', 'DONE', 'aid-plan-1')
    `).run()
    // dispatch_decisions.created_at in space-format (canonical CAST v9 write format)
    // 30s before started_at → within the 60s window
    db.prepare(`
      INSERT INTO dispatch_decisions (id, session_id, chosen_agent, prompt_snippet, created_at)
      VALUES ('dd-1', 's1', 'planner', 'Build feature X', '2026-07-02 10:00:30')
    `).run()

    // Run WITHOUT a matching dispatch_decisions row (different agent)
    db.prepare(`
      INSERT INTO agent_runs (session_id, agent, model, started_at, status, agent_id)
      VALUES ('s1', 'researcher', 'haiku', '2026-07-02T10:01:00Z', 'DONE', 'aid-res-1')
    `).run()

    vi.doMock('../routes/castDb.js', () => ({ getCastDb: () => db }))
  })

  afterEach(() => {
    db.close()
    vi.restoreAllMocks()
  })

  it('resolves task_summary from dispatch_decisions for a matching run', async () => {
    const { agentRunsRouter } = await import('../routes/agentRuns.js')
    const app = express()
    app.use('/', agentRunsRouter)

    const res = await request(app).get('/?agent=planner')
    expect(res.status).toBe(200)
    expect(Array.isArray(res.body.runs)).toBe(true)
    expect(res.body.runs.length).toBeGreaterThanOrEqual(1)

    const plannerRun = res.body.runs.find((r: { agent: string }) => r.agent === 'planner')
    expect(plannerRun?.task_summary).toBe('Build feature X')
  })

  it('returns null task_summary when no dispatch_decisions row matches', async () => {
    const { agentRunsRouter } = await import('../routes/agentRuns.js')
    const app = express()
    app.use('/', agentRunsRouter)

    const res = await request(app).get('/?agent=researcher')
    expect(res.status).toBe(200)
    expect(Array.isArray(res.body.runs)).toBe(true)
    expect(res.body.runs.length).toBeGreaterThanOrEqual(1)

    const researcherRun = res.body.runs.find((r: { agent: string }) => r.agent === 'researcher')
    expect(researcherRun?.task_summary).toBeNull()
  })
})
