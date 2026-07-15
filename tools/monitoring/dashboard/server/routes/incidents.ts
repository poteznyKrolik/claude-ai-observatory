import { Router } from 'express'
import { getCastDb } from './castDb.js'

export interface IncidentRow {
  id: string
  occurred_at: string
  problem_summary: string
  fix_summary: string | null
  related_files: string | null
  related_commit: string | null
  resolution_status: string | null
  surfaced_by: string | null
}

export const incidentsRouter = Router()

incidentsRouter.get('/', (_req, res) => {
  try {
    const db = getCastDb()
    if (!db) return res.json({ incidents: [] })

    const tableCheck = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='incidents'"
    ).get()
    if (!tableCheck) return res.json({ incidents: [] })

    const incidents = db.prepare(`
      SELECT id, occurred_at, problem_summary, fix_summary,
             related_files, related_commit, resolution_status, surfaced_by
      FROM incidents
      ORDER BY occurred_at DESC
    `).all() as IncidentRow[]

    return res.json({ incidents })
  } catch (err) {
    console.error('[incidents] error:', err)
    return res.json({ incidents: [] })
  }
})
