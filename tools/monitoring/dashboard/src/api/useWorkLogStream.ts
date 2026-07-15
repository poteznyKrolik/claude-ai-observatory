import { useQuery } from '@tanstack/react-query'

// Re-declared locally — do NOT import from server/ (frontend/backend are separate)
export interface ParsedWorkLog {
  items: string[]
  filesRead: string[]
  filesChanged: string[]
  codeReviewerResult?: string
  testWriterResult?: string
  decisions: string[]
}

export interface WorkLogEntry {
  agentRunId: string
  agentName: string
  model: string | null
  sessionId: string | null
  startedAt: string
  status: string | null
  workLog: ParsedWorkLog | null
  partialWorkLog: string | null
  isTruncated: boolean
  parryGuardFired: boolean
  qualityGateVerdict: string | null
  dispatchedBy: string | null
  dispatchedTo: string[] | null
}

export interface WorkLogStreamData {
  entries: WorkLogEntry[]
}

export interface WorkLogStreamParams {
  limit?: number
  since?: string
}

async function fetchWorkLogStream(params: WorkLogStreamParams): Promise<WorkLogStreamData> {
  const searchParams = new URLSearchParams()
  if (params.limit) searchParams.set('limit', String(params.limit))
  if (params.since) searchParams.set('since', params.since)
  const url = `/api/work-log-stream${searchParams.toString() ? `?${searchParams}` : ''}`
  const res = await fetch(url)
  if (!res.ok) throw new Error('Failed to fetch work log stream')
  return res.json()
}

export const useWorkLogStream = (params: WorkLogStreamParams = {}) =>
  useQuery({
    queryKey: ['cast', 'work-log-stream', params],
    queryFn: () => fetchWorkLogStream(params),
    staleTime: 10_000,
    refetchInterval: 30_000,
    refetchIntervalInBackground: false,
  })
