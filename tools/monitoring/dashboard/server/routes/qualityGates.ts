import { Router } from 'express'
import { getCastDb } from './castDb.js'

export const qualityGatesRouter = Router()
export const dispatchDecisionsRouter = Router()

// GET /api/quality-gates
qualityGatesRouter.get('/', (req, res) => {
  try {
    const db = getCastDb()
    if (!db) {
      return res.json({ gates: [] })
    }

    const tableCheck = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='quality_gates'"
    ).get()
    if (!tableCheck) {
      return res.json({ gates: [] })
    }

    const limit = Math.max(1, Math.min(Number(req.query.limit) || 100, 500))
    const agent = req.query.agent as string | undefined
    const since = req.query.since as string | undefined
    const until = req.query.until as string | undefined

    const conditions: string[] = []
    const params: unknown[] = []

    if (agent) { conditions.push('agent_name = ?'); params.push(agent) }
    if (since) { conditions.push('timestamp >= ?'); params.push(since) }
    if (until) { conditions.push('timestamp <= ?'); params.push(until) }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

    const gates = db.prepare(`
      SELECT
        id,
        session_id,
        agent_name AS agent,
        status_line,
        contract_passed,
        retry_count,
        timestamp AS created_at
      FROM quality_gates
      ${where}
      ORDER BY timestamp DESC
      LIMIT ?
    `).all([...params, limit])

    return res.json({ gates })
  } catch (err) {
    console.error('[quality-gates] error:', err)
    return res.json({ gates: [] })
  }
})

// GET /api/quality-gates/stats
qualityGatesRouter.get('/stats', (req, res) => {
  try {
    const db = getCastDb()
    if (!db) {
      return res.json({ total: 0, pass_rate: 0, by_agent: {}, by_status: {} })
    }

    const tableCheck = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='quality_gates'"
    ).get()
    if (!tableCheck) {
      return res.json({ total: 0, pass_rate: 0, by_agent: {}, by_status: {} })
    }

    const since = req.query.since as string | undefined
    const until = req.query.until as string | undefined

    const conditions: string[] = []
    const params: unknown[] = []
    if (since) { conditions.push('timestamp >= ?'); params.push(since) }
    if (until) { conditions.push('timestamp <= ?'); params.push(until) }
    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

    const totalRow = db.prepare(
      `SELECT COUNT(*) AS total, SUM(CASE WHEN contract_passed = 1 THEN 1 ELSE 0 END) AS passed FROM quality_gates ${where}`
    ).get(...params) as { total: number; passed: number }

    const total = totalRow.total
    const pass_rate = total > 0 ? Math.round((totalRow.passed / total) * 100) : 0

    // Per-agent stats
    const agentRows = db.prepare(`
      SELECT
        agent_name AS agent,
        COUNT(*) AS total,
        SUM(CASE WHEN contract_passed = 1 THEN 1 ELSE 0 END) AS passed
      FROM quality_gates
      ${where}
      GROUP BY agent_name
    `).all(...params) as Array<{ agent: string; total: number; passed: number }>

    const by_agent: Record<string, { total: number; passed: number; rate: number }> = {}
    for (const row of agentRows) {
      by_agent[row.agent] = {
        total: row.total,
        passed: row.passed,
        rate: row.total > 0 ? Math.round((row.passed / row.total) * 100) : 0,
      }
    }

    // Per-status breakdown (using status_line as grouping analogue for gate_type)
    const statusRows = db.prepare(`
      SELECT status_line, COUNT(*) AS cnt FROM quality_gates ${where} GROUP BY status_line
    `).all(...params) as Array<{ status_line: string; cnt: number }>

    const by_status: Record<string, number> = {}
    for (const row of statusRows) {
      by_status[row.status_line ?? 'unknown'] = row.cnt
    }

    return res.json({ total, pass_rate, by_agent, by_status })
  } catch (err) {
    console.error('[quality-gates/stats] error:', err)
    return res.json({ total: 0, pass_rate: 0, by_agent: {}, by_status: {} })
  }
})

// GET /api/dispatch-decisions
dispatchDecisionsRouter.get('/', (req, res) => {
  try {
    const db = getCastDb()
    if (!db) {
      return res.json({ decisions: [] })
    }

    const tableCheck = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='dispatch_events'"
    ).get()
    if (!tableCheck) {
      return res.json({ decisions: [] })
    }

    const limit = Math.max(1, Math.min(Number(req.query.limit) || 100, 500))

    // dispatch_events cols: id, agent, task_name, triggered_at, status, report_path
    // Alias to match the DispatchDecision frontend interface shape
    const decisions = db.prepare(`
      SELECT
        id,
        NULL AS session_id,
        triggered_at AS timestamp,
        agent AS dispatch_backend,
        task_name AS plan_file
      FROM dispatch_events
      ORDER BY triggered_at DESC
      LIMIT ?
    `).all(limit)

    return res.json({ decisions })
  } catch (err) {
    console.error('[dispatch-decisions] error:', err)
    return res.json({ decisions: [] })
  }
})
