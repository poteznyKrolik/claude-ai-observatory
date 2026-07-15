import { Router } from 'express'
import { execSync } from 'child_process'
import { getCastDb } from './castDb.js'
import { getSessionCostMap } from '../utils/jsonlTokenTotals.js'

export const agentRunsRouter = Router()

/**
 * An agent_run counts as "active" only when status='running' AND it started within
 * this window. Bounds staleness: orphan 'running' rows (agents that crashed or hit
 * maxTurns without firing SubagentStop, so were never flipped to DONE) fall outside
 * the window and are excluded. Single source of the active-agent threshold.
 */
export const ACTIVE_AGENT_WINDOW_MINUTES = 15

// Separate router for GET /api/cast/active-agents (mounted at '/cast/active-agents')
// so the path resolves to '/' when Express strips the prefix.
export const activeAgentsRouter = Router()

// Router for session-specific agent history and worktree status
export const sessionAgentsRouter = Router()
export const worktreesRouter = Router()

// GET /api/cast/active-agents
// Returns only agents currently running, after deduplicating SubagentStart/SubagentStop
// pairs using a window function that picks the highest-priority status per
// (agent, 5-minute bucket). Filters out phantom 'unknown' agent rows.
activeAgentsRouter.get('/', (req, res) => {
  try {
    const db = getCastDb()
    if (!db) {
      return res.json({ runs: [] })
    }

    const runs = db.prepare(`
      WITH ranked AS (
        SELECT
          ar.id,
          ar.session_id,
          ar.agent,
          ar.model,
          ar.started_at,
          ar.ended_at,
          ar.status,
          ar.input_tokens,
          ar.output_tokens,
          ar.cost_usd,
          (SELECT dd.prompt_snippet FROM dispatch_decisions dd
            WHERE dd.session_id = ar.session_id AND dd.chosen_agent = ar.agent
              AND unixepoch(dd.created_at) <= unixepoch(ar.started_at) + 60
            ORDER BY unixepoch(dd.created_at) DESC LIMIT 1) AS task_summary,
          s.project,
          ROW_NUMBER() OVER (
            PARTITION BY COALESCE(ar.agent_id, CAST(ar.id AS TEXT))
            ORDER BY
              CASE ar.status
                WHEN 'DONE' THEN 1
                WHEN 'DONE_WITH_CONCERNS' THEN 2
                WHEN 'BLOCKED' THEN 3
                ELSE 4
              END,
              ar.started_at DESC
          ) AS rn
        FROM agent_runs ar
        LEFT JOIN sessions s ON s.id = ar.session_id
        WHERE ar.agent != 'unknown'
      )
      SELECT
        id, session_id, agent, model, started_at, ended_at,
        status, input_tokens, output_tokens, cost_usd,
        task_summary, project
      FROM ranked
      WHERE rn = 1
        AND status = 'running'
        AND unixepoch(started_at) >= unixepoch('now', '-${ACTIVE_AGENT_WINDOW_MINUTES} minutes')
      ORDER BY started_at DESC
    `).all() as Array<{
      id: string; session_id: string; agent: string; model: string;
      started_at: string; ended_at: string | null; status: string;
      input_tokens: number; output_tokens: number; cost_usd: number;
      task_summary: string | null; project: string | null
    }>

    res.json({ runs })
  } catch (err) {
    console.error('Active agents error:', err)
    res.status(500).json({ error: 'Failed to fetch active agents' })
  }
})

