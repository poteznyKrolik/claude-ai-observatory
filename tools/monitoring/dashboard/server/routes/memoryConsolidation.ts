import { Router } from 'express'
import { getCastDb } from './castDb.js'

export const memoryConsolidationRouter = Router()

// GET /api/memory-consolidation
// CAST v8 memory "dream cycle" consolidation runs + archived-memory count.
// Both tables are empty until the consolidation cron runs.
memoryConsolidationRouter.get('/', (_req, res) => {
  try {
    const db = getCastDb()
    if (!db) return res.json({ runs: [], archivedCount: 0 })

    let runs: unknown[] = []
    const runsCheck = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='memory_consolidation_runs'"
    ).get()
    if (runsCheck) {
      runs = db.prepare(`
        SELECT id, run_id, project_id, status, memory_files_read, transcripts_scanned,
               candidates_written, started_at, completed_at, error
        FROM memory_consolidation_runs
        ORDER BY started_at DESC
        LIMIT 200
      `).all()
    }

    let archivedCount = 0
    const archCheck = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='archived_memories'"
    ).get()
    if (archCheck) {
      archivedCount = (db.prepare('SELECT COUNT(*) AS c FROM archived_memories').get() as { c: number }).c
    }

    return res.json({ runs, archivedCount })
  } catch (err) {
    console.error('[memory-consolidation] error:', err)
    return res.json({ runs: [], archivedCount: 0 })
  }
})
