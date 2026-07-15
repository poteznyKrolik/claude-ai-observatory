import { Router } from 'express'
import { getCastDb } from './castDb.js'

export const routingRouter = Router()

// GET /api/routing/events?limit=N&event_type=X
// When event_type is present: queries routing_events table (hook task_claimed / user_prompt_submit events)
// When event_type is absent:  queries agent_runs table (CAST dispatch log)
routingRouter.get('/events', (req, res) => {
  const parsed = parseInt(String(req.query.limit ?? '100'))
  const limit = Number.isNaN(parsed) ? 100 : Math.max(1, Math.min(parsed, 1000))
  const eventType = req.query.event_type ? String(req.query.event_type) : null

  try {
    const db = getCastDb()
    if (!db) {
      return res.json([])
    }

    let rows: unknown[] = []
    try {
      if (eventType) {
        // Query routing_events by event_type (task_claimed, user_prompt_submit, context_compacted, task_completed, etc.)
        rows = db.prepare(`
          SELECT id, session_id, timestamp, event_type,
                 action AS agent, data, project
          FROM routing_events
          WHERE event_type = ?
          ORDER BY timestamp DESC
          LIMIT ?
        `).all(eventType, limit)
      } else {
        rows = db.prepare(`
          SELECT ar.id, ar.session_id, ar.agent, ar.status, ar.started_at,
                 ar.ended_at AS completed_at,
                 CAST((julianday(ar.ended_at) - julianday(ar.started_at)) * 86400000 AS INTEGER) AS duration_ms,
                 (SELECT dd.prompt_snippet FROM dispatch_decisions dd
                   WHERE dd.session_id = ar.session_id AND dd.chosen_agent = ar.agent
                     AND unixepoch(dd.created_at) <= unixepoch(ar.started_at) + 60
                   ORDER BY unixepoch(dd.created_at) DESC LIMIT 1) AS prompt_preview,
                 ar.cost_usd
          FROM agent_runs ar
          ORDER BY ar.started_at DESC
          LIMIT ?
        `).all(limit)
      }
    } catch {
      // Table may not exist yet
      return res.json([])
    }

    res.json(rows)
  } catch (err) {
    console.error('routing events error:', err)
    res.json([])
  }
})

// GET /api/routing/event-types — distinct event_type values in routing_events
routingRouter.get('/event-types', (_req, res) => {
  try {
    const db = getCastDb()
    if (!db) {
      return res.json([])
    }

    let types: string[] = []
    try {
      const rows = db.prepare(`
        SELECT DISTINCT event_type
        FROM routing_events
        WHERE event_type IS NOT NULL
        ORDER BY event_type ASC
      `).all() as Array<{ event_type: string }>
      types = rows.map(r => r.event_type)
    } catch {
      // Table may not exist yet
    }

    res.json(types)
  } catch (err) {
    console.error('routing event-types error:', err)
    res.json([])
  }
})

// GET /api/routing/stats — aggregate counts from agent_runs
routingRouter.get('/stats', (_req, res) => {
  try {
    const db = getCastDb()
    if (!db) {
      return res.json({ total: 0, byStatus: {}, topAgent: null, last24hCount: 0 })
    }

    let total = 0
    let byStatus: Record<string, number> = {}
    let topAgent: string | null = null
    let last24hCount = 0

    try {
      const totalRow = db.prepare('SELECT COUNT(*) AS cnt FROM agent_runs').get() as { cnt: number }
      total = totalRow?.cnt ?? 0

      const statusRows = db.prepare(
        'SELECT status, COUNT(*) AS cnt FROM agent_runs GROUP BY status'
      ).all() as Array<{ status: string; cnt: number }>
      byStatus = Object.fromEntries(statusRows.map(r => [r.status, r.cnt]))

      const topRow = db.prepare(
        'SELECT agent, COUNT(*) AS cnt FROM agent_runs GROUP BY agent ORDER BY cnt DESC LIMIT 1'
      ).get() as { agent: string; cnt: number } | undefined
      topAgent = topRow?.agent ?? null

      const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
      const last24Row = db.prepare(
        'SELECT COUNT(*) AS cnt FROM agent_runs WHERE started_at >= ?'
      ).get(since) as { cnt: number }
      last24hCount = last24Row?.cnt ?? 0
    } catch {
      // Table may not exist yet — return zeros
    }

    res.json({ total, byStatus, topAgent, last24hCount })
  } catch (err) {
    console.error('routing stats error:', err)
    res.json({ total: 0, byStatus: {}, topAgent: null, last24hCount: 0 })
  }
})