agentRunsRouter.get('/', (req, res) => {
  try {
    const db = getCastDb()
    if (!db) {
      return res.json({
        runs: [],
        stats: { totalRuns: 0, totalCostUsd: 0, byAgent: {}, byStatus: {} },
      })
    }

    const limit = Math.max(1, Math.min(Number(req.query.limit) || 100, 500))
    const agent = req.query.agent as string | undefined
    const status = req.query.status as string | undefined
    const since = req.query.since as string | undefined

    const conditions: string[] = []
    const params: unknown[] = []

    if (agent) { conditions.push('ar.agent = ?'); params.push(agent) }
    if (status) { conditions.push('ar.status = ?'); params.push(status) }
    if (since) { conditions.push('ar.started_at >= ?'); params.push(since) }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

    const runs = db.prepare(`
      SELECT
        ar.id,
        ar.session_id,
        ar.agent,
        ar.model,
        ar.started_at,
        ar.ended_at,
        ar.status,
        ar.input_tokens,
        ar.output_tokens,
        ar.cost_usd,
        (SELECT dd.prompt_snippet FROM dispatch_decisions dd
          WHERE dd.session_id = ar.session_id AND dd.chosen_agent = ar.agent
            AND unixepoch(dd.created_at) <= unixepoch(ar.started_at) + 60
          ORDER BY unixepoch(dd.created_at) DESC LIMIT 1) AS task_summary,
        ar.agent_id,
        s.project
      FROM agent_runs ar
      LEFT JOIN sessions s ON s.id = ar.session_id
      ${where}
      ORDER BY ar.started_at DESC
      LIMIT ?
    `).all([...params, limit]) as Array<{
      id: string; session_id: string; agent: string; model: string;
      started_at: string; ended_at: string | null; status: string;
      input_tokens: number; output_tokens: number; cost_usd: number;
      task_summary: string | null; project: string | null;
      agent_id: string | null
    }>

    // Aggregate stats — apply the same filters as the list query so stat cards match
    const statsRow = db.prepare(`
      SELECT
        COUNT(*) AS totalRuns,
        COALESCE(SUM(cost_usd), 0) AS totalCostUsd
      FROM agent_runs ar
      ${where}
    `).get(...params) as { totalRuns: number; totalCostUsd: number }

    const byAgentRows = db.prepare(`
      SELECT agent, COUNT(*) AS cnt FROM agent_runs ar ${where} GROUP BY agent
    `).all(...params) as Array<{ agent: string; cnt: number }>

    const byStatusRows = db.prepare(`
      SELECT status, COUNT(*) AS cnt FROM agent_runs ar ${where} GROUP BY status
    `).all(...params) as Array<{ status: string; cnt: number }>

    const byAgent: Record<string, number> = {}
    for (const r of byAgentRows) byAgent[r.agent] = r.cnt

    const byStatus: Record<string, number> = {}
    for (const r of byStatusRows) byStatus[r.status] = r.cnt

    res.json({
      runs,
      stats: {
        totalRuns: statsRow.totalRuns,
        totalCostUsd: statsRow.totalCostUsd,
        byAgent,
        byStatus,
      },
    })
  } catch (err) {
    console.error('Agent runs error:', err)
    res.status(500).json({ error: 'Failed to fetch agent runs' })
  }
})

// GET /api/cast/session-agents/:sessionId
// Returns all agent_runs for a given session, ordered by started_at
sessionAgentsRouter.get('/:sessionId', (req, res) => {
  try {
    const db = getCastDb()
    if (!db) {
      return res.json({ runs: [] })
    }

    const { sessionId } = req.params

    const runs = db.prepare(`
      SELECT
        ar.id,
        ar.session_id,
        ar.agent,
        ar.model,
        ar.started_at,
        ar.ended_at,
        ar.status,
        ar.input_tokens,
        ar.output_tokens,
        ar.cost_usd,
        (SELECT dd.prompt_snippet FROM dispatch_decisions dd
          WHERE dd.session_id = ar.session_id AND dd.chosen_agent = ar.agent
            AND unixepoch(dd.created_at) <= unixepoch(ar.started_at) + 60
          ORDER BY unixepoch(dd.created_at) DESC LIMIT 1) AS task_summary,
        ar.agent_id,
        s.project,
        CASE
          WHEN ar.ended_at IS NOT NULL
          THEN CAST((julianday(ar.ended_at) - julianday(ar.started_at)) * 86400000 AS INTEGER)
          ELSE NULL
        END AS duration_ms
      FROM agent_runs ar
      LEFT JOIN sessions s ON s.id = ar.session_id
      WHERE ar.session_id = ?
      ORDER BY ar.started_at ASC
    `).all(sessionId) as Array<{
      id: string; session_id: string; agent: string; model: string;
      started_at: string; ended_at: string | null; status: string;
      input_tokens: number; output_tokens: number; cost_usd: number;
      task_summary: string | null; project: string | null; duration_ms: number | null;
      agent_id: string | null
    }>

    res.json({ runs })
  } catch (err) {
    console.error('Session agents error:', err)
    res.status(500).json({ error: 'Failed to fetch session agents' })
  }
})

