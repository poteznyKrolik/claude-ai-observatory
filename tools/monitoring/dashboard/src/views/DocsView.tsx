import { Terminal, Bot, Blocks, Command, Hash } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { useCommands } from '../api/useKnowledge'

// ── Data ───────────────────────────────────────────────────────────────────
// Fallback data is the authoritative hardcoded snapshot. Verified against disk
// 2026-07-02: ls ~/.claude/commands/, ls ~/.claude/agents/, grep model ~/.claude/agents/*.md

const SLASH_COMMANDS = [
  { command: '/agents',      description: 'List all installed CAST agents',                   agent: '—' },
  { command: '/bash',        description: 'Shell scripting and BATS tests',                   agent: 'bash-specialist' },
  { command: '/cast',        description: 'CAST diagnostic and manual dispatch',              agent: '—' },
  { command: '/ci-watch',    description: 'Watch CI checks and auto-merge on green',          agent: '—' },
  { command: '/commit',      description: 'Create semantic git commit',                       agent: 'commit' },
  { command: '/debug',       description: 'Investigate and fix issues',                       agent: 'debugger' },
  { command: '/devops',      description: 'CI/CD, Docker, infrastructure',                   agent: 'devops' },
  { command: '/docs',        description: 'Update documentation',                             agent: 'docs' },
  { command: '/doctor',      description: 'System health check',                              agent: '—' },
  { command: '/feature',     description: 'Build features via CAST workflow engine',          agent: '—' },
  { command: '/laconic',     description: 'Toggle terse-output mode',                        agent: '—' },
  { command: '/merge',       description: 'Git merges, rebases, conflicts',                  agent: 'merge' },
  { command: '/morning',     description: 'Generate morning briefing',                       agent: 'morning-briefing' },
  { command: '/orchestrate', description: 'Execute a CAST plan (Agent Dispatch Manifest)',   agent: '—' },
  { command: '/plan',        description: 'Create implementation plan',                      agent: 'planner' },
  { command: '/push',        description: 'Push to remote repository',                       agent: 'push' },
  { command: '/research',    description: 'Technical research',                              agent: 'researcher' },
  { command: '/review',      description: 'Code review (size-adaptive)',                     agent: 'code-reviewer' },
  { command: '/roadmap',     description: 'Resume CAST backlog',                             agent: 'planner' },
  { command: '/secure',      description: 'Security review (OWASP)',                         agent: 'security' },
  { command: '/test',        description: 'Write tests',                                     agent: 'test-writer' },
]

// Fallback agents roster — verified against disk 2026-07-02:
// ls ~/.claude/agents/ | wc -l → 23; grep model ~/.claude/agents/*.md
const AGENTS = [
  { name: 'api-contract',      model: 'haiku',  description: 'API contract guardian — detects breaking changes in REST endpoints' },
  { name: 'bash-specialist',   model: 'sonnet', description: 'Shell scripts, BATS tests, hook work' },
  { name: 'code-reviewer',     model: 'haiku',  description: 'Code quality review, conventions' },
  { name: 'code-writer',       model: 'sonnet', description: 'Code changes and implementations' },
  { name: 'commit',            model: 'haiku',  description: 'Semantic git commit messages' },
  { name: 'debugger',          model: 'sonnet', description: 'Issue investigation and fixes' },
  { name: 'dep-auditor',       model: 'haiku',  description: 'Dependency audit and CVE scanning' },
  { name: 'devops',            model: 'haiku',  description: 'CI/CD, Docker, Terraform' },
  { name: 'docs',              model: 'haiku',  description: 'Documentation generation' },
  { name: 'eval-writer',       model: 'sonnet', description: 'Eval and benchmark fixture authoring' },
  { name: 'frontend-qa',       model: 'haiku',  description: 'React/TypeScript and a11y review' },
  { name: 'merge',             model: 'haiku',  description: 'Git merges, rebases, conflicts' },
  { name: 'migration-reviewer',model: 'opus',   description: 'Database schema change review' },
  { name: 'morning-briefing',  model: 'haiku',  description: 'Orchestrate morning briefing' },
  { name: 'perf-sentinel',     model: 'sonnet', description: 'Performance regression detection' },
  { name: 'planner',           model: 'sonnet', description: 'Strategic planning and task breakdowns' },
  { name: 'pr-reviewer',       model: 'sonnet', description: 'Whole-PR review at PR-open time' },
  { name: 'push',              model: 'haiku',  description: 'Git push (blocks main/master force-push)' },
  { name: 'release-notes',     model: 'haiku',  description: 'Release changelog generation' },
  { name: 'researcher',        model: 'sonnet', description: 'Technical research and evaluation' },
  { name: 'security',          model: 'sonnet', description: 'Security review (OWASP, injection, XSS)' },
  { name: 'test-runner',       model: 'haiku',  description: 'Run test suites, gate on exit codes' },
  { name: 'test-writer',       model: 'haiku',  description: 'Write tests for existing code' },
]

