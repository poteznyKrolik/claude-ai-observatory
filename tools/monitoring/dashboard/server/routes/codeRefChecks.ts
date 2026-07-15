import { Router } from 'express'
import { getCastDb } from './castDb.js'

export interface CodeRefCheckRow {
  id: number
  session_id: string | null
  agent_name: string | null
  ref_type: string | null
  ref_name: string | null
  verified: number | null
  location: string | null
  timestamp: string | null
}

export const codeRefChecksRouter = Router()

const TABLE = 'code_ref_checks'

function tableExists(): boolean {
  const db = getCastDb()
  if (!db) return false
  const row = db.prepare(
    "SELECT name FROM sqlite_master WHERE type='table' AND name=?"
  ).get(TABLE)
  return !!row
}

// GET /api/code-ref-checks — paginated list ordered by timestamp DESC
codeRefChecksRouter.get('/', (req, res) => {
  try {
    const db = getCastDb()
    if (!db || !tableExists()) return res.json({ entries: [], total: 0 })

    const rawLimit = Number(req.query.limit)
    const limit = Math.min(Number.isFinite(rawLimit) && rawLimit > 0 ? rawLimit : 50, 500)
    const offset = Math.min(Number(req.query.offset) || 0, 100_000)

    const entries = db.prepare(`
      SELECT id, session_id, agent_name, ref_type, ref_name, verified, location, timestamp
      FROM ${TABLE}
      ORDER BY timestamp DESC
      LIMIT ? OFFSET ?
    `).all(limit, offset) as CodeRefCheckRow[]

    const totalRow = db.prepare(`SELECT COUNT(*) AS cnt FROM ${TABLE}`).get() as { cnt: number }

    return res.json({ entries, total: totalRow.cnt })
  } catch (err) {
    console.error('[code-ref-checks] error:', err)
    return res.status(500).json({ error: 'Internal server error' })
  }
})

// GET /api/code-ref-checks/stats — group by verified (0/1)
codeRefChecksRouter.get('/stats', (_req, res) => {
  try {
    const db = getCastDb()
    if (!db || !tableExists()) return res.json({ byResult: {} })

    const rows = db.prepare(`
      SELECT verified, COUNT(*) AS cnt
      FROM ${TABLE}
      GROUP BY verified
    `).all() as Array<{ verified: number | null; cnt: number }>

    const byResult: Record<string, number> = {}
    for (const row of rows) {
      byResult[String(row.verified ?? 'null')] = row.cnt
    }

    return res.json({ byResult })
  } catch (err) {
    console.error('[code-ref-checks/stats] error:', err)
    return res.status(500).json({ error: 'Internal server error' })
  }
})
