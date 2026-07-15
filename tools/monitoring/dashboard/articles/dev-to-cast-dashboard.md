---
title: "I Built an Observability Dashboard for 17 AI Agents — With Those Same Agents"
published: false
description: "How I monitor a multi-agent Claude Code system with a local-first React + SQLite dashboard, and the recursive loop of building it with the agents it observes."
tags: ai, webdev, react, opensource
cover_image: 
---

## The Problem: 17 AI Agents and Zero Visibility

I run a system called **CAST** (Claude Agent Specialist Team) — a framework of 17 specialized AI agents built on top of [Claude Code](https://docs.anthropic.com/en/docs/claude-code). These agents handle everything from writing code to reviewing PRs to running security audits. They dispatch each other in chains: a planner spawns a code-writer, which triggers a code-reviewer, which chains to a commit agent, which hands off to push.

It works. But it's a black box.

When 5 agents are running in parallel across 3 worktrees, I had no idea:
- What's actually running right now?
- How much is this costing?
- Did that code-reviewer pass or fail?
- Which agent is stuck?

So I built a dashboard. And here's the recursive part — **the dashboard was built by CAST agents, and every agent dispatch showed up in the dashboard they were building.**

---

## CAST in 60 Seconds

Before we get into the dashboard, here's how CAST works:

**17 agents across 2 model tiers:**
- **Sonnet** (complex tasks): code-writer, debugger, planner, security, researcher, orchestrator, and 7 more
- **Haiku** (lightweight): code-reviewer, commit, push, test-runner, frontend-qa

**Hook-driven dispatch:**
Claude Code has a hooks system — shell scripts that fire on events like `PostToolUse` or `SubagentStart`. CAST hooks write every agent spawn, completion, and status change to a local SQLite database (`cast.db`).

**The data model:**
```
cast.db
├── sessions        — Claude Code session metadata
├── agent_runs      — Every agent dispatch: who, when, status, cost
├── routing_events  — Dispatch decisions and routing
└── agent_memories  — Persistent agent knowledge
```

Plus JSONL session logs that Claude Code writes to `~/.claude/projects/` — these are the ground truth for token counts.

---

## The Dashboard: 4 Pages, Zero Cloud

The dashboard is a local-first React app that reads directly from your filesystem. No accounts, no cloud sync, no external services.

### Architecture

```
~/.claude/cast.db  ──┐
~/.claude/projects/  ─┤──→  Express 5 API  ──→  React 19 SPA
~/.claude/agents/    ─┤     (localhost:3001)    (localhost:5173)
~/.claude/settings/  ─┘
```

**Stack:** React 19, Vite 6, TypeScript, Tailwind CSS v4, TanStack Query v5, Recharts, Express 5, better-sqlite3, SSE for real-time updates.

### The 4 Pages

**Dashboard** (`/`) — The "what's happening now" view:
- Active agents with live status
- Today's stats: runs, cost, tokens
- 7-day cost sparkline
- System health (agent count, hooks, skills)

**Sessions** (`/sessions`) — Every Claude Code session with:
- Token breakdown (input, output, cache creation, cache read)
- Agent runs within each session
- Duration, model, cost
- Full message timeline drill-down

**Analytics** (`/analytics`) — The numbers view:
- 30-day token spend chart
- Agent scorecard (runs, success rate, avg cost per agent)
- Model tier breakdown
- Delegation savings: "What would this cost if everything ran on Sonnet?"

**System** (`/system`) — A tabbed browser for your entire CAST installation:
- Agents (read/write), Rules, Skills & Commands
- Hooks (definitions + health checks)
- Agent memory (filesystem-backed)
- Plans, DB Explorer, Cron triggers

Plus a **Docs** page with a complete reference of all 17 slash commands, 17 agents, 8 skills, and the CAST CLI.

---

## The Interesting Engineering Problems

### 1. Dual Data Pipeline

No single data source has the complete picture:

- **JSONL session logs** have accurate token counts (including cache tokens) but no agent-level attribution
- **cast.db** has agent-level data (who ran, what status, what cost) but estimates tokens from subagent JSONL files

The solution: merge both sources. The token spend pipeline reads JSONL for totals. The agent runs pipeline reads cast.db for attribution. When they overlap, JSONL wins — it's the ground truth from Claude Code itself.

```typescript
// tokenSpend.ts reads JSONL directly
const costMap = getSessionCostMap()  // Map<sessionId, cost>

// agentRuns.ts reads cast.db
const runs = db.prepare(`SELECT ... FROM agent_runs`).all()

// When displaying session cost, prefer JSONL over DB
totalCost: costMap.get(s.session_id) ?? s.total_cost
```

### 2. SSE Push Instead of Polling

The dashboard doesn't poll on timers. A `castDbWatcher` polls `cast.db` every 3 seconds server-side and pushes changes over Server-Sent Events:

```typescript
// Server: watch for new rows
const newRuns = db.prepare(
  `SELECT * FROM agent_runs WHERE rowid > ?`
).all(highWaterMark)

if (newRuns.length > 0) {
  broadcast('db_change_agent_run', newRuns)
}
```

```typescript
// Client: invalidate TanStack Query cache on events
const eventSource = new EventSource('/api/events')
eventSource.onmessage = (e) => {
  const { type } = JSON.parse(e.data)
  if (type === 'db_change_agent_run') {
    queryClient.invalidateQueries({ queryKey: ['agent-runs'] })
  }
}
```

This means the dashboard updates within 3 seconds of any agent activity — no manual refresh, no wasted requests.

### 3. Stale Agent Reconciliation

When Claude Code crashes or a terminal closes, agent_runs rows can be left with `status = 'running'` forever. On SSE connect, the server reconciles:

```sql
UPDATE agent_runs
SET status = 'DONE', ended_at = datetime('now')
WHERE status = 'running'
  AND started_at < datetime('now', '-2 hours')
```

This prevents phantom "running" agents from cluttering the dashboard after crashes.

### 4. Schema Migration Without an ORM

The dashboard reads a database it doesn't own — `cast.db` is written by CAST hooks, not the dashboard. The schema evolves as CAST evolves. Instead of failing on missing columns, the seed endpoint runs defensive migrations:

```typescript
for (const stmt of [
  `ALTER TABLE sessions ADD COLUMN total_input_tokens INTEGER DEFAULT 0`,
  `ALTER TABLE agent_runs ADD COLUMN prompt TEXT`,
  `ALTER TABLE agent_runs ADD COLUMN project TEXT`,
]) {
  try { db.exec(stmt) } catch { /* column already exists */ }
}
```

No migration framework, no version tracking. Just idempotent ALTER TABLE statements wrapped in try/catch. SQLite throws if the column exists — we catch and move on.

---

## The Consolidation Story: 21 Views → 4 Pages

The first version of the dashboard grew organically. Every new CAST feature got its own page:

> TokenSpend page. DispatchLog page. QualityGates page. HookHealth page. PrivacyAudit page. MemoryBrowser page. SqliteExplorer page. CastdControl page. RulesView. PlansView. LiveView...

At peak, the dashboard had **21 view files** and **7 navigation items**. It was harder to navigate the dashboard than to just read the database directly.

The fix was radical consolidation in a single session:
1. **Activity + Sessions → Sessions** (activity is just recent sessions)
2. **Agents + Knowledge → System** (agents, rules, skills are all configuration)
3. **TokenSpend + QualityGates → Analytics** (all numbers in one place)
4. **HookHealth + Privacy + DB Explorer + Castd → System tabs**

14 view files deleted. 45 API hooks trimmed to 20. The result: 4 pages that actually make sense.

**The lesson:** observability UI for a running system grows unbounded — every feature wants its own page. The right model is aggressive consolidation with tabs, not more nav items.

---

## The Dogfooding Loop

Here's what makes this project strange: the dashboard was built by CAST agents — the same agents it monitors.

A typical development cycle:
1. I type `/plan condense the dashboard pages`
2. The **planner** agent writes a structured plan with an Agent Dispatch Manifest
3. The **orchestrator** dispatches agents in waves:
   - Wave 1 (parallel): researcher audits backend, security reviews routes, frontend-qa checks components
   - Wave 2: code-writer implements changes
   - Wave 3: code-reviewer + test-writer verify
   - Wave 4: commit + push
4. Each dispatch appears as an `agent_run` row in cast.db
5. The dashboard shows those rows in real-time via SSE

The v2.0.0 consolidation was **55 files changed, +522/-6,802 lines** — all dispatched through CAST agents, all visible in the dashboard they were modifying.

---

## Running It Yourself

The dashboard reads from `~/.claude/` — if you use Claude Code, you already have session data.

```bash
git clone https://github.com/ek33450505/claude-code-dashboard
cd claude-code-dashboard
npm install
npm run dev
# → Vite on :5173, Express API on :3001
```

For the full CAST agent framework (17 agents, hooks, cast.db):
```bash
git clone https://github.com/ek33450505/claude-agent-team
cd claude-agent-team
bash install.sh
```

Both projects are open source. The dashboard works standalone (reads JSONL sessions), but lights up fully with CAST installed (agent runs, routing, memory).

---

## What's Next

- **`cast dash`** — A Textual (Python) TUI that puts the dashboard directly in the terminal. htop for CAST. No browser needed for quick-glance monitoring.
- **Delegation savings tracking** — Quantifying the cost difference between routing work to Haiku vs running everything on Sonnet.
- **Cross-session agent memory visualization** — Showing how agent memory evolves over time.

---

## Key Takeaways

1. **Local-first observability is underrated.** SQLite + filesystem + SSE gives you real-time monitoring with zero infrastructure.
2. **Your AI agents need observability too.** Multi-agent systems are opaque by default. Instrument them early.
3. **Consolidate aggressively.** Every feature wants its own page. Resist. Tabs > nav items.
4. **Read the database you don't own defensively.** Schema will change. Wrap everything in try/catch. Migrate idempotently.
5. **The dogfooding loop is real.** Building developer tools with the tools they observe creates a uniquely tight feedback loop.

---

*The claude-code-dashboard and CAST are open source at [ek33450505/claude-code-dashboard](https://github.com/ek33450505/claude-code-dashboard) and [ek33450505/claude-agent-team](https://github.com/ek33450505/claude-agent-team).*
