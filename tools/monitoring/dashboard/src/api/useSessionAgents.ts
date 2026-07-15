import { useQuery } from '@tanstack/react-query'
import type { SessionAgentRun } from '../types'

// Fetch all agent runs for a given session
async function fetchSessionAgents(sessionId: string): Promise<{ runs: SessionAgentRun[] }> {
  const res = await fetch(`/api/cast/session-agents/${encodeURIComponent(sessionId)}`)
  if (!res.ok) throw new Error('Failed to fetch session agents')
  return res.json()
}

export function useSessionAgents(sessionId: string | undefined) {
  return useQuery({
    queryKey: ['cast', 'session-agents', sessionId],
    queryFn: () => fetchSessionAgents(sessionId!),
    enabled: !!sessionId,
    refetchInterval: 15_000,
    refetchIntervalInBackground: false,
  })
}

// Fetch worktree info
async function fetchWorktrees(): Promise<{ worktrees: Array<{ path: string; branch: string | null; head: string }> }> {
  const res = await fetch('/api/cast/worktrees')
  if (!res.ok) throw new Error('Failed to fetch worktrees')
  return res.json()
}

export function useWorktrees() {
  return useQuery({
    queryKey: ['cast', 'worktrees'],
    queryFn: fetchWorktrees,
    refetchInterval: 30_000,
    refetchIntervalInBackground: false,
  })
}
