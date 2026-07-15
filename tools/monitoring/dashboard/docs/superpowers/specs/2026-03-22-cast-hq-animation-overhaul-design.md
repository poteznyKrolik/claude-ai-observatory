# CAST HQ Animation Overhaul — Design Spec
**Date:** 2026-03-22
**Status:** Approved
**Session:** Phase 3 animation overhaul + character upgrade

---

## Context

The CAST HQ office scene (AgentOffice.tsx) currently shows 28 agents at department desks with a walk-to-cubicle mechanic when agents go active. The office is functional but static — agents all bounce in sync, sprites are generic archetype recolors, and the environment lacks visual depth. The goal is to make it feel like a **living, animated office** where each agent is a distinct character.

User choices made during brainstorming:
- **Plumbob style:** Pixel diamond (A) — 5×5 CSS grid, `steps()` animation
- **Character approach:** 28 unique sprites (B) — fully distinct persons, not archetype recolors
- **Sprite resolution:** 16×20 pixel grid (bigger, more detail, same screen size at scale=2)
- **Scope:** Full overhaul (all 6 features + sprites in one plan)

---

## Architecture

### Files Modified
| File | Change |
|---|---|
| `src/utils/agentPersonalities.ts` | Replace 7 archetype templates with 28 unique 16×20 sprite grids |
| `src/components/AgentOffice.tsx` | Plumbobs, staggered idle, walk animation, thought bubbles, richer background, drawer trigger |
| `src/index.css` | New keyframes: `agent-walk`, `plumbob-float`, `thought-bubble-pop` |

### New File
| File | Purpose |
|---|---|
| `src/components/AgentDetailDrawer.tsx` | Framer Motion slide-in panel, agent details on click |

### Unchanged
- `src/components/PixelSprite.tsx` — already generic, handles any grid size
- `src/components/LiveAgentsPanel.tsx` — unchanged
- `src/components/DelegationChain.tsx` — unchanged

### Scale Adjustments
Current sprites: 8×10 at `scale=2` (standby = 16px wide) and `scale=3` (cubicles = 24px wide).
New sprites: 16×20 at `scale=2` everywhere = 32px wide.
- Standby desks: `scale=2` → **32px wide** (up from 16px — doubles in size, fills desk area better)
- Active cubicles: `scale=2` → **32px wide** (up from 24px — slight increase, more readable)
- This is a deliberate size increase at both breakpoints, not preservation of current size.

---

## Feature 1: 28 Unique 16×20 Sprites

Replace 7 shared archetype templates with 28 individual sprite designs in `agentPersonalities.ts`.

**Palette (unchanged):** `.` transparent · `K` outline · `B` accent · `S` skin · `E` eye · `W` white
**Grid format:** 20-element string array, each string 16 chars wide

**`buildGrid()` requires one fix:** Line 34 currently does `row.padEnd(8, '.')` — hardcoded to 8 columns. Update to derive column count from the first template row:
```typescript
function buildGrid(template: string[], accent: string): string[][] {
  const cols = template[0]?.length ?? 8  // derive from template, not hardcoded
  const palette = { '.': _, K: K, B: accent, S: S, E: E, W: W }
  return template.map(row =>
    [...row.padEnd(cols, '.')].map(ch => palette[ch] ?? _)
  )
}
```
This is a one-line fix that maintains backward compatibility with all existing 8-wide templates.

**Character identity guide:**
| Dept | Agent | Visual Identity |
|---|---|---|
| Core | planner | Wizard hat, scroll/clipboard on chest |
| Core | debugger | Wide fedora brim, magnifying glass detail |
| Core | test-writer | Lab coat, checklist badge |
| Core | code-reviewer | Detective coat, monocle/eyeglass |
| Core | data-scientist | Lab coat, flask + chart icon |
| Core | db-reader | Lab coat, database cylinder icon |
| Core | commit | Mortarboard, ribbon/medal on chest |
| Core | security | Tactical hood, shield emblem |
| Extended | architect | Tall wizard hat (blueprint variant), ruler |
| Extended | tdd-guide | Hard hat, test tube prop |
| Extended | build-error-resolver | Hard hat + wrench, tool belt |
| Extended | e2e-runner | Hard hat, browser/cursor icon |
| Extended | refactor-cleaner | Hard hat, broom prop |
| Extended | doc-updater | Mortarboard, open book |
| Extended | readme-writer | Mortarboard, scroll/quill |
| Extended | router | Hood, routing arrows on chest |
| Productivity | researcher | Magnifying glass, notebook |
| Productivity | report-writer | Mortarboard, report stack |
| Productivity | meeting-notes | Mortarboard, notepad |
| Productivity | email-manager | Operative hood, envelope icon |
| Productivity | morning-briefing | Mortarboard, coffee cup |
| Professional | browser | Hoodie, cursor/pointer icon |
| Professional | qa-reviewer | Detective coat, clipboard |
| Professional | presenter | Operative hood, mic prop |
| Orchestration | orchestrator | Commander visor, crown accent |
| Orchestration | auto-stager | Hard hat, staging platform |
| Orchestration | chain-reporter | Scribe cap, chain-link icon |
| Orchestration | verifier | Lab coat, checkmark badge |

