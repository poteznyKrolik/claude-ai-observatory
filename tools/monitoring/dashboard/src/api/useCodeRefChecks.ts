import { useQuery } from '@tanstack/react-query'

export interface CodeRefCheck {
  id: number
  session_id: string
  agent_name: string
  ref_type: string
  ref_name: string
  verified: number
  location: string | null
  timestamp: string
}

export function useCodeRefChecks(params?: { limit?: number; offset?: number }) {
  return useQuery<{ entries: CodeRefCheck[]; total: number }>({
    queryKey: ['code-ref-checks', params],
    queryFn: async () => {
      const url = new URL('/api/code-ref-checks', window.location.origin)
      if (params?.limit != null) url.searchParams.set('limit', String(params.limit))
      if (params?.offset != null) url.searchParams.set('offset', String(params.offset))
      const res = await fetch(url.toString())
      if (!res.ok) throw new Error(`API error ${res.status}: /api/code-ref-checks`)
      return res.json()
    },
    staleTime: 15_000,
    refetchInterval: 30_000,
  })
}

export function useCodeRefChecksStats() {
  return useQuery<{ byResult: Record<string, number> }>({
    queryKey: ['code-ref-checks', 'stats'],
    queryFn: async () => {
      const res = await fetch('/api/code-ref-checks/stats')
      if (!res.ok) throw new Error(`API error ${res.status}: /api/code-ref-checks/stats`)
      return res.json()
    },
    staleTime: 30_000,
    refetchInterval: 60_000,
  })
}
