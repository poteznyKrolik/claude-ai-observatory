import { useEffect, useState, useSyncExternalStore, useCallback } from 'react'
import { useTelemetryStore } from '@/stores/telemetryStore'
import type { Span } from '@/types/traces'
import type { MetricDataPoint } from '@/types/metrics'
import type { LogRecord } from '@/types/logs'

interface WebSocketMessage {
  type: 'traces' | 'metrics' | 'logs'
  timestamp: string
  payload: unknown
}

// Singleton WebSocket manager
class WebSocketManager {
  private ws: WebSocket | null = null
  private url: string = ''
  private reconnectTimeout: number | null = null
  private listeners: Set<() => void> = new Set()
  private _isConnected: boolean = false
  private _error: string | null = null
  private messageHandler: ((message: WebSocketMessage) => void) | null = null

  get isConnected() {
    return this._isConnected
  }

  get error() {
    return this._error
  }

  subscribe(listener: () => void) {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  private notify() {
    this.listeners.forEach((listener) => listener())
  }

  setMessageHandler(handler: (message: WebSocketMessage) => void) {
    this.messageHandler = handler
  }

  connect(url: string) {
    // Don't reconnect if already connected to the same URL
    if (this.ws && this.url === url && this.ws.readyState === WebSocket.OPEN) {
      return
    }

    // Close existing connection if any
    this.disconnect()

    this.url = url

    try {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
      const wsUrl = url.startsWith('/')
        ? `${protocol}//${window.location.host}${url}`
        : url

      console.log('WebSocket connecting to:', wsUrl)
      this.ws = new WebSocket(wsUrl)

      this.ws.onopen = () => {
        this._isConnected = true
        this._error = null
        console.log('WebSocket connected')
        this.notify()
      }

      this.ws.onclose = (event) => {
        this._isConnected = false
        console.log('WebSocket disconnected', event.code, event.reason)
        this.notify()

        // Only reconnect if not a clean close
        if (event.code !== 1000) {
          this.scheduleReconnect()
        }
      }

      this.ws.onerror = () => {
        this._error = 'WebSocket connection error'
        console.error('WebSocket error')
        this.notify()
      }

      this.ws.onmessage = (event) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data)
          if (this.messageHandler) {
            this.messageHandler(message)
          }
        } catch (err) {
          console.error('Failed to parse WebSocket message:', err)
        }
      }
    } catch (err) {
      console.error('Failed to create WebSocket:', err)
      this._error = 'Failed to create WebSocket connection'
      this.notify()
    }
  }

  private scheduleReconnect() {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout)
    }
    this.reconnectTimeout = window.setTimeout(() => {
      console.log('Attempting to reconnect...')
      this.connect(this.url)
    }, 3000)
  }

  disconnect() {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout)
      this.reconnectTimeout = null
    }
    if (this.ws) {
      // Remove handlers before closing to prevent reconnect
      this.ws.onclose = null
      this.ws.onerror = null
      this.ws.onmessage = null
      this.ws.onopen = null

      if (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING) {
        this.ws.close(1000, 'Client disconnect')
      }
      this.ws = null
    }
    this._isConnected = false
    this.notify()
  }
}

// Single global instance
const wsManager = new WebSocketManager()

export function useWebSocket(url: string = '/ws') {
  const addSpans = useTelemetryStore((state) => state.addSpans)
  const addMetrics = useTelemetryStore((state) => state.addMetrics)
  const addLogs = useTelemetryStore((state) => state.addLogs)

  // Use useSyncExternalStore for proper React 18+ subscription
  const isConnected = useSyncExternalStore(
    (callback) => wsManager.subscribe(callback),
    () => wsManager.isConnected
  )

  const [error, setError] = useState<string | null>(null)

  // Memoize the message handler to prevent accumulation
  const handleMessage = useCallback((message: WebSocketMessage) => {
    switch (message.type) {
      case 'traces':
        addSpans(message.payload as Span[])
        break
      case 'metrics':
        addMetrics(message.payload as MetricDataPoint[])
        break
      case 'logs':
        addLogs(message.payload as LogRecord[])
        break
    }
  }, [addSpans, addMetrics, addLogs])

  useEffect(() => {
    // Set up message handler
    wsManager.setMessageHandler(handleMessage)

    // Connect
    wsManager.connect(url)

    // Update error state
    const unsubscribe = wsManager.subscribe(() => {
      setError(wsManager.error)
    })

    return () => {
      unsubscribe()
      // Don't disconnect on unmount - keep connection alive
      // The connection is shared across the app
    }
  }, [url, handleMessage])

  return { isConnected, error }
}

// Export for manual control if needed
export const webSocketManager = wsManager
