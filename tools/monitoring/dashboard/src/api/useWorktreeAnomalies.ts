import { useQuery } from '@tanstack/react-query'

export interface WorktreeAnomaly {
  id: number
  agent_id: string | null
  worktree_path: string | null
  detected_at: string
  repo_root: string | null
  state: string | null
  reason: string | null
}

export function useWorktreeAnomalies() {
  return useQuery<{ anomalies: WorktreeAnomaly[]; total: number }>({
    queryKey: ['worktree-anomalies'],
    queryFn: async () => {
      const res = await fetch('/api/worktree-anomalies')
      if (!res.ok) throw new Error(`API error ${res.status}: /api/worktree-anomalies`)
      return res.json()
    },
    staleTime: 30_000,
    refetchInterval: 60_000,
  })
}
