/**
 * Tests for loadProjectMemory() in server/parsers/memory.ts
 *
 * Covers:
 * 1. Returns empty array when no sources exist
 * 2. Reads project-tagged memories from cast.db
 * 3. Reads project-specific .md files from agent-memory-local (excludes MEMORY.md)
 * 4. Reads legacy memory dir files from ~/.claude/projects/<proj>/memory/
 * 5. Deduplicates identical file paths across sources
 * 6. Handles cast.db being unavailable (missing file) gracefully
 * 7. Results sorted by modifiedAt DESC
 *
 * Strategy: vi.mock the constants module to redirect all path constants into
 * a deterministic temp directory created per test, avoiding live filesystem
 * access. The DB path (CAST_DB) is redirected to an in-memory SQLite path
 * by overriding it in the mock.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import fs from 'fs'
import path from 'path'
import os from 'os'
import Database from 'better-sqlite3'

// ---------------------------------------------------------------------------
// Temp directory management
// ---------------------------------------------------------------------------

let tmpDir: string
let agentMemoryDir: string
let projectsDir: string
let castDbPath: string

// We create the temp dirs before the mock so we can reference them.
// The mock factory captures these variables by reference via the closure over
// the module-level lets, which are assigned in beforeEach via a helper.
// Because vi.mock is hoisted, the factory runs after the let declarations but
// the closure defers reading the value until the constants are actually used
// by the module being tested.

vi.mock('../constants.js', () => {
  // Return a Proxy-style object that reads our mutable lets at call time.
  // We re-export every constant from the real module but override the four
  // we care about. Non-overridden constants are set to sentinel strings that
  // will cause fs.existsSync to return false (paths that don't exist).
  return {
    get CAST_DB() { return castDbPath },
    get AGENT_MEMORY_DIR() { return agentMemoryDir },
    get PROJECTS_DIR() { return projectsDir },
    // Unused by loadProjectMemory but exported from constants.ts
    PLANS_DIR: '/nonexistent-plans-dir',
    BRIEFINGS_DIR: '/nonexistent-briefings-dir',
    MEETINGS_DIR: '/nonexistent-meetings-dir',
    REPORTS_DIR: '/nonexistent-reports-dir',
    CLAUDE_DIR: '/nonexistent-claude-dir',
    AGENTS_DIR: '/nonexistent-agents-dir',
    SKILLS_DIR: '/nonexistent-skills-dir',
    COMMANDS_DIR: '/nonexistent-commands-dir',
    RULES_DIR: '/nonexistent-rules-dir',
    SETTINGS_FILE: '/nonexistent-settings-file',
    SETTINGS_GLOBAL_FILE: '/nonexistent-global-settings-file',
    CLAUDE_MD: '/nonexistent-claude-md',
    SCRIPTS_DIR: '/nonexistent-scripts-dir',
    KEYBINDINGS_FILE: '/nonexistent-keybindings',
    LAUNCH_FILE: '/nonexistent-launch-file',
    TASKS_DIR: '/nonexistent-tasks-dir',
    DEBUG_DIR: '/nonexistent-debug-dir',
    EMAIL_SUMMARIES_DIR: '/nonexistent-email-summaries-dir',
    DASHBOARD_COMMANDS_DIR: '/nonexistent-dashboard-commands-dir',
    CAST_SCRIPTS_DIR: '/nonexistent-cast-scripts-dir',
    PORT: 3001,
  }
})

// Import after mock registration so the module sees our mocked constants.
const { loadProjectMemory } = await import('../parsers/memory.js')

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function setupTmpDir() {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'memory-test-'))
  agentMemoryDir = path.join(tmpDir, 'agent-memory-local')
  projectsDir = path.join(tmpDir, 'projects')
  // Use a real file path inside tmpDir for cast.db; we'll create the DB there.
  castDbPath = path.join(tmpDir, 'cast.db')
}

function teardownTmpDir() {
  fs.rmSync(tmpDir, { recursive: true, force: true })
}

/**
 * Create a cast.db with the agent_memories table and optional rows.
 */
