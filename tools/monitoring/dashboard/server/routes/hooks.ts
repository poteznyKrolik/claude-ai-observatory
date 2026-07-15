import { Router } from 'express'
import fs from 'fs'
import os from 'os'
import path from 'path'
import { SETTINGS_GLOBAL_FILE, CLAUDE_DIR } from '../constants.js'
import { getCastDb } from './castDb.js'
import type { HookDefinition } from '../../src/types/index.js'

const router = Router()

// ── Hook health ──────────────────────────────────────────────────────────────
// Resolves each configured command hook to its script path, stats it for
// existence/executability, and joins recent failures from cast.db. The
// exists/executable check is the durable signal — it catches hooks wired in
// settings.json whose scripts are missing or non-executable.

interface HookHealthEntry {
  hook_type: string
  command: string
  script_path: string | null
  exists: boolean
  executable: boolean
  last_fired_at: string | null
  health: 'green' | 'yellow' | 'red'
}

// Pull the script path out of a hook command (e.g. "bash ~/.claude/scripts/x.sh --flag").
function resolveScriptPath(command: string | undefined): string | null {
  if (!command) return null
  const token = command.trim().split(/\s+/).find(t => /\.(sh|py|js|ts|mjs)$/.test(t))
  if (!token) return null
  if (token.startsWith('~')) return path.join(os.homedir(), token.slice(1))
  if (!path.isAbsolute(token)) return path.join(CLAUDE_DIR, token)
  return token
}

function parseHookifyFiles(): HookDefinition[] {
  const hooks: HookDefinition[] = []
  try {
    const files = fs.readdirSync(CLAUDE_DIR).filter(
      f => f.startsWith('hookify.') && f.endsWith('.local.md')
    )
    for (const file of files) {
      const content = fs.readFileSync(path.join(CLAUDE_DIR, file), 'utf-8')
      // Parse YAML frontmatter between --- delimiters
      const fmMatch = content.match(/^---\n([\s\S]*?)\n---/)
      if (!fmMatch) continue
      const fm = fmMatch[1]
      const event = fm.match(/event:\s*(.+)/)?.[1]?.trim()
      const description = fm.match(/description:\s*(.+)/)?.[1]?.trim()
      // Extract conditions for matcher
      const conditionsMatch = fm.match(/conditions:\s*\n([\s\S]*?)(?:\n\w|\n---|\n$)/)
      const matcher = conditionsMatch?.[1]?.trim()
      if (event) {
        hooks.push({
          event,
          type: 'hookify',
          matcher: matcher || undefined,
          description: description || file,
        })
      }
    }
  } catch {
    // ignore
  }
  return hooks
}

router.get('/', (_req, res) => {
  const hooks: HookDefinition[] = []

  try {
    if (fs.existsSync(SETTINGS_GLOBAL_FILE)) {
      const settings = JSON.parse(fs.readFileSync(SETTINGS_GLOBAL_FILE, 'utf-8'))
      const hooksConfig = settings.hooks as Record<string, unknown[]> | undefined
      if (hooksConfig) {
        for (const [event, entries] of Object.entries(hooksConfig)) {
          if (!Array.isArray(entries)) continue
          for (const entry of entries) {
            const rule = entry as Record<string, unknown>
            const matcher = (rule.matcher as string) || undefined
            const subHooks = rule.hooks as Record<string, unknown>[] | undefined
            if (Array.isArray(subHooks)) {
              for (const h of subHooks) {
                hooks.push({
                  event,
                  type: (h.type as string) || 'command',
                  matcher,
                  command: (h.command as string) || undefined,
                  timeout: (h.timeout as number) || undefined,
                  description: (rule.description as string) || undefined,
                })
              }
            } else {
              hooks.push({
                event,
                type: (rule.type as string) || 'command',
                matcher,
                command: (rule.command as string) || undefined,
                timeout: (rule.timeout as number) || undefined,
                description: (rule.description as string) || undefined,
              })
            }
          }
        }
      }
    }
  } catch {
    // ignore
  }

  const hookifyHooks = parseHookifyFiles()
  res.json([...hooks, ...hookifyHooks])
})

// GET /api/hooks/health — per-hook script existence/executability + failure recency.
router.get('/health', (_req, res) => {
  // Most-recent failure timestamp + count per hook_name (best-effort; table may be empty/absent).
  const failuresByName: Record<string, { ts: string; count: number }> = {}
  try {
    const db = getCastDb()
    if (db) {
      try {
        const rows = db
          .prepare('SELECT hook_name, MAX(timestamp) AS ts, COUNT(*) AS cnt FROM hook_failures GROUP BY hook_name')
          .all() as Array<{ hook_name: string; ts: string; cnt: number }>
        for (const r of rows) failuresByName[r.hook_name] = { ts: r.ts, count: r.cnt }
      } catch {
        // hook_failures may not exist on older DBs
      }
    }
  } catch {
    // DB unavailable — fall back to filesystem-only health
  }

  const entries: HookHealthEntry[] = []
  const seen = new Set<string>()

  try {
    if (fs.existsSync(SETTINGS_GLOBAL_FILE)) {
      const settings = JSON.parse(fs.readFileSync(SETTINGS_GLOBAL_FILE, 'utf-8'))
      const hooksConfig = settings.hooks as Record<string, unknown[]> | undefined
      if (hooksConfig) {
        for (const entries_ of Object.values(hooksConfig)) {
          if (!Array.isArray(entries_)) continue
          for (const entry of entries_) {
            const rule = entry as Record<string, unknown>
            const subHooks = (rule.hooks as Record<string, unknown>[] | undefined) ?? [rule]
            for (const h of subHooks) {
              const command = h.command as string | undefined
              if (!command) continue
              const scriptPath = resolveScriptPath(command)
              if (!scriptPath) continue // can't assess non-script hooks
              const key = scriptPath
              if (seen.has(key)) continue
              seen.add(key)

              let exists = false
              let executable = false
              try {
                const st = fs.statSync(scriptPath)
                exists = true
                executable = (st.mode & 0o111) !== 0
              } catch {
                exists = false
              }

              const base = path.basename(scriptPath)
              const fail = failuresByName[base]
              let health: HookHealthEntry['health'] = 'green'
              if (!exists || !executable) {
                health = 'red'
              } else if (fail) {
                const within24h = Date.now() - new Date(fail.ts).getTime() < 24 * 60 * 60 * 1000
                health = within24h ? 'red' : 'yellow'
              }

              entries.push({
                hook_type: base,
                command,
                script_path: scriptPath,
                exists,
                executable,
                last_fired_at: fail?.ts ?? null,
                health,
              })
            }
          }
        }
      }
    }
  } catch {
    // ignore — return whatever we resolved
  }

  res.json({ hooks: entries })
})

export { router as hooksRouter }
