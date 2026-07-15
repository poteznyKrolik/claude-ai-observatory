import { Router } from 'express'
import { getCastDb } from './castDb.js'

export const injectionLogRouter = Router()

export interface InjectionLogEntry {
  id: number
  session_id: string | null
  prompt_hash: string
  fact_id: number
  score: number | null
  score_breakdown: string | null
  injected_at: string
}

injectionLogRouter.get('/', (_req, res) => {
  try {
    const db = getCastDb()
    if (!db) return res.json({ entries: [] })

    const tableCheck = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='injection_log'"
    ).get()
    if (!tableCheck) return res.json({ entries: [] })

    const entries = db.prepare(
      'SELECT id, session_id, prompt_hash, fact_id, score, injected_at FROM injection_log ORDER BY injected_at DESC LIMIT 100'
    ).all()

    return res.json({ entries })
  } catch (err) {
    console.error('[injection-log] error:', err)
    return res.json({ entries: [] })
  }
})