function createCastDb(rows: Array<{
  id?: number
  agent: string
  type?: string
  project: string
  name: string
  content: string
  updated_at: string
}> = []) {
  const db = new Database(castDbPath)
  db.exec(`
    CREATE TABLE IF NOT EXISTS agent_memories (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      agent      TEXT NOT NULL,
      type       TEXT,
      project    TEXT,
      name       TEXT,
      content    TEXT,
      updated_at TEXT
    )
  `)
  for (const row of rows) {
    db.prepare(`
      INSERT INTO agent_memories (agent, type, project, name, content, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(row.agent, row.type ?? 'project', row.project, row.name, row.content, row.updated_at)
  }
  db.close()
}

/**
 * Write a markdown file with optional gray-matter frontmatter.
 */
function writeMd(
  filePath: string,
  body: string,
  frontmatter: Record<string, string> = {}
) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  const fmKeys = Object.keys(frontmatter)
  const fm = fmKeys.length
    ? `---\n${fmKeys.map(k => `${k}: ${frontmatter[k]}`).join('\n')}\n---\n`
    : ''
  fs.writeFileSync(filePath, fm + body, 'utf-8')
}

// ---------------------------------------------------------------------------
// Test lifecycle
// ---------------------------------------------------------------------------

beforeEach(() => {
  setupTmpDir()
})

afterEach(() => {
  teardownTmpDir()
})

// ===========================================================================
// 1. Returns empty array when no sources exist
// ===========================================================================

describe('loadProjectMemory — no sources', () => {
  it('returns an empty array when cast.db is absent and no directories exist', () => {
    // tmpDir exists but agentMemoryDir and projectsDir do not, and no cast.db
    const result = loadProjectMemory()
    expect(result).toEqual([])
  })

  it('returns an empty array when directories exist but contain no .md files', () => {
    fs.mkdirSync(agentMemoryDir)
    fs.mkdirSync(path.join(agentMemoryDir, 'my-agent'))
    fs.mkdirSync(projectsDir)
    const result = loadProjectMemory()
    expect(result).toEqual([])
  })

  it('returns an empty array when cast.db exists but has no project-tagged rows', () => {
    createCastDb([
      // project is empty string — excluded by WHERE project != ''
      { agent: 'coder', project: '', name: 'global note', content: 'no project', updated_at: '2026-03-01T00:00:00Z' },
    ])
    const result = loadProjectMemory()
    expect(result).toEqual([])
  })
})

// ===========================================================================
// 2. Reads from cast.db when available with project-tagged memories
// ===========================================================================

describe('loadProjectMemory — cast.db source', () => {
  it('returns memories from cast.db rows where project is non-empty', () => {
    createCastDb([
      {
        agent: 'planner',
        type: 'decision',
        project: 'my-app',
        name: 'architecture decision',
        content: 'Use microservices.',
        updated_at: '2026-03-10T12:00:00Z',
      },
    ])

    const result = loadProjectMemory()
    expect(result).toHaveLength(1)
    const mem = result[0]
    expect(mem.agent).toBe('planner')
    expect(mem.name).toBe('architecture decision')
    expect(mem.description).toBe('my-app')   // description = project
    expect(mem.type).toBe('decision')
    expect(mem.body).toBe('Use microservices.')
    expect(mem.modifiedAt).toBe('2026-03-10T12:00:00Z')
    expect(mem.path).toBe('cast-db:1')       // cast-db:<id>
  })

  it('excludes rows where project IS NULL', () => {
    // Insert one row with NULL project via raw exec (prepare bind with undefined)
    const db = new Database(castDbPath)
    db.exec(`
      CREATE TABLE agent_memories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        agent TEXT, type TEXT, project TEXT, name TEXT, content TEXT, updated_at TEXT
      )
    `)
    db.prepare(`
      INSERT INTO agent_memories (agent, type, project, name, content, updated_at)
      VALUES (?, ?, NULL, ?, ?, ?)
    `).run('coder', 'note', 'null project note', 'should be excluded', '2026-03-01T00:00:00Z')
    db.prepare(`
      INSERT INTO agent_memories (agent, type, project, name, content, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run('coder', 'note', 'real-project', 'included note', 'included content', '2026-03-02T00:00:00Z')
    db.close()

    const result = loadProjectMemory()
    expect(result).toHaveLength(1)
    expect(result[0].name).toBe('included note')
  })

  it('sets type to "project" when DB type column is empty/null', () => {
    const db = new Database(castDbPath)
    db.exec(`
      CREATE TABLE agent_memories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        agent TEXT, type TEXT, project TEXT, name TEXT, content TEXT, updated_at TEXT
      )
    `)
    db.prepare(`
      INSERT INTO agent_memories (agent, type, project, name, content, updated_at)
      VALUES (?, NULL, ?, ?, ?, ?)
    `).run('debugger', 'some-project', 'memory with null type', 'body text', '2026-03-05T00:00:00Z')
    db.close()

    const result = loadProjectMemory()
    expect(result).toHaveLength(1)
    expect(result[0].type).toBe('project')
  })

  it('reads multiple rows from cast.db', () => {
    createCastDb([
      { agent: 'a1', project: 'proj-alpha', name: 'note-a', content: 'body a', updated_at: '2026-03-01T00:00:00Z' },
      { agent: 'a2', project: 'proj-beta',  name: 'note-b', content: 'body b', updated_at: '2026-03-02T00:00:00Z' },
      { agent: 'a3', project: 'proj-gamma', name: 'note-c', content: 'body c', updated_at: '2026-03-03T00:00:00Z' },
    ])

    const result = loadProjectMemory()
    expect(result).toHaveLength(3)
    // All agent names should be present
    const agents = result.map(r => r.agent)
    expect(agents).toContain('a1')
    expect(agents).toContain('a2')
    expect(agents).toContain('a3')
  })
})

