import { useQuery } from '@tanstack/react-query'

export type SummaryRange = 'today' | 'week'

export interface RunsByStatus {
  DONE: number
  DONE_WITH_CONCERNS: number
  BLOCKED: number
  NEEDS_CONTEXT: number
  RUNNING: number
  OTHER: number
}

export interface TopAgent {
  agent: string
  count: number
  costUsd: number
}

export interface BlockerEntry {
  id: string | number
  agent: string
  status: string
  started_at: string
  work_log_snippet: string
}

export interface SummaryHighlights {
  plansActive: number
  hookFailures24h: number
  qualityGatePassRate: number | null
}

export interface ExecutiveSummaryData {
  range: SummaryRange
  generatedAt: string
  runs: {
    total: number
    byStatus: RunsByStatus
  }
  cost: {
    todayUsd: number
    weekUsd: number
    vsPrior7dPct: number | null
  }
  topAgents: TopAgent[]
  blockers: BlockerEntry[]
  highlights: SummaryHighlights
}

async function fetchExecutiveSummary(range: SummaryRange): Promise<ExecutiveSummaryData> {
  const url = `/api/executive-summary?range=${range}`
  const res = await fetch(url)
  if (!res.ok) throw new Error('Failed to fetch executive summary')
  return res.json()
}

export function useExecutiveSummary(range: SummaryRange = 'today') {
  return useQuery({
    queryKey: ['executive-summary', range],
    queryFn: () => fetchExecutiveSummary(range),
    refetchInterval: 60_000,
    refetchIntervalInBackground: false,
  })
}
