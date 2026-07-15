## [2.7.0] — 2026-07-04

**Security, performance & test-coverage remediation** — resolves the 21 findings from the 2026-07-04 CAST audit (`~/.claude/reports/cast-audit-2026-07-04-dashboard.md`). Every finding was adversarially verified before it was fixed, and each fix ships with tests.

### Security

- **Path traversal in memory PUT/DELETE (S1)** — `agentName` was unvalidated, so `..` escaped `agent-memory-local` and a control-token-holding operator could overwrite/delete existing files (e.g. `cast.db`, `settings.json`). Now validated (`/^[A-Za-z0-9_-]+$/`) and confined via `safeResolve`.
- **Raw error text no longer leaked (S2)** — the global error handler returns a generic message for 5xx (logging the real error server-side only); 4xx keep their deliberate validation messages. The `memory` backup-trigger no longer echoes `String(err)`.
- **Crontab written without a shell (S3)** — cron add/delete now pipe the new crontab to `crontab -` via a spawned process's stdin instead of `bash -c "echo … | crontab -"`, so pre-existing crontab lines containing `$(…)`/backticks are never re-evaluated.

### Fixed

- **Executive-summary "vs prior" percentage (B1)** — on the `today` range it divided a 7-day sum by a single prior day; numerator and denominator now always span equal-length windows.
- The primary JSONL chokidar watcher is now closed on shutdown alongside the others (B5); the SSE consumer guards `JSON.parse` so a malformed frame is skipped instead of throwing in the `EventSource` handler (B6).

### Performance

- **SSE producer (P1/P3)** — the JSONL watcher reads only the file tail (256 KB, with a full-read fallback for oversized entries) and caches per-file agent identity instead of re-reading multi-MB files on every append; the active session file is tracked incrementally so each SSE connection replays without a full per-connection directory stat sweep.
- **Session scan (P2/P5)** — the `~/.claude/projects` full-tree scan is cached for 10s and shared across the hot read routes (sessions/search/analytics/config) and `jsonlTokenTotals` instead of re-scanning on every request; the dominant-model fallback reuses a candidate from the single existing parse loop.
- **SessionDetailView (P4)** — the timeline is virtualized (`useVirtualizer`, dynamic measurement) and its aggregates memoized, so long sessions mount a bounded number of DOM nodes.

### Removed

- Dead code (B2/B3/B4): the unconsumed managed-agents feature (frontend hook, the `/api/managed-agents` route, and its now-orphan `EXPECTED_SCHEMA` entry), three orphan UI components (`hover-card`, `scroll-area`, `SpotlightCard`), and unused `time` exports (`relativeTime`, `timeAgoFromMs`).

### Tests

- New coverage for the security-critical primitives and engines the audit found untested (C1–C7): `safeResolve`, the `castExec` route, the **real-app** control-gate wiring (imports `server/index.ts` — which now exports `app` and guards startup behind `!process.env.VITEST`), the `verifySchema` drift detector, the memory-router traversal guards, the SSE tail-read logic, the `sqliteExplorer` route, the `castDbWatcher` live engine, and `SessionDetailView` render states. An `AnalyticsView` render test was deferred (its mount-time effects hang under jsdom).

## [2.6.0] — 2026-07-02

**CAST v9 canonical stabilization** — driven by a full audited sweep of the dashboard against CAST v9 (172 SQL queries, 122 live-exercised endpoints, 22 views element-audited; report: `docs/audits/2026-07-02-v9-system-audit.md`).

### Changed

- **Schema war ended — the dashboard is now canonical-strict.** The startup auto-seed silently re-added six columns the CAST canonical schema had dropped (`sessions.total_input_tokens/total_output_tokens/total_cost_usd/model`, `agent_runs.prompt/project`) on every boot — the root cause of CAST's recurring "orphan column" re-drops (flagship migration 026). Removed entirely: the server performs **zero DB writes at startup**; cast.db schema is owned exclusively by CAST's `cast-db-init.sh`; seeding never creates or alters tables and fails closed (503) on a missing/uninitialized DB (`server/index.ts`, `server/routes/seed.ts`, `scripts/seed-cast-db.ts`)
- Task summaries now source from the canonical `dispatch_decisions.prompt_snippet` (correlated subquery, `unixepoch`-matched) instead of the dropped `agent_runs.prompt` — across agent-runs, session-agents, active-agents, analytics profile, routing events, and work-log (`task_summary` is now nullable)
- `schemaGuard` now certifies the canonical v9 contract (drifted columns removed from `EXPECTED_SCHEMA`; `dispatch_decisions` added)

