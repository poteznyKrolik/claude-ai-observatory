import { useQuery } from '@tanstack/react-query'
import type { SystemOverview } from '../types'

async function fetchHealth(): Promise<SystemOverview> {
  const res = await fetch('/api/health')
  if (!res.ok) throw new Error('Failed to fetch system health')
  return res.json()
}

async function fetchConfig(): Promise<Record<string, unknown>> {
  const res = await fetch('/api/config')
  if (!res.ok) throw new Error('Failed to fetch config')
  return res.json()
}

export const useSystemHealth = () =>
  useQuery({ queryKey: ['health'], queryFn: fetchHealth })

export const useConfig = () =>
  useQuery({ queryKey: ['config'], queryFn: fetchConfig })
