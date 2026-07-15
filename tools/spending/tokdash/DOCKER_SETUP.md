# Tokdash Docker Setup

This repo now includes a Dockerfile and docker-compose.yml for running Tokdash as persistent, automatically-restarting containers.

## Quick Start

### Prerequisites
- Docker Desktop (or Docker Engine + Docker Compose)
- Docker daemon running

### Launch

From this directory:

```bash
docker compose up -d --build
```

Both services will start in the background and restart automatically on crash or Docker daemon restart.

### Access

- **Claude Tokdash** dashboard: http://127.0.0.1:55423
  - Monitors: `~/.claude` (Claude Code logs)

- **Codex Tokdash** dashboard: http://127.0.0.1:55424
  - Monitors: `~/.codex` (Codex logs)

### Monitor Status

```bash
docker compose ps
```

Both should show `healthy` after 10–15 seconds (fast startup — pure Python, no Node.js overhead).

### View Logs

```bash
docker compose logs -f tokdash-claude
docker compose logs -f tokdash-codex
```

### Stop Services

```bash
docker compose down
```

Data persists in Docker volumes (`tokdash-claude-data`, `tokdash-codex-data`).

## Architecture

- **Image**: Single `python:3.12-slim` image; packages Tokdash via `pip install -e .` at build time
- **Services**: Two independent containers sharing the same image
  - `tokdash-claude` → port 55423
  - `tokdash-codex` → port 55424
- **Log mounts**: Each service has read-only mounts to its agent logs (`~/.claude` or `~/.codex`)
- **Data volumes**: Separate named volumes for each service's usage database
- **Restart**: `unless-stopped` — auto-restarts on crash or daemon restart
- **Health checks**: Both services have healthchecks; initial startup is fast (~10s, no dependency setup needed)

## Notes

- No external network exposure (both bound to `127.0.0.1` only on the host)
- Built-in with `pip install -e .` — dependency installation happens once at build time
- Startup is much faster than TokenTelemetry (~10s vs ~60s) because there's no venv/npm setup at runtime
- Uses Tokdash's default ports (55423, 55424) to avoid port collisions with other services
- Logs are rotated to prevent unbounded growth (10MB max per file, 3 files retained)
