import { useQuery } from '@tanstack/react-query'

export interface IncidentRow {
  id: string
  occurred_at: string
  problem_summary: string
  fix_summary: string | null
  related_files: string | null
  related_commit: string | null
  resolution_status: string | null
  surfaced_by: string | null
}

export function useIncidents() {
  return useQuery<{ incidents: IncidentRow[] }>({
    queryKey: ['incidents'],
    queryFn: async () => {
      const res = await fetch('/api/incidents')
      if (!res.ok) throw new Error(`API error ${res.status}`)
      return res.json()
    },
    staleTime: 120_000,
  })
}
