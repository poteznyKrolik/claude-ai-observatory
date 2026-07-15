import { describe, it, expect } from 'vitest'
import {
  AGENT_PERSONALITIES,
  getAgentSprite,
  getModelTier,
} from './agentPersonalities'

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Matches a CSS hex color string: #RGB, #RRGGBB, or empty string (transparent). */
const HEX_OR_EMPTY = /^(#[0-9A-Fa-f]{3}|#[0-9A-Fa-f]{6}|)$/

function isValidCell(value: string): boolean {
  return HEX_OR_EMPTY.test(value)
}

// ─── getAgentSprite — structural contract ───────────────────────────────────

describe('getAgentSprite', () => {
  const agentNames = Object.keys(AGENT_PERSONALITIES)

  it('covers all 16 CAST agents plus built-in agents and fallback', () => {
    // 16 CAST specialists + explore + plan + general-purpose = 19
    expect(agentNames.length).toBeGreaterThanOrEqual(19)
  })

  describe.each(agentNames)('agent: %s', (agentName) => {
    let grid: string[][]

    it('returns an array (string[][])', () => {
      grid = getAgentSprite(agentName)
      expect(Array.isArray(grid)).toBe(true)
      grid.forEach((row) => {
        expect(Array.isArray(row)).toBe(true)
      })
    })

    it('has exactly 10 rows', () => {
      grid = getAgentSprite(agentName)
      expect(grid.length).toBe(10)
    })

    it('has consistent row width across all rows', () => {
      grid = getAgentSprite(agentName)
      const widths = grid.map((row) => row.length)
      const allSame = widths.every((w) => w === widths[0])
      expect(allSame).toBe(true)
    })

    it('every cell is a valid hex color or empty string (transparent)', () => {
      grid = getAgentSprite(agentName)
      const invalid: Array<{ row: number; col: number; value: string }> = []
      grid.forEach((row, ri) => {
        row.forEach((cell, ci) => {
          if (!isValidCell(cell)) {
            invalid.push({ row: ri, col: ci, value: cell })
          }
        })
      })
      expect(invalid).toHaveLength(0)
    })
  })
})

// ─── getAgentSprite — unknown agent falls back gracefully ──────────────────

describe('getAgentSprite — unknown agent', () => {
  it('returns a non-empty grid for an unknown agent name', () => {
    const grid = getAgentSprite('does-not-exist')
    expect(Array.isArray(grid)).toBe(true)
    expect(grid.length).toBeGreaterThan(0)
  })

  it('falls back to the general-purpose personality', () => {
    const unknownGrid = getAgentSprite('does-not-exist')
    const fallbackGrid = getAgentSprite('general-purpose')
    // Both should produce identical output since they share the same archetype + accent
    expect(unknownGrid).toEqual(fallbackGrid)
  })
})

// ─── getModelTier ───────────────────────────────────────────────────────────

describe('getModelTier', () => {
  it('returns label "haiku" for a model string containing "haiku"', () => {
    const tier = getModelTier('claude-haiku-3-5')
    expect(tier.label).toBe('haiku')
  })

  it('returns the correct accent color for haiku', () => {
    const tier = getModelTier('claude-haiku-3-5')
    expect(tier.color).toBe('#60A5FA')
  })

  it('returns label "sonnet" for a model string containing "sonnet"', () => {
    const tier = getModelTier('claude-sonnet-4-5')
    expect(tier.label).toBe('sonnet')
  })

  it('returns the correct accent color for sonnet', () => {
    const tier = getModelTier('claude-sonnet-4-5')
    expect(tier.color).toBe('#00FFC2')
  })

  it('returns label "opus" for a model string containing "opus"', () => {
    const tier = getModelTier('claude-opus-4')
    expect(tier.label).toBe('opus')
  })

  it('returns the correct accent color for opus', () => {
    const tier = getModelTier('claude-opus-4')
    expect(tier.color).toBe('#A78BFA')
  })

  it('returns label "unknown" when model is undefined', () => {
    const tier = getModelTier(undefined)
    expect(tier.label).toBe('unknown')
  })

  it('returns label "sonnet" (default) for an unrecognised model string', () => {
    // getModelTier falls through to the sonnet branch for anything not haiku/opus
    const tier = getModelTier('claude-future-unknown-model')
    expect(tier.label).toBe('sonnet')
  })

  it('returns a bg string for every known tier', () => {
    for (const model of ['claude-haiku-3', 'claude-sonnet-4', 'claude-opus-4']) {
      const { bg } = getModelTier(model)
      expect(typeof bg).toBe('string')
      expect(bg.length).toBeGreaterThan(0)
    }
  })
})

// ─── AGENT_PERSONALITIES — field completeness ──────────────────────────────

describe('AGENT_PERSONALITIES — field completeness', () => {
  const entries = Object.entries(AGENT_PERSONALITIES)

  it('every agent has a non-empty accentColor', () => {
    entries.forEach(([name, p]) => {
      expect(p.accentColor, `${name}.accentColor`).toBeTruthy()
    })
  })

  it('every agent has a non-empty roleTitle', () => {
    entries.forEach(([name, p]) => {
      expect(p.roleTitle, `${name}.roleTitle`).toBeTruthy()
    })
  })

  it('every agent has a non-empty tagline', () => {
    entries.forEach(([name, p]) => {
      expect(p.tagline, `${name}.tagline`).toBeTruthy()
    })
  })

  it('every agent has a valid archetype', () => {
    const VALID_ARCHETYPES = new Set([
      'commander', 'strategist', 'detective', 'builder',
      'scientist', 'scribe', 'operative',
    ])
    entries.forEach(([name, p]) => {
      expect(VALID_ARCHETYPES.has(p.archetype), `${name}.archetype "${p.archetype}" not valid`).toBe(true)
    })
  })

  it('every accentColor is a valid 6-digit hex string', () => {
    entries.forEach(([name, p]) => {
      expect(
        /^#[0-9A-Fa-f]{6}$/.test(p.accentColor),
        `${name}.accentColor "${p.accentColor}" is not a 6-digit hex`
      ).toBe(true)
    })
  })

  // routingCommand is NOT currently part of AgentPersonality.
  // This test documents that the field is absent on every entry so that
  // a future addition is caught immediately if it lands in only some agents.
  it('routingCommand field — currently absent from AgentPersonality interface', () => {
    const agentsWithRouting = entries.filter(
      ([, p]) => 'routingCommand' in p
    )
    // If this count is > 0, the field has been partially added.
    // At that point, every agent must have it (empty string '' is acceptable).
    if (agentsWithRouting.length > 0) {
      const missing = entries
        .filter(([, p]) => !('routingCommand' in p))
        .map(([name]) => name)
      expect(missing, `agents missing routingCommand: ${missing.join(', ')}`).toHaveLength(0)
    } else {
      // Field not yet added — all agents are consistently absent, which is valid.
      expect(agentsWithRouting.length).toBe(0)
    }
  })
})
