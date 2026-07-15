// Helpers for talking to the gated write surface (/api/control, /api/castd, …).
//
// When the server runs with CAST_DASHBOARD_CONTROL=1 it also requires a matching
// X-Dashboard-Token on every write. The token is a shared secret the operator
// sets in their env and pastes into the dashboard; we persist it in localStorage
// and attach it here so individual call sites don't each reimplement the header.

const TOKEN_KEY = 'cast_dashboard_token'

export function getControlToken(): string {
  try {
    return localStorage.getItem(TOKEN_KEY) ?? ''
  } catch {
    return ''
  }
}

export function setControlToken(token: string): void {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token)
    else localStorage.removeItem(TOKEN_KEY)
  } catch {
    // localStorage unavailable (private mode / SSR) — degrade silently
  }
}

/**
 * fetch() wrapper that attaches the dashboard control token (when set) as
 * X-Dashboard-Token. Use for every state-changing request to a gated endpoint.
 */
export function controlFetch(input: string, init: RequestInit = {}): Promise<Response> {
  const token = getControlToken()
  const headers = new Headers(init.headers)
  if (token) headers.set('X-Dashboard-Token', token)
  return fetch(input, { ...init, headers })
}
