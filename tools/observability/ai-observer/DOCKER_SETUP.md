# AI Observer — Docker Setup

Self-hosted observability platform for monitoring Claude Code and other AI assistants. Tracks token usage, costs, API latency, error rates, and session activity in a unified dashboard.

## Quick Start

```bash
docker compose up -d --build
```

First build compiles from Go source (~5–10 minutes). Subsequent starts are ~5 seconds.

## Access

**Dashboard**: http://127.0.0.1:8080

Shows:
- Token usage and costs
- API latency metrics
- Error rates
- Session activity timeline
- Claude Code session telemetry

## Ports

- **8080**: HTTP API and dashboard
- **4318**: OTLP ingestion endpoint (for real-time telemetry)

## Monitor & Manage

```bash
# Check status
docker compose ps

# View logs
docker compose logs -f ai-observer

# Stop service
docker compose down
```

## Data Storage

- Local DuckDB database (zero external dependencies)
- Data persists in Docker volume
- Reads Claude Code sessions from `~/.claude`

## Notes

- Built with Go + embedded frontend
- Multi-agent support (Claude, Codex, Gemini, Copilot, OpenCode)
- Configurable via environment variables
- OTLP endpoint ready for real-time telemetry ingestion
