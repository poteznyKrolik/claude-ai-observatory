import { Router } from 'express'
import path from 'path'
import { getCachedSessions, loadSession } from '../parsers/sessions.js'
import { estimateCost } from '../utils/costEstimate.js'
import { PROJECTS_DIR } from '../constants.js'
import { getCastDb, getCastDbWritable } from './castDb.js'
import type { Session, LogEntry, ContentBlock } from '../../src/types/index.js'

type SessionWithStatus = Session & { status?: string }

const router = Router()


router.get('/', (req, res) => {
  let sessions = getCachedSessions()

  const project = req.query.project as string | undefined
  if (project) {
    sessions = sessions.filter(s => s.project === project)
  }

  const limit = Number(req.query.limit) || 50
  sessions = sessions.slice(0, limit)

  // Attempt cast.db fallback for sessions where durationMs is null;
  // also filter out soft-deleted sessions
  try {
    const db = getCastDb()
    if (db) {
      // Collect IDs of soft-deleted sessions
      const deletedRows = db.prepare(
        'SELECT id FROM sessions WHERE deleted_at IS NOT NULL'
      ).all() as Array<{ id: string }>
      const deletedIds = new Set(deletedRows.map(r => r.id))
      sessions = sessions.filter(s => !deletedIds.has(s.id))

      const nullDurationSessions = sessions.filter(s => s.durationMs == null)
      if (nullDurationSessions.length > 0) {
        // sessions.model was dropped in v9 canonical schema (0 of 261 live rows had it set).
        // Removing it prevents the prepare() call from throwing on fresh installs,
        // which would silently kill the entire durationMs/status backfill block.
        const stmt = db.prepare(
          'SELECT id AS session_id, started_at, ended_at, status FROM sessions WHERE id = ?'
        )
        for (const session of nullDurationSessions) {
          try {
            const row = stmt.get(session.id) as { session_id: string; started_at: string; ended_at: string | null; status: string | null } | undefined
            if (row?.started_at && row?.ended_at) {
              const diff = new Date(row.ended_at).getTime() - new Date(row.started_at).getTime()
              if (!isNaN(diff)) {
                session.durationMs = diff
              }
            }
            if (row?.status && !(session as SessionWithStatus).status) {
              (session as SessionWithStatus).status = row.status
            }
          } catch {
            // skip individual lookup failures
          }
        }
      }
    }
  } catch {
    // cast.db unavailable — skip fallback silently
  }

  res.json(sessions)
})

function formatTime(ts: string): string {
  const d = new Date(ts)
  return d.toTimeString().slice(0, 8) // HH:MM:SS
}

function formatNumber(n: number): string {
  return n.toLocaleString('en-US')
}

function formatDuration(ms: number): string {
  const totalSec = Math.floor(ms / 1000)
  const h = Math.floor(totalSec / 3600)
  const m = Math.floor((totalSec % 3600) / 60)
  const s = totalSec % 60
  if (h > 0) return `${h}h ${m}m ${s}s`
  if (m > 0) return `${m}m ${s}s`
  return `${s}s`
}

function renderContentBlock(block: ContentBlock, timestamp: string): string {
  if (block.type === 'text' && block.text) {
    return block.text
  }
  if (block.type === 'tool_use') {
    const inputStr = block.input ? JSON.stringify(block.input, null, 2) : '{}'
    return `### [tool_use] ${block.name ?? 'unknown'} — ${formatTime(timestamp)}\n\`\`\`json\n${inputStr}\n\`\`\``
  }
  if (block.type === 'tool_result') {
    return `### [tool_result] — ${formatTime(timestamp)}\n${block.text ?? 'Result received'}`
  }
  return ''
}

