import Database from 'better-sqlite3'

/**
 * Schema drift guard.
 *
 * The dashboard read-visualizes `cast.db`, whose schema is owned by CAST
 * (claude-agent-team `scripts/cast-db-init.sh`). When CAST renames/drops a
 * column or table, the dashboard's hand-written SQL silently returns empty or
 * wrong data — every route wraps its query in try/catch, so drift never
 * surfaces as an error. This map is the canonical contract of every (table,
 * column) the dashboard routes depend on; `verifySchema` compares it to the
 * live DB so drift is caught loudly (a startup warning + a gating test) instead
 * of as a confidently-wrong number on a card.
 *
 * Keep this in sync when a route starts reading a new column. Columns listed
 * here were verified against CAST v8 (`PRAGMA user_version = 8`).
 */
export const EXPECTED_SCHEMA: Record<string, string[]> = {
  agent_runs: [
    'id', 'session_id', 'agent', 'model', 'started_at', 'ended_at', 'status',
    'input_tokens', 'output_tokens', 'cost_usd', 'agent_id', 'response',
    'duration_ms', 'tool_uses',
  ],
  dispatch_decisions: [
    'id', 'session_id', 'chosen_agent', 'prompt_snippet', 'created_at',
  ],
  sessions: [
    'id', 'project', 'project_root', 'started_at', 'ended_at', 'status', 'deleted_at',
  ],
  dispatch_events: ['id', 'agent', 'task_name', 'triggered_at', 'status', 'report_path'],
  tool_call_failures: ['id', 'timestamp', 'session_id', 'tool_name', 'error', 'project', 'data'],
  quality_gates: ['id', 'session_id', 'agent_name', 'timestamp', 'status_line', 'contract_passed', 'created_at'],
  hook_failures: ['id', 'hook_name', 'exit_code', 'stderr', 'session_id', 'timestamp'],
  routing_events: ['id', 'session_id', 'timestamp', 'prompt_preview', 'action', 'matched_route', 'event_type', 'data'],
  agent_truncations: ['id', 'session_id', 'agent_type', 'agent_id', 'timestamp', 'has_status', 'has_json', 'last_line', 'char_count'],
  agent_protocol_violations: ['id', 'session_id', 'agent_type', 'agent_id', 'violation', 'pattern', 'timestamp', 'raw_excerpt'],
  worktree_anomalies: ['id', 'agent_id', 'worktree_path', 'detected_at', 'repo_root', 'state', 'reason'],
  eval_runs: ['id', 'eval_id', 'agent', 'attempt', 'status', 'grader_results', 'pass_at_k', 'k', 'duration_ms', 'started_at', 'model', 'cost_tier'],
  rate_limit_snapshots: ['ts', 'tpm_limit', 'tpm_used', 'rpm_limit', 'rpm_used'],
  memory_consolidation_runs: ['id', 'run_id', 'project_id', 'status', 'memory_files_read', 'transcripts_scanned', 'candidates_written', 'started_at', 'completed_at', 'error'],
  archived_memories: ['id', 'agent', 'archived_at'],
}

export interface SchemaDrift {
  table: string
  status: 'missing-table' | 'missing-columns'
  missing: string[]
}

/**
 * Compare the live DB against {@link EXPECTED_SCHEMA}. Read-only; never throws
 * for a missing table/column — only for a broken DB handle (caller guards).
 */
export function verifySchema(db: ReturnType<typeof Database>): SchemaDrift[] {
  const drift: SchemaDrift[] = []
  for (const [table, cols] of Object.entries(EXPECTED_SCHEMA)) {
    const exists = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?")
      .get(table)
    if (!exists) {
      drift.push({ table, status: 'missing-table', missing: cols })
      continue
    }
    const actual = new Set(
      (db.prepare(`PRAGMA table_info("${table}")`).all() as Array<{ name: string }>).map(r => r.name),
    )
    const missing = cols.filter(c => !actual.has(c))
    if (missing.length > 0) {
      drift.push({ table, status: 'missing-columns', missing })
    }
  }
  return drift
}

/**
 * Fail-soft startup check: log any schema drift as a warning and return it.
 * Never throws — a drift warning must not block the server from booting.
 */
export function logSchemaDrift(db: ReturnType<typeof Database> | null): SchemaDrift[] {
  if (!db) return []
  let drift: SchemaDrift[]
  try {
    drift = verifySchema(db)
  } catch (err) {
    console.warn('[schema-guard] verification failed (non-fatal):', err)
    return []
  }
  for (const d of drift) {
    if (d.status === 'missing-table') {
      console.warn(
        `[schema-guard] cast.db is missing table "${d.table}" — routes reading it will return empty. (CAST schema drift?)`,
      )
    } else {
      console.warn(
        `[schema-guard] cast.db table "${d.table}" is missing column(s): ${d.missing.join(', ')} — dependent routes may return wrong data.`,
      )
    }
  }
  if (drift.length === 0) {
    console.log('[schema-guard] cast.db schema matches dashboard expectations.')
  }
  return drift
}
