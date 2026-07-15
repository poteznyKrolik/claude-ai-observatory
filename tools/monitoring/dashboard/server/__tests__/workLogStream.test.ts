import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import Database from 'better-sqlite3'
import express from 'express'
import request from 'supertest'

// Test database
let testDb: ReturnType<typeof Database> | null = null

function createTestDb(options: { hasResponseCol?: boolean; hasTruncTable?: boolean } = {}): ReturnType<typeof Database> {
  const db = new Database(':memory:')

  // Build agent_runs schema based on test options.
  // agent_id is required for the new agent_id-keyed truncation join (avoids fan-out).
  let agentRunsSchema = `
    CREATE TABLE agent_runs (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id   TEXT,
      agent        TEXT NOT NULL,
      model        TEXT,
      started_at   TEXT,
      status       TEXT,
      agent_id     TEXT
  `

  if (options.hasResponseCol !== false) {
    agentRunsSchema += `,
      response     TEXT`
  }

  agentRunsSchema += `
    );
  `

  db.exec(agentRunsSchema)

  // dispatch_decisions needed for the task_summary correlated subquery
  db.exec(`
    CREATE TABLE dispatch_decisions (
      id           TEXT PRIMARY KEY,
      session_id   TEXT,
      chosen_agent TEXT,
      prompt_snippet TEXT,
      created_at   TEXT
    );
  `)

  // Create agent_truncations table with agent_id column if requested
  if (options.hasTruncTable !== false) {
    db.exec(`
      CREATE TABLE agent_truncations (
        id                  INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id          TEXT,
        agent_type          TEXT,
        agent_id            TEXT,
        timestamp           TEXT,
        partial_work_log    TEXT,
        has_status          INTEGER
      );
    `)
  }

  // Seed test data — agent_id values used for the new truncation join
  let insertSql = `
    INSERT INTO agent_runs (id, session_id, agent, model, started_at, status, agent_id`
  if (options.hasResponseCol !== false) {
    insertSql += `, response`
  }
  insertSql += `) VALUES`

  if (options.hasResponseCol !== false) {
    insertSql += `
      (1, 'sess-1', 'code-writer', 'sonnet', '2026-04-04T10:00:00Z', 'DONE', 'ar-001', 'Status: DONE\n\n## Work Log\n- Read: foo.ts\n- Wrote: bar.ts'),
      (2, 'sess-1', 'test-writer', 'haiku', '2026-04-04T10:05:00Z', 'DONE', 'ar-002', 'Status: DONE\n\n## Work Log\n- Read: src/app.test.ts'),
      (3, 'sess-2', 'code-reviewer', 'haiku', '2026-04-04T10:10:00Z', 'DONE', 'ar-003', NULL),
      (4, 'sess-2', 'debugger', 'sonnet', '2026-04-04T10:15:00Z', 'DONE_WITH_CONCERNS', 'ar-004', 'Status: DONE_WITH_CONCERNS\n\n## Work Log\n- Decision: found the bug\n- Wrote: fix.ts')`
  } else {
    insertSql += `
      (1, 'sess-1', 'code-writer', 'sonnet', '2026-04-04T10:00:00Z', 'DONE', 'ar-001'),
      (2, 'sess-1', 'test-writer', 'haiku', '2026-04-04T10:05:00Z', 'DONE', 'ar-002'),
      (3, 'sess-2', 'code-reviewer', 'haiku', '2026-04-04T10:10:00Z', 'DONE', 'ar-003'),
      (4, 'sess-2', 'debugger', 'sonnet', '2026-04-04T10:15:00Z', 'DONE_WITH_CONCERNS', 'ar-004')`
  }

  db.prepare(insertSql).run()

  // Seed agent_truncations keyed on agent_id — matches run 3 (code-reviewer, agent_id='ar-003')
  if (options.hasTruncTable !== false) {
    db.prepare(`
      INSERT INTO agent_truncations (session_id, agent_type, agent_id, timestamp, partial_work_log, has_status)
      VALUES
        ('sess-2', 'code-reviewer', 'ar-003', '2026-04-04T10:10:30Z', '- Partial work logged before truncation', 0)
    `).run()
  }

  return db
}

// Mock getCastDb before importing routes
vi.mock('../routes/castDb.js', () => ({
  getCastDb: () => testDb,
}))

const { workLogStreamRouter } = await import('../routes/workLogStream.js')

const app = express()
app.use('/', workLogStreamRouter)

// ─────────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────────

beforeEach(() => {
  testDb = createTestDb()
})

afterEach(() => {
  testDb?.close()
  testDb = null
})

