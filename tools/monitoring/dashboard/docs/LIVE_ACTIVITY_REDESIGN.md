# Live Activity Redesign — CAST-Native Dispatch Timeline

**Status:** Ready to implement
**Session reference:** claude-agent-team session 2026-03-24 (gap closure + Work Log additions)
**Phase:** 1 of 2 — Live Activity UI (Phase 2 = Memory System, defer to separate session)

---

## Background & Context

This dashboard observes **CAST (Claude Agent Specialist Team)** — a hook-driven agent dispatch system for Claude Code with 23 specialist agents, model-driven dispatch, and parallel wave orchestration.

### What changed in the upstream session (claude-agent-team repo)

Four core agents now emit a structured **Work Log** section before their Status block:

- **code-writer** — files read (with line counts), files written, code-reviewer result verbatim, decisions made
- **code-reviewer** — files reviewed, git diff summary, critical/warning/suggestion counts
- **debugger** — error captured, hypothesis, root cause, fix location, regression test result
- **test-writer** — framework detected, files tested, tests written (with names), test run output

Example Work Log in a session JSONL (inside an assistant message content block):

```
## Work Log

- Read: agents/core/code-reviewer.md (62 lines)
- Read: agents/core/debugger.md (58 lines)
- Wrote/edited: agents/core/code-writer.md — added Work Log spec section
- code-reviewer result: DONE (0 critical, 0 warnings)
- test-writer result: skipped — no logic added, documentation change only
- Decisions: kept Work Log above Status block so hooks continue parsing bottom of response

Status: DONE
Summary: Added Work Log output format to code-writer, code-reviewer, debugger, test-writer
Files changed: agents/core/code-writer.md, agents/core/code-reviewer.md, agents/core/debugger.md, agents/core/test-writer.md, CLAUDE.md.template
```

This data already flows through the SSE pipeline (session JSONL → chokidar → SSE `session_updated` event → LiveView). It just isn't parsed or displayed.

### Agent color system (from agent frontmatter)

Each agent declares a `color:` field. These are the canonical values:

| Agent | Color | Suggested Lucide Icon |
|---|---|---|
| code-writer | orange | `Code2` |
| code-reviewer | cyan | `ScanSearch` |
| debugger | red | `Bug` |
| test-writer | green | `FlaskConical` |
| commit | yellow | `GitCommit` |
| planner | purple | `Map` |
| orchestrator | violet | `Network` |
| push | blue | `GitBranch` |
| security | rose | `ShieldAlert` |
| architect | indigo | `Layers` |
| bash-specialist | amber | `Terminal` |
| auto-stager | teal | `PackageCheck` |
| chain-reporter | slate | `ClipboardList` |
| verifier | lime | `CheckCircle2` |
| test-runner | emerald | `PlayCircle` |
| doc-updater | sky | `FileText` |
| refactor-cleaner | pink | `Scissors` |
| build-error-resolver | red | `Hammer` |
| router | gray | `Route` |
| linter | zinc | `AlignLeft` |
| researcher | violet | `Search` |
| readme-writer | blue | `BookOpen` |
| data-scientist | emerald | `BarChart2` |
| db-reader | slate | `Database` |
| report-writer | amber | `FileSpreadsheet` |

---

## Current Live Activity — What Exists

**File:** `src/views/LiveView.tsx`
**Components:** `AgentOfficeStrip`, `IntelPanel`, `DelegationChain`, `FeedCard`, `PixelSprite`

Current problems:
1. **Pixel sprites** (`PixelSprite.tsx`) are generic 8-bit office workers — not CAST-branded
2. **Work Logs are invisible** — they exist in the JSONL data but nothing parses or shows them
3. **DelegationChain** groups by a 30-second time window heuristic — brittle
4. **Activity log** shows 200-char text previews — no structure or hierarchy
5. **Agent Office Strip** uses a hardcoded `LOCAL_AGENTS` list — stale

---

## Target State — Reimagined Live Activity

### Layout

