import fs from 'fs'
import path from 'path'
import { Router } from 'express'
import Database from 'better-sqlite3'
import { CAST_DB, PROJECTS_DIR } from '../constants.js'
import { listSessions, loadSession } from '../parsers/sessions.js'
import { safeResolve } from '../utils/safeResolve.js'

export const seedRouter = Router()

let lastSeedAt = 0
const SEED_COOLDOWN_MS = 60_000

// ---------------------------------------------------------------------------
// Subagent token data helpers
// ---------------------------------------------------------------------------

interface SubagentEntry {
  inputTokens: number
  outputTokens: number
  startedAt: string | null
  endedAt: string | null
  spent: boolean
}

/**
 * Scan the subagents/ directory for a given session and return a map of
 * agentType -> SubagentEntry[]. Each entry represents one subagent run,
 * with token totals summed from that agent's JSONL file.
 */
function loadSubagentTokenData(
  projectEncoded: string,
  sessionId: string,
): Map<string, SubagentEntry[]> {
  const result = new Map<string, SubagentEntry[]>()

  const subagentsDir = safeResolve(PROJECTS_DIR, projectEncoded, sessionId, 'subagents')
  if (!subagentsDir || !fs.existsSync(subagentsDir)) return result

  let agentFiles: string[]
  try {
    agentFiles = fs.readdirSync(subagentsDir).filter(f => f.endsWith('.jsonl'))
  } catch {
    return result
  }

  for (const agentFile of agentFiles) {
    // agent-<id>.jsonl → agent-<id>
    const agentBase = path.basename(agentFile, '.jsonl')

    // Read meta for agentType; fall back to 'unknown'
    let agentType = 'unknown'
    const metaPath = safeResolve(subagentsDir, `${agentBase}.meta.json`)
    if (metaPath) {
      try {
        const meta = JSON.parse(fs.readFileSync(metaPath, 'utf-8'))
        if (typeof meta.agentType === 'string' && meta.agentType) {
          agentType = meta.agentType
        }
      } catch {
        // missing or malformed meta — leave as 'unknown'
      }
    }

    // Parse the JSONL to sum tokens and capture first/last timestamp
    const agentPath = safeResolve(subagentsDir, agentFile)
    if (!agentPath) continue

    let lines: string[]
    try {
      lines = fs.readFileSync(agentPath, 'utf-8').split('\n').filter(Boolean)
    } catch {
      continue
    }

    let inputTokens = 0
    let outputTokens = 0
    let startedAt: string | null = null
    let endedAt: string | null = null

    for (const line of lines) {
      try {
        const entry = JSON.parse(line)
        if (entry.message?.usage) {
          inputTokens += entry.message.usage.input_tokens ?? 0
          outputTokens += entry.message.usage.output_tokens ?? 0
        }
        const ts: string | undefined = entry.timestamp
        if (ts) {
          if (!startedAt) startedAt = ts
          endedAt = ts
        }
      } catch {
        // skip malformed lines
      }
    }

    if (!result.has(agentType)) result.set(agentType, [])
    result.get(agentType)!.push({ inputTokens, outputTokens, startedAt, endedAt, spent: false })
  }

  return result
}

/**
 * Find and claim the first unspent subagent entry matching agentName.
 * Returns the entry (marked spent) or null if no match.
 */
function claimSubagentEntry(
  tokenMap: Map<string, SubagentEntry[]>,
  agentName: string,
): SubagentEntry | null {
  const entries = tokenMap.get(agentName)
  if (!entries) return null
  const entry = entries.find(e => !e.spent)
  if (!entry) return null
  entry.spent = true
  return entry
}

function estimateCost(
  inputTokens: number,
  outputTokens: number,
  _cacheCreation = 0,
  _cacheRead = 0,
  _model?: string,
): number {
  return inputTokens * 0.000003 + outputTokens * 0.000015
}