describe('GET /api/work-log-stream', () => {
  it('returns 200 with entries array', async () => {
    const res = await request(app).get('/')
    expect(res.status).toBe(200)
    expect(res.body).toHaveProperty('entries')
    expect(Array.isArray(res.body.entries)).toBe(true)
  })

  it('returns at most limit entries when ?limit=2', async () => {
    const res = await request(app).get('/?limit=2')
    expect(res.status).toBe(200)
    expect(res.body.entries.length).toBeLessThanOrEqual(2)
  })

  it('clamps limit to max 200', async () => {
    const res = await request(app).get('/?limit=500')
    expect(res.status).toBe(200)
    expect(res.body.entries.length).toBeLessThanOrEqual(200)
  })

  it('filters by ?since ISO timestamp', async () => {
    const res = await request(app).get('/?since=2026-04-04T10:05:00Z')
    expect(res.status).toBe(200)
    // Only entries >= 2026-04-04T10:05:00Z should be returned (ids 2, 4)
    expect(res.body.entries.every((e: any) => e.startedAt >= '2026-04-04T10:05:00Z')).toBe(true)
  })

  it('returns entries ordered by started_at DESC', async () => {
    const res = await request(app).get('/')
    expect(res.status).toBe(200)
    for (let i = 0; i < res.body.entries.length - 1; i++) {
      expect(res.body.entries[i].startedAt >= res.body.entries[i + 1].startedAt).toBe(true)
    }
  })

  it('parses work log from response field when present', async () => {
    const res = await request(app).get('/')
    expect(res.status).toBe(200)
    // Entry with id=1 has response with work log
    const entry1 = res.body.entries.find((e: any) => e.agentRunId === '1')
    expect(entry1).toBeDefined()
    expect(entry1.workLog).not.toBeNull()
    expect(entry1.workLog.filesRead).toContain('foo.ts')
    expect(entry1.workLog.filesChanged).toContain('bar.ts')
  })

  it('falls back to prompt when response is null', async () => {
    const res = await request(app).get('/')
    expect(res.status).toBe(200)
    // Entry with id=3 has response=NULL, should fall back to prompt
    const entry3 = res.body.entries.find((e: any) => e.agentRunId === '3')
    expect(entry3).toBeDefined()
    // prompt is "review prompt for truncation test" — workLog may be null if no ## Work Log section
    expect(entry3.startedAt).toBe('2026-04-04T10:10:00Z')
  })

  it('marks entries with partial_work_log as isTruncated: true', async () => {
    const res = await request(app).get('/')
    expect(res.status).toBe(200)
    // Entry with id=3 (code-reviewer) has truncation record
    const entry3 = res.body.entries.find((e: any) => e.agentRunId === '3')
    expect(entry3).toBeDefined()
    expect(entry3.isTruncated).toBe(true)
    expect(entry3.partialWorkLog).toBe('- Partial work logged before truncation')
  })

  it('returns entries with correct WorkLogEntry shape', async () => {
    const res = await request(app).get('/')
    expect(res.status).toBe(200)
    expect(res.body.entries.length).toBeGreaterThan(0)
    const entry = res.body.entries[0]
    expect(entry).toHaveProperty('agentRunId')
    expect(entry).toHaveProperty('agentName')
    expect(entry).toHaveProperty('model')
    expect(entry).toHaveProperty('sessionId')
    expect(entry).toHaveProperty('startedAt')
    expect(entry).toHaveProperty('status')
    expect(entry).toHaveProperty('workLog')
    expect(entry).toHaveProperty('partialWorkLog')
    expect(entry).toHaveProperty('isTruncated')
    expect(entry).toHaveProperty('parryGuardFired')
    expect(entry).toHaveProperty('qualityGateVerdict')
    expect(entry).toHaveProperty('dispatchedBy')
    expect(entry).toHaveProperty('dispatchedTo')
  })

  it('returns empty entries array when db is null', async () => {
    testDb?.close()
    testDb = null
    const res = await request(app).get('/')
    expect(res.status).toBe(200)
    expect(res.body.entries).toEqual([])
  })
})

describe('GET /api/work-log-stream/:agentRunId', () => {
  it('returns 200 with single entry for valid agentRunId', async () => {
    const res = await request(app).get('/1')
    expect(res.status).toBe(200)
    expect(res.body).toHaveProperty('entry')
    expect(res.body.entry.agentRunId).toBe('1')
  })

  it('returns 404 for unknown agentRunId', async () => {
    const res = await request(app).get('/99999')
    expect(res.status).toBe(404)
    expect(res.body).toHaveProperty('error')
  })

  it('returns 400 for non-numeric agentRunId', async () => {
    const res = await request(app).get('/not-a-number')
    expect(res.status).toBe(400)
    expect(res.body).toHaveProperty('error')
  })

  it('returns correct entry data with work log parsed', async () => {
    const res = await request(app).get('/1')
    expect(res.status).toBe(200)
    const entry = res.body.entry
    expect(entry.agentRunId).toBe('1')
    expect(entry.agentName).toBe('code-writer')
    expect(entry.model).toBe('sonnet')
    expect(entry.status).toBe('DONE')
    expect(entry.workLog).not.toBeNull()
    expect(entry.workLog.filesRead).toContain('foo.ts')
    expect(entry.workLog.filesChanged).toContain('bar.ts')
  })

  it('handles truncated entry (partial_work_log)', async () => {
    const res = await request(app).get('/3')
    expect(res.status).toBe(200)
    const entry = res.body.entry
    expect(entry.agentRunId).toBe('3')
    expect(entry.isTruncated).toBe(true)
    expect(entry.partialWorkLog).toBe('- Partial work logged before truncation')
  })

  it('returns 404 when db is null', async () => {
    testDb?.close()
    testDb = null
    const res = await request(app).get('/1')
    expect(res.status).toBe(404)
  })
})

