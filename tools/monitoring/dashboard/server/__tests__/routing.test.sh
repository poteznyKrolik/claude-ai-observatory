#!/bin/bash
# routing.test.sh — Bash test suite for CAST routing scripts
# Tests route.sh and code-review-gate.sh
#
# Usage: bash server/__tests__/routing.test.sh
#        (from project root or any directory)

set -uo pipefail

ROUTE_SH="$HOME/.claude/scripts/route.sh"
GATE_SH="$HOME/.claude/scripts/code-review-gate.sh"

PASS=0
FAIL=0

# ---------------------------------------------------------------------------
# Test helpers
# ---------------------------------------------------------------------------

assert_contains() {
  local test_name="$1"
  local output="$2"
  local expected="$3"

  if echo "$output" | grep -qi "$expected"; then
    echo "PASS: $test_name"
    PASS=$((PASS + 1))
  else
    echo "FAIL: $test_name (expected to contain '$expected', got: $(echo "$output" | head -1))"
    FAIL=$((FAIL + 1))
  fi
}

assert_empty() {
  local test_name="$1"
  local output="$2"

  if [ -z "$output" ]; then
    echo "PASS: $test_name"
    PASS=$((PASS + 1))
  else
    echo "FAIL: $test_name (expected empty output, got: $(echo "$output" | head -1))"
    FAIL=$((FAIL + 1))
  fi
}

assert_exit_zero() {
  local test_name="$1"
  local exit_code="$2"

  if [ "$exit_code" -eq 0 ]; then
    echo "PASS: $test_name"
    PASS=$((PASS + 1))
  else
    echo "FAIL: $test_name (expected exit 0, got exit $exit_code)"
    FAIL=$((FAIL + 1))
  fi
}

# ---------------------------------------------------------------------------
# Preflight checks
# ---------------------------------------------------------------------------

if [ ! -f "$ROUTE_SH" ]; then
  echo "ERROR: route.sh not found at $ROUTE_SH"
  exit 1
fi

if [ ! -f "$GATE_SH" ]; then
  echo "ERROR: code-review-gate.sh not found at $GATE_SH"
  exit 1
fi

# ---------------------------------------------------------------------------
# route.sh tests
# ---------------------------------------------------------------------------

echo ""
echo "=== route.sh tests ==="
echo ""

# 1. "add a login page" → planner route with MANDATORY DELEGATION
output=$(echo '{"prompt": "add a login page"}' | bash "$ROUTE_SH" 2>/dev/null || true)
assert_contains \
  "add a login page → dispatches planner" \
  "$output" \
  "planner"

output=$(echo '{"prompt": "add a login page"}' | bash "$ROUTE_SH" 2>/dev/null || true)
assert_contains \
  "add a login page → emits MANDATORY DELEGATION" \
  "$output" \
  "MANDATORY DELEGATION"

# 2. "fix this bug" → debugger route with MANDATORY DELEGATION
output=$(echo '{"prompt": "fix this bug in the login flow"}' | bash "$ROUTE_SH" 2>/dev/null || true)
assert_contains \
  "fix this bug → dispatches debugger or emits MANDATORY DELEGATION" \
  "$output" \
  "debugger\|MANDATORY DELEGATION"

# 3. "create a commit" → commit route
output=$(echo '{"prompt": "create a commit"}' | bash "$ROUTE_SH" 2>/dev/null || true)
assert_contains \
  "create a commit → dispatches commit agent" \
  "$output" \
  "commit"

# 4. "review my code" → code-reviewer route
output=$(echo '{"prompt": "review my code please"}' | bash "$ROUTE_SH" 2>/dev/null || true)
assert_contains \
  "review my code → dispatches code-reviewer" \
  "$output" \
  "code-reviewer"

# 5. "write tests for this" → test-writer route
output=$(echo '{"prompt": "write tests for this component"}' | bash "$ROUTE_SH" 2>/dev/null || true)
assert_contains \
  "write tests for this → dispatches test-writer" \
  "$output" \
  "test-writer"

# 6. No-match case → MANDATORY ASSESSMENT
output=$(echo '{"prompt": "hello there, how are you doing today"}' | bash "$ROUTE_SH" 2>/dev/null || true)
assert_contains \
  "unmatched prompt → emits MANDATORY ASSESSMENT" \
  "$output" \
  "MANDATORY ASSESSMENT"

# 7. Opus escalation: "opus: design the architecture"
output=$(echo '{"prompt": "opus: design the architecture for the new auth system"}' | bash "$ROUTE_SH" 2>/dev/null || true)
assert_contains \
  "opus: prefix → emits Opus or opus_escalation message" \
  "$output" \
  "Opus\|opus"

# 8. Route exits cleanly (no pipeline error)
echo '{"prompt": "add a dashboard page"}' | bash "$ROUTE_SH" > /dev/null 2>&1
assert_exit_zero \
  "route.sh exits 0 on matched prompt" \
  "$?"

