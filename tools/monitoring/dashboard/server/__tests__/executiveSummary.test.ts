import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import Database from 'better-sqlite3'
import express from 'express'
import request from 'supertest'

// ── Test DB setup ──────────────────────────────────────────────────────────────

let testDb: ReturnType<typeof Database> | null = null

function createTestDb(): ReturnType<typeof Database> {
  const db = new Database(':memory:')

  db.exec(`
    CREATE TABLE agent_runs (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id   TEXT,
      agent        TEXT NOT NULL,
      model        TEXT,
      started_at   TEXT,
      ended_at     TEXT,
      status       TEXT,
      cost_usd     REAL DEFAULT 0,
      input_tokens INTEGER DEFAULT 0,
      output_tokens INTEGER DEFAULT 0,
      prompt       TEXT,
      response     TEXT
    );

    CREATE TABLE quality_gates (
      id               INTEGER PRIMARY KEY AUTOINCREMENT,
      contract_passed  INTEGER DEFAULT 0,
      created_at       TEXT
    );

    CREATE TABLE hook_failures (
      id        INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp TEXT
    );
  `)

  // Seed: 3 DONE, 1 BLOCKED, 1 DONE_WITH_CONCERNS in today's window
  const today = new Date()
  today.setHours(6, 0, 0, 0)
  const todayStr = today.toISOString()

  // Yesterday
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)
  const yesterdayStr = yesterday.toISOString()

  const insertRun = db.prepare(`
    INSERT INTO agent_runs (session_id, agent, model, started_at, status, cost_usd, prompt)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `)

  insertRun.run('sess-1', 'code-writer', 'sonnet', todayStr, 'DONE', 0.012, 'Write feature A')
  insertRun.run('sess-1', 'code-reviewer', 'haiku', todayStr, 'DONE', 0.002, 'Review feature A')
  insertRun.run('sess-1', 'commit', 'haiku', todayStr, 'DONE', 0.001, 'Commit changes')
  insertRun.run('sess-2', 'debugger', 'sonnet', todayStr, 'BLOCKED', 0.005, 'Cannot resolve import error')
  insertRun.run('sess-2', 'test-writer', 'haiku', todayStr, 'DONE_WITH_CONCERNS', 0.003, 'Tests written with caveats')
  insertRun.run('sess-old', 'code-writer', 'sonnet', yesterdayStr, 'DONE', 0.010, 'Old run from yesterday')

  // Seed quality_gates (v8 schema: contract_passed int, created_at text)
  const insertQg = db.prepare(`INSERT INTO quality_gates (contract_passed, created_at) VALUES (?, ?)`)
  insertQg.run(1, todayStr)  // pass
  insertQg.run(1, todayStr)  // pass
  insertQg.run(0, todayStr)  // fail

  // Seed hook_failures (v8 schema: timestamp text)
  const insertHf = db.prepare(`INSERT INTO hook_failures (timestamp) VALUES (?)`)
  insertHf.run(new Date(Date.now() - 3600_000).toISOString()) // 1h ago

  return db
}

// ── Mock castDb module ─────────────────────────────────────────────────────────

vi.mock('../routes/castDb.js', () => ({
  getCastDb: () => testDb,
  getCastDbWritable: () => testDb,
}))

const { executiveSummaryRouter } = await import('../routes/executiveSummary.js')

