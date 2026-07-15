import { useQuery } from '@tanstack/react-query'

export interface MemoryConsolidationRun {
  id: number
  run_id: string
  project_id: string | null
  status: string | null
  memory_files_read: number | null
  transcripts_scanned: number | null
  candidates_written: number | null
  started_at: string | null
  completed_at: string | null
  error: string | null
}

export function useMemoryConsolidation() {
  return useQuery<{ runs: MemoryConsolidationRun[]; archivedCount: number }>({
    queryKey: ['memory-consolidation'],
    queryFn: async () => {
      const res = await fetch('/api/memory-consolidation')
      if (!res.ok) throw new Error(`API error ${res.status}: /api/memory-consolidation`)
      return res.json()
    },
    staleTime: 30_000,
  })
}
