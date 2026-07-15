/**
 * Agent Personality System — 8-bit office worker characters for the war room.
 * Each agent gets a pixel art sprite, neon accent color, role title, and tagline.
 *
 * Sprites are 8 cols × 10 rows. Color keys:
 *   '.' = transparent
 *   'K' = #0d1117 (outline)
 *   'B' = accentColor (body / hat main)
 *   'S' = #FFDBAC (skin)
 *   'E' = #1a1a2e (eye)
 *   'W' = #ffffff (white — lab coat, screen glow)
 */

export interface AgentPersonality {
  archetype: 'commander' | 'strategist' | 'detective' | 'builder' | 'scientist' | 'scribe' | 'operative'
  accentColor: string   // neon hex — used for body color, border glow
  roleTitle: string     // short ALL-CAPS display label
  tagline: string       // punchy one-liner
}

// ─── Color palette ─────────────────────────────────────────────────────────
const K = '#0d1117'    // outline
const S = '#FFDBAC'    // skin
const E = '#1a1a2e'    // eye
const W = '#ffffff'    // white
const _ = ''           // transparent

// ─── Build a 10×8 color grid from a sprite template + accent color ──────────
function buildGrid(template: string[], accent: string): string[][] {
  const palette: Record<string, string> = {
    '.': _, K: K, B: accent, S: S, E: E, W: W,
  }
  return template.map(row =>
    [...row.padEnd(8, '.')].map(ch => palette[ch] ?? _)
  )
}

// ─── Sprite templates (8 wide × 10 tall) ──────────────────────────────────

const SPRITES: Record<string, string[]> = {
  // Screen/visor — Senior Dev at the terminal
  commander: [
    '..KBBK..',
    '.KBWWBK.',
    '.KBWWBK.',
    '..KSSKK.',
    '...KKK..',
    '..KBBK..',
    '.KBBBBK.',
    '.KBBBBK.',
    '..KK.KK.',
    '.KKK.KKK',
  ],
  // Pointy wizard hat — planner/architect types
  strategist: [
    '...BB...',
    '..KBBK..',
    '.KBBBBK.',
    '.KSSKK..',
    '..KEKK..',
    '...KKK..',
    '..KBBK..',
    '.KBBBBK.',
    '..KK.KK.',
    '.KKK.KKK',
  ],
  // Wide fedora brim — detective types
  detective: [
    '.KBBBBK.',
    'KBBBBBBK',
    '.KSSKK..',
    '..KSEKK.',
    '...KKK..',
    '..KBBK..',
    '.KBBBBK.',
    '.KBBBBK.',
    '..KK.KK.',
    '.KKK.KKK',
  ],
  // Hard hat dome — builder/worker types
  builder: [
    '.KKBBKK.',
    '.KBBBBK.',
    '.KSSKK..',
    '..KSEKK.',
    '...KKK..',
    '..KBBK..',
    '.KBBBBK.',
    '.KBBBBK.',
    '..KK.KK.',
    '.KKK.KKK',
  ],
  // White lab coat — scientist types (W maps to white body)
  scientist: [
    '..KSSKK.',
    '.KSSEKK.',
    '..KSSKK.',
    '...KKK..',
    '..KBBK..',
    '.KWWWWK.',
    '.KWWWWK.',
    '.KWWWWK.',
    '..KK.KK.',
    '.KKK.KKK',
  ],
  // Flat mortarboard — scribe/writer types
  scribe: [
    'KBBBBBBK',
    '..KBBK..',
    '.KSSKK..',
    '..KSEKK.',
    '...KKK..',
    '..KBBK..',
    '.KBBBBK.',
    '.KBBBBK.',
    '..KK.KK.',
    '.KKK.KKK',
  ],
  // Hood framing face — operative/field types
  operative: [
    '.KBBBBK.',
    'KBSSSKBK',
    'KBSSSKBK',
    'KBSEBKBK',
    '.KBBBKK.',
    '..KBBK..',
    '.KBBBBK.',
    '.KBBBBK.',
    '..KK.KK.',
    '.KKK.KKK',
  ],
}

// ─── Animation frame templates (deltas from base SPRITES) ─────────────────
// Each state is an array of string[] templates (same 8×10 format as SPRITES).
// For idle: frame[0] of the compiled result = the base sprite (prepended by getAgentFrames).
// For working/reacting: all frames are provided explicitly in the template.

type FrameSet = Partial<Record<'idle' | 'working' | 'reacting', string[][]>>

