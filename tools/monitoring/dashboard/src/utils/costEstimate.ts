// Model pricing per million tokens (USD)
// Source: ~/.claude/config/model-pricing.json (authoritative). Update both files when rates change.
// NOTE: claude-fable-5 is not yet in model-pricing.json — using opus-4-8 rate tier as documented fallback.
export const MODEL_RATES: Record<string, { input: number; output: number; cacheWrite: number; cacheRead: number }> = {
  // Current live model ids (CAST v9.0.0, 2026-07)
  'claude-fable-5':           { input: 15.00, output: 75.00, cacheWrite: 18.75, cacheRead: 1.50 }, // fallback: opus-4-8 tier (fable-5 not yet in model-pricing.json)
  'claude-opus-4-8':          { input: 15.00, output: 75.00, cacheWrite: 18.75, cacheRead: 1.50 },
  'claude-sonnet-4-6':        { input: 3.00,  output: 15.00, cacheWrite: 3.75,  cacheRead: 0.30 },
  'claude-haiku-4-5-20251001':{ input: 0.80,  output: 4.00,  cacheWrite: 1.00,  cacheRead: 0.08 },
  // Legacy / dated ids still in DB
  'claude-sonnet-4-6-20260320':  { input: 3.00,  output: 15.00, cacheWrite: 3.75,  cacheRead: 0.30 },
  'claude-haiku-3-5-20241022':   { input: 0.80,  output: 4.00,  cacheWrite: 1.00,  cacheRead: 0.08 },
  'claude-opus-4-20250514':      { input: 15.00, output: 75.00, cacheWrite: 18.75, cacheRead: 1.50 },
  'claude-opus-4-6-20260320':    { input: 15.00, output: 75.00, cacheWrite: 18.75, cacheRead: 1.50 },
}

// Fallback: match by model family prefix
const FAMILY_RATES: Record<string, keyof typeof MODEL_RATES> = {
  'claude-fable':  'claude-fable-5',
  'claude-sonnet': 'claude-sonnet-4-6',
  'claude-haiku':  'claude-haiku-4-5-20251001',
  'claude-opus':   'claude-opus-4-8',
}

function getRates(model: string) {
  if (MODEL_RATES[model]) return MODEL_RATES[model]
  // Try family prefix match
  for (const [prefix, key] of Object.entries(FAMILY_RATES)) {
    if (model.startsWith(prefix)) return MODEL_RATES[key]
  }
  // Default to sonnet rates
  return MODEL_RATES['claude-sonnet-4-6']
}

// Returns estimated cost in USD
export function estimateCost(
  inputTokens: number,
  outputTokens: number,
  cacheCreation: number,
  cacheRead: number,
  model: string
): number {
  const rates = getRates(model)
  return (
    inputTokens * rates.input +
    outputTokens * rates.output +
    cacheCreation * rates.cacheWrite +
    cacheRead * rates.cacheRead
  ) / 1_000_000
}

// Format token count with K/M suffix
export function formatTokens(count: number): string {
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1)}M`
  if (count >= 1_000) return `${(count / 1_000).toFixed(0)}K`
  return String(count)
}

// Format USD cost
export function formatCost(usd: number | null): string {
  if (usd == null) return '—'
  if (usd >= 100) return `$${usd.toFixed(0)}`
  if (usd >= 1) return `$${usd.toFixed(2)}`
  return `$${usd.toFixed(4)}`
}
