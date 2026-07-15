import { useQuery } from '@tanstack/react-query'
import { LOCAL_AGENTS } from '../utils/localAgents'

export interface AgentRosterResult {
  agents: string[]
  count: number
  source: 'filesystem' | 'fallback'
}

export function useAgentRoster() {
  return useQuery<AgentRosterResult>({
    queryKey: ['agent-roster'],
    queryFn: async () => {
      const res = await fetch('/api/agents/roster')
      if (!res.ok) return { agents: LOCAL_AGENTS, count: LOCAL_AGENTS.length, source: 'fallback' as const }
      return res.json()
    },
    staleTime: 5 * 60 * 1000,
  })
}
