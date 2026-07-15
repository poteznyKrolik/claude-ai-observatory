import { Router } from 'express'
import { exec, execFile, spawn } from 'child_process'
import { promisify } from 'util'
import os from 'os'
import path from 'path'

const execAsync = promisify(exec)
const execFileAsync = promisify(execFile)

/** Write `content` as the user's crontab via `crontab -` stdin — no shell, so
 *  pre-existing crontab lines containing $(...) / backticks are never re-evaluated (S3). */
function writeCrontab(content: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn('crontab', ['-'], { stdio: ['pipe', 'ignore', 'pipe'] })
    let stderr = ''
    child.stderr?.on('data', d => { stderr += d.toString() })
    child.on('error', reject)
    child.on('close', (code) => {
      if (code === 0) resolve()
      else reject(new Error(`crontab exited ${code}: ${stderr.trim()}`))
    })
    child.stdin?.end(content.endsWith('\n') ? content : content + '\n')
  })
}

export const castdControlRouter = Router()

// Allowlist of CAST script basenames permitted in cron and trigger endpoints
const CAST_SCRIPT_ALLOWLIST = new Set([
  'cast',
  'cast-db-init.sh',
  'cast-db-log.py',
  'cast-log-append.py',
  'cast-memory-router.py',
  'cast-memory-fts5-migrate.py',
  'cast-memory-seed-procedural.py',
  'cast-redact.py',
  'cast-stop-failure-hook.sh',
  'cast-swarm-bootstrap.sh',
  'cast-swarm-merge.sh',
  'cast-swarm-teardown.sh',
  'cast-upgrade-check.sh',
])

// Cron schedule regex: 5 fields, each *, number, or common cron expressions
const CRON_SCHEDULE_RE = /^(\*|[0-9,\-\/]+)\s+(\*|[0-9,\-\/]+)\s+(\*|[0-9,\-\/]+)\s+(\*|[0-9,\-\/]+)\s+(\*|[0-9,\-\/]+)$/

// Marker appended to every cron entry this server creates. Deletes are scoped to
// lines carrying it so the dashboard can never remove an operator's own crontab.
const CAST_MANAGED_MARKER = '# CAST-MANAGED'

// Safe argument shape: alphanumerics plus a small set of punctuation used by CAST
// flags/values. No whitespace, no shell metacharacters, no path traversal.
const SAFE_ARG_RE = /^[A-Za-z0-9_.,:=@+/-]+$/
const MAX_ARG_LEN = 200
const MAX_ARGS = 12

// Per-binary subcommand allowlists. A binary listed here may only run with a
// first argument from its set; binaries not listed fall back to generic
// safe-character validation of every argument.
const ALLOWED_SUBCOMMANDS: Record<string, Set<string>> = {
  cast: new Set([
    'status', 'doctor', 'digest', 'briefing', 'weekly-report',
    'upgrade-check', 'memory', 'cost', 'health',
  ]),
}

/** Extract the basename of the first token of a command string */
function commandBasename(cmd: string): string {
  const firstToken = cmd.trim().split(/\s+/)[0] ?? ''
  return path.basename(firstToken)
}

/** Return true if the command's binary is in the CAST allowlist */
function isAllowedCommand(cmd: string): boolean {
  return CAST_SCRIPT_ALLOWLIST.has(commandBasename(cmd))
}

/** Parse a cron command string into [binary, ...args] for execFile */
function parseCronCommand(cmd: string): string[] {
  // Simple whitespace split — sufficient for CAST scripts which don't use complex quoting
  return cmd.trim().split(/\s+/)
}

/**
 * Validate the arguments destined for a CAST binary. execFile already prevents
 * shell injection; this is defense-in-depth against dangerous flags/values
 * (path traversal, oversized payloads, unexpected subcommands).
 */
function validateArgs(binary: string, args: string[]): { ok: true } | { ok: false; reason: string } {
  if (args.length > MAX_ARGS) return { ok: false, reason: 'Too many arguments' }
  for (const arg of args) {
    if (arg.length > MAX_ARG_LEN) return { ok: false, reason: 'Argument too long' }
    if (arg.includes('..')) return { ok: false, reason: 'Path traversal in argument' }
    // Reject bare absolute-path positionals (e.g. /etc/passwd). Flags that embed
    // a path after '=' (--out=/x) still start with '-' and are unaffected.
    if (arg.startsWith('/')) return { ok: false, reason: 'Absolute path in argument' }
    if (!SAFE_ARG_RE.test(arg)) return { ok: false, reason: 'Unsafe characters in argument' }
  }
  const allowed = ALLOWED_SUBCOMMANDS[binary]
  if (allowed && args.length > 0 && !allowed.has(args[0])) {
    return { ok: false, reason: `Subcommand not permitted for ${binary}` }
  }
  return { ok: true }
}

