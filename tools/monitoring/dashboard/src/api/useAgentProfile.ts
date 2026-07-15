import { useQuery } from '@tanstack/react-query'

export interface AgentRunRow {
  started_at: string
  ended_at: string | null
  duration_ms: number | null
  status: string
  input_tokens: number | null
  output_tokens: number | null
  cost_usd: number | null
  task_summary: string | null
  model: string | null
  is_truncated: number
}

export interface AgentProfileDetail {
  name: string
  runs: number
  success_rate: number
  blocked_count: number
  avg_cost_usd: number
  last_runs: AgentRunRow[]
}

async function fetchAgentProfile(agent: string): Promise<AgentProfileDetail> {
  const res = await fetch(`/api/analytics/profile/${encodeURIComponent(agent)}`)
  if (!res.ok) throw new Error(`Failed to fetch profile for agent: ${agent}`)
  return res.json()
}

export const useAgentProfile = (agent: string) =>
  useQuery({
    queryKey: ['analytics', 'profile', agent],
    queryFn: () => fetchAgentProfile(agent),
    staleTime: 60_000,
    enabled: !!agent,
  })

export interface AgentScorecardRow {
  name: string
  runs: number
  success_rate: number
  blocked_count: number
  avg_cost_usd: number
}

async function fetchAgentScorecard(): Promise<{ agents: AgentScorecardRow[] }> {
  const res = await fetch('/api/analytics/profile')
  if (!res.ok) throw new Error('Failed to fetch agent scorecard')
  return res.json()
}

export const useAgentScorecard = () =>
  useQuery({
    queryKey: ['analytics', 'scorecard'],
    queryFn: fetchAgentScorecard,
    staleTime: 60_000,
    refetchInterval: 120_000,
  })
