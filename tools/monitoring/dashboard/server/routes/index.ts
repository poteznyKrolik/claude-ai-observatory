import { Router } from 'express'
import { agentsRouter } from './agents.js'
import { sessionsRouter } from './sessions.js'
import { memoryRouter } from './memory.js'
import { plansRouter } from './plans.js'
import { configRouter } from './config.js'
import { outputsRouter } from './outputs.js'
import { rulesRouter } from './rules.js'
import { skillsRouter } from './skills.js'
import { commandsRouter } from './commands.js'
import { searchRouter } from './search.js'
import { analyticsRouter } from './analytics.js'
import { routingRouter } from './routing.js'
import { hooksRouter } from './hooks.js'
import { controlRouter } from './control.js'
import { tokenSpendRouter } from './tokenSpend.js'
import { agentRunsRouter, activeAgentsRouter, sessionAgentsRouter, worktreesRouter } from './agentRuns.js'
import { taskQueueRouter } from './taskQueue.js'
import { agentMemoriesDbRouter } from './agentMemoriesDb.js'
import { castdControlRouter } from './castdControl.js'
import { sqliteExplorerRouter } from './sqliteExplorer.js'
import { seedRouter } from './seed.js'
import { budgetStatusRouter } from './budgetStatus.js'
import { castExecRouter } from './castExec.js'
import { qualityGatesRouter, dispatchDecisionsRouter } from './qualityGates.js'
import { parryGuardRouter } from './parryGuard.js'
import { agentTruncationsRouter } from './agentTruncations.js'
import { worktreeAnomaliesRouter } from './worktreeAnomalies.js'
import { evalRunsRouter } from './evalRuns.js'
import { rateLimitsRouter } from './rateLimits.js'
import { memoryConsolidationRouter } from './memoryConsolidation.js'
import { systemIntegrityRouter } from './systemIntegrity.js'
import { injectionLogRouter } from './injectionLog.js'
import { unstagedWarningsRouter } from './unstagedWarnings.js'
import { compactionEventsRouter } from './compactionEvents.js'
import { toolFailuresRouter } from './toolFailures.js'
import { researchCacheRouter } from './researchCache.js'
import { hookEventsRouter } from './hookEvents.js'
import { workLogStreamRouter } from './workLogStream.js'
import { stopFailureEventsRouter, agentProtocolViolationsRouter } from './telemetryRoutes.js'
import { hookFailuresRouter } from './hookFailures.js'
import { agentHallucinationsRouter } from './agentHallucinations.js'
import { routinesRouter } from './routines.js'
import { incidentsRouter } from './incidents.js'
import { completenessEventsRouter } from './completenessEvents.js'
import { codeRefChecksRouter } from './codeRefChecks.js'
import { costSummaryRouter } from './costSummary.js'
import { executiveSummaryRouter } from './executiveSummary.js'

export const router = Router()

router.use('/agents', agentsRouter)
router.use('/sessions', sessionsRouter)
router.use('/memory', memoryRouter)
router.use('/plans', plansRouter)
router.use('/config', configRouter)
router.use('/outputs', outputsRouter)
router.use('/rules', rulesRouter)
router.use('/skills', skillsRouter)
router.use('/commands', commandsRouter)
router.use('/search', searchRouter)
router.use('/analytics', analyticsRouter)
// USED BY: src/api/useRouting.ts, useRoutingEventsByType.ts (Analytics/routing pages)
router.use('/routing', routingRouter)
router.use('/hooks', hooksRouter)
// USED BY: SystemView.tsx (dispatch panel)
router.use('/control', controlRouter)
router.use('/cast/token-spend', tokenSpendRouter)
router.use('/cast/active-agents', activeAgentsRouter)
router.use('/cast/agent-runs', agentRunsRouter)
router.use('/cast/session-agents', sessionAgentsRouter)
// USED BY: src/api/useSessionAgents.ts (session agents page worktree display)
router.use('/cast/worktrees', worktreesRouter)
router.use('/cast/task-queue', taskQueueRouter)
router.use('/cast/memories', agentMemoriesDbRouter)
router.use('/castd', castdControlRouter)
router.use('/cast/explore', sqliteExplorerRouter)
// USED BY: src/api/useSeed.ts (seed panel in frontend)
router.use('/cast/seed', seedRouter)

router.use('/budget', budgetStatusRouter)
router.use('/cast', castExecRouter)

router.use('/quality-gates', qualityGatesRouter)
router.use('/dispatch-decisions', dispatchDecisionsRouter)
router.use('/parry-guard', parryGuardRouter)
router.use('/agent-truncations', agentTruncationsRouter)
router.use('/worktree-anomalies', worktreeAnomaliesRouter)
router.use('/eval-runs', evalRunsRouter)
router.use('/rate-limits', rateLimitsRouter)
router.use('/memory-consolidation', memoryConsolidationRouter)
router.use('/system/integrity', systemIntegrityRouter)
router.use('/injection-log', injectionLogRouter)
router.use('/unstaged-warnings', unstagedWarningsRouter)
router.use('/cast/compaction-events', compactionEventsRouter)
router.use('/cast/tool-failures', toolFailuresRouter)
// USED BY: src/api/useCastData.ts (research cache stats panel)
router.use('/cast/research-cache', researchCacheRouter)
router.use('/hook-events', hookEventsRouter)
// Phase 2 — work-log feed backend
router.use('/work-log-stream', workLogStreamRouter)
// Phase 3 prep — governance annotation data sources
router.use('/stop-failure-events', stopFailureEventsRouter)
router.use('/agent-protocol-violations', agentProtocolViolationsRouter)
router.use('/hook-failures', hookFailuresRouter)
router.use('/agent-hallucinations', agentHallucinationsRouter)
router.use('/routines', routinesRouter)
router.use('/incidents', incidentsRouter)
router.use('/completeness-events', completenessEventsRouter)
router.use('/code-ref-checks', codeRefChecksRouter)
router.use('/cast/cost-summary', costSummaryRouter)
router.use('/executive-summary', executiveSummaryRouter)

// Top-level health shortcut
router.get('/health', (req, res, next) => {
  req.url = '/health'
  configRouter(req, res, next)
})
