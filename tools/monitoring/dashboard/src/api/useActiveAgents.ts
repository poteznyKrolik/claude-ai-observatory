import { useQuery } from '@tanstack/react-query'
import type { AgentRun } from './useAgentRuns'

async function fetchActiveAgents(): Promise<AgentRun[]> {
  const res = await fetch('/api/cast/active-agents')
  if (!res.ok) throw new Error('Failed to fetch active agents')
  const data = await res.json()
  return data.runs as AgentRun[]
}

export const useActiveAgents = () =>
  useQuery({
    queryKey: ['cast', 'active-agents'],
    queryFn: fetchActiveAgents,
    refetchInterval: 5_000,
    staleTime: 3_000,
    refetchIntervalInBackground: false,
  })
