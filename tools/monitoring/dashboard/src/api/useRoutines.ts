import { useQuery } from '@tanstack/react-query'

export interface RoutineRow {
  id: string
  name: string
  trigger_type: string
  trigger_value: string | null
  agent_to_dispatch: string
  enabled: number
  last_run_at: string | null
  last_run_status: string | null
  last_run_output_path: string | null
  created_at: string
}

export function useRoutines() {
  return useQuery<{ routines: RoutineRow[] }>({
    queryKey: ['routines'],
    queryFn: async () => {
      const res = await fetch('/api/routines')
      if (!res.ok) throw new Error(`API error ${res.status}`)
      return res.json()
    },
    staleTime: 60_000,
    refetchInterval: 120_000,
  })
}
