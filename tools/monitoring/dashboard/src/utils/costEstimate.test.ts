import { describe, it, expect } from 'vitest'
import { estimateCost, formatTokens, formatCost, MODEL_RATES } from './costEstimate'

describe('estimateCost', () => {
  it('returns $3.00 for 1M input tokens with sonnet model', () => {
    const cost = estimateCost(1_000_000, 0, 0, 0, 'claude-sonnet-4-5-20250514')
    expect(cost).toBe(3.0)
  })

  it('returns $15.00 for 1M output tokens with sonnet model', () => {
    const cost = estimateCost(0, 1_000_000, 0, 0, 'claude-sonnet-4-5-20250514')
    expect(cost).toBe(15.0)
  })

  it('returns higher cost for opus than sonnet given the same tokens', () => {
    const sonnetCost = estimateCost(500_000, 100_000, 0, 0, 'claude-opus-4-20250514')
    const opusCost = estimateCost(500_000, 100_000, 0, 0, 'claude-sonnet-4-5-20250514')
    expect(sonnetCost).toBeGreaterThan(opusCost)
  })

  it('returns lower cost for haiku than sonnet given the same tokens', () => {
    const haikuCost = estimateCost(500_000, 100_000, 0, 0, 'claude-haiku-3-5-20241022')
    const sonnetCost = estimateCost(500_000, 100_000, 0, 0, 'claude-sonnet-4-5-20250514')
    expect(haikuCost).toBeLessThan(sonnetCost)
  })

  it('falls back to sonnet rates for an unknown model string', () => {
    const unknownCost = estimateCost(1_000_000, 0, 0, 0, 'some-unknown-model')
    const sonnetCost = estimateCost(1_000_000, 0, 0, 0, 'claude-sonnet-4-5-20250514')
    expect(unknownCost).toBe(sonnetCost)
  })

  it('returns 0 when all token counts are zero', () => {
    const cost = estimateCost(0, 0, 0, 0, 'claude-sonnet-4-5-20250514')
    expect(cost).toBe(0)
  })

  it('applies cacheWrite and cacheRead rates correctly', () => {
    // sonnet cacheWrite = 3.75/M, cacheRead = 0.30/M
    const cost = estimateCost(0, 0, 1_000_000, 1_000_000, 'claude-sonnet-4-5-20250514')
    expect(cost).toBeCloseTo(3.75 + 0.30, 4)
  })

  it('resolves a model string starting with "claude-sonnet" via family prefix fallback', () => {
    const prefixCost = estimateCost(1_000_000, 0, 0, 0, 'claude-sonnet-future-version')
    const sonnetCost = estimateCost(1_000_000, 0, 0, 0, 'claude-sonnet-4-5-20250514')
    expect(prefixCost).toBe(sonnetCost)
  })
})

describe('formatTokens', () => {
  it('returns raw number for counts below 1,000', () => {
    expect(formatTokens(500)).toBe('500')
  })

  it('returns K suffix for counts in the thousands', () => {
    expect(formatTokens(1500)).toBe('2K')
  })

  it('returns M suffix for counts in the millions', () => {
    expect(formatTokens(1_500_000)).toBe('1.5M')
  })
})

describe('formatCost', () => {
  it('shows 4 decimal places for costs under $1', () => {
    expect(formatCost(0.0012)).toBe('$0.0012')
  })

  it('shows 2 decimal places for costs between $1 and $100', () => {
    expect(formatCost(3.5)).toBe('$3.50')
  })

  it('shows no decimal places for costs >= $100', () => {
    expect(formatCost(150)).toBe('$150')
  })
})
