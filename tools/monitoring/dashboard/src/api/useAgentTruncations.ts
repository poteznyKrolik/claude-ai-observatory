import { useQuery } from '@tanstack/react-query'

export interface AgentTruncation {
  id: number
  session_id: string | null
  agent_type: string
  agent_id: string | null
  last_line: string | null
  timestamp: string
  char_count: number | null
  has_status: number | null
  has_json: number | null
}

export function useAgentTruncations() {
  return useQuery<{ truncations: AgentTruncation[] }>({
    queryKey: ['agent-truncations'],
    queryFn: async () => {
      const res = await fetch('/api/agent-truncations')
      if (!res.ok) throw new Error(`API error ${res.status}: /api/agent-truncations`)
      return res.json()
    },
    staleTime: 15_000,
    refetchInterval: 30_000,
  })
}
