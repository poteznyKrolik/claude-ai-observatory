// FALLBACK ONLY — primary source is GET /api/agents/roster which reads ~/.claude/agents/*.md.
// Update this file only if the roster API is unavailable. See useAgentRoster.ts.
// v7.4 roster — 23 agents (authoritative source: claude-agent-team/agents/core/)
export const LOCAL_AGENTS: string[] = [
  'api-contract',
  'bash-specialist',
  'code-reviewer',
  'code-writer',
  'commit',
  'debugger',
  'dep-auditor',
  'devops',
  'docs',
  'eval-writer',
  'frontend-qa',
  'merge',
  'migration-reviewer',
  'morning-briefing',
  'perf-sentinel',
  'planner',
  'pr-reviewer',
  'push',
  'release-notes',
  'researcher',
  'security',
  'test-runner',
  'test-writer',
]