router.get('/:projectEncoded/:sessionId/export', (req, res) => {
  const entries = loadSession(req.params.projectEncoded, req.params.sessionId)
  if (entries.length === 0) {
    res.status(404).json({ error: 'Session not found' })
    return
  }

  const firstEntry = entries[0]
  const lastEntry = entries[entries.length - 1]
  const projectName = decodeURIComponent(req.params.projectEncoded).split('/').pop() || req.params.projectEncoded
  const slug = firstEntry.slug || req.params.sessionId

  // Compute token totals
  let inputTokens = 0
  let outputTokens = 0
  let cacheCreation = 0
  let cacheRead = 0
  const modelCounts: Record<string, number> = {}

  for (const entry of entries) {
    if (entry.message?.usage) {
      inputTokens += entry.message.usage.input_tokens ?? 0
      outputTokens += entry.message.usage.output_tokens ?? 0
      cacheCreation += entry.message.usage.cache_creation_input_tokens ?? 0
      cacheRead += entry.message.usage.cache_read_input_tokens ?? 0
    }
    if (entry.type === 'assistant' && entry.message?.model) {
      modelCounts[entry.message.model] = (modelCounts[entry.message.model] ?? 0) + 1
    }
  }

  const dominantModel = Object.entries(modelCounts)
    .sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'unknown'

  const cost = estimateCost(inputTokens, outputTokens, cacheCreation, cacheRead, dominantModel)

  // Compute duration
  const startMs = new Date(firstEntry.timestamp).getTime()
  const endMs = new Date(lastEntry.timestamp).getTime()
  const durationStr = endMs > startMs ? formatDuration(endMs - startMs) : 'N/A'

  // Build markdown
  const lines: string[] = []
  lines.push(`# Session: ${slug}`)
  lines.push(`**Project:** ${projectName}  **Started:** ${firstEntry.timestamp}  **Duration:** ${durationStr}`)
  lines.push('')
  lines.push('## Token Usage')
  lines.push('| Metric | Count |')
  lines.push('|---|---|')
  lines.push(`| Input tokens | ${formatNumber(inputTokens)} |`)
  lines.push(`| Output tokens | ${formatNumber(outputTokens)} |`)
  lines.push(`| Cache creation | ${formatNumber(cacheCreation)} |`)
  lines.push(`| Cache reads | ${formatNumber(cacheRead)} |`)
  lines.push(`| **Estimated cost** | **$${cost.toFixed(4)}** |`)
  lines.push('')
  lines.push('## Messages')

  for (const entry of entries) {
    if (entry.type === 'progress') continue

    const ts = entry.timestamp
    const role = entry.message?.role ?? entry.type
    const content = entry.message?.content

    if (typeof content === 'string') {
      lines.push('')
      lines.push(`### [${role}] ${formatTime(ts)}`)
      lines.push(content)
    } else if (Array.isArray(content)) {
      for (const block of content) {
        const rendered = renderContentBlock(block, ts)
        if (rendered) {
          // tool_use and tool_result blocks already include their own header
          if (block.type === 'tool_use' || block.type === 'tool_result') {
            lines.push('')
            lines.push(rendered)
          } else {
            lines.push('')
            lines.push(`### [${role}] ${formatTime(ts)}`)
            lines.push(rendered)
          }
        }
      }
    }
  }

  const body = lines.join('\n')
  res.json({ body })
})

router.get('/:projectEncoded/:sessionId', (req, res) => {
  const entries = loadSession(req.params.projectEncoded, req.params.sessionId)
  if (entries.length === 0) {
    res.status(404).json({ error: 'Session not found' })
    return
  }
  res.json(entries)
})

router.delete('/:projectEncoded/:sessionId', (req, res) => {
  const { projectEncoded, sessionId } = req.params

  // Strict UUID validation (8-4-4-4-12 format, v4)
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(sessionId)) {
    res.status(400).json({ error: 'Invalid session ID' })
    return
  }

  // Path traversal guard: still verify the path is inside PROJECTS_DIR
  // even though we now soft-delete via DB rather than unlinking
  const resolvedBase = path.resolve(PROJECTS_DIR)
  const filePath = path.resolve(resolvedBase, projectEncoded, `${sessionId}.jsonl`)
  if (!filePath.startsWith(resolvedBase + path.sep)) {
    res.status(400).json({ error: 'Invalid path' })
    return
  }

  const db = getCastDbWritable()
  if (!db) {
    res.status(503).json({ error: 'Database unavailable' })
    return
  }
  try {
    // Upsert the session row then soft-delete it
    db.prepare(
      `INSERT INTO sessions (id, deleted_at) VALUES (?, datetime('now'))
       ON CONFLICT(id) DO UPDATE SET deleted_at = datetime('now')`
    ).run(sessionId)
    const row = db.prepare('SELECT deleted_at FROM sessions WHERE id = ?').get(sessionId) as { deleted_at: string } | undefined
    res.json({ id: sessionId, deleted_at: row?.deleted_at ?? null })
  } catch {
    res.status(500).json({ error: 'Failed to soft-delete session' })
  } finally {
    db.close()
  }
})

export { router as sessionsRouter }
