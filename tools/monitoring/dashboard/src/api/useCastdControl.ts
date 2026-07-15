import { useQuery } from '@tanstack/react-query'

export interface CastdStatus {
  running: boolean
  entries: string[]
  count: number
  error?: string
}

async function fetchCastdStatus(): Promise<CastdStatus> {
  const res = await fetch('/api/castd/status')
  if (!res.ok) throw new Error('Failed to fetch cron status')
  const data = await res.json()
  // Server returns { entries, count, error? } — derive 'running' from count > 0
  return {
    running: (data.count ?? 0) > 0,
    entries: data.entries ?? [],
    count: data.count ?? 0,
    error: data.error,
  }
}

export const useCastdStatus = () =>
  useQuery({
    queryKey: ['castd', 'status'],
    queryFn: fetchCastdStatus,
    refetchInterval: 10_000,
    refetchIntervalInBackground: false,
  })
