import { describe, it, expect } from 'vitest'
import express from 'express'
import request from 'supertest'
import { castdControlRouter } from '../routes/castdControl.js'

// NOTE: only rejection paths are exercised here. They all return BEFORE the
// handler shells out to `crontab`/`execFile`, so these tests never mutate the
// real crontab or execute a script — no GUI/side-effect isolation needed.

function makeApp() {
  const app = express()
  app.use(express.json())
  app.use('/api/castd', castdControlRouter)
  return app
}

describe('castdControl validation', () => {
  describe('DELETE /cron — CAST-MANAGED marker requirement', () => {
    it('400s when no entry is supplied', async () => {
      const res = await request(makeApp()).delete('/api/castd/cron').send({})
      expect(res.status).toBe(400)
    })

    it('403s when the entry lacks the # CAST-MANAGED marker', async () => {
      const res = await request(makeApp())
        .delete('/api/castd/cron')
        .send({ entry: '0 * * * * /usr/bin/backup.sh' })
      expect(res.status).toBe(403)
      expect(res.body.error).toMatch(/CAST-MANAGED/)
    })
  })

  describe('POST /trigger — argument validation', () => {
    it('400s when no command is supplied', async () => {
      const res = await request(makeApp()).post('/api/castd/trigger').send({})
      expect(res.status).toBe(400)
    })

    it('403s when the binary is not allowlisted', async () => {
      const res = await request(makeApp())
        .post('/api/castd/trigger')
        .send({ command: 'rm -rf /' })
      expect(res.status).toBe(403)
    })

    it('400s on path traversal in an argument', async () => {
      const res = await request(makeApp())
        .post('/api/castd/trigger')
        .send({ command: 'cast ../../etc/passwd' })
      expect(res.status).toBe(400)
    })

    it('400s on a disallowed subcommand for cast', async () => {
      const res = await request(makeApp())
        .post('/api/castd/trigger')
        .send({ command: 'cast definitely-not-a-subcommand' })
      expect(res.status).toBe(400)
      expect(res.body.error).toMatch(/Subcommand/)
    })
  })

  describe('POST /cron — schedule + allowlist validation', () => {
    it('400s on an invalid cron schedule', async () => {
      const res = await request(makeApp())
        .post('/api/castd/cron')
        .send({ schedule: 'not a schedule', command: 'cast status' })
      expect(res.status).toBe(400)
    })

    it('403s when the command binary is not allowlisted', async () => {
      const res = await request(makeApp())
        .post('/api/castd/cron')
        .send({ schedule: '0 * * * *', command: 'evil.sh' })
      expect(res.status).toBe(403)
    })

    it('400s on newline injection in the command', async () => {
      const res = await request(makeApp())
        .post('/api/castd/cron')
        .send({ schedule: '0 * * * *', command: 'cast status\n0 0 * * * evil' })
      expect(res.status).toBe(400)
    })

    it('400s on shell metacharacters in command args (allowlisted binary)', async () => {
      // basename is allowlisted ("cast") but the chained command must be rejected
      // before being written to the crontab.
      const res = await request(makeApp())
        .post('/api/castd/cron')
        .send({ schedule: '* * * * *', command: 'cast status && rm -rf ~/.claude/cast.db' })
      expect(res.status).toBe(400)
    })

    it('400s on an absolute-path argument', async () => {
      const res = await request(makeApp())
        .post('/api/castd/cron')
        .send({ schedule: '* * * * *', command: 'cast status /etc/passwd' })
      expect(res.status).toBe(400)
    })
  })
})
