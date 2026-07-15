import fs from 'fs'
import path from 'path'
import matter from 'gray-matter'
import Database from 'better-sqlite3'
import {
  AGENT_MEMORY_DIR,
  PROJECTS_DIR,
  PLANS_DIR,
  BRIEFINGS_DIR,
  MEETINGS_DIR,
  REPORTS_DIR,
  CAST_DB,
} from '../constants.js'
import type { MemoryFile, PlanFile, OutputFile } from '../../src/types/index.js'

/**
 * Internal shape produced by the memory loaders: carries the raw `modifiedAt`
 * mtime. The public API shape is `MemoryFile` (`lastModified`); routes/memory.ts
 * `withLastModified` converts `modifiedAt` → `lastModified` before responding.
 */
export interface RawMemoryFile extends Omit<MemoryFile, 'lastModified'> {
  modifiedAt: string
}

export function loadAgentMemory(): RawMemoryFile[] {
  if (!fs.existsSync(AGENT_MEMORY_DIR)) return []

  const results: RawMemoryFile[] = []
  const agentDirs = fs.readdirSync(AGENT_MEMORY_DIR).filter(d =>
    fs.statSync(path.join(AGENT_MEMORY_DIR, d)).isDirectory()
  )

  for (const agentDir of agentDirs) {
    const dirPath = path.join(AGENT_MEMORY_DIR, agentDir)
    const files = fs.readdirSync(dirPath).filter(f => f.endsWith('.md'))

    for (const file of files) {
      const filePath = path.join(dirPath, file)
      const raw = fs.readFileSync(filePath, 'utf-8')
      let data: Record<string, unknown> = {}
      let content = raw
      try {
        const parsed = matter(raw)
        data = parsed.data
        content = parsed.content
      } catch (err) {
        console.warn('[parser] skipping malformed frontmatter:', filePath, err)
        continue
      }
      const stat = fs.statSync(filePath)

      results.push({
        agent: agentDir,
        path: filePath,
        filename: file,
        name: (data.name as string) || path.basename(file, '.md'),
        description: (data.description as string) || '',
        type: (data.type as string) || undefined,
        body: content.trim(),
        modifiedAt: stat.mtime.toISOString(),
      })
    }
  }

  return results
}

