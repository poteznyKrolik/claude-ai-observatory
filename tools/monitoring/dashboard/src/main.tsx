import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'sonner'
import App from './App'
import './index.css'
import { ThemeProvider, useTheme } from './state/themeState'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, retry: 1 },
  },
})

function ThemedToaster() {
  const { theme } = useTheme()
  return (
    <Toaster
      theme={theme}
      position="bottom-right"
      toastOptions={{
        style: {
          background: 'var(--bg-secondary)',
          border: '1px solid var(--glass-border)',
          color: 'var(--text-primary)',
        },
      }}
    />
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <App />
          <ThemedToaster />
        </BrowserRouter>
      </QueryClientProvider>
    </ThemeProvider>
  </StrictMode>
)