// ===========================================================================
// 3. Reads project-specific .md files from agent-memory-local (excludes MEMORY.md)
// ===========================================================================

describe('loadProjectMemory — agent-memory-local source', () => {
  it('reads .md files from agent-memory-local/<agent>/ subdirectories', () => {
    const agentDir = path.join(agentMemoryDir, 'code-reviewer')
    writeMd(path.join(agentDir, 'my-project.md'), 'Project-specific context.', {
      name: 'my-project',
      description: 'My important project',
      type: 'context',
    })

    const result = loadProjectMemory()
    expect(result).toHaveLength(1)
    const mem = result[0]
    expect(mem.agent).toBe('code-reviewer')
    expect(mem.name).toBe('my-project')
    expect(mem.description).toBe('My important project')
    expect(mem.type).toBe('context')
    expect(mem.body).toBe('Project-specific context.')
  })

  it('excludes MEMORY.md files from agent-memory-local directories', () => {
    const agentDir = path.join(agentMemoryDir, 'planner')
    writeMd(path.join(agentDir, 'MEMORY.md'), 'Global agent memory — should be excluded.')
    writeMd(path.join(agentDir, 'project-alpha.md'), 'Project alpha context.')

    const result = loadProjectMemory()
    expect(result).toHaveLength(1)
    expect(result[0].name).toBe('project-alpha')
    // Confirm MEMORY.md is not present
    const names = result.map(r => r.name)
    expect(names).not.toContain('MEMORY')
  })

  it('falls back to filename (without .md) when frontmatter name is absent', () => {
    const agentDir = path.join(agentMemoryDir, 'test-writer')
    writeMd(path.join(agentDir, 'dashboard-project.md'), 'Some content with no frontmatter.')

    const result = loadProjectMemory()
    expect(result).toHaveLength(1)
    expect(result[0].name).toBe('dashboard-project')
    expect(result[0].description).toBe('dashboard-project') // also falls back to filename
  })

  it('defaults type to "project" when frontmatter type is absent', () => {
    const agentDir = path.join(agentMemoryDir, 'coder')
    writeMd(path.join(agentDir, 'api-service.md'), 'API service notes.')

    const result = loadProjectMemory()
    expect(result[0].type).toBe('project')
  })

  it('reads .md files from multiple agent subdirectories', () => {
    writeMd(path.join(agentMemoryDir, 'agent-a', 'proj1.md'), 'Content from agent-a.')
    writeMd(path.join(agentMemoryDir, 'agent-b', 'proj2.md'), 'Content from agent-b.')

    const result = loadProjectMemory()
    expect(result).toHaveLength(2)
    const agents = result.map(r => r.agent)
    expect(agents).toContain('agent-a')
    expect(agents).toContain('agent-b')
  })

  it('ignores non-.md files in agent-memory-local directories', () => {
    const agentDir = path.join(agentMemoryDir, 'planner')
    fs.mkdirSync(agentDir, { recursive: true })
    fs.writeFileSync(path.join(agentDir, 'notes.txt'), 'Not a markdown file.')
    writeMd(path.join(agentDir, 'project-notes.md'), 'This is markdown.')

    const result = loadProjectMemory()
    expect(result).toHaveLength(1)
    expect(result[0].name).toBe('project-notes')
  })
})