### Fixed

- **`GET /api/cast/task-queue` 500** — selected a column that exists in neither canonical nor live schema; 1,503 queue rows were invisible
- **Live agent-run SSE updates never fired** — `castDbWatcher` selected the dropped `agent_runs.batch_id` and threw (silently) on every 3s poll since the drop; live query invalidation works again
- **Session soft-delete and budget save had never worked** — both wrote through the read-only DB handle and always returned 500; now use a writable connection (and sit behind the control gate)
- **Budget invisible while over budget** — `scope_key` producer/consumer mismatch (`'*'` vs `'global'`) hid the configured daily limit from the Analytics budget line
- **Timestamp-format bug class** — CAST mixes ISO-`T` and SQLite space-format timestamps; lexicographic comparisons made the active-agents "15-minute" filter match the whole day (26 phantom actives), the SSE "2-hour" window mean "same UTC day", and executive-summary gate pass-rate return empty for `today`. All SQL windows now compare via `unixepoch()`; client dates parse space-format as UTC (`parseTimestamp()` in `src/utils/time.ts`)
- **Work-log duplicated agent runs** — truncations join keyed on non-unique `(session_id, agent_type)` fanned 5,891 runs into 9,720 rows and inherited false truncation banners; re-keyed on `agent_id` (same run-level fix for the analytics `is_truncated` flag)
- Executive summary: unsatisfiable prior-window predicate made the cost delta permanently null for `today`
- Swarm messages endpoint 500'd on every request (queried the v9-retired `teammate_messages` table unguarded); now table-guarded and returns empty
- HomeView headline undercounted agent runs 3.6× (page length vs `stats.totalRuns`); active count now from `stats.byStatus`
- Model economics refreshed for the v9 fleet: exact rates + badges for `claude-fable-5`, `claude-opus-4-8`, `claude-sonnet-4-6`, `claude-haiku-4-5` (100/194 live sessions were silently priced via an outdated fallback); removed a nonexistent model id from the rate table
- Eval grader results always showed 0/N (writer emits `status: 'pass'`; UI counted legacy fields); empty-string model renders an em dash
- Completeness severity badges rendered uncolored (case-sensitive compare vs uppercase live data)
- Worktree-anomalies stat card reported the 200-row fetch cap as the total; endpoint now returns `{ anomalies, total }`
- `?limit=-1` bypassed row caps across 14 routes (SQLite treats `LIMIT -1` as unlimited); clamped
- Project-memory timestamps rendered as undefined dates (`modifiedAt`/`lastModified` field mismatch)
- `/api/health` now reports the dashboard `version`; Home footer renders it

### Security

- **Fail-closed control gate now covers every mutating endpoint** (was 3 mounts): seed, budget, task-queue delete, memory delete/backup-trigger, agents/rules writes, hook-events ingest, session delete — non-GET returns 404 when control is disabled (constant-time token check unchanged); GETs stay public. Previously an anonymous local POST could trigger DB writes and even a shell-script execution
- Destructive-endpoint rate-limiter parity for the newly gated mounts

### Docs

- Full v9 system-audit report committed (`docs/audits/2026-07-02-v9-system-audit.md`)
- `CLAUDE.md` read-only/gating contract corrected to match enforced behavior
- README portfolio refresh: v9-accurate content (canonical contract, gating surface, Agent Teams framing), stale claims removed

---

## [2.5.0] — 2026-06-22

### Added

