import { Router } from 'express'
import { getCastDb } from './castDb.js'

export const compactionEventsRouter = Router()

// GET /api/cast/compaction-events
compactionEventsRouter.get('/', (req, res) => {
  try {
    const db = getCastDb()
    if (!db) {
      return res.json({ events: [] })
    }

    const tableCheck = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='compaction_events'"
    ).get()
    if (!tableCheck) {
      return res.json({ events: [] })
    }

    const limit = Math.max(1, Math.min(Number(req.query.limit) || 100, 500))

    const events = db.prepare(`
      SELECT
        id,
        session_id,
        timestamp,
        trigger,
        compaction_tier,
        transcript_path
      FROM compaction_events
      ORDER BY timestamp DESC
      LIMIT ?
    `).all(limit) as Array<{
      id: string; session_id: string; timestamp: string;
      trigger: string; compaction_tier: string | null; transcript_path: string | null
    }>

    res.json({ events })
  } catch (err) {
    console.error('[compaction-events] error:', err)
    res.json({ events: [] })
  }
})