// GET /api/castd/status — read crontab and return CAST-related entries
castdControlRouter.get('/status', async (_req, res) => {
  try {
    const { stdout } = await execAsync('crontab -l 2>/dev/null || true')
    const all = stdout.split('\n').filter(Boolean)
    const castLines = all.filter(l =>
      l.toLowerCase().includes('cast') || l.includes('.claude/scripts')
    )
    res.json({ entries: castLines, count: castLines.length })
  } catch (err) {
    console.error('Cron status error:', err)
    res.json({ entries: [], count: 0, error: 'Failed to read crontab' })
  }
})

// POST /api/castd/cron — add a new CAST-MANAGED cron entry
castdControlRouter.post('/cron', async (req, res) => {
  try {
    const { schedule, command } = req.body as { schedule?: string; command?: string }
    if (!schedule || !command) return res.status(400).json({ error: 'schedule and command required' })

    // F08: Reject inputs containing newlines (crontab injection vector)
    if (schedule.includes('\n') || schedule.includes('\r') || command.includes('\n') || command.includes('\r')) {
      return res.status(400).json({ error: 'Invalid characters in schedule or command' })
    }

    // F08: Validate schedule format
    if (!CRON_SCHEDULE_RE.test(schedule.trim())) {
      return res.status(400).json({ error: 'Invalid cron schedule format' })
    }

    // F08: Validate command starts with an allowlisted CAST script
    if (!isAllowedCommand(command)) {
      return res.status(403).json({ error: 'Command not in CAST script allowlist' })
    }

    // Validate the command's arguments before they are written to the crontab —
    // the same defense the trigger endpoint applies. Without this, shell
    // metacharacters in args (e.g. "cast status && rm -rf …") would be persisted
    // verbatim and executed when cron fires the entry.
    const cronParts = parseCronCommand(command)
    const cronArgCheck = validateArgs(path.basename(cronParts[0]), cronParts.slice(1))
    if (!cronArgCheck.ok) {
      return res.status(400).json({ error: cronArgCheck.reason })
    }

    // Append the CAST-MANAGED marker so this entry can be identified — and only
    // entries carrying it can later be deleted via this API.
    const newEntry = `${schedule.trim()} ${command.trim()} ${CAST_MANAGED_MARKER}`
    // Read existing crontab, append, write back
    const { stdout } = await execAsync('crontab -l 2>/dev/null || true')
    const updated = stdout.trimEnd() + '\n' + newEntry + '\n'
    await writeCrontab(updated)
    res.json({ ok: true, entry: newEntry })
  } catch (err) {
    console.error('Cron add error:', err)
    res.status(500).json({ error: 'Failed to add cron entry' })
  }
})

// DELETE /api/castd/cron — remove a cron entry by exact line match
castdControlRouter.delete('/cron', async (req, res) => {
  try {
    const { entry } = req.body as { entry?: string }
    if (!entry) return res.status(400).json({ error: 'entry required' })

    // Only CAST-managed entries may be deleted — never an operator's own crontab lines.
    if (!entry.includes(CAST_MANAGED_MARKER)) {
      return res.status(403).json({ error: 'Only CAST-MANAGED cron entries can be deleted' })
    }

    const { stdout } = await execAsync('crontab -l 2>/dev/null || true')
    const filtered = stdout.split('\n').filter(l => l.trim() !== entry.trim()).join('\n')
    await writeCrontab(filtered)
    res.json({ ok: true })
  } catch (err) {
    console.error('Cron delete error:', err)
    res.status(500).json({ error: 'Failed to delete cron entry' })
  }
})

// POST /api/castd/trigger — manually run a CAST-MANAGED cron command
castdControlRouter.post('/trigger', async (req, res) => {
  try {
    const { command } = req.body as { command?: string }
    if (!command) return res.status(400).json({ error: 'command required' })

    // F04: Validate command binary is in the CAST allowlist
    if (!isAllowedCommand(command)) {
      return res.status(403).json({ error: 'Command not in CAST script allowlist' })
    }

    // F04: Parse command into binary + args and resolve binary to scripts directory
    const parts = parseCronCommand(command)
    const binaryName = path.basename(parts[0])
    const args = parts.slice(1)

    // Per-binary argument validation (defense-in-depth beyond execFile)
    const argCheck = validateArgs(binaryName, args)
    if (!argCheck.ok) {
      return res.status(400).json({ error: argCheck.reason })
    }

    // Resolve to the CAST scripts directory or use PATH for 'cast' itself
    let resolvedBinary: string
    if (binaryName === 'cast') {
      resolvedBinary = 'cast'
    } else {
      resolvedBinary = path.join(os.homedir(), '.claude', 'scripts', binaryName)
    }

    // F04: Use execFile instead of exec to prevent shell injection
    const { stdout, stderr } = await execFileAsync(resolvedBinary, args, { timeout: 30_000 })
    res.json({ ok: true, stdout, stderr })
  } catch (err) {
    console.error('Cron trigger error:', err)
    res.status(500).json({ error: 'Failed to trigger command' })
  }
})
