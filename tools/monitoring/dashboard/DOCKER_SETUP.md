# Claude Code Dashboard — Docker Setup

Real-time observability dashboard for Claude Code sessions. Shows agent dispatch, token costs, hook status, and system health — all local, no cloud telemetry.

## Quick Start

```bash
docker compose up -d --build
```

First build takes 3–5 minutes (npm install + TypeScript compilation). Subsequent starts are ~10 seconds.

## Access

**Dashboard**: http://127.0.0.1:5173

Full observability UI showing:
- Agent dispatch history
- Session activity
- Token costs per session
- Hook status
- System health metrics

## Monitor & Manage

```bash
# Check status
docker compose ps

# View logs
docker compose logs -f claude-dashboard

# Stop service
docker compose down
```

## Ports

- **5173**: React frontend
- **3001**: Express API (backend)

## Notes

- Monitors Claude Code sessions from `~/.claude`
- Data persists in a Docker volume
- Built-in SQLite database for historical tracking
- No cloud dependencies or telemetry
- For full CAST agent team integration, install https://github.com/ek33450505/claude-agent-team
