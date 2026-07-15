import { useQuery } from '@tanstack/react-query'
import type { MemoryFile } from '../types'

async function fetchAgentMemory(): Promise<MemoryFile[]> {
  const res = await fetch('/api/memory/agent')
  if (!res.ok) throw new Error('Failed to fetch agent memory')
  return res.json()
}

async function fetchProjectMemory(): Promise<MemoryFile[]> {
  const res = await fetch('/api/memory/project')
  if (!res.ok) throw new Error('Failed to fetch project memory')
  return res.json()
}

export const useAgentMemory = () =>
  useQuery({ queryKey: ['memory', 'agent'], queryFn: fetchAgentMemory })

export const useProjectMemory = () =>
  useQuery({ queryKey: ['memory', 'project'], queryFn: fetchProjectMemory })