// ===========================================================================
// 4. Reads legacy memory dir files
// ===========================================================================

describe('loadProjectMemory — legacy projects/<proj>/memory/ source', () => {
  it('reads .md files from the legacy memory directory', () => {
    const memDir = path.join(projectsDir, 'my-proj', 'memory')
    writeMd(path.join(memDir, 'context.md'), 'Legacy project context.', {
      name: 'Project Context',
      description: 'Useful legacy note',
      type: 'background',
    })

    const result = loadProjectMemory()
    expect(result).toHaveLength(1)
    const mem = result[0]
    expect(mem.agent).toBe('my-proj')          // agent = project directory name
    expect(mem.name).toBe('Project Context')
    expect(mem.description).toBe('Useful legacy note')
    expect(mem.type).toBe('background')
    expect(mem.body).toBe('Legacy project context.')
  })

  it('skips project directories that have no memory/ subdirectory', () => {
    const projDir = path.join(projectsDir, 'no-memory-subdir')
    fs.mkdirSync(projDir, { recursive: true })
    // No memory/ subdir — should produce zero results
    const result = loadProjectMemory()
    expect(result).toEqual([])
  })

  it('skips memory/ entries that are not .md files', () => {
    const memDir = path.join(projectsDir, 'proj-x', 'memory')
    fs.mkdirSync(memDir, { recursive: true })
    fs.writeFileSync(path.join(memDir, 'notes.txt'), 'ignored')
    writeMd(path.join(memDir, 'important.md'), 'Included.')

    const result = loadProjectMemory()
    expect(result).toHaveLength(1)
    expect(result[0].name).toBe('important')
  })

  it('falls back to filename when no frontmatter name present in legacy file', () => {
    const memDir = path.join(projectsDir, 'legacy-proj', 'memory')
    writeMd(path.join(memDir, 'old-context.md'), 'Old content with no frontmatter.')

    const result = loadProjectMemory()
    expect(result).toHaveLength(1)
    expect(result[0].name).toBe('old-context')
    expect(result[0].description).toBe('')      // empty string default for legacy
    expect(result[0].type).toBe('project')      // default type
  })

  it('reads files from multiple legacy project directories', () => {
    writeMd(path.join(projectsDir, 'proj-alpha', 'memory', 'info.md'), 'Alpha info.')
    writeMd(path.join(projectsDir, 'proj-beta',  'memory', 'info.md'), 'Beta info.')

    const result = loadProjectMemory()
    expect(result).toHaveLength(2)
    const agents = result.map(r => r.agent)
    expect(agents).toContain('proj-alpha')
    expect(agents).toContain('proj-beta')
  })
})

// ===========================================================================
// 5. Deduplication across sources
// ===========================================================================

describe('loadProjectMemory — deduplication', () => {
  it('does not duplicate cast.db entries (each id is seen only once)', () => {
    createCastDb([
      { agent: 'coder', project: 'app', name: 'mem1', content: 'c1', updated_at: '2026-03-01T00:00:00Z' },
      { agent: 'coder', project: 'app', name: 'mem2', content: 'c2', updated_at: '2026-03-02T00:00:00Z' },
    ])

    const result = loadProjectMemory()
    const paths = result.map(r => r.path)
    const unique = new Set(paths)
    expect(paths.length).toBe(unique.size)
    expect(paths.length).toBe(2)
  })

  it('combines cast.db and agent-memory-local results without duplication', () => {
    createCastDb([
      { agent: 'planner', project: 'my-app', name: 'db-memory', content: 'from db', updated_at: '2026-03-05T00:00:00Z' },
    ])
    writeMd(path.join(agentMemoryDir, 'planner', 'my-app.md'), 'from filesystem')

    const result = loadProjectMemory()
    expect(result).toHaveLength(2)
    // cast.db entry has path 'cast-db:1', filesystem entry has a real path
    const paths = result.map(r => r.path)
    expect(paths.some(p => p.startsWith('cast-db:'))).toBe(true)
    expect(paths.some(p => p.endsWith('.md'))).toBe(true)
  })

  it('combines all three sources without duplication', () => {
    createCastDb([
      { agent: 'coder', project: 'proj', name: 'db-note', content: 'db', updated_at: '2026-03-01T00:00:00Z' },
    ])
    writeMd(path.join(agentMemoryDir, 'coder', 'proj.md'), 'agent-memory-local note')
    writeMd(path.join(projectsDir, 'proj', 'memory', 'legacy.md'), 'legacy note')

    const result = loadProjectMemory()
    expect(result).toHaveLength(3)

    const paths = result.map(r => r.path)
    const unique = new Set(paths)
    expect(paths.length).toBe(unique.size)
  })
})

