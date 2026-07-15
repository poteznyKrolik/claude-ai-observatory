import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest'
import express from 'express'
import request from 'supertest'
import Database from 'better-sqlite3'

// C5: the explorer interpolates the table name into SQL, defended by a denylist +
// a sqlite_master existence check. Assert those guards + the happy path. In-memory
// DB via a mocked getCastDb — no real cast.db / $HOME.
const h = vi.hoisted(() => ({ db: null as unknown as import('better-sqlite3').Database }))
vi.mock('../routes/castDb.js', () => ({ getCastDb: () => h.db }))

const { sqliteExplorerRouter } = await import('../routes/sqliteExplorer.js')

function makeApp() {
  const app = express()
  app.use('/api/cast/explore', sqliteExplorerRouter)
  return app
}

beforeAll(() => {
  h.db = new Database(':memory:')
  h.db.exec('CREATE TABLE widgets (id INTEGER PRIMARY KEY, name TEXT)')
  const ins = h.db.prepare('INSERT INTO widgets (name) VALUES (?)')
  ins.run('a'); ins.run('b'); ins.run('c')
})
afterAll(() => { h.db?.close() })

describe('sqliteExplorer route', () => {
  it('rejects a denied (sqlite_*) table name with 400', async () => {
    const res = await request(makeApp()).get('/api/cast/explore/sqlite_master')
    expect(res.status).toBe(400)
  })

  it('returns 404 for a table that does not exist', async () => {
    const res = await request(makeApp()).get('/api/cast/explore/does_not_exist')
    expect(res.status).toBe(404)
  })

  it('returns columns, rows, and total for a real table (newest-first by id)', async () => {
    const res = await request(makeApp()).get('/api/cast/explore/widgets')
    expect(res.status).toBe(200)
    expect(res.body.columns).toEqual(['id', 'name'])
    expect(res.body.total).toBe(3)
    expect(res.body.rows).toHaveLength(3)
    expect(res.body.rows[0].id).toBe(3) // ORDER BY id DESC
  })

  it('clamps limit to the 1..200 range', async () => {
    const res = await request(makeApp()).get('/api/cast/explore/widgets?limit=9999')
    expect(res.status).toBe(200)
    expect(res.body.rows.length).toBeLessThanOrEqual(200)
  })

  it('GET /tables lists real tables with row counts', async () => {
    const res = await request(makeApp()).get('/api/cast/explore/tables')
    expect(res.status).toBe(200)
    const widgets = res.body.tables.find((t: { name: string }) => t.name === 'widgets')
    expect(widgets?.rowCount).toBe(3)
  })
})
