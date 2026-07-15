/**
 * Supertest tests for routing endpoints
 *
 * Covers:
 * 1. GET /api/routing/events?event_type=task_claimed — returns array (even if empty), no 500
 * 2. GET /api/routing/events?event_type=user_prompt_submit — returns array
 * 3. GET /api/routing/event-types — returns array of strings
 *
 * Strategy: Mock getCastDb to return an in-memory SQLite database with test data.
 * Each test suite seeds the DB with relevant tables/rows.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import Database from 'better-sqlite3'
import express from 'express'
import request from 'supertest'

// ---------------------------------------------------------------------------
// Shared DB and mock setup
// ---------------------------------------------------------------------------

let testDb: ReturnType<typeof Database> | null = null

function createTestDb(): ReturnType<typeof Database> {
  const db = new Database(':memory:')

  // Create routing_events table
  db.exec(`
    CREATE TABLE IF NOT EXISTS routing_events (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id   TEXT,
      timestamp    TEXT,
      event_type   TEXT,
      action       TEXT,
      data         TEXT,
      project      TEXT
    );
  `)

  // Create agent_runs table (v9 canonical schema: no prompt column)
  db.exec(`
    CREATE TABLE IF NOT EXISTS agent_runs (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id   TEXT,
      agent        TEXT,
      status       TEXT,
      started_at   TEXT,
      ended_at     TEXT,
      cost_usd     REAL
    );
  `)

  // dispatch_decisions required for the prompt_preview correlated subquery
  db.exec(`
    CREATE TABLE IF NOT EXISTS dispatch_decisions (
      id           TEXT PRIMARY KEY,
      session_id   TEXT,
      chosen_agent TEXT,
      prompt_snippet TEXT,
      created_at   TEXT
    );
  `)

  return db
}

// Mock getCastDb before importing the router
vi.mock('../routes/castDb.js', () => ({
  getCastDb: () => testDb,
}))

// Import the router after mocking
const { routingRouter } = await import('../routes/routing.js')

// Create Express app with the router
const app = express()
app.use(express.json())
app.use('/api/routing', routingRouter)

beforeEach(() => {
  testDb = createTestDb()
})

afterEach(() => {
  testDb?.close()
  testDb = null
})

// ===========================================================================
// GET /api/routing/events?event_type=task_claimed
// ===========================================================================

describe('GET /api/routing/events?event_type=task_claimed', () => {
  it('returns status 200 with an array', async () => {
    const res = await request(app).get('/api/routing/events?event_type=task_claimed')
    expect(res.status).toBe(200)
    expect(Array.isArray(res.body)).toBe(true)
  })

  it('returns empty array when no events match the type', async () => {
    const res = await request(app).get('/api/routing/events?event_type=task_claimed')
    expect(res.status).toBe(200)
    expect(res.body).toEqual([])
  })

  it('returns matching events sorted by timestamp DESC', async () => {
    const db = testDb!
    db.prepare(`
      INSERT INTO routing_events (session_id, timestamp, event_type, action, project)
      VALUES (?, ?, ?, ?, ?)
    `).run('sess-1', '2026-03-31T10:30:00Z', 'task_claimed', 'code-reviewer', 'dashboard')

    db.prepare(`
      INSERT INTO routing_events (session_id, timestamp, event_type, action, project)
      VALUES (?, ?, ?, ?, ?)
    `).run('sess-2', '2026-03-31T10:25:00Z', 'task_claimed', 'test-writer', 'dashboard')

    const res = await request(app).get('/api/routing/events?event_type=task_claimed')
    expect(res.status).toBe(200)
    expect(res.body).toHaveLength(2)
    expect(res.body[0].timestamp).toBe('2026-03-31T10:30:00Z')
    expect(res.body[1].timestamp).toBe('2026-03-31T10:25:00Z')
  })

  it('includes event fields: id, session_id, timestamp, event_type, agent (action), data, project', async () => {
    const db = testDb!
    db.prepare(`
      INSERT INTO routing_events (session_id, timestamp, event_type, action, data, project)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run('sess-1', '2026-03-31T10:30:00Z', 'task_claimed', 'planner', 'some data', 'my-project')

    const res = await request(app).get('/api/routing/events?event_type=task_claimed')
    expect(res.status).toBe(200)
    expect(res.body).toHaveLength(1)

    const event = res.body[0]
    expect(event).toHaveProperty('id')
    expect(event).toHaveProperty('session_id', 'sess-1')
    expect(event).toHaveProperty('timestamp', '2026-03-31T10:30:00Z')
    expect(event).toHaveProperty('event_type', 'task_claimed')
    expect(event).toHaveProperty('agent', 'planner') // mapped from action
    expect(event).toHaveProperty('data', 'some data')
    expect(event).toHaveProperty('project', 'my-project')
  })

  it('respects limit parameter (default 100, max 1000)', async () => {
    const db = testDb!
    // Insert 150 events
    for (let i = 0; i < 150; i++) {
      db.prepare(`
        INSERT INTO routing_events (session_id, timestamp, event_type, action, project)
        VALUES (?, ?, ?, ?, ?)
      `).run(`sess-${i}`, `2026-03-31T10:${String(i % 60).padStart(2, '0')}:00Z`, 'task_claimed', 'agent-a', 'proj')
    }

    const res = await request(app).get('/api/routing/events?event_type=task_claimed&limit=50')
    expect(res.status).toBe(200)
    expect(res.body).toHaveLength(50)
  })

  it('clamps limit to 1000 even if higher is requested', async () => {
    const db = testDb!
    // Insert 1050 events
    for (let i = 0; i < 1050; i++) {
      db.prepare(`
        INSERT INTO routing_events (session_id, timestamp, event_type, action, project)
        VALUES (?, ?, ?, ?, ?)
      `).run(`sess-${i}`, '2026-03-31T10:00:00Z', 'task_claimed', 'agent-a', 'proj')
    }

    const res = await request(app).get('/api/routing/events?event_type=task_claimed&limit=2000')
    expect(res.status).toBe(200)
    expect(res.body.length).toBeLessThanOrEqual(1000)
  })

  it('returns empty array if table does not exist yet (no 500 error)', async () => {
    const db = testDb!
    // Drop the table to simulate missing table
    db.exec('DROP TABLE routing_events')

    const res = await request(app).get('/api/routing/events?event_type=task_claimed')
    expect(res.status).toBe(200)
    expect(res.body).toEqual([])
  })

  it('returns empty array if getCastDb returns null (no 500 error)', async () => {
    // Temporarily set testDb to null
    testDb = null

    const res = await request(app).get('/api/routing/events?event_type=task_claimed')
    expect(res.status).toBe(200)
    expect(res.body).toEqual([])

    // Restore for cleanup
    testDb = createTestDb()
  })
})

// ===========================================================================
// GET /api/routing/events?event_type=user_prompt_submit
// ===========================================================================

describe('GET /api/routing/events?event_type=user_prompt_submit', () => {
  it('returns status 200 with an array', async () => {
    const res = await request(app).get('/api/routing/events?event_type=user_prompt_submit')
    expect(res.status).toBe(200)
    expect(Array.isArray(res.body)).toBe(true)
  })

  it('filters by event_type and returns only matching rows', async () => {
    const db = testDb!
    db.prepare(`
      INSERT INTO routing_events (session_id, timestamp, event_type, action, project)
      VALUES (?, ?, ?, ?, ?)
    `).run('sess-1', '2026-03-31T10:30:00Z', 'user_prompt_submit', 'user', 'dashboard')

    db.prepare(`
      INSERT INTO routing_events (session_id, timestamp, event_type, action, project)
      VALUES (?, ?, ?, ?, ?)
    `).run('sess-1', '2026-03-31T10:31:00Z', 'task_claimed', 'code-reviewer', 'dashboard')

    const res = await request(app).get('/api/routing/events?event_type=user_prompt_submit')
    expect(res.status).toBe(200)
    expect(res.body).toHaveLength(1)
    expect(res.body[0].event_type).toBe('user_prompt_submit')
  })

  it('returns empty array when no matching events exist', async () => {
    const res = await request(app).get('/api/routing/events?event_type=user_prompt_submit')
    expect(res.status).toBe(200)
    expect(res.body).toEqual([])
  })

  it('returns events with all required fields', async () => {
    const db = testDb!
    db.prepare(`
      INSERT INTO routing_events (session_id, timestamp, event_type, action, data, project)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run('sess-1', '2026-03-31T10:30:00Z', 'user_prompt_submit', 'user', 'prompt text', 'proj')

    const res = await request(app).get('/api/routing/events?event_type=user_prompt_submit')
    expect(res.status).toBe(200)
    expect(res.body[0]).toHaveProperty('id')
    expect(res.body[0]).toHaveProperty('session_id')
    expect(res.body[0]).toHaveProperty('timestamp')
    expect(res.body[0]).toHaveProperty('event_type')
  })
})

// ===========================================================================
// GET /api/routing/event-types
// ===========================================================================

describe('GET /api/routing/event-types', () => {
  it('returns status 200 with an array of strings', async () => {
    const res = await request(app).get('/api/routing/event-types')
    expect(res.status).toBe(200)
    expect(Array.isArray(res.body)).toBe(true)
    expect(res.body.every((item: unknown) => typeof item === 'string')).toBe(true)
  })

  it('returns empty array when routing_events table is empty', async () => {
    const res = await request(app).get('/api/routing/event-types')
    expect(res.status).toBe(200)
    expect(res.body).toEqual([])
  })

  it('returns distinct event_type values from routing_events', async () => {
    const db = testDb!
    db.prepare(`
      INSERT INTO routing_events (event_type) VALUES (?)
    `).run('task_claimed')

    db.prepare(`
      INSERT INTO routing_events (event_type) VALUES (?)
    `).run('user_prompt_submit')

    db.prepare(`
      INSERT INTO routing_events (event_type) VALUES (?)
    `).run('context_compacted')

    const res = await request(app).get('/api/routing/event-types')
    expect(res.status).toBe(200)
    expect(res.body).toHaveLength(3)
    expect(res.body).toContain('task_claimed')
    expect(res.body).toContain('user_prompt_submit')
    expect(res.body).toContain('context_compacted')
  })

  it('returns sorted event types in ascending order', async () => {
    const db = testDb!
    db.prepare(`INSERT INTO routing_events (event_type) VALUES (?)`).run('zebra_event')
    db.prepare(`INSERT INTO routing_events (event_type) VALUES (?)`).run('alpha_event')
    db.prepare(`INSERT INTO routing_events (event_type) VALUES (?)`).run('delta_event')

    const res = await request(app).get('/api/routing/event-types')
    expect(res.status).toBe(200)
    expect(res.body).toEqual(['alpha_event', 'delta_event', 'zebra_event'])
  })

  it('excludes NULL event_type values', async () => {
    const db = testDb!
    db.prepare(`
      INSERT INTO routing_events (session_id, timestamp, action)
      VALUES (?, ?, ?)
    `).run('sess-1', '2026-03-31T10:00:00Z', 'agent')

    db.prepare(`
      INSERT INTO routing_events (event_type) VALUES (?)
    `).run('task_claimed')

    const res = await request(app).get('/api/routing/event-types')
    expect(res.status).toBe(200)
    expect(res.body).toHaveLength(1)
    expect(res.body[0]).toBe('task_claimed')
  })

  it('handles duplicate event_type rows (returns only distinct values)', async () => {
    const db = testDb!
    db.prepare(`INSERT INTO routing_events (event_type) VALUES (?)`).run('task_claimed')
    db.prepare(`INSERT INTO routing_events (event_type) VALUES (?)`).run('task_claimed')
    db.prepare(`INSERT INTO routing_events (event_type) VALUES (?)`).run('task_claimed')

    const res = await request(app).get('/api/routing/event-types')
    expect(res.status).toBe(200)
    expect(res.body).toHaveLength(1)
    expect(res.body[0]).toBe('task_claimed')
  })

  it('returns empty array if table does not exist yet (no 500 error)', async () => {
    const db = testDb!
    db.exec('DROP TABLE routing_events')

    const res = await request(app).get('/api/routing/event-types')
    expect(res.status).toBe(200)
    expect(res.body).toEqual([])
  })

  it('returns empty array if getCastDb returns null (no 500 error)', async () => {
    testDb = null

    const res = await request(app).get('/api/routing/event-types')
    expect(res.status).toBe(200)
    expect(res.body).toEqual([])

    testDb = createTestDb()
  })
})

// ===========================================================================
// GET /api/routing/events without event_type (queries agent_runs)
// ===========================================================================

describe('GET /api/routing/events (without event_type, queries agent_runs)', () => {
  it('returns status 200 with an array', async () => {
    const res = await request(app).get('/api/routing/events')
    expect(res.status).toBe(200)
    expect(Array.isArray(res.body)).toBe(true)
  })

  it('returns empty array when agent_runs table is empty', async () => {
    const res = await request(app).get('/api/routing/events')
    expect(res.status).toBe(200)
    expect(res.body).toEqual([])
  })

  it('returns agent runs sorted by started_at DESC', async () => {
    const db = testDb!
    db.prepare(`
      INSERT INTO agent_runs (agent, status, started_at, ended_at)
      VALUES (?, ?, ?, ?)
    `).run('code-reviewer', 'DONE', '2026-03-31T10:00:00Z', '2026-03-31T10:05:00Z')

    db.prepare(`
      INSERT INTO agent_runs (agent, status, started_at, ended_at)
      VALUES (?, ?, ?, ?)
    `).run('test-writer', 'DONE', '2026-03-31T10:30:00Z', '2026-03-31T10:35:00Z')

    const res = await request(app).get('/api/routing/events')
    expect(res.status).toBe(200)
    expect(res.body).toHaveLength(2)
    expect(res.body[0].started_at).toBe('2026-03-31T10:30:00Z') // Most recent first
    expect(res.body[1].started_at).toBe('2026-03-31T10:00:00Z')
  })

  it('includes computed fields: id, session_id, agent, status, started_at, completed_at, duration_ms, prompt_preview, cost_usd', async () => {
    const db = testDb!
    db.prepare(`
      INSERT INTO agent_runs (session_id, agent, status, started_at, ended_at, cost_usd)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run('sess-1', 'planner', 'DONE', '2026-03-31T10:00:00Z', '2026-03-31T10:02:00Z', 0.005)

    // Seed matching dispatch_decisions row so prompt_preview is populated via correlated subquery
    db.prepare(`
      INSERT INTO dispatch_decisions (id, session_id, chosen_agent, prompt_snippet, created_at)
      VALUES (?, ?, ?, ?, ?)
    `).run('dd-1', 'sess-1', 'planner', 'Plan feature', '2026-03-31 09:59:55')

    const res = await request(app).get('/api/routing/events')
    expect(res.status).toBe(200)
    expect(res.body).toHaveLength(1)

    const run = res.body[0]
    expect(run).toHaveProperty('id')
    expect(run).toHaveProperty('session_id', 'sess-1')
    expect(run).toHaveProperty('agent', 'planner')
    expect(run).toHaveProperty('status', 'DONE')
    expect(run).toHaveProperty('started_at', '2026-03-31T10:00:00Z')
    expect(run).toHaveProperty('completed_at', '2026-03-31T10:02:00Z')
    expect(run).toHaveProperty('duration_ms') // computed
    expect(run).toHaveProperty('prompt_preview', 'Plan feature')
    expect(run).toHaveProperty('cost_usd', 0.005)
  })

  it('calculates duration_ms from started_at and ended_at', async () => {
    const db = testDb!
    // 2 minutes = 120,000 ms
    db.prepare(`
      INSERT INTO agent_runs (agent, status, started_at, ended_at)
      VALUES (?, ?, ?, ?)
    `).run('code-reviewer', 'DONE', '2026-03-31T10:00:00Z', '2026-03-31T10:02:00Z')

    const res = await request(app).get('/api/routing/events')
    expect(res.status).toBe(200)
    expect(res.body[0]).toHaveProperty('duration_ms')
    expect(res.body[0].duration_ms).toBe(120000)
  })

  it('prompt_preview is null when no dispatch_decisions row matches (correct, not a 500)', async () => {
    const db = testDb!
    db.prepare(`
      INSERT INTO agent_runs (agent, status, started_at, ended_at)
      VALUES (?, ?, ?, ?)
    `).run('planner', 'DONE', '2026-03-31T10:00:00Z', '2026-03-31T10:05:00Z')

    const res = await request(app).get('/api/routing/events')
    expect(res.status).toBe(200)
    expect(res.body).toHaveLength(1)
    // No matching dispatch_decisions row → prompt_preview is null (not a 500)
    expect(res.body[0]).toHaveProperty('prompt_preview', null)
  })

  it('respects limit parameter', async () => {
    const db = testDb!
    for (let i = 0; i < 120; i++) {
      db.prepare(`
        INSERT INTO agent_runs (agent, status, started_at, ended_at)
        VALUES (?, ?, ?, ?)
      `).run(`agent-${i}`, 'DONE', '2026-03-31T10:00:00Z', '2026-03-31T10:05:00Z')
    }

    const res = await request(app).get('/api/routing/events?limit=50')
    expect(res.status).toBe(200)
    expect(res.body).toHaveLength(50)
  })

  it('returns empty array if table does not exist yet (no 500 error)', async () => {
    const db = testDb!
    db.exec('DROP TABLE agent_runs')

    const res = await request(app).get('/api/routing/events')
    expect(res.status).toBe(200)
    expect(res.body).toEqual([])
  })
})
