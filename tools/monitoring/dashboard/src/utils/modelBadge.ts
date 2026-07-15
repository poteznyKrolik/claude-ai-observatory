/**
 * Shared model badge utilities for consistent model labeling across the UI.
 * Live model ids (CAST v9.0.0): claude-fable-5, claude-opus-4-8, claude-sonnet-4-6, claude-haiku-4-5-20251001
 */

export function modelBadgeClasses(model: string): string {
  if (model?.includes('fable'))  return 'bg-rose-500/20 text-rose-300 border-rose-500/30'
  if (model?.includes('haiku'))  return 'bg-sky-500/20 text-sky-300 border-sky-500/30'
  if (model?.includes('sonnet')) return 'bg-violet-500/20 text-violet-300 border-violet-500/30'
  if (model?.includes('opus'))   return 'bg-amber-500/20 text-amber-300 border-amber-500/30'
  return 'bg-zinc-500/20 text-zinc-400 border-zinc-500/30'
}

export function modelLabel(model: string): string {
  if (model?.includes('fable'))  return 'Fable'
  if (model?.includes('haiku'))  return 'Haiku'
  if (model?.includes('sonnet')) return 'Sonnet'
  if (model?.includes('opus'))   return 'Opus'
  return model || 'Unknown'
}
