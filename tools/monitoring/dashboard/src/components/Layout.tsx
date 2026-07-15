import { useState, useMemo, useEffect } from 'react'
import type { ReactNode } from 'react'
import { useLocation } from 'react-router-dom'
import { useHotkeys } from 'react-hotkeys-hook'
import { Search, Menu, X, AlertTriangle, Sun, Moon } from 'lucide-react'
import Sidebar from './Sidebar'
import CommandPalette from './CommandPalette'
import { useBudgetStatus } from '../api/useBudgetStatus'
import { useLiveEvents } from '../api/useLive'
import { useModalA11y } from '../lib/useModalA11y'
import { SseStateContext } from '../state/sseState'
import { useTheme } from '../state/themeState'

interface LayoutProps {
  children: ReactNode
}

// Per-route document titles (WCAG 2.4.2 Page Titled) — keyed by first path segment.
const ROUTE_TITLES: Record<string, string> = {
  '': 'Dashboard',
  executive: 'Executive Summary',
  sessions: 'Sessions',
  analytics: 'Analytics',
  system: 'System',
  docs: 'Docs',
  agents: 'Agents',
  'work-log': 'Work Log',
  'hook-failures': 'Hook Failures',
  'injection-log': 'Injection Log',
  'agent-reliability': 'Agent Reliability',
  routines: 'Routines',
  incidents: 'Incidents',
  hooks: 'Hooks',
  memory: 'Memory',
  plans: 'Plans',
  evals: 'Evals',
  outputs: 'Outputs',
}

function BudgetBanner() {
  const { data } = useBudgetStatus()

  if (!data || data.daily_limit == null || data.pct_used == null) return null
  if (data.pct_used < 80 && !data.over_budget) return null

  const isOver = data.over_budget
  const spend = data.today_spend < 0.01
    ? `$${data.today_spend.toFixed(4)}`
    : `$${data.today_spend.toFixed(2)}`
  const limit = data.daily_limit < 0.01
    ? `$${data.daily_limit.toFixed(4)}`
    : `$${data.daily_limit.toFixed(2)}`
  const pct = data.pct_used.toFixed(1)

  return (
    <div
      role="alert"
      className={`flex items-center gap-2 px-4 py-2 text-xs font-medium ${
        isOver
          ? 'bg-rose-500/20 border-b border-rose-500/30 text-rose-300'
          : 'bg-amber-500/20 border-b border-amber-500/30 text-amber-300'
      }`}
    >
      <AlertTriangle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
      <span>
        Daily budget: {spend} of {limit} limit ({pct}%)
        {isOver && ' — over budget'}
      </span>
    </div>
  )
}

export default function Layout({ children }: LayoutProps) {
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const { connected } = useLiveEvents()
  const { theme, toggleTheme } = useTheme()
  // `sidebarOpen` is mobile-only state (the hamburger that sets it is lg:hidden),
  // so the drawer becomes a modal dialog only on small screens — focus trap,
  // Escape-to-close, and focus return engage just when it slides in.
  const drawerRef = useModalA11y<HTMLDivElement>(sidebarOpen, () => setSidebarOpen(false))

  // Give each route a descriptive document title (WCAG 2.4.2).
  const location = useLocation()
  useEffect(() => {
    const seg = location.pathname.split('/')[1] ?? ''
    const name = ROUTE_TITLES[seg] ?? 'Dashboard'
    document.title = `${name} · CAST Dashboard`
  }, [location.pathname])

  // Global Cmd+K / Ctrl+K listener
  useHotkeys('mod+k', (e) => {
    e.preventDefault()
    setPaletteOpen(prev => !prev)
  }, { enableOnFormTags: true })

  const sseContextValue = useMemo(
    () => ({ connected, setConnected: () => {} }),
    [connected]
  )

  return (
    <SseStateContext.Provider value={sseContextValue}>
    <div className="h-screen flex noise-bg">
      {/* Skip to main content — visually hidden, visible on focus for keyboard users */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:z-[100] focus:top-3 focus:left-3 focus:px-4 focus:py-2 focus:rounded-lg focus:bg-[var(--accent)] focus:text-[var(--primary-foreground)] focus:font-semibold focus:text-sm focus:shadow-lg focus:outline-none"
      >
        Skip to main content
      </a>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar: hidden on mobile unless sidebarOpen, always visible on lg+ */}
      <div
        ref={drawerRef}
        role={sidebarOpen ? 'dialog' : undefined}
        aria-modal={sidebarOpen ? true : undefined}
        aria-label={sidebarOpen ? 'Navigation' : undefined}
        className={`
        fixed inset-y-0 left-0 z-50 transition-transform duration-200
        lg:relative lg:translate-x-0 lg:z-auto lg:h-full
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <Sidebar onNavigate={() => setSidebarOpen(false)} />
      </div>

      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        {/* Budget warning banner — shown above top bar when limit is set */}
        <BudgetBanner />

        {/* Top bar */}
        <header className="flex items-center justify-between px-4 py-2 border-b border-[var(--border)] bg-[var(--bg-primary)]">
          {/* Hamburger — mobile only */}
          <button
            onClick={() => setSidebarOpen(prev => !prev)}
            className="lg:hidden p-2 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-secondary)] transition-colors focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:outline-none"
            aria-label="Toggle navigation"
          >
            {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
          <div className="hidden lg:block" />

          <div className="flex items-center gap-1">
          {/* Theme toggle */}
          <button
            onClick={toggleTheme}
            aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
            className="p-2 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-secondary)] transition-colors focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:outline-none"
          >
            {theme === 'dark'
              ? <Sun className="w-4 h-4" aria-hidden="true" />
              : <Moon className="w-4 h-4" aria-hidden="true" />}
          </button>

          {/* Search button */}
          <button
            onClick={() => setPaletteOpen(true)}
            aria-label="Open command palette (Cmd+K)"
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border)] text-xs text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:border-[var(--accent)]/30 transition-colors focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:outline-none"
          >
            <Search className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Search</span>
            <kbd className="ml-1 px-1.5 py-0.5 rounded bg-[var(--bg-tertiary)] font-mono text-[10px] hidden sm:inline">⌘K</kbd>
          </button>
          </div>
        </header>
        <main id="main-content" className="flex-1 overflow-y-auto p-4 md:p-6" tabIndex={-1}>
          {children}
        </main>
      </div>
      <CommandPalette isOpen={paletteOpen} onClose={() => setPaletteOpen(false)} />
    </div>
    </SseStateContext.Provider>
  )
}
