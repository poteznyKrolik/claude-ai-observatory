import { useQuery } from '@tanstack/react-query'

export interface DispatchDecision {
  id: string
  session_id: string | null
  timestamp: string
  dispatch_backend: string | null
  plan_file: string | null
}

export function useDispatchDecisions() {
  return useQuery<{ decisions: DispatchDecision[] }>({
    queryKey: ['dispatch-decisions'],
    queryFn: async () => {
      const res = await fetch('/api/dispatch-decisions')
      if (!res.ok) throw new Error(`API error ${res.status}: /api/dispatch-decisions`)
      return res.json()
    },
    staleTime: 15_000,
    refetchInterval: 30_000,
  })
}
