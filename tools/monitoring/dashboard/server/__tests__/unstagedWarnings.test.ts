import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import Database from 'better-sqlite3'
import express from 'express'
import request from 'supertest'

// Test database
let testDb: ReturnType<typeof Database> | null = null

function createTestDb(): ReturnType<typeof Database> {
  const db = new Database(':memory:')
  // Note: we deliberately do NOT create the unstaged_warnings table here
  // to test the table-exists guard behavior
  return db
}

// Mock getCastDb before importing routes
vi.mock('../routes/castDb.js', () => ({
  getCastDb: () => testDb,
}))

const { unstagedWarningsRouter } = await import('../routes/unstagedWarnings.js')

const app = express()
app.use(express.json())
app.use('/', unstagedWarningsRouter)

beforeEach(() => {
  testDb = createTestDb()
})

afterEach(() => {
  testDb?.close()
  testDb = null
})

describe('GET /api/unstaged-warnings', () => {
  it('returns 200 with correct shape { warnings: [] } when table does not exist', async () => {
    const res = await request(app).get('/')

    expect(res.status).toBe(200)
    expect(res.body).toHaveProperty('warnings')
    expect(Array.isArray(res.body.warnings)).toBe(true)
    expect(res.body.warnings).toEqual([])
  })

  it('returns warnings array when table exists and is empty', async () => {
    testDb!.exec(`
      CREATE TABLE unstaged_warnings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id TEXT,
        commit_sha TEXT,
        unstaged_files TEXT,
        in_scope_files TEXT,
        timestamp TEXT NOT NULL
      )
    `)

    const res = await request(app).get('/')

    expect(res.status).toBe(200)
    expect(res.body.warnings).toEqual([])
  })

  it('returns warnings ordered by timestamp DESC when data exists', async () => {
    testDb!.exec(`
      CREATE TABLE unstaged_warnings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id TEXT,
        commit_sha TEXT,
        unstaged_files TEXT,
        in_scope_files TEXT,
        timestamp TEXT NOT NULL
      )
    `)

    const insert = testDb!.prepare(
      'INSERT INTO unstaged_warnings (session_id, commit_sha, unstaged_files, in_scope_files, timestamp) VALUES (?, ?, ?, ?, ?)'
    )
    insert.run('sess-1', 'abc1234', '["src/App.tsx"]', '[]', '2026-05-01T10:00:00Z')
    insert.run('sess-1', 'abc1234', '["src/App.tsx"]', '[]', '2026-05-01T11:00:00Z')

    const res = await request(app).get('/')

    expect(res.status).toBe(200)
    expect(res.body.warnings).toHaveLength(2)
    expect(res.body.warnings[0].timestamp).toBe('2026-05-01T11:00:00Z')
    expect(res.body.warnings[1].timestamp).toBe('2026-05-01T10:00:00Z')
  })

  it('handles getCastDb returning null', async () => {
    testDb = null

    const res = await request(app).get('/')

    expect(res.status).toBe(200)
    expect(res.body.warnings).toEqual([])
  })
})
