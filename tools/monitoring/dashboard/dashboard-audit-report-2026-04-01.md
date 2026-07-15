# Dashboard Audit Report
## Date: 2026-04-01
## CAST Session Notes:
- All 11 agents completed successfully across Phases 1–4.
- User reported mid-session that the Activity page (`/activity` → LiveView) is "out of date with swarm logic." No specifics were provided before the report was written. This is a **known gap** — LiveView issues are extensively documented below, but the specific CAST event schema drift is not characterized. Treat the LiveView refactor as the top implementation priority and investigate the event schema mismatch first.
- No inline analysis performed by orchestrator.

---

## Critical — Crashes or Data Failures

1. **No 404 catch-all route** — `App.tsx` has no `<Route path="*">` handler. Navigating to any undefined path (e.g., `/invalid`, mistyped bookmark) renders a completely blank page with no error message, no navigation, no recovery path. User is stranded.

2. **SessionDetailView crashes on empty entries array** — `SessionDetailView.tsx:229–230` assigns `firstEntry = entries[0]` and `lastEntry = entries[entries.length - 1]`. Lines 291 and 299 then call `timeAgo(firstEntry.timestamp)` and read `firstEntry.gitBranch` without verifying `firstEntry` is defined. If `entries` is empty (edge case: session with no events), this throws `Cannot read property 'timestamp' of undefined` and unmounts the view.

3. **SessionDetailView crashes on empty toolUsage** — `SessionDetailView.tsx:391` renders `toolUsage[0].count` inside a `.map()` over `toolUsage`. The outer guard at line 380 (`toolUsage.length > 0`) protects the block, but the inner `.map()` still accesses index 0 unconditionally. Any mutation of `toolUsage` between guard and render (or a concurrent update) would crash with `Cannot read property 'count' of undefined`.

4. **AnalyticsAgentDetailView crashes on missing last_runs** — `AnalyticsAgentDetailView.tsx:234` calls `data.last_runs.map(...)` without verifying `data.last_runs` exists. If the API returns an agent object without a `last_runs` field (new agent, API regression), this throws immediately.

5. **No global Express error handler** — `server/index.ts` has no `app.use((err, req, res, next) => {...})` catch-all. Unhandled exceptions in route handlers crash the process or return opaque responses. Any uncaught `throw` in a route returns nothing useful to the frontend.

6. **runsData fetched but result silently discarded** — `LiveView.tsx` fetches `runsData` and passes it to `buildCompletedChains()`, but the return value is not used. This is dead computation on every query refresh with no benefit. Comment says "used for future HistoryStrip" — that feature doesn't exist.

---

## High — Broken UX or Silent Failures

1. **10 dead components never imported anywhere** — `AgentDetailOverlay`, `IntelPanel`, `CASTFlow`, `DelegationDiagram`, `LiveAgentsPanel`, `PageTransition`, `RoomNav`, `SidePanel`, `AgentDetailDrawer`, `AgentOfficeStrip` are defined but have zero imports across the entire codebase. They add cognitive overhead and confuse the component map.

2. **Entire LiveGraph suite is dead** — `src/components/LiveGraph/` contains `LiveGraphView`, `SessionInfoBar`, `DetailPanel`, `AgentGraphNode`, `SessionNode`, and `graphTransform.ts`. None are imported. This folder exists only as a dead visualization feature. `@xyflow/react` and `@nivo/network` are installed solely for this dead code.

3. **Silent error swallowing in 4 critical flows** — `PlansView.tsx` silently ignores plan content load failures (user sees spinner stop, no message), silently swallows plan execution polling errors (user stares at "launching..." forever), and only shows a browser `alert()` for execution failures. `SessionDetailView.tsx` silently swallows export failures (no feedback on click). These are silent failures that break user trust.

4. **Raw error messages surfaced to users** — `AnalyticsAgentDetailView.tsx:130` shows `error.message` directly. `SessionsView.tsx:185` concatenates raw error message. `ErrorBoundary.tsx:38` renders `error.message` in monospace. None of these are user-friendly.

