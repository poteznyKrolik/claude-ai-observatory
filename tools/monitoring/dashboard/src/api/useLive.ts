import { useEffect, useRef, useState } from 'react'
import type { LiveEvent } from '../types'

export function useLiveEvents(onEvent?: (e: LiveEvent) => void) {
  const [connected, setConnected] = useState(false)
  const [lastDbEventMs, setLastDbEventMs] = useState<number | null>(null)
  const onEventRef = useRef(onEvent)
  const retryTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Keep ref current without triggering reconnect
  useEffect(() => {
    onEventRef.current = onEvent
  })

  useEffect(() => {
    let es: EventSource
    let cancelled = false

    function connect() {
      if (cancelled) return
      es = new EventSource('/api/events')
      es.onopen = () => {
        if (!cancelled) setConnected(true)
      }
      es.onerror = () => {
        if (cancelled) return
        setConnected(false)
        es.close()
        // Auto-retry after 3 seconds
        if (retryTimer.current) clearTimeout(retryTimer.current)
        retryTimer.current = setTimeout(() => {
          retryTimer.current = null
          connect()
        }, 3000)
      }
      es.onmessage = (e) => {
        if (cancelled) return
        let event: LiveEvent
        try {
          event = JSON.parse(e.data)
        } catch {
          return // skip a malformed SSE frame instead of throwing in the handler
        }
        if (event.type.startsWith('db_change_')) {
          setLastDbEventMs(Date.now())
        }
        onEventRef.current?.(event)
      }
    }

    connect()

    return () => {
      cancelled = true
      if (retryTimer.current) {
        clearTimeout(retryTimer.current)
        retryTimer.current = null
      }
      es?.close()
      setConnected(false)
    }
  }, []) // connect once — callback stays current via ref

  return { connected, lastDbEventMs }
}
