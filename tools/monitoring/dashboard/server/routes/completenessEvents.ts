import { Router } from 'express'
import { getCastDb } from './castDb.js'

export interface CompletenessEventRow {
  id: number
  agent: string | null
  truncated_at: string | null
  snippet: string | null
  severity: string | null
  created_at: string | null
}

export const completenessEventsRouter = Router()

const TABLE = 'completeness_events'

function tableExists(): boolean {
  const db = getCastDb()
  if (!db) return false
  const row = db.prepare(
    "SELECT name FROM sqlite_master WHERE type='table' AND name=?"
  ).get(TABLE)
  return !!row
}

// GET /api/completeness-events — paginated list ordered by created_at DESC
completenessEventsRouter.get('/', (req, res) => {
  try {
    const db = getCastDb()
    if (!db || !tableExists()) return res.json({ entries: [], total: 0 })

    const rawLimit = Number(req.query.limit)
    const limit = Math.min(Number.isFinite(rawLimit) && rawLimit > 0 ? rawLimit : 50, 500)
    const offset = Math.min(Number(req.query.offset) || 0, 100_000)

    const entries = db.prepare(`
      SELECT id, agent, truncated_at, snippet, severity, created_at
      FROM ${TABLE}
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `).all(limit, offset) as CompletenessEventRow[]

    const totalRow = db.prepare(`SELECT COUNT(*) AS cnt FROM ${TABLE}`).get() as { cnt: number }

    return res.json({ entries, total: totalRow.cnt })
  } catch (err) {
    console.error('[completeness-events] error:', err)
    return res.status(500).json({ error: 'Internal server error' })
  }
})

// GET /api/completeness-events/stats — group by severity
completenessEventsRouter.get('/stats', (_req, res) => {
  try {
    const db = getCastDb()
    if (!db || !tableExists()) return res.json({ bySeverity: {} })

    const rows = db.prepare(`
      SELECT severity, COUNT(*) AS cnt
      FROM ${TABLE}
      GROUP BY severity
    `).all() as Array<{ severity: string | null; cnt: number }>

    const bySeverity: Record<string, number> = {}
    for (const row of rows) {
      bySeverity[row.severity ?? 'unknown'] = row.cnt
    }

    return res.json({ bySeverity })
  } catch (err) {
    console.error('[completeness-events/stats] error:', err)
    return res.status(500).json({ error: 'Internal server error' })
  }
})
