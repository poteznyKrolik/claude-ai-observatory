import { lazy, Suspense } from 'react'
import { Routes, Route, Navigate, Link } from 'react-router-dom'
import { MotionConfig } from 'framer-motion'
import Layout from './components/Layout'
import ErrorBoundary from './components/ErrorBoundary'
import { useDbChangeInvalidation } from './api/useDbChangeInvalidation'

const HomeView = lazy(() => import('./views/HomeView'))
const SessionsView = lazy(() => import('./views/SessionsView'))
const SessionDetailView = lazy(() => import('./views/SessionDetailView'))
const AnalyticsView = lazy(() => import('./views/AnalyticsView'))
const AnalyticsAgentDetailView = lazy(() => import('./views/AnalyticsAgentDetailView'))
const SystemView = lazy(() => import('./views/SystemView'))
const DocsView = lazy(() => import('./views/DocsView'))
const AgentsView = lazy(() => import('./views/AgentsView'))
const WorkLogView = lazy(() => import('./views/WorkLogView'))
const HookFailuresView = lazy(() => import('./views/HookFailuresView'))
const InjectionLogView = lazy(() => import('./views/InjectionLogView'))
const AgentReliabilityView = lazy(() => import('./views/AgentReliabilityView'))
const RoutinesView = lazy(() => import('./views/RoutinesView'))
const IncidentsView = lazy(() => import('./views/IncidentsView'))
const HooksView = lazy(() => import('./views/HooksView'))
const MemoryView = lazy(() => import('./views/MemoryView'))
const PlansView = lazy(() => import('./views/PlansView'))
const ExecutiveSummaryView = lazy(() => import('./views/ExecutiveSummaryView'))
const EvalRunsView = lazy(() => import('./views/EvalRunsView'))
const OutputsView = lazy(() => import('./views/OutputsView'))
const SqliteExplorerView = lazy(() => import('./views/SqliteExplorerView'))

export default function App() {
  useDbChangeInvalidation()

  return (
    <MotionConfig reducedMotion="user">
      <Layout>
        <Suspense fallback={<div className="p-8 text-[var(--text-muted)]">Loading...</div>}>
          <Routes>
            {/* ── Core routes (4 pages + 2 detail routes) ── */}
            <Route path="/" element={<ErrorBoundary><HomeView /></ErrorBoundary>} />
            <Route path="/sessions" element={<ErrorBoundary><SessionsView /></ErrorBoundary>} />
            <Route path="/sessions/:project/:sessionId" element={<ErrorBoundary><SessionDetailView /></ErrorBoundary>} />
            <Route path="/analytics" element={<ErrorBoundary><AnalyticsView /></ErrorBoundary>} />
            <Route path="/analytics/agents/:agent" element={<ErrorBoundary><AnalyticsAgentDetailView /></ErrorBoundary>} />
            <Route path="/system" element={<ErrorBoundary><SystemView /></ErrorBoundary>} />
            <Route path="/docs" element={<ErrorBoundary><DocsView /></ErrorBoundary>} />
            <Route path="/agents" element={<ErrorBoundary><AgentsView /></ErrorBoundary>} />
            <Route path="/work-log" element={<ErrorBoundary><WorkLogView /></ErrorBoundary>} />
            <Route path="/hook-failures" element={<ErrorBoundary><HookFailuresView /></ErrorBoundary>} />
            <Route path="/injection-log" element={<ErrorBoundary><InjectionLogView /></ErrorBoundary>} />
            <Route path="/agent-reliability" element={<ErrorBoundary><AgentReliabilityView /></ErrorBoundary>} />
            <Route path="/routines" element={<ErrorBoundary><RoutinesView /></ErrorBoundary>} />
            <Route path="/incidents" element={<ErrorBoundary><IncidentsView /></ErrorBoundary>} />
            <Route path="/hooks" element={<ErrorBoundary><HooksView /></ErrorBoundary>} />
            <Route path="/memory" element={<ErrorBoundary><MemoryView /></ErrorBoundary>} />
            <Route path="/plans" element={<ErrorBoundary><PlansView /></ErrorBoundary>} />
            <Route path="/executive" element={<ErrorBoundary><ExecutiveSummaryView /></ErrorBoundary>} />
            <Route path="/evals" element={<ErrorBoundary><EvalRunsView /></ErrorBoundary>} />
            <Route path="/outputs" element={<ErrorBoundary><OutputsView /></ErrorBoundary>} />

            {/* ── Consolidation redirects — old pages redirect to new parents ── */}
            <Route path="/commands" element={<Navigate to="/docs" replace />} />
            <Route path="/swarm" element={<Navigate to="/" replace />} />

            <Route path="/activity" element={<Navigate to="/sessions" replace />} />
            <Route path="/dispatch-log" element={<Navigate to="/sessions" replace />} />
            <Route path="/routing" element={<Navigate to="/sessions" replace />} />
            <Route path="/agent-runs" element={<Navigate to="/sessions" replace />} />
            <Route path="/task-queue" element={<Navigate to="/sessions" replace />} />

            <Route path="/token-spend" element={<Navigate to="/analytics" replace />} />
            <Route path="/quality-gates" element={<Navigate to="/analytics" replace />} />

            <Route path="/privacy" element={<Navigate to="/system" replace />} />
            <Route path="/db" element={<ErrorBoundary><SqliteExplorerView /></ErrorBoundary>} />
            <Route path="/castd" element={<Navigate to="/system" replace />} />
            <Route path="/rules" element={<Navigate to="/system" replace />} />
            <Route path="/knowledge" element={<Navigate to="/system" replace />} />
            <Route path="/knowledge/*" element={<Navigate to="/system" replace />} />
            <Route path="/agents/*" element={<Navigate to="/agents" replace />} />

            {/* ── Backwards compatibility for old /local-os/ bookmarks ── */}
            <Route path="/local-os/token-spend" element={<Navigate to="/analytics" replace />} />
            <Route path="/local-os/agent-runs" element={<Navigate to="/sessions" replace />} />
            <Route path="/local-os/task-queue" element={<Navigate to="/sessions" replace />} />
            <Route path="/local-os/memory-browser" element={<Navigate to="/system" replace />} />
            <Route path="/local-os/castd" element={<Navigate to="/system" replace />} />
            <Route path="/local-os/sqlite-explorer" element={<Navigate to="/db" replace />} />

            {/* ── 404 catch-all ── */}
            <Route path="*" element={
              <div className="flex flex-col items-center justify-center min-h-full gap-4 text-center p-8">
                <h1 className="text-5xl font-bold text-[var(--text-muted)]">404</h1>
                <p className="text-[var(--text-secondary)]">Page not found</p>
                <Link to="/" className="text-sm text-[var(--accent)] hover:underline">Back to Home</Link>
              </div>
            } />
          </Routes>
        </Suspense>
      </Layout>
    </MotionConfig>
  )
}
