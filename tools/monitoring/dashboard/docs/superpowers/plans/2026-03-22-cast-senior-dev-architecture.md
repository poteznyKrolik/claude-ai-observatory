# CAST Senior Dev Architecture — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform the main Claude session into a delegating Senior Dev orchestrator that dispatches specialized agents (preferring haiku for routine work), logs every decision, and surfaces delegation activity in the dashboard.

**Architecture:** Two-repo change. The agent-team repo gets CLAUDE.md triage protocol, strengthened hooks, expanded routing patterns, and a new PostToolUse enforcement script. The dashboard repo gets new routing event types, badge displays, CAST section updates, and a README rewrite.

**Tech Stack:** Bash/Python (hooks), Markdown (CLAUDE.md), TypeScript/React (dashboard), Express (API), Tailwind CSS v4

---

## File Structure

### claude-agent-team repo (`~/Projects/personal/claude-agent-team/`)
| File | Action | Responsibility |
|------|--------|---------------|
| `CLAUDE.md` | Modify | Triage Protocol + Agent Capability Registry + never-inline rules |
| `scripts/route.sh` | Modify | Strengthen no-match fallback to reference triage protocol |
| `config/routing-table.json` | Modify | Expand patterns for vague work prompts |
| `scripts/post-write-review.sh` | Create | PostToolUse hook — remind to dispatch code-reviewer after Write/Edit |
| `scripts/stop-audit.sh` | Create | Stop hook — audit whether agents were used for specialist tasks |

### claude-code-dashboard repo (`~/Projects/personal/claude-code-dashboard/`)
| File | Action | Responsibility |
|------|--------|---------------|
| `src/types/index.ts` | Modify | Add `senior_dev_dispatch` action, `reasoning` field to RoutingEvent |
| `server/parsers/routing.ts` | Modify | Parse `senior_dev_dispatch` + reasoning from routing log |
| `src/views/SystemView.tsx` | Modify | Third badge type, reasoning display |
| `src/views/HomeView.tsx` | Modify | CAST System section → Senior Dev delegation model |
| `README.md` | Modify | Rewrite to feature Senior Dev architecture |

---

## Task 1: CLAUDE.md — Triage Protocol & Agent Capability Registry

**Files:**
- Modify: `~/Projects/personal/claude-agent-team/CLAUDE.md`

This is the core behavioral change. Replace the current Agent Roster + Mandatory Delegation Rules with a Senior Dev identity, triage protocol, and decision-oriented capability registry.

- [ ] **Step 1: Replace the Agent Roster header and intro**

Replace lines 7-9 of CLAUDE.md (the "Agent Roster" section header and intro paragraph) with:

