import {
  Users, Terminal, Zap, History,
  FileText, Shield, Brain, Database, Send, Clock, RefreshCw,
  Play, Trash2, Plus, Check, ChevronDown, ChevronRight, GitBranch, DollarSign, AlertTriangle,
  ShieldCheck, Gauge, HardDrive, Lock, KeyRound, Server
} from 'lucide-react'
import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useAgents, useAgent } from '../api/useAgents'
import { useCastdStatus } from '../api/useCastdControl'
import { useControlStatus } from '../api/useControlEnabled'
import { controlFetch, getControlToken, setControlToken } from '../lib/controlFetch'
import { useSystemHealth } from '../api/useSystem'
import { useRules, useSkills, useCommands } from '../api/useKnowledge'
import { useAgentMemory, useProjectMemory } from '../api/useMemory'
import { usePlans, usePlan } from '../api/usePlans'
import { useChainMap, usePolicies, useModelPricing } from '../api/useCastData'
import { useParryGuard } from '../api/useParryGuard'
import { useAgentTruncations } from '../api/useAgentTruncations'
import { useCostSummary } from '../api/useCostSummary'
import { useSystemIntegrity } from '../api/useSystemIntegrity'
import { useRateLimits } from '../api/useRateLimits'
import StatCard, { StatCardSkeleton } from '../components/StatCard'
import StatusPill from '../components/StatusPill'
import CopyButton from '../components/CopyButton'
import Tabs from '../components/Tabs'
import SectionHeader from '../components/SectionHeader'
import { motion } from 'framer-motion'
import { staggerContainer, fadeUpItem } from '../lib/motion'
import { timeAgo } from '../utils/time'

// ── Tab types ──────────────────────────────────────────────────────────────

type SystemTab = 'agents' | 'rules' | 'skills' | 'memory' | 'plans' | 'cron' | 'chains' | 'policies' | 'pricing' | 'integrity'

const SYSTEM_TABS: { key: SystemTab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { key: 'agents',    label: 'Agents',    icon: Users },
  { key: 'rules',     label: 'Rules',     icon: Shield },
  { key: 'skills',    label: 'Skills',    icon: Zap },
  { key: 'memory',    label: 'Memory',    icon: Brain },
  { key: 'plans',     label: 'Plans',     icon: FileText },
  { key: 'cron',      label: 'Cron',      icon: Clock },
  { key: 'chains',    label: 'Chain Map', icon: GitBranch },
  { key: 'policies',  label: 'Policies',  icon: Shield },
  { key: 'pricing',   label: 'Pricing',   icon: DollarSign },
  { key: 'integrity', label: 'Integrity', icon: ShieldCheck },
]

// ── Agents Tab ─────────────────────────────────────────────────────────────

function AgentDetailInline({ name }: { name: string }) {
  const { data, isLoading } = useAgent(name)
  if (isLoading) return <div className="p-4 text-xs text-[var(--text-muted)]">Loading...</div>
  if (!data) return null
  return (
    <div className="p-4 bg-[var(--bg-tertiary)] rounded-lg text-xs space-y-2">
      <div className="flex items-center gap-3 flex-wrap">
        <span className="font-semibold text-[var(--text-primary)]">{data.name}</span>
        <span className="text-[var(--text-muted)]">{data.model}</span>
        {data.color && (
          <span className="w-3 h-3 rounded-full" style={{ backgroundColor: data.color }} />
        )}
      </div>
      <p className="text-[var(--text-secondary)]">{data.description}</p>
      {data.body && (
        <details className="mt-2">
          <summary className="cursor-pointer text-[var(--accent)] hover:underline">View full definition</summary>
          <pre className="mt-2 p-3 bg-[var(--bg-primary)] rounded text-[10px] overflow-x-auto whitespace-pre-wrap max-h-80">
            {data.body}
          </pre>
        </details>
      )}
    </div>
  )
}

function AgentsTab() {
  const { data: agents, isLoading } = useAgents()
  const [expanded, setExpanded] = useState<string | null>(null)

  if (isLoading) return <div className="p-6 text-[var(--text-muted)]">Loading agents...</div>
  if (!agents || agents.length === 0) return <div className="p-6 text-[var(--text-muted)]">No agents found.</div>

  return (
    <div className="space-y-1">
      {agents.map(agent => (
        <div key={agent.name} className="border border-[var(--border)] rounded-lg overflow-hidden">
          <button
            onClick={() => setExpanded(expanded === agent.name ? null : agent.name)}
            className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-[var(--bg-secondary)] transition-colors"
          >
            {expanded === agent.name
              ? <ChevronDown className="w-4 h-4 text-[var(--text-muted)] shrink-0" />
              : <ChevronRight className="w-4 h-4 text-[var(--text-muted)] shrink-0" />}
            <span className="font-medium text-sm text-[var(--text-primary)]">{agent.name}</span>
            <span className="text-xs text-[var(--text-muted)] ml-auto">{agent.model}</span>
          </button>
          {expanded === agent.name && <AgentDetailInline name={agent.name} />}
        </div>
      ))}
    </div>
  )
}

// ── Rules Tab ──────────────────────────────────────────────────────────────

function RulesTab() {
  const { data: rules, isLoading } = useRules()
  if (isLoading) return <div className="p-6 text-[var(--text-muted)]">Loading rules...</div>
  if (!rules || rules.length === 0) return <div className="p-6 text-[var(--text-muted)]">No rules found.</div>

  return (
    <div className="space-y-2">
      {rules.map(rule => (
        <div key={rule.filename} className="border border-[var(--border)] rounded-lg p-4">
          <div className="flex items-center justify-between">
            <span className="font-mono text-sm text-[var(--text-primary)]">{rule.filename}</span>
            <span className="text-xs text-[var(--text-muted)]">{new Date(rule.modifiedAt).toLocaleDateString()}</span>
          </div>
          {rule.preview && (
            <p className="text-xs text-[var(--text-secondary)] mt-1 line-clamp-2">{rule.preview}</p>
          )}
        </div>
      ))}
    </div>
  )
}

