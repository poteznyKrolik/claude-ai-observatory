import { useQuery } from '@tanstack/react-query'

export interface ParryGuardEvent {
  id: number
  tool_name: string
  input_snippet: string | null
  rejected_at: string
}

export function useParryGuard() {
  return useQuery<{ events: ParryGuardEvent[] }>({
    queryKey: ['parry-guard'],
    queryFn: async () => {
      const res = await fetch('/api/parry-guard')
      if (!res.ok) throw new Error(`API error ${res.status}: /api/parry-guard`)
      return res.json()
    },
    staleTime: 15_000,
    refetchInterval: 30_000,
  })
}