---

## Feature 2: Pixel Diamond Plumbob

**Placement:** Above the sprite inside the **cubicle card** (not the standby desk — active agents have already left their desk when `status === 'active'`, so the standby sprite is replaced by `AwayDesk` and there is nothing to float above). The plumbob renders inside `CubicleCard`, positioned absolute above the sprite.
**Shape:** 5×5 CSS grid diamond (4 filled pixels forming a diamond, 1 highlight pixel)
**Color:** Agent `accentColor`
**Animation:** `@keyframes plumbob-float` with `steps(3)`, 1.2s cycle, -3px to 0 translateY
**Visibility:** Rendered as part of `CubicleCard` — always visible for any active agent in a cubicle
**Wrapper:** `position: 'relative'` on cubicle sprite container; plumbob is `position: 'absolute', top: -14, left: '50%', transform: 'translateX(-50%)'`

**During walk state only:** While an agent is in the brief `'walking'` intermediate state (still visible at their desk), show a smaller (3×3) plumbob variant above the desk sprite to signal "going active." This is optional — implement only if it reads well visually.

```css
@keyframes plumbob-float {
  0%   { transform: translateX(-50%) translateY(0px); }
  33%  { transform: translateX(-50%) translateY(-3px); }
  66%  { transform: translateX(-50%) translateY(-2px); }
  100% { transform: translateX(-50%) translateY(0px); }
}
```

---

## Feature 3: Staggered Idle Animations

**Problem:** All 28 agents currently bounce with the same 3s timing — looks like a marching band.
**Solution:** Per-agent deterministic animation delay derived from name character sum.

```typescript
function getIdleDelay(name: string): number {
  const sum = [...name].reduce((acc, ch) => acc + ch.charCodeAt(0), 0)
  return (sum % 20) / 10  // 0.0–1.9 seconds, deterministic per agent
}
```

Applied as `animationDelay: \`${getIdleDelay(agent)}s\`` on each sprite's style.
No React state — pure computation from agent name.

---

## Feature 4: Walking Entry Animation

**Trigger:** Agent status transitions from `standby` → `active`
**Sequence:**
1. Agent enters `'walking'` intermediate state (200ms)
2. Sprite plays `@keyframes agent-walk` — step-function translateX giving a 2-frame walk cycle
3. After 200ms, state advances: `AwayDesk` replaces `AgentDesk`, cubicle card animates in

**Implementation:** `useEffect` watching `statusMap`, tracking previous status in a ref. When a transition is detected, briefly set a `walkingAgents: Set<string>` state, then clear after timeout.

```css
@keyframes agent-walk {
  0%   { transform: translateX(0px); }
  25%  { transform: translateX(3px); }
  50%  { transform: translateX(0px); }
  75%  { transform: translateX(3px); }
  100% { transform: translateX(6px); }
}
/* Applied with steps(2), 200ms duration, once */
```

**Timing note:** The `AgentDesk` exit transition must be set to an explicit fixed duration to avoid a race with the walk animation. Add `transition={{ duration: 0.15 }}` (150ms) to the `AgentDesk` Framer Motion exit so it's deterministic. The walk animation fires for 200ms, then the desk exits — 200ms > 150ms so the desk is always still mounted during the walk. Do not rely on default spring durations (which are variable).

---

## Feature 5: Thought Bubbles

**Placement:** Above sprite in active cubicle cards
**Content:** 4-char keyword extracted from `taskDesc`
**Extraction logic:**
```typescript
function extractKeyword(taskDesc?: string): string {
  if (!taskDesc) return '...'
  const skip = new Set(['the', 'a', 'an', 'is', 'are', 'for', 'and', 'or'])
  const word = taskDesc.toLowerCase().split(/\s+/).find(w => w.length > 2 && !skip.has(w)) ?? '...'
  return word.slice(0, 4).toUpperCase()
}
```

