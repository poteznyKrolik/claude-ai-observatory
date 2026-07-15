import { Router } from 'express'
import fs from 'fs'
import path from 'path'
import {
  SETTINGS_FILE,
  SETTINGS_GLOBAL_FILE,
  CLAUDE_MD,
  AGENTS_DIR,
  COMMANDS_DIR,
  SKILLS_DIR,
  RULES_DIR,
  PLANS_DIR,
  PROJECTS_DIR,
  AGENT_MEMORY_DIR,
  CLAUDE_DIR,
} from '../constants.js'
import { getCachedSessions } from '../parsers/sessions.js'
import { isControlEnabled, isControlTokenConfigured } from '../middleware/controlGate.js'
import type { SystemOverview, HookEntry } from '../../src/types/index.js'

// Read dashboard version once at startup — cheap synchronous read, never repeated per-request.
// Uses process.cwd() so it works both when `tsx` runs from project root and in Vitest (jsdom).
const DASHBOARD_VERSION: string = (() => {
  try {
    const raw = fs.readFileSync(path.join(process.cwd(), 'package.json'), 'utf-8')
    return (JSON.parse(raw) as { version?: string }).version ?? 'unknown'
  } catch {
    return 'unknown'
  }
})()

const router = Router()

function countFiles(dir: string, ext?: string): number {
  if (!fs.existsSync(dir)) return 0
  const entries = fs.readdirSync(dir)
  if (ext) return entries.filter(f => f.endsWith(ext)).length
  return entries.filter(f => !f.startsWith('.')).length
}

function countSubdirs(dir: string): number {
  if (!fs.existsSync(dir)) return 0
  return fs.readdirSync(dir).filter(d =>
    fs.statSync(`${dir}/${d}`).isDirectory()
  ).length
}

function countAgentGroups(): number {
  const groupsFile = `${CLAUDE_DIR}/config/agent-groups.json`
  if (!fs.existsSync(groupsFile)) return 31
  try {
    const data = JSON.parse(fs.readFileSync(groupsFile, 'utf-8'))
    return Object.keys(data).length
  } catch {
    return 31
  }
}

function countDirectives(): number {
  if (!fs.existsSync(CLAUDE_MD)) return 11
  try {
    const content = fs.readFileSync(CLAUDE_MD, 'utf-8')
    const matches = content.match(/\[CAST-[A-Z_-]+\]/g) ?? []
    const unique = new Set(matches)
    return unique.size || 11
  } catch {
    return 11
  }
}

function countProjectMemory(): number {
  if (!fs.existsSync(PROJECTS_DIR)) return 0
  let count = 0
  for (const d of fs.readdirSync(PROJECTS_DIR)) {
    const memDir = `${PROJECTS_DIR}/${d}/memory`
    if (fs.existsSync(memDir) && fs.statSync(memDir).isDirectory()) {
      count += fs.readdirSync(memDir).filter(f => f.endsWith('.md')).length
    }
  }
  return count
}

function parseHooks(settings: Record<string, unknown>): HookEntry[] {
  const hooks: HookEntry[] = []
  const hooksConfig = settings.hooks as Record<string, unknown[]> | undefined
  if (!hooksConfig) return hooks

  for (const [event, entries] of Object.entries(hooksConfig)) {
    if (!Array.isArray(entries)) continue
    for (const entry of entries) {
      const rule = entry as Record<string, unknown>
      const matcher = (rule.matcher as string) || undefined
      // Hooks are nested: each rule has a "hooks" sub-array with {type, command, timeout}
      const subHooks = rule.hooks as Record<string, unknown>[] | undefined
      if (Array.isArray(subHooks)) {
        for (const h of subHooks) {
          hooks.push({
            event,
            matcher,
            type: (h.type as string) || 'command',
            command: (h.command as string) || undefined,
            timeout: (h.timeout as number) || undefined,
            description: (rule.description as string) || undefined,
          })
        }
      } else {
        // Fallback: treat rule itself as the hook definition
        hooks.push({
          event,
          matcher,
          type: (rule.type as string) || 'command',
          command: (rule.command as string) || undefined,
          timeout: (rule.timeout as number) || undefined,
          description: (rule.description as string) || undefined,
        })
      }
    }
  }
  return hooks
}

