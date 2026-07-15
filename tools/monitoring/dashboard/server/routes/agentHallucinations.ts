import { Router } from 'express'
import { getCastDb } from './castDb.js'

export interface HallucinationRow {
  id: number
  session_id: string | null
  agent_name: string
  claim_type: string
  claimed_value: string | null
  actual_value: string | null
  verified: number
  timestamp: string
}

export const agentHallucinationsRouter = Router()

// GET /api/agent-hallucinations — list, supports ?agent=, ?since=, ?limit= (default 100, max 500)
agentHallucinationsRouter.get('/', (req, res) => {
  try {
    const db = getCastDb()
    if (!db) return res.json({ entries: [] })
    const tableCheck = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='agent_hallucinations'"
    ).get()
    if (!tableCheck) return res.json({ entries: [] })

    const agent = req.query.agent as string | undefined
    const since = req.query.since as string | undefined
    const limit = Math.max(1, Math.min(Number(req.query.limit) || 100, 500))
    const conditions: string[] = []
    const params: unknown[] = []
    if (agent) { conditions.push('agent_name = ?'); params.push(agent) }
    if (since) { conditions.push('timestamp >= ?'); params.push(since) }
    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

    const entries = db.prepare(`
      SELECT id, session_id, agent_name, claim_type, claimed_value, actual_value, verified, timestamp
      FROM agent_hallucinations
      ${where}
      ORDER BY timestamp DESC
      LIMIT ?
    `).all([...params, limit]) as HallucinationRow[]

    return res.json({ entries })
  } catch (err) {
    console.error('[agent-hallucinations] error:', err)
    return res.json({ entries: [] })
  }
})

// GET /api/agent-hallucinations/stats — breakdown by agent_name and claim_type
agentHallucinationsRouter.get('/stats', (_req, res) => {
  try {
    const db = getCastDb()
    if (!db) return res.json({ total: 0, by_agent: [], by_type: [] })
    const tableCheck = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='agent_hallucinations'"
    ).get()
    if (!tableCheck) return res.json({ total: 0, by_agent: [], by_type: [] })

    const total = (db.prepare('SELECT COUNT(*) AS cnt FROM agent_hallucinations').get() as { cnt: number }).cnt

    const by_agent = db.prepare(`
      SELECT agent_name, COUNT(*) AS count
      FROM agent_hallucinations
      GROUP BY agent_name
      ORDER BY count DESC
      LIMIT 20
    `).all() as Array<{ agent_name: string; count: number }>

    const by_type = db.prepare(`
      SELECT claim_type, COUNT(*) AS count
      FROM agent_hallucinations
      GROUP BY claim_type
      ORDER BY count DESC
    `).all() as Array<{ claim_type: string; count: number }>

    return res.json({ total, by_agent, by_type })
  } catch (err) {
    console.error('[agent-hallucinations/stats] error:', err)
    return res.json({ total: 0, by_agent: [], by_type: [] })
  }
})
