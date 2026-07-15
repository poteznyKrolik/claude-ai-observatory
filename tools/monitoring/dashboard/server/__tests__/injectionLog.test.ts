import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import Database from 'better-sqlite3'
import express from 'express'
import request from 'supertest'

// Test database
let testDb: ReturnType<typeof Database> | null = null

function createTestDb(): ReturnType<typeof Database> {
  const db = new Database(':memory:')
  // Note: we deliberately do NOT create the injection_log table here
  // to test the table-exists guard behavior
  return db
}

// Mock getCastDb before importing routes
vi.mock('../routes/castDb.js', () => ({
  getCastDb: () => testDb,
}))

const { injectionLogRouter } = await import('../routes/injectionLog.js')

const app = express()
app.use(express.json())
app.use('/', injectionLogRouter)

beforeEach(() => {
  testDb = createTestDb()
})

afterEach(() => {
  testDb?.close()
  testDb = null
})

describe('GET /api/injection-log', () => {
  it('returns 200 with correct shape { entries: [] } when table does not exist', async () => {
    const res = await request(app).get('/')

    expect(res.status).toBe(200)
    expect(res.body).toHaveProperty('entries')
    expect(Array.isArray(res.body.entries)).toBe(true)
    expect(res.body.entries).toEqual([])
  })

  it('returns entries array when table exists and is empty', async () => {
    testDb!.exec(`
      CREATE TABLE injection_log (
        id INTEGER PRIMARY KEY,
        session_id TEXT,
        prompt_hash TEXT NOT NULL,
        fact_id INTEGER NOT NULL,
        score REAL,
        injected_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `)

    const res = await request(app).get('/')

    expect(res.status).toBe(200)
    expect(res.body.entries).toEqual([])
  })

  it('returns entries ordered by injected_at DESC when data exists', async () => {
    testDb!.exec(`
      CREATE TABLE injection_log (
        id INTEGER PRIMARY KEY,
        session_id TEXT,
        prompt_hash TEXT NOT NULL,
        fact_id INTEGER NOT NULL,
        score REAL,
        injected_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `)

    const insert = testDb!.prepare(
      'INSERT INTO injection_log (session_id, prompt_hash, fact_id, score, injected_at) VALUES (?, ?, ?, ?, ?)'
    )
    insert.run('sess-1', 'abc123', 1, 0.85, '2026-05-01T10:00:00Z')
    insert.run('sess-2', 'def456', 2, 0.92, '2026-05-01T11:00:00Z')

    const res = await request(app).get('/')

    expect(res.status).toBe(200)
    expect(res.body.entries).toHaveLength(2)
    expect(res.body.entries[0].injected_at).toBe('2026-05-01T11:00:00Z')
    expect(res.body.entries[1].injected_at).toBe('2026-05-01T10:00:00Z')
    expect(res.body.entries[0].fact_id).toBe(2)
    expect(res.body.entries[0].score).toBeCloseTo(0.92)
  })

  it('handles getCastDb returning null', async () => {
    testDb = null

    const res = await request(app).get('/')

    expect(res.status).toBe(200)
    expect(res.body.entries).toEqual([])
  })
})
