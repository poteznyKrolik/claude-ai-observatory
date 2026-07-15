import { describe, it, expect } from 'vitest'
import path from 'path'
import { safeResolve } from './safeResolve.js'

// C1: the shared path-traversal guard behind 8+ user-facing path surfaces
// (plans/seed/sessions/skills/commands/rules/agents/memory). Pure path math —
// no filesystem access, no $HOME touch.

const BASE = '/tmp/cast-base'

describe('safeResolve', () => {
  it('returns the base itself for a "." segment (directory request)', () => {
    expect(safeResolve(BASE, '.')).toBe(path.resolve(BASE))
  })

  it('returns the joined path for a legit nested segment', () => {
    expect(safeResolve(BASE, 'sub', 'file.md')).toBe(
      path.join(path.resolve(BASE), 'sub', 'file.md'),
    )
  })

  it('returns null for a parent-traversal escape', () => {
    expect(safeResolve(BASE, '../etc/passwd')).toBeNull()
  })

  it('returns null for an absolute-path segment that escapes the base', () => {
    expect(safeResolve(BASE, '/etc/passwd')).toBeNull()
  })

  it('returns null for a sibling-prefix escape (the reason for the + path.sep check)', () => {
    // /tmp/cast-base-evil shares the "/tmp/cast-base" prefix but is NOT inside it
    expect(safeResolve(BASE, '../cast-base-evil')).toBeNull()
  })

  it('returns null when .. climbs out even after descending', () => {
    expect(safeResolve(BASE, 'sub/../../escape')).toBeNull()
  })

  it('allows a segment that descends then returns within base', () => {
    expect(safeResolve(BASE, 'a/../b')).toBe(path.join(path.resolve(BASE), 'b'))
  })
})
