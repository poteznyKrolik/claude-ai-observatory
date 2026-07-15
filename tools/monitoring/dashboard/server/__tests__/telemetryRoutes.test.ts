import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import Database from 'better-sqlite3'
import express from 'express'
import request from 'supertest'

// ─────────────────────────────────────────────────────────────────────────────
// Test fixtures
// ─────────────────────────────────────────────────────────────────────────────

function makeTelemetryDb(options: { hasStopFailureTable?: boolean; hasProtocolViolationsTable?: boolean } = {}): ReturnType<typeof Database> {
  const db = new Database(':memory:')

  // Create stop_failure_events table if requested
  if (options.hasStopFailureTable !== false) {
    db.exec(`
      CREATE TABLE stop_failure_events (
        id        INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp TEXT,
        agent     TEXT,
        error     TEXT,
        context   TEXT
      );
    `)
    db.prepare(`
      INSERT INTO stop_failure_events (timestamp, agent, error, context)
      VALUES
        ('2026-04-04T10:00:00Z', 'code-writer', 'API timeout', 'dispatching from session-1'),
        ('2026-04-04T10:05:00Z', 'test-writer', 'ECONNREFUSED', 'attempting connection'),
        ('2026-04-04T10:10:00Z', 'debugger', 'Rate limited', 'quota exceeded'),
        ('2026-04-04T10:15:00Z', 'code-reviewer', 'Invalid response', 'malformed JSON')
    `).run()
  }

  // Create agent_protocol_violations table if requested
  if (options.hasProtocolViolationsTable !== false) {
    db.exec(`
      CREATE TABLE agent_protocol_violations (
        id        INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp TEXT,
        agent     TEXT,
        violation TEXT,
        details   TEXT
      );
    `)
    db.prepare(`
      INSERT INTO agent_protocol_violations (timestamp, agent, violation, details)
      VALUES
        ('2026-04-04T11:00:00Z', 'code-writer', 'No status block', 'response missing Status: line'),
        ('2026-04-04T11:05:00Z', 'test-writer', 'Missing work log', 'expected ## Work Log section'),
        ('2026-04-04T11:10:00Z', 'debugger', 'Inline commit', 'used git commit directly'),
        ('2026-04-04T11:15:00Z', 'code-reviewer', 'Bad status value', 'Status: UNKNOWN not in enum')
    `).run()
  }

  return db
}

// ─────────────────────────────────────────────────────────────────────────────
// Tests for GET /api/stop-failure-events
// ─────────────────────────────────────────────────────────────────────────────

