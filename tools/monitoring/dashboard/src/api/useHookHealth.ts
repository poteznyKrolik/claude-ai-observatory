import { useQuery } from '@tanstack/react-query'

export interface HookHealthEntry {
  hook_type: string
  command: string
  script_path: string | null
  exists: boolean
  executable: boolean
  last_fired_at: string | null
  health: 'green' | 'yellow' | 'red'
}

export interface HookHealthData {
  hooks: HookHealthEntry[]
}

async function fetchHookHealth(): Promise<HookHealthData> {
  const res = await fetch('/api/hooks/health')
  if (!res.ok) throw new Error('Failed to fetch hook health')
  return res.json()
}

export const useHookHealth = () =>
  useQuery({
    queryKey: ['hooks', 'health'],
    queryFn: fetchHookHealth,
    staleTime: 30_000,
  })
