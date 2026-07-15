import { describe, it, expect } from 'vitest'
import { LOCAL_AGENTS } from './localAgents'

describe('LOCAL_AGENTS', () => {
  it('has exactly 23 agents', () => {
    expect(LOCAL_AGENTS).toHaveLength(23)
  })

  it('does not include "orchestrator"', () => {
    expect(LOCAL_AGENTS).not.toContain('orchestrator')
  })

  it('includes v7 agents: migration-reviewer, eval-writer, pr-reviewer', () => {
    expect(LOCAL_AGENTS).toContain('migration-reviewer')
    expect(LOCAL_AGENTS).toContain('eval-writer')
    expect(LOCAL_AGENTS).toContain('pr-reviewer')
  })

  it('is sorted alphabetically', () => {
    const sorted = [...LOCAL_AGENTS].sort()
    expect(LOCAL_AGENTS).toEqual(sorted)
  })
})
