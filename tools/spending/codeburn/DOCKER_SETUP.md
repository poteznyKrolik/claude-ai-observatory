# CodeBurn — Docker Setup

Interactive dashboard showing AI spending by task, tool, model, and project across Claude Code, Codex, Cursor, Kimi, and other agents.

## Quick Start

```bash
docker compose up -d --build
```

## Access

**Dashboard**: http://127.0.0.1:4747

Real-time spending breakdown with interactive navigation (arrow keys, type to filter).

## What It Shows

- Spending by the last 7 days (default time window)
- Breakdown by: task, model, tool, and project
- Cost per session with token counts
- Support for Claude, Codex, Cursor, Kimi, Devin, and other agents

## Monitor & Manage

```bash
# Check status
docker compose ps

# View logs
docker compose logs -f codeburn

# Stop service
docker compose down
```

## Notes

- Reads all supported agent log directories (Claude, Codex, Cursor, Kimi, etc.)
- Web interface is read-only; no modifications to session data
- First startup builds from source (~3–5 min, only on first run)
- Port 4747 auto-falls-back to an available port if occupied
