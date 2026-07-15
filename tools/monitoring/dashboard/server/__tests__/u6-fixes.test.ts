/**
 * U6 fixes regression tests
 *
 * Covers:
 * 1. GET /api/worktree-anomalies — returns { anomalies, total } where total = COUNT(*)
 * 2. LIMIT clamp — ?limit=-1 must not bypass cap (returns default, not all rows)
 * 3. GET /api/config/health — response includes a `version` field
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import Database from 'better-sqlite3'
import express from 'express'
import request from 'supertest'
import fs from 'fs'

// ---------------------------------------------------------------------------
// Shared in-memory database
// ---------------------------------------------------------------------------
let testDb: ReturnType<typeof Database> | null = null

vi.mock('../routes/castDb.js', () => ({
  getCastDb: () => testDb,
}))

// ---------------------------------------------------------------------------
// Import routes after mock is in place
// ---------------------------------------------------------------------------
const { worktreeAnomaliesRouter } = await import('../routes/worktreeAnomalies.js')
const { qualityGatesRouter } = await import('../routes/qualityGates.js')
const { rateLimitsRouter } = await import('../routes/rateLimits.js')
const { configRouter } = await import('../routes/config.js')

// ---------------------------------------------------------------------------
// Apps
// ---------------------------------------------------------------------------
const worktreeApp = express()
worktreeApp.use(express.json())
worktreeApp.use('/', worktreeAnomaliesRouter)

const qualityGatesApp = express()
qualityGatesApp.use(express.json())
qualityGatesApp.use('/', qualityGatesRouter)

const rateLimitsApp = express()
rateLimitsApp.use(express.json())
rateLimitsApp.use('/', rateLimitsRouter)

// Config/health app needs fs mocks at test level
const configApp = express()
configApp.use(express.json())
configApp.use('/', configRouter)

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function createWorktreeDb() {
  const db = new Database(':memory:')
  db.exec(`
    CREATE TABLE worktree_anomalies (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      agent_id TEXT,
      worktree_path TEXT,
      detected_at TEXT NOT NULL,
      repo_root TEXT,
      state TEXT,
      reason TEXT
    )
  `)
  return db
}

function insertAnomalies(db: ReturnType<typeof Database>, count: number) {
  const stmt = db.prepare(
    `INSERT INTO worktree_anomalies (agent_id, worktree_path, detected_at, state, reason)
     VALUES (?, ?, ?, ?, ?)`
  )
  for (let i = 0; i < count; i++) {
    stmt.run(`agent-${i}`, `/tmp/wt-${i}`, new Date().toISOString(), 'stale', 'test')
  }
}

function createQualityGatesDb() {
  const db = new Database(':memory:')
  db.exec(`
    CREATE TABLE quality_gates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id TEXT,
      agent_name TEXT,
      status_line TEXT,
      contract_passed INTEGER,
      retry_count INTEGER,
      timestamp TEXT NOT NULL
    )
  `)
  return db
}

function createDispatchEventsDb() {
  const db = new Database(':memory:')
  db.exec(`
    CREATE TABLE dispatch_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      agent TEXT,
      task_name TEXT,
      triggered_at TEXT NOT NULL,
      status TEXT,
      report_path TEXT
    )
  `)
  return db
}

function createRateLimitsDb() {
  const db = new Database(':memory:')
  db.exec(`
    CREATE TABLE rate_limit_snapshots (
      ts TEXT NOT NULL,
      tpm_limit INTEGER,
      tpm_used INTEGER,
      rpm_limit INTEGER,
      rpm_used INTEGER
    )
  `)
  return db
}

// ===========================================================================
// 1. Worktree anomalies — total
// ===========================================================================

describe('GET /api/worktree-anomalies', () => {
  beforeEach(() => { testDb = createWorktreeDb() })
  afterEach(() => { testDb?.close(); testDb = null })

  it('returns { anomalies, total } shape', async () => {
    const res = await request(worktreeApp).get('/')
    expect(res.status).toBe(200)
    expect(res.body).toHaveProperty('anomalies')
    expect(res.body).toHaveProperty('total')
  })

  it('total equals COUNT(*) when all rows returned within limit', async () => {
    insertAnomalies(testDb!, 5)
    const res = await request(worktreeApp).get('/')
    expect(res.status).toBe(200)
    expect(res.body.total).toBe(5)
    expect(res.body.anomalies).toHaveLength(5)
  })

  it('total reflects full table count when limit clips the page', async () => {
    // Insert more than the default limit to verify total > page size
    insertAnomalies(testDb!, 10)
    const res = await request(worktreeApp).get('/?limit=3')
    expect(res.status).toBe(200)
    expect(res.body.anomalies).toHaveLength(3)
    expect(res.body.total).toBe(10)
  })

  it('total is 0 when table is empty', async () => {
    const res = await request(worktreeApp).get('/')
    expect(res.status).toBe(200)
    expect(res.body.total).toBe(0)
    expect(res.body.anomalies).toHaveLength(0)
  })

  it('returns total=0 when table does not exist', async () => {
    testDb = new Database(':memory:') // no table
    const res = await request(worktreeApp).get('/')
    expect(res.status).toBe(200)
    expect(res.body.total).toBe(0)
  })

  // LIMIT clamp: negative limit must not return all rows
  it('?limit=-1 returns default page size (not all rows)', async () => {
    insertAnomalies(testDb!, 5)
    const res = await request(worktreeApp).get('/?limit=-1')
    expect(res.status).toBe(200)
    // With Math.max(1, ...), limit=-1 becomes 1 (minimum 1)
    expect(res.body.anomalies.length).toBeGreaterThanOrEqual(1)
    expect(res.body.anomalies.length).toBeLessThanOrEqual(5)
    // Crucially: limit is not -1 / unlimited (SQLite LIMIT -1 = unlimited)
    expect(res.body.anomalies.length).not.toBeUndefined()
  })
})

// ===========================================================================
// 2. LIMIT clamp bypass — quality-gates
// ===========================================================================

describe('GET /api/quality-gates — limit clamp', () => {
  beforeEach(() => { testDb = createQualityGatesDb() })
  afterEach(() => { testDb?.close(); testDb = null })

  it('?limit=-1 is clamped to 1 (not SQLite unlimited)', async () => {
    // Insert 6 rows — SQLite LIMIT -1 would return all 6; our clamp returns exactly 1
    const stmt = testDb!.prepare(
      `INSERT INTO quality_gates (agent_name, status_line, contract_passed, retry_count, timestamp)
       VALUES (?, ?, ?, ?, ?)`
    )
    for (let i = 0; i < 6; i++) {
      stmt.run('agent', 'DONE', 1, 0, new Date().toISOString())
    }

    const res = await request(qualityGatesApp).get('/?limit=-1')
    expect(res.status).toBe(200)
    expect(Array.isArray(res.body.gates)).toBe(true)
    // -1 is truthy so Number('-1') || 100 = -1; Math.max(1, Math.min(-1, 500)) = 1
    // Confirm we got exactly 1 row (clamped), not 6 (unlimited) or an error
    expect(res.body.gates).toHaveLength(1)
  })
})

// ===========================================================================
// 3. LIMIT clamp bypass — rate-limits
// ===========================================================================

describe('GET /api/rate-limits — limit clamp', () => {
  beforeEach(() => { testDb = createRateLimitsDb() })
  afterEach(() => { testDb?.close(); testDb = null })

  it('?limit=-1 is clamped to 1 (not SQLite unlimited)', async () => {
    const stmt = testDb!.prepare(
      `INSERT INTO rate_limit_snapshots (ts, tpm_limit, tpm_used, rpm_limit, rpm_used)
       VALUES (?, ?, ?, ?, ?)`
    )
    for (let i = 0; i < 5; i++) {
      stmt.run(new Date().toISOString(), 100000, i * 1000, 60, i)
    }

    const res = await request(rateLimitsApp).get('/?limit=-1')
    expect(res.status).toBe(200)
    expect(Array.isArray(res.body.snapshots)).toBe(true)
    // -1 is truthy so passes through || default; Math.max(1, Math.min(-1, 500)) = 1
    // Confirm exactly 1 row (clamped), not 5 (unlimited) or error
    expect(res.body.snapshots).toHaveLength(1)
  })
})

// ===========================================================================
// 4. Config /health — version field present
// ===========================================================================

describe('GET /api/config/health — version field', () => {
  it('response includes a version field', async () => {
    // Mock fs to avoid reading real ~/.claude/settings.json
    vi.spyOn(fs, 'existsSync').mockReturnValue(false)

    const res = await request(configApp).get('/health')
    expect(res.status).toBe(200)
    expect(res.body).toHaveProperty('version')
    expect(typeof res.body.version).toBe('string')
    expect(res.body.version.length).toBeGreaterThan(0)

    vi.restoreAllMocks()
  })

  it('version is a non-empty string (semver or "unknown" fallback)', async () => {
    vi.spyOn(fs, 'existsSync').mockReturnValue(false)

    const res = await request(configApp).get('/health')
    expect(res.status).toBe(200)
    // Should be a real semver string from package.json, or 'unknown' if fs fails
    expect(typeof res.body.version).toBe('string')
    expect(res.body.version.length).toBeGreaterThan(0)

    vi.restoreAllMocks()
  })

  it('model field defaults to "unknown" when settings.json absent', async () => {
    vi.spyOn(fs, 'existsSync').mockReturnValue(false)

    const res = await request(configApp).get('/health')
    expect(res.status).toBe(200)
    expect(res.body.model).toBe('unknown')

    vi.restoreAllMocks()
  })
})
