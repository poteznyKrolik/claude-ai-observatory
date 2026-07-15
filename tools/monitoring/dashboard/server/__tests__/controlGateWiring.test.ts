import { describe, it, expect, beforeAll } from 'vitest'
import request from 'supertest'
import { app } from '../index.js'

// C3: prove server/index.ts actually MOUNTS controlGate on each mutating prefix.
// The existing controlGate tests mount the middleware on express() stubs and omit
// /api/cast/exec, /api/control, /api/castd — so a deleted gate mount in index.ts
// would go undetected. This imports the REAL app and probes it. Import is
// side-effect-free under vitest: index.ts guards listen()/watchers/mkdir behind
// !process.env.VITEST.

describe('control-gate wiring (real app from server/index.ts)', () => {
  beforeAll(() => {
    // "Disabled" state (CAST_DASHBOARD_CONTROL unset) → gate returns 404 for any non-GET.
    delete process.env.CAST_DASHBOARD_CONTROL
  })

  // Representative gated prefixes, INCLUDING the three the stub tests omit
  // (/api/control, /api/castd, /api/cast/exec). task-queue / memories / sessions are
  // gated in the same index.ts block but share a 5-req/min destructive rate-limiter,
  // so they are omitted here to keep this probe clear of the limiter boundary.
  const gatedPrefixes = [
    '/api/control',
    '/api/castd',
    '/api/cast/exec',
    '/api/cast/seed',
    '/api/budget',
    '/api/memory',
    '/api/agents',
    '/api/rules',
    '/api/hook-events',
  ]

  for (const prefix of gatedPrefixes) {
    it(`gates a non-GET to ${prefix} (404 when control disabled)`, async () => {
      const res = await request(app).post(`${prefix}/__wiring_probe__`).send({})
      // The gate short-circuits with 404 before any route handler runs — no $HOME access.
      expect(res.status).toBe(404)
    })
  }
})
