import type { LiveEvent } from '../../src/types/index.js'
import { getCastDb } from '../routes/castDb.js'

type BroadcastFn = (event: LiveEvent) => void

// Track the highest rowid seen for each table so we emit only new rows
let lastAgentRunRowid = 0
let lastSessionRowid = 0
let lastRoutingRowid = 0

// Log-once guard: suppress repeated per-tick errors from a missing column
let agentRunQueryErrorLogged = false

let interval: NodeJS.Timeout | null = null

function pollOnce(broadcast: BroadcastFn) {
  const db = getCastDb()
  if (!db) return

  // agent_runs — emit one event per new row (agent name + status + session_id)
  try {
    const newRuns = db.prepare(
      'SELECT rowid, agent, status, session_id FROM agent_runs WHERE rowid > ? ORDER BY rowid ASC LIMIT 50'
    ).all(lastAgentRunRowid) as Array<{ rowid: number; agent: string; status: string; session_id: string | null }>
    for (const row of newRuns) {
      broadcast({
        type: 'db_change_agent_run',
        timestamp: new Date().toISOString(),
        dbChangeTable: 'agent_runs',
        dbChangeRowId: row.rowid,
        dbChangeAgentName: row.agent,
        dbChangeStatus: row.status,
        dbChangeSessionId: row.session_id ?? undefined,
      })
      lastAgentRunRowid = row.rowid
    }
    agentRunQueryErrorLogged = false
  } catch (err) {
    if (!agentRunQueryErrorLogged) {
      console.error('[castDbWatcher] agent_runs poll failed (will not repeat):', err)
      agentRunQueryErrorLogged = true
    }
  }

  // sessions
  try {
    const newSessions = db.prepare(
      'SELECT rowid, id FROM sessions WHERE rowid > ? ORDER BY rowid ASC LIMIT 50'
    ).all(lastSessionRowid) as Array<{ rowid: number; id: string }>
    for (const row of newSessions) {
      broadcast({
        type: 'db_change_session',
        timestamp: new Date().toISOString(),
        dbChangeTable: 'sessions',
        dbChangeRowId: row.rowid,
        dbChangeSessionId: row.id,
      })
      lastSessionRowid = row.rowid
    }
  } catch { /* skip */ }

  // routing_events
  try {
    const newRouting = db.prepare(
      'SELECT rowid FROM routing_events WHERE rowid > ? ORDER BY rowid ASC LIMIT 50'
    ).all(lastRoutingRowid) as Array<{ rowid: number }>
    for (const row of newRouting) {
      broadcast({
        type: 'db_change_routing_event',
        timestamp: new Date().toISOString(),
        dbChangeTable: 'routing_events',
        dbChangeRowId: row.rowid,
      })
      lastRoutingRowid = row.rowid
    }
  } catch { /* skip */ }
}

/** Initialise the last-seen rowids from current DB state, so we don't re-emit historical rows on startup */
function initHighWatermarks() {
  const db = getCastDb()
  if (!db) return
  try {
    const r = db.prepare('SELECT MAX(rowid) as m FROM agent_runs').get() as { m: number | null }
    lastAgentRunRowid = r?.m ?? 0
  } catch { /* skip */ }
  try {
    const r = db.prepare('SELECT MAX(rowid) as m FROM sessions').get() as { m: number | null }
    lastSessionRowid = r?.m ?? 0
  } catch { /* skip */ }
  try {
    const r = db.prepare('SELECT MAX(rowid) as m FROM routing_events').get() as { m: number | null }
    lastRoutingRowid = r?.m ?? 0
  } catch { /* skip */ }
}

export function startCastDbWatcher(broadcast: BroadcastFn, pollMs = 3000) {
  initHighWatermarks()
  interval = setInterval(() => pollOnce(broadcast), pollMs)
}

export function stopCastDbWatcher() {
  if (interval) { clearInterval(interval); interval = null }
}
