import { Router } from 'express'
import Database from 'better-sqlite3'
import { getCastDb } from './castDb.js'
import { CAST_DB } from '../constants.js'
import fs from 'fs'

export const taskQueueRouter = Router()

taskQueueRouter.get('/', (_req, res) => {
  try {
    const db = getCastDb()
    if (!db) {
      return res.json({
        tasks: [],
        counts: { pending: 0, claimed: 0, done: 0, failed: 0 },
      })
    }

    const tableCheck = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='task_queue'"
    ).get()
    if (!tableCheck) {
      // task_queue table absent — fall through to agent_runs fallback
      try {
        const agentRuns = db.prepare(`
          SELECT id, agent, model, status, started_at, ended_at
          FROM agent_runs
          ORDER BY started_at DESC
          LIMIT 20
        `).all() as Array<{
          id: number; agent: string; model: string; status: string;
          started_at: string; ended_at: string | null
        }>

        const mapStatus = (s: string): string => {
          if (s === 'running') return 'claimed'
          if (s === 'done' || s === 'DONE' || s === 'DONE_WITH_CONCERNS') return 'done'
          if (s === 'BLOCKED' || s === 'failed') return 'failed'
          return 'pending'
        }

        const syntheticTasks = agentRuns.map(r => ({
          id: String(r.id),
          agent: r.agent,
          priority: 0,
          status: mapStatus(r.status),
          created_at: r.started_at,
          retry_count: 0,
          scheduled_for: null,
          result_summary: r.status,
          task: `Agent run: ${r.agent}`,
        }))

        const syntheticCounts: Record<string, number> = { pending: 0, claimed: 0, done: 0, failed: 0 }
        for (const t of syntheticTasks) {
          if (t.status in syntheticCounts) syntheticCounts[t.status]++
        }

        return res.json({ tasks: syntheticTasks, counts: syntheticCounts, source: 'agent_runs' })
      } catch {
        // agent_runs also absent
        return res.json({
          tasks: [],
          counts: { pending: 0, claimed: 0, done: 0, failed: 0 },
        })
      }
    }

    // result_summary was dropped from the canonical task_queue schema — omit it to
    // avoid "no such column" errors on fresh installs with the v9 schema.
    const tasks = db.prepare(`
      SELECT
        id, agent, priority, status, created_at, retry_count,
        scheduled_for, task
      FROM task_queue
      ORDER BY priority ASC, created_at DESC
    `).all() as Array<{
      id: string; agent: string; priority: number; status: string;
      created_at: string; retry_count: number; scheduled_for: string | null;
      task: string | null
    }>

    const countsRows = db.prepare(`
      SELECT status, COUNT(*) AS cnt FROM task_queue GROUP BY status
    `).all() as Array<{ status: string; cnt: number }>

    const counts: Record<string, number> = { pending: 0, claimed: 0, done: 0, failed: 0 }
    for (const r of countsRows) {
      if (r.status in counts) counts[r.status] = r.cnt
    }

    // If task_queue has no active work, fall back to agent_runs for display
    if (counts.pending + counts.claimed === 0) {
      try {
        const agentRuns = db.prepare(`
          SELECT id, agent, model, status, started_at, ended_at
          FROM agent_runs
          ORDER BY started_at DESC
          LIMIT 20
        `).all() as Array<{
          id: number; agent: string; model: string; status: string;
          started_at: string; ended_at: string | null
        }>

        const mapStatus = (s: string): string => {
          if (s === 'running') return 'claimed'
          if (s === 'done' || s === 'DONE' || s === 'DONE_WITH_CONCERNS') return 'done'
          if (s === 'BLOCKED' || s === 'failed') return 'failed'
          return 'pending'
        }

        const syntheticTasks = agentRuns.map(r => ({
          id: String(r.id),
          agent: r.agent,
          priority: 0,
          status: mapStatus(r.status),
          created_at: r.started_at,
          retry_count: 0,
          scheduled_for: null,
          result_summary: r.status,
          task: `Agent run: ${r.agent}`,
        }))

        const syntheticCounts: Record<string, number> = { pending: 0, claimed: 0, done: 0, failed: 0 }
        for (const t of syntheticTasks) {
          if (t.status in syntheticCounts) syntheticCounts[t.status]++
        }

        return res.json({ tasks: syntheticTasks, counts: syntheticCounts, source: 'agent_runs' })
      } catch {
        // agent_runs table may not exist; fall through to empty task_queue response
      }
    }

    res.json({ tasks, counts })
  } catch (err) {
    console.error('Task queue error:', err)
    res.status(500).json({ error: 'Failed to fetch task queue' })
  }
})

taskQueueRouter.delete('/:id', (req, res) => {
  const { id } = req.params
  if (!id || !/^[a-zA-Z0-9_-]+$/.test(id)) {
    return res.status(400).json({ error: 'Invalid task id' })
  }
  if (!fs.existsSync(CAST_DB)) {
    return res.status(404).json({ error: 'cast.db not found' })
  }
  let db: ReturnType<typeof Database> | null = null
  try {
    db = new Database(CAST_DB, { fileMustExist: true })
    const tableCheck = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='task_queue'"
    ).get()
    if (!tableCheck) {
      return res.status(404).json({ error: 'Task not found' })
    }
    const result = db.prepare('DELETE FROM task_queue WHERE id = ?').run(id)
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Task not found' })
    }
    res.json({ success: true, deleted: id })
  } catch (err) {
    console.error('Delete task error:', err)
    res.status(500).json({ error: 'Failed to delete task' })
  } finally {
    if (db) db.close()
  }
})
