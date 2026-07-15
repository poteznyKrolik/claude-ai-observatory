import { Router } from 'express'
import fs from 'fs'
import path from 'path'
import os from 'os'
import { spawn } from 'child_process'

export const castExecRouter = Router()

const PLANS_DIR = path.join(os.homedir(), '.claude', 'plans')
const EXEC_STATE_DIR = path.join(os.homedir(), '.claude', 'cast', 'exec-state')
const CAST_BIN = path.join(os.homedir(), 'Projects', 'personal', 'claude-agent-team', 'bin', 'cast')

/** Check if a file contains a json dispatch manifest block */
function hasManifest(content: string): boolean {
  return /json\s+dispatch/i.test(content)
}

// GET /api/cast/plans
castExecRouter.get('/plans', (_req, res) => {
  if (!fs.existsSync(PLANS_DIR)) {
    res.json([])
    return
  }

  try {
    const files = fs.readdirSync(PLANS_DIR)
    const plans = files
      .filter(f => f.endsWith('.md'))
      .map(f => {
        const filePath = path.join(PLANS_DIR, f)
        try {
          const stat = fs.statSync(filePath)
          const content = fs.readFileSync(filePath, 'utf-8')
          return {
            name: f,
            path: filePath,
            modified_at: stat.mtime.toISOString(),
            has_manifest: hasManifest(content),
          }
        } catch {
          return null
        }
      })
      .filter(Boolean)
      .sort((a, b) => new Date(b!.modified_at).getTime() - new Date(a!.modified_at).getTime())

    res.json(plans)
  } catch (err) {
    res.status(500).json({ error: 'Failed to list plans' })
  }
})

// POST /api/cast/exec
castExecRouter.post('/exec', (req, res) => {
  const { planFile } = req.body as { planFile?: string }
  if (!planFile) {
    res.status(400).json({ error: 'planFile is required' })
    return
  }

  // Sanitize: only allow basename to prevent path traversal
  const basename = path.basename(planFile)
  const resolvedPath = path.join(PLANS_DIR, basename)

  if (!fs.existsSync(resolvedPath)) {
    res.status(404).json({ error: 'Plan file not found' })
    return
  }

  const planId = path.basename(basename, '.md')

  try {
    const child = spawn(CAST_BIN, ['exec', resolvedPath], {
      detached: true,
      stdio: 'ignore',
    })
    child.unref()
  } catch (err) {
    res.status(500).json({ error: 'Failed to spawn cast exec' })
    return
  }

  res.json({ plan_id: planId })
})

// GET /api/cast/exec/:plan_id/status
castExecRouter.get('/exec/:plan_id/status', (req, res) => {
  const { plan_id } = req.params
  // Sanitize plan_id — only allow safe filename chars
  if (!/^[\w.\-]+$/.test(plan_id)) {
    res.status(400).json({ error: 'Invalid plan_id' })
    return
  }

  const stateFile = path.join(EXEC_STATE_DIR, `${plan_id}.json`)

  if (!fs.existsSync(stateFile)) {
    res.json({ status: 'not_started' })
    return
  }

  try {
    const content = fs.readFileSync(stateFile, 'utf-8')
    const state = JSON.parse(content)
    res.json(state)
  } catch {
    res.status(500).json({ error: 'Failed to read exec state' })
  }
})
