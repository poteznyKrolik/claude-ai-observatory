import { Router } from 'express'
import fs from 'fs'
import os from 'os'
import path from 'path'

export const researchCacheRouter = Router()

const CACHE_DIR = path.join(os.homedir(), '.claude/cast/research-cache')

// GET /api/cast/research-cache/stats
researchCacheRouter.get('/stats', (_req, res) => {
  try {
    if (!fs.existsSync(CACHE_DIR)) {
      return res.json({ file_count: 0, total_size_bytes: 0, oldest: null, newest: null })
    }

    const files = fs.readdirSync(CACHE_DIR).filter(f => !f.startsWith('.'))
    let totalSize = 0
    let oldest: Date | null = null
    let newest: Date | null = null

    for (const file of files) {
      try {
        const stat = fs.statSync(path.join(CACHE_DIR, file))
        totalSize += stat.size
        const mtime = stat.mtime
        if (!oldest || mtime < oldest) oldest = mtime
        if (!newest || mtime > newest) newest = mtime
      } catch {
        // skip
      }
    }

    res.json({
      file_count: files.length,
      total_size_bytes: totalSize,
      oldest: oldest?.toISOString() ?? null,
      newest: newest?.toISOString() ?? null,
    })
  } catch (err) {
    console.error('[research-cache] error:', err)
    res.json({ file_count: 0, total_size_bytes: 0, oldest: null, newest: null })
  }
})
