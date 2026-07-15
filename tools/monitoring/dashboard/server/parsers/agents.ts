import fs from 'fs'
import path from 'path'
import matter from 'gray-matter'
import { AGENTS_DIR } from '../constants.js'
import { safeResolve } from '../utils/safeResolve.js'
import type { AgentDefinition } from '../../src/types/index.js'

export function normalizeStringArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String)
  if (typeof value === 'string') return value.split(',').map(t => t.trim()).filter(Boolean)
  return []
}

export function loadAgents(): AgentDefinition[] {
  if (!fs.existsSync(AGENTS_DIR)) return []

  const files = fs.readdirSync(AGENTS_DIR).filter(f => f.endsWith('.md'))
  const agents: AgentDefinition[] = []

  for (const file of files) {
    const filePath = path.join(AGENTS_DIR, file)
    const raw = fs.readFileSync(filePath, 'utf-8')
    const { data } = matter(raw)

    const tools = normalizeStringArray(data.tools)

    agents.push({
      name: data.name || path.basename(file, '.md'),
      description: data.description || '',
      model: data.model || 'sonnet',
      color: data.color || 'gray',
      tools,
      maxTurns: data.maxTurns ?? data.max_turns ?? 10,
      memory: data.memory || 'none',
      disallowedTools: normalizeStringArray(data.disallowedTools || data.disallowed_tools),
      filePath,
    })
  }

  return agents
}

export function writeAgent(name: string, updates: Partial<AgentDefinition>): AgentDefinition {
  if (!/^[a-zA-Z0-9_-]+$/.test(name)) {
    throw new Error('Agent name must contain only letters, numbers, hyphens, and underscores')
  }
  const filePath = safeResolve(AGENTS_DIR, `${name}.md`)
  if (!filePath || !fs.existsSync(filePath)) {
    throw new Error(`Agent "${name}" not found`)
  }

  const raw = fs.readFileSync(filePath, 'utf-8')
  const { data, content } = matter(raw)

  // Merge updates into frontmatter
  if (updates.model !== undefined) data.model = updates.model
  if (updates.color !== undefined) data.color = updates.color
  if (updates.description !== undefined) data.description = updates.description
  if (updates.tools !== undefined) data.tools = updates.tools
  if (updates.disallowedTools !== undefined) {
    data.disallowedTools = updates.disallowedTools
    delete data.disallowed_tools
  }
  if (updates.maxTurns !== undefined) {
    data.maxTurns = updates.maxTurns
    delete data.max_turns
  }
  if (updates.memory !== undefined) data.memory = updates.memory

  // Atomic write: temp file then rename
  const output = matter.stringify(content, data)
  const tmpPath = filePath + '.tmp'
  fs.writeFileSync(tmpPath, output, 'utf-8')
  fs.renameSync(tmpPath, filePath)

  // Return the updated agent
  const agents = loadAgents()
  return agents.find(a => a.name === name)!
}

export function createAgent(name: string, frontmatter: Partial<AgentDefinition>): AgentDefinition {
  // Validate name: alphanumeric, hyphens, underscores only
  if (!/^[a-zA-Z0-9_-]+$/.test(name)) {
    throw new Error('Agent name must contain only letters, numbers, hyphens, and underscores')
  }

  const filePath = path.join(AGENTS_DIR, `${name}.md`)
  if (fs.existsSync(filePath)) {
    throw new Error(`Agent "${name}" already exists`)
  }

  if (!fs.existsSync(AGENTS_DIR)) {
    fs.mkdirSync(AGENTS_DIR, { recursive: true })
  }

  const data: Record<string, unknown> = {
    name,
    description: frontmatter.description || `${name} agent`,
    model: frontmatter.model || 'sonnet',
    color: frontmatter.color || 'gray',
    tools: frontmatter.tools || ['Read', 'Glob', 'Grep'],
    maxTurns: frontmatter.maxTurns ?? 10,
    memory: frontmatter.memory || 'none',
  }
  if (frontmatter.disallowedTools?.length) {
    data.disallowedTools = frontmatter.disallowedTools
  }

  const body = `\n# ${name}\n\nAdd your agent instructions here.\n`
  const output = matter.stringify(body, data)
  fs.writeFileSync(filePath, output, 'utf-8')

  const agents = loadAgents()
  return agents.find(a => a.name === name)!
}
