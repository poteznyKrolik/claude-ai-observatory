import { useQuery } from '@tanstack/react-query'

export interface UnstagedWarning {
  id: number
  timestamp: string
  session_id: string | null
  commit_sha: string | null
  unstaged_files: string | null
  in_scope_files: string | null
}

export function useUnstagedWarnings() {
  return useQuery<{ warnings: UnstagedWarning[] }>({
    queryKey: ['unstaged-warnings'],
    queryFn: async () => {
      const res = await fetch('/api/unstaged-warnings')
      if (!res.ok) throw new Error(`API error ${res.status}: /api/unstaged-warnings`)
      return res.json()
    },
    staleTime: 30_000,
    refetchInterval: 60_000,
  })
}
