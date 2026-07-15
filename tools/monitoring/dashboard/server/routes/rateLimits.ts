import { Router } from 'express'
import { getCastDb } from './castDb.js'

export const rateLimitsRouter = Router()

// GET /api/rate-limits
// CAST v8 Anthropic rate-limit snapshots (cast-rate-check.py writer). Empty until used.
rateLimitsRouter.get('/', (req, res) => {
  try {
    const db = getCastDb()
    if (!db) return res.json({ latest: null, snapshots: [] })

    const tableCheck = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='rate_limit_snapshots'"
    ).get()
    if (!tableCheck) return res.json({ latest: null, snapshots: [] })

    const limit = Math.max(1, Math.min(Number(req.query.limit) || 100, 500))

    const snapshots = db.prepare(`
      SELECT ts, tpm_limit, tpm_used, rpm_limit, rpm_used
      FROM rate_limit_snapshots
      ORDER BY ts DESC
      LIMIT ?
    `).all(limit) as Array<Record<string, number>>

    return res.json({ latest: snapshots[0] ?? null, snapshots })
  } catch (err) {
    console.error('[rate-limits] error:', err)
    return res.json({ latest: null, snapshots: [] })
  }
})
