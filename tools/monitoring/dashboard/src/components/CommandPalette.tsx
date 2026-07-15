import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Command } from 'cmdk'
import {
  Search, History, Users, Map, Brain, X,
  Home, Activity, GitBranch, PlayCircle, Coins, BarChart2,
  Webhook, BookOpen, Shield, Settings, Database, ShieldCheck,
  ShieldAlert, Clock, AlertCircle,
} from 'lucide-react'
import { useSearch } from '../api/useSearch'
import { useModalA11y } from '../lib/useModalA11y'
import { timeAgo } from '../utils/time'
import type { ComponentType } from 'react'

interface NavItem {
  label: string
  to: string
  icon: ComponentType<{ className?: string }>
}

const NAV_ITEMS: NavItem[] = [
  { label: 'Home', to: '/', icon: Home },
  { label: 'Activity', to: '/activity', icon: Activity },
  { label: 'Agents', to: '/agents', icon: Users },
  { label: 'Dispatch Log', to: '/dispatch-log', icon: GitBranch },
  { label: 'Plans', to: '/plans', icon: PlayCircle },
  { label: 'Token Spend', to: '/token-spend', icon: Coins },
  { label: 'Analytics', to: '/analytics', icon: BarChart2 },
  { label: 'Sessions', to: '/sessions', icon: History },
  { label: 'Hook Health', to: '/hooks', icon: Webhook },
  { label: 'Quality Gates', to: '/quality-gates', icon: ShieldCheck },
  { label: 'Knowledge', to: '/knowledge', icon: BookOpen },
  { label: 'Rules', to: '/rules', icon: BookOpen },
  { label: 'Memory', to: '/memory', icon: Brain },
  { label: 'Privacy', to: '/privacy', icon: Shield },
  { label: 'System', to: '/system', icon: Settings },
  { label: 'DB Explorer', to: '/db', icon: Database },
  { label: 'Injection Log', to: '/injection-log', icon: Brain },
  { label: 'Agent Reliability', to: '/agent-reliability', icon: ShieldAlert },
  { label: 'Routines', to: '/routines', icon: Clock },
  { label: 'Incidents', to: '/incidents', icon: AlertCircle },
]

interface CommandPaletteProps {
  isOpen: boolean
  onClose: () => void
}

interface ResultItem {
  id: string
  category: 'session' | 'agent' | 'plan' | 'memory'
  title: string
  subtitle: string
  route: string
}

