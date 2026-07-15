import { useQuery } from '@tanstack/react-query'

export interface InjectionLogEntry {
  id: number
  session_id: string | null
  prompt_hash: string
  fact_id: number
  score: number | null
  injected_at: string
}

export function useInjectionLog() {
  return useQuery<{ entries: InjectionLogEntry[] }>({
    queryKey: ['injection-log'],
    queryFn: async () => {
      const res = await fetch('/api/injection-log')
      if (!res.ok) throw new Error(`API error ${res.status}: /api/injection-log`)
      return res.json()
    },
    staleTime: 15_000,
    refetchInterval: 30_000,
  })
}