describe('JOIN fan-out fix: one run + two truncation rows → one entry (no duplicate agentRunIds)', () => {
  // B5 regression: LEFT JOIN on (session_id, agent_type) was non-unique.
  // 5,891 runs → 9,720 joined rows in live DB (1.65× fan-out).
  // Fix: correlated subquery on agent_id (LIMIT 1) collapses to exactly one row per run.
  it('two truncation rows for the same agent_id produce exactly one WorkLogEntry', async () => {
    const db = new Database(':memory:')
    db.exec(`
      CREATE TABLE agent_runs (
        id         INTEGER PRIMARY KEY,
        session_id TEXT,
        agent      TEXT NOT NULL,
        model      TEXT,
        started_at TEXT,
        status     TEXT,
        agent_id   TEXT,
        response   TEXT
      );
      CREATE TABLE dispatch_decisions (
        id TEXT PRIMARY KEY, session_id TEXT, chosen_agent TEXT,
        prompt_snippet TEXT, created_at TEXT
      );
      CREATE TABLE agent_truncations (
        id        INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id TEXT,
        agent_type TEXT,
        agent_id   TEXT,
        timestamp  TEXT,
        partial_work_log TEXT,
        has_status INTEGER
      );
    `)
    db.prepare(`INSERT INTO agent_runs (id, session_id, agent, model, started_at, status, agent_id)
      VALUES (10, 'sess-x', 'code-writer', 'sonnet', '2026-04-05T09:00:00Z', 'DONE', 'ar-x')`).run()
    // Two truncation rows for the same agent_id — this is the fan-out scenario
    db.prepare(`INSERT INTO agent_truncations (session_id, agent_type, agent_id, timestamp, partial_work_log, has_status)
      VALUES ('sess-x', 'code-writer', 'ar-x', '2026-04-05T09:00:10Z', '- first partial', 0)`).run()
    db.prepare(`INSERT INTO agent_truncations (session_id, agent_type, agent_id, timestamp, partial_work_log, has_status)
      VALUES ('sess-x', 'code-writer', 'ar-x', '2026-04-05T09:00:20Z', '- second partial', 0)`).run()

    testDb = db
    const res = await request(app).get('/')
    expect(res.status).toBe(200)

    // Must be exactly ONE entry — no fan-out from the two truncation rows
    expect(res.body.entries).toHaveLength(1)
    expect(res.body.entries[0].agentRunId).toBe('10')
    // isTruncated = true because truncation row exists for this agent_id
    expect(res.body.entries[0].isTruncated).toBe(true)
    // partialWorkLog should be the LATEST truncation row (by timestamp)
    expect(res.body.entries[0].partialWorkLog).toBe('- second partial')
    db.close()
    testDb = null
  })
})

describe('Schema resilience: agent_runs.response column optional', () => {
  beforeEach(() => {
    testDb = createTestDb({ hasResponseCol: false })
  })

  it('GET /api/work-log-stream still works when response column does not exist', async () => {
    const res = await request(app).get('/')
    expect(res.status).toBe(200)
    expect(Array.isArray(res.body.entries)).toBe(true)
    // Entries should fall back to task_summary when response is missing
    expect(res.body.entries.length).toBeGreaterThan(0)
  })

  it('GET /api/work-log-stream/:id still works when response column does not exist', async () => {
    const res = await request(app).get('/1')
    expect(res.status).toBe(200)
    expect(res.body.entry).toBeDefined()
    expect(res.body.entry.agentRunId).toBe('1')
  })
})

describe('Schema resilience: agent_truncations table optional', () => {
  beforeEach(() => {
    testDb = createTestDb({ hasTruncTable: false })
  })

  it('GET /api/work-log-stream still works when agent_truncations table does not exist', async () => {
    const res = await request(app).get('/')
    expect(res.status).toBe(200)
    expect(Array.isArray(res.body.entries)).toBe(true)
    // Entries should have isTruncated: false when no truncations table
    expect(res.body.entries.every((e: any) => e.isTruncated === false)).toBe(true)
  })

  it('GET /api/work-log-stream/:id still works when agent_truncations table does not exist', async () => {
    const res = await request(app).get('/1')
    expect(res.status).toBe(200)
    expect(res.body.entry).toBeDefined()
    expect(res.body.entry.isTruncated).toBe(false)
  })
})
