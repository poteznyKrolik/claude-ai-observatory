import { useQuery } from '@tanstack/react-query'
import type { DispatchEvent } from '../types'

// Shape returned by GET /api/routing/stats (aggregates over agent_runs).
export interface DispatchStats {
  total: number
  /** Run count keyed by status (DONE, BLOCKED, running, …). */
  byStatus: Record<string, number>
  topAgent: string | null
  last24hCount: number
}

export function useDispatchEvents(limit = 500) {
  return useQuery<DispatchEvent[]>({
    queryKey: ['routing', 'events', limit],
    queryFn: async () => {
      const res = await fetch(`/api/routing/events?limit=${limit}`)
      if (!res.ok) throw new Error('Failed to fetch dispatch events')
      return res.json()
    },
    refetchInterval: 60_000,
    staleTime: 15_000,
  })
}

export function useRoutingStats() {
  return useQuery<DispatchStats>({
    queryKey: ['routing', 'stats'],
    queryFn: async () => {
      const res = await fetch('/api/routing/stats')
      if (!res.ok) throw new Error('Failed to fetch routing stats')
      return res.json()
    },
    refetchInterval: 60_000,
    staleTime: 15_000,
  })
}
