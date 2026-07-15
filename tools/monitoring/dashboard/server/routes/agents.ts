import { Router } from 'express'
import fs from 'fs'
import { readdirSync } from 'fs'
import { join } from 'path'
import { homedir } from 'os'
import matter from 'gray-matter'
import { loadAgents, writeAgent, createAgent } from '../parsers/agents.js'

// Fallback list — mirrors src/utils/localAgents.ts (update both if roster changes)
// v7.4 roster — 23 agents (authoritative source: claude-agent-team/agents/core/)
const LOCAL_AGENTS_FALLBACK = [
  'api-contract', 'bash-specialist', 'code-reviewer', 'code-writer',
  'commit', 'debugger', 'dep-auditor', 'devops', 'docs', 'eval-writer',
  'frontend-qa', 'merge', 'migration-reviewer', 'morning-briefing',
  'perf-sentinel', 'planner', 'pr-reviewer', 'push', 'release-notes',
  'researcher', 'security', 'test-runner', 'test-writer',
]

const router = Router()

router.get('/roster', (_req, res) => {
  try {
    const agentsDir = join(homedir(), '.claude', 'agents')
    const files = readdirSync(agentsDir)
    const agents = files
      .filter(f => f.endsWith('.md'))
      .map(f => f.replace(/\.md$/, ''))
      .sort()
    res.json({ agents, count: agents.length, source: 'filesystem' })
  } catch {
    res.json({ agents: LOCAL_AGENTS_FALLBACK, count: LOCAL_AGENTS_FALLBACK.length, source: 'fallback' })
  }
})

router.get('/', (_req, res) => {
  const agents = loadAgents()
  res.json(agents)
})

router.get('/:name', (req, res) => {
  const agents = loadAgents()
  const agent = agents.find(a => a.name === req.params.name)
  if (!agent) {
    res.status(404).json({ error: 'Agent not found' })
    return
  }

  const raw = fs.readFileSync(agent.filePath, 'utf-8')
  const { content } = matter(raw)
  res.json({ ...agent, body: content })
})

router.put('/:name', (req, res) => {
  if (!/^[a-zA-Z0-9_-]+$/.test(req.params.name)) {
    res.status(400).json({ error: 'Invalid agent name' })
    return
  }
  try {
    const updated = writeAgent(req.params.name, req.body)
    res.json(updated)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to update agent'
    res.status(400).json({ error: message })
  }
})

router.post('/', (req, res) => {
  try {
    const { name, ...frontmatter } = req.body
    if (!name) {
      res.status(400).json({ error: 'Agent name is required' })
      return
    }
    const created = createAgent(name, frontmatter)
    res.status(201).json(created)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to create agent'
    res.status(400).json({ error: message })
  }
})

export { router as agentsRouter }
