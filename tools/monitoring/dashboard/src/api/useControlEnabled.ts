import { useQuery } from '@tanstack/react-query'

export interface ControlStatus {
  enabled: boolean
  tokenConfigured: boolean
}

async function fetchControlStatus(): Promise<ControlStatus> {
  const res = await fetch('/api/config/control')
  if (!res.ok) throw new Error('Failed to fetch control status')
  const data = await res.json()
  return {
    enabled: Boolean(data.enabled),
    tokenConfigured: Boolean(data.tokenConfigured),
  }
}

/**
 * Reports whether the dashboard's write surface is enabled on the server.
 * Drives show/hide of every control affordance — the dashboard is read-only
 * unless the operator opted in via CAST_DASHBOARD_CONTROL=1.
 */
export const useControlStatus = () =>
  useQuery({
    queryKey: ['config', 'control'],
    queryFn: fetchControlStatus,
    staleTime: 60_000,
  })
