import { Router } from 'express'
import { getCachedSessions, loadSession } from '../parsers/sessions.js'
import { estimateCost, MODEL_RATES } from '../utils/costEstimate.js'
import type { ContentBlock } from '../../src/types/index.js'
import { getCastDb } from './castDb.js'

export const analyticsRouter = Router()

// GET /api/analytics/profile — per-agent scorecard from cast.db
analyticsRouter.get('/profile', (_req, res) => {
  try {
    const db = getCastDb()
    if (!db) {
      return res.status(503).json({ error: 'cast.db not available' })
    }
    const rows = db.prepare(`
      SELECT agent,
             COUNT(*) AS runs,
             SUM(CASE WHEN UPPER(status) IN ('DONE','DONE_WITH_CONCERNS') THEN 1 ELSE 0 END) AS successes,
             SUM(CASE WHEN UPPER(status) = 'BLOCKED' THEN 1 ELSE 0 END) AS blocked_count,
             ROUND(AVG(cost_usd), 6) AS avg_cost_usd
      FROM agent_runs
      GROUP BY agent
      ORDER BY runs DESC
    `).all() as { agent: string; runs: number; successes: number; blocked_count: number; avg_cost_usd: number }[]

    const agents = rows.map(r => ({
      name: r.agent,
      runs: r.runs,
      success_rate: r.runs > 0 ? Math.round((r.successes / r.runs) * 1000) / 10 : 0,
      blocked_count: r.blocked_count ?? 0,
      avg_cost_usd: r.avg_cost_usd ?? 0,
    }))
    res.json({ agents })
  } catch (err) {
    console.error('Analytics profile error:', err)
    res.status(500).json({ error: 'Failed to compute agent profile' })
  }
})

// GET /api/analytics/profile/:agent — single-agent drill-down
analyticsRouter.get('/profile/:agent', (req, res) => {
  try {
    const db = getCastDb()
    if (!db) {
      return res.status(503).json({ error: 'cast.db not available' })
    }
    const { agent } = req.params
    const row = db.prepare(`
      SELECT agent,
             COUNT(*) AS runs,
             SUM(CASE WHEN UPPER(status) IN ('DONE','DONE_WITH_CONCERNS') THEN 1 ELSE 0 END) AS successes,
             SUM(CASE WHEN UPPER(status) = 'BLOCKED' THEN 1 ELSE 0 END) AS blocked_count,
             ROUND(AVG(cost_usd), 6) AS avg_cost_usd
      FROM agent_runs
      WHERE agent = ?
      GROUP BY agent
    `).get(agent) as { agent: string; runs: number; successes: number; blocked_count: number; avg_cost_usd: number } | undefined

    if (!row) {
      return res.status(404).json({ error: `No runs found for agent: ${agent}` })
    }

    const hasAT = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='agent_truncations'"
    ).get()

    // is_truncated: keyed on agent_id (unique per run) to avoid fan-out from the old
    // (session_id, agent_name) join that flagged every same-agent run in a session.
    // NULL agent_id → 0 (no truncation data) rather than false-positive session-wide flag.
    const truncatedExpr = hasAT
      ? `CASE WHEN ar.agent_id IS NOT NULL AND EXISTS (
           SELECT 1 FROM agent_truncations t
           WHERE t.agent_id = ar.agent_id
         ) THEN 1 ELSE 0 END`
      : '0'

    const last50 = db.prepare(`
      SELECT ar.started_at, ar.ended_at,
             CAST((julianday(ar.ended_at) - julianday(ar.started_at)) * 86400000 AS INTEGER) AS duration_ms,
             ar.status, ar.input_tokens, ar.output_tokens, ar.cost_usd,
             (SELECT dd.prompt_snippet FROM dispatch_decisions dd
               WHERE dd.session_id = ar.session_id AND dd.chosen_agent = ar.agent
                 AND unixepoch(dd.created_at) <= unixepoch(ar.started_at) + 60
               ORDER BY unixepoch(dd.created_at) DESC LIMIT 1) AS task_summary,
             ar.model,
             ${truncatedExpr} AS is_truncated
      FROM agent_runs ar
      WHERE ar.agent = ?
      ORDER BY ar.started_at DESC
      LIMIT 50
    `).all(agent) as {
      started_at: string
      ended_at: string | null
      duration_ms: number | null
      status: string
      input_tokens: number | null
      output_tokens: number | null
      cost_usd: number
      task_summary: string | null
      model: string | null
      is_truncated: number
    }[]

    res.json({
      name: row.agent,
      runs: row.runs,
      success_rate: row.runs > 0 ? Math.round((row.successes / row.runs) * 1000) / 10 : 0,
      blocked_count: row.blocked_count ?? 0,
      avg_cost_usd: row.avg_cost_usd ?? 0,
      last_runs: last50,
    })
  } catch (err) {
    console.error('Analytics profile/:agent error:', err)
    res.status(500).json({ error: 'Failed to compute agent profile' })
  }
})

