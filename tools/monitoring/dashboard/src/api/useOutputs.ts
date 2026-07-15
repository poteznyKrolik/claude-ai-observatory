import { useQuery } from '@tanstack/react-query'
import type { OutputFile } from '../types'

export function useOutputs(category: OutputFile['category']) {
  return useQuery<OutputFile[]>({
    queryKey: ['outputs', category],
    queryFn: async () => {
      const res = await fetch(`/api/outputs/${category}`)
      if (!res.ok) throw new Error(`API error ${res.status}: /api/outputs/${category}`)
      return res.json()
    },
    staleTime: 30_000,
  })
}