router.get('/', (_req, res) => {
  let settings = {}
  if (fs.existsSync(SETTINGS_FILE)) {
    try {
      settings = JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf-8'))
    } catch {
      // ignore
    }
  }

  let claudeMd = ''
  if (fs.existsSync(CLAUDE_MD)) {
    claudeMd = fs.readFileSync(CLAUDE_MD, 'utf-8')
  }

  res.json({ settings, claudeMd })
})

router.get('/settings', (_req, res) => {
  try {
    const content = fs.existsSync(SETTINGS_GLOBAL_FILE)
      ? fs.readFileSync(SETTINGS_GLOBAL_FILE, 'utf-8')
      : '{}'
    res.json({ body: '```json\n' + content + '\n```' })
  } catch {
    res.json({ body: 'Failed to read settings.json' })
  }
})

router.get('/settings-local', (_req, res) => {
  try {
    const content = fs.existsSync(SETTINGS_FILE)
      ? fs.readFileSync(SETTINGS_FILE, 'utf-8')
      : '{}'
    res.json({ body: '```json\n' + content + '\n```' })
  } catch {
    res.json({ body: 'Failed to read settings.local.json' })
  }
})

router.get('/health', (_req, res) => {
  let settings: Record<string, unknown> = {}
  if (fs.existsSync(SETTINGS_GLOBAL_FILE)) {
    try {
      settings = JSON.parse(fs.readFileSync(SETTINGS_GLOBAL_FILE, 'utf-8'))
    } catch {
      // ignore
    }
  }

  const sessions = getCachedSessions()

  const overview: SystemOverview = {
    agentCount: countFiles(AGENTS_DIR, '.md'),
    commandCount: countFiles(COMMANDS_DIR, '.md'),
    skillCount: countFiles(SKILLS_DIR),
    ruleCount: countFiles(RULES_DIR, '.md'),
    planCount: countFiles(PLANS_DIR, '.md'),
    projectMemoryCount: countProjectMemory(),
    agentMemoryCount: countSubdirs(AGENT_MEMORY_DIR),
    sessionCount: sessions.length,
    settingsCount: (fs.existsSync(SETTINGS_FILE) ? 1 : 0) + (fs.existsSync(SETTINGS_GLOBAL_FILE) ? 1 : 0),
    groupCount: countAgentGroups(),
    directiveCount: countDirectives(),
    hooks: parseHooks(settings),
    env: {
      platform: process.platform,
      nodeVersion: process.version,
      homeConfigured: !!(process.env.HOME),
    },
    model: (settings.model as string) || 'unknown',
    version: DASHBOARD_VERSION,
  }

  res.json(overview)
})

// GET /api/config/control — report whether the write surface is enabled so the
// UI can show or hide control affordances. Never exposes the token itself.
router.get('/control', (_req, res) => {
  res.json({
    enabled: isControlEnabled(),
    tokenConfigured: isControlTokenConfigured(),
  })
})

// ── Config file endpoints ─────────────────────────────────────────────────

function readConfigJson(filename: string): Record<string, unknown> | null {
  const paths = [
    `${CLAUDE_DIR}/config/${filename}`,
    `${process.env.HOME}/Projects/personal/claude-agent-team/config/${filename}`,
  ]
  for (const p of paths) {
    if (fs.existsSync(p)) {
      try {
        return JSON.parse(fs.readFileSync(p, 'utf-8'))
      } catch {
        // try next
      }
    }
  }
  return null
}

router.get('/chain-map', (_req, res) => {
  const data = readConfigJson('chain-map.json')
  if (!data) return res.status(404).json({ error: 'chain-map.json not found' })
  res.json(data)
})

router.get('/policies', (_req, res) => {
  const data = readConfigJson('policies.json')
  if (!data) return res.status(404).json({ error: 'policies.json not found' })
  res.json(data)
})

router.get('/model-pricing', (_req, res) => {
  const data = readConfigJson('model-pricing.json')
  if (!data) return res.status(404).json({ error: 'model-pricing.json not found' })
  res.json(data)
})

router.get('/agent-groups', (_req, res) => {
  const data = readConfigJson('agent-groups.json')
  if (!data) return res.status(404).json({ error: 'agent-groups.json not found' })
  res.json(data)
})

export { router as configRouter }