```markdown
## Senior Dev — Delegation Protocol

You are the **Senior Dev**. You manage a team of 28 specialized agents. Your job is to **interpret user intent, delegate tasks to specialists, and review their output**. You do NOT implement, debug, test, commit, review, or write docs inline — you dispatch agents for those tasks.

### Triage Protocol

Run this for every substantive user prompt (after route.sh handles obvious matches):

1. **INTERPRET** — What is the user actually asking for? Translate poor prompts into clear intent.
2. **DECOMPOSE** — Does this require multiple steps? → Dispatch `planner` first.
3. **MATCH** — Check the Agent Capability Registry below. Can a specialist handle this?
   - Yes → Dispatch the specialist. Always.
   - No → Handle inline ONLY for lightweight work (reading code, answering questions, short analysis).
4. **MODEL SELECTION** — Choose the cheapest capable model:
   - Routine/mechanical tasks → **haiku agent** (commit, code-reviewer, build-error-resolver, auto-stager, refactor-cleaner, doc-updater, chain-reporter, db-reader)
   - Reasoning-heavy tasks → **sonnet agent** (planner, debugger, test-writer, security, researcher, architect, e2e-runner, qa-reviewer, readme-writer)
   - Complex architecture → **opus** (only via `opus:` prefix from user)
5. **DISPATCH** — Invoke the agent via the Agent tool. Do not ask the user first.

### Agent Capability Registry

**HAIKU AGENTS — Always prefer for routine work (saves tokens):**

| Agent | Dispatch when... | NEVER do this inline |
|---|---|---|
| `commit` | Any git commit needed | `git commit` via Bash |
| `code-reviewer` | After ANY code changes (yours or another agent's) | Reviewing code yourself |
| `build-error-resolver` | TS/ESLint/Vite build failures | Debugging build errors |
| `auto-stager` | Pre-commit file staging | `git add` decisions |
| `refactor-cleaner` | Dead code, unused imports, cleanup | Cleaning up code inline |
| `doc-updater` | README, changelog, JSDoc updates | Writing docs inline |
| `chain-reporter` | After multi-agent chains complete | Summarizing chains yourself |
| `db-reader` | SQL/data exploration (SELECT only) | Running queries inline |
| `report-writer` | Status reports, sprint summaries | Writing reports inline |
| `meeting-notes` | Processing meeting notes, action items | Extracting items inline |

**SONNET AGENTS — Use for tasks requiring deeper reasoning:**

| Agent | Dispatch when... | NEVER do this inline |
|---|---|---|
| `planner` | ANY non-trivial change (>15 min of work) | Planning multi-step work |
| `debugger` | ANY error, test failure, unexpected behavior | Diagnosing complex bugs |
| `test-writer` | After code changes, when coverage needed | Writing tests inline |
| `security` | Auth, user input, API keys, external data | Security review |
| `researcher` | Tool/library evaluation, comparisons | Deep research inline |
| `architect` | System design, module boundaries, trade-offs | Architecture decisions |
| `e2e-runner` | Playwright end-to-end tests | Running E2E inline |
| `qa-reviewer` | Second-opinion after major features | QA review |
| `readme-writer` | Full README audits and rewrites | README overhauls |
| `data-scientist` | Data analysis, BigQuery exploration | Complex data analysis |
| `email-manager` | Email triage, drafting, inbox summary | Email tasks |
| `morning-briefing` | Daily briefing generation | Briefing assembly |
| `browser` | Web automation, screenshots, scraping | Browser tasks |
| `presenter` | Slide decks, presentations | Presentation creation |
```

- [ ] **Step 2: Replace the Mandatory Delegation Rules section**

Replace the current "Mandatory Delegation Rules" section (lines 81-108) with:

```markdown
## Mandatory Delegation Rules

These are binding constraints. Violations waste tokens and reduce quality.

### What you NEVER do inline
- **Commit code** — Always `commit` agent (haiku). NEVER `git commit` via Bash.
- **Review code** — Always `code-reviewer` agent (haiku) after every logical unit of changes.
- **Debug errors** — Always `debugger` agent (sonnet) for any error, test failure, or unexpected behavior.
- **Plan work** — Always `planner` agent (sonnet) for any non-trivial change.
- **Fix build errors** — Always `build-error-resolver` agent (haiku).
- **Write docs** — Always `doc-updater` agent (haiku) for README/changelog/JSDoc.
- **Write tests** — Always `test-writer` agent (sonnet) when coverage is needed.

### What you CAN do inline
- Read and analyze code
- Answer questions about the codebase
- Small edits (< 5 lines, single file)
- Conversation with the user
- Orchestrating agent dispatches

### Enforcement escalation
- For 10+ file changes: dispatch `code-reviewer` + `security` + `qa-reviewer` in parallel
- For any unhandled error: `debugger` agent immediately — no inline triage
- After every Write/Edit: system will remind you to dispatch `code-reviewer`

### Token efficiency rule
If a **haiku agent** can handle the task, you MUST dispatch the haiku agent instead of handling it yourself (sonnet/opus). This is not optional — it saves tokens and ensures specialized handling.
```

- [ ] **Step 3: Verify CLAUDE.md is valid markdown**

Run: `cat ~/Projects/personal/claude-agent-team/CLAUDE.md | head -5`
Expected: The file starts with `# Claude Code — Global Context for Ed Kubiak`

- [ ] **Step 4: Commit**

```bash
cd ~/Projects/personal/claude-agent-team
git add CLAUDE.md
```
Then dispatch the `commit` agent with message: "feat: add Senior Dev triage protocol and capability registry to CLAUDE.md"

---

