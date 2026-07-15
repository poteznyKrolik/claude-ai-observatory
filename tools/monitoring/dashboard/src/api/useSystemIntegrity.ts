import { useQuery } from '@tanstack/react-query'

export interface SystemIntegrity {
  litestream: { active: boolean; seq: number | null }
  snapshots: { dir: string; lastBackupAt: string | null; count: number }
}

export function useSystemIntegrity() {
  return useQuery<SystemIntegrity>({
    queryKey: ['system-integrity'],
    queryFn: async () => {
      const res = await fetch('/api/system/integrity')
      if (!res.ok) throw new Error(`API error ${res.status}: /api/system/integrity`)
      return res.json()
    },
    staleTime: 60_000,
    refetchInterval: 120_000,
  })
}