```
┌─────────────────────────────────────────────────────────────────────┐
│  LIVE ACTIVITY                                       ● Connected     │
├─────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  ┌─── Dispatch Chain ──────────────────────── 2 min ago ───────┐    │
│  │  💬 "add work log output to core agents"                      │    │
│  │                                                               │    │
│  │  ┌─ [●] code-writer  sonnet  DONE ────────────────────────┐  │    │
│  │  │  ▼ Work Log                                             │  │    │
│  │  │  · Read: code-reviewer.md (62 lines)                   │  │    │
│  │  │  · Read: debugger.md (58 lines)                        │  │    │
│  │  │  · Edited: code-writer.md — added Work Log spec        │  │    │
│  │  │  · code-reviewer: DONE (0 critical)                    │  │    │
│  │  └─────────────────────────────────────────────────────────┘  │    │
│  │                                                               │    │
│  │  ┌─ [●] code-reviewer  haiku  DONE ───────────────────────┐  │    │
│  │  │  · 5 files reviewed · 0 critical · 0 warnings          │  │    │
│  │  └─────────────────────────────────────────────────────────┘  │    │
│  └───────────────────────────────────────────────────────────────┘    │
│                                                                       │
│  ┌─── Dispatch Chain ──────────────────────── 18 min ago ──────┐    │
│  │  💬 "close architecture gaps"         [collapsed]  ▶         │    │
│  └───────────────────────────────────────────────────────────────┘    │
│                                                                       │
└─────────────────────────────────────────────────────────────────────┘
```

### Agent Avatar — replacing PixelSprite

Each agent gets a **color dot + initials badge** derived from their `color:` frontmatter field. No pixel art.

```tsx
// AgentAvatar.tsx
<div style={{ background: agentColor }} className="w-8 h-8 rounded-full flex items-center justify-center">
  <span className="text-xs font-bold text-white">{initials}</span>
</div>
```

Optionally: Lucide icon inside the badge instead of initials (see icon mapping table above).

---

## Implementation Plan

### Files to CREATE

| File | Purpose |
|---|---|
| `src/components/LiveView/DispatchChain.tsx` | Single prompt → agent chain card (replaces DelegationChain) |
| `src/components/LiveView/AgentCard.tsx` | Single agent in a chain (avatar + model + status + Work Log) |
| `src/components/LiveView/WorkLogSection.tsx` | Parsed Work Log display inside AgentCard |
| `src/components/LiveView/AgentAvatar.tsx` | Color dot + initials/icon — replaces PixelSprite |
| `src/components/LiveView/StatusPill.tsx` | DONE / DONE_WITH_CONCERNS / BLOCKED / NEEDS_CONTEXT badge |
| `server/parsers/workLog.ts` | Parse `## Work Log` section out of assistant message content |

### Files to MODIFY

| File | Change |
|---|---|
| `src/views/LiveView.tsx` | Replace IntelPanel/DelegationChain with new DispatchChain list |
| `src/components/LiveView/IntelPanel.tsx` | Remove or repurpose — keep as layout shell if needed |
| `src/components/LiveView/DelegationChain.tsx` | Replace with DispatchChain imports (or delete) |
| `src/utils/agentPersonalities.ts` | Add `agentColor` and `agentIcon` exports; keep archetypes for backward compat |
| `server/watchers/sse.ts` | Extend `session_updated` event to include parsed Work Log when present |
| `server/types.ts` (or `src/types/index.ts`) | Add `WorkLogEntry`, `DispatchChainEvent` types |

### Files to LEAVE ALONE

- `src/components/LiveView/FeedCard.tsx` — keep for raw event log at bottom
- `server/routes/` — no route changes needed
- All non-LiveView views

---

## Detailed Component Specs

### `server/parsers/workLog.ts`

Parse a Work Log section from an assistant message string:

```typescript
export interface ParsedWorkLog {
  items: string[]           // each bullet point, raw text
  codeReviewerResult?: string
  testWriterResult?: string
  decisions?: string[]
  filesRead?: string[]
  filesChanged?: string[]
}

export function parseWorkLog(content: string): ParsedWorkLog | null {
  // Find "## Work Log" section, stop at next "##" or "Status:"
  // Parse bullet points into categorized fields
  // Return null if section not present
}
```

### `server/watchers/sse.ts` — extend `session_updated`

When a new JSONL line is a `type: "assistant"` message with `## Work Log` in the content:

```typescript
// Add to LiveEvent type:
workLog?: ParsedWorkLog      // present when assistant response contains Work Log
agentName?: string           // extracted from Work Log or .meta.json
```

### `src/components/LiveView/AgentAvatar.tsx`

```tsx
interface AgentAvatarProps {
  agentName: string   // looks up color from agentPersonalities or agent .md color field
  size?: 'sm' | 'md' | 'lg'
  showLabel?: boolean
}
```

Color resolution order:
1. Agent frontmatter `color:` field (read via `/api/agents` endpoint, already available)
2. Fallback to `agentPersonalities.ts` accentColor
3. Final fallback: `#6b7280` (gray)

### `src/components/LiveView/StatusPill.tsx`

