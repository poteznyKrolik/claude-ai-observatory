import { Router } from 'express'
import { getCastDb } from './castDb.js'

export const stopFailureEventsRouter = Router()
export const agentProtocolViolationsRouter = Router()

// ── GET /api/stop-failure-events?limit=50 ─────────────────────────────────────
// Phase 3 prep: feeds governance annotations on work-log cards.
// Returns empty array (not 500) if table doesn't exist.

stopFailureEventsRouter.get('/', (req, res) => {
  try {
    const db = getCastDb()
    if (!db) return res.json({ data: [] })

    const limit = Math.max(1, Math.min(Number(req.query.limit) || 50, 200))

    const tableCheck = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='stop_failure_events'"
    ).get()

    if (!tableCheck) {
      console.warn('[telemetry] stop_failure_events table not found — returning empty')
      return res.json({ data: [] })
    }

    const data = db.prepare(
      'SELECT * FROM stop_failure_events ORDER BY timestamp DESC LIMIT ?'
    ).all(limit)

    return res.json({ data })
  } catch (err) {
    console.error('[stop-failure-events] error:', err)
    return res.json({ data: [] })
  }
})

// ── GET /api/agent-protocol-violations?limit=50 ───────────────────────────────
// Phase 3 prep: feeds governance annotations on work-log cards.
// Returns empty array (not 500) if table doesn't exist.

agentProtocolViolationsRouter.get('/', (req, res) => {
  try {
    const db = getCastDb()
    if (!db) return res.json({ data: [] })

    const limit = Math.max(1, Math.min(Number(req.query.limit) || 50, 200))

    const tableCheck = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='agent_protocol_violations'"
    ).get()

    if (!tableCheck) {
      console.warn('[telemetry] agent_protocol_violations table not found — returning empty')
      return res.json({ data: [] })
    }

    const data = db.prepare(
      'SELECT * FROM agent_protocol_violations ORDER BY timestamp DESC LIMIT ?'
    ).all(limit)

    return res.json({ data })
  } catch (err) {
    console.error('[agent-protocol-violations] error:', err)
    return res.json({ data: [] })
  }
})
