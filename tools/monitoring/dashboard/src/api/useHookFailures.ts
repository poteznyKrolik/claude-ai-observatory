import { useQuery } from '@tanstack/react-query'

export interface HookFailureRow {
  id: string
  hook_name: string
  exit_code: number
  stderr: string | null
  session_id: string | null
  timestamp: string
}

export function useHookFailures(since?: string) {
  return useQuery<{ failures: HookFailureRow[] }>({
    queryKey: ['hook-failures', since],
    queryFn: async () => {
      const url = since
        ? `/api/hook-failures?since=${encodeURIComponent(since)}`
        : '/api/hook-failures'
      const res = await fetch(url)
      if (!res.ok) throw new Error(`API error ${res.status}`)
      return res.json()
    },
    staleTime: 15_000,
    refetchInterval: 30_000,
  })
}

export function useHookFailuresCount() {
  return useQuery<{ count: number }>({
    queryKey: ['hook-failures', 'count'],
    queryFn: async () => {
      const res = await fetch('/api/hook-failures/count')
      if (!res.ok) throw new Error(`API error ${res.status}`)
      return res.json()
    },
    staleTime: 60_000,
    refetchInterval: 60_000,
  })
}
