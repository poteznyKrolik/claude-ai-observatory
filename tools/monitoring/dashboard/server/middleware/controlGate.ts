import crypto from 'crypto'
import type { Request, Response, NextFunction } from 'express'

// ── Control-surface gate ─────────────────────────────────────────────────────
// The dashboard is read-only by default. Any state-changing request (dispatch,
// kill, rollback, cron mutation, plan exec) is refused unless the operator has
// explicitly opted in via CAST_DASHBOARD_CONTROL=1, AND presents a matching
// X-Dashboard-Token. Read-only verbs (GET/HEAD/OPTIONS) always pass so that
// observability — including listing cron entries or the command queue — keeps
// working in the default locked-down posture.
//
// Fail-closed everywhere: a disabled surface 404s (hides its existence), an
// enabled-but-unconfigured surface 503s rather than running unauthenticated, and
// a bad/absent token 403s. No write ever executes on an unverified request.

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS'])

/** True when the operator has opted the write surface in. */
export function isControlEnabled(): boolean {
  return process.env.CAST_DASHBOARD_CONTROL === '1'
}

/** True when a shared token is configured for write authentication. */
export function isControlTokenConfigured(): boolean {
  return typeof process.env.DASHBOARD_TOKEN === 'string' && process.env.DASHBOARD_TOKEN.length > 0
}

/** Constant-time string compare that tolerates length mismatch without leaking it. */
function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a)
  const bb = Buffer.from(b)
  if (ab.length !== bb.length) {
    // Still run a comparison to keep timing uniform, then fail.
    crypto.timingSafeEqual(ab, ab)
    return false
  }
  return crypto.timingSafeEqual(ab, bb)
}

/**
 * Express middleware guarding a write surface. Mount it on a router prefix
 * (e.g. /api/control) — it lets reads through and authenticates writes.
 */
export function controlGate(req: Request, res: Response, next: NextFunction): void {
  if (SAFE_METHODS.has(req.method)) {
    next()
    return
  }

  // Disabled → behave as if the write endpoint does not exist.
  if (!isControlEnabled()) {
    res.status(404).json({ error: 'Not found' })
    return
  }

  // Enabled but no token configured → refuse rather than run unauthenticated.
  if (!isControlTokenConfigured()) {
    res.status(503).json({
      error: 'Control surface enabled but DASHBOARD_TOKEN is not configured on the server',
    })
    return
  }

  // Always run the constant-time compare (even for an empty header) so timing
  // does not distinguish "no token" from "wrong token".
  const provided = req.header('x-dashboard-token') ?? ''
  if (!safeEqual(provided, process.env.DASHBOARD_TOKEN as string)) {
    res.status(403).json({ error: 'Invalid or missing dashboard token' })
    return
  }

  next()
}