export default function CommandPalette({ isOpen, onClose }: CommandPaletteProps) {
  const [query, setQuery] = useState('')
  const navigate = useNavigate()

  // Debounce the query
  const [debouncedQuery, setDebouncedQuery] = useState('')
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), 200)
    return () => clearTimeout(timer)
  }, [query])

  const { data, isLoading } = useSearch(debouncedQuery)

  // Build flat result list
  const results: ResultItem[] = []
  if (data) {
    for (const s of data.sessions) {
      results.push({
        id: `session-${s.id}`,
        category: 'session',
        title: `${s.project} — ${s.slug || s.id.slice(0, 8)}`,
        subtitle: s.startedAt ? timeAgo(s.startedAt) : '',
        route: `/sessions/${s.projectEncoded}/${s.id}`,
      })
    }
    for (const a of data.agents) {
      results.push({
        id: `agent-${a.name}`,
        category: 'agent',
        title: a.name,
        subtitle: a.description.slice(0, 60),
        route: `/agents/${a.name}`,
      })
    }
    for (const p of data.plans) {
      results.push({
        id: `plan-${p.filename}`,
        category: 'plan',
        title: p.title || p.filename,
        subtitle: p.preview?.slice(0, 60) || '',
        route: `/knowledge/plans/${encodeURIComponent(p.filename)}`,
      })
    }
    for (const m of data.memories) {
      results.push({
        id: `memory-${m.path}`,
        category: 'memory',
        title: m.name || m.path.split('/').pop() || '',
        subtitle: m.description || m.agent,
        route: '/knowledge',
      })
    }
  }

  // Reset query on open
  useEffect(() => {
    if (isOpen) {
      setQuery('')
      setDebouncedQuery('')
    }
  }, [isOpen])

  const handleSelect = useCallback((route: string) => {
    navigate(route)
    onClose()
  }, [navigate, onClose])

  const dialogRef = useModalA11y<HTMLDivElement>(isOpen, onClose)

  const categoryIcon = (cat: ResultItem['category']) => {
    switch (cat) {
      case 'session': return <History className="w-4 h-4 text-[var(--text-muted)]" aria-hidden="true" />
      case 'agent': return <Users className="w-4 h-4 text-[var(--text-muted)]" aria-hidden="true" />
      case 'plan': return <Map className="w-4 h-4 text-[var(--text-muted)]" aria-hidden="true" />
      case 'memory': return <Brain className="w-4 h-4 text-[var(--text-muted)]" aria-hidden="true" />
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <Command
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        shouldFilter={false}
        className="relative w-full max-w-2xl mx-4 bg-[var(--bg-secondary)] border border-[var(--border)] rounded-2xl shadow-2xl shadow-black/40 overflow-hidden"
      >
        {/* Search input */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-[var(--border)]">
          <Search className="w-5 h-5 text-[var(--text-muted)] shrink-0" aria-hidden="true" />
          <Command.Input
            value={query}
            onValueChange={setQuery}
            placeholder="Search sessions, agents, plans, memories..."
            aria-label="Search sessions, agents, plans, and memories"
            className="flex-1 bg-transparent text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none text-sm"
            autoFocus
          />
          <button onClick={onClose} aria-label="Close" className="p-1 min-w-6 min-h-6 inline-flex items-center justify-center rounded-md hover:bg-[var(--bg-tertiary)] transition-colors">
            <X className="w-4 h-4 text-[var(--text-muted)]" aria-hidden="true" />
          </button>
        </div>

        {/* Screen-reader status: announces search progress / result count */}
        <div className="sr-only" role="status" aria-live="polite">
          {isLoading && query.length >= 2
            ? 'Searching…'
            : query.length >= 2
              ? `${results.length} result${results.length === 1 ? '' : 's'}`
              : ''}
        </div>

        {/* Results */}
        <Command.List className="max-h-[50vh] overflow-y-auto">
          {/* Nav items — shown when query is empty or matches a label */}
          {(() => {
            const q = query.toLowerCase().trim()
            const filtered = q.length === 0
              ? NAV_ITEMS
              : NAV_ITEMS.filter(n => n.label.toLowerCase().includes(q))
            if (filtered.length === 0) return null
            return (
              <Command.Group heading="Pages" className="px-2 py-1">
                <div className="px-3 py-1">
                  <span className="text-[10px] font-semibold uppercase tracking-widest text-[var(--text-muted)]">Pages</span>
                </div>
                {filtered.map(item => {
                  const Icon = item.icon
                  return (
                    <Command.Item
                      key={`nav-${item.to}`}
                      value={`nav-${item.label}`}
                      onSelect={() => handleSelect(item.to)}
                      className="flex items-center gap-3 px-5 py-2 text-left text-[var(--text-secondary)] transition-colors cursor-default data-[selected=true]:bg-[var(--accent-subtle)] data-[selected=true]:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]"
                    >
                      <Icon className="w-4 h-4 text-[var(--text-muted)]" aria-hidden="true" />
                      <span className="text-sm font-medium flex-1">{item.label}</span>
                      <span className="text-xs text-[var(--text-muted)] shrink-0">page</span>
                    </Command.Item>
                  )
                })}
              </Command.Group>
            )
          })()}

          {query.length < 2 && (
            <div className="px-5 py-4 text-center text-xs text-[var(--text-muted)]">
              Type to search sessions, agents, plans, memories…
            </div>
          )}

          {isLoading && query.length >= 2 && (
            <div className="px-5 py-4 space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-10 bg-[var(--bg-tertiary)] rounded-lg animate-pulse" />
              ))}
            </div>
          )}

          <Command.Empty>
            {query.length >= 2 && !isLoading && (
              <div className="px-5 py-8 text-center text-sm text-[var(--text-muted)]">
                No results for &ldquo;{query}&rdquo;
              </div>
            )}
          </Command.Empty>

          {results.map((item) => (
            <Command.Item
              key={item.id}
              value={item.id}
              onSelect={() => handleSelect(item.route)}
              className="flex items-center gap-3 px-5 py-2.5 text-left text-[var(--text-secondary)] transition-colors cursor-default data-[selected=true]:bg-[var(--accent-subtle)] data-[selected=true]:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]"
            >
              {categoryIcon(item.category)}
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium truncate">{item.title}</div>
                <div className="text-xs text-[var(--text-muted)] truncate">{item.subtitle}</div>
              </div>
              <span className="text-xs text-[var(--text-muted)] capitalize shrink-0">{item.category}</span>
            </Command.Item>
          ))}
        </Command.List>

        {/* Footer hint */}
        <div className="px-5 py-2.5 border-t border-[var(--border)] flex items-center gap-4 text-xs text-[var(--text-muted)]">
          <span><kbd className="px-1.5 py-0.5 rounded bg-[var(--bg-tertiary)] font-mono">↑↓</kbd> navigate</span>
          <span><kbd className="px-1.5 py-0.5 rounded bg-[var(--bg-tertiary)] font-mono">↵</kbd> open</span>
          <span><kbd className="px-1.5 py-0.5 rounded bg-[var(--bg-tertiary)] font-mono">esc</kbd> close</span>
        </div>
      </Command>
    </div>
  )
}