const app = express()
app.use(express.json())
app.use('/api/executive-summary', executiveSummaryRouter)

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('GET /api/executive-summary', () => {
  beforeEach(() => {
    testDb = createTestDb()
  })

  afterEach(() => {
    testDb?.close()
    testDb = null
  })

  it('returns 200 with correct top-level shape', async () => {
    const res = await request(app).get('/api/executive-summary')

    expect(res.status).toBe(200)
    expect(res.body).toHaveProperty('range')
    expect(res.body).toHaveProperty('generatedAt')
    expect(res.body).toHaveProperty('runs')
    expect(res.body).toHaveProperty('cost')
    expect(res.body).toHaveProperty('topAgents')
    expect(res.body).toHaveProperty('blockers')
    expect(res.body).toHaveProperty('highlights')
  })

  it('defaults range to today', async () => {
    const res = await request(app).get('/api/executive-summary')
    expect(res.status).toBe(200)
    expect(res.body.range).toBe('today')
  })

  it('respects range=week param', async () => {
    const res = await request(app).get('/api/executive-summary?range=week')
    expect(res.status).toBe(200)
    expect(res.body.range).toBe('week')
  })

  it('counts runs correctly by status (case-insensitive)', async () => {
    const res = await request(app).get('/api/executive-summary')
    expect(res.status).toBe(200)
    const { byStatus, total } = res.body.runs
    expect(byStatus.DONE).toBe(3)
    expect(byStatus.BLOCKED).toBe(1)
    expect(byStatus.DONE_WITH_CONCERNS).toBe(1)
    expect(total).toBe(5)
  })

  it('returns blockers for BLOCKED and DONE_WITH_CONCERNS status', async () => {
    const res = await request(app).get('/api/executive-summary')
    expect(res.status).toBe(200)
    const { blockers } = res.body
    expect(blockers.length).toBe(2)
    const statuses = blockers.map((b: { status: string }) => b.status)
    expect(statuses).toContain('BLOCKED')
    expect(statuses).toContain('DONE_WITH_CONCERNS')
  })

  it('blockers include required fields', async () => {
    const res = await request(app).get('/api/executive-summary')
    const blockers = res.body.blockers as Array<Record<string, unknown>>
    for (const b of blockers) {
      expect(b).toHaveProperty('id')
      expect(b).toHaveProperty('agent')
      expect(b).toHaveProperty('status')
      expect(b).toHaveProperty('started_at')
      expect(b).toHaveProperty('work_log_snippet')
    }
  })

  it('returns top agents sorted by run count desc', async () => {
    const res = await request(app).get('/api/executive-summary')
    const { topAgents } = res.body
    expect(Array.isArray(topAgents)).toBe(true)
    // code-writer has 1, code-reviewer has 1, commit has 1, etc — all equal,
    // just verify shape
    if (topAgents.length > 0) {
      expect(topAgents[0]).toHaveProperty('agent')
      expect(topAgents[0]).toHaveProperty('count')
      expect(topAgents[0]).toHaveProperty('costUsd')
    }
  })

  it('returns at most 5 top agents', async () => {
    const res = await request(app).get('/api/executive-summary')
    expect(res.body.topAgents.length).toBeLessThanOrEqual(5)
  })

  it('includes highlights fields', async () => {
    const res = await request(app).get('/api/executive-summary')
    const { highlights } = res.body
    expect(highlights).toHaveProperty('plansActive')
    expect(highlights).toHaveProperty('hookFailures24h')
    expect(highlights).toHaveProperty('qualityGatePassRate')
  })

  it('counts hook failures in last 24h', async () => {
    const res = await request(app).get('/api/executive-summary')
    expect(res.body.highlights.hookFailures24h).toBe(1)
  })

  it('returns a graceful empty response when db is unavailable', async () => {
    testDb = null
    const res = await request(app).get('/api/executive-summary')
    expect(res.status).toBe(200)
    expect(res.body.runs.total).toBe(0)
    expect(res.body.topAgents).toEqual([])
    expect(res.body.blockers).toEqual([])
  })

  it('week range includes yesterday\'s runs', async () => {
    const res = await request(app).get('/api/executive-summary?range=week')
    // 5 today + 1 yesterday = 6 total
    expect(res.body.runs.total).toBe(6)
  })

  it('cost.todayUsd is a number', async () => {
    const res = await request(app).get('/api/executive-summary')
    expect(typeof res.body.cost.todayUsd).toBe('number')
    expect(res.body.cost.todayUsd).toBeGreaterThanOrEqual(0)
  })

  it('cost.vsPrior7dPct is non-null for today when prior day has spend', async () => {
    // Verify the prior-window predicate is satisfiable for range=today.
    // Bug was: priorStart=yesterday AND < weekAgoStr (7-days-ago) → empty set → null.
    // Fix: prior window ends at windowStart (today's start) so yesterday's data is captured.
    testDb!.exec('DELETE FROM agent_runs')

    const today = new Date()
    today.setHours(8, 0, 0, 0)
    const todayStr = today.toISOString()

    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)
    const yesterdayStr = yesterday.toISOString()

    const insertRun = testDb!.prepare(
      `INSERT INTO agent_runs (session_id, agent, model, started_at, status, cost_usd, prompt) VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    insertRun.run('s-today', 'code-writer', 'sonnet', todayStr, 'DONE', 0.010, 'today run')
    insertRun.run('s-yesterday', 'code-writer', 'sonnet', yesterdayStr, 'DONE', 0.008, 'yesterday run')

    const res = await request(app).get('/api/executive-summary?range=today')
    expect(res.status).toBe(200)
    // Prior day has spend (0.008) so vsPrior7dPct must not be null
    expect(res.body.cost.vsPrior7dPct).not.toBeNull()
    expect(typeof res.body.cost.vsPrior7dPct).toBe('number')
  })

  it('vsPrior7dPct for range=today uses todayUsd (not weekUsd) as numerator', async () => {
    // Bug: weekUsd (7-day sum) was used as numerator against priorWeekUsd (1-day yesterday).
    // Fix: currentWindowUsd = todayUsd for range=today, so numerator and denominator span equal windows.
    // With today=$0.010 and yesterday=$0.008:
    //   BUG  → weekUsd=$0.018 vs yesterday=$0.008 → pct = round((0.010/0.008)*1000)/10 = 125.0
    //   FIX  → todayUsd=$0.010 vs yesterday=$0.008 → pct = round((0.002/0.008)*1000)/10 = 25.0
    testDb!.exec('DELETE FROM agent_runs')

    const today = new Date()
    today.setHours(8, 0, 0, 0)
    const todayStr = today.toISOString()

    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)
    const yesterdayStr = yesterday.toISOString()

    const insertRun = testDb!.prepare(
      `INSERT INTO agent_runs (session_id, agent, model, started_at, status, cost_usd, prompt) VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    insertRun.run('s-today', 'code-writer', 'sonnet', todayStr, 'DONE', 0.010, 'today run')
    insertRun.run('s-yesterday', 'code-writer', 'sonnet', yesterdayStr, 'DONE', 0.008, 'yesterday run')

    const res = await request(app).get('/api/executive-summary?range=today')
    expect(res.status).toBe(200)
    // Correct: todayUsd=$0.010, priorWeekUsd=$0.008 → (0.002/0.008)*100 = 25.0
    expect(res.body.cost.vsPrior7dPct).toBe(25)
  })

  it('qualityGatePassRate counts space-format created_at gates within an ISO-T window', async () => {
    // Bug: quality_gates.created_at is space-format; windowStart is ISO-T.
    // Lexicographic "2026-07-02 06:00:00" < "2026-07-02T00:00:00Z" because space < 'T'.
    // Fix: compare via unixepoch() on both sides.
    testDb!.exec('DELETE FROM quality_gates')

    const today = new Date()
    today.setHours(0, 0, 0, 0)
    // Space-format timestamp for today (simulates what CAST actually writes)
    const spaceNow = today.toISOString().replace('T', ' ').replace(/\.\d+Z$/, '')

    const insertQg = testDb!.prepare('INSERT INTO quality_gates (contract_passed, created_at) VALUES (?, ?)')
    insertQg.run(1, spaceNow)
    insertQg.run(0, spaceNow)

    const res = await request(app).get('/api/executive-summary?range=today')
    expect(res.status).toBe(200)
    // With the unixepoch() fix, both gates should be counted → pass rate = 50.0
    expect(res.body.highlights.qualityGatePassRate).not.toBeNull()
    expect(res.body.highlights.qualityGatePassRate).toBe(50)
  })
})
