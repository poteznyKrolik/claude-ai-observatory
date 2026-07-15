/**
 * Regression test for cast.db task_queue column name mismatch.
 *
 * Bug: taskQueue.ts SELECT query referenced nonexistent columns `task_data`
 * and `error_message`. The actual schema has `task` (not `task_data`) and
 * no `error_message` column. This caused SQLite to throw on every GET request,
 * returning a 500 instead of the task list.
 *
 * Fix location: server/routes/taskQueue.ts — column names corrected to `task`.
 */

import { describe, it, expect, vi } from 'vitest'
import Database from 'better-sqlite3'
import express from 'express'
import request from 'supertest'

// ---------------------------------------------------------------------------
// Build a minimal in-memory cast.db with the real schema and seed data.
// Created at module scope so the vi.mock factory can capture it immediately
// (vi.mock is hoisted before beforeAll, so module-level init is required).
// ---------------------------------------------------------------------------

const _testDb = new Database(':memory:')

_testDb.exec(`
  CREATE TABLE task_queue (
    id                    INTEGER PRIMARY KEY AUTOINCREMENT,
    created_at            TEXT,
    project               TEXT,
    project_root          TEXT,
    agent                 TEXT,
    task                  TEXT NOT NULL,
    priority              INTEGER DEFAULT 5,
    status                TEXT DEFAULT 'pending',
    claimed_at            TEXT,
    claimed_by_session    TEXT,
    completed_at          TEXT,
    result_summary        TEXT,
    retry_count           INTEGER DEFAULT 0,
    max_retries           INTEGER DEFAULT 3,
    scheduled_for         TEXT
  );
`)

_testDb.prepare(`
  INSERT INTO task_queue (created_at, agent, task, priority, status, retry_count)
  VALUES (?, ?, ?, ?, ?, ?)
`).run('2026-03-26T10:00:00Z', 'code-reviewer', 'Review the login component', 3, 'pending', 0)

// ---------------------------------------------------------------------------
// Mock getCastDb before the router is imported so the mock is in scope.
// ---------------------------------------------------------------------------

vi.mock('../routes/castDb.js', () => ({
  getCastDb: () => _testDb,
}))

// Router is imported AFTER the mock is registered.
const { taskQueueRouter } = await import('../routes/taskQueue.js')