5. **Race conditions on 5 fetch paths** — `PlansView` plan expansion, `DispatchModal` agent list fetch, `AnalyticsView AgentScorecard`, `KnowledgeView` file viewer, and `MemoryBrowserView` backup trigger all fire `fetch()` with no `AbortController`. Rapid open/close or repeated clicks create concurrent in-flight requests; last response wins, leading to stale state.

6. **1-second full re-renders in SessionGroupList and ActiveAgentsBar** — Both components use `setInterval(() => setTick(t => t + 1), 1000)` to force re-renders for elapsed time display. Every child component (AgentCard, session rows, agent badges) re-renders every second even with unchanged data. No `React.memo` on any of these children. This is continuous DOM thrashing on the Activity page.

7. **setTimeout without cleanup in LiveView event handler** — `LiveView.tsx:453` calls `setTimeout(() => setChains(...), 2000)` inside `handleEvent`. If the component unmounts while the timeout is pending, this attempts to setState on an unmounted component (dev warning, potential memory leak).

8. **No SSE reconnection UI** — When the backend becomes unreachable, the `EventSource` transitions to `CLOSED` state. The sidebar still shows "Connected" (static green dot). There is no reconnection attempt, no UI indicator of lost connection, and no error state shown on the Activity page.

9. **ErrorBoundary catches but never logs** — `ErrorBoundary.tsx` renders the fallback UI but has no `console.error`, no error tracking, and no telemetry. Render errors are invisible in production unless a user happens to see the fallback and reports it.

10. **No authentication on destructive API endpoints** — Designed for local use, but `/api/control/rollback`, `/api/control/dispatch`, all session DELETEs, and memory writes are completely unprotected. Anyone who can reach the server port can delete data or trigger git rollbacks.

---

## Medium — Code Quality & DRY Violations

1. **`StatusBadge` component defined 3 separate times** — `AnalyticsAgentDetailView.tsx`, `RoutingLogView.tsx`, and `SqliteExplorerView.tsx` each define their own badge with identical JSX structure (`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium`). A single shared `<StatusBadge>` component should replace all three.

2. **`BADGE_COLORS` and `getBadgeColor()` defined 3 separate times** — `LiveFeedPanel.tsx:9–24`, `ActiveAgentsBar.tsx:8–29`, and `SessionGroupList.tsx:5–26` each hardcode the same 10-entry agent/role color map. If any agent color changes, 3 files must be updated. This should live in `agentPersonalities.ts` or `agentCategories.ts`.

3. **Date/time formatting has 5+ parallel implementations** — `utils/time.ts` exports `timeAgo()` and `formatDuration()` but views ignore it. `LiveFeedPanel.tsx:26` reimplements `timeAgo()`, `MemoryBrowserView.tsx:8` has `relativeTime()`, `QualityGatesView.tsx:10` has `formatTs()`, `AnalyticsAgentDetailView.tsx:24` has `formatDuration()`, `formatCost()`, and `formatTokens()` — all duplicates of `utils/costEstimate.ts`. One date utility module should own all formatting.

4. **`apiFetch.ts` used by only 7 of 47 API hooks** — The other 40 hooks each manually implement `if (!res.ok) throw new Error(...)`. The shared utility exists; it just isn't used consistently.

5. **`AgentStatus` type defined in 2 places with diverging values** — `StatusPill.tsx:3` defines the union without `'pending'`; `AgentStage.tsx:4` adds it. This fragmentation will cause type errors as the live view evolves. Canonical definition belongs in `src/types/index.ts`.

6. **Four oversized view files** — `HomeView.tsx` (1,135 lines), `LiveView.tsx` (773 lines), `AnalyticsView.tsx` (764 lines), `SystemView.tsx` (723 lines). Each violates single responsibility by mixing data fetching, state management, event handling, and rendering.

7. **15+ inline component definitions** — `DispatchChain.tsx` alone defines 4 components (`AgentChip`, `SubAgentSection`, `SessionCard`, `AgentSummaryPills`) inside itself. `PrivacyPanel.tsx` defines 3 (`CallRow`, `PanelHeader`, `StatCard`). These cause remount on every parent render.