analyticsRouter.get('/', (req, res) => {
  try {
    const sessions = getCachedSessions()

    // Filter to current billing month if requested
    const currentMonthOnly = req.query.currentMonthOnly === 'true'
    const now = new Date()
    const monthPrefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
    const filteredSessions = currentMonthOnly
      ? sessions.filter(s => s.startedAt.startsWith(monthPrefix))
      : sessions

    // --- Totals ---
    let totalInputTokens = 0
    let totalOutputTokens = 0
    let totalCacheCreationTokens = 0
    let totalCacheReadTokens = 0
    let estimatedCostUSD = 0

    for (const s of filteredSessions) {
      totalInputTokens += s.inputTokens
      totalOutputTokens += s.outputTokens
      totalCacheCreationTokens += s.cacheCreationTokens
      totalCacheReadTokens += s.cacheReadTokens
      estimatedCostUSD += estimateCost(
        s.inputTokens,
        s.outputTokens,
        s.cacheCreationTokens,
        s.cacheReadTokens,
        s.model || ''
      )
    }

    // Note: agent_runs cost/token totals are NOT added here because JSONL session
    // data already includes subagent token usage. Adding both would double-count.

    // --- Sessions by day (last 90 days) ---
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - 90)
    const cutoffStr = cutoff.toISOString().slice(0, 10)

    const dayMap = new Map<string, { sessions: number; inputTokens: number; outputTokens: number; cost: number }>()
    for (const s of filteredSessions) {
      const date = s.startedAt.slice(0, 10)
      if (date < cutoffStr) continue
      const entry = dayMap.get(date) ?? { sessions: 0, inputTokens: 0, outputTokens: 0, cost: 0 }
      entry.sessions++
      entry.inputTokens += s.inputTokens
      entry.outputTokens += s.outputTokens
      entry.cost += estimateCost(s.inputTokens, s.outputTokens, s.cacheCreationTokens, s.cacheReadTokens, s.model || '')
      dayMap.set(date, entry)
    }
    const sessionsByDay = [...dayMap.entries()]
      .map(([date, v]) => ({ date, ...v }))
      .sort((a, b) => a.date.localeCompare(b.date))

    // --- Sessions by project ---
    const projMap = new Map<string, { sessions: number; tokens: number; cost: number }>()
    for (const s of filteredSessions) {
      const key = s.project
      const entry = projMap.get(key) ?? { sessions: 0, tokens: 0, cost: 0 }
      entry.sessions++
      entry.tokens += s.inputTokens + s.outputTokens
      entry.cost += estimateCost(s.inputTokens, s.outputTokens, s.cacheCreationTokens, s.cacheReadTokens, s.model || '')
      projMap.set(key, entry)
    }
    const sessionsByProject = [...projMap.entries()]
      .map(([project, v]) => ({ project, ...v }))
      .sort((a, b) => b.cost - a.cost)

    // --- Model breakdown ---
    const modelMap = new Map<string, { sessions: number; tokens: number; cost: number }>()
    for (const s of filteredSessions) {
      const key = s.model || 'unknown'
      const entry = modelMap.get(key) ?? { sessions: 0, tokens: 0, cost: 0 }
      entry.sessions++
      entry.tokens += s.inputTokens + s.outputTokens
      entry.cost += estimateCost(s.inputTokens, s.outputTokens, s.cacheCreationTokens, s.cacheReadTokens, s.model || '')
      modelMap.set(key, entry)
    }
    const modelBreakdown = [...modelMap.entries()]
      .map(([model, v]) => ({ model, ...v }))
      .sort((a, b) => b.cost - a.cost)

    // --- Tool usage (scan most recent 50 sessions) ---
    const toolCounts = new Map<string, number>()
    const recentSessions = filteredSessions.slice(0, 200)
    for (const s of recentSessions) {
      const entries = loadSession(s.projectEncoded, s.id)
      for (const entry of entries) {
        if (entry.message?.content && Array.isArray(entry.message.content)) {
          for (const block of entry.message.content as ContentBlock[]) {
            if (block.type === 'tool_use' && block.name) {
              toolCounts.set(block.name, (toolCounts.get(block.name) ?? 0) + 1)
            }
          }
        }
      }
    }
    const toolUsage = [...toolCounts.entries()]
      .map(([tool, count]) => ({ tool, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 20)

    // --- Averages ---
    const sessionsWithDuration = filteredSessions.filter(s => s.durationMs !== undefined)
    const avgSessionDurationMs = sessionsWithDuration.length > 0
      ? sessionsWithDuration.reduce((sum, s) => sum + s.durationMs!, 0) / sessionsWithDuration.length
      : 0

    const avgTokensPerSession = filteredSessions.length > 0
      ? (totalInputTokens + totalOutputTokens) / filteredSessions.length
      : 0

    // --- Delegation savings (Option A) ---
    // savedUSD = what haiku-dispatched work would have cost at sonnet rates
    //            minus what it actually cost at haiku rates.
    // Only haiku sessions are re-priced — opus/sonnet sessions are excluded
    // so the baseline never exceeds the actual mixed-model cost.
    const SONNET_KEY = Object.keys(MODEL_RATES).find(k => k.includes('sonnet')) ?? ''
    const sonnetRates = SONNET_KEY ? MODEL_RATES[SONNET_KEY] : null
    let actualHaikuCostUSD = 0
    let sonnetEquivalentCostUSD = 0
    let haikuSessions = 0
    let sonnetSessions = 0
    let opusSessions = 0

    for (const s of filteredSessions) {
      const m = (s.model ?? '').toLowerCase()
      if (m.includes('haiku')) {
        haikuSessions++
        // actual haiku cost (already included in estimatedCostUSD)
        actualHaikuCostUSD += estimateCost(
          s.inputTokens, s.outputTokens, s.cacheCreationTokens, s.cacheReadTokens, s.model || ''
        )
        // hypothetical sonnet cost for this haiku session
        if (sonnetRates) {
          sonnetEquivalentCostUSD += (
            s.inputTokens * sonnetRates.input +
            s.outputTokens * sonnetRates.output +
            s.cacheCreationTokens * sonnetRates.cacheWrite +
            s.cacheReadTokens * sonnetRates.cacheRead
          ) / 1_000_000
        }
      } else if (m.includes('opus')) {
        opusSessions++
      } else {
        sonnetSessions++
      }
    }

    // Also count model dispatch counts from cast.db agent_runs
    // (CAST sub-agents like commit/code-reviewer run as haiku)
    try {
      const castDb = getCastDb()
      if (castDb) {
        const agentRunModels = castDb.prepare(`
          SELECT LOWER(COALESCE(model, '')) AS model, COUNT(*) AS cnt
          FROM agent_runs
          WHERE date(started_at) >= ?
          GROUP BY LOWER(COALESCE(model, ''))
        `).all(cutoffStr) as { model: string; cnt: number }[]

        for (const row of agentRunModels) {
          if (row.model.includes('haiku')) haikuSessions += row.cnt
          else if (row.model.includes('opus')) opusSessions += row.cnt
          else if (row.model.includes('sonnet')) sonnetSessions += row.cnt
          // skip blank/unknown model rows
        }
      }
    } catch {
      // non-fatal: cast.db may not be available
    }

    const totalModelSessions = haikuSessions + sonnetSessions + opusSessions
    const haikuUtilizationPct = totalModelSessions > 0
      ? Math.round((haikuSessions / totalModelSessions) * 100)
      : 0
    // Savings = what haiku sessions would have cost at sonnet - what they actually cost
    const savedUSD = Math.max(0, sonnetEquivalentCostUSD - actualHaikuCostUSD)

    const delegationSavings = {
      savedUSD,
      hypotheticalSonnetCostUSD: sonnetEquivalentCostUSD,
      actualCostUSD: actualHaikuCostUSD,
      haikuUtilizationPct,
      dispatches: {
        haiku: haikuSessions,
        sonnet: sonnetSessions,
        opus: opusSessions,
      },
    }

    res.json({
      totalSessions: filteredSessions.length,
      totalInputTokens,
      totalOutputTokens,
      totalCacheCreationTokens,
      totalCacheReadTokens,
      estimatedCostUSD,
      sessionsByDay,
      sessionsByProject,
      toolUsage,
      modelBreakdown,
      avgSessionDurationMs,
      avgTokensPerSession,
      delegationSavings,
      monthPrefix: currentMonthOnly ? monthPrefix : null,
    })
  } catch (err) {
    console.error('Analytics error:', err)
    res.status(500).json({ error: 'Failed to compute analytics' })
  }
})