const SPRITE_FRAME_TEMPLATES: Record<string, FrameSet> = {
  commander: {
    idle: [
      // alternate idle frame — arms tucked, legs shifted
      [
        '..KBBK..',
        '.KBWWBK.',
        '.KBWWBK.',
        '..KSSKK.',
        '...KKK..',
        '..KBBK..',
        '.KBBBBK.',
        '.KBBBKK.',
        '..KKKKK.',
        '.KKK.KKK',
      ],
    ],
    working: [
      [
        '..KBBK..',
        '.KBWWBK.',
        '.KBWWBK.',
        '..KSSKK.',
        '...KKK..',
        '..KBBK..',
        '.KBBBBK.',
        '.KBBBKK.',  // hands down at keyboard
        '..KKKKK.',
        '.KKK.KKK',
      ],
      [
        '..KBBK..',
        '.KBWWBK.',
        '.KBWWBK.',
        '..KSSKK.',
        '...KKK..',
        '..KBBK..',
        '.KBBBBK.',
        '.KBBBBK.',  // one arm raised
        '.KK..KK.',
        '.KKK.KKK',
      ],
    ],
    reacting: [
      [
        '..KBBK..',
        '.KBWWBK.',
        '.KBWWBK.',
        '..KSSKK.',
        '...KKK..',
        '.KBKBBK.',  // arms raised wide
        'KBKBBKBK',
        '.KBBBBK.',
        '..KK.KK.',
        '.KKK.KKK',
      ],
      [
        '..KBBK..',
        '.KBWWBK.',
        '.KBWWBK.',
        '..KSSKK.',
        '...KKK..',
        '..KBBK..',
        '.KBBBBK.',
        '.KBBBBK.',
        '..KK.KK.',
        '.KKK.KKK',
      ],
    ],
  },

  strategist: {
    idle: [
      // alternate idle frame — hat tip bob
      [
        '....B...',
        '...KBBK.',
        '.KBBBBK.',
        '.KSSKK..',
        '..KEKK..',
        '...KKK..',
        '..KBBK..',
        '.KBBBBK.',
        '..KK.KK.',
        '.KKK.KKK',
      ],
    ],
    working: [
      [
        '...BB...',
        '..KBBK..',
        '.KBBBBK.',
        '.KSSKK..',
        '..KEKK..',
        '...KKK..',
        '..KBBK..',
        '.KBBBKK.',
        '..KKKKK.',
        '.KKK.KKK',
      ],
      [
        '...BB...',
        '..KBBK..',
        '.KBBBBK.',
        '.KSSKK..',
        '..KEKK..',
        '...KKK..',
        '..KBBK..',
        '.KBBBBK.',
        '.KK..KK.',
        '.KKK.KKK',
      ],
    ],
    reacting: [
      [
        '...BB...',
        '..KBBK..',
        '.KBBBBK.',
        '.KSSKK..',
        '..KEKK..',
        '...KKK..',
        '.KBKBBK.',
        'KBKBBKBK',
        '..KK.KK.',
        '.KKK.KKK',
      ],
      [
        '...BB...',
        '..KBBK..',
        '.KBBBBK.',
        '.KSSKK..',
        '..KEKK..',
        '...KKK..',
        '..KBBK..',
        '.KBBBBK.',
        '..KK.KK.',
        '.KKK.KKK',
      ],
    ],
  },

  detective: {
    idle: [
      // alternate idle frame — body sway
      [
        '.KBBBBK.',
        'KBBBBBBK',
        '.KSSKK..',
        '..KSEKK.',
        '...KKK..',
        '..KBBK..',
        '.KBBBBK.',
        '.KBBBBK.',
        '..KKKKK.',
        '.KKK.KKK',
      ],
    ],
    working: [
      [
        '.KBBBBK.',
        'KBBBBBBK',
        '.KSSKK..',
        '..KSEKK.',
        '...KKK..',
        '..KBBK..',
        '.KBBBKK.',
        '.KBBBBK.',
        '..KKKKK.',
        '.KKK.KKK',
      ],
      [
        '.KBBBBK.',
        'KBBBBBBK',
        '.KSSKK..',
        '..KSEKK.',
        '...KKK..',
        '..KBBK..',
        '.KBBBBK.',
        '.KBBBBK.',
        '..KK.KK.',
        '.KKK.KKK',
      ],
    ],
    reacting: [
      [
        '.KBBBBK.',
        'KBBBBBBK',
        '.KSSKK..',
        '..KSEKK.',
        '..KBKK..',  // fedora tilt
        '.KBKBBK.',
        'KBKBBKBK',
        '.KBBBBK.',
        '..KK.KK.',
        '.KKK.KKK',
      ],
      [
        '.KBBBBK.',
        'KBBBBBBK',
        '.KSSKK..',
        '..KSEKK.',
        '...KKK..',
        '..KBBK..',
        '.KBBBBK.',
        '.KBBBBK.',
        '..KK.KK.',
        '.KKK.KKK',
      ],
    ],
  },

  builder: {
    idle: [
      // alternate idle frame — tool arm shift
      [
        '.KKBBKK.',
        '.KBBBBK.',
        '.KSSKK..',
        '..KSEKK.',
        '...KKK..',
        '..KBBK..',
        '.KBBBKK.',
        '.KBBBBK.',
        '..KKKKK.',
        '.KKK.KKK',
      ],
    ],
    working: [
      [
        '.KKBBKK.',
        '.KBBBBK.',
        '.KSSKK..',
        '..KSEKK.',
        '...KKK..',
        '..KBBK..',
        '.KBBBKK.',
        '.KBBBBK.',
        '..KKKKK.',
        '.KKK.KKK',
      ],
      [
        '.KKBBKK.',
        '.KBBBBK.',
        '.KSSKK..',
        '..KSEKK.',
        '...KKK..',
        '..KBBK..',
        '.KBBBBK.',
        '.KBBBBK.',
        '.KK..KK.',
        '.KKK.KKK',
      ],
    ],
    reacting: [
      [
        '.KKBBKK.',
        '.KBBBBK.',
        '.KSSKK..',
        '..KSEKK.',
        '...KKK..',
        '.KBKBBK.',
        'KBKBBKBK',
        '.KBBBBK.',
        '..KK.KK.',
        '.KKK.KKK',
      ],
      [
        '.KKBBKK.',
        '.KBBBBK.',
        '.KSSKK..',
        '..KSEKK.',
        '...KKK..',
        '..KBBK..',
        '.KBBBBK.',
        '.KBBBBK.',
        '..KK.KK.',
        '.KKK.KKK',
      ],
    ],
  },

  scientist: {
    idle: [
      // alternate idle frame — clipboard arm in
      [
        '..KSSKK.',
        '.KSSEKK.',
        '..KSSKK.',
        '...KKK..',
        '..KBBK..',
        '.KWWWWK.',
        '.KWWWWK.',
        '.KWWWKK.',
        '..KKKKK.',
        '.KKK.KKK',
      ],
    ],
    working: [
      [
        '..KSSKK.',
        '.KSSEKK.',
        '..KSSKK.',
        '...KKK..',
        '..KBBK..',
        '.KWWWWK.',
        '.KWWWKK.',
        '.KWWWWK.',
        '..KKKKK.',
        '.KKK.KKK',
      ],
      [
        '..KSSKK.',
        '.KSSEKK.',
        '..KSSKK.',
        '...KKK..',
        '..KBBK..',
        '.KWWWWK.',
        '.KWWWWK.',
        '.KWWWWK.',
        '.KK..KK.',
        '.KKK.KKK',
      ],
    ],
    reacting: [
      [
        '..KSSKK.',
        '.KSSEKK.',
        '..KSSKK.',
        '...KKK..',
        '..KBBK..',
        '.KWKWWK.',  // eureka arms wide
        'KWKWWKWK',
        '.KWWWWK.',
        '..KK.KK.',
        '.KKK.KKK',
      ],
      [
        '..KSSKK.',
        '.KSSEKK.',
        '..KSSKK.',
        '...KKK..',
        '..KBBK..',
        '.KWWWWK.',
        '.KWWWWK.',
        '.KWWWWK.',
        '..KK.KK.',
        '.KKK.KKK',
      ],
    ],
  },

  scribe: {
    idle: [
      // alternate idle frame — pen arm shift
      [
        'KBBBBBBK',
        '..KBBK..',
        '.KSSKK..',
        '..KSEKK.',
        '...KKK..',
        '..KBBK..',
        '.KBBBBK.',
        '.KBBBKK.',
        '..KKKKK.',
        '.KKK.KKK',
      ],
    ],
    working: [
      [
        'KBBBBBBK',
        '..KBBK..',
        '.KSSKK..',
        '..KSEKK.',
        '...KKK..',
        '..KBBK..',
        '.KBBBKK.',
        '.KBBBBK.',
        '..KKKKK.',
        '.KKK.KKK',
      ],
      [
        'KBBBBBBK',
        '..KBBK..',
        '.KSSKK..',
        '..KSEKK.',
        '...KKK..',
        '..KBBK..',
        '.KBBBBK.',
        '.KBBBBK.',
        '.KK..KK.',
        '.KKK.KKK',
      ],
    ],
    reacting: [
      [
        'KBBBBBBK',
        '..KBBK..',
        '.KSSKK..',
        '..KSEKK.',
        '...KKK..',
        '.KBKBBK.',
        'KBKBBKBK',
        '.KBBBBK.',
        '..KK.KK.',
        '.KKK.KKK',
      ],
      [
        'KBBBBBBK',
        '..KBBK..',
        '.KSSKK..',
        '..KSEKK.',
        '...KKK..',
        '..KBBK..',
        '.KBBBBK.',
        '.KBBBBK.',
        '..KK.KK.',
        '.KKK.KKK',
      ],
    ],
  },

  operative: {
    idle: [
      // alternate idle frame — settle
      [
        '.KBBBBK.',
        'KBSSSKBK',
        'KBSSSKBK',
        'KBSEBKBK',
        '.KBBBKK.',
        '..KBBK..',
        '.KBBBBK.',
        '.KBBBBK.',
        '..KKKKK.',
        '.KKK.KKK',
      ],
    ],
    working: [
      [
        '.KBBBBK.',
        'KBSSSKBK',
        'KBSSSKBK',
        'KBSEBKBK',
        '.KBBBKK.',
        '..KBBK..',
        '.KBBBKK.',  // crouch-type
        '.KBBBBK.',
        '..KKKKK.',
        '.KKK.KKK',
      ],
      [
        '.KBBBBK.',
        'KBSSSKBK',
        'KBSSSKBK',
        'KBSEBKBK',
        '.KBBBKK.',
        '..KBBK..',
        '.KBBBBK.',
        '.KBBBBK.',
        '.KK..KK.',
        '.KKK.KKK',
      ],
    ],
    reacting: [
      [
        '.KBBBBK.',
        'KBSSSKBK',
        'KBSSSKBK',
        'KBSEBKBK',
        '.KBBBKK.',
        '.KBKBBK.',  // arms wide
        'KBKBBKBK',
        '.KBBBBK.',
        '..KK.KK.',
        '.KKK.KKK',
      ],
      [
        '.KBBBBK.',
        'KBSSSKBK',
        'KBSSSKBK',
        'KBSEBKBK',
        '.KBBBKK.',
        '..KBBK..',
        '.KBBBBK.',
        '.KBBBBK.',
        '..KK.KK.',
        '.KKK.KKK',
      ],
    ],
  },
}