// ── Skills & Commands Tab ──────────────────────────────────────────────────

function SkillsTab() {
  const { data: skills } = useSkills()
  const { data: commands } = useCommands()

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-sm font-semibold text-[var(--text-primary)] mb-3 flex items-center gap-2">
          <Zap className="w-4 h-4 text-[var(--accent)]" aria-hidden="true" />
          Skills ({skills?.length ?? 0})
        </h2>
        <div className="flex flex-wrap gap-1.5">
          {(skills ?? []).map(s => (
            <span
              key={s.name}
              className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-mono font-medium bg-[var(--accent-subtle)] text-[var(--accent)] border border-[var(--accent)]/20"
              title={s.description}
            >
              {s.name}
            </span>
          ))}
        </div>
      </div>
      <div>
        <h2 className="text-sm font-semibold text-[var(--text-primary)] mb-3 flex items-center gap-2">
          <Terminal className="w-4 h-4 text-[var(--accent)]" aria-hidden="true" />
          Commands ({commands?.length ?? 0})
        </h2>
        <div className="flex flex-wrap gap-1.5">
          {(commands ?? []).map(c => (
            <span
              key={c.name}
              className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-mono font-medium bg-[var(--bg-tertiary)] text-[var(--text-secondary)] border border-[var(--border)] hover:border-[var(--accent)]/30 hover:text-[var(--accent)] transition-colors"
            >
              /{c.name}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Memory Tab ─────────────────────────────────────────────────────────────

function MemoryTab() {
  const { data: agentMem, isLoading: loadingAgent } = useAgentMemory()
  const { data: projectMem, isLoading: loadingProject } = useProjectMemory()

  if (loadingAgent || loadingProject) return <div className="p-6 text-[var(--text-muted)]">Loading memory...</div>

  const allMemories = [
    ...(agentMem ?? []).map(m => ({ ...m, source: 'agent' as const })),
    ...(projectMem ?? []).map(m => ({ ...m, source: 'project' as const })),
  ]

  if (allMemories.length === 0) return <div className="p-6 text-[var(--text-muted)]">No memory files found in agent-memory-local/.</div>

  return (
    <div className="space-y-2">
      {allMemories.map((mem, i) => (
        <div key={i} className="border border-[var(--border)] rounded-lg p-4">
          <div className="flex items-center gap-3">
            <Brain className="w-4 h-4 text-[var(--accent)] shrink-0" />
            <span className="font-mono text-sm text-[var(--text-primary)]">{mem.name}</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-[var(--bg-tertiary)] text-[var(--text-muted)]">
              {mem.source}
            </span>
          </div>
          {mem.description && (
            <p className="text-xs text-[var(--text-secondary)] mt-1 ml-7">{mem.description}</p>
          )}
        </div>
      ))}
    </div>
  )
}

// ── Plans Tab ──────────────────────────────────────────────────────────────

function PlanDetailInline({ filename }: { filename: string }) {
  const { data, isLoading } = usePlan(filename)
  if (isLoading) return <div className="p-4 text-xs text-[var(--text-muted)]">Loading...</div>
  if (!data) return null
  return (
    <pre className="p-4 bg-[var(--bg-tertiary)] rounded-lg text-[10px] overflow-x-auto whitespace-pre-wrap max-h-96">
      {data.body}
    </pre>
  )
}

function PlansTab() {
  const { data: plans, isLoading } = usePlans()
  const [expanded, setExpanded] = useState<string | null>(null)

  if (isLoading) return <div className="p-6 text-[var(--text-muted)]">Loading plans...</div>
  if (!plans || plans.length === 0) return <div className="p-6 text-[var(--text-muted)]">No plans found.</div>

  return (
    <div className="space-y-1">
      {plans.map(plan => (
        <div key={plan.filename} className="border border-[var(--border)] rounded-lg overflow-hidden">
          <button
            onClick={() => setExpanded(expanded === plan.filename ? null : plan.filename)}
            className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-[var(--bg-secondary)] transition-colors"
          >
            {expanded === plan.filename
              ? <ChevronDown className="w-4 h-4 text-[var(--text-muted)] shrink-0" />
              : <ChevronRight className="w-4 h-4 text-[var(--text-muted)] shrink-0" />}
            <div className="min-w-0 flex-1">
              <span className="font-medium text-sm text-[var(--text-primary)] block truncate">{plan.title || plan.filename}</span>
              {plan.date && <span className="text-xs text-[var(--text-muted)]">{plan.date}</span>}
            </div>
          </button>
          {expanded === plan.filename && <PlanDetailInline filename={plan.filename} />}
        </div>
      ))}
    </div>
  )
}

// ── Cron Tab ───────────────────────────────────────────────────────────────

function isValidCronSchedule(schedule: string): boolean {
  return schedule.trim().split(/\s+/).length === 5
}

function extractCronCommand(line: string): string {
  const parts = line.trim().split(/\s+/)
  return parts.slice(5).join(' ')
}

function CronTab() {
  const queryClient = useQueryClient()
  const { data, isLoading } = useCastdStatus()
  const { data: control } = useControlStatus()
  const controlEnabled = control?.enabled ?? false

  const [adding, setAdding] = useState(false)
  const [newSchedule, setNewSchedule] = useState('')
  const [newCommand, setNewCommand] = useState('')
  const [deleting, setDeleting] = useState<string | null>(null)
  const [triggering, setTriggering] = useState<string | null>(null)
  const [triggerResult, setTriggerResult] = useState<{ entry: string; ok: boolean; msg: string } | null>(null)

  async function addEntry() {
    if (!newSchedule.trim() || !newCommand.trim()) return
    const res = await controlFetch('/api/castd/cron', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ schedule: newSchedule.trim(), command: newCommand.trim() }),
    })
    if (res.ok) {
      setNewSchedule('')
      setNewCommand('')
      setAdding(false)
      queryClient.invalidateQueries({ queryKey: ['castd', 'status'] })
    }
  }

  async function deleteEntry(entry: string) {
    if (!window.confirm(`Delete cron entry?\n\n${entry}`)) return
    setDeleting(entry)
    try {
      await controlFetch('/api/castd/cron', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entry }),
      })
      queryClient.invalidateQueries({ queryKey: ['castd', 'status'] })
    } finally {
      setDeleting(null)
    }
  }

  async function triggerEntry(entry: string) {
    const command = extractCronCommand(entry)
    setTriggering(entry)
    setTriggerResult(null)
    try {
      const res = await controlFetch('/api/castd/trigger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command }),
      })
      const body = await res.json() as { ok?: boolean; stdout?: string; stderr?: string; error?: string }
      setTriggerResult({
        entry,
        ok: res.ok,
        msg: res.ok ? (body.stdout?.trim() || 'Done') : (body.error ?? `HTTP ${res.status}`),
      })
    } finally {
      setTriggering(null)
    }
  }

  const scheduleValid = isValidCronSchedule(newSchedule)

  if (isLoading) return <div className="p-6 text-[var(--text-muted)]">Loading cron status...</div>

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <StatusPill
          status={data?.running ? 'running' : 'idle'}
          label={data?.running ? `${data.count} cron ${data.count === 1 ? 'entry' : 'entries'} scheduled` : 'No cron entries'}
        />
      </div>

      {data?.error && <p role="alert" className="text-xs text-[var(--error)]">{data.error}</p>}

      {data?.count === 0 && !adding && (
        <p className="text-sm text-[var(--text-muted)]">No CAST cron entries found.</p>
      )}

      {(data?.entries ?? []).length > 0 && (
        <ul className="space-y-2">
          {data!.entries.map((entry, i) => (
            <li
              key={i}
              className="flex items-start gap-2 font-mono text-xs text-[var(--text-secondary)] bg-[var(--bg-tertiary)] rounded-lg px-3 py-2"
            >
              <span className="flex-1 break-all">{entry}</span>
              {controlEnabled && (
                <div className="flex items-center gap-2 shrink-0 ml-2">
                  <button
                    onClick={() => triggerEntry(entry)}
                    disabled={triggering === entry}
                    aria-label={`Run now: ${entry}`}
                    className="inline-flex items-center justify-center p-1.5 min-w-6 min-h-6 rounded text-[var(--text-muted)] hover:text-[var(--accent)] hover:bg-[var(--accent)]/10 transition-colors disabled:opacity-40"
                  >
                    <Play className="w-3 h-3" aria-hidden="true" />
                  </button>
                  <button
                    onClick={() => deleteEntry(entry)}
                    disabled={deleting === entry}
                    aria-label={`Delete cron entry: ${entry}`}
                    className="inline-flex items-center justify-center p-1.5 min-w-6 min-h-6 rounded text-[var(--text-muted)] hover:text-rose-400 hover:bg-rose-400/10 transition-colors disabled:opacity-40"
                  >
                    <Trash2 className="w-3 h-3" aria-hidden="true" />
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {triggerResult && (
        <p
          className={`text-xs font-mono px-2 py-1 rounded ${triggerResult.ok ? 'text-[var(--success)] bg-[var(--success)]/10' : 'text-[var(--error)] bg-[var(--error)]/10'}`}
          role="status"
        >
          {triggerResult.ok ? 'OK' : 'FAIL'} {triggerResult.msg.slice(0, 120)}
        </p>
      )}

      {!controlEnabled && (
        <p className="flex items-center gap-1.5 text-xs text-[var(--text-muted)]">
          <Lock className="w-3 h-3" aria-hidden="true" />
          Read-only — enable the control surface to add, run, or delete cron entries.
        </p>
      )}

      {controlEnabled && (adding ? (
        <div className="space-y-2 pt-2 border-t border-[var(--border)]">
          <div className="flex gap-2">
            <div className="space-y-1 flex-shrink-0 w-44">
              <label htmlFor="cron-schedule" className="block text-xs text-[var(--text-muted)]">Schedule (5 fields)</label>
              <input
                id="cron-schedule"
                type="text"
                value={newSchedule}
                onChange={e => setNewSchedule(e.target.value)}
                placeholder="0 * * * *"
                aria-invalid={Boolean(newSchedule) && !scheduleValid}
                aria-describedby={Boolean(newSchedule) && !scheduleValid ? 'cron-schedule-error' : undefined}
                className={`w-full px-2 py-1.5 rounded-lg text-xs font-mono bg-[var(--bg-tertiary)] border ${scheduleValid || !newSchedule ? 'border-[var(--border)]' : 'border-rose-400'} text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]`}
              />
              {Boolean(newSchedule) && !scheduleValid && (
                <p id="cron-schedule-error" role="alert" className="text-[10px] text-rose-400">
                  Schedule must have 5 space-separated fields.
                </p>
              )}
            </div>
            <div className="space-y-1 flex-1 min-w-0">
              <label htmlFor="cron-command" className="block text-xs text-[var(--text-muted)]">Command</label>
              <input
                id="cron-command"
                type="text"
                value={newCommand}
                onChange={e => setNewCommand(e.target.value)}
                placeholder="cast exec --sweep"
                className="w-full px-2 py-1.5 rounded-lg text-xs font-mono bg-[var(--bg-tertiary)] border border-[var(--border)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]"
              />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={addEntry}
              disabled={!scheduleValid || !newCommand.trim()}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--accent)] text-[var(--primary-foreground)] text-xs font-semibold hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Check className="w-3 h-3" />
              Save
            </button>
            <button
              onClick={() => { setAdding(false); setNewSchedule(''); setNewCommand('') }}
              className="px-3 py-1.5 rounded-lg text-xs text-[var(--text-muted)] hover:text-[var(--text-secondary)] border border-[var(--border)] hover:border-[var(--accent)]/30 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setAdding(true)}
          className="flex items-center gap-1.5 text-xs text-[var(--text-muted)] hover:text-[var(--accent)] transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          Add cron entry
        </button>
      ))}
    </div>
  )
}

// ── Chain Map Tab ─────────────────────────────────────────────────────────

function ChainMapTab() {
  const { data: chainMap, isLoading } = useChainMap()

  if (isLoading) return <div className="p-6 text-[var(--text-muted)]">Loading chain map...</div>
  if (!chainMap || Object.keys(chainMap).length === 0) {
    return <div className="p-6 text-[var(--text-muted)]">No chain map found. Place chain-map.json in ~/.claude/config/.</div>
  }

  const entries = Object.entries(chainMap).sort(([a], [b]) => a.localeCompare(b))

  return (
    <div className="space-y-2">
      <p className="text-xs text-[var(--text-muted)] mb-4">Agent dispatch chain definitions from config/chain-map.json</p>
      <div className="overflow-x-auto">
        <table className="w-full text-sm" aria-label="Registered agents">
          <thead>
            <tr className="border-b border-[var(--border)]">
              <th className="text-left pb-2 text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider pr-6">Agent</th>
              <th className="text-left pb-2 text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">Successors</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border)]">
            {entries.map(([agent, successors]) => (
              <tr key={agent} className="hover:bg-[var(--bg-tertiary)] transition-colors">
                <td className="py-2 pr-6">
                  <span className="text-xs font-mono text-[var(--text-primary)]">{agent}</span>
                </td>
                <td className="py-2">
                  <div className="flex flex-wrap gap-1.5">
                    {Array.isArray(successors) && successors.map((s: string) => (
                      <span
                        key={s}
                        className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-mono bg-[var(--accent-subtle)] text-[var(--accent)] border border-[var(--accent)]/20"
                      >
                        {s}
                      </span>
                    ))}
                    {(!Array.isArray(successors) || successors.length === 0) && (
                      <span className="text-xs text-[var(--text-muted)]">--</span>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── Policies Tab ──────────────────────────────────────────────────────────

function PoliciesTab() {
  const { data: policies, isLoading } = usePolicies()

  if (isLoading) return <div className="p-6 text-[var(--text-muted)]">Loading policies...</div>
  if (!policies || Object.keys(policies).length === 0) {
    return <div className="p-6 text-[var(--text-muted)]">No policies found. Place policies.json in ~/.claude/config/.</div>
  }

  return (
    <div>
      <p className="text-xs text-[var(--text-muted)] mb-4">Policy rules from config/policies.json</p>
      <pre className="p-4 bg-[var(--bg-tertiary)] rounded-lg text-xs overflow-x-auto whitespace-pre-wrap max-h-96 text-[var(--text-secondary)]">
        {JSON.stringify(policies, null, 2)}
      </pre>
    </div>
  )
}

// ── Pricing Tab ───────────────────────────────────────────────────────────

function PricingTab() {
  const { data: pricing, isLoading } = useModelPricing()

  if (isLoading) return <div className="p-6 text-[var(--text-muted)]">Loading pricing...</div>
  if (!pricing || Object.keys(pricing).length === 0) {
    return <div className="p-6 text-[var(--text-muted)]">No pricing data. Place model-pricing.json in ~/.claude/config/.</div>
  }

  // Try to render as a table if it's a Record<model, {input, output}>
  // Support both nested { models: {...} } shape and flat shape; strip metadata keys (_comment, _note, etc.)
  const modelRecord: Record<string, unknown> =
    pricing.models && typeof pricing.models === 'object' && !Array.isArray(pricing.models)
      ? (pricing.models as Record<string, unknown>)
      : Object.fromEntries(Object.entries(pricing).filter(([k]) => !k.startsWith('_')))
  const models = Object.entries(modelRecord)

  return (
    <div>
      <p className="text-xs text-[var(--text-muted)] mb-4">Token pricing from config/model-pricing.json ($/1M tokens)</p>
      <div className="overflow-x-auto">
        <table className="w-full text-sm" aria-label="Model pricing">
          <thead>
            <tr className="border-b border-[var(--border)]">
              <th className="text-left pb-2 text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider pr-6">Model</th>
              <th className="text-right pb-2 text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider pr-6">Input ($/1M)</th>
              <th className="text-right pb-2 text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">Output ($/1M)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border)]">
            {models.map(([model, rates]) => {
              const r = rates as Record<string, number> | number
              const inputRate = typeof r === 'object' ? (r.cost_per_million_input ?? r.input ?? r.input_per_1m ?? '--') : '--'
              const outputRate = typeof r === 'object' ? (r.cost_per_million_output ?? r.output ?? r.output_per_1m ?? '--') : '--'
              return (
                <tr key={model} className="hover:bg-[var(--bg-tertiary)] transition-colors">
                  <td className="py-2 pr-6">
                    <span className="text-xs font-mono text-[var(--text-primary)]">{model}</span>
                  </td>
                  <td className="py-2 pr-6 text-right text-[var(--text-secondary)] tabular-nums">${String(inputRate)}</td>
                  <td className="py-2 text-right text-[var(--accent)] tabular-nums">${String(outputRate)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── Dispatch Panel ─────────────────────────────────────────────────────────

const MODEL_OPTIONS = [
  { value: 'sonnet', label: 'Sonnet 4.6' },
  { value: 'haiku',  label: 'Haiku 4.5' },
  { value: 'opus',   label: 'Opus 4.8' },
  { value: 'fable',  label: 'Fable 5' },
] as const

type DispatchResult =
  | { kind: 'success'; id: string }
  | { kind: 'error'; message: string }

function DispatchAgentPanel() {
  const [agentType, setAgentType] = useState('')
  const [taskText, setTaskText] = useState('')
  const [model, setModel] = useState<'sonnet' | 'haiku' | 'opus' | 'fable'>('sonnet')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<DispatchResult | null>(null)
  const { data: agentsData, isLoading: agentsLoading } = useAgents()
  const agentNames = agentsData ? agentsData.map(a => a.name).sort() : []

  const canSubmit = agentType !== '' && taskText.trim() !== '' && !loading

  async function handleDispatch() {
    if (!canSubmit) return
    setLoading(true)
    setResult(null)
    try {
      const res = await controlFetch('/api/control/dispatch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agentType, prompt: taskText.trim(), model }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: string }
        setResult({ kind: 'error', message: body.error ?? `HTTP ${res.status}` })
      } else {
        const body = await res.json() as { id: string }
        setResult({ kind: 'success', id: body.id })
        setTaskText('')
      }
    } catch (err) {
      setResult({ kind: 'error', message: err instanceof Error ? err.message : 'Network error' })
    } finally {
      setLoading(false)
    }
  }

  const selectBase =
    'w-full rounded-lg border border-[var(--border)] bg-[var(--bg-tertiary,var(--bg-secondary))] text-[var(--text-primary)] text-sm px-3 py-2 focus:outline-none focus:ring-1 focus:ring-[var(--accent)] focus:border-[var(--accent)] transition-colors'

  return (
    <div className="bg-[var(--bg-secondary)] border border-[var(--border)] rounded-xl p-6 space-y-4">
      <div className="flex items-center gap-2">
        <Send className="w-4 h-4 text-[var(--accent)]" />
        <h2 className="text-sm font-semibold">Dispatch Agent</h2>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-4">
        <div className="space-y-1.5">
          <label htmlFor="dispatch-agent" className="block text-xs font-medium text-[var(--text-secondary)]">Agent</label>
          <select id="dispatch-agent" value={agentType} onChange={e => { setAgentType(e.target.value); setResult(null) }} className={selectBase} disabled={agentsLoading}>
            {agentsLoading ? <option value="" disabled>Loading...</option> : <option value="" disabled>Select agent...</option>}
            {agentNames.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>
        <div className="space-y-1.5">
          <label htmlFor="dispatch-model" className="block text-xs font-medium text-[var(--text-secondary)]">Model</label>
          <select id="dispatch-model" value={model} onChange={e => setModel(e.target.value as typeof model)} className={selectBase}>
            {MODEL_OPTIONS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
          </select>
        </div>
      </div>
      <div className="space-y-1.5">
        <label htmlFor="dispatch-task" className="block text-xs font-medium text-[var(--text-secondary)]">Task</label>
        <textarea
          id="dispatch-task"
          value={taskText}
          onChange={e => { setTaskText(e.target.value); setResult(null) }}
          placeholder="Describe the task..."
          rows={3}
          aria-required="true"
          className={`${selectBase} resize-y min-h-[80px]`}
        />
      </div>
      <div className="flex items-center gap-4">
        <button
          onClick={handleDispatch}
          disabled={!canSubmit}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--accent)] text-[var(--primary-foreground)] font-semibold text-sm hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Send className="w-3.5 h-3.5" aria-hidden="true" />
          {loading ? 'Dispatching...' : 'Dispatch'}
        </button>
        {result?.kind === 'success' && <p className="text-xs text-[var(--success)]" role="status">Dispatched: {String(result.id).slice(0, 8)}</p>}
        {result?.kind === 'error' && <p className="text-xs text-[var(--error)]" role="alert">{result.message}</p>}
      </div>
    </div>
  )
}

// ── Control Surface (token entry + gated panels) ────────────────────────────

function ControlTokenField() {
  const [token, setToken] = useState(getControlToken())
  const [saved, setSaved] = useState(false)

  function save() {
    setControlToken(token.trim())
    setSaved(true)
    setTimeout(() => setSaved(false), 1500)
  }

  return (
    <div className="bg-[var(--bg-secondary)] border border-[var(--border)] rounded-xl p-6 space-y-3">
      <div className="flex items-center gap-2">
        <KeyRound className="w-4 h-4 text-[var(--accent)]" />
        <h2 className="text-sm font-semibold">Control Token</h2>
      </div>
      <p className="text-xs text-[var(--text-muted)]">
        The server requires a token for write actions. Paste the value of <code className="text-[var(--text-secondary)]">DASHBOARD_TOKEN</code>; it is stored locally in this browser and sent as <code className="text-[var(--text-secondary)]">X-Dashboard-Token</code>.
      </p>
      <div className="flex items-center gap-2">
        <input
          type="password"
          value={token}
          onChange={e => setToken(e.target.value)}
          placeholder="Paste DASHBOARD_TOKEN"
          aria-label="Dashboard control token"
          autoComplete="off"
          className="flex-1 rounded-lg border border-[var(--border)] bg-[var(--bg-tertiary,var(--bg-primary))] text-[var(--text-primary)] text-sm px-3 py-2 focus:outline-none focus:ring-1 focus:ring-[var(--accent)] focus:border-[var(--accent)]"
        />
        <button
          onClick={save}
          className="px-4 py-2 rounded-lg bg-[var(--accent)] text-[var(--primary-foreground)] font-semibold text-sm hover:opacity-90"
        >
          Save
        </button>
        {saved && <span className="text-xs text-[var(--success)]" role="status">Saved</span>}
      </div>
    </div>
  )
}

function ControlSurface() {
  const { data: control } = useControlStatus()

  if (!control?.enabled) {
    return (
      <div className="mt-8 bg-[var(--bg-secondary)] border border-[var(--border)] rounded-xl p-6 flex items-start gap-3">
        <Lock className="w-4 h-4 text-[var(--text-muted)] mt-0.5 shrink-0" aria-hidden="true" />
        <div className="space-y-1">
          <h2 className="text-sm font-semibold text-[var(--text-secondary)]">Control surface disabled</h2>
          <p className="text-xs text-[var(--text-muted)]">
            The dashboard is read-only. Start the server with <code className="text-[var(--text-secondary)]">CAST_DASHBOARD_CONTROL=1</code> and a <code className="text-[var(--text-secondary)]">DASHBOARD_TOKEN</code> to enable agent dispatch and cron management.
          </p>
        </div>
      </div>
    )
  }

  if (!control.tokenConfigured) {
    return (
      <div className="mt-8 bg-[var(--error)]/5 border border-[var(--error)]/30 rounded-xl p-6 flex items-start gap-3">
        <AlertTriangle className="w-4 h-4 text-[var(--error)] mt-0.5 shrink-0" aria-hidden="true" />
        <div className="space-y-1">
          <h2 className="text-sm font-semibold text-[var(--text-secondary)]">Control enabled, but no token configured</h2>
          <p className="text-xs text-[var(--text-muted)]">
            Write actions are refused until <code className="text-[var(--text-secondary)]">DASHBOARD_TOKEN</code> is set on the server.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="mt-8 space-y-4">
      <ControlTokenField />
      <DispatchAgentPanel />
    </div>
  )
}

// ── Health Signals Section ─────────────────────────────────────────────────

function HealthSignalsSection() {
  const { data: parryData } = useParryGuard()
  const { data: truncData } = useAgentTruncations()

  const parryEvents = (parryData?.events ?? []).slice(0, 10)
  const truncations = (truncData?.truncations ?? []).slice(0, 10)

  function fmtTime(ts: string) {
    return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  }

  return (
    <div className="mt-8 space-y-4">
      <h2 className="text-sm font-semibold text-[var(--text-secondary)] flex items-center gap-2">
        <AlertTriangle className="w-4 h-4 text-yellow-400" />
        Health Signals
      </h2>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Parry Guard Events */}
        <div className="bento-card overflow-hidden">
          <div className="px-4 py-3 border-b border-[var(--border)]">
            <span className="text-xs font-semibold text-[var(--text-primary)]">Parry Guard Events</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs" aria-label="Parry guard events">
              <thead>
                <tr className="border-b border-[var(--border)] bg-[var(--bg-secondary)]">
                  <th className="text-left px-3 py-2 font-medium text-[var(--text-muted)]">Rejected At</th>
                  <th className="text-left px-3 py-2 font-medium text-[var(--text-muted)]">Tool Name</th>
                  <th className="text-left px-3 py-2 font-medium text-[var(--text-muted)]">Input Snippet</th>
                </tr>
              </thead>
              <tbody>
                {parryEvents.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-3 py-4 text-center text-[var(--text-muted)]">No parry guard events</td>
                  </tr>
                ) : parryEvents.map(ev => (
                  <tr key={ev.id} className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--bg-tertiary)] transition-colors">
                    <td className="px-3 py-2 tabular-nums text-[var(--text-muted)] shrink-0">{fmtTime(ev.rejected_at)}</td>
                    <td className="px-3 py-2 text-[var(--accent)]">{ev.tool_name}</td>
                    <td className="px-3 py-2 text-[var(--text-muted)] truncate max-w-[200px]" title={ev.input_snippet ?? undefined} colSpan={2}>{ev.input_snippet ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Agent Truncations */}
        <div className="bento-card overflow-hidden">
          <div className="px-4 py-3 border-b border-[var(--border)]">
            <span className="text-xs font-semibold text-[var(--text-primary)]">Agent Truncations</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs" aria-label="Agent truncations">
              <thead>
                <tr className="border-b border-[var(--border)] bg-[var(--bg-secondary)]">
                  <th className="text-left px-3 py-2 font-medium text-[var(--text-muted)]">Time</th>
                  <th className="text-left px-3 py-2 font-medium text-[var(--text-muted)]">Agent Type</th>
                  <th className="text-left px-3 py-2 font-medium text-[var(--text-muted)]">Chars</th>
                  <th className="text-left px-3 py-2 font-medium text-[var(--text-muted)]">Last Line</th>
                </tr>
              </thead>
              <tbody>
                {truncations.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-3 py-4 text-center text-[var(--text-muted)]">No agent truncations</td>
                  </tr>
                ) : truncations.map(t => (
                  <tr key={t.id} className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--bg-tertiary)] transition-colors">
                    <td className="px-3 py-2 tabular-nums text-[var(--text-muted)]">{fmtTime(t.timestamp)}</td>
                    <td className="px-3 py-2 text-[var(--text-primary)]">{t.agent_type}</td>
                    <td className="px-3 py-2 text-[var(--text-secondary)]">{t.char_count ?? '—'}</td>
                    <td className="px-3 py-2 text-[var(--text-muted)] truncate max-w-[140px]" title={t.last_line ?? undefined}>{t.last_line ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Cost Summary Card ─────────────────────────────────────────────────────
// TODO: cost-summary (above) is the preferred source; remove this section in a future pass

function fmtCost(usd: number): string {
  return `$${usd.toFixed(2)}`
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M'
  if (n >= 1_000) return (n / 1_000).toFixed(0) + 'K'
  return String(n)
}

function CostSummaryCard() {
  const { data, isLoading, isError } = useCostSummary(30, 5)

  if (isLoading) {
    return (
      <div className="bento-card p-6 animate-pulse">
        <div className="h-4 w-32 bg-[var(--bg-tertiary)] rounded mb-4" />
        <div className="h-8 w-24 bg-[var(--bg-tertiary)] rounded mb-6" />
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-4 bg-[var(--bg-tertiary)] rounded" />
          ))}
        </div>
      </div>
    )
  }

  if (isError || !data) {
    return (
      <div className="bento-card p-6">
        <div className="flex items-center gap-2 mb-2">
          <DollarSign className="w-4 h-4 text-[var(--accent)]" />
          <span className="text-sm font-semibold text-[var(--text-primary)]">Cost Summary (30d)</span>
        </div>
        <p className="text-xs text-[var(--text-muted)]">No cost data available.</p>
      </div>
    )
  }

  const { totals, byModel, topSessions } = data

  return (
    <div className="bento-card p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <DollarSign className="w-4 h-4 text-[var(--accent)]" />
          <h2 className="text-sm font-semibold text-[var(--text-primary)]">Cost Summary (30d)</h2>
        </div>
        <span className="text-2xl font-bold text-[var(--accent)] tabular-nums">
          {fmtCost(totals.costUsd)}
        </span>
      </div>

      {/* Model breakdown table */}
      <div>
        <h3 className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-2">By Model</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-xs" aria-label="Cost by model">
            <thead>
              <tr className="border-b border-[var(--border)]">
                <th className="text-left pb-2 font-medium text-[var(--text-muted)] pr-4">Model</th>
                <th className="text-right pb-2 font-medium text-[var(--text-muted)] pr-4">Input Tokens</th>
                <th className="text-right pb-2 font-medium text-[var(--text-muted)] pr-4">Output Tokens</th>
                <th className="text-right pb-2 font-medium text-[var(--text-muted)]">Cost</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {byModel.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-3 text-center text-[var(--text-muted)]">No model data</td>
                </tr>
              ) : byModel.map(entry => (
                <tr key={entry.model} className="hover:bg-[var(--bg-tertiary)] transition-colors">
                  <td className="py-2 pr-4 font-mono text-[var(--text-primary)] truncate max-w-[160px]" title={entry.model}>
                    {entry.model}
                  </td>
                  <td className="py-2 pr-4 text-right tabular-nums text-[var(--text-secondary)]">{formatTokens(entry.inputTokens)}</td>
                  <td className="py-2 pr-4 text-right tabular-nums text-[var(--text-secondary)]">{formatTokens(entry.outputTokens)}</td>
                  <td className="py-2 text-right tabular-nums text-[var(--accent)]">{fmtCost(entry.costUsd)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Top 5 sessions */}
      <div>
        <h3 className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-2">Top Sessions</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-xs" aria-label="Top sessions by cost">
            <thead>
              <tr className="border-b border-[var(--border)]">
                <th className="text-left pb-2 font-medium text-[var(--text-muted)] pr-4">Session ID</th>
                <th className="text-right pb-2 font-medium text-[var(--text-muted)] pr-4">Cost</th>
                <th className="text-right pb-2 font-medium text-[var(--text-muted)]">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {topSessions.length === 0 ? (
                <tr>
                  <td colSpan={3} className="py-3 text-center text-[var(--text-muted)]">No session data</td>
                </tr>
              ) : topSessions.slice(0, 5).map(session => (
                <tr key={session.id} className="hover:bg-[var(--bg-tertiary)] transition-colors">
                  <td className="py-2 pr-4 font-mono text-[var(--text-primary)]">
                    {session.id.slice(0, 12)}
                  </td>
                  <td className="py-2 pr-4 text-right tabular-nums text-[var(--accent)]">
                    {fmtCost(session.costUsd)}
                  </td>
                  <td className="py-2 text-right tabular-nums text-[var(--text-muted)]">
                    {session.startedAt ? new Date(session.startedAt).toLocaleDateString() : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

// ── Integrity Tab (Litestream + snapshots + rate limits) ────────────────────

function RateGauge({ label, used, limit }: { label: string; used: number | null; limit: number | null }) {
  const pct = used != null && limit ? Math.min(100, Math.round((used / limit) * 100)) : null
  const tone = pct == null
    ? 'bg-[var(--text-muted)]'
    : pct >= 90 ? 'bg-rose-400' : pct >= 70 ? 'bg-amber-400' : 'bg-[var(--accent)]'
  return (
    <div className="bento-card p-4 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-[var(--text-primary)]">{label}</span>
        <span className="text-xs font-mono tabular-nums text-[var(--text-muted)]">
          {used?.toLocaleString() ?? '—'} / {limit?.toLocaleString() ?? '—'}
        </span>
      </div>
      <div className="h-2 rounded-full bg-[var(--bg-tertiary)] overflow-hidden">
        <div className={`h-full ${tone} transition-all`} style={{ width: `${pct ?? 0}%` }} />
      </div>
      {pct != null && <span className="text-xs text-[var(--text-muted)]">{pct}% used</span>}
    </div>
  )
}

function IntegrityTab() {
  const { data: integrity, isLoading } = useSystemIntegrity()
  const { data: rl } = useRateLimits()
  const latest = rl?.latest ?? null
  const ls = integrity?.litestream
  const snap = integrity?.snapshots

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-3">Data Integrity (Pillar 2)</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="bento-card p-4 space-y-2">
            <div className="flex items-center gap-2">
              <HardDrive className="w-4 h-4 text-[var(--accent)]" aria-hidden="true" />
              <span className="text-sm font-semibold text-[var(--text-primary)]">Litestream replication</span>
            </div>
            {isLoading ? (
              <div className="h-5 w-24 rounded bg-[var(--bg-secondary)] animate-pulse" />
            ) : (
              <div className="flex items-center gap-3">
                <StatusPill
                  status={ls?.active ? 'active' : 'inactive'}
                  tone={ls?.active ? 'success' : 'danger'}
                  pulse={false}
                  label={ls?.active ? 'Replicating' : 'Inactive'}
                />
                {ls?.seq != null && <span className="text-xs font-mono text-[var(--text-muted)]">seq {ls.seq}</span>}
              </div>
            )}
            <p className="text-xs text-[var(--text-muted)]">Continuous replication outside the ~/.claude blast radius.</p>
          </div>

          <div className="bento-card p-4 space-y-2">
            <div className="flex items-center gap-2">
              <Database className="w-4 h-4 text-[var(--accent)]" aria-hidden="true" />
              <span className="text-sm font-semibold text-[var(--text-primary)]">Dated snapshots</span>
            </div>
            {isLoading ? (
              <div className="h-5 w-24 rounded bg-[var(--bg-secondary)] animate-pulse" />
            ) : snap && snap.count > 0 ? (
              <div className="space-y-0.5">
                <div className="text-sm text-[var(--text-primary)]">
                  <span className="font-mono tabular-nums">{snap.count}</span> snapshots
                </div>
                <div className="text-xs text-[var(--text-muted)]">last {snap.lastBackupAt ? timeAgo(snap.lastBackupAt) : '—'}</div>
              </div>
            ) : (
              <p className="text-xs text-[var(--text-muted)]">No snapshots found.</p>
            )}
          </div>
        </div>
      </div>

      <div>
        <h2 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-3">Anthropic Rate Limits</h2>
        {latest ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <RateGauge label="Tokens / min" used={latest.tpm_used} limit={latest.tpm_limit} />
            <RateGauge label="Requests / min" used={latest.rpm_used} limit={latest.rpm_limit} />
          </div>
        ) : (
          <div className="bento-card p-4 flex items-center gap-2">
            <Gauge className="w-4 h-4 text-[var(--text-muted)]" aria-hidden="true" />
            <span className="text-sm text-[var(--text-muted)]">No rate-limit snapshots yet — populated by <code className="font-mono">cast-rate-check.py</code>.</span>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Main SystemView ────────────────────────────────────────────────────────

export default function SystemView() {
  const [activeTab, setActiveTab] = useState<SystemTab>('agents')
  const { data: health, isLoading } = useSystemHealth()

  const statCards = health
    ? [
        { label: 'Agents', value: health.agentCount, icon: <Users className="w-5 h-5" /> },
        { label: 'Commands', value: health.commandCount, icon: <Terminal className="w-5 h-5" /> },
        { label: 'Skills', value: health.skillCount, icon: <Zap className="w-5 h-5" /> },
        { label: 'Sessions', value: health.sessionCount, icon: <History className="w-5 h-5" />, to: '/sessions' },
      ]
    : []

  return (
    <div>
      <SectionHeader
        as="h1"
        kicker="control plane"
        title="System"
        icon={<Server className="w-5 h-5" />}
        description="CAST internals — agents, rules, skills, memory, DB, and control surface."
      />

      {/* Stat cards */}
      {isLoading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {Array.from({ length: 4 }).map((_, i) => <StatCardSkeleton key={i} />)}
        </div>
      ) : (
        <motion.div
          className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6"
          variants={staggerContainer}
          initial="hidden"
          animate="show"
        >
          {statCards.map(stat => (
            <motion.div key={stat.label} variants={fadeUpItem} className="h-full">
              <StatCard {...stat} />
            </motion.div>
          ))}
        </motion.div>
      )}

      {/* Cost Summary card — preferred cost source (see TODO in CostSummaryCard component) */}
      <div className="mb-6">
        <CostSummaryCard />
      </div>

      {/* Tab bar */}
      <Tabs
        tabs={SYSTEM_TABS.map(t => ({ id: t.key, label: t.label, icon: t.icon }))}
        activeTab={activeTab}
        onChange={(id) => setActiveTab(id as SystemTab)}
        ariaLabel="System sections"
        idBase="system"
        className="mb-6"
        panelClassName="min-h-[400px]"
      >
        {activeTab === 'agents' && <AgentsTab />}
        {activeTab === 'rules' && <RulesTab />}
        {activeTab === 'skills' && <SkillsTab />}
        {activeTab === 'memory' && <MemoryTab />}
        {activeTab === 'plans' && <PlansTab />}
        {activeTab === 'cron' && <CronTab />}
        {activeTab === 'chains' && <ChainMapTab />}
        {activeTab === 'policies' && <PoliciesTab />}
        {activeTab === 'pricing' && <PricingTab />}
        {activeTab === 'integrity' && <IntegrityTab />}
      </Tabs>

      {/* Health Signals — parry guard + agent truncations */}
      <HealthSignalsSection />

      {/* Control surface — gated behind CAST_DASHBOARD_CONTROL */}
      <ControlSurface />
    </div>
  )
}
