import { useQuery } from '@tanstack/react-query'

export interface CompletenessEvent {
  id: number
  agent: string
  truncated_at: string
  snippet: string | null
  severity: string
  created_at: string
}

export function useCompletenessEvents(params?: { limit?: number; offset?: number }) {
  return useQuery<{ entries: CompletenessEvent[]; total: number }>({
    queryKey: ['completeness-events', params],
    queryFn: async () => {
      const url = new URL('/api/completeness-events', window.location.origin)
      if (params?.limit != null) url.searchParams.set('limit', String(params.limit))
      if (params?.offset != null) url.searchParams.set('offset', String(params.offset))
      const res = await fetch(url.toString())
      if (!res.ok) throw new Error(`API error ${res.status}: /api/completeness-events`)
      return res.json()
    },
    staleTime: 15_000,
    refetchInterval: 30_000,
  })
}

export function useCompletenessEventsStats() {
  return useQuery<{ bySeverity: Record<string, number> }>({
    queryKey: ['completeness-events', 'stats'],
    queryFn: async () => {
      const res = await fetch('/api/completeness-events/stats')
      if (!res.ok) throw new Error(`API error ${res.status}: /api/completeness-events/stats`)
      return res.json()
    },
    staleTime: 30_000,
    refetchInterval: 60_000,
  })
}
