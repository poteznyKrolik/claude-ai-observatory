import { useQuery } from '@tanstack/react-query'

export interface EvalRun {
  id: string
  eval_id: string
  agent: string
  attempt: number
  agent_run_id: string | null
  status: string
  grader_results: string | null
  pass_at_k: number | null
  k: number | null
  duration_ms: number | null
  started_at: string
  ended_at: string | null
  model: string | null
  cost_tier: string | null
}

export function useEvalRuns() {
  return useQuery<{ runs: EvalRun[] }>({
    queryKey: ['eval-runs'],
    queryFn: async () => {
      const res = await fetch('/api/eval-runs')
      if (!res.ok) throw new Error(`API error ${res.status}: /api/eval-runs`)
      return res.json()
    },
    staleTime: 30_000,
    refetchInterval: 60_000,
  })
}
