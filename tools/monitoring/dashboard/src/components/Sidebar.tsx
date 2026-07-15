import { useRef } from 'react'
import { NavLink } from 'react-router-dom'
import { useSseState } from '../state/sseState'
import {
  LayoutDashboard, BarChart3, History, Settings, FileText, Bot, ScrollText, AlertTriangle, ShieldAlert, Syringe, Timer, Flame, Webhook, Brain, ClipboardList, FlaskConical, FolderOpen, Database,
} from 'lucide-react'
import { motion, useScroll } from 'framer-motion'
import logo from '../assets/logo.svg'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './ui/tooltip'
import { useHookFailuresCount } from '../api/useHookFailures'

// ── nav items ──────────────────────────────────────────────────────────────

interface NavItem {
  to: string
  label: string
  icon: React.ComponentType<{ className?: string }>
  end?: boolean
}

const NAV_GROUPS: { label: string; items: NavItem[] }[] = [
  {
    label: 'Overview',
    items: [
      { to: '/',          label: 'Dashboard', icon: LayoutDashboard, end: true },
      { to: '/executive', label: 'Executive', icon: ClipboardList },
      { to: '/sessions',  label: 'Sessions',  icon: History },
      { to: '/analytics', label: 'Analytics', icon: BarChart3 },
    ],
  },
  {
    label: 'Observability',
    items: [
      { to: '/work-log',      label: 'Work Log',      icon: ScrollText },
      { to: '/evals',         label: 'Evals',         icon: FlaskConical },
      { to: '/injection-log', label: 'Injection Log', icon: Syringe },
      { to: '/routines',      label: 'Routines',      icon: Timer },
      { to: '/hooks',         label: 'Hooks',         icon: Webhook },
      { to: '/db',            label: 'Database',      icon: Database },
    ],
  },
  {
    label: 'Reliability',
    items: [
      { to: '/hook-failures',     label: 'Failures',    icon: AlertTriangle },
      { to: '/agent-reliability', label: 'Reliability', icon: ShieldAlert },
      { to: '/incidents',         label: 'Incidents',   icon: Flame },
    ],
  },
  {
    label: 'System',
    items: [
      { to: '/memory',   label: 'Memory',  icon: Brain },
      { to: '/plans',    label: 'Plans',   icon: FileText },
      { to: '/agents',   label: 'Agents',  icon: Bot },
      { to: '/outputs',  label: 'Outputs', icon: FolderOpen },
      { to: '/system',   label: 'System',  icon: Settings },
      { to: '/docs',     label: 'Docs',    icon: FileText },
    ],
  },
]

interface SidebarProps {
  onNavigate?: () => void
}

export default function Sidebar({ onNavigate }: SidebarProps) {
  const sidebarRef = useRef<HTMLElement>(null)
  const { scrollYProgress } = useScroll({ container: sidebarRef })
  const { connected } = useSseState()
  const { data: countData } = useHookFailuresCount()
  const failureCount = countData?.count ?? 0

  return (
    <div className="relative shrink-0 h-full">
      <aside
        ref={sidebarRef}
        className="w-52 h-full flex flex-col border-r border-[var(--glass-border)] glass-surface relative overflow-y-auto"
      >
        <motion.div
          className="absolute top-0 left-0 right-0 h-0.5 bg-[var(--accent)] origin-left z-10"
          style={{ scaleX: scrollYProgress }}
        />

        {/* Logo */}
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger render={<span className="block" />}>
              <div className="flex items-center gap-2.5 px-4 py-5 border-b border-[var(--border)] min-h-[68px]">
                <img src={logo} alt="CAST" className="w-8 h-8 shrink-0" />
                <span className="text-sm font-bold text-[var(--text-primary)] tracking-tight">CAST</span>
              </div>
            </TooltipTrigger>
            <TooltipContent side="right">
              <span className="font-bold">CAST</span>
              <span className="block text-xs text-[var(--text-muted)]">Agent Dispatch Control</span>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        {/* Navigation — grouped sections */}
        <nav className="flex-1 px-2 py-3 space-y-4" aria-label="Primary">
          <TooltipProvider>
            {NAV_GROUPS.map(group => (
              <div key={group.label} className="space-y-0.5">
                <p id={`navgroup-${group.label}`} className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--text-muted)]">
                  {group.label}
                </p>
                <ul className="space-y-0.5" aria-labelledby={`navgroup-${group.label}`}>
                {group.items.map(({ to, label, icon: Icon, end }) => (
                  <li key={to}>
                  <Tooltip>
                    <TooltipTrigger render={<span className="block" />}>
                      <NavLink
                        to={to}
                        viewTransition
                        end={end}
                        onClick={onNavigate}
                        className={({ isActive }) =>
                          `relative flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm font-medium transition-colors duration-150 ${
                            isActive
                              ? 'text-[var(--primary-foreground)] font-semibold'
                              : 'text-[var(--text-secondary)] hover:bg-[var(--accent-subtle)] hover:text-[var(--text-primary)]'
                          }`
                        }
                      >
                        {({ isActive }) => (
                          <>
                            {isActive && (
                              <motion.span
                                layoutId="nav-active-pill"
                                className="absolute inset-0 rounded-xl bg-[var(--accent)] shadow-md shadow-[var(--accent-shadow-color)]"
                                transition={{ type: 'spring', stiffness: 380, damping: 32 }}
                                aria-hidden="true"
                              />
                            )}
                            <span className="relative z-10">
                              <Icon className="w-[18px] h-[18px] shrink-0" aria-hidden="true" />
                              {to === '/hook-failures' && failureCount > 0 && (
                                <span className="absolute -top-1.5 -right-1.5 min-w-[16px] h-4 px-1 rounded-full bg-rose-500 text-white text-[9px] font-bold flex items-center justify-center leading-none">
                                  {failureCount > 99 ? '99+' : failureCount}
                                </span>
                              )}
                            </span>
                            <span className="relative z-10 truncate">{label}</span>
                          </>
                        )}
                      </NavLink>
                    </TooltipTrigger>
                    <TooltipContent side="right">{label}</TooltipContent>
                  </Tooltip>
                  </li>
                ))}
                </ul>
              </div>
            ))}
          </TooltipProvider>
        </nav>

        {/* Status indicator */}
        <div className="px-4 py-4 border-t border-[var(--border)] flex items-center gap-2">
          {connected ? (
            <>
              <span className="relative flex h-2 w-2 shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[var(--success)] opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-[var(--success)]" />
              </span>
              <span className="text-[10px] text-[var(--text-muted)]">Connected</span>
            </>
          ) : (
            <>
              <span className="relative flex h-2 w-2 shrink-0">
                <span className="relative inline-flex rounded-full h-2 w-2 bg-[var(--text-muted)]" />
              </span>
              <span className="text-[10px] text-[var(--text-muted)]">Disconnected</span>
            </>
          )}
        </div>
      </aside>
    </div>
  )
}
