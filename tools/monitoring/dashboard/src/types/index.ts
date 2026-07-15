// Agent definition (parsed from ~/.claude/agents/*.md frontmatter)
export interface AgentDefinition {
  name: string
  description: string
  model: 'sonnet' | 'haiku' | 'opus' | string
  color: string
  tools: string[]
  maxTurns: number
  memory: 'local' | 'none' | string
  disallowedTools?: string[]
  filePath: string
}

// Session (derived from ~/.claude/projects/<project>/<uuid>.jsonl)
export interface Session {
  id: string
  project: string
  projectPath: string
  projectEncoded: string
  startedAt: string
  endedAt?: string
  durationMs?: number | null
  messageCount: number
  toolCallCount: number
  agentCount: number
  inputTokens: number
  outputTokens: number
  cacheCreationTokens: number
  cacheReadTokens: number
  model?: string
  estimatedCost?: number
  slug?: string
  version?: string
  deleted_at?: string | null
}

// Individual JSONL log entry
export interface LogEntry {
  parentUuid: string | null
  isSidechain?: boolean
  agentId?: string
  type: 'user' | 'assistant' | 'progress'
  message?: {
    role: 'user' | 'assistant'
    content: string | ContentBlock[]
    model?: string
    usage?: TokenUsage
  }
  uuid: string
  timestamp: string
  cwd?: string
  sessionId?: string
  gitBranch?: string
  slug?: string
  toolUseID?: string
  data?: ProgressData
}

export interface ContentBlock {
  type: 'text' | 'tool_use' | 'tool_result'
  text?: string
  name?: string
  input?: Record<string, unknown>
  id?: string
}

export interface TokenUsage {
  input_tokens: number
  output_tokens: number
  cache_creation_input_tokens?: number
  cache_read_input_tokens?: number
}

export interface ProgressData {
  type: string
  hookEvent?: string
  hookName?: string
  command?: string
}

// Subagent (from subagents/ directory)
export interface Subagent {
  id: string
  sessionId: string
  agentType?: string
  messageCount: number
  toolCallCount: number
}

// Memory file
export interface MemoryFile {
  agent: string
  path: string
  filename?: string
  name?: string
  description?: string
  type?: string
  body: string
  lastModified: string
}

// Plan file
export interface PlanFile {
  filename: string
  title: string
  date: string
  path: string
  preview: string
  modifiedAt: string
}

// System health/overview
export interface SystemOverview {
  agentCount: number
  commandCount: number
  skillCount: number
  ruleCount: number
  planCount: number
  projectMemoryCount: number
  agentMemoryCount: number
  sessionCount: number
  settingsCount?: number
  groupCount: number
  directiveCount: number
  hooks: HookEntry[]
  env: Record<string, string | boolean>
  model: string
  version?: string
}

export interface HookEntry {
  event: string
  matcher?: string
  description?: string
  type: string
  command?: string
  timeout?: number
}

// Parsed Work Log — extracted from assistant message "## Work Log" sections
export interface ParsedWorkLog {
  items: string[]
  filesRead: string[]
  filesChanged: string[]
  codeReviewerResult?: string
  testWriterResult?: string
  decisions: string[]
}

// Dashboard command types (control surface)
export type CommandType = 'dispatch' | 'kill' | 'batch_approve' | 'batch_reject'

export interface DashboardCommand {
  id: string
  type: CommandType
  payload: Record<string, unknown>
  queuedAt: string
  processedAt?: string
}

// SSE live event
export interface LiveEvent {
  type: 'session_updated' | 'agent_spawned' | 'file_changed' | 'heartbeat' | 'routing_event' | 'session_stale' | 'tool_use_event' | 'session_complete' | 'command_queued' | 'hook_event' | 'db_change_agent_run' | 'db_change_session' | 'db_change_routing_event' | 'stale_reconcile'
  event?: SseRoutingEvent
  path?: string
  sessionId?: string
  projectDir?: string
  projectName?: string
  timestamp: string
  lastEntry?: LogEntry
  agentType?: string
  agentDescription?: string
  isSubagent?: boolean     // true when the JSONL is at subagents/ path
  parentSessionId?: string // the orchestrator session that owns this sub-agent
  historical?: boolean  // true for events replayed from history on connect — feed only, no node activation
  workLog?: ParsedWorkLog  // present when assistant response contains a Work Log section
  agentName?: string       // extracted from .meta.json sidecar or Work Log
  agentStatus?: string     // terminal status extracted from response text (DONE|BLOCKED|DONE_WITH_CONCERNS|NEEDS_CONTEXT)
  // tool_use_event fields — populated when type === 'tool_use_event'
  toolName?: string
  inputPreview?: string
  subagentId?: string      // file UUID of the sub-agent JSONL (for tool attribution routing)
  parentAgentId?: string   // agentId of the parent agent that spawned this sub-agent
  // hook_event fields — emitted by POST /api/hook-events (HTTP hook, v2.1.63+)
  hookEventName?: string   // e.g. 'PostToolUse', 'PostCompact', 'TaskCreated'
  hookAgentName?: string   // subagent_type from tool_input
  hookTrigger?: string     // PostCompact trigger: 'auto' | 'manual'
  hookAgentId?: string     // agent_id from tool_input (v2.1.69+)
  // session_complete fields — emitted by idle timer when session goes quiet with a text-only response
  status?: string
  // command_queued fields — emitted when a dashboard control command is written to the queue
  commandType?: CommandType
  commandId?: string
  // stale_reconcile fields — emitted on SSE connect with DB state for completed agent_runs
  doneSessionIds?: string[]   // session_ids whose all agent_runs are completed in cast.db
  // db_change_* fields — emitted by castDbWatcher when new rows appear in cast.db tables
  dbChangeTable?: 'agent_runs' | 'sessions' | 'routing_events'
  dbChangeRowId?: number
  dbChangeAgentName?: string
  dbChangeStatus?: string
  dbChangeSessionId?: string
}

