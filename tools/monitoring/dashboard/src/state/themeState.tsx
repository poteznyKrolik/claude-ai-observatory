import { createContext, useContext, useState, useEffect } from 'react'
import type { ReactNode } from 'react'

export type Theme = 'light' | 'dark'

interface ThemeContextValue {
  theme: Theme
  setTheme: (t: Theme) => void
  toggleTheme: () => void
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

function applyTheme(t: Theme) {
  const el = document.documentElement
  el.classList.remove('light', 'dark')
  el.classList.add(t)
  el.style.backgroundColor = t === 'light' ? '#F4F6FA' : '#070A0F'
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  // The inline script in index.html has already resolved the theme and applied
  // the class to <html> — read from there to be the single source of truth and
  // avoid any hydration flash.
  const [theme, setThemeState] = useState<Theme>(
    () => (document.documentElement.classList.contains('light') ? 'light' : 'dark')
  )

  function setTheme(t: Theme) {
    setThemeState(t)
    applyTheme(t)
    localStorage.setItem('cast-theme', t)
  }

  function toggleTheme() {
    setTheme(theme === 'dark' ? 'light' : 'dark')
  }

  // Follow OS preference only while the user has no stored preference.
  useEffect(() => {
    if (localStorage.getItem('cast-theme')) return

    const mq = window.matchMedia('(prefers-color-scheme: light)')

    function handleChange(e: MediaQueryListEvent) {
      // Bail if the user has since saved a preference.
      if (localStorage.getItem('cast-theme')) return
      const next: Theme = e.matches ? 'light' : 'dark'
      setThemeState(next)
      applyTheme(next)
    }

    mq.addEventListener('change', handleChange)
    return () => mq.removeEventListener('change', handleChange)
  }, [])

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used inside ThemeProvider')
  return ctx
}