8. **`AnalyticsView AgentScorecard` uses raw `fetch()` in `useEffect`** — Instead of a React Query hook, this component manages its own `loading`/`error`/`data` state with a manual fetch. It doesn't participate in cache invalidation from `useDbChangeInvalidation`. If the DB changes, AgentScorecard won't update until the component remounts.

9. **`twoHoursAgo` useMemo with empty dependency array** — `LiveView.tsx:277–279` computes a 2-hour-ago timestamp once at mount and never recalculates. After 2+ hours, the "live" window stops sliding.

10. **Index keys in AnalyticsAgentDetailView and RoutingLogView** — `data.last_runs.map((run, i) => <RunRow key={i}>` and `events.map((_, i) => <Fragment key={i}>` use array index. If lists reorder, React will remount wrong components.

11. **Hardcoded hex colors throughout** — `#00FFC2`, `#1A1D23`, `#070A0F`, `#E6E8EE`, and others appear 20+ times in inline styles and chart configs instead of using the CSS custom properties defined in `index.css`.

---

## Low — Polish & Nice to Have

1. **CommandPalette cannot navigate to main routes** — Cmd+K → "analytics" or "system" returns nothing. The palette only searches entities (sessions, agents, plans, memories), not primary navigation destinations.

2. **Suspense fallback is unstyled plain text** — `<div className="p-8 text-[var(--text-muted)]">Loading...</div>` on every route transition. No spinner, no skeleton, no animation.

3. **Both Knowledge and Rules use the same `BookOpen` icon** in Sidebar.tsx. Visually identical nav items for different concepts.

4. **No breadcrumb or "current section" indicator** for detail views — when browsing `/agents/:name`, nothing in the sidebar indicates you're under Agents.

5. **BudgetBanner hardcodes Toaster styles** — `main.tsx:22–27` hardcodes `background: '#1A1D23'`, `border: '1px solid rgba(255,255,255,0.08)'`, `color: '#E6E8EE'` instead of using CSS variables.

6. **No `.env.example`** — There is no documentation of which environment variables the server reads (`CORS_ORIGIN`, `CLAUDE_PATH`, `HOME`). New contributors have no reference.

7. **`shadcn` listed as a runtime dependency** — It's a CLI tool and should be in `devDependencies`.

8. **`execSync()` pattern in `memory.ts`** — Uses `execSync()` with a template literal for the backup script. Should use `execFile()` with array arguments as a best practice.

---

## Purge List — Safe to Delete

**Dead Components (0 imports, safe to delete):**
- `src/components/AgentDetailOverlay.tsx`
- `src/components/AgentDetailDrawer.tsx`
- `src/components/AgentOfficeStrip.tsx`
- `src/components/CASTFlow.tsx`
- `src/components/DelegationDiagram.tsx`
- `src/components/IntelPanel.tsx`
- `src/components/LiveAgentsPanel.tsx`
- `src/components/PageTransition.tsx`
- `src/components/RoomNav.tsx`
- `src/components/SidePanel.tsx`
- `src/components/LiveGraph/` (entire folder: `LiveGraphView.tsx`, `SessionInfoBar.tsx`, `DetailPanel.tsx`, `AgentGraphNode.tsx`, `SessionNode.tsx`, `graphTransform.ts`)

**Unused Imports:**
- `AnimatedGridPattern` import in `HomeView.tsx`
- `useSeed` import in `AnalyticsView.tsx`
- `useRoutingEventsByType` import in `AnalyticsView.tsx`
- `useAutoAnimate` hook in `AgentsView.tsx` (imported and assigned but never applied to any element)

**Dependencies to Remove (`package.json`):**
- `@nivo/core` — no direct usage found
- `@nivo/network` — only used in dead `CASTFlow.tsx`
- `@xyflow/react` — only used in dead `LiveGraph/` suite
- `gray-matter` — no imports found anywhere in source

**Dependencies to Move to `devDependencies`:**
- `shadcn` — CLI tool only, not a runtime import

**Misplaced Directory:**
- `~/` directory at project root — Claude Code worktree artifact, not application code

---

## Addition List — What's Missing

