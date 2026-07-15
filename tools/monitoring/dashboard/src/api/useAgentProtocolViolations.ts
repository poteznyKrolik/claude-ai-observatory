import { useQuery } from '@tanstack/react-query'

export interface AgentProtocolViolation {
  id: number
  session_id: string | null
  agent_type: string | null
  agent_id: string | null
  batch_id: string | null
  violation: string | null
  pattern: string | null
  timestamp: string
  raw_excerpt: string | null
}

export function useAgentProtocolViolations() {
  return useQuery<{ data: AgentProtocolViolation[] }>({
    queryKey: ['agent-protocol-violations'],
    queryFn: async () => {
      const res = await fetch('/api/agent-protocol-violations')
      if (!res.ok) throw new Error(`API error ${res.status}: /api/agent-protocol-violations`)
      return res.json()
    },
    staleTime: 15_000,
    refetchInterval: 30_000,
  })
}
