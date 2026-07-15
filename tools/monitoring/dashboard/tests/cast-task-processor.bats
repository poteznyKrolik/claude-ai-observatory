#!/usr/bin/env bats
# BATS tests for cast-task-processor.sh
# Exercises: lock contention, missing DB, no pending tasks, claim+done,
# missing prompt → failed, failed claude exit, and model resolution.

SCRIPT="$(cd "$(dirname "$BATS_TEST_FILENAME")/.." && pwd)/scripts/cast-task-processor.sh"

TASK_QUEUE_SCHEMA="CREATE TABLE task_queue (
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
);"

setup() {
  TEST_DIR="$(mktemp -d)"
  export HOME_ORIG="$HOME"

  # Create a mock claude CLI that succeeds
  MOCK_BIN="$TEST_DIR/bin"
  mkdir -p "$MOCK_BIN"
  cat > "$MOCK_BIN/claude" << 'MOCK'
#!/usr/bin/env bash
echo "mock claude output: $*"
exit 0
MOCK
  chmod +x "$MOCK_BIN/claude"

  # Build a patched copy of the processor with test-specific paths
  PATCHED="$TEST_DIR/processor.sh"
  sed \
    -e "s|CAST_DB=.*|CAST_DB=\"$TEST_DIR/cast.db\"|" \
    -e "s|LOCK_DIR=.*|LOCK_DIR=\"$TEST_DIR/processor.lock\"|" \
    -e "s|LOG_DIR=.*|LOG_DIR=\"$TEST_DIR/logs\"|" \
    "$SCRIPT" > "$PATCHED"
  chmod +x "$PATCHED"

  # Create disposable cast.db
  sqlite3 "$TEST_DIR/cast.db" "$TASK_QUEUE_SCHEMA"
  mkdir -p "$TEST_DIR/logs"

  # Prepend mock bin to PATH
  export PATH="$MOCK_BIN:$PATH"
}

teardown() {
  # Clean up lock dir if it exists (tests may leave it)
  rm -rf "$TEST_DIR"
}

@test "lock contention: second instance exits cleanly" {
  # Simulate a held lock by creating the lock directory
  mkdir -p "$TEST_DIR/processor.lock"

  run bash "$PATCHED"

  [ "$status" -eq 0 ]
  [[ "$output" == *"already running"* ]]
}

@test "missing cast.db: exits with error" {
  rm -f "$TEST_DIR/cast.db"

  run bash "$PATCHED"

  [ "$status" -eq 1 ]
  [[ "$output" == *"cast.db not found"* ]]
}

@test "no pending tasks: exits 0 cleanly" {
  run bash "$PATCHED"

  [ "$status" -eq 0 ]
}

@test "pending task gets claimed and completes as done" {
  sqlite3 "$TEST_DIR/cast.db" \
    "INSERT INTO task_queue (created_at, agent, task, priority, status, retry_count, max_retries)
     VALUES (datetime('now'), 'researcher', '{\"prompt\":\"hello world\",\"model\":\"sonnet\"}', 5, 'pending', 0, 3);"

  run bash "$PATCHED"

  [ "$status" -eq 0 ]

  result_status=$(sqlite3 "$TEST_DIR/cast.db" "SELECT status FROM task_queue WHERE id=1;")
  [ "$result_status" = "done" ]

  result_summary=$(sqlite3 "$TEST_DIR/cast.db" "SELECT result_summary FROM task_queue WHERE id=1;")
  [ -n "$result_summary" ]

  completed=$(sqlite3 "$TEST_DIR/cast.db" "SELECT completed_at FROM task_queue WHERE id=1;")
  [ -n "$completed" ]
}

@test "missing prompt in task JSON marks row as failed" {
  sqlite3 "$TEST_DIR/cast.db" \
    "INSERT INTO task_queue (created_at, agent, task, priority, status, retry_count, max_retries)
     VALUES (datetime('now'), 'researcher', '{\"model\":\"sonnet\"}', 5, 'pending', 0, 3);"

  run bash "$PATCHED"

  [ "$status" -eq 0 ]

  result_status=$(sqlite3 "$TEST_DIR/cast.db" "SELECT status FROM task_queue WHERE id=1;")
  [ "$result_status" = "failed" ]

  result_summary=$(sqlite3 "$TEST_DIR/cast.db" "SELECT result_summary FROM task_queue WHERE id=1;")
  [[ "$result_summary" == *"missing prompt"* ]]
}

@test "failed claude exit code marks row as failed" {
  # Replace mock claude with one that fails
  cat > "$TEST_DIR/bin/claude" << 'MOCK'
#!/usr/bin/env bash
echo "error output" >&2
exit 1
MOCK
  chmod +x "$TEST_DIR/bin/claude"

  sqlite3 "$TEST_DIR/cast.db" \
    "INSERT INTO task_queue (created_at, agent, task, priority, status, retry_count, max_retries)
     VALUES (datetime('now'), 'debugger', '{\"prompt\":\"fix bug\",\"model\":\"haiku\"}', 5, 'pending', 0, 3);"

  run bash "$PATCHED"

  [ "$status" -eq 0 ]

  result_status=$(sqlite3 "$TEST_DIR/cast.db" "SELECT status FROM task_queue WHERE id=1;")
  [ "$result_status" = "failed" ]
}

@test "model resolution: sonnet, haiku, opus, passthrough" {
  # Source just the resolve_model function from the patched script
  eval "$(sed -n '/^resolve_model/,/^}/p' "$PATCHED")"

  run resolve_model "sonnet"
  [ "$output" = "claude-sonnet-4-6" ]

  run resolve_model "haiku"
  [ "$output" = "claude-haiku-4-5" ]

  run resolve_model "opus"
  [ "$output" = "claude-opus-4-6" ]

  run resolve_model "claude-sonnet-4-6"
  [ "$output" = "claude-sonnet-4-6" ]
}
