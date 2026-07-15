import { Router } from 'express'
import { getCastDb } from './castDb.js'
import { loadPlans } from '../parsers/memory.js'

export const executiveSummaryRouter = Router()

type Range = 'today' | 'week'

function getWindowStart(range: Range): string {
  const now = new Date()
  if (range === 'today') {
    const d = new Date(now)
    d.setHours(0, 0, 0, 0)
    return d.toISOString()
  }
  // week = last 7 days
  const d = new Date(now)
  d.setDate(d.getDate() - 7)
  d.setHours(0, 0, 0, 0)
  return d.toISOString()
}

function getPriorWindowStart(range: Range): string {
  const now = new Date()
  if (range === 'today') {
    // prior day
    const d = new Date(now)
    d.setDate(d.getDate() - 1)
    d.setHours(0, 0, 0, 0)
    return d.toISOString()
  }
  // prior 7 days (days 8-14 ago)
  const d = new Date(now)
  d.setDate(d.getDate() - 14)
  d.setHours(0, 0, 0, 0)
  return d.toISOString()
}

/**
 * GET /api/executive-summary?range=today|week
 *
 * Returns a digest-style aggregate for the Executive Summary view.
 * All data is pulled from cast.db via better-sqlite3.
 */
executiveSummaryRouter.get('/', (req, res) => {
  try {
    const rawRange = req.query.range as string | undefined
    const range: Range = rawRange === 'week' ? 'week' : 'today'

    const db = getCastDb()

    if (!db) {
      // Return a well-shaped empty response when cast.db is unavailable
      return res.json({
        range,
        generatedAt: new Date().toISOString(),
        runs: {
          total: 0,
          byStatus: { DONE: 0, DONE_WITH_CONCERNS: 0, BLOCKED: 0, NEEDS_CONTEXT: 0, RUNNING: 0, OTHER: 0 },
        },
        cost: { todayUsd: 0, weekUsd: 0, vsPrior7dPct: null },
        topAgents: [],
        blockers: [],
        highlights: { plansActive: 0, hookFailures24h: 0, qualityGatePassRate: null },
      })
    }

    const windowStart = getWindowStart(range)
    const priorStart = getPriorWindowStart(range)
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const todayStr = today.toISOString()
    const weekAgoStr = getWindowStart('week')

    // ── Runs by status ──────────────────────────────────────────────────────
    const statusRows = db.prepare(`
      SELECT UPPER(status) AS status, COUNT(*) AS cnt
      FROM agent_runs
      WHERE started_at >= ?
      GROUP BY UPPER(status)
    `).all(windowStart) as Array<{ status: string; cnt: number }>

    const byStatus = { DONE: 0, DONE_WITH_CONCERNS: 0, BLOCKED: 0, NEEDS_CONTEXT: 0, RUNNING: 0, OTHER: 0 }
    let totalRuns = 0

    for (const row of statusRows) {
      totalRuns += row.cnt
      const s = row.status
      if (s === 'DONE') byStatus.DONE = row.cnt
      else if (s === 'DONE_WITH_CONCERNS') byStatus.DONE_WITH_CONCERNS = row.cnt
      else if (s === 'BLOCKED') byStatus.BLOCKED = row.cnt
      else if (s === 'NEEDS_CONTEXT') byStatus.NEEDS_CONTEXT = row.cnt
      else if (s === 'RUNNING') byStatus.RUNNING = row.cnt
      else byStatus.OTHER += row.cnt
    }

    // ── Cost (today + week from cast.db cost_usd column) ───────────────────
    const todayCostRow = db.prepare(`
      SELECT COALESCE(SUM(cost_usd), 0) AS spend FROM agent_runs WHERE started_at >= ?
    `).get(todayStr) as { spend: number }
    const todayUsd = todayCostRow?.spend ?? 0

    const weekCostRow = db.prepare(`
      SELECT COALESCE(SUM(cost_usd), 0) AS spend FROM agent_runs WHERE started_at >= ?
    `).get(weekAgoStr) as { spend: number }
    const weekUsd = weekCostRow?.spend ?? 0

    // Prior window always ends where current window starts so the predicate is always satisfiable.
    // For 'today': priorStart=yesterday-start, windowStart=today-start → yesterday's full day.
    // For 'week':  priorStart=14-days-ago,     windowStart=7-days-ago  → days 8-14 ago.
    const priorWeekCostRow = db.prepare(`
      SELECT COALESCE(SUM(cost_usd), 0) AS spend FROM agent_runs WHERE started_at >= ? AND started_at < ?
    `).get(priorStart, windowStart) as { spend: number }
    const priorWeekUsd = priorWeekCostRow?.spend ?? 0

    // Use the current window's spend for the selected range so numerator and denominator
    // span equal-length windows:
    //   range='today' → todayUsd vs yesterday (priorWeekUsd)
    //   range='week'  → weekUsd  vs days 8-14 ago (priorWeekUsd)
    const currentWindowUsd = range === 'today' ? todayUsd : weekUsd
    let vsPrior7dPct: number | null = null
    if (priorWeekUsd > 0) {
      vsPrior7dPct = Math.round(((currentWindowUsd - priorWeekUsd) / priorWeekUsd) * 1000) / 10
    }

    // Supplement with JSONL totals (the real pipeline cost if available)
    // JSONL totals available as a more accurate supplement if needed in future;
    // currently we use cast.db cost_usd directly (consistent with other routes).

    // ── Top 5 agents by invocation count in window ─────────────────────────
    const topAgentRows = db.prepare(`
      SELECT agent, COUNT(*) AS cnt, COALESCE(SUM(cost_usd), 0) AS costUsd
      FROM agent_runs
      WHERE started_at >= ?
      GROUP BY agent
      ORDER BY cnt DESC
      LIMIT 5
    `).all(windowStart) as Array<{ agent: string; cnt: number; costUsd: number }>

    const topAgents = topAgentRows.map(r => ({
      agent: r.agent,
      count: r.cnt,
      costUsd: r.costUsd,
    }))

    // ── Blockers & concerns (BLOCKED + DONE_WITH_CONCERNS in window) ────────
    type BlockerRow = {
      id: string | number
      agent: string
      status: string
      started_at: string
      response: string | null
    }
    // response is canonical and populated; prompt was dropped in v9
    const blockerRows = db.prepare(`
      SELECT id, agent, status, started_at, response
      FROM agent_runs
      WHERE started_at >= ? AND UPPER(status) IN ('BLOCKED', 'DONE_WITH_CONCERNS')
      ORDER BY started_at DESC
      LIMIT 20
    `).all(windowStart) as BlockerRow[]

    const blockers = blockerRows.map(r => ({
      id: r.id,
      agent: r.agent,
      status: r.status.toUpperCase(),
      started_at: r.started_at,
      work_log_snippet: r.response?.slice(0, 120) ?? '',
    }))

    // ── Highlights ──────────────────────────────────────────────────────────

    // Plans active: count filesystem plan files (plans table doesn't exist in v8)
    let plansActive = 0
    try {
      plansActive = loadPlans().length
    } catch {
      plansActive = 0
    }

    // Hook failures in last 24h
    let hookFailures24h = 0
    try {
      const since24h = new Date(Date.now() - 86400_000).toISOString()
      const hookRow = db.prepare(
        `SELECT COUNT(*) AS cnt FROM hook_failures WHERE timestamp >= ?`
      ).get(since24h) as { cnt: number } | undefined
      hookFailures24h = hookRow?.cnt ?? 0
    } catch {
      // hook_failures table may not exist
      hookFailures24h = 0
    }

    // Quality gate pass rate in window (contract_passed=1 means pass; created_at is the date column).
    // quality_gates.created_at is space-format ("2026-07-02 06:00:00"); windowStart is ISO-T.
    // Lexicographic comparison would fail (space < 'T'), so compare via unixepoch() on both sides.
    let qualityGatePassRate: number | null = null
    try {
      const qgRow = db.prepare(`
        SELECT
          COUNT(*) AS total,
          SUM(CASE WHEN contract_passed = 1 THEN 1 ELSE 0 END) AS passed
        FROM quality_gates
        WHERE unixepoch(created_at) >= unixepoch(?)
      `).get(windowStart) as { total: number; passed: number } | undefined
      if (qgRow && qgRow.total > 0) {
        qualityGatePassRate = Math.round((qgRow.passed / qgRow.total) * 1000) / 10
      }
    } catch {
      // quality_gates table may not exist
      qualityGatePassRate = null
    }

    res.json({
      range,
      generatedAt: new Date().toISOString(),
      runs: { total: totalRuns, byStatus },
      cost: { todayUsd, weekUsd, vsPrior7dPct },
      topAgents,
      blockers,
      highlights: { plansActive, hookFailures24h, qualityGatePassRate },
    })
  } catch (err) {
    console.error('[executive-summary] error:', err)
    res.status(500).json({ error: 'Failed to fetch executive summary' })
  }
})
