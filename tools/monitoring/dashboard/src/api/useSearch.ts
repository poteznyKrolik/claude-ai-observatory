import { useQuery } from '@tanstack/react-query'

export interface SearchResults {
  sessions: Array<{ id: string; project: string; projectEncoded: string; startedAt: string; slug?: string; matchReason: string }>
  agents: Array<{ name: string; description: string; model: string; color: string }>
  plans: Array<{ filename: string; title: string; date: string; preview: string }>
  memories: Array<{ agent: string; name?: string; description?: string; type?: string; path: string }>
}

async function fetchSearch(query: string): Promise<SearchResults> {
  const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`)
  if (!res.ok) throw new Error('Search failed')
  return res.json()
}

export const useSearch = (query: string) =>
  useQuery({
    queryKey: ['search', query],
    queryFn: () => fetchSearch(query),
    enabled: query.length >= 2,
    staleTime: 30_000,
  })
