import { Router } from 'express'
import { getJsonlTokenTotals, getModelBreakdown, getTopSessions } from '../utils/jsonlTokenTotals.js'

export const costSummaryRouter = Router()

/**
 * GET /api/cast/cost-summary
 *
 * Returns aggregated cost data for the System page pricing widget.
 * All data is derived from JSONL session files (same source as /token-spend).
 *
 * Query params:
 *   days  — lookback window in days (default 30, max 365)
 *   top   — number of top sessions to return (default 10, max 50)
 */
costSummaryRouter.get('/', (req, res) => {
  try {
    const rawDays = parseInt(String(req.query.days ?? '30'), 10)
    const days = Number.isFinite(rawDays) && rawDays > 0 ? Math.min(rawDays, 365) : 30

    const rawTop = parseInt(String(req.query.top ?? '10'), 10)
    const topN = Number.isFinite(rawTop) && rawTop > 0 ? Math.min(rawTop, 50) : 10

    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - days)
    const since = cutoff.toISOString().slice(0, 10)

    const totals = getJsonlTokenTotals(since)
    const byModel = getModelBreakdown(since)
    const topSessions = getTopSessions(since, topN)

    res.json({ totals, byModel, topSessions, windowDays: days })
  } catch (err) {
    console.error('[cost-summary] error:', err)
    res.status(500).json({ error: 'Failed to fetch cost summary' })
  }
})
