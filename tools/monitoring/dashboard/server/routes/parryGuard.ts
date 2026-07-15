import { Router } from 'express'
import { getCastDb } from './castDb.js'

export const parryGuardRouter = Router()

export interface ParryGuardEvent {
  id: number
  tool_name: string
  input_snippet: string | null
  rejected_at: string
}

parryGuardRouter.get('/', (_req, res) => {
  try {
    const db = getCastDb()
    if (!db) return res.json({ events: [] })

    const tableCheck = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='parry_guard_events'"
    ).get()
    if (!tableCheck) return res.json({ events: [] })

    const events = db.prepare(
      'SELECT id, tool_name, input_snippet, rejected_at FROM parry_guard_events ORDER BY rejected_at DESC LIMIT 50'
    ).all()

    return res.json({ events })
  } catch (err) {
    console.error('[parry-guard] error:', err)
    return res.json({ events: [] })
  }
})