- **New pages:** Outputs view (agent briefings, meetings, reports); Evals page (eval-harness pass@k); Executive summary page (`/executive`)
- **Agent Reliability tabs:** Worktree Anomalies, Protocol Violations, Truncations (surfacing v8 CAST tables)
- **System page:** Managed Agents section (Swarm page), Memory Consolidation section (Memory page), Integrity tab (Litestream health + rate-limit gauge)
- **Agent Reliability enhancements:** dispatch-events wiring, plan-sessions surface, health endpoint
- **Local agent roster:** Installed-count + live/built-in provenance pill on Agents page
- **Dark/light theme toggle:** Top bar, localStorage-persisted, defaults to `prefers-color-scheme`, AA contrast in both themes, no-FOUC (`src/state/themeState.tsx`, `.light` CSS tokens)
- **Design system foundation:** Glass cards, texture, kicker headers, status pill, motion library (`src/lib/motion.ts`)
- **Motion & animation:** Entrance animations on Sessions + Analytics views; equal-height stat cards
- **Brand consistency:** SectionHeader adoption across views
- **Schema integrity:** schemaGuard.ts + schema-contract test (prevents silent data-correctness bugs on route/field name mismatches)

### Fixed

- **Data-correctness bugs:** Executive summary queried wrong columns (plans, hook-failures, quality-gates); dispatch route repointed to `dispatch_events` table; tool-failures route now reads `tool_call_failures` table; SQLite explorer allow-list corrected (`server/routes/*.ts`)
- `PORT` env var now honored by Express server + Vite proxy (`server/index.ts`, `vite.config.ts`)
- Pricing tab field mapping corrected — reads `cost_per_million_input/output` (`src/views/SystemView.tsx`)
- Hook Failures infinite-refetch loop (memoized `since` dep in `useHookFailures`)

### Security

- **Opt-in control surface:** All command-executing endpoints (`/api/control/*`, `/api/castd/*`, `/api/cast/exec`) gated behind `CAST_DASHBOARD_CONTROL=1` env guard + `DASHBOARD_TOKEN` header (constant-time comparison); read-only by default (404 when disabled)
- helmet security headers added
- Rate limiters on `/api/cast/seed` + `/api/cast/exec` endpoints
- Argument validation on castd routes; raw error leakage removed
- Home path relativization in file operations

### Accessibility

- **WCAG 2.1 AA pass:** ARIA tablists with keyboard navigation; modal focus traps + Escape key; focus-visible rings on all interactive elements; `prefers-reduced-motion` support; screen-reader labels on icon buttons, charts, tables (`src/components/Tabs.tsx`, `src/lib/useModalA11y.ts`)
- Contrast ≥ 4.5:1 in light and dark themes

---

## [2.4.1] — 2026-06-05

### Fixed
- Agent roster corrected: 30-agent fallback (including 7 retired agents) replaced with the real 23 v7.4 agents; `eval-writer` and `pr-reviewer` added; `adr-writer`, `email-drafter`, `knowledge-curator`, `learning-scout`, `meeting-prep`, `portfolio-sync`, `pr-narrator`, `standup-writer`, `task-triage` removed (`server/routes/agents.ts`, `src/utils/localAgents.ts`)
- Test updated to assert 23 agents (`src/utils/localAgents.test.ts`)
- Removed dead `/file-writes` route from `server/routes/index.ts` and `src/App.tsx`; deleted orphaned `src/views/FileWritesView.tsx` (CHANGELOG v2.4.0 said page was removed but backend route was never cleaned up)
- Hardcoded absolute path in `server/routes/control.ts` replaced with `CAST_REPO_PATH` env var + `os.homedir()` fallback
- README: broken `/worklog` link → `/work-log`; broken `/sqlite-explorer` → `/system` (DB tab); removed "demo GIF coming soon" placeholder; "Constellation 3D graph" claim removed from cast-desktop description; "Cron-based" scheduling → "launchd (macOS) + RemoteTrigger"; `CAST v4.6 Architecture` heading made version-neutral; `v4.6+` version pins updated to `v7+`
- `src/views/SessionsView.tsx`: stale "CAST v6.0 HTTP hooks" string → "CAST hooks"
- `docs/LIVE_ACTIVITY_REDESIGN.md`: "36 specialized agents, pattern-based routing" → "23 specialist agents, model-driven dispatch"

---

## [2.4.0] — 2026-05-19

