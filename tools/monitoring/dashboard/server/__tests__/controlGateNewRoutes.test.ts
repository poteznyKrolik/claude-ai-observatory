/**
 * U2 — Control-gate coverage + write-path correctness tests
 *
 * 1. Gate coverage: each newly gated mount returns 404 for non-GET when
 *    CAST_DASHBOARD_CONTROL is unset; GET always passes through.
 * 2. Budget POST write-path: with gate enabled + token, POST /api/budget/config
 *    writes a row to the budgets table (proves getCastDbWritable fix).
 * 3. Sessions DELETE write-path: gate disabled → 404; gate enabled + token →
 *    soft-deletes the row (proves getCastDbWritable fix + dead migration removal).
 * 4. Memory backup-trigger: POST → 404 when gate is disabled (never execSync
 *    the real backup script in tests).
 *
 * All DB operations use in-memory SQLite only — never ~/.claude/cast.db.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import express from 'express'
import request from 'supertest'
import Database from 'better-sqlite3'
import { controlGate } from '../middleware/controlGate.js'

// ── Shared in-memory DB ───────────────────────────────────────────────────────
// A Proxy is used so db.close() inside route handlers is a no-op — the same
// instance stays open so the test can inspect state after the handler runs.

const _testDb = new Database(':memory:')

_testDb.exec(`
  CREATE TABLE budgets (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    scope        TEXT,
    scope_key    TEXT,
    period       TEXT,
    limit_usd    REAL,
    alert_at_pct REAL,
    created_at   TEXT
  );
  CREATE TABLE sessions (
    id          TEXT PRIMARY KEY,
    project_id  TEXT,
    started_at  TEXT,
    ended_at    TEXT,
    model       TEXT,
    status      TEXT,
    deleted_at  TEXT
  );
`)

function makeWritableProxy(db: Database.Database): Database.Database {
  return new Proxy(db, {
    get(target, prop) {
      if (prop === 'close') return () => {}
      const val = (target as Record<string | symbol, unknown>)[prop as string]
      return typeof val === 'function' ? (val as (...args: unknown[]) => unknown).bind(target) : val
    }
  }) as Database.Database
}

// Mock castDb before any route imports so the factory is captured correctly.
vi.mock('../routes/castDb.js', () => ({
  getCastDb: () => _testDb,
  getCastDbWritable: () => makeWritableProxy(_testDb),
}))

// Mock parsers so the sessions router doesn't touch the real filesystem.
vi.mock('../parsers/sessions.js', () => ({
  listSessions: () => [],
  loadSession: () => [],
}))

// Import routers AFTER mocks are registered.
const { budgetStatusRouter } = await import('../routes/budgetStatus.js')
const { sessionsRouter } = await import('../routes/sessions.js')
const { memoryRouter } = await import('../routes/memory.js')

// ── Constants ────────────────────────────────────────────────────────────────

const TOKEN = 'unit-test-token'
const VALID_UUID = '12345678-1234-4234-8234-123456789abc'

// ── Env helpers ──────────────────────────────────────────────────────────────

const ORIG_ENV: Record<string, string | undefined> = {}

beforeEach(() => {
  ORIG_ENV.CAST_DASHBOARD_CONTROL = process.env.CAST_DASHBOARD_CONTROL
  ORIG_ENV.DASHBOARD_TOKEN = process.env.DASHBOARD_TOKEN
  delete process.env.CAST_DASHBOARD_CONTROL
  delete process.env.DASHBOARD_TOKEN
})

afterEach(() => {
  if (ORIG_ENV.CAST_DASHBOARD_CONTROL !== undefined) {
    process.env.CAST_DASHBOARD_CONTROL = ORIG_ENV.CAST_DASHBOARD_CONTROL
  } else {
    delete process.env.CAST_DASHBOARD_CONTROL
  }
  if (ORIG_ENV.DASHBOARD_TOKEN !== undefined) {
    process.env.DASHBOARD_TOKEN = ORIG_ENV.DASHBOARD_TOKEN
  } else {
    delete process.env.DASHBOARD_TOKEN
  }
})

// ── Helper: build a minimal app with controlGate before a router ─────────────

function makeGatedApp(prefix: string, router: express.Router) {
  const app = express()
  app.use(express.json())
  app.use(prefix, controlGate)
  app.use(prefix, router)
  return app
}

// ── 1. Gate coverage — one check per newly mounted prefix ───────────────────

describe('controlGate — gate coverage for newly mounted routes', () => {
  // Build a minimal stub app per prefix to avoid full-stack coupling.
  function makeStubApp(prefix: string) {
    const app = express()
    app.use(express.json())
    app.use(prefix, controlGate)
    app.get(`${prefix}/ping`, (_req, res) => res.json({ ok: true }))
    app.post(`${prefix}/ping`, (_req, res) => res.status(201).json({ ok: true }))
    app.delete(`${prefix}/ping`, (_req, res) => res.json({ deleted: true }))
    return app
  }

  const PREFIXES = [
    '/api/cast/seed',
    '/api/budget',
    '/api/cast/task-queue',
    '/api/cast/memories',
    '/api/memory',
    '/api/agents',
    '/api/rules',
    '/api/hook-events',
    '/api/sessions',
  ]

  for (const prefix of PREFIXES) {
    it(`GET ${prefix}/ping always passes (read-only path unaffected)`, async () => {
      const res = await request(makeStubApp(prefix)).get(`${prefix}/ping`)
      expect(res.status).toBe(200)
      expect(res.body.ok).toBe(true)
    })

    it(`POST ${prefix}/ping → 404 when CAST_DASHBOARD_CONTROL is unset`, async () => {
      const res = await request(makeStubApp(prefix)).post(`${prefix}/ping`).send({})
      expect(res.status).toBe(404)
    })

    it(`DELETE ${prefix}/ping → 404 when CAST_DASHBOARD_CONTROL is unset`, async () => {
      const res = await request(makeStubApp(prefix)).delete(`${prefix}/ping`)
      expect(res.status).toBe(404)
    })

    it(`POST ${prefix}/ping → 503 when enabled but no token configured`, async () => {
      process.env.CAST_DASHBOARD_CONTROL = '1'
      const res = await request(makeStubApp(prefix)).post(`${prefix}/ping`).send({})
      expect(res.status).toBe(503)
    })

    it(`POST ${prefix}/ping → 403 when enabled with wrong token`, async () => {
      process.env.CAST_DASHBOARD_CONTROL = '1'
      process.env.DASHBOARD_TOKEN = TOKEN
      const res = await request(makeStubApp(prefix))
        .post(`${prefix}/ping`)
        .set('X-Dashboard-Token', 'wrong')
        .send({})
      expect(res.status).toBe(403)
    })
  }
})

// ── 2. Budget write-path correctness ─────────────────────────────────────────

describe('POST /api/budget/config — writable-handle fix', () => {
  beforeEach(() => {
    // Clear any existing budget rows between tests
    _testDb.prepare('DELETE FROM budgets').run()
  })

  it('returns 404 when gate is disabled (no env flags)', async () => {
    const app = makeGatedApp('/api/budget', budgetStatusRouter)
    const res = await request(app)
      .post('/api/budget/config')
      .send({ daily_limit_usd: 5 })
    expect(res.status).toBe(404)
    // Verify no side effect: DB still empty
    const rows = _testDb.prepare('SELECT * FROM budgets').all()
    expect(rows).toHaveLength(0)
  })

  it('returns 200 and writes row when gate is enabled with valid token', async () => {
    process.env.CAST_DASHBOARD_CONTROL = '1'
    process.env.DASHBOARD_TOKEN = TOKEN

    const app = makeGatedApp('/api/budget', budgetStatusRouter)
    const res = await request(app)
      .post('/api/budget/config')
      .set('X-Dashboard-Token', TOKEN)
      .send({ daily_limit_usd: 10, alert_at_pct: 0.9 })

    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(true)
    expect(res.body.daily_limit_usd).toBe(10)

    // Verify the row was actually written to the DB
    const row = _testDb.prepare(
      "SELECT * FROM budgets WHERE scope = 'global' AND scope_key = '*' AND period = 'daily'"
    ).get() as { limit_usd: number; alert_at_pct: number } | undefined
    expect(row).toBeDefined()
    expect(row?.limit_usd).toBe(10)
    expect(row?.alert_at_pct).toBe(0.9)
  })

  it('upserts on second call (only one row remains)', async () => {
    process.env.CAST_DASHBOARD_CONTROL = '1'
    process.env.DASHBOARD_TOKEN = TOKEN

    const app = makeGatedApp('/api/budget', budgetStatusRouter)
    await request(app)
      .post('/api/budget/config')
      .set('X-Dashboard-Token', TOKEN)
      .send({ daily_limit_usd: 5 })
    await request(app)
      .post('/api/budget/config')
      .set('X-Dashboard-Token', TOKEN)
      .send({ daily_limit_usd: 20 })

    const rows = _testDb.prepare(
      "SELECT * FROM budgets WHERE scope = 'global' AND period = 'daily'"
    ).all() as Array<{ limit_usd: number }>
    expect(rows).toHaveLength(1)
    expect(rows[0].limit_usd).toBe(20)
  })
})

// ── 3. Sessions soft-delete write-path correctness ───────────────────────────

describe('DELETE /api/sessions/:project/:id — writable-handle fix', () => {
  beforeEach(() => {
    _testDb.prepare('DELETE FROM sessions').run()
  })

  it('returns 404 when gate is disabled (never touches DB)', async () => {
    const app = makeGatedApp('/api/sessions', sessionsRouter)
    const res = await request(app)
      .delete(`/api/sessions/myproject/${VALID_UUID}`)
    expect(res.status).toBe(404)
    // DB must be unchanged
    const rows = _testDb.prepare('SELECT * FROM sessions').all()
    expect(rows).toHaveLength(0)
  })

  it('soft-deletes the session row when gate is enabled with valid token', async () => {
    process.env.CAST_DASHBOARD_CONTROL = '1'
    process.env.DASHBOARD_TOKEN = TOKEN

    const app = makeGatedApp('/api/sessions', sessionsRouter)
    const res = await request(app)
      .delete(`/api/sessions/myproject/${VALID_UUID}`)
      .set('X-Dashboard-Token', TOKEN)

    expect(res.status).toBe(200)
    expect(res.body.id).toBe(VALID_UUID)
    expect(res.body.deleted_at).toBeTruthy()

    // Verify the row has deleted_at set in the DB
    const row = _testDb.prepare('SELECT * FROM sessions WHERE id = ?').get(VALID_UUID) as {
      id: string; deleted_at: string | null
    } | undefined
    expect(row).toBeDefined()
    expect(row?.deleted_at).toBeTruthy()
  })

  it('returns 400 for a non-UUID session ID (UUID validation guard)', async () => {
    process.env.CAST_DASHBOARD_CONTROL = '1'
    process.env.DASHBOARD_TOKEN = TOKEN

    const app = makeGatedApp('/api/sessions', sessionsRouter)
    const res = await request(app)
      .delete('/api/sessions/myproject/not-a-valid-uuid')
      .set('X-Dashboard-Token', TOKEN)
    expect(res.status).toBe(400)
  })
})

// ── 4. Memory backup-trigger — never execSync real script ───────────────────

describe('POST /api/memory/backup-trigger — gate guard', () => {
  it('returns 404 when gate is disabled (script never runs)', async () => {
    const app = makeGatedApp('/api/memory', memoryRouter)
    const res = await request(app).post('/api/memory/backup-trigger').send({})
    // With gate disabled we get 404 before the execSync ever fires
    expect(res.status).toBe(404)
  })

  it('GET /api/memory/backup-status is unaffected by gate (read path)', async () => {
    const app = makeGatedApp('/api/memory', memoryRouter)
    const res = await request(app).get('/api/memory/backup-status')
    // Route should pass through gate; result depends on fs state but not 404
    expect(res.status).not.toBe(404)
  })
})
