import { Router } from 'express'
import { getCastDb } from './castDb.js'

export interface HookFailureRow {
  id: string
  hook_name: string
  exit_code: number
  stderr: string | null
  session_id: string | null
  timestamp: string
}

export const hookFailuresRouter = Router()

// GET /api/hook-failures — list all, optional ?since=ISO filter
hookFailuresRouter.get('/', (req, res) => {
  try {
    const db = getCastDb()
    if (!db) return res.json({ failures: [] })
    const tableCheck = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='hook_failures'"
    ).get()
    if (!tableCheck) return res.json({ failures: [] })

    const since = req.query.since as string | undefined
    const conditions: string[] = []
    const params: unknown[] = []
    if (since) { conditions.push('timestamp >= ?'); params.push(since) }
    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

    const failures = db.prepare(`
      SELECT id, hook_name, exit_code, stderr, session_id, timestamp
      FROM hook_failures
      ${where}
      ORDER BY timestamp DESC
      LIMIT 200
    `).all(...params) as HookFailureRow[]

    return res.json({ failures })
  } catch (err) {
    console.error('[hook-failures] error:', err)
    return res.json({ failures: [] })
  }
})

// GET /api/hook-failures/count — count failures in the last 24h for badge
hookFailuresRouter.get('/count', (_req, res) => {
  try {
    const db = getCastDb()
    if (!db) return res.json({ count: 0 })
    const tableCheck = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='hook_failures'"
    ).get()
    if (!tableCheck) return res.json({ count: 0 })

    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    const row = db.prepare(
      `SELECT COUNT(*) AS cnt FROM hook_failures WHERE timestamp >= ?`
    ).get(since) as { cnt: number }

    return res.json({ count: row.cnt ?? 0 })
  } catch (err) {
    console.error('[hook-failures/count] error:', err)
    return res.json({ count: 0 })
  }
})
