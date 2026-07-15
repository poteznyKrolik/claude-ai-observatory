import { Router } from 'express'
import fs from 'fs'
import os from 'os'
import path from 'path'
import crypto from 'crypto'
import { execFile, spawn } from 'child_process'
import { DASHBOARD_COMMANDS_DIR } from '../constants.js'
import { getCastDbWritable } from './castDb.js'
import type { DashboardCommand, CommandType } from '../../src/types/index.js'

// CAST repo path — configurable via CAST_REPO_PATH env var; never accept from request body
const CAST_REPO_PATH = process.env.CAST_REPO_PATH ?? path.join(os.homedir(), 'Projects', 'personal', 'claude-agent-team')

export const controlRouter = Router()

/** Ensure the commands directory exists before writing */
function ensureDir() {
  fs.mkdirSync(DASHBOARD_COMMANDS_DIR, { recursive: true })
}

/** Write a command file and return the created command */
function writeCommand(type: CommandType, payload: Record<string, unknown>): DashboardCommand {
  ensureDir()
  const id = crypto.randomUUID()
  const queuedAt = new Date().toISOString()
  const cmd: DashboardCommand = { id, type, payload, queuedAt }
  const timestamp = queuedAt.replace(/[:.]/g, '-')
  const filename = `${timestamp}-${type}-${id}.json`
  const filePath = path.join(DASHBOARD_COMMANDS_DIR, filename)
  // Write with processedAt: null explicitly so the processor can detect unprocessed files
  fs.writeFileSync(filePath, JSON.stringify({ ...cmd, processedAt: null }, null, 2), 'utf-8')
  return cmd
}

// GET /api/control/queue — list all commands sorted by queuedAt desc
controlRouter.get('/queue', (_req, res) => {
  ensureDir()
  const commands: DashboardCommand[] = []
  try {
    const files = fs.readdirSync(DASHBOARD_COMMANDS_DIR).filter(f => f.endsWith('.json'))
    for (const file of files) {
      try {
        const raw = fs.readFileSync(path.join(DASHBOARD_COMMANDS_DIR, file), 'utf-8')
        commands.push(JSON.parse(raw) as DashboardCommand)
      } catch { /* skip malformed */ }
    }
    commands.sort((a, b) => new Date(b.queuedAt).getTime() - new Date(a.queuedAt).getTime())
    res.json(commands)
  } catch {
    res.json([])
  }
})

// POST /api/control/dispatch — spawn claude directly and track in cast.db task_queue
controlRouter.post('/dispatch', (req, res) => {
  const { agentType, prompt, model } = req.body as { agentType?: string; prompt?: string; model?: string }
  if (!agentType || typeof agentType !== 'string' || agentType.trim() === '') {
    return res.status(400).json({ error: 'agentType is required' })
  }
  // agentType is an agent definition name — constrain to a safe, bounded token.
  if (!/^[a-zA-Z0-9_-]{1,64}$/.test(agentType.trim())) {
    return res.status(400).json({ error: 'Invalid agentType format' })
  }
  if (!prompt || typeof prompt !== 'string' || prompt.trim() === '') {
    return res.status(400).json({ error: 'prompt is required' })
  }
  // Cap prompt length — an unbounded prompt is a memory/cost DoS vector.
  if (prompt.length > 10_000) {
    return res.status(400).json({ error: 'prompt exceeds 10000 character limit' })
  }

  const db = getCastDbWritable()
  if (!db) {
    return res.status(503).json({ error: 'cast.db not found — cannot dispatch task' })
  }

  try {
    const now = new Date().toISOString()
    const resolvedModel = (model ?? 'sonnet').trim()

    const VALID_MODELS = ['haiku', 'sonnet', 'opus', 'fable', 'claude-haiku-4-5-20251001', 'claude-sonnet-4-6', 'claude-opus-4-8', 'claude-fable-5']
    if (!VALID_MODELS.includes(resolvedModel)) {
      return res.status(400).json({ error: 'Invalid model' })
    }

    const claudeBin = process.env.CLAUDE_PATH ?? 'claude'
    const id = crypto.randomUUID()

    // Ensure log directory exists
    const logDir = path.join(os.homedir(), '.claude', 'cast', 'dispatch-logs')
    fs.mkdirSync(logDir, { recursive: true })
    const logPath = path.join(logDir, `${id}.log`)
    const logStream = fs.createWriteStream(logPath, { flags: 'a' })

    const child = spawn(
      claudeBin,
      ['--print', '-p', prompt.trim(), '--model', resolvedModel],
      { detached: true, stdio: ['ignore', logStream, logStream] }
    )

    const taskPayload = JSON.stringify({
      prompt: prompt.trim(),
      model: resolvedModel,
      pid: child.pid,
      logPath,
    })

    const insertResult = db.prepare(`
      INSERT INTO task_queue (created_at, agent, task, priority, status, retry_count, max_retries)
      VALUES (?, ?, ?, 5, 'pending', 0, 3)
    `).run(now, agentType.trim(), taskPayload)

    const rowId = Number(insertResult.lastInsertRowid)
    db.close()

    child.on('exit', (code) => {
      logStream.end()
      const exitStatus = code === 0 ? 'done' : 'failed'
      try {
        const writeDb = getCastDbWritable()
        if (writeDb) {
          writeDb.prepare(`UPDATE task_queue SET status = ?, result_summary = ? WHERE rowid = ?`)
            .run(exitStatus, `exit ${code ?? 'null'}`, rowId)
          writeDb.close()
        }
      } catch (updateErr) {
        console.error('[dispatch] Failed to update task status on exit:', updateErr)
      }
    })

    child.unref()

    res.status(201).json({ id, agent: agentType.trim(), status: 'running', pid: child.pid })
  } catch (err) {
    console.error('Dispatch error:', err)
    try { db.close() } catch { /* ignore */ }
    res.status(500).json({ error: 'Failed to dispatch agent' })
  }
})

