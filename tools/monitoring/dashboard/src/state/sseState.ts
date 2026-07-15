import { createContext, useContext } from 'react'

interface SseStateContext {
  connected: boolean
  setConnected: (v: boolean) => void
}

export const SseStateContext = createContext<SseStateContext>({
  connected: true,
  setConnected: () => {},
})

export function useSseState() {
  return useContext(SseStateContext)
}
