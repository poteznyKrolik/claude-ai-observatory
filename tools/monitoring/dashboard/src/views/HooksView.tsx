import { Webhook, HeartPulse } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import type { HookDefinition } from '../types'
import { useHookHealth, type HookHealthEntry } from '../api/useHookHealth'
import SectionHeader from '../components/SectionHeader'
import { timeAgo } from '../utils/time'

async function fetchHooks(): Promise<HookDefinition[]> {
  const res = await fetch('/api/hooks')
  if (!res.ok) throw new Error('Failed to fetch hooks')
  return res.json()
}

function useHooks() {
  return useQuery({ queryKey: ['hooks'], queryFn: fetchHooks, staleTime: 30_000 })
}

const HEALTH_DOT: Record<HookHealthEntry['health'], string> = {
  green: 'bg-emerald-400',
  yellow: 'bg-amber-400',
  red: 'bg-rose-400',
}

const HEALTH_LABEL: Record<HookHealthEntry['health'], string> = {
  green: 'Healthy',
  yellow: 'Stale',
  red: 'Broken',
}

function HookHealthPanel() {
  const { data, isLoading, error } = useHookHealth()
  const hooks = data?.hooks ?? []

  // Don't render anything on error or empty — the hooks list below is the primary content.
  if (error || (!isLoading && hooks.length === 0)) return null

  const counts = hooks.reduce(
    (acc, h) => { acc[h.health] = (acc[h.health] ?? 0) + 1; return acc },
    {} as Record<HookHealthEntry['health'], number>,
  )
  const unhealthy = hooks
    .filter(h => h.health !== 'green')
    .sort((a, b) => (a.health === 'red' ? -1 : 1) - (b.health === 'red' ? -1 : 1))

  return (
    <section aria-label="Hook health" className="bento-card overflow-hidden">
      <div className="flex items-center gap-2.5 px-4 py-3 border-b border-[var(--glass-border)]">
        <HeartPulse className="w-4 h-4 text-[var(--accent)]" aria-hidden="true" />
        <h2 className="text-sm font-semibold text-[var(--text-primary)]">Hook Health</h2>
        {isLoading ? (
          <span className="ml-auto h-4 w-24 rounded bg-[var(--bg-secondary)] animate-pulse" />
        ) : (
          <div className="ml-auto flex items-center gap-3">
            {(['green', 'yellow', 'red'] as const).map(level =>
              counts[level] ? (
                <span key={level} className="inline-flex items-center gap-1.5 text-xs text-[var(--text-secondary)]">
                  <span className={`w-2 h-2 rounded-full ${HEALTH_DOT[level]}`} aria-hidden="true" />
                  <span className="tabular-nums">{counts[level]}</span>
                  <span className="text-[var(--text-muted)]">{HEALTH_LABEL[level]}</span>
                </span>
              ) : null,
            )}
          </div>
        )}
      </div>

      {!isLoading && unhealthy.length === 0 && (
        <p className="px-4 py-3 text-xs text-[var(--text-muted)]">
          All {hooks.length} registered hooks resolve to existing, executable scripts.
        </p>
      )}

      {!isLoading && unhealthy.length > 0 && (
        <ul className="divide-y divide-[var(--glass-border)]">
          {unhealthy.map((h, i) => (
            <li key={`${h.hook_type}-${i}`} className="flex items-start gap-3 px-4 py-2.5 min-h-[44px]">
              <span className={`shrink-0 mt-1 w-2 h-2 rounded-full ${HEALTH_DOT[h.health]}`} aria-hidden="true" />
              <div className="min-w-0 flex-1">
                <p className="text-sm text-[var(--text-primary)] truncate" title={h.script_path ?? h.command}>
                  {h.hook_type}
                </p>
                <p className="text-xs text-[var(--text-muted)] truncate mt-0.5 font-mono">
                  {h.script_path ?? h.command}
                </p>
              </div>
              <div className="shrink-0 flex items-center gap-2 text-[10px]">
                {!h.exists && <span className="px-1.5 py-0.5 rounded bg-rose-500/10 text-rose-400 border border-rose-500/25">missing</span>}
                {h.exists && !h.executable && <span className="px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/25">not executable</span>}
                <span className="text-[var(--text-muted)] whitespace-nowrap">
                  {h.last_fired_at ? `fired ${timeAgo(h.last_fired_at)}` : 'never fired'}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

function groupByEvent(hooks: HookDefinition[]): Map<string, HookDefinition[]> {
  const map = new Map<string, HookDefinition[]>()
  for (const hook of hooks) {
    if (!map.has(hook.event)) map.set(hook.event, [])
    map.get(hook.event)!.push(hook)
  }
  return map
}

function SkeletonRows() {
  return (
    <div className="space-y-2">
      {[...Array(5)].map((_, i) => (
        <div
          key={i}
          className="h-12 rounded animate-pulse bg-[var(--bg-secondary)]"
          style={{ width: `${90 - i * 5}%` }}
        />
      ))}
    </div>
  )
}

export default function HooksView() {
  const { data: hooks = [], isLoading, error } = useHooks()
  const grouped = groupByEvent(hooks)

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      <SectionHeader
        as="h1"
        kicker="event hooks"
        title="Hooks"
        icon={<Webhook className="w-5 h-5" />}
        description="Claude Code event hooks registered in ~/.claude/settings.json"
        actions={
          <span className="text-xs text-[var(--text-muted)]">
            {hooks.length} hook{hooks.length !== 1 ? 's' : ''}
          </span>
        }
      />

      <HookHealthPanel />

      {isLoading && <SkeletonRows />}

      {error && (
        <div
          role="alert"
          className="bento-card p-4 text-sm text-[var(--text-muted)]"
        >
          Failed to load hooks.
        </div>
      )}

      {!isLoading && !error && hooks.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <Webhook className="w-10 h-10 opacity-20 text-[var(--text-muted)]" aria-hidden="true" />
          <p className="text-sm text-[var(--text-muted)]">No hooks configured</p>
        </div>
      )}

      {!isLoading && !error && hooks.length > 0 && (
        <div className="space-y-6">
          {[...grouped.entries()].map(([event, eventHooks]) => (
            <section key={event} aria-label={`${event} hooks`}>
              <div className="flex items-center gap-2 mb-2">
                <h2 className="text-sm font-semibold text-[var(--text-secondary)]">
                  {event}
                </h2>
                <span className="text-xs px-1.5 py-0.5 rounded-full font-medium bg-[var(--bg-secondary)] text-[var(--text-muted)]">
                  {eventHooks.length}
                </span>
              </div>
              <div className="bento-card overflow-hidden">
                {eventHooks.map((hook, i) => (
                  <div
                    key={i}
                    className="flex items-start gap-3 px-4 py-3 min-h-[44px]"
                    style={{
                      borderBottom: i < eventHooks.length - 1 ? '1px solid var(--glass-border)' : 'none',
                    }}
                  >
                    <span className="shrink-0 text-xs px-2 py-0.5 rounded font-mono font-medium mt-0.5 border border-[var(--glass-border)] bg-[var(--bg-secondary)] text-[var(--text-secondary)]">
                      {hook.type}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p
                        className="text-sm text-[var(--text-primary)] truncate"
                        title={hook.command ?? hook.description ?? ''}
                      >
                        {hook.command ?? hook.description ?? '—'}
                      </p>
                      {hook.matcher && (
                        <p className="text-xs text-[var(--text-muted)] truncate mt-0.5">
                          matcher: {hook.matcher}
                        </p>
                      )}
                    </div>
                    {hook.timeout && (
                      <span className="shrink-0 text-xs text-[var(--text-muted)]">
                        {hook.timeout}ms
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  )
}
