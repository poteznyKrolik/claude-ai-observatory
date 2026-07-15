# claude-code-dashboard M2 — v9 Full System Audit (session 1, 2026-07-02)

> **Coverage:** 172 SQL queries across all 63 server files · 122 endpoints live-exercised · 22 views element-audited · tsc+vitest+CI re-verified · 109 subagents, every broken/dropped finding adversarially verified (1 claim refuted and reclassified).
> **Status: audit complete. Disposition at the end of this document; stabilization executed on `feature/m2-stabilize-v9`.**

## Verdict in one paragraph

The dashboard mostly *renders* fine against today's live DB, but it is quietly at war with CAST v9: the dashboard itself is the root cause of the canonical-vs-live schema drift (it re-adds dropped columns at every boot), several "live" features are dead or lying (live agents feed is blind, dispatch-decisions shows the wrong table, active-agent filters are broken by timestamp-format math), a fifth of the UI describes v7/v8-era CAST, and the single richest v9 data source (otel_events/otel_metrics, 111k rows, written today) is completely unsurfaced. CI is green and tsc is clean — the rot is semantic, not syntactic.

---

## A. Systemic root causes (fix-first class)

**A1. The dashboard is the schema-drift aggressor.**
`server/index.ts:82` fires POST `/api/cast/seed` on EVERY server start; `seed.ts:179-186` opens a read-write connection and re-ALTERs exactly the six columns canonical migrations 022/024/026 dropped (`sessions.total_input/output_tokens/.total_cost_usd/.model`, `agent_runs.prompt/.project`), then INSERTs/UPDATEs through them. Flagship migration 026 ("redrop_orphan_columns") is the counter-shot in an ongoing war the dashboard keeps re-starting. Verified collateral each boot: rewrites `agent_runs.status` vocab (`done→DONE`, `failed/error→BLOCKED`), backfills token/cost **estimates** (hardcoded $3/$15 per Mtok, model param ignored) into the record CAST treats as ground truth. Contract agent's verdict after tracing all readers: **the canonical drop was correct and complete on the flagship side**; `sessions.total_*/model` are provably dead (all 261 rows are 0/0.0/empty — write-only). **`agent_runs.prompt` is the ONE load-bearing drifted column** (435 real rows; powers `task_summary` in agentRuns/analytics/workLogStream/executiveSummary). `agent_runs.project` is write-only duplication of `sessions.project`. Also: `seed.ts:122` ensureTables creates a DIVERGENT schema when cast.db is absent (missing 9+ canonical columns) — a seed-created DB is corrupt from birth.

