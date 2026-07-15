import { useQuery } from '@tanstack/react-query'
import type { AgentDefinition } from '../types'

async function fetchAgents(): Promise<AgentDefinition[]> {
  const res = await fetch('/api/agents')
  if (!res.ok) throw new Error('Failed to fetch agents')
  return res.json()
}

async function fetchAgent(name: string): Promise<AgentDefinition & { body: string }> {
  const res = await fetch(`/api/agents/${name}`)
  if (!res.ok) throw new Error('Failed to fetch agent')
  return res.json()
}

export const useAgents = () =>
  useQuery({ queryKey: ['agents'], queryFn: fetchAgents, staleTime: 60_000 })

export const useAgent = (name: string) =>
  useQuery({ queryKey: ['agents', name], queryFn: () => fetchAgent(name), enabled: !!name })