```tsx
// Status → color mapping:
// DONE → green
// DONE_WITH_CONCERNS → amber
// BLOCKED → red
// NEEDS_CONTEXT → purple
// running (no status yet) → blue pulse animation
```

### `src/components/LiveView/AgentCard.tsx`

```tsx
interface AgentCardProps {
  agentName: string
  model: string                   // haiku | sonnet | opus
  status: AgentStatus | 'running'
  workLog?: ParsedWorkLog
  startedAt: string
  completedAt?: string
  defaultExpanded?: boolean       // true for most recent chain
}
```

- Work Log collapsed by default for chains older than 5 minutes
- Work Log expanded by default for active / most-recent chain
- Click header to toggle

### `src/components/LiveView/DispatchChain.tsx`

```tsx
interface DispatchChainProps {
  promptPreview: string           // first 120 chars of user prompt
  agents: AgentCardProps[]        // ordered list of agents in this chain
  startedAt: string
  isActive: boolean
  defaultExpanded?: boolean
}
```

Chain grouping logic (replaces the 30-second heuristic in DelegationChain):
- Group by `sessionId` from the SSE events — agents within the same session belong to the same chain
- Order agents by `startedAt` timestamp
- A chain is `isActive` if any agent's JSONL file was modified in the last 2 minutes

### `src/views/LiveView.tsx` — new structure

```tsx
// Replace current layout with:
<div className="flex flex-col gap-4 p-4">
  <LiveHeader connected={connected} />

  {/* Active chains at top, most recent first */}
  <div className="flex flex-col gap-3">
    {chains.map(chain => (
      <DispatchChain
        key={chain.sessionId}
        {...chain}
        defaultExpanded={chain.isActive || chains.indexOf(chain) === 0}
      />
    ))}
  </div>

  {/* Raw event log at bottom — keep existing FeedCard */}
  <details>
    <summary className="text-xs text-muted-foreground cursor-pointer">Raw event log</summary>
    <div className="mt-2 flex flex-col gap-1">
      {feed.map(item => <FeedCard key={item.id} item={item} />)}
    </div>
  </details>
</div>
```

---

## Data Flow (end to end)

```
1. Agent writes response to session JSONL
   (assistant message with "## Work Log" section)
            ↓
2. chokidar detects file change (server/watchers/sse.ts)
            ↓
3. Server reads last line of JSONL
   Calls parseWorkLog(content) → ParsedWorkLog | null
   Constructs LiveEvent with workLog field attached
            ↓
4. SSE broadcasts to all clients
            ↓
5. useLiveEvents callback receives event
   If workLog present → create/update AgentCard in chain
   If no workLog → raw FeedCard (existing behavior)
            ↓
6. DispatchChain re-renders with updated AgentCard
   Work Log visible inline
```

---

## What Is NOT in This Phase (Phase 2 — Memory System)

Defer to a separate session. Reference the claude-agent-team session from 2026-03-24.

