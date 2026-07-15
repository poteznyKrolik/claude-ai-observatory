/**
 * Supertest tests for memory endpoints
 *
 * Covers:
 * 1. GET /api/memory/backup-status — returns object with `lastBackup` and `logSizeBytes` keys
 * 2. GET /api/memory/agent — returns array; each item has a `lastModified` field
 *
 * Strategy: Mock fs module methods and loadAgentMemory/loadProjectMemory parsers
 * to return test data without hitting the real filesystem.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import express from 'express'
import request from 'supertest'
import fs from 'fs'
import path from 'path'
import os from 'os'

// ---------------------------------------------------------------------------
// Mock setup for loadAgentMemory
// ---------------------------------------------------------------------------

const mockAgentMemories = [
  {
    agent: 'code-reviewer',
    path: '/home/user/.claude/agent-memory-local/code-reviewer/feedback.md',
    filename: 'feedback.md',
    name: 'feedback',
    description: 'Code review feedback',
    type: 'feedback',
    body: 'Review patterns...',
    modifiedAt: '2026-03-30T15:45:00Z',
  },
  {
    agent: 'test-writer',
    path: '/home/user/.claude/agent-memory-local/test-writer/patterns.md',
    filename: 'patterns.md',
    name: 'patterns',
    description: 'Testing patterns',
    type: 'user',
    body: 'Test coverage...',
    modifiedAt: '2026-03-31T10:00:00Z',
  },
]

const mockProjectMemories = [
  {
    agent: 'planner',
    path: '/home/user/.claude/agent-memory-local/planner/project-context.md',
    name: 'project-context',
    description: 'claude-code-dashboard',
    type: 'project',
    body: 'Project scope...',
    modifiedAt: '2026-03-31T09:30:00Z',
  },
]

vi.mock('../parsers/memory.js', () => ({
  loadAgentMemory: vi.fn(() => mockAgentMemories),
  loadProjectMemory: vi.fn(() => mockProjectMemories),
}))

// Import the router after mocking
const { memoryRouter } = await import('../routes/memory.js')

// Create Express app with the router
const app = express()
app.use(express.json())
app.use('/api/memory', memoryRouter)

beforeEach(async () => {
  vi.clearAllMocks()
  // Re-establish default return values after clearAllMocks resets mockReturnValue overrides
  const { loadAgentMemory, loadProjectMemory } = await import('../parsers/memory.js')
  vi.mocked(loadAgentMemory).mockReturnValue(mockAgentMemories)
  vi.mocked(loadProjectMemory).mockReturnValue(mockProjectMemories)
})

afterEach(() => {
  vi.clearAllMocks()
})

// ===========================================================================
// GET /api/memory/backup-status
// ===========================================================================

describe('GET /api/memory/backup-status', () => {
  it('returns status 200 with an object', async () => {
    // Mock fs to return a valid log file
    vi.spyOn(fs, 'existsSync').mockReturnValue(true)
    vi.spyOn(fs, 'readFileSync').mockReturnValue(
      '[2026-03-31T10:15:00Z] Starting backup...\n[2026-03-31T10:15:05Z] Backup complete',
    )
    vi.spyOn(fs, 'statSync').mockReturnValue({
      size: 256,
    } as any)

    const res = await request(app).get('/api/memory/backup-status')
    expect(res.status).toBe(200)
    expect(typeof res.body).toBe('object')
  })

  it('returns object with lastBackup and logSizeBytes keys', async () => {
    vi.spyOn(fs, 'existsSync').mockReturnValue(true)
    vi.spyOn(fs, 'readFileSync').mockReturnValue(
      '[2026-03-31T10:15:00Z] Backup complete',
    )
    vi.spyOn(fs, 'statSync').mockReturnValue({
      size: 512,
    } as any)

    const res = await request(app).get('/api/memory/backup-status')
    expect(res.status).toBe(200)
    expect(res.body).toHaveProperty('lastBackup')
    expect(res.body).toHaveProperty('logSizeBytes')
  })

  it('extracts timestamp from last "Backup complete" line', async () => {
    vi.spyOn(fs, 'existsSync').mockReturnValue(true)
    vi.spyOn(fs, 'readFileSync').mockReturnValue(
      '[2026-03-31T10:00:00Z] Starting backup...\n[2026-03-31T10:05:00Z] Backup complete',
    )
    vi.spyOn(fs, 'statSync').mockReturnValue({
      size: 100,
    } as any)

    const res = await request(app).get('/api/memory/backup-status')
    expect(res.status).toBe(200)
    expect(res.body.lastBackup).toBe('2026-03-31T10:05:00Z')
  })

  it('returns logSizeBytes from file stat', async () => {
    vi.spyOn(fs, 'existsSync').mockReturnValue(true)
    vi.spyOn(fs, 'readFileSync').mockReturnValue(
      '[2026-03-31T10:15:00Z] Backup complete',
    )
    vi.spyOn(fs, 'statSync').mockReturnValue({
      size: 4096,
    } as any)

    const res = await request(app).get('/api/memory/backup-status')
    expect(res.status).toBe(200)
    expect(res.body.logSizeBytes).toBe(4096)
  })

  it('returns null values when log file does not exist', async () => {
    vi.spyOn(fs, 'existsSync').mockReturnValue(false)

    const res = await request(app).get('/api/memory/backup-status')
    expect(res.status).toBe(200)
    expect(res.body.lastBackup).toBeNull()
    expect(res.body.logSizeBytes).toBeNull()
  })

  it('returns null lastBackup when no "Backup complete" line is found', async () => {
    vi.spyOn(fs, 'existsSync').mockReturnValue(true)
    vi.spyOn(fs, 'readFileSync').mockReturnValue(
      '[2026-03-31T10:00:00Z] Starting backup...\n[2026-03-31T10:05:00Z] In progress',
    )
    vi.spyOn(fs, 'statSync').mockReturnValue({
      size: 100,
    } as any)

    const res = await request(app).get('/api/memory/backup-status')
    expect(res.status).toBe(200)
    expect(res.body.lastBackup).toBeNull()
    expect(res.body.logSizeBytes).toBe(100)
  })

  it('returns null lastBackup for empty log file', async () => {
    vi.spyOn(fs, 'existsSync').mockReturnValue(true)
    vi.spyOn(fs, 'readFileSync').mockReturnValue('')
    vi.spyOn(fs, 'statSync').mockReturnValue({
      size: 0,
    } as any)

    const res = await request(app).get('/api/memory/backup-status')
    expect(res.status).toBe(200)
    expect(res.body.lastBackup).toBeNull()
    expect(res.body.logSizeBytes).toBe(0)
  })

  it('handles fs read errors gracefully (returns 500 with null values)', async () => {
    vi.spyOn(fs, 'existsSync').mockReturnValue(true)
    vi.spyOn(fs, 'readFileSync').mockImplementation(() => {
      throw new Error('Permission denied')
    })

    const res = await request(app).get('/api/memory/backup-status')
    expect(res.status).toBe(500)
    expect(res.body.lastBackup).toBeNull()
    expect(res.body.logSizeBytes).toBeNull()
  })

  it('handles fs stat errors gracefully (returns 500 with null values)', async () => {
    vi.spyOn(fs, 'existsSync').mockReturnValue(true)
    vi.spyOn(fs, 'readFileSync').mockReturnValue('[2026-03-31T10:15:00Z] Backup complete')
    vi.spyOn(fs, 'statSync').mockImplementation(() => {
      throw new Error('File not found')
    })

    const res = await request(app).get('/api/memory/backup-status')
    expect(res.status).toBe(500)
    expect(res.body.lastBackup).toBeNull()
    expect(res.body.logSizeBytes).toBeNull()
  })

  it('extracts timestamp from timestamp bracket pattern [YYYY-MM-DDTHH:MM:SSZ]', async () => {
    vi.spyOn(fs, 'existsSync').mockReturnValue(true)
    vi.spyOn(fs, 'readFileSync').mockReturnValue(
      '[2025-12-25T23:59:59Z] Backup complete',
    )
    vi.spyOn(fs, 'statSync').mockReturnValue({
      size: 50,
    } as any)

    const res = await request(app).get('/api/memory/backup-status')
    expect(res.status).toBe(200)
    expect(res.body.lastBackup).toBe('2025-12-25T23:59:59Z')
  })

  it('finds last occurrence of "Backup complete" when multiple lines exist', async () => {
    vi.spyOn(fs, 'existsSync').mockReturnValue(true)
    vi.spyOn(fs, 'readFileSync').mockReturnValue(
      '[2026-03-30T10:00:00Z] Backup complete\n[2026-03-31T10:00:00Z] Starting backup...\n[2026-03-31T11:00:00Z] Backup complete',
    )
    vi.spyOn(fs, 'statSync').mockReturnValue({
      size: 150,
    } as any)

    const res = await request(app).get('/api/memory/backup-status')
    expect(res.status).toBe(200)
    expect(res.body.lastBackup).toBe('2026-03-31T11:00:00Z')
  })
})

// ===========================================================================
// GET /api/memory/agent
// ===========================================================================

describe('GET /api/memory/agent', () => {
  it('returns status 200 with an array', async () => {
    const res = await request(app).get('/api/memory/agent')
    expect(res.status).toBe(200)
    expect(Array.isArray(res.body)).toBe(true)
  })

  it('returns array of memory objects', async () => {
    const res = await request(app).get('/api/memory/agent')
    expect(res.status).toBe(200)
    expect(res.body).toHaveLength(2)
  })

  it('each item has a lastModified field', async () => {
    const res = await request(app).get('/api/memory/agent')
    expect(res.status).toBe(200)

    for (const item of res.body) {
      expect(item).toHaveProperty('lastModified')
    }
  })

  it('lastModified field contains ISO8601 timestamp', async () => {
    const res = await request(app).get('/api/memory/agent')
    expect(res.status).toBe(200)

    const item = res.body[0]
    expect(item).toHaveProperty('lastModified')
    // Check if it's a valid ISO string
    expect(() => new Date(item.lastModified)).not.toThrow()
    expect(item.lastModified).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/)
  })

  it('includes agent, name, description, type, body, path, and filename fields', async () => {
    const res = await request(app).get('/api/memory/agent')
    expect(res.status).toBe(200)
    expect(res.body.length).toBeGreaterThan(0)

    const item = res.body[0]
    expect(item).toHaveProperty('agent')
    expect(item).toHaveProperty('name')
    expect(item).toHaveProperty('description')
    expect(item).toHaveProperty('type')
    expect(item).toHaveProperty('body')
    expect(item).toHaveProperty('path')
    expect(item).toHaveProperty('filename')
    expect(item).toHaveProperty('lastModified')
  })

  it('maps modifiedAt from parser to lastModified', async () => {
    const res = await request(app).get('/api/memory/agent')
    expect(res.status).toBe(200)

    // First item should be code-reviewer with modifiedAt: 2026-03-30T15:45:00Z
    const codeReviewer = res.body.find((m: any) => m.agent === 'code-reviewer')
    expect(codeReviewer).toBeDefined()
    expect(codeReviewer?.lastModified).toBe('2026-03-30T15:45:00Z')
  })

  it('returns correct data for each memory item', async () => {
    const res = await request(app).get('/api/memory/agent')
    expect(res.status).toBe(200)

    const testWriter = res.body.find((m: any) => m.agent === 'test-writer')
    expect(testWriter).toBeDefined()
    expect(testWriter?.name).toBe('patterns')
    expect(testWriter?.description).toBe('Testing patterns')
    expect(testWriter?.type).toBe('user')
    expect(testWriter?.body).toBe('Test coverage...')
    expect(testWriter?.lastModified).toBe('2026-03-31T10:00:00Z')
  })

  it('returns empty array when loadAgentMemory returns empty', async () => {
    const { loadAgentMemory } = await import('../parsers/memory.js')
    vi.mocked(loadAgentMemory).mockReturnValue([])

    const res = await request(app).get('/api/memory/agent')
    expect(res.status).toBe(200)
    expect(res.body).toEqual([])
  })

  it('handles multiple memories from same agent', async () => {
    const { loadAgentMemory } = await import('../parsers/memory.js')
    vi.mocked(loadAgentMemory).mockReturnValue([
      {
        agent: 'code-reviewer',
        path: '/path/to/feedback.md',
        filename: 'feedback.md',
        name: 'feedback',
        description: 'Feedback patterns',
        type: 'feedback',
        body: 'Review patterns...',
        modifiedAt: '2026-03-30T15:45:00Z',
      },
      {
        agent: 'code-reviewer',
        path: '/path/to/conventions.md',
        filename: 'conventions.md',
        name: 'conventions',
        description: 'Code conventions',
        type: 'user',
        body: 'Follow these...',
        modifiedAt: '2026-03-31T08:00:00Z',
      },
    ])

    const res = await request(app).get('/api/memory/agent')
    expect(res.status).toBe(200)
    expect(res.body).toHaveLength(2)

    const reviewerMemories = res.body.filter((m: any) => m.agent === 'code-reviewer')
    expect(reviewerMemories).toHaveLength(2)

    for (const memory of reviewerMemories) {
      expect(memory).toHaveProperty('lastModified')
    }
  })

  it('preserves all fields from loadAgentMemory', async () => {
    const { loadAgentMemory } = await import('../parsers/memory.js')
    const testMemories = [
      {
        agent: 'custom-agent',
        path: '/custom/path.md',
        filename: 'custom.md',
        name: 'custom-name',
        description: 'Custom description',
        type: 'custom',
        body: 'Custom body content',
        modifiedAt: '2026-03-31T12:00:00Z',
      },
    ]
    vi.mocked(loadAgentMemory).mockReturnValue(testMemories)

    const res = await request(app).get('/api/memory/agent')
    expect(res.status).toBe(200)
    expect(res.body[0]).toMatchObject({
      agent: 'custom-agent',
      path: '/custom/path.md',
      filename: 'custom.md',
      name: 'custom-name',
      description: 'Custom description',
      type: 'custom',
      body: 'Custom body content',
      lastModified: '2026-03-31T12:00:00Z',
    })
  })
})

// ===========================================================================
// GET /api/memory/agent/:agentName (filtered by agent)
// ===========================================================================

describe('GET /api/memory/agent/:agentName', () => {
  it('returns status 200 with an array', async () => {
    const res = await request(app).get('/api/memory/agent/code-reviewer')
    expect(res.status).toBe(200)
    expect(Array.isArray(res.body)).toBe(true)
  })

  it('filters memories by agent name', async () => {
    const res = await request(app).get('/api/memory/agent/test-writer')
    expect(res.status).toBe(200)
    expect(res.body).toHaveLength(1)
    expect(res.body[0].agent).toBe('test-writer')
    expect(res.body[0].name).toBe('patterns')
  })

  it('returns empty array when agent has no memories', async () => {
    const res = await request(app).get('/api/memory/agent/nonexistent-agent')
    expect(res.status).toBe(200)
    expect(res.body).toEqual([])
  })

  it('each item still has lastModified field', async () => {
    const res = await request(app).get('/api/memory/agent/code-reviewer')
    expect(res.status).toBe(200)

    for (const item of res.body) {
      expect(item).toHaveProperty('lastModified')
      expect(typeof item.lastModified).toBe('string')
    }
  })

  it('each item returned by /agent/:agentName has lastModified', async () => {
    const res = await request(app).get('/api/memory/agent/code-reviewer')
    expect(res.status).toBe(200)
    expect(res.body.length).toBeGreaterThan(0)
    expect(res.body[0]).toHaveProperty('lastModified')
  })

  it('returns all memories for the specified agent', async () => {
    const { loadAgentMemory } = await import('../parsers/memory.js')
    vi.mocked(loadAgentMemory).mockReturnValue([
      {
        agent: 'planner',
        path: '/path/to/file1.md',
        filename: 'file1.md',
        name: 'memory1',
        description: 'desc1',
        type: 'user',
        body: 'content1',
        modifiedAt: '2026-03-31T09:00:00Z',
      },
      {
        agent: 'planner',
        path: '/path/to/file2.md',
        filename: 'file2.md',
        name: 'memory2',
        description: 'desc2',
        type: 'feedback',
        body: 'content2',
        modifiedAt: '2026-03-31T10:00:00Z',
      },
      {
        agent: 'code-reviewer',
        path: '/path/to/file3.md',
        filename: 'file3.md',
        name: 'memory3',
        description: 'desc3',
        type: 'user',
        body: 'content3',
        modifiedAt: '2026-03-31T11:00:00Z',
      },
    ])

    const res = await request(app).get('/api/memory/agent/planner')
    expect(res.status).toBe(200)
    expect(res.body).toHaveLength(2)
    expect(res.body.every((m: any) => m.agent === 'planner')).toBe(true)
  })
})

// ===========================================================================
// GET /api/memory/project — must include lastModified (U6 fix)
// ===========================================================================

describe('GET /api/memory/project', () => {
  it('returns status 200', async () => {
    const res = await request(app).get('/api/memory/project')
    expect(res.status).toBe(200)
  })

  it('returns an array', async () => {
    const res = await request(app).get('/api/memory/project')
    expect(Array.isArray(res.body)).toBe(true)
  })

  it('each item has a lastModified field (not undefined)', async () => {
    const res = await request(app).get('/api/memory/project')
    expect(res.status).toBe(200)
    expect(res.body.length).toBeGreaterThan(0)
    for (const item of res.body) {
      expect(item).toHaveProperty('lastModified')
      expect(item.lastModified).not.toBeUndefined()
      expect(typeof item.lastModified).toBe('string')
    }
  })

  it('lastModified is mapped from modifiedAt (not a raw modifiedAt field)', async () => {
    const res = await request(app).get('/api/memory/project')
    expect(res.status).toBe(200)
    const item = res.body[0]
    // withLastModified renames modifiedAt → lastModified and omits the raw key
    expect(item).toHaveProperty('lastModified')
    expect(item).not.toHaveProperty('modifiedAt')
  })

  it('lastModified value matches the modifiedAt from mock data', async () => {
    const res = await request(app).get('/api/memory/project')
    expect(res.status).toBe(200)
    const planner = res.body.find((m: any) => m.agent === 'planner')
    expect(planner).toBeDefined()
    expect(planner?.lastModified).toBe('2026-03-31T09:30:00Z')
  })

  it('returns empty array when loadProjectMemory returns empty', async () => {
    const { loadProjectMemory } = await import('../parsers/memory.js')
    vi.mocked(loadProjectMemory).mockReturnValue([])

    const res = await request(app).get('/api/memory/project')
    expect(res.status).toBe(200)
    expect(res.body).toEqual([])
  })
})