## Task 2: Strengthen route.sh no-match fallback

**Files:**
- Modify: `~/Projects/personal/claude-agent-team/scripts/route.sh:80-97`

- [ ] **Step 1: Update the no-match fallback message**

In `route.sh`, replace the no-match block (lines 80-97 — the `if [ -z "$RESULT" ]` block) with:

```bash
if [ -z "$RESULT" ]; then
  # Log no-match
  python3 -c "
import json, datetime, os
log = {
  'timestamp': datetime.datetime.utcnow().isoformat() + 'Z',
  'prompt_preview': os.environ.get('CAST_PROMPT', '')[:80],
  'action': 'no_match',
  'matched_route': None,
  'command': None,
  'pattern': None
}
with open(os.path.expanduser('~/.claude/routing-log.jsonl'), 'a') as f:
    f.write(json.dumps(log) + '\n')
" 2>/dev/null || true

  echo "**[CAST Senior Dev]** No pattern matched. Run your Triage Protocol:
1. INTERPRET this prompt — what does the user need?
2. DECOMPOSE — does it need multiple steps? → planner first
3. MATCH — check your Agent Capability Registry. Can a specialist handle this?
4. MODEL SELECTION — prefer haiku agents for routine work
5. DISPATCH — invoke the agent now. Do NOT handle specialist work inline."
  exit 0
fi
```

- [ ] **Step 2: Commit**

```bash
cd ~/Projects/personal/claude-agent-team
git add scripts/route.sh
```
Dispatch `commit` agent: "feat: strengthen route.sh no-match fallback with triage protocol reference"

---

## Task 3: Expand routing-table.json patterns

**Files:**
- Modify: `~/Projects/personal/claude-agent-team/config/routing-table.json`

- [ ] **Step 1: Add patterns for common vague prompts**

Add these patterns to existing routes:

For `debugger`: add `"what.*wrong"`, `"doesn't.*work"`, `"issue with"`
For `planner`: add `"let's build"`, `"add.*feature"`, `"implement"`, `"we need to"`, `"i want to"`, `"how should we"`
For `code-reviewer`: add `"before we push"`, `"check.*code"`, `"look.*at.*changes"`
For `test-writer`: add `"need.*test"`, `"test.*coverage"`, `"should.*test"`
For `doc-updater`: add `"update.*doc"`, `"fix.*readme"`, `"readme.*wrong"`

- [ ] **Step 2: Verify patterns don't cause false positives**

Run a test with the 5 new patterns against known prompts:
```bash
echo '["i want to add a new page", "let us build the auth system", "we need to fix the header"]' | python3 -c "
import json, re, sys
prompts = json.load(sys.stdin)
patterns = {'planner': [r\"let's build\", r'add.*feature', r'implement', r'we need to', r'i want to', r'how should we']}
for p in prompts:
    for agent, pats in patterns.items():
        for pat in pats:
            if re.search(pat, p, re.IGNORECASE):
                print(f'  MATCH {agent:15} pattern={pat:20} \"{p}\"')
                break
"
```

- [ ] **Step 3: Commit**

```bash
cd ~/Projects/personal/claude-agent-team
git add config/routing-table.json
```
Dispatch `commit` agent: "feat: expand routing-table patterns for vague work prompts"

---

## Task 4: Create PostToolUse hook — post-write-review.sh

**Files:**
- Create: `~/Projects/personal/claude-agent-team/scripts/post-write-review.sh`

- [ ] **Step 1: Write the hook script**

```bash
#!/bin/bash
# post-write-review.sh — PostToolUse hook for Write|Edit
# Reminds the Senior Dev to dispatch code-reviewer after code changes.
# This is a prompt-type hook output (stdout becomes additionalContext).

echo "**[CAST]** You just modified code. After completing your current logical unit of changes, dispatch the \`code-reviewer\` agent (haiku) to review. Do NOT skip this step."
```

- [ ] **Step 2: Make executable**

Run: `chmod +x ~/Projects/personal/claude-agent-team/scripts/post-write-review.sh`

- [ ] **Step 3: Commit**