// Curated cast CLI subcommands — verified from ~/.local/bin/cast 2026-07-02
// Full list in script header: status, exec, parallel, memory, budget, agents,
// hooks, doctor, upgrade-check, tidy, clean, dash, install-completions, plan-doctor
// + additional verified: dispatch, cost, predict, eval, ask, feature, mcp, ledger,
//   provenance, verify-chain, incidents, routines
const CAST_CLI = [
  { subcommand: 'status',       description: 'Agent runs, hook status, session summary' },
  { subcommand: 'dispatch',     description: 'Run an agent (local or managed cloud)' },
  { subcommand: 'exec',         description: 'Execute CAST script or dispatch task' },
  { subcommand: 'ask',          description: 'Ask Claude a question inline' },
  { subcommand: 'memory',       description: 'Agent memory: search, list, forget, export' },
  { subcommand: 'budget',       description: 'Token spend and cost tracking' },
  { subcommand: 'cost',         description: 'Detailed cost breakdown by model / session' },
  { subcommand: 'predict',      description: 'Pre-flight cost estimate for a task' },
  { subcommand: 'agents',       description: 'List agents and show runtime dispatch data' },
  { subcommand: 'hooks',        description: 'Manage and inspect system hooks' },
  { subcommand: 'doctor',       description: 'System diagnostics and health check' },
  { subcommand: 'eval',         description: 'Run or record eval cases for agent prompts' },
  { subcommand: 'feature',      description: 'Build a feature via the CAST app-build engine' },
  { subcommand: 'mcp',          description: 'MCP server management' },
  { subcommand: 'routines',     description: 'Manage scheduled routine tasks' },
  { subcommand: 'ledger',       description: 'Commit provenance ledger' },
  { subcommand: 'provenance',   description: 'Verify commit authorship chain' },
  { subcommand: 'verify-chain', description: 'Validate CAST hook chain integrity' },
  { subcommand: 'incidents',    description: 'View and triage system incidents' },
  { subcommand: 'tidy',         description: 'Cleanup stale runs, truncate logs' },
]

const HOOK_DIRECTIVES = [
  { directive: '[CAST-DISPATCH]',       description: 'Dispatch named agent, don\'t handle inline' },
  { directive: '[CAST-REVIEW]',         description: 'Auto-dispatch code-reviewer after changes' },
  { directive: '[CAST-CHAIN]',          description: 'Dispatch listed agents sequentially' },
  { directive: '[CAST-DISPATCH-GROUP]', description: 'Auto-generate ADM and execute with orchestrator' },
]

// ── Sub-components ─────────────────────────────────────────────────────────

function ModelBadge({ model }: { model: string }) {
  const colorClass =
    model === 'haiku'  ? 'bg-amber-500/15 text-amber-400 border border-amber-500/20'  :
    model === 'opus'   ? 'bg-purple-500/15 text-purple-400 border border-purple-500/20' :
                         'bg-blue-500/15 text-blue-400 border border-blue-500/20'
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${colorClass}`}>
      {model}
    </span>
  )
}

function InvocableBadge({ invocable }: { invocable: boolean }) {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${
        invocable
          ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20'
          : 'bg-zinc-500/15 text-[var(--text-muted)] border border-zinc-500/20'
      }`}
    >
      {invocable ? 'Yes' : 'No'}
    </span>
  )
}

/** Shown in any section that is rendering hardcoded fallback data because the API failed. */
function FallbackBadge() {
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] text-[var(--text-muted)] bg-zinc-500/10 border border-zinc-500/20">
      static snapshot — API unreachable
    </span>
  )
}

function SectionHeader({
  icon: Icon,
  title,
  count,
}: {
  icon: React.ComponentType<{ className?: string; 'aria-hidden'?: boolean | 'true' | 'false' }>
  title: string
  count?: number
}) {
  return (
    <div className="flex items-center gap-2.5 mb-4">
      <Icon className="w-4 h-4 text-[var(--accent)]" aria-hidden="true" />
      <h2 className="text-base font-semibold text-[var(--text-primary)]">{title}</h2>
      {count !== undefined && (
        <span className="text-xs text-[var(--text-muted)] tabular-nums">({count})</span>
      )}
    </div>
  )
}

