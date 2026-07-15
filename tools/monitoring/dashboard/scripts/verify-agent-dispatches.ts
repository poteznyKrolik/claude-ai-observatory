/**
 * Verification script for agentDispatches.ts parser
 * Run: npx tsx scripts/verify-agent-dispatches.ts
 *
 * Reads real session data from ~/.claude/projects/ and confirms
 * the parser extracts dispatch events correctly.
 */
import { getRecentAgentDispatches } from '../server/parsers/agentDispatches.js'

const dispatches = getRecentAgentDispatches(100)

console.log(`\nagentDispatches parser verification`)
console.log(`===================================`)
console.log(`Total dispatches found (last 24h): ${dispatches.length}`)

if (dispatches.length === 0) {
  console.log(`No dispatches found — this may be correct if no agents ran in the last 24h.`)
  console.log(`Check ~/.claude/projects/ for subagents/ directories to confirm.`)
} else {
  console.log(`\nSample dispatches (up to 5):`)
  dispatches.slice(0, 5).forEach((d, i) => {
    console.log(`  [${i + 1}] agent=${d.agentName ?? d.matchedRoute} model=${d.agentModel ?? 'unknown'} ts=${d.timestamp}`)
    if (d.promptPreview) {
      console.log(`      preview: ${d.promptPreview.slice(0, 100)}...`)
    }
  })

  // Validate structure
  const missing = dispatches.filter(d => !d.action || d.action !== 'agent_dispatch')
  if (missing.length > 0) {
    console.error(`\nWARNING: ${missing.length} dispatch(es) missing action='agent_dispatch' field`)
    process.exit(1)
  }

  console.log(`\nAll ${dispatches.length} dispatch events have correct structure.`)
  console.log(`Status: PASS`)
}