```bash
cd ~/Projects/personal/claude-agent-team
git add scripts/post-write-review.sh
```
Dispatch `commit` agent: "feat: add PostToolUse hook to enforce code-reviewer dispatch after Write/Edit"

---

## Task 5: Create Stop hook — stop-audit.sh

**Files:**
- Create: `~/Projects/personal/claude-agent-team/scripts/stop-audit.sh`

- [ ] **Step 1: Write the audit prompt**

This is a `prompt` type hook (not a command), so it's configured directly in settings. But we'll create a reference script for documentation:

The Stop hook will be configured as a prompt in settings.local.json (Task 6). The prompt text:

```
Before ending this session, audit your delegation:
- Were there code changes? Did you dispatch code-reviewer (haiku)?
- Were there commits? Did you use the commit agent (haiku)?
- Were there errors? Did you dispatch debugger (sonnet)?
- Was there multi-step work? Did you start with planner (sonnet)?
If you handled ANY specialist task inline instead of delegating, flag this as a delegation violation.
```

- [ ] **Step 2: Skip** (prompt hooks don't need a script file — configured directly in Task 6)

---

## Task 6: Register hooks in settings.local.json

**Files:**
- Modify: `~/.claude/settings.local.json`

- [ ] **Step 1: Add PostToolUse hook for Write|Edit**

Add to the `PostToolUse` array in `hooks`:

```json
{
  "matcher": "Write|Edit",
  "hooks": [
    {
      "type": "command",
      "command": "bash ~/.claude/scripts/post-write-review.sh",
      "timeout": 3
    }
  ]
}
```

Note: There's already a PostToolUse entry for `Write|Edit` (auto-format.sh). Add this as a second entry in the same matcher array, or as a new PostToolUse array entry.

- [ ] **Step 2: Strengthen the Stop hook**

Replace the current Stop hook prompt with the audit prompt:

```json
{
  "hooks": [
    {
      "type": "prompt",
      "prompt": "Before ending this session, audit your delegation:\n- Were there code changes? Did you dispatch code-reviewer (haiku)?\n- Were there commits? Did you use the commit agent (haiku)?\n- Were there errors? Did you dispatch debugger (sonnet)?\n- Was there multi-step work? Did you start with planner (sonnet)?\nIf you handled ANY specialist task inline instead of delegating, flag this as a delegation violation."
    }
  ]
}
```

- [ ] **Step 3: Verify settings.local.json is valid JSON**

Run: `python3 -m json.tool ~/.claude/settings.local.json > /dev/null && echo "Valid JSON" || echo "INVALID"`
Expected: `Valid JSON`

- [ ] **Step 4: Commit agent-team changes**

```bash
cd ~/Projects/personal/claude-agent-team
git add -A
```
Dispatch `commit` agent: "feat: register PostToolUse and Stop hooks for delegation enforcement"

---

## Task 7: Dashboard — Add senior_dev_dispatch to types and parsers

**Files:**
- Modify: `~/Projects/personal/claude-code-dashboard/src/types/index.ts:177-183`
- Modify: `~/Projects/personal/claude-code-dashboard/server/parsers/routing.ts`

- [ ] **Step 1: Extend RoutingEvent type**

In `src/types/index.ts`, update the `RoutingEvent` interface:

```typescript
export interface RoutingEvent {
  timestamp: string
  promptPreview: string
  action: 'suggested' | 'dispatched' | 'opus_escalation' | 'no_match' | 'skipped' | 'agent_dispatch' | 'senior_dev_dispatch'
  matchedRoute: string | null
  command: string | null
  pattern: string | null
  agentName?: string | null
  agentModel?: string | null
  reasoning?: string | null
}
```

- [ ] **Step 2: Update routing parser to handle reasoning field**

In `server/parsers/routing.ts`, in the `parseRoutingLog` function, add `reasoning` to the return object:

```typescript
return {
  timestamp: raw.timestamp,
  promptPreview: raw.prompt_preview ?? '',
  action: raw.action ?? 'suggested',
  matchedRoute: raw.matched_route ?? null,
  command: raw.command ?? null,
  pattern: raw.pattern ?? null,
  reasoning: raw.reasoning ?? null,
} satisfies RoutingEvent
```

- [ ] **Step 3: Update getRoutingStats to count senior_dev_dispatch**

In `server/parsers/routing.ts`, in `getRoutingStats`:

The `senior_dev_dispatch` action should be treated like `dispatched` for coverage purposes — it's a successful delegation. Update the `routedCount` filter:

```typescript
const routedCount = promptEvents.filter(e =>
  (e.action === 'dispatched' || e.action === 'suggested' || e.action === 'senior_dev_dispatch') &&
  e.matchedRoute &&
  e.matchedRoute !== 'opus'
).length
```

And the substantive routed filter similarly:

```typescript
const substantiveRouted = substantivePrompts.filter(e =>
  (e.action === 'dispatched' || e.action === 'suggested' || e.action === 'senior_dev_dispatch') &&
  e.matchedRoute &&
  e.matchedRoute !== 'opus'
).length
```

Also add `senior_dev_dispatch` to the agentCounts routed bucket:

```typescript
if (e.action === 'agent_dispatch') {
  agentCounts[e.matchedRoute].direct++
} else {
  agentCounts[e.matchedRoute].routed++
}
```

Change to:

```typescript
if (e.action === 'agent_dispatch') {
  agentCounts[e.matchedRoute].direct++
} else if (e.action === 'senior_dev_dispatch') {
  agentCounts[e.matchedRoute].direct++ // Senior Dev dispatches count as direct
} else {
  agentCounts[e.matchedRoute].routed++
}
```

- [ ] **Step 4: Build to verify**

Run: `cd ~/Projects/personal/claude-code-dashboard && npx vite build 2>&1 | tail -3`
Expected: `built in X.XXs` with no errors

- [ ] **Step 5: Commit**

```bash
cd ~/Projects/personal/claude-code-dashboard
git add src/types/index.ts server/parsers/routing.ts
```
Dispatch `commit` agent: "feat: add senior_dev_dispatch action type with reasoning field to routing"

---

## Task 8: Dashboard — SystemView badges and reasoning display

**Files:**
- Modify: `~/Projects/personal/claude-code-dashboard/src/views/SystemView.tsx:156-234`

- [ ] **Step 1: Add senior_dev_dispatch badge style and label**

In the `actionStyles` object (around line 197), add:

```typescript
senior_dev_dispatch: 'bg-[var(--accent)]/15 text-[var(--accent)]',
```

In the `label` object (around line 206), add:

```typescript
senior_dev_dispatch: 'senior dev',
```

- [ ] **Step 2: Add reasoning display to recent events**

After the existing `agentModel` badge block (around line 233), add:

```tsx
{ev.reasoning && (
  <span className="text-[10px] text-[var(--text-muted)] italic">
    {ev.reasoning}
  </span>
)}
```

- [ ] **Step 3: Add third badge type to Top Dispatched Agents**

In the Top Dispatched Agents table, we need to split the `direct` count into `auto` and `senior_dev`. This requires a backend change to `RoutingStats.topAgents`.

Update the `topAgents` type in `src/types/index.ts`:

```typescript
topAgents: Array<{ agent: string; count: number; routed: number; direct: number; seniorDev: number }>
```

And update `getRoutingStats` in `server/parsers/routing.ts` to track `seniorDev` count separately:

```typescript
const agentCounts: Record<string, { total: number; routed: number; direct: number; seniorDev: number }> = {}
// ...
if (e.action === 'agent_dispatch') {
  agentCounts[e.matchedRoute].direct++
} else if (e.action === 'senior_dev_dispatch') {
  agentCounts[e.matchedRoute].seniorDev++
} else {
  agentCounts[e.matchedRoute].routed++
}
```

Then in SystemView, add a third badge after the `direct > 0` badge:

```tsx
{seniorDev > 0 && (
  <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-[var(--accent)]/15 text-[var(--accent)]" title="Dispatched by Senior Dev (triage protocol)">
    {seniorDev} senior dev
  </span>
)}
```

- [ ] **Step 4: Build to verify**

Run: `cd ~/Projects/personal/claude-code-dashboard && npx vite build 2>&1 | tail -3`
Expected: `built in X.XXs` with no errors

- [ ] **Step 5: Commit**

```bash
cd ~/Projects/personal/claude-code-dashboard
git add src/types/index.ts server/parsers/routing.ts src/views/SystemView.tsx
```
Dispatch `commit` agent: "feat: add Senior Dev badge and reasoning display to routing stats"

---

## Task 9: Dashboard — HomeView CAST System section update

**Files:**
- Modify: `~/Projects/personal/claude-code-dashboard/src/views/HomeView.tsx:285-331`

- [ ] **Step 1: Rewrite the CAST System section**

Replace the current 3-card CAST System section with a 4-card layout that puts the Senior Dev at the center. The new cards:

1. **Senior Dev** (new, prominent) — "The orchestrator. Interprets user intent, delegates to specialists, reviews output. Never implements inline."
2. **Agent Team** — Updated to emphasize haiku/sonnet model tiers and token efficiency
3. **Agent Router** — Updated to mention triage protocol as the fallback
4. **Dashboard** — Updated to mention delegation visibility

Replace the CAST section (the `<section className="mb-20">` containing "The CAST System" heading) with:

```tsx
{/* ─── CAST System ─── */}
<section className="mb-20">
  <motion.div
    initial={{ opacity: 0, y: 16 }}
    whileInView={{ opacity: 1, y: 0 }}
    viewport={{ once: true }}
    transition={{ duration: 0.5 }}
  >
    <h2 className="text-3xl font-bold tracking-tight mb-2 text-center">
      The <span className="text-[var(--accent)]">CAST</span> System
    </h2>
    <p className="text-center text-sm text-[var(--text-muted)] mb-10">Claude Agent System & Team — a self-managing development team</p>
  </motion.div>
  <motion.div
    className="grid grid-cols-1 md:grid-cols-2 gap-5"
    variants={container}
    initial="hidden"
    whileInView="show"
    viewport={{ once: true, margin: '-50px' }}
  >
    <motion.div variants={item} className="bento-card hover-lift p-7 md:col-span-2" style={{ borderImage: 'linear-gradient(to right, rgba(0,255,194,0.3), rgba(99,102,241,0.3)) 1', borderImageSlice: 1 }}>
      <div className="flex items-center gap-2 mb-3">
        <div className="text-xs font-semibold uppercase tracking-wider text-[var(--accent)]">The Boss</div>
      </div>
      <h3 className="text-lg font-bold mb-2">Senior Dev <span className="text-sm font-normal text-[var(--text-muted)]">( CLAUDE.md )</span></h3>
      <p className="text-sm text-[var(--text-secondary)] leading-relaxed mb-4">The orchestrator. Reads every user prompt, interprets intent, and <span className="text-[var(--accent)] font-medium">delegates to the cheapest capable specialist</span>. Never implements, debugs, tests, or commits inline — managers delegate, they don't do the work.</p>
      <div className="flex gap-4 flex-wrap text-xs text-[var(--text-muted)]">
        <span>Triage Protocol</span>
        <span>--</span>
        <span>Haiku-first delegation</span>
        <span>--</span>
        <span>Agent Capability Registry</span>
      </div>
    </motion.div>
    <motion.div variants={item} className="bento-card hover-lift p-7" style={{ borderImage: 'linear-gradient(to bottom, rgba(99,102,241,0.3), transparent) 1', borderImageSlice: 1 }}>
      <div className="text-xs font-semibold uppercase tracking-wider text-indigo-400 mb-3">The Team</div>
      <h3 className="text-lg font-bold mb-2">28 Specialist Agents</h3>
      <p className="text-sm text-[var(--text-secondary)] leading-relaxed mb-4">Each agent has a defined role, model tier, and tool access. <span className="text-indigo-400 font-medium">Haiku agents</span> handle routine work (commits, reviews, staging). <span className="text-indigo-400 font-medium">Sonnet agents</span> handle complex reasoning (planning, debugging, testing).</p>
      <a href="https://github.com/ek33450505/claude-agent-team" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300 transition-colors">
        github.com/ek33450505/claude-agent-team <ExternalLink className="w-3 h-3" />
      </a>
    </motion.div>
    <motion.div variants={item} className="bento-card hover-lift p-7" style={{ borderImage: 'linear-gradient(to bottom, rgba(6,182,212,0.3), transparent) 1', borderImageSlice: 1 }}>
      <div className="flex items-center gap-2 mb-3">
        <div className="text-xs font-semibold uppercase tracking-wider text-cyan-400">The Router</div>
      </div>
      <h3 className="text-lg font-bold mb-2">Auto-Dispatch</h3>
      <p className="text-sm text-[var(--text-secondary)] leading-relaxed mb-4">Two-phase routing: regex fast path for obvious matches, then the Senior Dev's <span className="text-cyan-400 font-medium">Triage Protocol</span> for everything else. Every dispatch logged for full observability.</p>
      <span className="text-xs text-[var(--text-muted)]">route.sh -- triage protocol -- routing-log.jsonl</span>
    </motion.div>
  </motion.div>
</section>
```

- [ ] **Step 2: Build to verify**

Run: `cd ~/Projects/personal/claude-code-dashboard && npx vite build 2>&1 | tail -3`
Expected: `built in X.XXs` with no errors

- [ ] **Step 3: Commit**

```bash
cd ~/Projects/personal/claude-code-dashboard
git add src/views/HomeView.tsx
```
Dispatch `commit` agent: "feat: update CAST System section with Senior Dev delegation model"

---

## Task 10: Dashboard — README rewrite

**Files:**
- Modify: `~/Projects/personal/claude-code-dashboard/README.md`

- [ ] **Step 1: Dispatch readme-writer agent**

Dispatch the `readme-writer` agent with prompt:

"Rewrite the README for claude-code-dashboard at ~/Projects/personal/claude-code-dashboard. The headline feature is the CAST Senior Dev Architecture — the first AI coding system where the main agent acts as a delegating Senior Dev who interprets user intent and dispatches specialized agents (preferring haiku-tier for routine work to save tokens). Key sections: (1) What this is — observability + config layer for Claude Code, (2) The CAST System — Senior Dev delegation model with triage protocol, 28 agents across haiku/sonnet/opus tiers, (3) Features — live activity, agent management, session replay, knowledge base, analytics, routing stats, (4) Getting Started — install agent-team first, then dashboard. Verify all claims against the actual codebase."

- [ ] **Step 2: Review the README**

Read the generated README and verify it accurately describes the Senior Dev architecture.

- [ ] **Step 3: Commit**

```bash
cd ~/Projects/personal/claude-code-dashboard
git add README.md
```
Dispatch `commit` agent: "docs: rewrite README to feature Senior Dev delegation architecture"

---

## Task 11: Final verification and push

- [ ] **Step 1: Build dashboard**

Run: `cd ~/Projects/personal/claude-code-dashboard && npx vite build 2>&1 | tail -5`
Expected: Clean build, no errors

- [ ] **Step 2: Dispatch code-reviewer**

Dispatch `code-reviewer` agent to review all changes across both repos.

- [ ] **Step 3: Push dashboard**

```bash
cd ~/Projects/personal/claude-code-dashboard
git push origin main
```

- [ ] **Step 4: Push agent-team**

```bash
cd ~/Projects/personal/claude-agent-team
git push origin main
```

---

## Dependency Order

```
Task 1 (CLAUDE.md) ─── independent, foundational
Task 2 (route.sh) ──── depends on Task 1 (references triage protocol)
Task 3 (routing-table) ── independent
Task 4 (post-write-review.sh) ── independent
Task 5 (stop-audit) ── independent
Task 6 (settings.local.json) ── depends on Tasks 4, 5
Task 7 (types + parsers) ── independent
Task 8 (SystemView) ── depends on Task 7
Task 9 (HomeView) ── independent
Task 10 (README) ── depends on Tasks 1, 9 (needs final CAST description)
Task 11 (verify + push) ── depends on all above
```

**Parallelizable batches:**
- Batch A: Tasks 1, 3, 4, 5, 7, 9 (all independent)
- Batch B: Tasks 2, 6, 8 (depend on Batch A)
- Batch C: Task 10 (README — needs everything else done)
- Batch D: Task 11 (final verify + push)