### Added
- HooksView: dedicated page for CAST hook definitions grouped by event type
- MemoryView: dedicated page for agent and project memory entries with type badges and detail modal
- PlansView: dedicated page for CAST plans with hover preview and detail modal
- AgentStatusBadge: shared component extracted from AgentsView inline logic
- Smoke tests for SessionsView, AgentsView, SystemView, SqliteExplorerView, HooksView, MemoryView, PlansView (474 tests total)

### Fixed
- Sessions soft-delete: server now filters deleted sessions from list; DELETE endpoint performs soft-delete (DB record) instead of hard file unlink
- Cost Summary: Input Tokens and Output Tokens now show actual values per model instead of "—"
- Pricing tab: model-pricing.json parsed correctly — metadata keys (_comment, _note) no longer appear as model rows
- SqliteExplorer: table descriptions expanded to 30+ tables; removed stale stream_hook_events entry

### Removed
- File Writes page removed from navigation (no backing data in cast.db)

---

## [2.2.0] — 2026-05-03

### Added

- **Telemetry surfaces:** Five new cast.db tables now exposed in the dashboard
  - Parry Guard events (`/api/parry-guard`)
  - Agent Truncations (`/api/agent-truncations`)
  - Injection Log (`/api/injection-log`)
  - Dispatch Decisions (`/api/dispatch-decisions`)
  - Unstaged File Warnings (`/api/unstaged-warnings`)
- **Dynamic agent roster:** `GET /api/agents/roster` reads `~/.claude/agents/*.md` at request time — future agent additions require no dashboard change
- **UI sections:** Health Signals (System page), Routing Intel (Agents page), Unstaged Warnings (Sessions page)
- **Test coverage:** 20 new unit and route tests (315/315 passing total)

### Changed

- `LOCAL_AGENTS` roster expanded from 16 (v3) to 30 (v6.0); demoted to fallback-only behind the new roster API
- Version string alignment: `CAST v4.6` → `CAST v6.0` in SessionsView (766a1ba, d1b0352)
- README hook-count claim corrected: "81 hooks" → "26 registered handlers across 13 events"
- 10 backend routers in `server/routes/index.ts` annotated with `// TODO(alignment)` or `// USED BY:` comments for future cleanup

### Removed

- `src/views/HookHealthView.tsx` and `server/routes/hookHealth.ts` (orphaned — backed a `hook_health` table that does not exist in the cast.db schema)
- Stale reference to deleted `hookHealth.ts` from `phase975c.test.ts` docstring

---

## v2.0.0 — 2026-04-03

### Changed

- Consolidated from 21 views and 7 nav groups down to 4 pages: Dashboard, Sessions, Analytics, System
- System page absorbs Agents, Rules, Skills, Hooks, Memory, Plans, DB Explorer, and Cron into a single tabbed interface
- Analytics page absorbs Token Spend and Quality Gates views
- Sessions page absorbs Dispatch Log, Routing, and Agent Runs views
- Removed standalone pages: Activity, Dispatch Log, Token Spend, Quality Gates, Hook Health, Knowledge, Rules, Memory, Privacy, Plans, DB Explorer, Castd
- All old URLs redirect to the appropriate new page via React Router `<Navigate>`
- Removed dead backend routes: privacyAudit, launch, permissions, plugins, privacy audit

### Removed

- 14 view files deleted (Activity, DispatchLog, TokenSpend, QualityGates, HookHealth, Knowledge, Rules, Memory, Privacy, Plans, DbExplorer, Castd, and others)
- Unused API hooks and utility files cleaned up

---

## v1.1.0 — 2026-03-31

### Added

- Routing events API: filter by event_type (`GET /api/routing/events?event_type=<type>`), list distinct event types (`GET /api/routing/event-types`)
- Memory API: `lastModified` timestamps on all memory files
- Memory backup status endpoint (`GET /api/memory/backup-status`) + manual trigger (`POST /api/memory/backup-trigger`)
- Activity page: agent spawn timeline (`task_claimed` events)
- Analytics page: prompt volume bar chart (`user_prompt_submit` events)
- Sessions page: "Compacted" badge on sessions with `context_compacted` events
- Memory page: last-modified display on cards + backup status widget with manual trigger
