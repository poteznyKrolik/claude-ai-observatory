import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import Database from 'better-sqlite3'
import express from 'express'
import request from 'supertest'

// Test database
let testDb: ReturnType<typeof Database> | null = null

function createTestDb(): ReturnType<typeof Database> {
  const db = new Database(':memory:')
  // Note: we deliberately do NOT create the parry_guard_events table here
  // to test the table-exists guard behavior
  return db
}

// Mock getCastDb before importing routes
vi.mock('../routes/castDb.js', () => ({
  getCastDb: () => testDb,
}))

const { parryGuardRouter } = await import('../routes/parryGuard.js')

const app = express()
app.use(express.json())
app.use('/', parryGuardRouter)

beforeEach(() => {
  testDb = createTestDb()
})

afterEach(() => {
  testDb?.close()
  testDb = null
})

describe('GET /api/parry-guard', () => {
  it('returns 200 with correct shape { events: [] } when table does not exist', async () => {
    const res = await request(app).get('/')

    expect(res.status).toBe(200)
    expect(res.body).toHaveProperty('events')
    expect(Array.isArray(res.body.events)).toBe(true)
    expect(res.body.events).toEqual([])
  })

  it('returns events array when table exists and is empty', async () => {
    testDb!.exec(`
      CREATE TABLE parry_guard_events (
        id INTEGER PRIMARY KEY,
        tool_name TEXT NOT NULL,
        input_snippet TEXT,
        rejected_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `)

    const res = await request(app).get('/')

    expect(res.status).toBe(200)
    expect(res.body.events).toEqual([])
  })

  it('returns events ordered by rejected_at DESC when data exists', async () => {
    testDb!.exec(`
      CREATE TABLE parry_guard_events (
        id INTEGER PRIMARY KEY,
        tool_name TEXT NOT NULL,
        input_snippet TEXT,
        rejected_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `)

    const insert = testDb!.prepare(
      'INSERT INTO parry_guard_events (tool_name, input_snippet, rejected_at) VALUES (?, ?, ?)'
    )
    insert.run('Bash', 'rm -rf /', '2026-05-01T10:00:00Z')
    insert.run('Write', 'sensitive content', '2026-05-01T11:00:00Z')

    const res = await request(app).get('/')

    expect(res.status).toBe(200)
    expect(res.body.events).toHaveLength(2)
    expect(res.body.events[0].rejected_at).toBe('2026-05-01T11:00:00Z')
    expect(res.body.events[1].rejected_at).toBe('2026-05-01T10:00:00Z')
    expect(res.body.events[0].tool_name).toBe('Write')
  })

  it('handles getCastDb returning null', async () => {
    testDb = null

    const res = await request(app).get('/')

    expect(res.status).toBe(200)
    expect(res.body.events).toEqual([])
  })
})