// POST /api/control/kill/:sessionId — queue a kill signal
controlRouter.post('/kill/:sessionId', (req, res) => {
  const { sessionId } = req.params
  // Validate sessionId: only allow alphanumeric, dash, underscore (UUID format)
  if (!/^[a-zA-Z0-9_-]+$/.test(sessionId)) {
    return res.status(400).json({ error: 'Invalid sessionId format' })
  }
  const cmd = writeCommand('kill', { sessionId })
  res.status(201).json(cmd)
})

// POST /api/control/batch/:chainId/approve — queue batch approval
controlRouter.post('/batch/:chainId/approve', (req, res) => {
  const { chainId } = req.params
  if (!/^[a-zA-Z0-9_-]+$/.test(chainId)) {
    return res.status(400).json({ error: 'Invalid chainId format' })
  }
  const cmd = writeCommand('batch_approve', { chainId })
  res.status(201).json(cmd)
})

// POST /api/control/batch/:chainId/reject — queue batch rejection
controlRouter.post('/batch/:chainId/reject', (req, res) => {
  const { chainId } = req.params
  if (!/^[a-zA-Z0-9_-]+$/.test(chainId)) {
    return res.status(400).json({ error: 'Invalid chainId format' })
  }
  const cmd = writeCommand('batch_reject', { chainId })
  res.status(201).json(cmd)
})

// POST /api/control/weekly-report — run cast-weekly-report.sh
controlRouter.post('/weekly-report', (_req, res) => {
  const scriptPath = path.join(os.homedir(), '.claude/scripts/cast-weekly-report.sh')
  if (!fs.existsSync(scriptPath)) {
    return res.status(404).json({ error: 'cast-weekly-report.sh not found' })
  }
  execFile('bash', [scriptPath], { timeout: 30_000 }, (err, stdout) => {
    if (err) {
      console.error('Weekly report failed:', err)
      return res.status(500).json({ success: false, error: 'Weekly report failed' })
    }
    res.json({ success: true, reportPath: stdout.trim() })
  })
})

// POST /api/control/rollback — git revert a commit in the CAST repo
controlRouter.post('/rollback', (req, res) => {
  const { commit_sha, confirm } = req.body as { commit_sha?: string; confirm?: string }
  if (!commit_sha || !/^[a-f0-9]{7,40}$/.test(commit_sha)) {
    return res.status(400).json({ error: 'commit_sha must be a valid 7-40 char hex string' })
  }
  // Double-submit confirmation: the caller must echo the commit_sha back as
  // `confirm`, guarding against accidental or cross-site triggered reverts.
  if (confirm !== commit_sha) {
    return res.status(400).json({ error: 'Rollback requires confirmation: resend with confirm set to commit_sha' })
  }

  execFile(
    'git',
    ['-C', CAST_REPO_PATH, 'revert', '--no-edit', commit_sha],
    { timeout: 30_000 },
    (err, stdout, stderr) => {
      if (err) {
        console.error('Rollback failed:', stderr)
        return res.status(500).json({
          success: false,
          output: 'Rollback failed. Check server logs for details.',
        })
      }
      res.json({ success: true, output: stdout.trim(), commit_sha })
    }
  )
})
