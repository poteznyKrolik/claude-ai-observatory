# CAST Senior Dev Architecture — Design Spec

**Date:** 2026-03-22
**Status:** Approved
**Scope:** Phase 1 — Senior Dev delegation enforcement + dashboard visibility
**Repos:** claude-agent-team (system), claude-code-dashboard (visibility)

---

## Problem Statement

The CAST system has 28 specialized agents across 3 model tiers (haiku, sonnet, opus), but the main Claude session acts as a generalist — implementing, debugging, reviewing, and committing inline instead of delegating to specialists. This wastes tokens (sonnet/opus doing haiku-level work), reduces observability (no delegation chain visible on dashboard), and defeats the purpose of specialized agents.

Haiku agents (commit, code-reviewer, build-error-resolver, auto-stager, refactor-cleaner, doc-updater, chain-reporter, db-reader) show zero utilization in dashboard analytics because the Senior Dev never dispatches them.

## Solution

Transform the main Claude session from a generalist doer into a **Senior Dev orchestrator** that:
1. Interprets user intent (even from poor prompts)
2. Consults an Agent Capability Registry
3. Delegates to the cheapest capable specialist
4. Reviews agent output
5. Logs every delegation decision for dashboard visibility

## Architecture

### The Senior Dev Identity

The Senior Dev is the main Claude session guided by CLAUDE.md. It is NOT a separate spawned agent. It has full conversation context with the user and makes delegation decisions.

**What the Senior Dev does:**
- Reads and interprets user prompts
- Runs the Triage Protocol for every substantive prompt
- Dispatches specialists via the Agent tool
- Reviews agent output before finalizing
- Handles lightweight inline tasks (reading code, answering questions, short analysis)

**What the Senior Dev never does inline:**
- Commits (always commit agent — haiku)
- Code review (always code-reviewer agent — haiku)
- Debugging complex errors (always debugger agent — sonnet)
- Planning multi-step work (always planner agent — sonnet)
- Build error resolution (always build-error-resolver — haiku)
- Documentation updates (always doc-updater — haiku)

### Triage Protocol

Injected into CLAUDE.md, runs for every unrouted substantive prompt:

```
1. INTERPRET: What is the user actually asking for?
2. DECOMPOSE: Multiple steps needed? → dispatch planner first
3. MATCH: Check Agent Capability Registry. Can a specialist handle this?
   Yes → dispatch specialist. No → handle inline (lightweight only).
4. MODEL SELECTION: Choose cheapest capable model.
   Routine/mechanical → haiku. Reasoning-heavy → sonnet. Complex arch → opus.
5. LOG: Every dispatch decision → routing-log.jsonl
```

### Agent Capability Registry

Decision-oriented format in CLAUDE.md organized by "when you see this, dispatch this":

**HAIKU AGENTS** (cheap, fast — always prefer):
- commit, code-reviewer, build-error-resolver, auto-stager, refactor-cleaner, doc-updater, chain-reporter, db-reader

**SONNET AGENTS** (deeper reasoning — complex tasks):
- planner, debugger, test-writer, security, researcher, architect, e2e-runner, qa-reviewer, readme-writer

### Enforcement Layers

```
Layer 1 (soft):   CLAUDE.md triage protocol + capability registry
Layer 2 (medium): route.sh context injection — strengthened no-match fallback
Layer 3 (medium): PostToolUse hook — after Write/Edit, remind to dispatch code-reviewer
Layer 4 (medium): Stop hook — audit agent usage before session ends
Layer 5 (hard):   git-commit-intercept.sh — blocks raw git commit (exit code 2)
```

### Routing Log Extension

New action type `senior_dev_dispatch`:

```json
{
  "timestamp": "...",
  "prompt_preview": "keybindings page is broken",
  "action": "senior_dev_dispatch",
  "matched_route": "debugger",
  "command": null,
  "pattern": null,
  "agentName": "debugger",
  "agentModel": "sonnet",
  "reasoning": "Bug report → debugger agent"
}
```

### Dashboard Changes (Phase 1)

- Routing parsers recognize `senior_dev_dispatch` action
- Top Dispatched Agents: third badge type (`senior dev` alongside `hook` and `auto`)
- Recent Routing Events: show reasoning field
- Miss rate denominator accounts for new action type
- HomeView CAST System section: showcase Senior Dev delegation model
- README: rewrite to feature Senior Dev architecture as headline capability

## Files Modified

### claude-agent-team repo
| File | Change |
|------|--------|
| `~/.claude/CLAUDE.md` | Triage Protocol, Agent Capability Registry, "never inline" rules |
| `scripts/route.sh` | Strengthen no-match fallback language |
| `config/routing-table.json` | Expand patterns to reduce regex misses |
| `scripts/post-write-review.sh` | NEW — PostToolUse hook for code-reviewer reminder |
| `~/.claude/settings.local.json` | Register new PostToolUse hook, strengthen Stop hook |

### claude-code-dashboard repo
| File | Change |
|------|--------|
| `server/parsers/routing.ts` | Recognize `senior_dev_dispatch`, parse reasoning field |
| `server/parsers/agentDispatches.ts` | Handle new action type in stats |
| `src/types/index.ts` | Add `senior_dev_dispatch` to RoutingEvent action union, add reasoning field |
| `src/views/SystemView.tsx` | Third badge type, reasoning display in recent events |
| `src/views/HomeView.tsx` | Showcase Senior Dev model in CAST System section |
| `README.md` | Rewrite to feature Senior Dev architecture |

## Phase 2 (Deferred)

- Live View war room with delegation chains
- Senior Dev card in CAST Architecture diagram
- Token savings tracking (haiku vs sonnet cost comparison)
- Agent model usage breakdown
- Delegation chain visualization

## Success Criteria

1. Haiku agents appear in dashboard analytics (commit, code-reviewer show utilization)
2. Routing stats show `senior_dev_dispatch` events alongside `dispatched` and `agent_dispatch`
3. Miss rate reflects actual routing gaps, not delegation gaps
4. README and HomeView clearly communicate the Senior Dev delegation model
5. PostToolUse hook fires after Write/Edit, reminding to dispatch code-reviewer
