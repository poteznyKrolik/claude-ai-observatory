# Claude Code Agent Monitor — Docker Setup

Real-time dashboard for tracking Claude Code agent activity, sessions, tool usage, and subagent orchestration.

## Quick Start

```bash
docker compose up -d --build
```

## Access

**Dashboard**: http://127.0.0.1:4820

Shows:
- Real-time agent activity
- Session tracking
- Tool usage metrics
- Subagent orchestration
- Activity timeline and analytics

## Monitor & Manage

```bash
# Check status
docker compose ps

# View logs
docker compose logs -f claude-agent-monitor

# Stop service
docker compose down
```

## Notes

- Integrates with Claude Code via native hook system
- SQLite database for session history
- Supports WebSocket for real-time updates
- Read-only access to `~/.claude` sessions
- Data persists in Docker volume
- OpenAPI/Swagger endpoints at /api/docs
