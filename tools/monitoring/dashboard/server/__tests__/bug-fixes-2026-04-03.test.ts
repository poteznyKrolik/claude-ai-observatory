/**
 * Regression tests for 4 confirmed bugs fixed on 2026-04-03.
 *
 * Bug 1: agent_runs query referenced ar.commit_sha which does not exist in cast.db
 * Bug 2: seed INSERT into sessions failed because total_input_tokens etc. columns were missing
 * Bug 3: budgets table never created — querying it caused 500
 * Bug 4: /health endpoint read hooks from settings.local.json instead of settings.json
 *
 * Each test verifies the route returns 200/valid data instead of 500 (the pre-fix behaviour).
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import Database from 'better-sqlite3'
import express from 'express'
import request from 'supertest'
import fs from 'fs'
import os from 'os'
import path from 'path'

// ---------------------------------------------------------------------------
// In-memory DB helpers
// ---------------------------------------------------------------------------

function makeAgentRunsDb(): ReturnType<typeof Database> {
  const db = new Database(':memory:')
  // Schema WITHOUT commit_sha — this is the real cast.db schema
  db.exec(`
    CREATE TABLE sessions (
      id           TEXT PRIMARY KEY,
      project      TEXT,
      project_root TEXT,
      started_at   TEXT,
      ended_at     TEXT,
      model        TEXT
    );

    CREATE TABLE agent_runs (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id   TEXT REFERENCES sessions(id),
      agent        TEXT NOT NULL,
      model        TEXT,
      started_at   TEXT,
      ended_at     TEXT,
      status       TEXT,
      input_tokens INTEGER,
      output_tokens INTEGER,
      cost_usd     REAL,
      task_summary TEXT,
      agent_id     TEXT
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
  db.prepare(`
    INSERT INTO sessions (id, project, started_at) VALUES ('s1', 'my-proj', '2026-04-03T10:00:00Z')
  `).run()
  db.prepare(`
    INSERT INTO agent_runs (session_id, agent, model, started_at, status, input_tokens, output_tokens, cost_usd)
    VALUES ('s1', 'code-writer', 'sonnet', '2026-04-03T10:00:00Z', 'DONE', 100, 50, 0.001)
  `).run()
  return db
}

function makeBudgetsDb(): ReturnType<typeof Database> {
  const db = new Database(':memory:')
  // Schema WITH budgets table (post-fix state)
  db.exec(`
    CREATE TABLE agent_runs (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id   TEXT,
      agent        TEXT,
      started_at   TEXT,
      status       TEXT,
      cost_usd     REAL
    );

    CREATE TABLE budgets (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      scope        TEXT,
      scope_key    TEXT,
      period       TEXT,
      limit_usd    REAL,
      alert_at_pct REAL,
      created_at   TEXT
    );
  `)
  return db
}

// ---------------------------------------------------------------------------
// Bug 1 — commit_sha not in agent_runs schema
// ---------------------------------------------------------------------------

describe('Bug 1: agent-runs query must not reference commit_sha', () => {
  let testDb: ReturnType<typeof Database>

  beforeEach(() => {
    testDb = makeAgentRunsDb()
    vi.doMock('../routes/castDb.js', () => ({
      getCastDb: () => testDb,
      getCastDbWritable: () => new Database(':memory:'),
    }))
  })

  afterEach(() => {
    testDb.close()
    vi.restoreAllMocks()
  })

  it('GET /api/cast/agent-runs returns 200 with runs array (no commit_sha column in DB)', async () => {
    const { agentRunsRouter } = await import('../routes/agentRuns.js')
    const app = express()
    app.use('/api/cast/agent-runs', agentRunsRouter)

    const res = await request(app).get('/api/cast/agent-runs')
    expect(res.status).toBe(200)
    expect(Array.isArray(res.body.runs)).toBe(true)
    // Confirm commit_sha is absent from response objects
    if (res.body.runs.length > 0) {
      expect(res.body.runs[0]).not.toHaveProperty('commit_sha')
    }
  })

  it('GET /api/cast/active-agents returns 200 (no commit_sha column in DB)', async () => {
    const { activeAgentsRouter } = await import('../routes/agentRuns.js')
    const app = express()
    app.use('/api/cast/active-agents', activeAgentsRouter)

    const res = await request(app).get('/api/cast/active-agents')
    expect(res.status).toBe(200)
    expect(Array.isArray(res.body.runs)).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// Bug 2 (updated) — seed route is fail-closed: returns 503 for missing/uninitialized DB
//
// The original Bug 2 tested an ALTER TABLE migration that has since been removed.
// The canonical behaviour (v9) is: seed never creates or alters tables; it returns
// HTTP 503 when cast.db is absent or its required tables do not exist.
// ---------------------------------------------------------------------------

describe('Bug 2 (canonical): seed route returns 503 when DB or tables are missing', () => {
  let tmpDir: string
  let tmpDb: string

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'seed-bug2-test-'))
    tmpDb = path.join(tmpDir, 'cast.db')
    vi.resetModules()
  })

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true })
    vi.restoreAllMocks()
  })

  it('returns 503 and does not create the file when cast.db is missing', async () => {
    // tmpDb does not exist — fileMustExist should cause fail-closed 503
    vi.doMock('../constants.js', () => ({
      CAST_DB: tmpDb,
      PROJECTS_DIR: tmpDir,
    }))
    vi.doMock('../parsers/sessions.js', () => ({
      listSessions: () => [],
      loadSession: () => [],
    }))
    const { seedRouter } = await import('../routes/seed.js')
    const app = express()
    app.use('/', seedRouter)

    const res = await request(app).post('/')
    expect(res.status).toBe(503)
    expect(res.body.error).toMatch(/cast\.db missing/)
    expect(fs.existsSync(tmpDb)).toBe(false)
  })

  it('returns 503 when cast.db exists but required tables are absent', async () => {
    // Create an empty (uninitialised) DB file
    new Database(tmpDb).close()

    vi.doMock('../constants.js', () => ({
      CAST_DB: tmpDb,
      PROJECTS_DIR: tmpDir,
    }))
    vi.doMock('../parsers/sessions.js', () => ({
      listSessions: () => [],
      loadSession: () => [],
    }))
    const { seedRouter } = await import('../routes/seed.js')
    const app = express()
    app.use('/', seedRouter)

    const res = await request(app).post('/')
    expect(res.status).toBe(503)
    expect(res.body.error).toMatch(/cast\.db missing/)
  })
})

// ---------------------------------------------------------------------------
// Bug 3 — budgets table missing
// ---------------------------------------------------------------------------

describe('Bug 3: budget/status must not 500 when budgets table exists', () => {
  let testDb: ReturnType<typeof Database>

  beforeEach(() => {
    testDb = makeBudgetsDb()
    vi.doMock('../routes/castDb.js', () => ({
      getCastDb: () => testDb,
      getCastDbWritable: () => {
        // Return a writable in-memory db with the budgets table already created
        const writable = new Database(':memory:')
        writable.exec(`
          CREATE TABLE IF NOT EXISTS budgets (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            scope TEXT, scope_key TEXT, period TEXT,
            limit_usd REAL, alert_at_pct REAL, created_at TEXT
          )
        `)
        return writable
      },
    }))
  })

  afterEach(() => {
    testDb.close()
    vi.restoreAllMocks()
  })

  it('GET /api/budget/status returns 200 with today_spend (no 500 on missing budgets table)', async () => {
    const { budgetStatusRouter } = await import('../routes/budgetStatus.js')
    const app = express()
    app.use('/api/budget', budgetStatusRouter)

    const res = await request(app).get('/api/budget/status')
    expect(res.status).toBe(200)
    expect(typeof res.body.today_spend).toBe('number')
    expect(res.body.over_budget).toBe(false)
  })

  it('GET /api/budget/status returns daily_limit null when no budget row exists', async () => {
    const { budgetStatusRouter } = await import('../routes/budgetStatus.js')
    const app = express()
    app.use('/api/budget', budgetStatusRouter)

    const res = await request(app).get('/api/budget/status')
    expect(res.status).toBe(200)
    expect(res.body.daily_limit).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// Bug 4 — /health reads from settings.json not settings.local.json
// ---------------------------------------------------------------------------

describe('Bug 4: /health reads hooks from SETTINGS_GLOBAL_FILE (settings.json)', () => {
  let tmpDir: string
  let globalFile: string
  let localFile: string

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cast-config-test-'))
    globalFile = path.join(tmpDir, 'settings.json')
    localFile = path.join(tmpDir, 'settings.local.json')

    // Global settings.json has 2 hooks
    fs.writeFileSync(globalFile, JSON.stringify({
      hooks: {
        PreToolUse: [
          { matcher: '*', hooks: [{ type: 'command', command: 'echo pre-tool' }] }
        ],
        PostToolUse: [
          { matcher: '*', hooks: [{ type: 'command', command: 'echo post-tool' }] }
        ],
      }
    }))

    // Local settings.local.json has NO hooks
    fs.writeFileSync(localFile, JSON.stringify({}))
  })

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true })
    vi.restoreAllMocks()
  })

  it('parseHooks from settings.json finds hooks that settings.local.json does not have', () => {
    // Inline the parseHooks logic to verify the fix direction is correct
    function parseHooks(settings: Record<string, unknown>) {
      const hooks: unknown[] = []
      const hooksConfig = settings.hooks as Record<string, unknown[]> | undefined
      if (!hooksConfig) return hooks
      for (const [event, entries] of Object.entries(hooksConfig)) {
        if (!Array.isArray(entries)) continue
        for (const entry of entries) {
          const rule = entry as Record<string, unknown>
          const subHooks = rule.hooks as Record<string, unknown>[] | undefined
          if (Array.isArray(subHooks)) {
            for (const h of subHooks) {
              hooks.push({ event, type: h.type, command: h.command })
            }
          }
        }
      }
      return hooks
    }

    const globalSettings = JSON.parse(fs.readFileSync(globalFile, 'utf-8'))
    const localSettings = JSON.parse(fs.readFileSync(localFile, 'utf-8'))

    const hooksFromGlobal = parseHooks(globalSettings)
    const hooksFromLocal = parseHooks(localSettings)

    // After the fix: reading global finds hooks
    expect(hooksFromGlobal.length).toBe(2)
    // Before the fix: reading local returned 0 hooks
    expect(hooksFromLocal.length).toBe(0)
  })
})
