import { useQuery } from '@tanstack/react-query'

export interface CostTotals {
  inputTokens: number
  outputTokens: number
  cacheCreationTokens: number
  cacheReadTokens: number
  costUsd: number
  sessionCount: number
}

export interface CostModelEntry {
  model: string
  costUsd: number
  sessionCount: number
  inputTokens: number
  outputTokens: number
}

export interface CostTopSession {
  id: string
  project: string
  startedAt: string
  model: string
  costUsd: number
}

export interface CostSummaryResponse {
  totals: CostTotals
  byModel: CostModelEntry[]
  topSessions: CostTopSession[]
  windowDays: number
}

export function useCostSummary(days = 30, top = 10) {
  return useQuery<CostSummaryResponse>({
    queryKey: ['cost-summary', days, top],
    queryFn: async () => {
      const url = new URL('/api/cast/cost-summary', window.location.origin)
      url.searchParams.set('days', String(days))
      url.searchParams.set('top', String(top))
      const res = await fetch(url.toString())
      if (!res.ok) throw new Error(`API error ${res.status}: /api/cast/cost-summary`)
      return res.json()
    },
    staleTime: 60_000,
    refetchInterval: 120_000,
  })
}
