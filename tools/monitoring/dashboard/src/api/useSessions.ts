import { useQuery } from '@tanstack/react-query'
import type { Session, LogEntry } from '../types'

async function fetchSessions(project?: string, limit?: number): Promise<Session[]> {
  const params = new URLSearchParams()
  if (project) params.set('project', project)
  if (limit) params.set('limit', String(limit))
  const qs = params.toString()
  const res = await fetch(`/api/sessions${qs ? `?${qs}` : ''}`)
  if (!res.ok) throw new Error('Failed to fetch sessions')
  return res.json()
}

async function fetchSessionEntries(project: string, id: string): Promise<LogEntry[]> {
  const res = await fetch(`/api/sessions/${project}/${id}`)
  if (!res.ok) throw new Error('Failed to fetch session')
  return res.json()
}

export const useSessions = (project?: string, limit?: number) =>
  useQuery({
    queryKey: ['sessions', project, limit],
    queryFn: () => fetchSessions(project, limit),
  })

export const useSession = (project: string, id: string) =>
  useQuery({
    queryKey: ['sessions', project, id],
    queryFn: () => fetchSessionEntries(project, id),
    enabled: !!project && !!id,
  })
