export const AGENT_CATEGORIES = {
  Sonnet: ['code-writer', 'debugger', 'planner', 'security', 'merge', 'researcher', 'docs', 'bash-specialist', 'orchestrator', 'morning-briefing', 'devops'],
  Haiku:  ['code-reviewer', 'commit', 'push', 'test-runner', 'test-writer'],
} as const

export type AgentCategory = keyof typeof AGENT_CATEGORIES

export const CATEGORY_COLORS: Record<AgentCategory, { border: string; text: string; bg: string }> = {
  Sonnet: { border: 'border-blue-500/20', text: 'text-blue-400', bg: 'bg-blue-500/10' },
  Haiku:  { border: 'border-cyan-500/20', text: 'text-cyan-400', bg: 'bg-cyan-500/10' },
}

export const CATEGORY_DESCRIPTIONS: Record<AgentCategory, string> = {
  Sonnet: 'Specialist agents powered by Claude Sonnet — feature work, planning, debugging, research, and orchestration',
  Haiku:  'Lightweight agents powered by Claude Haiku — review, commit, push, and test running',
}

export function getAgentCategory(agentName: string): AgentCategory | null {
  for (const [category, agents] of Object.entries(AGENT_CATEGORIES)) {
    if ((agents as readonly string[]).includes(agentName)) {
      return category as AgentCategory
    }
  }
  return null
}