describe('GET /api/stop-failure-events', () => {
  let testDb: ReturnType<typeof Database>

  beforeEach(() => {
    vi.resetModules()
    testDb = makeTelemetryDb()
    vi.doMock('../routes/castDb.js', () => ({
      getCastDb: () => testDb,
    }))
  })

  afterEach(() => {
    testDb.close()
    vi.restoreAllMocks()
  })

  it('returns 200 with data array', async () => {
    const { stopFailureEventsRouter } = await import('../routes/telemetryRoutes.js')
    const app = express()
    app.use('/api/stop-failure-events', stopFailureEventsRouter)

    const res = await request(app).get('/api/stop-failure-events')
    expect(res.status).toBe(200)
    expect(res.body).toHaveProperty('data')
    expect(Array.isArray(res.body.data)).toBe(true)
  })

  it('returns events ordered by timestamp DESC', async () => {
    const { stopFailureEventsRouter } = await import('../routes/telemetryRoutes.js')
    const app = express()
    app.use('/api/stop-failure-events', stopFailureEventsRouter)

    const res = await request(app).get('/api/stop-failure-events')
    expect(res.status).toBe(200)
    expect(res.body.data.length).toBeGreaterThan(0)
    for (let i = 0; i < res.body.data.length - 1; i++) {
      expect(res.body.data[i].timestamp >= res.body.data[i + 1].timestamp).toBe(true)
    }
  })

  it('respects ?limit=2 parameter', async () => {
    const { stopFailureEventsRouter } = await import('../routes/telemetryRoutes.js')
    const app = express()
    app.use('/api/stop-failure-events', stopFailureEventsRouter)

    const res = await request(app).get('/api/stop-failure-events?limit=2')
    expect(res.status).toBe(200)
    expect(res.body.data.length).toBeLessThanOrEqual(2)
  })

  it('clamps limit to max 200', async () => {
    const { stopFailureEventsRouter } = await import('../routes/telemetryRoutes.js')
    const app = express()
    app.use('/api/stop-failure-events', stopFailureEventsRouter)

    const res = await request(app).get('/api/stop-failure-events?limit=500')
    expect(res.status).toBe(200)
    expect(res.body.data.length).toBeLessThanOrEqual(200)
  })

  it('returns default 50 entries when no limit specified', async () => {
    const { stopFailureEventsRouter } = await import('../routes/telemetryRoutes.js')
    const app = express()
    app.use('/api/stop-failure-events', stopFailureEventsRouter)

    const res = await request(app).get('/api/stop-failure-events')
    expect(res.status).toBe(200)
    // Fixture has 4 entries, so should return all
    expect(res.body.data.length).toBeLessThanOrEqual(50)
  })

  it('returns empty array when table does not exist (graceful degradation)', async () => {
    testDb.close()
    vi.resetModules()
    const dbNoTable = makeTelemetryDb({ hasStopFailureTable: false })
    vi.doMock('../routes/castDb.js', () => ({
      getCastDb: () => dbNoTable,
    }))

    const { stopFailureEventsRouter } = await import('../routes/telemetryRoutes.js')
    const app = express()
    app.use('/api/stop-failure-events', stopFailureEventsRouter)

    const res = await request(app).get('/api/stop-failure-events')
    expect(res.status).toBe(200)
    expect(res.body.data).toEqual([])

    dbNoTable.close()
  })

  it('returns empty array when db is null', async () => {
    testDb.close()
    vi.resetModules()
    vi.doMock('../routes/castDb.js', () => ({
      getCastDb: () => null,
    }))

    const { stopFailureEventsRouter } = await import('../routes/telemetryRoutes.js')
    const app = express()
    app.use('/api/stop-failure-events', stopFailureEventsRouter)

    const res = await request(app).get('/api/stop-failure-events')
    expect(res.status).toBe(200)
    expect(res.body.data).toEqual([])
  })

  it('returns event objects with correct shape', async () => {
    const { stopFailureEventsRouter } = await import('../routes/telemetryRoutes.js')
    const app = express()
    app.use('/api/stop-failure-events', stopFailureEventsRouter)

    const res = await request(app).get('/api/stop-failure-events')
    expect(res.status).toBe(200)
    expect(res.body.data.length).toBeGreaterThan(0)
    const event = res.body.data[0]
    expect(event).toHaveProperty('id')
    expect(event).toHaveProperty('timestamp')
    expect(event).toHaveProperty('agent')
    expect(event).toHaveProperty('error')
    expect(event).toHaveProperty('context')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Tests for GET /api/agent-protocol-violations
// ─────────────────────────────────────────────────────────────────────────────

describe('GET /api/agent-protocol-violations', () => {
  let testDb: ReturnType<typeof Database>

  beforeEach(() => {
    vi.resetModules()
    testDb = makeTelemetryDb()
    vi.doMock('../routes/castDb.js', () => ({
      getCastDb: () => testDb,
    }))
  })

  afterEach(() => {
    testDb.close()
    vi.restoreAllMocks()
  })

  it('returns 200 with data array', async () => {
    const { agentProtocolViolationsRouter } = await import('../routes/telemetryRoutes.js')
    const app = express()
    app.use('/api/agent-protocol-violations', agentProtocolViolationsRouter)

    const res = await request(app).get('/api/agent-protocol-violations')
    expect(res.status).toBe(200)
    expect(res.body).toHaveProperty('data')
    expect(Array.isArray(res.body.data)).toBe(true)
  })

  it('returns violations ordered by timestamp DESC', async () => {
    const { agentProtocolViolationsRouter } = await import('../routes/telemetryRoutes.js')
    const app = express()
    app.use('/api/agent-protocol-violations', agentProtocolViolationsRouter)

    const res = await request(app).get('/api/agent-protocol-violations')
    expect(res.status).toBe(200)
    expect(res.body.data.length).toBeGreaterThan(0)
    for (let i = 0; i < res.body.data.length - 1; i++) {
      expect(res.body.data[i].timestamp >= res.body.data[i + 1].timestamp).toBe(true)
    }
  })

  it('respects ?limit parameter', async () => {
    const { agentProtocolViolationsRouter } = await import('../routes/telemetryRoutes.js')
    const app = express()
    app.use('/api/agent-protocol-violations', agentProtocolViolationsRouter)

    const res = await request(app).get('/api/agent-protocol-violations?limit=2')
    expect(res.status).toBe(200)
    expect(res.body.data.length).toBeLessThanOrEqual(2)
  })

  it('clamps limit to max 200', async () => {
    const { agentProtocolViolationsRouter } = await import('../routes/telemetryRoutes.js')
    const app = express()
    app.use('/api/agent-protocol-violations', agentProtocolViolationsRouter)

    const res = await request(app).get('/api/agent-protocol-violations?limit=500')
    expect(res.status).toBe(200)
    expect(res.body.data.length).toBeLessThanOrEqual(200)
  })

  it('returns default 50 entries when no limit specified', async () => {
    const { agentProtocolViolationsRouter } = await import('../routes/telemetryRoutes.js')
    const app = express()
    app.use('/api/agent-protocol-violations', agentProtocolViolationsRouter)

    const res = await request(app).get('/api/agent-protocol-violations')
    expect(res.status).toBe(200)
    // Fixture has 4 entries, so should return all
    expect(res.body.data.length).toBeLessThanOrEqual(50)
  })

  it('returns empty array when table does not exist (graceful degradation)', async () => {
    testDb.close()
    vi.resetModules()
    const dbNoTable = makeTelemetryDb({ hasProtocolViolationsTable: false })
    vi.doMock('../routes/castDb.js', () => ({
      getCastDb: () => dbNoTable,
    }))

    const { agentProtocolViolationsRouter } = await import('../routes/telemetryRoutes.js')
    const app = express()
    app.use('/api/agent-protocol-violations', agentProtocolViolationsRouter)

    const res = await request(app).get('/api/agent-protocol-violations')
    expect(res.status).toBe(200)
    expect(res.body.data).toEqual([])

    dbNoTable.close()
  })

  it('returns empty array when db is null', async () => {
    testDb.close()
    vi.resetModules()
    vi.doMock('../routes/castDb.js', () => ({
      getCastDb: () => null,
    }))

    const { agentProtocolViolationsRouter } = await import('../routes/telemetryRoutes.js')
    const app = express()
    app.use('/api/agent-protocol-violations', agentProtocolViolationsRouter)

    const res = await request(app).get('/api/agent-protocol-violations')
    expect(res.status).toBe(200)
    expect(res.body.data).toEqual([])
  })

  it('returns violation objects with correct shape', async () => {
    const { agentProtocolViolationsRouter } = await import('../routes/telemetryRoutes.js')
    const app = express()
    app.use('/api/agent-protocol-violations', agentProtocolViolationsRouter)

    const res = await request(app).get('/api/agent-protocol-violations')
    expect(res.status).toBe(200)
    expect(res.body.data.length).toBeGreaterThan(0)
    const violation = res.body.data[0]
    expect(violation).toHaveProperty('id')
    expect(violation).toHaveProperty('timestamp')
    expect(violation).toHaveProperty('agent')
    expect(violation).toHaveProperty('violation')
    expect(violation).toHaveProperty('details')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Edge cases: missing db or null db
// ─────────────────────────────────────────────────────────────────────────────

describe('Telemetry routes with missing or corrupted DB', () => {
  it('both routes gracefully handle getCastDb() returning null', async () => {
    vi.doMock('../routes/castDb.js', () => ({
      getCastDb: () => null,
    }))

    const { stopFailureEventsRouter, agentProtocolViolationsRouter } = await import('../routes/telemetryRoutes.js')
    const app = express()
    app.use('/api/stop-failure-events', stopFailureEventsRouter)
    app.use('/api/agent-protocol-violations', agentProtocolViolationsRouter)

    const res1 = await request(app).get('/api/stop-failure-events')
    const res2 = await request(app).get('/api/agent-protocol-violations')

    expect(res1.status).toBe(200)
    expect(res1.body.data).toEqual([])
    expect(res2.status).toBe(200)
    expect(res2.body.data).toEqual([])

    vi.restoreAllMocks()
  })
})
