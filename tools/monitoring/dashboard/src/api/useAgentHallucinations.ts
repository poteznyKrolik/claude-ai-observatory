import { useQuery } from '@tanstack/react-query'

export interface HallucinationRow {
  id: number
  session_id: string | null
  agent_name: string
  claim_type: string
  claimed_value: string | null
  actual_value: string | null
  verified: number
  timestamp: string
}

export interface HallucinationStats {
  total: number
  by_agent: Array<{ agent_name: string; count: number }>
  by_type: Array<{ claim_type: string; count: number }>
}

export function useAgentHallucinations(agent?: string, since?: string) {
  const params = new URLSearchParams()
  if (agent) params.set('agent', agent)
  if (since) params.set('since', since)
  const qs = params.toString()
  return useQuery<{ entries: HallucinationRow[] }>({
    queryKey: ['agent-hallucinations', agent, since],
    queryFn: async () => {
      const res = await fetch(`/api/agent-hallucinations${qs ? '?' + qs : ''}`)
      if (!res.ok) throw new Error(`API error ${res.status}`)
      return res.json()
    },
    staleTime: 30_000,
  })
}

export function useAgentHallucinationStats() {
  return useQuery<HallucinationStats>({
    queryKey: ['agent-hallucinations', 'stats'],
    queryFn: async () => {
      const res = await fetch('/api/agent-hallucinations/stats')
      if (!res.ok) throw new Error(`API error ${res.status}`)
      return res.json()
    },
    staleTime: 60_000,
  })
}
