import { useQuery } from '@tanstack/react-query'

export interface TokenSpendDaily {
  date: string
  inputTokens: number
  outputTokens: number
  costUsd: number
}

export interface TokenSpendTotals {
  inputTokens: number
  outputTokens: number
  cacheCreationTokens: number
  cacheReadTokens: number
  costUsd: number
  sessionCount: number
}

export interface TokenSpendData {
  daily: TokenSpendDaily[]
  totals: TokenSpendTotals
}

async function fetchTokenSpend(): Promise<TokenSpendData> {
  const res = await fetch('/api/cast/token-spend')
  if (!res.ok) throw new Error('Failed to fetch token spend data')
  return res.json()
}

export const useTokenSpend = () =>
  useQuery({
    queryKey: ['cast', 'token-spend'],
    queryFn: fetchTokenSpend,
    staleTime: 60_000,
  })
