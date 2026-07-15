/**
 * Canonical seed behaviour tests (Unit U1 — v9 schema canonicalization).
 *
 * Asserts:
 * (i)  POST /api/cast/seed against a canonical-shape temp DB performs NO schema
 *      change (pragma table_info identical before/after) and inserts only canonical columns.
 * (ii) Seed against a missing/uninitialized DB path returns 503 and does NOT create the file.
 * (iii) Status values in agent_runs are untouched by seeding (dashboard does not own
 *       status vocabulary).
 *
 * Each test calls vi.resetModules() so the seed route's module-level lastSeedAt
 * starts at 0, avoiding the 60-second cooldown between tests.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import Database from 'better-sqlite3'
import express from 'express'
import request from 'supertest'
import fs from 'fs'
import os from 'os'
import path from 'path'

// ---------------------------------------------------------------------------
// Canonical-schema helper — matches the columns cast-db-init.sh creates
// ---------------------------------------------------------------------------

function makeCanonicalDb(dbPath: string): ReturnType<typeof Database> {
  const db = new Database(dbPath)
  db.exec(`
    CREATE TABLE sessions (
      id           TEXT PRIMARY KEY,
      project      TEXT,
      project_root TEXT,
      started_at   TEXT,
      ended_at     TEXT,
      status       TEXT,
      deleted_at   TEXT
    );

    CREATE TABLE agent_runs (
      id                          INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id                  TEXT REFERENCES sessions(id),
      agent                       TEXT NOT NULL,
      model                       TEXT,
      started_at                  TEXT,
      ended_at                    TEXT,
      status                      TEXT,
      input_tokens                INTEGER,
      output_tokens               INTEGER,
      cost_usd                    REAL,
      agent_id                    TEXT,
      response                    TEXT,
      cache_read_input_tokens     INTEGER,
      cache_creation_input_tokens INTEGER,
      owns_files                  INTEGER,
      duration_ms                 INTEGER,
      tool_uses                   INTEGER,
      abandoned_at                TEXT,
      branch                      TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_agent_runs_session ON agent_runs(session_id);
    CREATE INDEX IF NOT EXISTS idx_agent_runs_agent   ON agent_runs(agent);
  `)
  return db
}

function getColumnNames(db: ReturnType<typeof Database>, table: string): string[] {
  const rows = db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[]
  return rows.map(r => r.name).sort()
}

// ---------------------------------------------------------------------------

describe('POST /api/cast/seed — canonical schema (Unit U1)', () => {
  let tmpDir: string
  let tmpDb: string

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'seed-canonical-'))
    tmpDb = path.join(tmpDir, 'cast.db')
    vi.resetModules()
  })

  afterEach(() => {
    vi.restoreAllMocks()
    fs.rmSync(tmpDir, { recursive: true, force: true })
  })

  // -------------------------------------------------------------------------
  // (ii) Missing DB → 503, no file created
  // -------------------------------------------------------------------------

  it('(ii) returns 503 and does NOT create cast.db when the file is missing', async () => {
    // tmpDb does not exist yet
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
    expect(res.body).toHaveProperty('error')
    expect(res.body.error).toMatch(/cast\.db missing/)
    expect(fs.existsSync(tmpDb)).toBe(false)
  })

  it('(ii) returns 503 when cast.db exists but sessions/agent_runs tables are absent', async () => {
    // Exist but empty (no tables)
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

  // -------------------------------------------------------------------------
  // (i) Canonical DB → 200, schema unchanged before/after
  // -------------------------------------------------------------------------

  it('(i) performs no schema change when seeding against a canonical DB', async () => {
    const db = makeCanonicalDb(tmpDb)
    const sessionsBefore = getColumnNames(db, 'sessions')
    const runsBefore = getColumnNames(db, 'agent_runs')
    db.close()

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
    expect(res.status).toBe(200)
    expect(res.body).toHaveProperty('seeded')

    const db2 = new Database(tmpDb, { readonly: true })
    const sessionsAfter = getColumnNames(db2, 'sessions')
    const runsAfter = getColumnNames(db2, 'agent_runs')
    db2.close()

    expect(sessionsAfter).toEqual(sessionsBefore)
    expect(runsAfter).toEqual(runsBefore)
  })

  it('(i) inserts only canonical columns into sessions (no total_input_tokens/model)', async () => {
    const db = makeCanonicalDb(tmpDb)
    db.close()

    vi.doMock('../constants.js', () => ({
      CAST_DB: tmpDb,
      PROJECTS_DIR: tmpDir,
    }))
    vi.doMock('../parsers/sessions.js', () => ({
      listSessions: () => [{
        id: 'sess-canon-1',
        project: 'test-proj',
        projectPath: '/test/path',
        projectEncoded: 'test-proj',
        startedAt: '2026-07-02T10:00:00Z',
        endedAt: '2026-07-02T11:00:00Z',
        inputTokens: 1000,
        outputTokens: 500,
        model: 'sonnet',
      }],
      loadSession: () => [],
    }))

    const { seedRouter } = await import('../routes/seed.js')
    const app = express()
    app.use('/', seedRouter)

    await request(app).post('/')

    const db2 = new Database(tmpDb, { readonly: true })
    const row = db2.prepare(`SELECT * FROM sessions WHERE id = 'sess-canon-1'`).get() as Record<string, unknown>
    db2.close()

    expect(row).toBeDefined()
    // Canonical columns present
    expect(row).toHaveProperty('id', 'sess-canon-1')
    expect(row).toHaveProperty('project', 'test-proj')
    expect(row).toHaveProperty('project_root', '/test/path')
    // Non-canonical columns must NOT have been inserted by seed
    expect(row).not.toHaveProperty('total_input_tokens')
    expect(row).not.toHaveProperty('total_output_tokens')
    expect(row).not.toHaveProperty('total_cost_usd')
    expect(row).not.toHaveProperty('model')
  })

  // -------------------------------------------------------------------------
  // (iii) Status values in agent_runs are untouched by seeding
  // -------------------------------------------------------------------------

  it('(iii) does not modify existing status values in agent_runs', async () => {
    const db = makeCanonicalDb(tmpDb)
    db.prepare(`INSERT INTO sessions (id, project, started_at) VALUES ('s1', 'p', '2026-07-02T00:00:00Z')`).run()
    // Insert rows with non-standard casing that the old seed would have rewritten
    db.prepare(`INSERT INTO agent_runs (session_id, agent, status) VALUES ('s1', 'code-writer', 'done')`).run()
    db.prepare(`INSERT INTO agent_runs (session_id, agent, status) VALUES ('s1', 'debugger', 'failed')`).run()
    db.prepare(`INSERT INTO agent_runs (session_id, agent, status) VALUES ('s1', 'planner', 'DONE_WITH_CONCERNS')`).run()
    db.close()

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
    expect(res.status).toBe(200)

    const db2 = new Database(tmpDb, { readonly: true })
    const rows = db2.prepare(
      `SELECT agent, status FROM agent_runs ORDER BY id`
    ).all() as { agent: string; status: string }[]
    db2.close()

    // Statuses must be exactly as inserted — seed must not rewrite them
    expect(rows.find(r => r.agent === 'code-writer')?.status).toBe('done')
    expect(rows.find(r => r.agent === 'debugger')?.status).toBe('failed')
    expect(rows.find(r => r.agent === 'planner')?.status).toBe('DONE_WITH_CONCERNS')
  })
})