const app = express()
app.use(express.json())
app.use('/', taskQueueRouter)

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('GET /api/cast/task-queue — column name regression', () => {
  it('returns 200 with tasks array and counts (not a 500 from bad column names)', async () => {
    const res = await request(app).get('/')
    expect(res.status).toBe(200)
    expect(res.body).toHaveProperty('tasks')
    expect(res.body).toHaveProperty('counts')
  })

  it('returns the seeded task with correct shape (task field present, not task_data)', async () => {
    const res = await request(app).get('/')
    expect(res.status).toBe(200)

    const tasks: Record<string, unknown>[] = res.body.tasks
    expect(tasks).toHaveLength(1)

    const task = tasks[0]
    // `task` must be present (the real column name)
    expect(task).toHaveProperty('task', 'Review the login component')
    // `task_data` must NOT be present (the bad column name from the original bug)
    expect(task).not.toHaveProperty('task_data')
    // `error_message` must NOT be present (also nonexistent in schema)
    expect(task).not.toHaveProperty('error_message')
  })

  it('returns correct pending count', async () => {
    const res = await request(app).get('/')
    expect(res.status).toBe(200)
    expect(res.body.counts.pending).toBe(1)
    expect(res.body.counts.done).toBe(0)
    expect(res.body.counts.failed).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// result_summary column guard test
// ---------------------------------------------------------------------------

describe('GET /api/cast/task-queue — result_summary column guard', () => {
  it('returns 200 with rows when task_queue schema omits result_summary column', async () => {
    // Simulate a fresh v9 install where result_summary was never added
    const freshDb = new Database(':memory:')
    freshDb.exec(`
      CREATE TABLE task_queue (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        created_at TEXT,
        agent      TEXT,
        task       TEXT NOT NULL,
        priority   INTEGER DEFAULT 5,
        status     TEXT DEFAULT 'pending',
        retry_count INTEGER DEFAULT 0,
        scheduled_for TEXT
        -- NOTE: no result_summary column
      );
    `)
    freshDb.exec(`
      CREATE TABLE agent_runs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        agent TEXT, model TEXT, status TEXT, started_at TEXT, ended_at TEXT
      );
    `)
    freshDb.prepare(
      'INSERT INTO task_queue (created_at, agent, task, status, retry_count) VALUES (?, ?, ?, ?, ?)'
    ).run('2026-07-02T10:00:00Z', 'code-writer', 'Build feature', 'pending', 0)

    const prevDb = _testDb
    // Temporarily swap the mock DB — re-import not needed, mock always returns testDb reference
    // We use a separate DB instance inline; this test isolates via a local express app.
    const localApp = express()
    const localMock = vi.fn(() => freshDb)
    // Can't re-mock per test after module import, so use the module-level _testDb swap approach:
    // Replace the module-level _testDb contents by exec-ing into it
    _testDb.exec(`DELETE FROM task_queue; DROP TABLE IF EXISTS task_queue;`)
    _testDb.exec(`
      CREATE TABLE task_queue (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        created_at TEXT, agent TEXT, task TEXT NOT NULL, priority INTEGER DEFAULT 5,
        status TEXT DEFAULT 'pending', retry_count INTEGER DEFAULT 0, scheduled_for TEXT
      );
    `)
    _testDb.prepare(
      'INSERT INTO task_queue (created_at, agent, task, status, retry_count) VALUES (?, ?, ?, ?, ?)'
    ).run('2026-07-02T10:00:00Z', 'code-writer', 'Build feature', 'pending', 0)

    const res = await request(app).get('/')
    expect(res.status).toBe(200)
    expect(res.body).toHaveProperty('tasks')
    expect(res.body.tasks.length).toBeGreaterThan(0)
    // result_summary must NOT be present in the returned tasks (not selected)
    for (const task of res.body.tasks) {
      expect(task).not.toHaveProperty('result_summary')
    }
    freshDb.close()
  })
})

// ---------------------------------------------------------------------------
// agent_runs fallback logic tests
// ---------------------------------------------------------------------------

describe('GET /api/cast/task-queue — agent_runs fallback', () => {
  it('returns agent_runs as synthetic tasks when task_queue is empty', async () => {
    // Clear task_queue and create agent_runs table with test data
    _testDb.prepare('DELETE FROM task_queue').run()
    _testDb.exec(`
      CREATE TABLE IF NOT EXISTS agent_runs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        agent TEXT,
        model TEXT,
        status TEXT,
        started_at TEXT,
        ended_at TEXT
      )
    `)
    _testDb.prepare('DELETE FROM agent_runs').run()
    _testDb.prepare(`
      INSERT INTO agent_runs (agent, model, status, started_at, ended_at)
      VALUES (?, ?, ?, ?, ?)
    `).run('test-writer', 'haiku', 'running', '2026-03-28T10:00:00Z', null)
    _testDb.prepare(`
      INSERT INTO agent_runs (agent, model, status, started_at, ended_at)
      VALUES (?, ?, ?, ?, ?)
    `).run('code-reviewer', 'haiku', 'DONE', '2026-03-28T09:00:00Z', '2026-03-28T09:05:00Z')

    const res = await request(app).get('/')
    expect(res.status).toBe(200)
    expect(res.body).toHaveProperty('source', 'agent_runs')
    expect(res.body.tasks).toHaveLength(2)

    const tasks: Record<string, unknown>[] = res.body.tasks
    // First task (most recent) should be test-writer with status running→claimed
    expect(tasks[0]).toMatchObject({
      agent: 'test-writer',
      status: 'claimed',
      priority: 0,
      retry_count: 0,
      scheduled_for: null,
      result_summary: 'running',
    })
    expect(tasks[0]).toHaveProperty('task', 'Agent run: test-writer')

    // Second task should be code-reviewer with status DONE→done
    expect(tasks[1]).toMatchObject({
      agent: 'code-reviewer',
      status: 'done',
      result_summary: 'DONE',
    })
  })

  it('maps agent_runs statuses correctly to task_queue statuses', async () => {
    _testDb.prepare('DELETE FROM task_queue').run()
    _testDb.prepare('DELETE FROM agent_runs').run()

    // Insert test data for all status mapping cases
    const statusMappings = [
      { original: 'running', expected: 'claimed' },
      { original: 'done', expected: 'done' },
      { original: 'DONE', expected: 'done' },
      { original: 'DONE_WITH_CONCERNS', expected: 'done' },
      { original: 'BLOCKED', expected: 'failed' },
      { original: 'failed', expected: 'failed' },
      { original: 'unknown_status', expected: 'pending' },
    ]

    // Use distinct timestamps (descending) so ORDER BY started_at DESC is deterministic
    statusMappings.forEach(({ original }, idx) => {
      const ts = `2026-03-28T${String(10 + idx).padStart(2, '0')}:00:00Z`
      _testDb.prepare(`
        INSERT INTO agent_runs (agent, model, status, started_at, ended_at)
        VALUES (?, ?, ?, ?, ?)
      `).run(`agent-${original}`, 'haiku', original, ts, null)
    })

    const res = await request(app).get('/')
    expect(res.status).toBe(200)
    expect(res.body).toHaveProperty('source', 'agent_runs')

    const tasks: Record<string, unknown>[] = res.body.tasks
    expect(tasks).toHaveLength(statusMappings.length)

    // Tasks come back ORDER BY started_at DESC — last-inserted (highest ts) first
    for (let i = 0; i < statusMappings.length; i++) {
      const { original, expected } = statusMappings[statusMappings.length - 1 - i]
      expect(tasks[i]).toMatchObject({
        agent: `agent-${original}`,
        status: expected,
        result_summary: original,
      })
    }
  })

  it('does NOT trigger agent_runs fallback when task_queue has pending items', async () => {
    // Restore task_queue with a pending item
    _testDb.prepare('DELETE FROM task_queue').run()
    _testDb.prepare(`
      INSERT INTO task_queue (created_at, agent, task, priority, status, retry_count)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run('2026-03-28T10:00:00Z', 'debugger', 'Debug the build', 3, 'pending', 0)

    const res = await request(app).get('/')
    expect(res.status).toBe(200)
    // source field should NOT be present
    expect(res.body).not.toHaveProperty('source')
    expect(res.body.tasks).toHaveLength(1)
    expect(res.body.tasks[0]).toMatchObject({
      agent: 'debugger',
      status: 'pending',
      task: 'Debug the build',
    })
    expect(res.body.counts.pending).toBe(1)
  })

  it('does NOT trigger agent_runs fallback when task_queue has claimed items', async () => {
    _testDb.prepare('DELETE FROM task_queue').run()
    _testDb.prepare(`
      INSERT INTO task_queue (created_at, agent, task, priority, status, retry_count)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run('2026-03-28T10:00:00Z', 'build-error-resolver', 'Fix build', 3, 'claimed', 0)

    const res = await request(app).get('/')
    expect(res.status).toBe(200)
    expect(res.body).not.toHaveProperty('source')
    expect(res.body.tasks).toHaveLength(1)
    expect(res.body.counts.claimed).toBe(1)
  })

  it('DOES trigger agent_runs fallback when task_queue has only done/failed items', async () => {
    _testDb.prepare('DELETE FROM task_queue').run()
    _testDb.prepare(`
      INSERT INTO task_queue (created_at, agent, task, priority, status, retry_count)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run('2026-03-28T09:00:00Z', 'commit', 'Commit changes', 3, 'done', 0)
    _testDb.prepare(`
      INSERT INTO task_queue (created_at, agent, task, priority, status, retry_count)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run('2026-03-28T08:00:00Z', 'push', 'Push to remote', 3, 'failed', 1)

    // Ensure agent_runs has data
    _testDb.prepare('DELETE FROM agent_runs').run()
    _testDb.prepare(`
      INSERT INTO agent_runs (agent, model, status, started_at, ended_at)
      VALUES (?, ?, ?, ?, ?)
    `).run('security', 'sonnet', 'DONE', '2026-03-28T10:00:00Z', '2026-03-28T10:05:00Z')

    const res = await request(app).get('/')
    expect(res.status).toBe(200)
    // Fallback should be triggered because counts.pending + counts.claimed === 0
    expect(res.body).toHaveProperty('source', 'agent_runs')
    expect(res.body.tasks).toHaveLength(1)
    expect(res.body.tasks[0]).toMatchObject({
      agent: 'security',
      status: 'done',
    })
  })

  it('falls through to empty task_queue response when agent_runs table does not exist', async () => {
    _testDb.prepare('DELETE FROM task_queue').run()
    // Drop agent_runs table if it exists
    _testDb.exec('DROP TABLE IF EXISTS agent_runs')

    const res = await request(app).get('/')
    expect(res.status).toBe(200)
    // source field should NOT be present (fallback failed, returned empty task_queue)
    expect(res.body).not.toHaveProperty('source')
    expect(res.body.tasks).toHaveLength(0)
    expect(res.body.counts).toEqual({
      pending: 0,
      claimed: 0,
      done: 0,
      failed: 0,
    })
  })

  it('computes counts correctly from agent_runs synthetic tasks', async () => {
    _testDb.prepare('DELETE FROM task_queue').run()
    _testDb.exec(`
      CREATE TABLE IF NOT EXISTS agent_runs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        agent TEXT,
        model TEXT,
        status TEXT,
        started_at TEXT,
        ended_at TEXT
      )
    `)
    _testDb.prepare('DELETE FROM agent_runs').run()

    // Insert various statuses to verify count computation
    _testDb.prepare(`
      INSERT INTO agent_runs (agent, model, status, started_at, ended_at)
      VALUES (?, ?, ?, ?, ?)
    `).run('agent1', 'haiku', 'running', '2026-03-28T10:00:00Z', null)
    _testDb.prepare(`
      INSERT INTO agent_runs (agent, model, status, started_at, ended_at)
      VALUES (?, ?, ?, ?, ?)
    `).run('agent2', 'haiku', 'running', '2026-03-28T09:00:00Z', null)
    _testDb.prepare(`
      INSERT INTO agent_runs (agent, model, status, started_at, ended_at)
      VALUES (?, ?, ?, ?, ?)
    `).run('agent3', 'haiku', 'DONE', '2026-03-28T08:00:00Z', '2026-03-28T08:05:00Z')
    _testDb.prepare(`
      INSERT INTO agent_runs (agent, model, status, started_at, ended_at)
      VALUES (?, ?, ?, ?, ?)
    `).run('agent4', 'haiku', 'DONE_WITH_CONCERNS', '2026-03-28T07:00:00Z', '2026-03-28T07:05:00Z')
    _testDb.prepare(`
      INSERT INTO agent_runs (agent, model, status, started_at, ended_at)
      VALUES (?, ?, ?, ?, ?)
    `).run('agent5', 'haiku', 'BLOCKED', '2026-03-28T06:00:00Z', '2026-03-28T06:05:00Z')
    _testDb.prepare(`
      INSERT INTO agent_runs (agent, model, status, started_at, ended_at)
      VALUES (?, ?, ?, ?, ?)
    `).run('agent6', 'haiku', 'failed', '2026-03-28T05:00:00Z', '2026-03-28T05:05:00Z')

    const res = await request(app).get('/')
    expect(res.status).toBe(200)
    expect(res.body).toHaveProperty('source', 'agent_runs')
    expect(res.body.counts).toEqual({
      pending: 0,
      claimed: 2,  // running → claimed (2)
      done: 2,     // DONE + DONE_WITH_CONCERNS → done (2)
      failed: 2,   // BLOCKED + failed → failed (2)
    })
  })
})
