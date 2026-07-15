import fs from 'fs'
import path from 'path'
import { PROJECTS_DIR } from '../constants.js'
import { safeResolve } from '../utils/safeResolve.js'
import { decodeProjectPath } from './projectPath.js'
import type { Session, LogEntry, ContentBlock } from '../../src/types/index.js'

export function listSessions(): Session[] {
  if (!fs.existsSync(PROJECTS_DIR)) return []

  const sessions: Session[] = []
  const projectDirs = fs.readdirSync(PROJECTS_DIR).filter(d => {
    const full = path.join(PROJECTS_DIR, d)
    return fs.statSync(full).isDirectory()
  })

  for (const projDir of projectDirs) {
    const projPath = path.join(PROJECTS_DIR, projDir)
    const projectPath = decodeProjectPath(projDir)
    const projectName = path.basename(projectPath)

    // Find .jsonl files at the top level only (not in subdirs like tasks/)
    const entries = fs.readdirSync(projPath)
    const jsonlFiles = entries.filter(f => f.endsWith('.jsonl') && fs.statSync(path.join(projPath, f)).isFile())

    for (const jsonlFile of jsonlFiles) {
      const filePath = path.join(projPath, jsonlFile)
      const sessionId = path.basename(jsonlFile, '.jsonl')

      try {
        const content = fs.readFileSync(filePath, 'utf-8')
        const lines = content.split('\n').filter(Boolean)
        if (lines.length === 0) continue

        const firstLine = JSON.parse(lines[0])
        const lastLine = lines.length > 1 ? JSON.parse(lines[lines.length - 1]) : firstLine

        // Find the first line with a timestamp (skip file-history-snapshot entries)
        let startedAt = firstLine.timestamp || ''
        if (!startedAt) {
          for (const line of lines) {
            try {
              const entry = JSON.parse(line)
              if (entry.timestamp) { startedAt = entry.timestamp; break }
            } catch { /* skip */ }
          }
        }
        // Final fallback: use file modification time
        if (!startedAt) {
          try { startedAt = fs.statSync(filePath).mtime.toISOString() } catch { /* skip */ }
        }
        const endedAt = lastLine.timestamp || ''
        const durationMs: number | null = startedAt && endedAt
          ? new Date(endedAt).getTime() - new Date(startedAt).getTime()
          : null

        // Count tool_use blocks, tokens, and model usage
        let toolCallCount = 0
        let messageCount = lines.length
        let inputTokens = 0
        let outputTokens = 0
        let cacheCreationTokens = 0
        let cacheReadTokens = 0
        const modelCounts: Record<string, number> = {}
        let candidateModel: string | undefined

        for (const line of lines) {
          try {
            const entry = JSON.parse(line)
            if (!candidateModel && entry.message?.model) candidateModel = entry.message.model
            if (entry.message?.content && Array.isArray(entry.message.content)) {
              toolCallCount += entry.message.content.filter(
                (b: ContentBlock) => b.type === 'tool_use'
              ).length
            }
            if (entry.message?.usage) {
              inputTokens += entry.message.usage.input_tokens ?? 0
              outputTokens += entry.message.usage.output_tokens ?? 0
              cacheCreationTokens += entry.message.usage.cache_creation_input_tokens ?? 0
              cacheReadTokens += entry.message.usage.cache_read_input_tokens ?? 0
            }
            if (entry.message?.model && entry.type === 'assistant') {
              modelCounts[entry.message.model] = (modelCounts[entry.message.model] ?? 0) + 1
            }
          } catch {
            // skip malformed lines
          }
        }

        // Count subagent directories and roll up their tokens + model usage
        let agentCount = 0
        const sessionDir = path.join(projPath, sessionId)
        if (fs.existsSync(sessionDir) && fs.statSync(sessionDir).isDirectory()) {
          const sessionDirEntries = fs.readdirSync(sessionDir)
          agentCount = sessionDirEntries.filter(d =>
            fs.statSync(path.join(sessionDir, d)).isDirectory()
          ).length

          // Scan subagents/ subdirectory for agent JSONL files
          const subagentsDir = path.join(sessionDir, 'subagents')
          if (fs.existsSync(subagentsDir) && fs.statSync(subagentsDir).isDirectory()) {
            const agentFiles = fs.readdirSync(subagentsDir).filter(f => f.endsWith('.jsonl'))
            for (const agentFile of agentFiles) {
              try {
                const agentPath = safeResolve(subagentsDir, agentFile)
                if (!agentPath) continue
                const agentContent = fs.readFileSync(agentPath, 'utf-8')
                const agentLines = agentContent.split('\n').filter(Boolean)
                for (const line of agentLines) {
                  try {
                    const entry = JSON.parse(line)
                    if (entry.message?.usage) {
                      inputTokens += entry.message.usage.input_tokens ?? 0
                      outputTokens += entry.message.usage.output_tokens ?? 0
                      cacheCreationTokens += entry.message.usage.cache_creation_input_tokens ?? 0
                      cacheReadTokens += entry.message.usage.cache_read_input_tokens ?? 0
                    }
                    if (entry.message?.model && entry.type === 'assistant') {
                      modelCounts[entry.message.model] = (modelCounts[entry.message.model] ?? 0) + 1
                    }
                  } catch {
                    // skip malformed lines
                  }
                }
              } catch {
                // skip unreadable agent files
              }
            }
          }
        }

        // Pick the most-used model across main session + subagents; fall back to scanning all lines
        // Fall back to the first model seen during the single parse loop above
        // (P5 — avoid re-parsing every line here).
        const dominantModel = Object.entries(modelCounts)
          .sort((a, b) => b[1] - a[1])[0]?.[0]
          ?? candidateModel

        sessions.push({
          id: sessionId,
          project: projectName,
          projectPath,
          projectEncoded: projDir,
          startedAt,
          endedAt,
          durationMs,
          messageCount,
          toolCallCount,
          agentCount,
          inputTokens,
          outputTokens,
          cacheCreationTokens,
          cacheReadTokens,
          model: dominantModel,
          slug: firstLine.slug,
          version: firstLine.version,
        })
      } catch {
        // skip unreadable files
      }
    }
  }

  sessions.sort((a, b) => (b.startedAt || '').localeCompare(a.startedAt || ''))
  return sessions
}

// Cache the full-tree scan for 10s so the hot read routes (sessions/search/analytics/
// config) and SSE-triggered refetches don't re-scan ~/.claude/projects on every
// request (P2). seed.ts intentionally uses the uncached listSessions() for freshness.
let _sessionsCache: Session[] | null = null
let _sessionsCacheTs = 0
export function getCachedSessions(): Session[] {
  const now = Date.now()
  if (!_sessionsCache || now - _sessionsCacheTs > 10_000) {
    _sessionsCache = listSessions()
    _sessionsCacheTs = now
  }
  return _sessionsCache
}

export function loadSession(projectEncoded: string, sessionId: string): LogEntry[] {
  const filePath = safeResolve(PROJECTS_DIR, projectEncoded, `${sessionId}.jsonl`)
  if (!filePath || !fs.existsSync(filePath)) return []

  const content = fs.readFileSync(filePath, 'utf-8')
  const lines = content.split('\n').filter(Boolean)
  const entries: LogEntry[] = []

  for (const line of lines) {
    try {
      entries.push(JSON.parse(line))
    } catch {
      // skip malformed
    }
  }

  return entries
}
