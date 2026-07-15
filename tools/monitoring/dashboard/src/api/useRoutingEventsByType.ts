import { useQuery } from '@tanstack/react-query'

export interface RoutingEvent {
  id: number
  session_id: string
  timestamp: string
  event_type: string
  agent: string | null
  data: string | null
  project: string | null
}

export function useRoutingEventsByType(eventType: string, limit = 50) {
  return useQuery<RoutingEvent[]>({
    queryKey: ['routing-events', eventType, limit],
    queryFn: () =>
      fetch(`/api/routing/events?event_type=${encodeURIComponent(eventType)}&limit=${limit}`)
        .then(r => {
          if (!r.ok) throw new Error(`Failed to fetch routing events for type: ${eventType}`)
          return r.json() as Promise<RoutingEvent[]>
        }),
    refetchInterval: 10_000,
    staleTime: 5_000,
  })
}
