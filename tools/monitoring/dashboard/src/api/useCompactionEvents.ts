import { useQuery } from '@tanstack/react-query'

export interface CompactionEvent {
  id: string
  session_id: string
  timestamp: string
  trigger: string
  compaction_tier: string | null
  transcript_path: string | null
}

export function useCompactionEvents(params?: { limit?: number }) {
  return useQuery<{ events: CompactionEvent[] }>({
    queryKey: ['compaction-events', params],
    queryFn: async () => {
      const url = new URL('/api/cast/compaction-events', window.location.origin)
      if (params?.limit != null) url.searchParams.set('limit', String(params.limit))
      const res = await fetch(url.toString())
      if (!res.ok) throw new Error(`API error ${res.status}: /api/cast/compaction-events`)
      return res.json()
    },
    staleTime: 15_000,
    refetchInterval: 30_000,
  })
}
