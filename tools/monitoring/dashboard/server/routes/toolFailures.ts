import { Router } from 'express'
import fs from 'fs'
import os from 'os'
import path from 'path'
import { getCastDb } from './castDb.js'

export const toolFailuresRouter = Router()

const TOOL_FAILURES_PATH = path.join(os.homedir(), '.claude/cast/tool-failures.jsonl')

// GET /api/cast/tool-failures
toolFailuresRouter.get('/', (req, res) => {
  try {
    const rawLimit = Number(req.query.limit)
    const limit = Math.min(Number.isFinite(rawLimit) && rawLimit > 0 ? rawLimit : 100, 500)
    const since = req.query.since as string | undefined

    // Prefer the SQLite tool_call_failures table (v8 canonical — 500+ rows)
    const db = getCastDb()
    if (db) {
      const tableCheck = db.prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='tool_call_failures'"
      ).get()

      if (tableCheck) {
        const conditions: string[] = []
        const params: unknown[] = []

        if (since) {
          conditions.push('timestamp >= ?')
          params.push(since)
        }

        const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

        // Count total (with optional since filter)
        const totalRow = db.prepare(
          `SELECT COUNT(*) AS total FROM tool_call_failures ${where}`
        ).get(...params) as { total: number }
        const total = totalRow.total

        // tool_call_failures cols: id, timestamp, session_id, tool_name, error, project, data
        // Map tool_name -> tool to match ToolFailure frontend interface
        const rows = db.prepare(`
          SELECT
            id,
            timestamp,
            session_id,
            tool_name AS tool,
            error,
            project,
            data
          FROM tool_call_failures
          ${where}
          ORDER BY timestamp DESC
          LIMIT ?
        `).all([...params, limit]) as Array<Record<string, unknown>>

        return res.json({ failures: rows, total })
      }
    }

    // Fallback: JSONL file (pre-v8 installs)
    if (!fs.existsSync(TOOL_FAILURES_PATH)) {
      return res.json({ failures: [], total: 0 })
    }

    const content = fs.readFileSync(TOOL_FAILURES_PATH, 'utf-8')
    const lines = content.trim().split('\n').filter(Boolean)

    let failures: Array<Record<string, unknown>> = []
    for (const line of lines) {
      try {
        failures.push(JSON.parse(line))
      } catch {
        // skip malformed lines
      }
    }

    if (since) {
      const sinceDate = new Date(since).getTime()
      failures = failures.filter(f => {
        const ts = f.timestamp as string | undefined
        return ts ? new Date(ts).getTime() >= sinceDate : true
      })
    }

    failures.reverse()
    const total = failures.length
    failures = failures.slice(0, limit)

    res.json({ failures, total })
  } catch (err) {
    console.error('[tool-failures] error:', err)
    res.json({ failures: [], total: 0 })
  }
})

// GET /api/cast/tool-failures/stats
toolFailuresRouter.get('/stats', (_req, res) => {
  try {
    // Prefer the SQLite tool_call_failures table (v8 canonical)
    const db = getCastDb()
    if (db) {
      const tableCheck = db.prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='tool_call_failures'"
      ).get()

      if (tableCheck) {
        const totalRow = db.prepare(
          'SELECT COUNT(*) AS total FROM tool_call_failures'
        ).get() as { total: number }

        const byToolRows = db.prepare(
          'SELECT tool_name AS tool, COUNT(*) AS cnt FROM tool_call_failures GROUP BY tool_name'
        ).all() as Array<{ tool: string; cnt: number }>

        const byTool: Record<string, number> = {}
        for (const row of byToolRows) {
          byTool[row.tool ?? 'unknown'] = row.cnt
        }

        const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
        const last24hRow = db.prepare(
          'SELECT COUNT(*) AS cnt FROM tool_call_failures WHERE timestamp >= ?'
        ).get(since24h) as { cnt: number }

        return res.json({ total: totalRow.total, byTool, last24h: last24hRow.cnt })
      }
    }

    // Fallback: JSONL file
    if (!fs.existsSync(TOOL_FAILURES_PATH)) {
      return res.json({ total: 0, byTool: {}, last24h: 0 })
    }

    const content = fs.readFileSync(TOOL_FAILURES_PATH, 'utf-8')
    const lines = content.trim().split('\n').filter(Boolean)

    const byTool: Record<string, number> = {}
    let last24h = 0
    const cutoff = Date.now() - 24 * 60 * 60 * 1000

    for (const line of lines) {
      try {
        const entry = JSON.parse(line) as { tool?: string; timestamp?: string }
        const tool = entry.tool ?? 'unknown'
        byTool[tool] = (byTool[tool] ?? 0) + 1
        if (entry.timestamp && new Date(entry.timestamp).getTime() >= cutoff) {
          last24h++
        }
      } catch {
        // skip
      }
    }

    res.json({ total: lines.length, byTool, last24h })
  } catch (err) {
    console.error('[tool-failures/stats] error:', err)
    res.json({ total: 0, byTool: {}, last24h: 0 })
  }
})
