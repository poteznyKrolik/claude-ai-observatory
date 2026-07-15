# claude-code-dashboard

## Install
```bash
npm install
```

## Run
```bash
npm run dev        # Vite :5173 + Express :3001 concurrently
```

## Test
```bash
npm test           # Vitest run (non-watch)
```

## Non-obvious

- `cast.db` must exist at `~/.claude/cast.db` before first run — schema is owned by the flagship's `cast-db-init.sh` (`cast status` creates it). The dashboard NEVER creates or alters cast.db schema; seeding fails closed (503) if the DB is missing/uninitialized. `npm run seed` (or gated POST `/api/cast/seed`) backfills token/cost data from JSONL using canonical columns only.
- `PORT` env var overrides Express port (default 3001). Must also update Vite proxy in `vite.config.ts` to match.
- `CORS_ORIGIN` env var overrides allowed origin (default `http://localhost:5173`).
- `CAST_DASHBOARD_CONTROL=1` + `DASHBOARD_TOKEN=<string>` enable write/control endpoints. Dashboard is read-only by default — server startup performs zero DB writes, and ALL mutating endpoints (control, castd, cast/exec, seed, budget, task-queue, memories, memory, agents, rules, hook-events, session delete) sit behind the gate: non-GET fail-closed (disabled → 404, unconfigured → 503, bad token → 403, constant-time), GETs stay public.
- Server startup runs a schema-drift check (`server/utils/schemaGuard.ts`) that validates all referenced `cast.db` tables and columns exist and warns if schema has drifted. A contract test (`server/__tests__/schemaContract.test.ts`) asserts column presence.
- `docs/` contains planning artifacts (`LIVE_ACTIVITY_REDESIGN.md`, `superpowers/`) — not user-facing docs.
- Production: `npm run build` (tsc + vite), then `npm start` serves `dist/server/index.js`. Static assets served by Express from `dist/`.