// ─── Get compiled sprite grid for a named agent ────────────────────────────
export function getAgentSprite(agentName: string): string[][] {
  const p = AGENT_PERSONALITIES[agentName] ?? AGENT_PERSONALITIES['general-purpose']
  return buildGrid(SPRITES[p.archetype], p.accentColor)
}

/**
 * Returns compiled animation frame grids for a named agent.
 * idle state: frame[0] is always the base sprite; subsequent frames are the alternates.
 * working/reacting states: all frames are from the template set.
 */
export function getAgentFrames(
  agentName: string
): Partial<Record<'idle' | 'working' | 'reacting', string[][][]>> {
  const p = AGENT_PERSONALITIES[agentName] ?? AGENT_PERSONALITIES['general-purpose']
  const baseGrid = buildGrid(SPRITES[p.archetype], p.accentColor)
  const templateSet = SPRITE_FRAME_TEMPLATES[p.archetype]
  if (!templateSet) return {}

  const result: Partial<Record<'idle' | 'working' | 'reacting', string[][][]>> = {}

  for (const state of ['idle', 'working', 'reacting'] as const) {
    const stateTemplates = templateSet[state]
    if (!stateTemplates) continue
    // Prepend the base sprite as frame[0] for idle; working/reacting own their frame[0]
    result[state] = state === 'idle'
      ? [baseGrid, ...stateTemplates.map(t => buildGrid(t, p.accentColor))]
      : stateTemplates.map(t => buildGrid(t, p.accentColor))
  }

  return result
}