**Priority 1 — Critical gaps:**
1. **404 catch-all route** — `<Route path="*" element={<NotFoundView />} />` in `App.tsx`
2. **Global Express error handler** — `app.use((err, req, res, next) => {...})` in `server/index.ts`
3. **Error logging** — At minimum: `console.error` inside `ErrorBoundary.componentDidCatch()`; structured error response format from API routes
4. **AbortController in 5 fetch paths** — PlansView plan expansion, DispatchModal agents fetch, AnalyticsView AgentScorecard, KnowledgeView file viewer, MemoryBrowserView backup trigger

**Priority 2 — High-value additions:**
5. **SSE reconnection detection** — Detect `EventSource` `CLOSED` state and show a "Reconnecting..." banner; auto-retry on disconnect
6. **Centralized constants file** — `src/constants.ts` for `COLORS`, `ANIMATION_DURATIONS`, `STATUS_VALUES`, `MODEL_TIERS`, `QUERY_KEYS`
7. **Shared `<StatusBadge>` component** — Replaces 3 duplicate implementations
8. **Shared agent badge color utility** — Single source of truth for `BADGE_COLORS` / `getBadgeColor()`; `agentPersonalities.ts` should be authoritative
9. **`useInterval` custom hook** — Replace 4 identical `setInterval` + `setTick` patterns across `SessionGroupList`, `ActiveAgentsBar`, `AgentStage`, `LiveFeedPanel`
10. **`React.memo`** on `AgentCard`, `SessionGroupList` row items, `FeedCard`, `ActiveAgentsBar` agent items — prevents the 1-second tick from cascading to all children

**Priority 3 — Developer experience:**
11. **`.env.example`** documenting `CORS_ORIGIN`, `CLAUDE_PATH`
12. **CommandPalette nav routes** — Add primary nav items to command palette so Cmd+K → "analytics" works
13. **Expand `utils/time.ts`** — Consolidate all date/time formatting under one module; delete local reimplementations in views

---

## Restructure List — What's in the Wrong Place

1. **LiveView event handling** — `handleEvent` (375 lines inside `useCallback`) should be extracted into a `useDispatchChains(onEvent)` custom hook. The timer-based stale-marking should use the new `useInterval` hook. *This is also where the CAST event schema drift issue lives — the schema update should target this hook.*

2. **HomeView** — Split into: `HeroSection`, `FeaturesGrid`, `InstallationGuide`, `SystemStats`. Static data (`features` array, `installSteps`) should move to a co-located data file, not live inline.

3. **AnalyticsView `AgentScorecard`** — Extract data fetching into `useAgentProfile()` React Query hook (consistent with rest of codebase). Removes the only manual `useState/useEffect` fetch pattern in views.

4. **SystemView `CronSection`** — Extract `CronForm` and `CronEntryList` as separate components; extract `extractCronCommand()` and `isValidCronSchedule()` to `utils/`.

5. **`DispatchChain.tsx` inline components** — `AgentChip`, `SubAgentSection`, `SessionCard`, `AgentSummaryPills` each cause remount on parent render. Extract to separate exports.

6. **`AgentStatus` type** — Remove from `StatusPill.tsx` and `AgentStage.tsx`. Define once in `src/types/index.ts` with canonical set of values.

7. **API layer** — Migrate all 40 remaining hooks from raw `fetch()` to `apiFetch.ts`. Makes error handling uniform and simplifies future API base URL changes.

8. **`formatCost()` / `formatTokens()` / `formatDuration()`** — Remove local reimplementations in `AnalyticsAgentDetailView` and `TokenSpendView`. Import from `utils/costEstimate.ts` exclusively.

---

## CAST Session Failure Log

- **LiveView / Activity page schema drift** — User reported mid-session that the Activity page is out of date with the current CAST swarm logic. The audit documents extensive LiveView code health issues, but the specific CAST event type changes or agent dispatch schema that LiveView is missing were not investigated. This is a **known unresolved gap**. The resume command below addresses it as the first implementation task.

---

## Recommended Next Step

LiveView is broken by user report AND is the largest source of technical debt (773 lines, 15+ architectural issues, stale event handling). Fix the Activity page first: investigate the CAST event schema drift, then refactor `handleEvent` into `useDispatchChains`, add React.memo to list children, fix the stale `twoHoursAgo` window, and add the setTimeout cleanup.
