/**
 * Test suite for bug fixes landed 2026-05-03
 *
 * Covers:
 * 1. Delegation savings (analytics) — haiku re-pricing math, isolation from opus
 * 2. Quality gates schema refactor — column mapping, stats by_status grouping
 * 3. Memory db-memories — removed retrieval_count field
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import Database from 'better-sqlite3'
import express from 'express'
import request from 'supertest'

// ---------------------------------------------------------------------------
// FIXTURES & MOCKS
// ---------------------------------------------------------------------------

let testDb: ReturnType<typeof Database> | null = null

function createTestDb(): ReturnType<typeof Database> {
  return new Database(':memory:')
}

// Mock getCastDb for analytics/quality-gates/memory routes
vi.mock('../routes/castDb.js', () => ({
  getCastDb: () => testDb,
  getCastDbWritable: () => testDb ? new Database(':memory:') : null,
}))

// Mock parsers for memory route
vi.mock('../parsers/memory.js', () => ({
  loadAgentMemory: vi.fn(() => []),
  loadProjectMemory: vi.fn(() => []),
}))

// Mock session parsers for analytics
vi.mock('../parsers/sessions.js', () => ({
  listSessions: vi.fn(() => []),
  getCachedSessions: vi.fn(() => []),
  loadSession: vi.fn(() => []),
}))

const { analyticsRouter } = await import('../routes/analytics.js')
const { qualityGatesRouter } = await import('../routes/qualityGates.js')
const { memoryRouter } = await import('../routes/memory.js')

const app = express()
app.use(express.json())
app.use('/api/analytics', analyticsRouter)
app.use('/api/quality-gates', qualityGatesRouter)
app.use('/api/memory', memoryRouter)

beforeEach(() => {
  testDb = createTestDb()
  vi.clearAllMocks()
})

afterEach(() => {
  if (testDb) {
    testDb.close()
    testDb = null
  }
})

// ---------------------------------------------------------------------------
// TESTS: DELEGATION SAVINGS (analytics.ts)
// ---------------------------------------------------------------------------

describe('GET /api/analytics — delegation savings', () => {
  it('computes delegationSavings with correct shape when no sessions exist', async () => {
    const res = await request(app).get('/api/analytics')

    expect(res.status).toBe(200)
    expect(res.body).toHaveProperty('delegationSavings')
    expect(res.body.delegationSavings).toHaveProperty('savedUSD')
    expect(res.body.delegationSavings).toHaveProperty('hypotheticalSonnetCostUSD')
    expect(res.body.delegationSavings).toHaveProperty('actualCostUSD')
    expect(res.body.delegationSavings).toHaveProperty('haikuUtilizationPct')
    expect(res.body.delegationSavings).toHaveProperty('dispatches')
  })

  it('returns zero savings and zero utilization when no haiku sessions exist', async () => {
    const res = await request(app).get('/api/analytics')

    expect(res.status).toBe(200)
    expect(res.body.delegationSavings.savedUSD).toBe(0)
    expect(res.body.delegationSavings.actualCostUSD).toBe(0)
    expect(res.body.delegationSavings.hypotheticalSonnetCostUSD).toBe(0)
    expect(res.body.delegationSavings.haikuUtilizationPct).toBe(0)
    expect(res.body.delegationSavings.dispatches.haiku).toBe(0)
  })

  it('counts haiku dispatches from cast.db agent_runs', async () => {
    testDb!.exec(`
      CREATE TABLE agent_runs (
        id TEXT PRIMARY KEY,
        agent TEXT,
        model TEXT,
        started_at TEXT,
        ended_at TEXT,
        status TEXT,
        input_tokens INTEGER,
        output_tokens INTEGER,
        cost_usd REAL,
        task_summary TEXT
      )
    `)

    const today = new Date().toISOString().slice(0, 10)
    const insert = testDb!.prepare(
      'INSERT INTO agent_runs (id, agent, model, started_at, status, input_tokens, output_tokens, cost_usd) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    )
    insert.run(`run-1`, 'test-writer', 'claude-3-5-haiku-20241022', `${today}T10:00:00Z`, 'DONE', 1000, 500, 0.001)
    insert.run(`run-2`, 'code-reviewer', 'claude-3-5-haiku-20241022', `${today}T11:00:00Z`, 'DONE', 2000, 1000, 0.002)

    const res = await request(app).get('/api/analytics')

    expect(res.status).toBe(200)
    expect(res.body.delegationSavings.dispatches.haiku).toBe(2)
  })

  it('separates haiku, sonnet, and opus dispatch counts from agent_runs', async () => {
    testDb!.exec(`
      CREATE TABLE agent_runs (
        id TEXT PRIMARY KEY,
        agent TEXT,
        model TEXT,
        started_at TEXT,
        ended_at TEXT,
        status TEXT,
        input_tokens INTEGER,
        output_tokens INTEGER,
        cost_usd REAL,
        task_summary TEXT
      )
    `)

    const today = new Date().toISOString().slice(0, 10)
    const insert = testDb!.prepare(
      'INSERT INTO agent_runs (id, agent, model, started_at, status, input_tokens, output_tokens, cost_usd) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    )
    insert.run(`h1`, 'test-writer', 'claude-3-5-haiku-20241022', `${today}T10:00:00Z`, 'DONE', 1000, 500, 0.001)
    insert.run(`s1`, 'code-writer', 'claude-3-5-sonnet-20241022', `${today}T11:00:00Z`, 'DONE', 5000, 2000, 0.05)
    insert.run(`o1`, 'debugger', 'claude-3-5-opus-20241022', `${today}T12:00:00Z`, 'DONE', 10000, 5000, 0.5)

    const res = await request(app).get('/api/analytics')

    expect(res.status).toBe(200)
    expect(res.body.delegationSavings.dispatches.haiku).toBe(1)
    expect(res.body.delegationSavings.dispatches.sonnet).toBe(1)
    expect(res.body.delegationSavings.dispatches.opus).toBe(1)
  })

  it('computes haikuUtilizationPct as 100 when all dispatches are haiku', async () => {
    testDb!.exec(`
      CREATE TABLE agent_runs (
        id TEXT PRIMARY KEY,
        agent TEXT,
        model TEXT,
        started_at TEXT,
        ended_at TEXT,
        status TEXT,
        input_tokens INTEGER,
        output_tokens INTEGER,
        cost_usd REAL,
        task_summary TEXT
      )
    `)

    const today = new Date().toISOString().slice(0, 10)
    const insert = testDb!.prepare(
      'INSERT INTO agent_runs (id, agent, model, started_at, status, input_tokens, output_tokens, cost_usd) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    )
    insert.run(`h1`, 'test-writer', 'claude-3-5-haiku-20241022', `${today}T10:00:00Z`, 'DONE', 1000, 500, 0.001)
    insert.run(`h2`, 'code-reviewer', 'claude-3-5-haiku-20241022', `${today}T11:00:00Z`, 'DONE', 2000, 1000, 0.002)

    const res = await request(app).get('/api/analytics')

    expect(res.status).toBe(200)
    expect(res.body.delegationSavings.haikuUtilizationPct).toBe(100)
    expect(res.body.delegationSavings.dispatches.haiku).toBe(2)
  })

  it('isolates haiku cost from sonnet/opus when computing savings', async () => {
    testDb!.exec(`
      CREATE TABLE agent_runs (
        id TEXT PRIMARY KEY,
        agent TEXT,
        model TEXT,
        started_at TEXT,
        ended_at TEXT,
        status TEXT,
        input_tokens INTEGER,
        output_tokens INTEGER,
        cost_usd REAL,
        task_summary TEXT
      )
    `)

    const today = new Date().toISOString().slice(0, 10)
    const insert = testDb!.prepare(
      'INSERT INTO agent_runs (id, agent, model, started_at, status, input_tokens, output_tokens, cost_usd) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    )
    // 1 haiku: should contribute to actualHaikuCostUSD only, not baseline
    insert.run(`h1`, 'test-writer', 'claude-3-5-haiku-20241022', `${today}T10:00:00Z`, 'DONE', 1000, 500, 0.001)
    // 1 sonnet: should NOT affect haiku savings calculation
    insert.run(`s1`, 'code-writer', 'claude-3-5-sonnet-20241022', `${today}T11:00:00Z`, 'DONE', 5000, 2000, 0.05)

    const res = await request(app).get('/api/analytics')

    expect(res.status).toBe(200)
    // actualCostUSD should only include haiku cost (0.001), not sonnet (0.05)
    expect(res.body.delegationSavings.actualCostUSD).toBeLessThan(0.01)
    // savings should be positive if haiku costs less than sonnet would
    expect(res.body.delegationSavings.savedUSD).toBeGreaterThanOrEqual(0)
  })

  it('prevents negative savings via Math.max(0, ...)', async () => {
    testDb!.exec(`
      CREATE TABLE agent_runs (
        id TEXT PRIMARY KEY,
        agent TEXT,
        model TEXT,
        started_at TEXT,
        ended_at TEXT,
        status TEXT,
        input_tokens INTEGER,
        output_tokens INTEGER,
        cost_usd REAL,
        task_summary TEXT
      )
    `)

    const today = new Date().toISOString().slice(0, 10)
    const insert = testDb!.prepare(
      'INSERT INTO agent_runs (id, agent, model, started_at, status, input_tokens, output_tokens, cost_usd) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    )
    insert.run(`h1`, 'test-writer', 'claude-3-5-haiku-20241022', `${today}T10:00:00Z`, 'DONE', 1000, 500, 0.001)

    const res = await request(app).get('/api/analytics')

    expect(res.status).toBe(200)
    expect(res.body.delegationSavings.savedUSD).toBeGreaterThanOrEqual(0)
  })
})

// ---------------------------------------------------------------------------
// TESTS: QUALITY GATES SCHEMA (qualityGates.ts)
// ---------------------------------------------------------------------------

describe('GET /api/quality-gates', () => {
  it('returns empty gates array when table does not exist', async () => {
    const res = await request(app).get('/api/quality-gates')

    expect(res.status).toBe(200)
    expect(res.body).toHaveProperty('gates')
    expect(Array.isArray(res.body.gates)).toBe(true)
    expect(res.body.gates).toEqual([])
  })

  it('returns gates with correct columns: id, session_id, agent, status_line, contract_passed, retry_count, created_at', async () => {
    testDb!.exec(`
      CREATE TABLE quality_gates (
        id INTEGER PRIMARY KEY,
        session_id TEXT,
        agent_name TEXT,
        status_line TEXT,
        contract_passed INTEGER,
        retry_count INTEGER,
        timestamp TEXT
      )
    `)

    const insert = testDb!.prepare(
      'INSERT INTO quality_gates (session_id, agent_name, status_line, contract_passed, retry_count, timestamp) VALUES (?, ?, ?, ?, ?, ?)'
    )
    insert.run('sess-1', 'code-reviewer', 'DONE', 1, 0, '2026-05-03T10:00:00Z')

    const res = await request(app).get('/api/quality-gates')

    expect(res.status).toBe(200)
    expect(res.body.gates).toHaveLength(1)
    const gate = res.body.gates[0]
    expect(gate).toHaveProperty('id')
    expect(gate).toHaveProperty('session_id', 'sess-1')
    expect(gate).toHaveProperty('agent', 'code-reviewer')
    expect(gate).toHaveProperty('status_line', 'DONE')
    expect(gate).toHaveProperty('contract_passed', 1)
    expect(gate).toHaveProperty('retry_count', 0)
    expect(gate).toHaveProperty('created_at', '2026-05-03T10:00:00Z')
  })

  it('does NOT include removed columns: gate_type, feedback, artifact_count', async () => {
    testDb!.exec(`
      CREATE TABLE quality_gates (
        id INTEGER PRIMARY KEY,
        session_id TEXT,
        agent_name TEXT,
        status_line TEXT,
        contract_passed INTEGER,
        retry_count INTEGER,
        timestamp TEXT
      )
    `)

    const insert = testDb!.prepare(
      'INSERT INTO quality_gates (session_id, agent_name, status_line, contract_passed, retry_count, timestamp) VALUES (?, ?, ?, ?, ?, ?)'
    )
    insert.run('sess-1', 'code-reviewer', 'DONE', 1, 0, '2026-05-03T10:00:00Z')

    const res = await request(app).get('/api/quality-gates')

    expect(res.status).toBe(200)
    const gate = res.body.gates[0]
    expect(gate).not.toHaveProperty('gate_type')
    expect(gate).not.toHaveProperty('feedback')
    expect(gate).not.toHaveProperty('artifact_count')
    expect(gate).not.toHaveProperty('gate_result')
  })

  it('filters by agent parameter', async () => {
    testDb!.exec(`
      CREATE TABLE quality_gates (
        id INTEGER PRIMARY KEY,
        session_id TEXT,
        agent_name TEXT,
        status_line TEXT,
        contract_passed INTEGER,
        retry_count INTEGER,
        timestamp TEXT
      )
    `)

    const insert = testDb!.prepare(
      'INSERT INTO quality_gates (session_id, agent_name, status_line, contract_passed, retry_count, timestamp) VALUES (?, ?, ?, ?, ?, ?)'
    )
    insert.run('sess-1', 'code-reviewer', 'DONE', 1, 0, '2026-05-03T10:00:00Z')
    insert.run('sess-2', 'test-writer', 'DONE', 1, 0, '2026-05-03T11:00:00Z')

    const res = await request(app).get('/api/quality-gates?agent=code-reviewer')

    expect(res.status).toBe(200)
    expect(res.body.gates).toHaveLength(1)
    expect(res.body.gates[0].agent).toBe('code-reviewer')
  })

  it('filters by since and until timestamps', async () => {
    testDb!.exec(`
      CREATE TABLE quality_gates (
        id INTEGER PRIMARY KEY,
        session_id TEXT,
        agent_name TEXT,
        status_line TEXT,
        contract_passed INTEGER,
        retry_count INTEGER,
        timestamp TEXT
      )
    `)

    const insert = testDb!.prepare(
      'INSERT INTO quality_gates (session_id, agent_name, status_line, contract_passed, retry_count, timestamp) VALUES (?, ?, ?, ?, ?, ?)'
    )
    insert.run('sess-1', 'code-reviewer', 'DONE', 1, 0, '2026-05-01T10:00:00Z')
    insert.run('sess-2', 'code-reviewer', 'DONE', 1, 0, '2026-05-03T10:00:00Z')
    insert.run('sess-3', 'code-reviewer', 'DONE', 1, 0, '2026-05-05T10:00:00Z')

    const res = await request(app).get('/api/quality-gates?since=2026-05-02&until=2026-05-04')

    expect(res.status).toBe(200)
    expect(res.body.gates).toHaveLength(1)
    expect(res.body.gates[0].session_id).toBe('sess-2')
  })

  it('orders by timestamp DESC', async () => {
    testDb!.exec(`
      CREATE TABLE quality_gates (
        id INTEGER PRIMARY KEY,
        session_id TEXT,
        agent_name TEXT,
        status_line TEXT,
        contract_passed INTEGER,
        retry_count INTEGER,
        timestamp TEXT
      )
    `)

    const insert = testDb!.prepare(
      'INSERT INTO quality_gates (session_id, agent_name, status_line, contract_passed, retry_count, timestamp) VALUES (?, ?, ?, ?, ?, ?)'
    )
    insert.run('sess-1', 'code-reviewer', 'DONE', 1, 0, '2026-05-01T10:00:00Z')
    insert.run('sess-2', 'code-reviewer', 'DONE', 1, 0, '2026-05-03T10:00:00Z')

    const res = await request(app).get('/api/quality-gates')

    expect(res.status).toBe(200)
    expect(res.body.gates[0].session_id).toBe('sess-2')
    expect(res.body.gates[1].session_id).toBe('sess-1')
  })
})

describe('GET /api/quality-gates/stats', () => {
  it('returns stats with correct shape when table does not exist', async () => {
    const res = await request(app).get('/api/quality-gates/stats')

    expect(res.status).toBe(200)
    expect(res.body).toHaveProperty('total', 0)
    expect(res.body).toHaveProperty('pass_rate', 0)
    expect(res.body).toHaveProperty('by_agent')
    expect(res.body).toHaveProperty('by_status')
    expect(typeof res.body.by_agent).toBe('object')
    expect(typeof res.body.by_status).toBe('object')
  })

  it('computes pass_rate using contract_passed = 1', async () => {
    testDb!.exec(`
      CREATE TABLE quality_gates (
        id INTEGER PRIMARY KEY,
        session_id TEXT,
        agent_name TEXT,
        status_line TEXT,
        contract_passed INTEGER,
        retry_count INTEGER,
        timestamp TEXT
      )
    `)

    const insert = testDb!.prepare(
      'INSERT INTO quality_gates (session_id, agent_name, status_line, contract_passed, retry_count, timestamp) VALUES (?, ?, ?, ?, ?, ?)'
    )
    insert.run('sess-1', 'code-reviewer', 'DONE', 1, 0, '2026-05-03T10:00:00Z')
    insert.run('sess-2', 'code-reviewer', 'DONE', 1, 0, '2026-05-03T11:00:00Z')
    insert.run('sess-3', 'code-reviewer', 'BLOCKED', 0, 1, '2026-05-03T12:00:00Z')

    const res = await request(app).get('/api/quality-gates/stats')

    expect(res.status).toBe(200)
    expect(res.body.total).toBe(3)
    expect(res.body.pass_rate).toBe(67) // 2/3 = 66.67 -> rounded to 67
  })

  it('groups by_status using status_line field', async () => {
    testDb!.exec(`
      CREATE TABLE quality_gates (
        id INTEGER PRIMARY KEY,
        session_id TEXT,
        agent_name TEXT,
        status_line TEXT,
        contract_passed INTEGER,
        retry_count INTEGER,
        timestamp TEXT
      )
    `)

    const insert = testDb!.prepare(
      'INSERT INTO quality_gates (session_id, agent_name, status_line, contract_passed, retry_count, timestamp) VALUES (?, ?, ?, ?, ?, ?)'
    )
    insert.run('sess-1', 'code-reviewer', 'DONE', 1, 0, '2026-05-03T10:00:00Z')
    insert.run('sess-2', 'code-reviewer', 'DONE', 1, 0, '2026-05-03T11:00:00Z')
    insert.run('sess-3', 'code-reviewer', 'BLOCKED', 0, 1, '2026-05-03T12:00:00Z')

    const res = await request(app).get('/api/quality-gates/stats')

    expect(res.status).toBe(200)
    expect(res.body.by_status).toHaveProperty('DONE', 2)
    expect(res.body.by_status).toHaveProperty('BLOCKED', 1)
  })

  it('groups by_agent with pass_rate and total per agent', async () => {
    testDb!.exec(`
      CREATE TABLE quality_gates (
        id INTEGER PRIMARY KEY,
        session_id TEXT,
        agent_name TEXT,
        status_line TEXT,
        contract_passed INTEGER,
        retry_count INTEGER,
        timestamp TEXT
      )
    `)

    const insert = testDb!.prepare(
      'INSERT INTO quality_gates (session_id, agent_name, status_line, contract_passed, retry_count, timestamp) VALUES (?, ?, ?, ?, ?, ?)'
    )
    insert.run('sess-1', 'code-reviewer', 'DONE', 1, 0, '2026-05-03T10:00:00Z')
    insert.run('sess-2', 'test-writer', 'DONE', 1, 0, '2026-05-03T11:00:00Z')
    insert.run('sess-3', 'test-writer', 'BLOCKED', 0, 1, '2026-05-03T12:00:00Z')

    const res = await request(app).get('/api/quality-gates/stats')

    expect(res.status).toBe(200)
    expect(res.body.by_agent).toHaveProperty('code-reviewer')
    expect(res.body.by_agent['code-reviewer']).toEqual({
      total: 1,
      passed: 1,
      rate: 100,
    })
    expect(res.body.by_agent['test-writer']).toEqual({
      total: 2,
      passed: 1,
      rate: 50,
    })
  })

  it('filters stats by since/until timestamps', async () => {
    testDb!.exec(`
      CREATE TABLE quality_gates (
        id INTEGER PRIMARY KEY,
        session_id TEXT,
        agent_name TEXT,
        status_line TEXT,
        contract_passed INTEGER,
        retry_count INTEGER,
        timestamp TEXT
      )
    `)

    const insert = testDb!.prepare(
      'INSERT INTO quality_gates (session_id, agent_name, status_line, contract_passed, retry_count, timestamp) VALUES (?, ?, ?, ?, ?, ?)'
    )
    insert.run('sess-1', 'code-reviewer', 'DONE', 1, 0, '2026-05-01T10:00:00Z')
    insert.run('sess-2', 'code-reviewer', 'DONE', 1, 0, '2026-05-03T10:00:00Z')
    insert.run('sess-3', 'code-reviewer', 'BLOCKED', 0, 1, '2026-05-05T10:00:00Z')

    const res = await request(app).get('/api/quality-gates/stats?since=2026-05-02&until=2026-05-04')

    expect(res.status).toBe(200)
    expect(res.body.total).toBe(1)
    expect(res.body.pass_rate).toBe(100)
  })
})

// ---------------------------------------------------------------------------
// TESTS: MEMORY DB-MEMORIES (memory.ts)
// ---------------------------------------------------------------------------

describe('GET /api/memory/db-memories', () => {
  it('returns empty memories array when table does not exist', async () => {
    const res = await request(app).get('/api/memory/db-memories')

    expect(res.status).toBe(200)
    expect(res.body).toHaveProperty('memories')
    expect(Array.isArray(res.body.memories)).toBe(true)
    expect(res.body.memories).toEqual([])
  })

  it('returns memories with correct columns: id, agent, project, type, name, description, content, importance, decay_rate, created_at, updated_at', async () => {
    testDb!.exec(`
      CREATE TABLE agent_memories (
        id TEXT PRIMARY KEY,
        agent TEXT,
        project TEXT,
        type TEXT,
        name TEXT,
        description TEXT,
        content TEXT,
        importance REAL,
        decay_rate REAL,
        created_at TEXT,
        updated_at TEXT
      )
    `)

    const insert = testDb!.prepare(
      'INSERT INTO agent_memories (id, agent, project, type, name, description, content, importance, decay_rate, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    )
    insert.run(
      'mem-1',
      'code-reviewer',
      'claude-code-dashboard',
      'feedback',
      'review_patterns',
      'Code review patterns',
      'Pattern: always use getByRole...',
      0.8,
      0.1,
      '2026-05-01T10:00:00Z',
      '2026-05-03T10:00:00Z'
    )

    const res = await request(app).get('/api/memory/db-memories')

    expect(res.status).toBe(200)
    expect(res.body.memories).toHaveLength(1)
    const mem = res.body.memories[0]
    expect(mem).toHaveProperty('id', 'mem-1')
    expect(mem).toHaveProperty('agent', 'code-reviewer')
    expect(mem).toHaveProperty('project', 'claude-code-dashboard')
    expect(mem).toHaveProperty('type', 'feedback')
    expect(mem).toHaveProperty('name', 'review_patterns')
    expect(mem).toHaveProperty('description', 'Code review patterns')
    expect(mem).toHaveProperty('content')
    expect(mem).toHaveProperty('importance', 0.8)
    expect(mem).toHaveProperty('decay_rate', 0.1)
    expect(mem).toHaveProperty('created_at')
    expect(mem).toHaveProperty('updated_at')
  })

  it('does NOT include removed field: retrieval_count', async () => {
    testDb!.exec(`
      CREATE TABLE agent_memories (
        id TEXT PRIMARY KEY,
        agent TEXT,
        project TEXT,
        type TEXT,
        name TEXT,
        description TEXT,
        content TEXT,
        importance REAL,
        decay_rate REAL,
        created_at TEXT,
        updated_at TEXT
      )
    `)

    const insert = testDb!.prepare(
      'INSERT INTO agent_memories (id, agent, project, type, name, description, content, importance, decay_rate, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    )
    insert.run(
      'mem-1',
      'code-reviewer',
      null,
      'feedback',
      'review_patterns',
      'Code review patterns',
      'Pattern: always use getByRole...',
      0.8,
      0.1,
      '2026-05-01T10:00:00Z',
      '2026-05-03T10:00:00Z'
    )

    const res = await request(app).get('/api/memory/db-memories')

    expect(res.status).toBe(200)
    const mem = res.body.memories[0]
    expect(mem).not.toHaveProperty('retrieval_count')
  })

  it('orders by updated_at DESC', async () => {
    testDb!.exec(`
      CREATE TABLE agent_memories (
        id TEXT PRIMARY KEY,
        agent TEXT,
        project TEXT,
        type TEXT,
        name TEXT,
        description TEXT,
        content TEXT,
        importance REAL,
        decay_rate REAL,
        created_at TEXT,
        updated_at TEXT
      )
    `)

    const insert = testDb!.prepare(
      'INSERT INTO agent_memories (id, agent, project, type, name, description, content, importance, decay_rate, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    )
    insert.run(
      'mem-1',
      'code-reviewer',
      null,
      'feedback',
      'p1',
      'old',
      'content1',
      0.8,
      0.1,
      '2026-05-01T10:00:00Z',
      '2026-05-01T10:00:00Z'
    )
    insert.run(
      'mem-2',
      'code-reviewer',
      null,
      'feedback',
      'p2',
      'new',
      'content2',
      0.9,
      0.1,
      '2026-05-03T10:00:00Z',
      '2026-05-03T10:00:00Z'
    )

    const res = await request(app).get('/api/memory/db-memories')

    expect(res.status).toBe(200)
    expect(res.body.memories[0].id).toBe('mem-2')
    expect(res.body.memories[1].id).toBe('mem-1')
  })

  it('limits result to 500 records', async () => {
    testDb!.exec(`
      CREATE TABLE agent_memories (
        id TEXT PRIMARY KEY,
        agent TEXT,
        project TEXT,
        type TEXT,
        name TEXT,
        description TEXT,
        content TEXT,
        importance REAL,
        decay_rate REAL,
        created_at TEXT,
        updated_at TEXT
      )
    `)

    const insert = testDb!.prepare(
      'INSERT INTO agent_memories (id, agent, project, type, name, description, content, importance, decay_rate, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    )
    // Insert 510 rows (greater than limit)
    for (let i = 0; i < 510; i++) {
      insert.run(
        `mem-${i}`,
        'code-reviewer',
        null,
        'feedback',
        `pattern-${i}`,
        'test',
        `content-${i}`,
        0.8,
        0.1,
        '2026-05-01T10:00:00Z',
        `2026-05-03T${String(i).padStart(5, '0')}:00Z`
      )
    }

    const res = await request(app).get('/api/memory/db-memories')

    expect(res.status).toBe(200)
    expect(res.body.memories.length).toBe(500)
  })

  it('handles getCastDb returning null', async () => {
    testDb = null

    const res = await request(app).get('/api/memory/db-memories')

    expect(res.status).toBe(200)
    expect(res.body.memories).toEqual([])
  })
})