**A2. Control-gate coverage is a fiction.**
`controlGate` protects only `/api/control`, `/api/castd`, `/api/cast/exec` (server/index.ts:59-61). OUTSIDE the gate, reachable ungated right now: `POST /api/cast/seed` (DB writes), `DELETE /api/cast/task-queue/:id` (writable row delete), `DELETE /api/cast/memories/:id` (writable row delete, 149-row table), `POST /api/budget/config` (DELETE+INSERT), `POST /api/memory/backup-trigger` (**execSync's a shell script on any anonymous POST** — worst gap), `POST /api/hook-events` (ingest), `POST/PUT /api/agents`, `PUT /api/rules/:filename` (file writes to ~/.claude). The 10 gated endpoints DO fail-close correctly (404 probes verified). CLAUDE.md's "read-only by default; control endpoints require both flags + header auth" is false as written.

**A3. Write-path confusion breaks features both ways.**
Things that SHOULD write, can't: session soft-delete uses the readonly handle → **every delete click 500s, can never work** (sessions.ts:236); `POST /api/budget/config` same class (budgetStatus.ts:78). Things that SHOULDN'T write, do: budgetStatus runs `CREATE TABLE` at module load; sessions.ts runs `ALTER TABLE` at module load (silently dead on the readonly handle — false self-heal confidence).

**A4. Timestamp-format math is broken across the codebase (one bug class, many sites).**
Live timestamps are ISO with `T`; SQLite `datetime('now')` yields space-separated. Text comparison makes windows lie: Active-Agents "15 min" filter passes ALL same-day rows (agentRuns.ts:64 — 26 phantom "running" agents render as active); sse.ts:248 "2 hours" window is actually same-UTC-day; executiveSummary gate-pass-rate window returns empty on 'today' (…:189-195); completeness `created_at` parsed as LOCAL time in the UI (timeAgo). Fix once with `unixepoch()` both sides + a shared util.

## B. Broken now, on the live DB (all adversarially verified)

| # | What | Where | Proof |
|---|------|-------|-------|
| B1 | `GET /api/cast/task-queue` → 500; 1,503 rows invisible | taskQueue.ts:72 selects nonexistent `result_summary` | live 500 reproduced |
| B2 | Live-agents feed returns `[]` while 10+ agents run | agentsLive.ts scans `subagents/*.jsonl`; real transcripts at `subagents/workflows/wf_*/agent-*.jsonl` | verified on disk during audit |
| B3 | agent-run SSE invalidation NEVER fires | castDbWatcher.ts:20 selects dropped `agent_runs.batch_id`, throws every 3s, swallowed | "no such column" on live |
| B4 | Swarm Messages tab 500s + 5s retry loop | swarm.ts:104 queries dropped `teammate_messages`, no guard | live 500 on valid id |
| B5 | Work-log JOIN fan-out duplicates runs + false truncation banners | workLogStream.ts:119 joins truncations on (session_id, agent_type) — not unique | 5,891 runs → 9,720 joined; dupes in live payload |
| B6 | Dispatch Decisions panel shows the WRONG TABLE | qualityGates.ts:145 queries `dispatch_events` [21 cron rows] aliased as decisions; real `dispatch_decisions` [393, written today] unsurfaced | live payload = cron rows |
| B7 | Budget line invisible while OVER budget | budgets row scope_key='*', server filters scope_key='global' (budgetStatus.ts:46) | $500/day budget vs $637 spent today, hidden |
| B8 | HomeView "Agent Runs Today" undercounts 3.6× | uses `runs.length` of a limit-200 page; `stats.totalRuns`=725 in same payload | curl verified |
| B9 | Executive summary: cost delta always null (unsatisfiable predicate) + gate-pass-rate empty on 'today' (A4) + blockers query crash-on-fresh | executiveSummary.ts:108-116, 189-195, 148 | live + logic proof |
| B10 | Session detail header/Started/gitBranch/Export broken by modern JSONL (metadata-first entries, 59/185 unknown types); H1 shows dash-encoded path fragment | SessionDetailView parser + :332 | live payload verified ("**Started:** undefined" in export) |
| B11 | Analytics `is_truncated` flags every same-agent run in a session; same class on AgentDetail TRUNCATED badge | analytics.ts:69 | 1 truncated gate → 29 runs flagged (live) |
| B12 | AgentDetail cost column: `cost_usd:null` × non-null type → formatCost crash-risk rendering | 139 NULL cost rows live | payload verified |
| B13 | Eval graders always 0/N (writer emits `status:'pass'`; UI counts `passed`/`outcome`) + model '' renders blank | EvalRunsView.tsx:21-23,124 | sqlite + code |
| B14 | MemoryView project timestamps undefined (`modifiedAt` sent, `lastModified` read) | memory.ts:29-32 | live payload |
| B15 | Completeness severity badges all gray (UPPERCASE data vs lowercase compare) | AgentReliabilityView.tsx:62 | 317/317 rows 'MEDIUM' |
| B16 | Worktree anomalies stat card reports fetch cap (200) as total (404 real) | worktreeAnomalies.ts:18 | live counts |
| B17 | `?limit=-1` bypasses row caps (LIMIT -1 = unlimited) | qualityGates.ts:22,141; rateLimits.ts:18 | 959 rows returned live |
| B18 | crontab rewrite corrupts on multi-entry (JSON.stringify `\n` + bash echo) | castdControl.ts:143,164 | mechanism proven (gated, unexercised) |
| B19 | Health footer never renders (`/api/health` has no `version` key) | config.ts:162-181; HomeView:391 | live payload |
| B20 | Command palette: 8/20 entries land on redirects; 3/4 search categories lose the selection | CommandPalette.tsx:21-42,82-108 | route map verified |

**Crash-on-fresh-install class (works today only because A1 re-adds the column):** `ar.prompt` in agentRuns.ts (×4 queries), analytics.ts:80, executiveSummary.ts:148, routing.ts:37, workLogStream.ts (×4); `sessions.model` in sessions.ts:55; schemaGuard.ts:22 EXPECTED_SCHEMA itself declares the drifted columns (guard certifies the wrong contract).

## C. Stale v7/v8 content (representative; full list in workflow output)

- **Model economics frozen pre-Fable:** `costEstimate.ts` MODEL_RATES/FAMILY_RATES lack `claude-fable-5` and `claude-opus-4-8` (100/194 live sessions mispriced via sonnet fallback); ModelBadge / MODEL_COLORS / modelBadgeLabel / SystemView MODEL_OPTIONS ('Opus 4.6') all pre-v9; one MODEL_RATES key is a nonexistent model id (`claude-sonnet-4-5-20250514`).
- **DocsView is a v7/v8 time capsule:** hardcoded 18/21 slash commands, 17-agent roster (includes retired `orchestrator`, missing 7 live agents, drifted model assignments), 8/19 skills (11 mislabeled "not invocable"), 8 of ~35 CAST CLI subcommands.
- **SwarmView framed as retired v8 /swarm** while its DATA is alive native-Agent-Teams rows (38 sessions, written today; status vocab mismatch renders 'completed' unstyled; producer never closes sessions → "Active: 38" meaningless).
- **SystemView:** Cron tab renders 14 `# MIGRATED-TO-LAUNCHD` comment lines as schedule entries (real scheduler is launchd); 'Data Integrity (Pillar 2)' v8 jargon; orphaned TODO.
- Misc: `/activity` links on Home (retired route), 'CAST v3.1/v4.6/v8' comments in server routes, IncidentsView "manually recorded" copy (8/25 rows agent-surfaced today), SqliteExplorer stale table descriptions.

## D. Dead vs dormant surfaces (audit distinguishes deliberately)

**Dead (producer retired in v9 → remove/replace):** hook-events POST/SSE pipeline (otel supersedes it); research-cache Home card; `code_ref_checks` tab+route+hook; `parry_guard_events` panel (writer never shipped); Meetings tab (producer archived, dir never existed); orphaned `DispatchModal.tsx`; `/privacy` redirect to content that doesn't exist.
**Dormant (v9 producer exists but idle → keep, annotate honestly):** routines, rate_limit_snapshots, hook_failures, managed_agent_invocations, memory_consolidation_runs, unstaged_warnings, archived_memories, file_writes; injection_log **stalled 19 days** (producer wiring issue, CAST-side).

## E. Missing v9 surfaces (north-star gaps, data verified live)

1. **otel_events [92,349] / otel_metrics [19,412]** — zero queries. Complete hook-fire stream (26.5k start/complete pairs), tool_decision/tool_result timelines (~25k), api_request/api_error, subagent_completed, plus REAL token/cost/LoC/commit metrics. This IS the "processes" pillar, and it replaces both the dead hook-events pipeline and hardcoded cost estimation.
2. **dispatch_decisions [393, fresh today]** — the actual routing-logic ledger (chosen_agent, model, effort, wave_id, parallel, outcome), miswired per B6.
3. **attestations [408; 225 false_done=1]** — agent-honesty scoreboard for AgentReliabilityView.
4. **commit_provenance [8, written today] + provenance_chain [10, chain-hash; seq 7 gap live]** — the "files"/integrity pillar spine.
5. **task_queue [1,503; 51% abandoned]** — API now 500s (B1) and has no UI; queue-health panel is a finding-rich quick win.
6. **stop_failure_events [55, fresh]** — endpoint works, no UI consumer.
7. **pane_bindings [1]** — flagship's session-start hook POSTs `/api/pane-bindings/notify` on EVERY session start; endpoint doesn't exist → silent 404 forever. Add it (live "what's running where") or tell flagship to remove the call.
8. **schema_migrations** — one-line "DB at migration N" indicator on SystemView; apt given this audit's headline.

## F. Build/CI/perf/a11y

- **tsc: CLEAN (0 errors)** — the month-old §4 claim (memory.ts/SystemView errors) is STALE. Caveat: tsconfig excludes tests from typecheck.
- **vitest: 556/556 pass** (1 intentional skip). **CI = vitest only — add `npx tsc --noEmit`** (build = tsc+vite, so a type regression breaks builds while CI stays green). Node 26 local vs Node 20 CI, no `engines` field (better-sqlite3 native-module risk).
- **Perf:** /api/sessions ~1.4s, /api/analytics ~2.1s, token-spend ~1.4s (full JSONL rescans per request); /api/memory/project ships 712KB (full bodies in a list). Fail-soft pattern (`catch → 200 []`) makes errors indistinguishable from empty everywhere.
- **a11y:** solid baseline (global :focus-visible, MotionConfig reduced-motion, modal focus traps, several exemplary views) with recurring gaps: decorative lucide icons missing `aria-hidden`, `<tr role="button">` semantics breakage, color-only status encoding, sub-44px targets/10px text, feeds without aria-live, no focus move on route change.

---

## Recommendations (ranked)

### BIG (rebuild pillars — each is a multi-unit logical block)

- **R1. End the schema war + honest write architecture** (A1+A2+A3): delete auto-seed-on-boot; make seed an explicit, gated, canonical-shape operation (no ALTERs, no divergent ensureTables, no status rewrites); route ALL mutating endpoints behind controlGate (incl. memory backup-trigger, task-queue/memories DELETE, budget, agents/rules writes); one writable-connection discipline (fixes broken soft-delete + budget config as a side effect). **Requires one contract decision with flagship: `agent_runs.prompt`** (adopt into canonical vs dashboard stops reading it and task_summary features source from `dispatch_decisions.prompt_snippet`).
- **R2. Canonical-strict SQL sweep**: strip/guard every drifted-column read (the B/C crash-on-fresh list), fix schemaGuard EXPECTED_SCHEMA to the canonical 39-table contract, fix the missing-both references (B1, B3, B4, code_ref_checks, parry_guard), fix B5/B11 join keys (`agent_id`).
- **R3. Timestamp math fix-once** (A4): shared `unixepoch`-based comparisons; fixes B9-windows, active-agents filter, sse windows, completeness rendering.
- **R4. OTel live-process layer** (E1): hook-fire activity (per-hook last-fired/sparkline on HooksView — replacing the refuted "fired X ago" semantics), tool timelines on SessionDetail, api_error/subagent_completed reliability signals, real token/cost metrics replacing estimateCost; fix B2 (live agents) by scanning `subagents/workflows/` (+ otel corroboration).
- **R5. Logic pillar**: repoint dispatch-decisions to the real table (B6) with honest columns; attestations scoreboard; quality-gate verdicts joined into scorecard/work-log; SessionDetail "session storyboard" (session-keyed routing_events, dispatch_decisions, gates, compaction, tool failures).
- **R6. Files/provenance pillar**: commit_provenance links on IncidentsView + a commits-by-agent surface; provenance_chain continuity check on SystemView Integrity (surface the live seq-7 gap); schema_migrations indicator; worktrees panel on Home.
- **R7. Shell/nav consolidation**: palette derives from NAV_GROUPS; `?tab=` deep links on SystemView; fix/retire the 8 stale redirect destinations; delete orphaned DispatchModal; SwarmView → "Agent Teams" reframe (kill Messages tab, fix status vocab, liveness semantics).

### SMALL (quick wins, roughly descending value/effort)

1. Budget scope_key fix (B7 — currently hiding an over-budget condition).
2. Model economics refresh: MODEL_RATES/FAMILY_RATES/badges for fable-5 + opus-4-8 (touches 5 views).
3. HomeView stats.totalRuns + byStatus counts (B8); health `version` (B19).
4. task_queue 500 fix + minimal queue-health card (B1, E5).
5. DocsView: wire commands/skills/CLI to live APIs (kills the time capsule).
6. Eval graders `status` fix; Memory lastModified fix; completeness severity case fix; worktree total fix; LIMIT clamp fix (B13-B17).
7. SessionDetail parser: skip/render modern JSONL metadata types; decoded projectName from API (B10).
8. Compacted badge → compaction_events (real producer, 77 rows).
9. stop_failure_events card on AgentReliability (endpoint exists).
10. Retire dead surfaces (D): hook-events pipeline, research-cache card, code-refs tab, parry panel, Meetings tab, /privacy.
11. CI: add tsc --noEmit + engines field.
12. Perf: metadata-only memory list; cache JSONL token scans.
13. A11y sweep (recurring patterns above) — fold into each touched view per conventions.
14. pane-bindings notify endpoint (or flagship removes the call) (E7).

### Flagship-side findings (SURFACE to Ed, not this repo's scope)
- cast-session-start-hook.sh:198 POSTs to a nonexistent dashboard endpoint (silent 404 every session).
- injection_log producer stalled since 2026-06-13; plan_sessions rows all `session_id='unknown'`; swarm/Agent-Teams producer never sets ended_at; hook_failures writer may never fire (0 rows ever); task_queue 51% abandonment; provenance_chain seq-7 gap.
- The `agent_runs.prompt` contract decision (R1).

---

---

## Disposition (Ed, 2026-07-02)

- Session scope: **Stabilize first** — R1+R2+R3 + small wins 1–6, executed on `feature/m2-stabilize-v9`.
- `agent_runs.prompt` contract: **dashboard goes canonical** — task summaries sourced from `dispatch_decisions.prompt_snippet` (validated live: resolves 756/2,647 runs 7d vs the drifted column's 435 rows total).
- Flagship-side findings: recorded as todos in flagship `plans/master_post_v9.md` §3.a.
- Standing rule (Ed): dead code is **deleted**, never archived — git history is the archive.
- R4–R7 (OTel live layer, logic pillar, files/provenance pillar, shell/nav consolidation) + dedicated cast.db Database view: sessions 2–3.