export function loadProjectMemory(): RawMemoryFile[] {
  const results: RawMemoryFile[] = []
  const seen = new Set<string>()

  // 1. cast.db — agent_memories WHERE project IS NOT NULL
  if (fs.existsSync(CAST_DB)) {
    let db: ReturnType<typeof Database> | null = null
    try {
      db = new Database(CAST_DB, { readonly: true, fileMustExist: true })
      const rows = db.prepare(`
        SELECT id, agent, type, project, name, content, updated_at
        FROM agent_memories
        WHERE project IS NOT NULL AND project != ''
        ORDER BY updated_at DESC
      `).all() as Array<{
        id: number; agent: string; type: string; project: string
        name: string; content: string; updated_at: string
      }>
      for (const row of rows) {
        const key = `cast-db:${row.id}`
        if (seen.has(key)) continue
        seen.add(key)
        results.push({
          agent: row.agent,
          path: key,
          name: row.name,
          description: row.project,
          type: row.type || 'project',
          body: row.content,
          modifiedAt: row.updated_at,
        })
      }
    } catch (err) {
      console.warn('[memory] cast.db unavailable, skipping project memories from DB:', err)
    } finally {
      db?.close()
    }
  }

  // 2. agent-memory-local/<agent>/<project>.md — project-specific agent memory files
  if (fs.existsSync(AGENT_MEMORY_DIR)) {
    const agentDirs = fs.readdirSync(AGENT_MEMORY_DIR).filter(d =>
      fs.statSync(path.join(AGENT_MEMORY_DIR, d)).isDirectory()
    )
    for (const agentDir of agentDirs) {
      const dirPath = path.join(AGENT_MEMORY_DIR, agentDir)
      const files = fs.readdirSync(dirPath)
        .filter(f => f.endsWith('.md') && f !== 'MEMORY.md')
      for (const file of files) {
        const filePath = path.join(dirPath, file)
        if (seen.has(filePath)) continue
        seen.add(filePath)
        const raw = fs.readFileSync(filePath, 'utf-8')
        let data: Record<string, unknown> = {}
        let content = raw
        try {
          const parsed = matter(raw)
          data = parsed.data
          content = parsed.content
        } catch (err) {
          console.warn('[parser] skipping malformed frontmatter:', filePath, err)
          continue
        }
        const stat = fs.statSync(filePath)
        results.push({
          agent: agentDir,
          path: filePath,
          name: (data.name as string) || path.basename(file, '.md'),
          description: (data.description as string) || path.basename(file, '.md'),
          type: (data.type as string) || 'project',
          body: content.trim(),
          modifiedAt: stat.mtime.toISOString(),
        })
      }
    }
  }

  // 3. Legacy: ~/.claude/projects/<project-dir>/memory/*.md
  if (fs.existsSync(PROJECTS_DIR)) {
    const projectDirs = fs.readdirSync(PROJECTS_DIR).filter(d =>
      fs.statSync(path.join(PROJECTS_DIR, d)).isDirectory()
    )
    for (const projDir of projectDirs) {
      const memoryDir = path.join(PROJECTS_DIR, projDir, 'memory')
      if (!fs.existsSync(memoryDir) || !fs.statSync(memoryDir).isDirectory()) continue
      const files = fs.readdirSync(memoryDir).filter(f => f.endsWith('.md'))
      for (const file of files) {
        const filePath = path.join(memoryDir, file)
        if (seen.has(filePath)) continue
        seen.add(filePath)
        const raw = fs.readFileSync(filePath, 'utf-8')
        let data: Record<string, unknown> = {}
        let content = raw
        try {
          const parsed = matter(raw)
          data = parsed.data
          content = parsed.content
        } catch (err) {
          console.warn('[parser] skipping malformed frontmatter:', filePath, err)
          continue
        }
        const stat = fs.statSync(filePath)
        results.push({
          agent: projDir,
          path: filePath,
          name: (data.name as string) || path.basename(file, '.md'),
          description: (data.description as string) || '',
          type: (data.type as string) || 'project',
          body: content.trim(),
          modifiedAt: stat.mtime.toISOString(),
        })
      }
    }
  }

  return results.sort((a, b) => b.modifiedAt.localeCompare(a.modifiedAt))
}

export function loadPlans(): PlanFile[] {
  if (!fs.existsSync(PLANS_DIR)) return []

  const files = fs.readdirSync(PLANS_DIR).filter(f => f.endsWith('.md'))
  const plans: PlanFile[] = []

  for (const file of files) {
    const filePath = path.join(PLANS_DIR, file)
    const raw = fs.readFileSync(filePath, 'utf-8')
    const stat = fs.statSync(filePath)

    // Extract title from first # heading
    const titleMatch = raw.match(/^#\s+(.+)$/m)
    const title = titleMatch ? titleMatch[1] : path.basename(file, '.md')

    // Preview: first 200 chars of content after title
    const afterTitle = raw.replace(/^#\s+.+$/m, '').trim()
    const preview = afterTitle.slice(0, 200)

    plans.push({
      filename: file,
      title,
      date: stat.mtime.toISOString().split('T')[0],
      path: filePath,
      preview,
      modifiedAt: stat.mtime.toISOString(),
    })
  }

  plans.sort((a, b) => b.modifiedAt.localeCompare(a.modifiedAt))
  return plans
}

const OUTPUT_DIRS: Record<string, string> = {
  briefings: BRIEFINGS_DIR,
  meetings: MEETINGS_DIR,
  reports: REPORTS_DIR,
}

export function loadOutputs(category: 'briefings' | 'meetings' | 'reports'): OutputFile[] {
  const dir = OUTPUT_DIRS[category]
  if (!dir || !fs.existsSync(dir)) return []

  const files = fs.readdirSync(dir).filter(f => !f.startsWith('.'))
  const outputs: OutputFile[] = []

  for (const file of files) {
    const filePath = path.join(dir, file)
    const stat = fs.statSync(filePath)
    if (!stat.isFile()) continue

    let preview = ''
    try {
      const raw = fs.readFileSync(filePath, 'utf-8')
      preview = raw.slice(0, 200)
    } catch {
      // skip
    }

    outputs.push({
      filename: file,
      category,
      path: filePath,
      preview,
      modifiedAt: stat.mtime.toISOString(),
    })
  }

  outputs.sort((a, b) => b.modifiedAt.localeCompare(a.modifiedAt))
  return outputs
}