seedRouter.post('/', (req, res) => {
  const now = Date.now()
  if (now - lastSeedAt < SEED_COOLDOWN_MS) {
    return res.status(429).json({ error: 'Seed cooldown: wait 60 seconds between runs' })
  }
  lastSeedAt = now

  try {
    // Schema is owned by the flagship's cast-db-init.sh — never created or altered by the dashboard.
    let db!: ReturnType<typeof Database>
    try {
      db = new Database(CAST_DB, { fileMustExist: true })
    } catch {
      return res.status(503).json({ error: 'cast.db missing or uninitialized — run the CAST installer (cast-db-init.sh / cast status) first' })
    }

    // Verify required tables exist; absent tables mean the DB is uninitialized
    const tables = db.prepare(
      `SELECT name FROM sqlite_master WHERE type='table' AND name IN ('sessions', 'agent_runs')`
    ).all() as { name: string }[]
    const tableNames = new Set(tables.map(t => t.name))
    if (!tableNames.has('sessions') || !tableNames.has('agent_runs')) {
      db.close()
      return res.status(503).json({ error: 'cast.db missing or uninitialized — run the CAST installer (cast-db-init.sh / cast status) first' })
    }

    const insertSession = db.prepare(`
      INSERT OR IGNORE INTO sessions
        (id, project, project_root, started_at, ended_at)
      VALUES
        (@id, @project, @project_root, @started_at, @ended_at)
    `)

    const checkRun = db.prepare(`
      SELECT id FROM agent_runs WHERE session_id = ? AND agent = ? AND started_at = ? LIMIT 1
    `)

    const insertRun = db.prepare(`
      INSERT INTO agent_runs
        (session_id, agent, model, started_at, ended_at, status, input_tokens, output_tokens, cost_usd)
      VALUES
        (@session_id, @agent, @model, @started_at, @ended_at, @status, @input_tokens, @output_tokens, @cost_usd)
    `)

    let sessionCount = 0
    let runCount = 0

    const sessions = listSessions()

    for (const session of sessions) {
      const sessionResult = insertSession.run({
        id: session.id,
        project: session.project,
        project_root: session.projectPath,
        started_at: session.startedAt,
        ended_at: session.endedAt,
      })

      if (sessionResult.changes > 0) {
        sessionCount++
      }

      const entries = loadSession(session.projectEncoded, session.id)

      // Load per-agent token data from subagents/ directory for this session
      const subagentTokenMap = loadSubagentTokenData(session.projectEncoded, session.id)

      // Tool results appear in 'user' entries as content blocks with type 'tool_result'
      const toolResultsByUseId: Record<string, { timestamp: string; content: unknown }> = {}
      for (const entry of entries) {
        if (entry.type !== 'user') continue
        const entryContent = entry.message?.content
        if (!Array.isArray(entryContent)) continue
        for (const rawBlock of entryContent) {
          const block = rawBlock as unknown as Record<string, unknown>
          if (block.type === 'tool_result' && block.tool_use_id) {
            const useId = block.tool_use_id as string
            toolResultsByUseId[useId] = {
              timestamp: entry.timestamp,
              content: block.content,
            }
          }
        }
      }

      for (const entry of entries) {
        if (entry.type !== 'assistant') continue
        const content = entry.message?.content
        if (!Array.isArray(content)) continue

        for (const block of content) {
          if (block.type !== 'tool_use' || block.name !== 'Agent') continue

          const input = block.input as Record<string, unknown> | undefined
          if (!input) continue

          const agentName = (input.subagent_type as string) ?? 'unknown'
          const agentModel = (input.model as string) ?? 'sonnet'

          const startedAt = entry.timestamp ?? session.startedAt

          const existing = checkRun.get(session.id, agentName, startedAt)
          if (existing) continue

          const result = block.id ? toolResultsByUseId[block.id] : undefined
          const endedAt = result?.timestamp ?? null

          let status = 'DONE'
          if (result?.content) {
            const contentStr = typeof result.content === 'string'
              ? result.content.toLowerCase()
              : JSON.stringify(result.content).toLowerCase()
            if (contentStr.includes('error') || contentStr.includes('failed')) {
              status = 'BLOCKED'
            }
          }

          // Match this agent run to a subagent JSONL entry for real token data
          const subagentData = claimSubagentEntry(subagentTokenMap, agentName)
          const inputTokens = subagentData?.inputTokens ?? 0
          const outputTokens = subagentData?.outputTokens ?? 0
          const costUsd = estimateCost(inputTokens, outputTokens, 0, 0, agentModel)

          insertRun.run({
            session_id: session.id,
            agent: agentName,
            model: agentModel,
            started_at: startedAt,
            ended_at: endedAt,
            status,
            input_tokens: inputTokens,
            output_tokens: outputTokens,
            cost_usd: costUsd,
          })

          runCount++
        }
      }
    }

    // ---------------------------------------------------------------------------
    // Backfill pass: update existing agent_run rows that have input_tokens = 0
    // or NULL, where subagent JSONL data is now available.
    // ---------------------------------------------------------------------------
    const zeroTokenRuns = db.prepare(`
      SELECT ar.id, ar.agent, ar.session_id, ar.model,
             s.project_root, s.project
      FROM agent_runs ar
      JOIN sessions s ON ar.session_id = s.id
      WHERE (ar.input_tokens IS NULL OR ar.input_tokens = 0)
        AND ar.agent IS NOT NULL
    `).all() as Array<{
      id: number
      agent: string
      session_id: string
      model: string | null
      project_root: string | null
      project: string | null
    }>

    const updateRun = db.prepare(`
      UPDATE agent_runs
         SET input_tokens = @input_tokens,
             output_tokens = @output_tokens,
             cost_usd = @cost_usd
       WHERE id = @id
    `)

    let backfillCount = 0

    // Build a map of projectEncoded by session_id for efficient lookup
    const sessionEncoded = new Map<string, string>()
    for (const session of sessions) {
      sessionEncoded.set(session.id, session.projectEncoded)
    }

    // Group zero-token runs by session so we can share one token map per session
    const runsBySession = new Map<string, typeof zeroTokenRuns>()
    for (const run of zeroTokenRuns) {
      const arr = runsBySession.get(run.session_id) ?? []
      arr.push(run)
      runsBySession.set(run.session_id, arr)
    }

    for (const [sessionId, runs] of runsBySession) {
      const projEncoded = sessionEncoded.get(sessionId)
      if (!projEncoded) continue

      const tokenMap = loadSubagentTokenData(projEncoded, sessionId)
      if (tokenMap.size === 0) continue

      for (const run of runs) {
        const entry = claimSubagentEntry(tokenMap, run.agent)
        if (!entry) continue

        const inputTokens = entry.inputTokens
        const outputTokens = entry.outputTokens
        const costUsd = estimateCost(inputTokens, outputTokens, 0, 0, run.model ?? undefined)

        updateRun.run({ id: run.id, input_tokens: inputTokens, output_tokens: outputTokens, cost_usd: costUsd })
        backfillCount++
      }
    }

    db.close()

    res.json({ seeded: { sessions: sessionCount, agentRuns: runCount, backfilled: backfillCount } })
  } catch (err) {
    console.error('Seed error:', err)
    res.status(500).json({ error: 'Seed failed' })
  }
})