**Display:** Keyword slot is fixed 4 chars wide (monospace, `Press Start 2P`). Short words display as-is (e.g., "RUN", "FIX"). If all tokens are stopwords or single chars, display `'....'`. No ellipsis truncation — just slice to 4.
**Visual:** CSS thought bubble — 3 small dots (`•••`) leading to a rounded rect with the keyword. Dots and rect use `accentColor` at 60% opacity.
**Animation:** `@keyframes thought-bubble-pop` — scale 0 → 1 with `cubic-bezier(0.34, 1.56, 0.64, 1)` spring-like bounce, 300ms delay after cubicle entry

---

## Feature 6: Richer Office Background

**Floor tiles:** `repeating-linear-gradient` crosshatch added to office container
```css
background: repeating-linear-gradient(
  90deg, rgba(255,255,255,0.02) 0px, transparent 1px, transparent 8px
), repeating-linear-gradient(
  0deg, rgba(255,255,255,0.02) 0px, transparent 1px, transparent 8px
), /* existing scanlines */, #070A0F
```

**Overhead lighting:** Horizontal gradient strips positioned every ~80px using a `repeating-linear-gradient` at 0deg, `rgba(255,255,255,0.012)` centered on each strip.

**Water cooler:** Static `PixelSprite` in the bottom-right corner of the office using an 8×12 decorative pixel art template (blue bottle, gray base). No interaction. Pass a hardcoded `accent='#60A5FA'` (blue) to `buildGrid()` — the water cooler is not agent-themed. Define its template directly in `AgentOffice.tsx` as a module-level constant, not in `agentPersonalities.ts`.

---

## Feature 7: Agent Detail Drawer

**File:** `src/components/AgentDetailDrawer.tsx`
**Trigger:** Click on any agent sprite (standby desk or cubicle card) sets `selectedAgent: string | null` state in `AgentOffice`
**Animation:** Framer Motion `motion.div`, `initial={{ x: '100%' }}`, `animate={{ x: 0 }}`, slide from right
**Close:** Click backdrop or press Escape (`useEffect` keydown listener)

**Content:**
- Agent name + role title (from `agentPersonalities.ts`)
- Tagline
- Model tier chip (haiku/sonnet/opus badge from `getModelTier()`)
- Routing command (e.g., `/debug`, `/plan`) — stored as new field in personality data
- Recent task descriptions: sourced from `useLiveAgents()` (current task for active agents) and `useRoutingStats()` routing events filtered by agent name for history. Do NOT use `useRoutingStats()` aggregate stats shape directly — filter the raw `events` array for entries where `agentType === agentKey`.
- Accent color theming throughout (border, chip, highlight)

**New field in `AgentPersonality`:**
```typescript
routingCommand: string  // e.g., '/debug', '/plan', '/commit'
```
All 28 agent entries in `agentPersonalities.ts` must be updated with this field, including the `'general-purpose'` fallback entry (use `routingCommand: ''` for fallback — renders as "No command" in drawer).

---

## CAST Note

**Observed issue:** In this planning session, CAST agent routing (route.sh + PostToolUse hooks) did not dispatch specialized agents. Most work was done inline by the Senior Dev. This is a known issue from the previous session. A separate diagnostic session should investigate:
- Whether route.sh is firing on user prompts
- Whether the code-review-gate PostToolUse hook is triggering
- Check `~/.claude/routing-log.jsonl` after prompts to verify routing events

This is out of scope for the animation overhaul — log it separately.

---

## Verification

**Automated:**
- Add a test in `src/utils/agentPersonalities.test.ts`: for every agent key in `AGENT_PERSONALITIES`, assert that `getSprite(key)` returns a non-empty `string[][]` with rows of consistent length. This catches malformed 16-char templates at build time.
- `npm run build` — TypeScript must be clean; `routingCommand` on all entries enforced by type system.

**Manual:**
1. `npm run dev` — both Vite (5173) and Express API (3001) start clean
2. Open dashboard → Agents tab → CAST HQ Office visible
3. Confirm 28 unique sprites render at 32px wide (scale=2, 16-col grid)
4. Trigger an agent (run a task) — verify:
   - Agent briefly plays walk animation at desk before desk becomes AwayDesk
   - Cubicle card appears with plumbob above sprite and thought bubble
   - Idle standby agents bounce at visibly different phases (staggered)
5. Click any agent sprite → detail drawer slides in from right with correct data
6. Press Escape or click backdrop → drawer closes
7. Check office background for floor tile crosshatch and subtle lighting strips
8. Verify water cooler pixel art renders in office corner (blue, static)