echo '{"prompt": "hello there"}' | bash "$ROUTE_SH" > /dev/null 2>&1
assert_exit_zero \
  "route.sh exits 0 on no-match prompt" \
  "$?"

# ---------------------------------------------------------------------------
# code-review-gate.sh tests
# ---------------------------------------------------------------------------

echo ""
echo "=== code-review-gate.sh tests ==="
echo ""

# 1. Source .tsx file with Write tool → should emit CODE REVIEW GATE
output=$(echo '{"tool_name":"Write","tool_input":{"file_path":"/src/components/LoginPage.tsx"}}' | bash "$GATE_SH" 2>/dev/null || true)
assert_contains \
  ".tsx Write → emits CODE REVIEW GATE" \
  "$output" \
  "CODE REVIEW GATE"

# 2. Source .tsx file with Edit tool → should emit CODE REVIEW GATE
output=$(echo '{"tool_name":"Edit","tool_input":{"file_path":"/src/components/LoginPage.tsx"}}' | bash "$GATE_SH" 2>/dev/null || true)
assert_contains \
  ".tsx Edit → emits CODE REVIEW GATE" \
  "$output" \
  "CODE REVIEW GATE"

# 3. Markdown file → should produce no output
output=$(echo '{"tool_name":"Write","tool_input":{"file_path":"/docs/README.md"}}' | bash "$GATE_SH" 2>/dev/null || true)
assert_empty \
  ".md file → silent (no review gate)" \
  "$output"

# 4. JSON config file → should produce no output
output=$(echo '{"tool_name":"Write","tool_input":{"file_path":"/config/settings.json"}}' | bash "$GATE_SH" 2>/dev/null || true)
assert_empty \
  ".json file → silent (no review gate)" \
  "$output"

# 5. Test file (.test.tsx) → should produce no output
output=$(echo '{"tool_name":"Write","tool_input":{"file_path":"/src/components/Foo.test.tsx"}}' | bash "$GATE_SH" 2>/dev/null || true)
assert_empty \
  ".test.tsx file → silent (test-writer handles those)" \
  "$output"

# 6. Spec file (.spec.ts) → should produce no output
output=$(echo '{"tool_name":"Write","tool_input":{"file_path":"/src/utils/helpers.spec.ts"}}' | bash "$GATE_SH" 2>/dev/null || true)
assert_empty \
  ".spec.ts file → silent" \
  "$output"

# 7. File inside __tests__ directory → should produce no output
output=$(echo '{"tool_name":"Write","tool_input":{"file_path":"/server/__tests__/routing.test.ts"}}' | bash "$GATE_SH" 2>/dev/null || true)
assert_empty \
  "__tests__ directory file → silent" \
  "$output"

# 8. Python file → should emit CODE REVIEW GATE
output=$(echo '{"tool_name":"Write","tool_input":{"file_path":"/scripts/process.py"}}' | bash "$GATE_SH" 2>/dev/null || true)
assert_contains \
  ".py Write → emits CODE REVIEW GATE" \
  "$output" \
  "CODE REVIEW GATE"

# 9. Non-Write/Edit tool → should produce no output (gate only fires on writes)
output=$(echo '{"tool_name":"Read","tool_input":{"file_path":"/src/components/LoginPage.tsx"}}' | bash "$GATE_SH" 2>/dev/null || true)
assert_empty \
  "Read tool → silent (gate only fires on Write/Edit)" \
  "$output"

# 10. .yaml config file → should produce no output
output=$(echo '{"tool_name":"Write","tool_input":{"file_path":"/config/docker-compose.yaml"}}' | bash "$GATE_SH" 2>/dev/null || true)
assert_empty \
  ".yaml file → silent (no review gate)" \
  "$output"

# 11. Exit codes
echo '{"tool_name":"Write","tool_input":{"file_path":"/src/App.tsx"}}' | bash "$GATE_SH" > /dev/null 2>&1
assert_exit_zero \
  "code-review-gate.sh exits 0 on source file" \
  "$?"

echo '{"tool_name":"Write","tool_input":{"file_path":"/README.md"}}' | bash "$GATE_SH" > /dev/null 2>&1
assert_exit_zero \
  "code-review-gate.sh exits 0 on skipped file" \
  "$?"

# ---------------------------------------------------------------------------
# Summary
# ---------------------------------------------------------------------------

TOTAL=$((PASS + FAIL))
echo ""
echo "==================================="
echo "Results: $PASS/$TOTAL passed"
if [ "$FAIL" -gt 0 ]; then
  echo "FAILED: $FAIL test(s)"
  echo "==================================="
  exit 1
else
  echo "All tests passed."
  echo "==================================="
  exit 0
fi
