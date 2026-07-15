#!/usr/bin/env bash
# cast-task-processor.sh
# Runs every minute via cron. Picks up pending rows from cast.db task_queue,
# spawns claude --print per task, writes done/failed back.
set -euo pipefail

CAST_DB="${HOME}/.claude/cast.db"
LOCK_DIR="/tmp/cast-task-processor.lock"
LOG_DIR="${HOME}/.claude/cast/processor-logs"
mkdir -p "$LOG_DIR"

# Exit immediately if another instance is running (mkdir is atomic on all POSIX systems)
if ! mkdir "$LOCK_DIR" 2>/dev/null; then
  echo "[cast-task-processor] already running, skipping" >&2
  exit 0
fi
trap 'rm -rf "$LOCK_DIR"' EXIT

[[ -f "$CAST_DB" ]] || { echo "[cast-task-processor] cast.db not found at $CAST_DB" >&2; exit 1; }
command -v sqlite3 &>/dev/null || { echo "[cast-task-processor] sqlite3 not found" >&2; exit 1; }
command -v jq &>/dev/null || { echo "[cast-task-processor] jq not found" >&2; exit 1; }
command -v claude &>/dev/null || { echo "[cast-task-processor] claude CLI not found" >&2; exit 1; }

resolve_model() {
  case "$1" in
    sonnet) echo "claude-sonnet-4-6" ;;
    haiku)  echo "claude-haiku-4-5" ;;
    opus)   echo "claude-opus-4-6" ;;
    *)      echo "$1" ;;  # pass through if already a full model ID
  esac
}

# Fetch pending tasks — id is INTEGER so safe to interpolate
rows=$(sqlite3 "$CAST_DB" \
  "SELECT id || '|' || agent || '|' || task FROM task_queue \
   WHERE status='pending' AND (scheduled_for IS NULL OR scheduled_for <= datetime('now')) \
   ORDER BY priority ASC, created_at ASC \
   LIMIT 5;")

[[ -z "$rows" ]] && exit 0

while IFS='|' read -r task_id agent task_json; do
  [[ -z "$task_id" ]] && continue

  # Validate task_id is numeric (defense-in-depth)
  if ! [[ "$task_id" =~ ^[0-9]+$ ]]; then
    echo "[cast-task-processor] invalid task_id=$task_id, skipping" >&2
    continue
  fi

  prompt=$(echo "$task_json" | jq -r '.prompt // empty' 2>/dev/null)
  model_raw=$(echo "$task_json" | jq -r '.model // "sonnet"' 2>/dev/null)
  model=$(resolve_model "$model_raw")

  if [[ -z "$prompt" ]]; then
    echo "[cast-task-processor] task $task_id has no prompt, skipping" >&2
    sqlite3 "$CAST_DB" \
      "UPDATE task_queue SET status='failed', completed_at=datetime('now'), result_summary='missing prompt' WHERE id=$task_id;"
    continue
  fi

  # Claim the task
  now=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
  sqlite3 "$CAST_DB" \
    "UPDATE task_queue SET status='claimed', claimed_at='$now' WHERE id=$task_id AND status='pending';"

  log_file="$LOG_DIR/${task_id}.log"

  echo "[cast-task-processor] Spawning agent=$agent task=$task_id model=$model" >&2

  # Spawn in background subshell — wait collects all at the end
  (
    if claude --print --model "$model" \
      -p "[Dashboard dispatch — Agent: ${agent}]

${prompt}" \
      > "$log_file" 2>&1; then
      summary=$(head -c 500 "$log_file" | tr '\n' ' ' | tr "'" "''")
      sqlite3 "$CAST_DB" \
        "UPDATE task_queue SET status='done', completed_at=datetime('now'), result_summary='${summary}' WHERE id=${task_id};"
    else
      exit_code=$?
      sqlite3 "$CAST_DB" \
        "UPDATE task_queue SET status='failed', completed_at=datetime('now'), result_summary='exit code ${exit_code}' WHERE id=${task_id};"
    fi
  ) &

done <<< "$rows"

# Wait for all background subshells to finish before releasing lock
wait