export function getSeniorDevSprite(): string[][] {
  return buildGrid(SPRITES['commander'], '#00FFC2')
}

// ─── v3 agent personalities (15 agents) + built-ins + fallback ──────────────
export const AGENT_PERSONALITIES: Record<string, AgentPersonality> = {
  // ── Sonnet agents ─────────────────────────────────────────────────────────
  'code-writer': {
    archetype: 'commander',
    accentColor: '#00FFC2',
    roleTitle: 'THE BUILDER',
    tagline: 'Ships clean code.',
  },
  debugger: {
    archetype: 'detective',
    accentColor: '#F59E0B',
    roleTitle: 'DETECTIVE',
    tagline: 'No bug escapes.',
  },
  planner: {
    archetype: 'strategist',
    accentColor: '#60A5FA',
    roleTitle: 'STRATEGIST',
    tagline: 'Always has a plan.',
  },
  security: {
    archetype: 'detective',
    accentColor: '#EF4444',
    roleTitle: 'GUARDIAN',
    tagline: 'Sleep easy. I\'m watching.',
  },
  merge: {
    archetype: 'builder',
    accentColor: '#FB923C',
    roleTitle: 'THE MERGER',
    tagline: 'Conflicts resolved.',
  },
  researcher: {
    archetype: 'operative',
    accentColor: '#818CF8',
    roleTitle: 'THE ANALYST',
    tagline: 'Data doesn\'t lie.',
  },
  docs: {
    archetype: 'scribe',
    accentColor: '#FBBF24',
    roleTitle: 'SCRIBE',
    tagline: 'Words matter.',
  },
  'bash-specialist': {
    archetype: 'operative',
    accentColor: '#A78BFA',
    roleTitle: 'SHELL OPS',
    tagline: 'Scripts never lie.',
  },
  orchestrator: {
    archetype: 'strategist',
    accentColor: '#00FFC2',
    roleTitle: 'CONDUCTOR',
    tagline: 'Runs the whole show.',
  },
  'morning-briefing': {
    archetype: 'operative',
    accentColor: '#FB923C',
    roleTitle: 'EARLY BIRD',
    tagline: 'Already on coffee 3.',
  },
  devops: {
    archetype: 'builder',
    accentColor: '#10B981',
    roleTitle: 'OPS',
    tagline: 'Ship it.',
  },
  // ── Haiku agents ──────────────────────────────────────────────────────────
  'code-reviewer': {
    archetype: 'detective',
    accentColor: '#22D3EE',
    roleTitle: 'THE HAWK',
    tagline: 'Nothing gets past me.',
  },
  commit: {
    archetype: 'builder',
    accentColor: '#EAB308',
    roleTitle: 'ARCHIVIST',
    tagline: 'Every change immortalized.',
  },
  push: {
    archetype: 'builder',
    accentColor: '#F472B6',
    roleTitle: 'LAUNCHER',
    tagline: 'Shipped.',
  },
  'test-runner': {
    archetype: 'scientist',
    accentColor: '#4ADE80',
    roleTitle: 'TESTER',
    tagline: 'Green means go.',
  },
  'test-writer': {
    archetype: 'scientist',
    accentColor: '#E879F9',
    roleTitle: 'TEST ARCHITECT',
    tagline: 'Every edge case covered.',
  },
  // ── Field Ops (built-in Claude Code agents) ──────────────────────────────
  explore: {
    archetype: 'detective',
    accentColor: '#38BDF8',
    roleTitle: 'SCOUT',
    tagline: 'Mapping the terrain.',
  },
  plan: {
    archetype: 'strategist',
    accentColor: '#818CF8',
    roleTitle: 'STRATEGIST',
    tagline: 'Charting the course.',
  },
  // ── Fallback ──────────────────────────────────────────────────────────────
  'general-purpose': {
    archetype: 'operative',
    accentColor: '#6B7280',
    roleTitle: 'FIELD OPS',
    tagline: 'Here for the unexpected.',
  },
}

/** Model tier display info */
export function getModelTier(model?: string): { label: string; color: string; bg: string } {
  if (!model) return { label: 'unknown', color: '#6B7280', bg: 'rgba(107,114,128,0.15)' }
  if (model.includes('haiku'))  return { label: 'haiku',  color: '#60A5FA', bg: 'rgba(96,165,250,0.15)' }
  if (model.includes('opus'))   return { label: 'opus',   color: '#A78BFA', bg: 'rgba(167,139,250,0.15)' }
  return { label: 'sonnet', color: '#00FFC2', bg: 'rgba(0,255,194,0.12)' }
}