**Memory system gap (from that session's analysis):**
- `memory: local` is declared in 28 agent frontmatters but only 2 agents have actual memory content
- No hook or script injects memory into agent prompts before dispatch
- The killer feature: before orchestrator dispatches an agent, read `~/.claude/agent-memory-local/<agent>/<project>.md` and prepend it to the prompt
- This requires: a pre-dispatch memory loader (in orchestrator or CLAUDE.md.template), a memory write convention agents follow, and a Memory Browser view in this dashboard

Phase 2 scope for dashboard:
- `src/views/AgentDetailView.tsx` — add memory file editor (already shows memory, add write)
- New `src/views/MemoryView.tsx` — cross-agent memory browser
- `server/routes/memory.ts` — add PUT endpoint for memory writes

---

## Agent Dispatch Manifest

```json dispatch
{
  "batches": [
    {
      "id": 1,
      "description": "Backend — Work Log parser + SSE extension",
      "parallel": false,
      "agents": [
        {
          "subagent_type": "code-writer",
          "prompt": "In /Users/edkubiak/Projects/personal/claude-code-dashboard: (1) Create server/parsers/workLog.ts — exports parseWorkLog(content: string): ParsedWorkLog | null. Finds '## Work Log' section in assistant message content, parses bullet lines into categorized fields: items[], filesRead[], filesChanged[], codeReviewerResult?, testWriterResult?, decisions[]. Returns null if section absent. (2) Extend server/watchers/sse.ts: when last JSONL line is an assistant message, call parseWorkLog on its text content. If non-null, attach parsed result as workLog field on the LiveEvent before broadcasting. Add WorkLogEntry and extended LiveEvent types to server/types.ts (or wherever LiveEvent is defined). Dispatch code-reviewer after all changes."
        }
      ]
    },
    {
      "id": 2,
      "description": "Frontend — AgentAvatar + StatusPill components",
      "parallel": false,
      "agents": [
        {
          "subagent_type": "code-writer",
          "prompt": "In /Users/edkubiak/Projects/personal/claude-code-dashboard/src/components/LiveView/: (1) Create AgentAvatar.tsx — props: agentName, size ('sm'|'md'|'lg', default 'md'), showLabel (bool). Resolves color from agentPersonalities.ts accentColor lookup (agent name → hex), fallback #6b7280. Renders a filled circle with agent initials (first 2 chars uppercase). Uses Tailwind + inline style for the background color. (2) Create StatusPill.tsx — props: status ('DONE'|'DONE_WITH_CONCERNS'|'BLOCKED'|'NEEDS_CONTEXT'|'running'). DONE=green, DONE_WITH_CONCERNS=amber, BLOCKED=red, NEEDS_CONTEXT=purple, running=blue with animate-pulse. Small pill badge with status text. Dispatch code-reviewer after changes."
        }
      ]
    },
    {
      "id": 3,
      "description": "Frontend — WorkLogSection + AgentCard components",
      "parallel": false,
      "agents": [
        {
          "subagent_type": "code-writer",
          "prompt": "In /Users/edkubiak/Projects/personal/claude-code-dashboard/src/components/LiveView/: (1) Create WorkLogSection.tsx — props: workLog (ParsedWorkLog from server types). Renders bullet items grouped by category: files read (eye icon), files changed (edit icon), code-reviewer result (shield icon), test-writer result (flask icon), decisions (lightbulb icon). Compact, monospace font, muted text color. (2) Create AgentCard.tsx — props: agentName, model, status, workLog?, startedAt, completedAt?, defaultExpanded (bool). Header row: AgentAvatar (sm) + agent name + model badge + StatusPill + elapsed time. Collapsible body: WorkLogSection if workLog present. Use shadcn Collapsible or native details/summary. Framer Motion for collapse animation. Dispatch code-reviewer after changes."
        }
      ]
    },
    {
      "id": 4,
      "description": "Frontend — DispatchChain + LiveView wiring",
      "parallel": false,
      "agents": [
        {
          "subagent_type": "code-writer",
          "prompt": "In /Users/edkubiak/Projects/personal/claude-code-dashboard: (1) Create src/components/LiveView/DispatchChain.tsx — props: promptPreview (string), agents (AgentCard props array), startedAt, isActive (bool), defaultExpanded (bool). Header: chat bubble icon + prompt preview (120 chars) + relative timestamp. Body: ordered list of AgentCard components. Active chains get a subtle left border accent. (2) Rewrite src/views/LiveView.tsx to: consume workLog data from SSE events (extend existing handleEvent to detect work logs and build chain state), render list of DispatchChain components (most recent first, active at top), keep existing FeedCard raw log inside a collapsed <details> at the bottom. Remove or stub out AgentOfficeStrip and DelegationChain imports — they are replaced. Read the current LiveView.tsx carefully before rewriting to preserve SSE connection logic, useLiveAgents polling, and feed state. Dispatch code-reviewer after changes."
        }
      ]
    },
    {
      "id": 5,
      "description": "Commit all changes",
      "parallel": false,
      "agents": [
        {
          "subagent_type": "commit",
          "prompt": "Commit the Live Activity redesign: Work Log parser, AgentAvatar, StatusPill, WorkLogSection, AgentCard, DispatchChain, LiveView rewrite. Semantic commit message."
        }
      ]
    }
  ]
}
```

---

## How to Execute This Plan

In a fresh session from the `claude-code-dashboard` project directory:

```
/orchestrate docs/LIVE_ACTIVITY_REDESIGN.md
```

The orchestrator will read the Agent Dispatch Manifest above and execute the 5 batches in sequence.

---

## Acceptance Criteria

| Check | Expected |
|---|---|
| Open `/activity` in dashboard | DispatchChain cards render, no pixel sprites |
| Trigger an agent (e.g. `/test`) | New chain appears within 2s via SSE |
| Agent completes with Work Log | Work Log items visible inside AgentCard |
| Agent returns BLOCKED | Red StatusPill, chain highlighted |
| Click chain header | Collapses/expands AgentCards |
| Active chain | defaultExpanded=true, blue running pulse on in-progress agent |
| Old chain (>5 min) | Collapsed by default |
| Raw event log | Still visible under "Raw event log" disclosure |
