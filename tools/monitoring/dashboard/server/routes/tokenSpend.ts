import { Router } from 'express'
import { getJsonlTokenTotals, getJsonlDailyBreakdown } from '../utils/jsonlTokenTotals.js'

export const tokenSpendRouter = Router()

tokenSpendRouter.get('/', (_req, res) => {
  try {
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - 30)
    const cutoffStr = cutoff.toISOString().slice(0, 10)

    // Both totals AND daily breakdown from JSONL (the only reliable source)
    const jsonlTotals = getJsonlTokenTotals(cutoffStr)
    const daily = getJsonlDailyBreakdown(cutoffStr)

    res.json({
      daily,
      totals: {
        inputTokens: jsonlTotals.inputTokens,
        outputTokens: jsonlTotals.outputTokens,
        cacheCreationTokens: jsonlTotals.cacheCreationTokens,
        cacheReadTokens: jsonlTotals.cacheReadTokens,
        costUsd: jsonlTotals.costUsd,
        sessionCount: jsonlTotals.sessionCount,
      },
    })
  } catch (err) {
    console.error('Token spend error:', err)
    res.status(500).json({ error: 'Failed to fetch token spend data' })
  }
})