// ── Sections ───────────────────────────────────────────────────────────────

function SlashCommandsSection() {
  const { data: liveCommands, isError } = useCommands()

  // Map live API data to display format.
  // The commands parser emits preview = "Routes to: <agent>" when an agent is
  // detected, or the first 100 chars of file content otherwise.
  const commands = (!isError && liveCommands && liveCommands.length > 0)
    ? liveCommands.map(cmd => {
        const routesMatch = cmd.preview.match(/^Routes to: (.+)$/)
        return {
          command: `/${cmd.name}`,
          description: routesMatch
            ? `Dispatches ${routesMatch[1]} agent`
            : cmd.preview.slice(0, 80),
          agent: routesMatch ? routesMatch[1] : '—',
        }
      })
    : SLASH_COMMANDS

  return (
    <div className="bento-card p-6">
      <div className="flex items-center justify-between mb-4">
        <SectionHeader icon={Terminal} title="Slash Commands" count={commands.length} />
        {isError && (
          <div>
            <FallbackBadge />
          </div>
        )}
        {!isError && liveCommands && liveCommands.length > 0 && (
          <p className="text-[10px] text-[var(--text-muted)]">Live from /api/commands</p>
        )}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm" aria-label="Slash commands">
          <thead>
            <tr className="border-b border-[var(--border)]">
              <th scope="col" className="text-left pb-2 text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider pr-6">Command</th>
              <th scope="col" className="text-left pb-2 text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider pr-6">Description</th>
              <th scope="col" className="text-left pb-2 text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">Agent</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border)]">
            {commands.map(row => (
              <tr key={row.command} className="hover:bg-[var(--bg-tertiary)] transition-colors">
                <td className="py-2 pr-6">
                  <span className="text-xs font-mono text-[var(--accent)]">{row.command}</span>
                </td>
                <td className="py-2 pr-6">
                  <span className="text-sm text-[var(--text-secondary)]">{row.description}</span>
                </td>
                <td className="py-2">
                  {row.agent === '—' ? (
                    <span className="text-xs text-[var(--text-muted)]">—</span>
                  ) : (
                    <span className="text-xs font-mono text-[var(--text-secondary)]">{row.agent}</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function AgentsSection() {
  const { data: liveAgents, isError: agentsError } = useQuery<Array<{ name: string; model: string; description: string }>>({
    queryKey: ['docs', 'agents'],
    queryFn: async () => {
      const res = await fetch('/api/agents')
      if (!res.ok) throw new Error('Failed')
      return res.json()
    },
    staleTime: 300_000,
  })

  const usingFallback = agentsError || !liveAgents || liveAgents.length === 0
  const agents = (!agentsError && liveAgents && liveAgents.length > 0) ? liveAgents : AGENTS

  return (
    <div className="bento-card p-6">
      <div className="flex items-center justify-between mb-4">
        <SectionHeader icon={Bot} title="CAST Agents" count={agents.length} />
        {agentsError && (
          <div>
            <FallbackBadge />
          </div>
        )}
        {!usingFallback && (
          <p className="text-[10px] text-[var(--text-muted)]">Live from /api/agents</p>
        )}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm" aria-label="CAST agents">
          <thead>
            <tr className="border-b border-[var(--border)]">
              <th scope="col" className="text-left pb-2 text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider pr-6">Agent</th>
              <th scope="col" className="text-left pb-2 text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider pr-6">Model</th>
              <th scope="col" className="text-left pb-2 text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">Description</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border)]">
            {agents.map(row => (
              <tr key={row.name} className="hover:bg-[var(--bg-tertiary)] transition-colors">
                <td className="py-2 pr-6">
                  <span className="text-xs font-mono text-[var(--text-primary)]">{row.name}</span>
                </td>
                <td className="py-2 pr-6">
                  <ModelBadge model={row.model} />
                </td>
                <td className="py-2">
                  <span className="text-sm text-[var(--text-secondary)]">{row.description}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function SkillsSection() {
  const { data: liveSkills, isError: skillsError } = useQuery<Array<{ name: string; description: string; invocable: boolean }>>({
    queryKey: ['docs', 'skills'],
    queryFn: async () => {
      const res = await fetch('/api/skills')
      if (!res.ok) throw new Error('Failed')
      return res.json()
    },
    staleTime: 300_000,
  })

  // Use live skills directly — invocable field is now emitted by the parser.
  // No hardcoded SKILLS map needed; the API is the single source of truth.
  const skills = (!skillsError && liveSkills && liveSkills.length > 0)
    ? liveSkills
    : []

  return (
    <div className="bento-card p-6">
      <div className="flex items-center justify-between mb-4">
        <SectionHeader icon={Blocks} title="Skills" count={skills.length} />
        {skillsError && (
          <div>
            <FallbackBadge />
          </div>
        )}
        {!skillsError && liveSkills && liveSkills.length > 0 && (
          <p className="text-[10px] text-[var(--text-muted)]">Live from /api/skills</p>
        )}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm" aria-label="Skills">
          <thead>
            <tr className="border-b border-[var(--border)]">
              <th scope="col" className="text-left pb-2 text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider pr-6">Skill</th>
              <th scope="col" className="text-left pb-2 text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider pr-6">User-Invocable</th>
              <th scope="col" className="text-left pb-2 text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">Description</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border)]">
            {skills.map(row => (
              <tr key={row.name} className="hover:bg-[var(--bg-tertiary)] transition-colors">
                <td className="py-2 pr-6">
                  <span className="text-xs font-mono text-[var(--text-primary)]">{row.name}</span>
                </td>
                <td className="py-2 pr-6">
                  <InvocableBadge invocable={row.invocable} />
                </td>
                <td className="py-2">
                  <span className="text-sm text-[var(--text-secondary)]">{row.description}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {skills.length === 0 && skillsError && (
          <p className="text-sm text-[var(--text-muted)] text-center py-4">
            Skills unavailable — server unreachable
          </p>
        )}
      </div>
    </div>
  )
}

function CastCliSection() {
  return (
    <div className="bento-card p-6">
      <SectionHeader icon={Command} title="CAST CLI" />
      <p className="text-xs text-[var(--text-muted)] mb-4 font-mono">
        cast &lt;subcommand&gt; &nbsp;
        <span className="text-[10px] normal-case not-italic">— as of v9.0.0</span>
      </p>
      <div className="overflow-x-auto">
        <table className="w-full text-sm" aria-label="CAST CLI subcommands">
          <thead>
            <tr className="border-b border-[var(--border)]">
              <th scope="col" className="text-left pb-2 text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider pr-6">Subcommand</th>
              <th scope="col" className="text-left pb-2 text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">Description</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border)]">
            {CAST_CLI.map(row => (
              <tr key={row.subcommand} className="hover:bg-[var(--bg-tertiary)] transition-colors">
                <td className="py-2 pr-6">
                  <span className="text-xs font-mono text-[var(--accent)]">{row.subcommand}</span>
                </td>
                <td className="py-2">
                  <span className="text-sm text-[var(--text-secondary)]">{row.description}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function HookDirectivesSection() {
  return (
    <div className="bento-card p-6">
      <SectionHeader icon={Hash} title="Hook Directives" count={HOOK_DIRECTIVES.length} />
      <div className="overflow-x-auto">
        <table className="w-full text-sm" aria-label="Hook directives">
          <thead>
            <tr className="border-b border-[var(--border)]">
              <th scope="col" className="text-left pb-2 text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider pr-6">Directive</th>
              <th scope="col" className="text-left pb-2 text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">Description</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border)]">
            {HOOK_DIRECTIVES.map(row => (
              <tr key={row.directive} className="hover:bg-[var(--bg-tertiary)] transition-colors">
                <td className="py-2 pr-6">
                  <span className="text-xs font-mono text-[var(--accent)]">{row.directive}</span>
                </td>
                <td className="py-2">
                  <span className="text-sm text-[var(--text-secondary)]">{row.description}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── Main View ──────────────────────────────────────────────────────────────

export default function DocsView() {
  return (
    <div>
      <h1 className="text-2xl font-bold mb-1">Docs</h1>
      <p className="text-sm text-[var(--text-muted)] mb-6">CAST reference: commands, agents, skills, and directives.</p>

      <div className="space-y-6">
        <SlashCommandsSection />
        <AgentsSection />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <SkillsSection />
          <CastCliSection />
        </div>

        <HookDirectivesSection />
      </div>
    </div>
  )
}