// Active session summary (for live view)
export interface ActiveSession {
  sessionId: string
  projectDir: string
  projectName: string
  lastActivity: string
  lastEntryType?: string
  lastEntryPreview?: string
  subagentCount: number
  messageCount: number
  toolCallCount: number
}

export interface DispatchEvent {
  id: number
  session_id?: string
  agent: string
  status: 'DONE' | 'DONE_WITH_CONCERNS' | 'BLOCKED' | 'NEEDS_CONTEXT' | 'running' | string
  started_at: string
  completed_at?: string
  duration_ms?: number
  prompt_preview?: string
  cost_usd?: number
}

// Shape emitted by the SSE watcher for routing_event broadcasts (CAST v3 agent dispatches)
export interface SseRoutingEvent {
  timestamp: string
  promptPreview: string
  action: string
  matchedRoute: string | null
  command: string | null
  pattern: string | null
  agentName?: string | null
  agentModel?: string | null
}

// Output file (briefings, meetings, reports)
export interface OutputFile {
  filename: string
  category: 'briefings' | 'meetings' | 'reports'
  path: string
  preview: string
  modifiedAt: string
}

export interface HookDefinition {
  event: string
  type: string
  matcher?: string
  command?: string
  timeout?: number
  description?: string
}

export interface ScriptFile {
  name: string
  path: string
  size: number
  modifiedAt: string
}

export interface PluginEntry {
  name: string
  provider: string
  enabled: boolean
}

export interface KeybindingContext {
  context: string
  bindings: Record<string, string>
}

export interface LaunchConfig {
  name: string
  runtimeExecutable: string
  runtimeArgs: string[]
  port: number
}

export interface TaskEntry {
  id: string
  hasConfig: boolean
  hasLock: boolean
  modifiedAt: string
}

export interface DebugLogFile {
  id: string
  path: string
  size: number
  modifiedAt: string
}

export interface FeedItem {
  id: string
  agentName: string
  description: string
  timestamp: number
  sessionId: string
  isTerminal?: boolean
}

// ─── Activity Page: Session Storyboard types ─────────────────────────────────

/** A single agent run from cast.db agent_runs, enriched with computed fields */
export interface SessionAgentRun {
  id: string
  session_id: string
  agent: string
  model: string
  status: string
  started_at: string
  ended_at: string | null
  duration_ms: number | null
  input_tokens: number
  output_tokens: number
  cost_usd: number
  task_summary: string | null
  agent_id?: string
  worktree_branch?: string | null
  project?: string | null
}

/** Worktree info from `git worktree list --porcelain` */
export interface WorktreeInfo {
  path: string
  branch: string | null
  head: string
  agentName?: string | null
}

/** A node in the orchestration flow DAG */
export interface OrchestrationNode {
  id: string
  agentName: string
  batchId: number
  status: 'queued' | 'running' | 'done' | 'blocked' | 'concerns'
  isParallel: boolean
  dependsOn: string[]
}

// ─── CAST Observability Types ────────────────────────────────────────────────

export interface QualityGate {
  id: string
  session_id: string
  agent: string
  status_line: string | null
  contract_passed: number // 0 or 1
  retry_count: number | null
  created_at: string
}

export interface QualityGateStats {
  total: number
  pass_rate: number
  by_agent: Record<string, { total: number; passed: number; rate: number }>
  by_status: Record<string, number>
}

export interface DispatchDecision {
  id: string
  session_id: string
  prompt_snippet: string | null
  chosen_agent: string | null
  model: string | null
  effort: string | null
  wave_id: string | null
  parallel: number
  created_at: string
}

export interface CompactionEvent {
  id: string
  session_id: string
  timestamp: string
  trigger: string
  compaction_tier: string | null
  transcript_path: string | null
}

export interface ToolFailure {
  timestamp?: string
  tool?: string
  error?: string
  context?: string
  [key: string]: unknown
}

export interface ToolFailureStats {
  total: number
  byTool: Record<string, number>
  last24h: number
}

export interface CastEvent {
  _filename: string
  _fileAgent: string | null
  _fileEventType: string | null
  event_id?: string
  timestamp?: string
  event_type?: string
  agent?: string
  session_id?: string
  source?: string
  [key: string]: unknown
}

export interface ResearchCacheStats {
  file_count: number
  total_size_bytes: number
  oldest: string | null
  newest: string | null
}

export interface DbMemory {
  id: string
  agent: string
  project: string | null
  type: string | null
  name: string
  description: string | null
  content: string
  importance: number | null
  decay_rate: number | null
  created_at: string
  updated_at: string
}

/** Tabs available in the AgentDetailPanel */
export type AgentDetailTab = 'overview' | 'tools' | 'worklog' | 'files'

/** A past session summary for the PastSessionsAccordion */
export interface PastSessionSummary {
  sessionId: string
  startedAt: string
  agentCount: number
  totalCost: number
  duration_ms: number | null
  agents: SessionAgentRun[]
}


