import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

export interface BudgetStatus {
  today_spend: number
  daily_limit: number | null
  pct_used: number | null
  over_budget: boolean
  alert_at_pct: number | null
}

async function fetchBudgetStatus(): Promise<BudgetStatus> {
  const res = await fetch('/api/budget/status')
  if (!res.ok) throw new Error('Failed to fetch budget status')
  return res.json()
}

export const useBudgetStatus = () =>
  useQuery({
    queryKey: ['budget', 'status'],
    queryFn: fetchBudgetStatus,
    staleTime: 60_000,
    refetchInterval: 60_000,
  })

interface SaveBudgetConfigArgs {
  daily_limit_usd: number
  alert_at_pct?: number
}

async function saveBudgetConfig(args: SaveBudgetConfigArgs): Promise<{ ok: boolean }> {
  const res = await fetch('/api/budget/config', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(args),
  })
  if (!res.ok) throw new Error('Failed to save budget config')
  return res.json()
}

export const useSaveBudgetConfig = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: saveBudgetConfig,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['budget', 'status'] })
    },
  })
}
