/**
 * seed-cast-db.ts
 *
 * Reads all JSONL sessions from ~/.claude/projects/ and populates cast.db
 * with sessions and agent_runs rows using the canonical v9 schema.
 *
 * Schema ownership: cast-db-init.sh (the CAST flagship installer).
 * This script is read-write but NEVER creates or alters tables.
 * Canonical columns:
 *   sessions:   id, project, project_root, started_at, ended_at
 *   agent_runs: id, session_id, agent, model, started_at, ended_at, status,
 *               input_tokens, output_tokens, cost_usd
 *
 * Fails closed if cast.db does not exist or is uninitialized.
 *
 * Run with: npm run seed
 */

import Database from 'better-sqlite3'
import path from 'path'
import os from 'os'
import { listSessions, loadSession } from '../server/parsers/sessions.js'

const CAST_DB = path.join(os.homedir(), '.claude', 'cast.db')

function seed(): { sessions: number; agentRuns: number } {
  // Schema is owned by the flagship's cast-db-init.sh — never created or altered here.
  let db: ReturnType<typeof Database>
  try {
    db = new Database(CAST_DB, { fileMustExist: true })
  } catch {
    console.error(`cast.db not found at ${CAST_DB}. Run the CAST installer (cast-db-init.sh / cast status) first.`)
    process.exit(1)
  }

  // Verify required tables exist; absent tables mean the DB is uninitialized
  const tables = db.prepare(
    `SELECT name FROM sqlite_master WHERE type='table' AND name IN ('sessions', 'agent_runs')`
  ).all() as { name: string }[]
  const tableNames = new Set(tables.map((t: { name: string }) => t.name))
  if (!tableNames.has('sessions') || !tableNames.has('agent_runs')) {
    console.error('cast.db is missing required tables. Run cast-db-init.sh / cast status first.')
    db.close()
    process.exit(1)
  }

  const insertSession = db.prepare(`
    INSERT OR IGNORE INTO sessions
      (id, project, project_root, started_at, ended_at)
    VALUES
      (@id, @project, @project_root, @started_at, @ended_at)
  `)

  // Check for duplicate by session_id + agent + started_at to avoid re-inserting on reseed
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

    // Load full session entries to find agent dispatches
    const entries = loadSession(session.projectEncoded, session.id)

    // Build a map from tool_use_id -> result info for quick lookup.
    // Tool results appear in 'user' entries as content blocks with type 'tool_result'.
    const toolResultsByUseId: Record<string, { timestamp: string; content: unknown }> = {}
    for (const entry of entries) {
      if (entry.type !== 'user') continue
      const content = entry.message?.content
      if (!Array.isArray(content)) continue
      for (const rawBlock of content) {
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

        // Skip if we already have this run (idempotent reseed)
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

        insertRun.run({
          session_id: session.id,
          agent: agentName,
          model: agentModel,
          started_at: startedAt,
          ended_at: endedAt,
          status,
          input_tokens: 0,
          output_tokens: 0,
          cost_usd: 0,
        })

        runCount++
      }
    }
  }

  db.close()
  return { sessions: sessionCount, agentRuns: runCount }
}

const result = seed()
console.log(`Seeded ${result.sessions} sessions, ${result.agentRuns} agent_runs`)
