import { Router } from 'express'
import { getCastDb } from './castDb.js'

export interface RoutineRow {
  id: string
  name: string
  trigger_type: string
  trigger_value: string | null
  agent_to_dispatch: string
  enabled: number
  last_run_at: string | null
  last_run_status: string | null
  last_run_output_path: string | null
  created_at: string
}

export const routinesRouter = Router()

routinesRouter.get('/', (_req, res) => {
  try {
    const db = getCastDb()
    if (!db) return res.json({ routines: [] })
    const tableCheck = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='routines'"
    ).get()
    if (!tableCheck) return res.json({ routines: [] })

    const routines = db.prepare(`
      SELECT id, name, trigger_type, trigger_value, agent_to_dispatch,
             enabled, last_run_at, last_run_status, last_run_output_path, created_at
      FROM routines
      ORDER BY name ASC
    `).all() as RoutineRow[]

    return res.json({ routines })
  } catch (err) {
    console.error('[routines] error:', err)
    return res.json({ routines: [] })
  }
})
