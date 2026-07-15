import { Router } from 'express'
import { getCastDb } from './castDb.js'

export const evalRunsRouter = Router()

// GET /api/eval-runs
// CAST v8 eval harness results (cast-eval-runner.py writer / `cast eval`).
evalRunsRouter.get('/', (req, res) => {
  try {
    const db = getCastDb()
    if (!db) return res.json({ runs: [] })

    const tableCheck = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='eval_runs'"
    ).get()
    if (!tableCheck) return res.json({ runs: [] })

    const limit = Math.max(1, Math.min(Number(req.query.limit) || 200, 1000))

    const runs = db.prepare(`
      SELECT
        id, eval_id, agent, attempt, agent_run_id, status, grader_results,
        pass_at_k, k, duration_ms, started_at, ended_at, model, cost_tier
      FROM eval_runs
      ORDER BY started_at DESC
      LIMIT ?
    `).all(limit)

    return res.json({ runs })
  } catch (err) {
    console.error('[eval-runs] error:', err)
    return res.json({ runs: [] })
  }
})
