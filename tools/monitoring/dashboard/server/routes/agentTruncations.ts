import { Router } from 'express'
import { getCastDb } from './castDb.js'

export const agentTruncationsRouter = Router()

export interface AgentTruncation {
  id: number
  session_id: string | null
  agent_type: string
  agent_id: string | null
  last_line: string | null
  timestamp: string
  char_count: number | null
  has_status: number | null
  has_json: number | null
}

agentTruncationsRouter.get('/', (_req, res) => {
  try {
    const db = getCastDb()
    if (!db) return res.json({ truncations: [] })

    const tableCheck = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='agent_truncations'"
    ).get()
    if (!tableCheck) return res.json({ truncations: [] })

    const truncations = db.prepare(
      'SELECT id, session_id, agent_type, agent_id, last_line, timestamp, char_count, has_status, has_json FROM agent_truncations ORDER BY timestamp DESC LIMIT 50'
    ).all()

    return res.json({ truncations })
  } catch (err) {
    console.error('[agent-truncations] error:', err)
    return res.json({ truncations: [] })
  }
})
