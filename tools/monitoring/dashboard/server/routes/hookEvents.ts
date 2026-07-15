import { Router } from 'express'
import type { Request, Response } from 'express'
import { getCastDbWritable } from './castDb.js'

export const hookEventsRouter = Router()

// ── In-memory ring buffer (last 200 events) ──────────────────────────────────

interface HookEvent {
  id: string
  timestamp: string
  hook_type: string
  tool_name: string | null
  result: string | null
  duration_ms: number | null
  payload: Record<string, unknown>
}

const MAX_BUFFER = 200
const ringBuffer: HookEvent[] = []
let bufferSeq = 0

function addEvent(event: HookEvent) {
  if (ringBuffer.length >= MAX_BUFFER) {
    ringBuffer.shift()
  }
  ringBuffer.push(event)
}

// ── SSE client registry ──────────────────────────────────────────────────────

const sseClients: Set<Response> = new Set()

function broadcastToSse(event: HookEvent) {
  const data = `data: ${JSON.stringify(event)}\n\n`
  for (const client of sseClients) {
    try {
      client.write(data)
    } catch {
      sseClients.delete(client)
    }
  }
}

// ── POST /api/hook-events ─────────────────────────────────────────────────────
// Receives hook event JSON from HTTP hooks (e.g. CAST v4.6 HTTP hook scripts)
hookEventsRouter.post('/', (req: Request, res: Response) => {
  try {
    const body = req.body as Record<string, unknown>

    const event: HookEvent = {
      id: `${Date.now()}-${++bufferSeq}`,
      timestamp: (body.timestamp as string | undefined) ?? new Date().toISOString(),
      hook_type: (body.hook_type as string | undefined) ?? (body.event_type as string | undefined) ?? 'unknown',
      tool_name: (body.tool_name as string | null | undefined) ?? null,
      result: (body.result as string | null | undefined) ?? null,
      duration_ms: typeof body.duration_ms === 'number' ? body.duration_ms : null,
      payload: body,
    }

    addEvent(event)
    broadcastToSse(event)

    // Write to cast.db stream_events if table exists — non-fatal if it doesn't
    try {
      const db = getCastDbWritable()
      if (db) {
        try {
          const tableCheck = db.prepare(
            "SELECT name FROM sqlite_master WHERE type='table' AND name='stream_events'"
          ).get()

          if (tableCheck) {
            db.prepare(`
              INSERT INTO stream_events (id, timestamp, hook_type, tool_name, result, duration_ms, payload)
              VALUES (?, ?, ?, ?, ?, ?, ?)
            `).run(
              event.id,
              event.timestamp,
              event.hook_type,
              event.tool_name,
              event.result,
              event.duration_ms,
              JSON.stringify(event.payload),
            )
          }
        } finally {
          db.close()
        }
      }
    } catch {
      // Non-fatal: cast.db may not have stream_events table yet
    }

    res.status(201).json({ ok: true, id: event.id })
  } catch (err) {
    console.error('[hook-events] POST error:', err)
    res.status(500).json({ error: 'Failed to store hook event' })
  }
})

// ── GET /api/hook-events/stream — SSE endpoint ───────────────────────────────
hookEventsRouter.get('/stream', (req: Request, res: Response) => {
  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
  res.flushHeaders()

  // Send last 10 buffered events on connect so client has immediate data
  const recent = ringBuffer.slice(-10)
  for (const event of recent) {
    res.write(`data: ${JSON.stringify(event)}\n\n`)
  }

  sseClients.add(res)

  req.on('close', () => {
    sseClients.delete(res)
  })
})

// ── GET /api/hook-events/recent — last N events as JSON ──────────────────────
hookEventsRouter.get('/recent', (req: Request, res: Response) => {
  const limit = Math.max(1, Math.min(Number(req.query.limit) || 20, MAX_BUFFER))
  const events = ringBuffer.slice(-limit).reverse()
  res.json({ events, total: ringBuffer.length })
})
