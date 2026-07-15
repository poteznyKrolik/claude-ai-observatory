import { useQuery } from '@tanstack/react-query'

export interface RateLimitSnapshot {
  ts: number
  tpm_limit: number | null
  tpm_used: number | null
  rpm_limit: number | null
  rpm_used: number | null
}

export function useRateLimits() {
  return useQuery<{ latest: RateLimitSnapshot | null; snapshots: RateLimitSnapshot[] }>({
    queryKey: ['rate-limits'],
    queryFn: async () => {
      const res = await fetch('/api/rate-limits')
      if (!res.ok) throw new Error(`API error ${res.status}: /api/rate-limits`)
      return res.json()
    },
    staleTime: 30_000,
    refetchInterval: 60_000,
  })
}
