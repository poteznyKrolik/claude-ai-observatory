import path from 'path'

/**
 * Resolves `parts` relative to `base` and returns the resolved path only if it
 * stays within `base`. Returns null if the result escapes (path traversal attempt).
 *
 * Use instead of path.join() for any user-supplied path segments.
 */
export function safeResolve(base: string, ...parts: string[]): string | null {
  const resolved = path.resolve(base, ...parts)
  const normalizedBase = path.resolve(base)
  // Must start with base + separator (or equal base exactly for directory requests)
  if (resolved !== normalizedBase && !resolved.startsWith(normalizedBase + path.sep)) {
    return null
  }
  return resolved
}
