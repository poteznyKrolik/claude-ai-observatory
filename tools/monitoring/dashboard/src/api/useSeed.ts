import { useState, useCallback } from 'react'

interface SeedResult {
  seeded: { sessions: number; agentRuns: number }
}

interface UseSeedReturn {
  loading: boolean
  result: SeedResult | null
  error: string | null
  trigger: () => Promise<void>
}

export function useSeed(): UseSeedReturn {
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<SeedResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  const trigger = useCallback(async () => {
    setLoading(true)
    setError(null)
    setResult(null)
    try {
      const res = await fetch('/api/cast/seed', { method: 'POST' })
      const json = await res.json()
      if (!res.ok) {
        setError(json.error ?? `Seed failed (${res.status})`)
      } else {
        setResult(json as SeedResult)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Seed request failed')
    } finally {
      setLoading(false)
    }
  }, [])

  return { loading, result, error, trigger }
}
