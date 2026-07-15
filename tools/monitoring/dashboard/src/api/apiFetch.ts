/**
 * Shared fetch utility for API hooks.
 * Throws a descriptive error on non-OK responses so callers don't need
 * to repeat the `if (!res.ok) throw new Error(...)` pattern.
 */
export async function apiFetch<T>(url: string): Promise<T> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`API error ${res.status}: ${url}`)
  return res.json() as Promise<T>
}
