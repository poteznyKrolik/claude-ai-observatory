import { Router } from 'express'
import { getCastDb } from './castDb.js'
import { parseWorkLog, synthesizeWorkLog } from '../parsers/workLog.js'
import type { ParsedWorkLog } from '../parsers/workLog.js'

export const workLogStreamRouter = Router()

// ── Types ─────────────────────────────────────────────────────────────────────

export interface WorkLogEntry {
  agentRunId: string
  agentName: string
  model: string | null
  sessionId: string | null
  startedAt: string
  status: string | null // DONE | DONE_WITH_CONCERNS | BLOCKED | NEEDS_CONTEXT | null
  workLog: ParsedWorkLog | null
  partialWorkLog: string | null // from agent_truncations.partial_work_log
  isTruncated: boolean
  // Phase 3 annotation slots (null for now — populated in Phase 3 via LEFT JOINs)
  parryGuardFired: boolean
  qualityGateVerdict: string | null
  dispatchedBy: string | null
  dispatchedTo: string[] | null
}

// ── DB row type ───────────────────────────────────────────────────────────────

interface AgentRunRow {
  id: number
  session_id: string | null
  agent: string
  model: string | null
  started_at: string | null
  status: string | null
  response: string | null      // agent's actual output (canonical)
  task_summary: string | null  // from dispatch_decisions.prompt_snippet (replaces dropped ar.prompt)
  // from correlated subquery against agent_truncations
  partial_work_log: string | null
  has_status: number | null
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function rowToEntry(row: AgentRunRow): WorkLogEntry {
  // response is the agent's output (Status block + Work Log) — preferred source.
  // task_summary (from dispatch_decisions.prompt_snippet) is a fallback when response is absent.
  const content = row.response ?? row.task_summary ?? ''
  // Try parsing a ## Work Log section from the content
  const workLog = parseWorkLog(content) ?? synthesizeWorkLog(content) ?? null

  const isTruncated = row.partial_work_log !== null || row.has_status === 0

  return {
    agentRunId: String(row.id),
    agentName: row.agent,
    model: row.model,
    sessionId: row.session_id,
    startedAt: row.started_at ?? '',
    status: row.status,
    workLog,
    partialWorkLog: row.partial_work_log ?? null,
    isTruncated,
    // Phase 3 annotation slots — always null until Phase 3 implementation
    parryGuardFired: false,
    qualityGateVerdict: null,
    dispatchedBy: null,
    dispatchedTo: null,
  }
}

// ── GET /api/work-log-stream?limit=50&since=<iso> ─────────────────────────────

workLogStreamRouter.get('/', (req, res) => {
  try {
    const db = getCastDb()
    if (!db) return res.json({ entries: [] })

    const limit = Math.max(1, Math.min(Number(req.query.limit) || 50, 200))
    const since = req.query.since as string | undefined

    const conditions: string[] = []
    const params: unknown[] = []

    if (since) {
      conditions.push('ar.started_at >= ?')
      params.push(since)
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

    // Check whether agent_runs.response column exists (added in agent-team d8612c0).
    // Older cast.db installs won't have it — fall back to NULL so the row type stays consistent.
    const agentRunsCols = db.prepare('PRAGMA table_info(agent_runs)').all() as Array<{ name: string }>
    const hasResponseCol = agentRunsCols.some(c => c.name === 'response')
    const responseSelect = hasResponseCol ? 'ar.response' : 'NULL AS response'

    // Check agent_truncations table and its agent_id column exist before joining.
    // agent_id is required to avoid fan-out: (session_id, agent_type) is non-unique
    // (multiple truncation rows per agent type expand row count by ~1.65×).
    // Correlated subquery on agent_id guarantees at most ONE truncation row per run.
    const truncTableExists = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='agent_truncations'"
    ).get()
    const truncCols = truncTableExists
      ? (db.prepare('PRAGMA table_info(agent_truncations)').all() as Array<{ name: string }>)
      : []
    const hasAgentIdCol = truncCols.some(c => c.name === 'agent_id')

    let rows: AgentRunRow[]

    if (truncTableExists && hasAgentIdCol) {
      rows = db.prepare(`
        SELECT
          ar.id,
          ar.session_id,
          ar.agent,
          ar.model,
          ar.started_at,
          ar.status,
          ${responseSelect},
          (SELECT dd.prompt_snippet FROM dispatch_decisions dd
            WHERE dd.session_id = ar.session_id AND dd.chosen_agent = ar.agent
              AND unixepoch(dd.created_at) <= unixepoch(ar.started_at) + 60
            ORDER BY unixepoch(dd.created_at) DESC LIMIT 1) AS task_summary,
          (SELECT t.partial_work_log FROM agent_truncations t
            WHERE t.agent_id = ar.agent_id AND ar.agent_id IS NOT NULL
            ORDER BY t.timestamp DESC LIMIT 1) AS partial_work_log,
          (SELECT t.has_status FROM agent_truncations t
            WHERE t.agent_id = ar.agent_id AND ar.agent_id IS NOT NULL
            ORDER BY t.timestamp DESC LIMIT 1) AS has_status
        FROM agent_runs ar
        ${where}
        ORDER BY ar.started_at DESC
        LIMIT ?
      `).all([...params, limit]) as AgentRunRow[]
    } else {
      rows = db.prepare(`
        SELECT
          ar.id,
          ar.session_id,
          ar.agent,
          ar.model,
          ar.started_at,
          ar.status,
          ${responseSelect},
          (SELECT dd.prompt_snippet FROM dispatch_decisions dd
            WHERE dd.session_id = ar.session_id AND dd.chosen_agent = ar.agent
              AND unixepoch(dd.created_at) <= unixepoch(ar.started_at) + 60
            ORDER BY unixepoch(dd.created_at) DESC LIMIT 1) AS task_summary,
          NULL AS partial_work_log,
          NULL AS has_status
        FROM agent_runs ar
        ${where}
        ORDER BY ar.started_at DESC
        LIMIT ?
      `).all([...params, limit]) as AgentRunRow[]
    }

    const entries = rows.map(rowToEntry)
    return res.json({ entries })
  } catch (err) {
    console.error('[work-log-stream] GET / error:', err)
    return res.json({ entries: [] })
  }
})

// ── GET /api/work-log-stream/:agentRunId ──────────────────────────────────────

workLogStreamRouter.get('/:agentRunId', (req, res) => {
  try {
    const db = getCastDb()
    if (!db) return res.status(404).json({ error: 'Not found' })

    const { agentRunId } = req.params
    const id = parseInt(agentRunId, 10)
    if (isNaN(id)) return res.status(400).json({ error: 'Invalid agentRunId' })

    // Check whether agent_runs.response column exists (added in agent-team d8612c0).
    const agentRunsCols = db.prepare('PRAGMA table_info(agent_runs)').all() as Array<{ name: string }>
    const hasResponseCol = agentRunsCols.some(c => c.name === 'response')
    const responseSelect = hasResponseCol ? 'ar.response' : 'NULL AS response'

    // Check agent_truncations table and agent_id column exist.
    const truncTableExists = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='agent_truncations'"
    ).get()
    const truncCols2 = truncTableExists
      ? (db.prepare('PRAGMA table_info(agent_truncations)').all() as Array<{ name: string }>)
      : []
    const hasAgentIdCol2 = truncCols2.some(c => c.name === 'agent_id')

    let row: AgentRunRow | null

    if (truncTableExists && hasAgentIdCol2) {
      row = db.prepare(`
        SELECT
          ar.id,
          ar.session_id,
          ar.agent,
          ar.model,
          ar.started_at,
          ar.status,
          ${responseSelect},
          (SELECT dd.prompt_snippet FROM dispatch_decisions dd
            WHERE dd.session_id = ar.session_id AND dd.chosen_agent = ar.agent
              AND unixepoch(dd.created_at) <= unixepoch(ar.started_at) + 60
            ORDER BY unixepoch(dd.created_at) DESC LIMIT 1) AS task_summary,
          (SELECT t.partial_work_log FROM agent_truncations t
            WHERE t.agent_id = ar.agent_id AND ar.agent_id IS NOT NULL
            ORDER BY t.timestamp DESC LIMIT 1) AS partial_work_log,
          (SELECT t.has_status FROM agent_truncations t
            WHERE t.agent_id = ar.agent_id AND ar.agent_id IS NOT NULL
            ORDER BY t.timestamp DESC LIMIT 1) AS has_status
        FROM agent_runs ar
        WHERE ar.id = ?
        LIMIT 1
      `).get(id) as AgentRunRow | null
    } else {
      row = db.prepare(`
        SELECT
          ar.id,
          ar.session_id,
          ar.agent,
          ar.model,
          ar.started_at,
          ar.status,
          ${responseSelect},
          (SELECT dd.prompt_snippet FROM dispatch_decisions dd
            WHERE dd.session_id = ar.session_id AND dd.chosen_agent = ar.agent
              AND unixepoch(dd.created_at) <= unixepoch(ar.started_at) + 60
            ORDER BY unixepoch(dd.created_at) DESC LIMIT 1) AS task_summary,
          NULL AS partial_work_log,
          NULL AS has_status
        FROM agent_runs ar
        WHERE ar.id = ?
        LIMIT 1
      `).get(id) as AgentRunRow | null
    }

    if (!row) return res.status(404).json({ error: 'Agent run not found' })

    const entry = rowToEntry(row)
    return res.json({ entry })
  } catch (err) {
    console.error('[work-log-stream] GET /:agentRunId error:', err)
    return res.status(500).json({ error: 'Internal server error' })
  }
})