// GET /api/cast/sessions/recent
// Returns recent sessions (today) with their agent runs for the PastSessionsAccordion
sessionAgentsRouter.get('/', (req, res) => {
  try {
    const db = getCastDb()
    if (!db) {
      return res.json({ sessions: [] })
    }

    const limit = Math.max(1, Math.min(Number(req.query.limit) || 10, 50))

    // Get sessions from today with aggregated stats
    const sessions = db.prepare(`
      SELECT
        s.id AS session_id,
        s.project,
        MIN(ar.started_at) AS started_at,
        COUNT(ar.id) AS agent_count,
        COALESCE(SUM(ar.cost_usd), 0) AS total_cost,
        CASE
          WHEN MAX(ar.ended_at) IS NOT NULL AND MIN(ar.started_at) IS NOT NULL
          THEN CAST((julianday(MAX(ar.ended_at)) - julianday(MIN(ar.started_at))) * 86400000 AS INTEGER)
          ELSE NULL
        END AS duration_ms
      FROM sessions s
      INNER JOIN agent_runs ar ON ar.session_id = s.id
      WHERE ar.started_at >= date('now')
      GROUP BY s.id
      ORDER BY MIN(ar.started_at) DESC
      LIMIT ?
    `).all(limit) as Array<{
      session_id: string; project: string | null; started_at: string;
      agent_count: number; total_cost: number; duration_ms: number | null
    }>

    // Get JSONL-based costs (the real total including cache tokens)
    const costMap = getSessionCostMap()

    // For each session, fetch the agent runs
    const result = sessions.map(s => {
      const agents = db!.prepare(`
        SELECT
          ar.id, ar.session_id, ar.agent, ar.model, ar.started_at, ar.ended_at,
          ar.status, ar.input_tokens, ar.output_tokens, ar.cost_usd,
          (SELECT dd.prompt_snippet FROM dispatch_decisions dd
            WHERE dd.session_id = ar.session_id AND dd.chosen_agent = ar.agent
              AND unixepoch(dd.created_at) <= unixepoch(ar.started_at) + 60
            ORDER BY unixepoch(dd.created_at) DESC LIMIT 1) AS task_summary,
          CASE
            WHEN ar.ended_at IS NOT NULL
            THEN CAST((julianday(ar.ended_at) - julianday(ar.started_at)) * 86400000 AS INTEGER)
            ELSE NULL
          END AS duration_ms
        FROM agent_runs ar
        WHERE ar.session_id = ?
        ORDER BY ar.started_at ASC
      `).all(s.session_id) as Array<{
        id: string; session_id: string; agent: string; model: string;
        started_at: string; ended_at: string | null; status: string;
        input_tokens: number; output_tokens: number; cost_usd: number;
        task_summary: string | null; duration_ms: number | null
      }>

      return {
        sessionId: s.session_id,
        startedAt: s.started_at,
        agentCount: s.agent_count,
        totalCost: costMap.get(s.session_id) ?? s.total_cost,
        duration_ms: s.duration_ms,
        agents,
      }
    })

    res.json({ sessions: result })
  } catch (err) {
    console.error('Recent sessions error:', err)
    res.status(500).json({ error: 'Failed to fetch recent sessions' })
  }
})

// GET /api/cast/worktrees
// Returns parsed output of `git worktree list --porcelain`
worktreesRouter.get('/', (_req, res) => {
  try {
    const output = execSync('git worktree list --porcelain 2>/dev/null || true', {
      encoding: 'utf-8',
      timeout: 5000,
    })

    const worktrees: Array<{
      path: string
      branch: string | null
      head: string
    }> = []

    let current: { path: string; branch: string | null; head: string } | null = null

    for (const line of output.split('\n')) {
      if (line.startsWith('worktree ')) {
        if (current) worktrees.push(current)
        current = { path: line.slice(9), branch: null, head: '' }
      } else if (line.startsWith('HEAD ') && current) {
        current.head = line.slice(5)
      } else if (line.startsWith('branch ') && current) {
        current.branch = line.slice(7).replace('refs/heads/', '')
      }
    }
    if (current) worktrees.push(current)

    res.json({ worktrees })
  } catch (err) {
    console.error('Worktrees error:', err)
    res.json({ worktrees: [] })
  }
})