// ===========================================================================
// 6. Handles cast.db being unavailable gracefully
// ===========================================================================

describe('loadProjectMemory — cast.db unavailable', () => {
  it('returns empty array when cast.db does not exist at all', () => {
    // castDbPath is set to a non-existent file — no DB created
    const result = loadProjectMemory()
    expect(result).toEqual([])
  })

  it('continues loading filesystem sources when cast.db does not exist', () => {
    // No cast.db, but agent-memory-local has data
    writeMd(path.join(agentMemoryDir, 'planner', 'project.md'), 'Filesystem only.')

    const result = loadProjectMemory()
    expect(result).toHaveLength(1)
    expect(result[0].body).toBe('Filesystem only.')
  })

  it('continues loading filesystem sources when cast.db is a corrupt file', () => {
    // Write garbage bytes to simulate a corrupt DB
    fs.writeFileSync(castDbPath, Buffer.from([0xff, 0xfe, 0x00, 0x01, 0x02, 0x03]))
    writeMd(path.join(agentMemoryDir, 'debugger', 'debug-proj.md'), 'Still readable.')

    // Should not throw — the catch block inside loadProjectMemory swallows the error
    const result = loadProjectMemory()
    // Filesystem results should still be present
    const filesystemResults = result.filter(r => !r.path.startsWith('cast-db:'))
    expect(filesystemResults).toHaveLength(1)
    expect(filesystemResults[0].body).toBe('Still readable.')
  })
})

// ===========================================================================
// 7. Results sorted by modifiedAt DESC
// ===========================================================================

describe('loadProjectMemory — sort order', () => {
  it('sorts results by modifiedAt descending', () => {
    // Use cast.db rows since we can control updated_at precisely
    createCastDb([
      { agent: 'a1', project: 'proj', name: 'oldest',  content: 'c1', updated_at: '2026-01-01T00:00:00Z' },
      { agent: 'a2', project: 'proj', name: 'newest',  content: 'c2', updated_at: '2026-03-15T00:00:00Z' },
      { agent: 'a3', project: 'proj', name: 'middle',  content: 'c3', updated_at: '2026-02-10T00:00:00Z' },
    ])

    const result = loadProjectMemory()
    expect(result).toHaveLength(3)
    expect(result[0].name).toBe('newest')
    expect(result[1].name).toBe('middle')
    expect(result[2].name).toBe('oldest')
  })

  it('sorts results descending when mixing cast.db and filesystem sources', () => {
    createCastDb([
      { agent: 'coder', project: 'proj', name: 'db-note', content: 'db', updated_at: '2026-03-20T00:00:00Z' },
    ])

    // Write a file and then manipulate its mtime to be older than the DB row
    const filePath = path.join(agentMemoryDir, 'coder', 'fs-note.md')
    writeMd(filePath, 'filesystem note')
    // Set mtime to something older than the DB row
    const oldTime = new Date('2026-01-15T00:00:00Z')
    fs.utimesSync(filePath, oldTime, oldTime)

    const result = loadProjectMemory()
    expect(result).toHaveLength(2)
    // DB note (2026-03-20) should come first
    expect(result[0].path).toBe('cast-db:1')
    // Filesystem note (2026-01-15) should come second
    expect(result[1].name).toBe('fs-note')
  })

  it('returns results in strictly non-ascending modifiedAt order', () => {
    createCastDb([
      { agent: 'a1', project: 'p', name: 'n1', content: 'c1', updated_at: '2026-03-01T10:00:00Z' },
      { agent: 'a2', project: 'p', name: 'n2', content: 'c2', updated_at: '2026-03-03T10:00:00Z' },
      { agent: 'a3', project: 'p', name: 'n3', content: 'c3', updated_at: '2026-03-02T10:00:00Z' },
    ])

    const result = loadProjectMemory()
    for (let i = 0; i < result.length - 1; i++) {
      expect(result[i].modifiedAt >= result[i + 1].modifiedAt).toBe(true)
    }
  })
})
