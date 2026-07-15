# Claude Code Transcripts — Docker Setup

This container runs `claude-code-transcripts` to generate and serve HTML transcripts of your Claude Code sessions.

## Quick Start

From this directory:

```bash
docker compose up -d --build
```

## Access

**Dashboard**: http://127.0.0.1:8765

Browse generated transcripts of all your local Claude Code sessions. Each session gets a full paginated HTML version with a timeline index.

## How It Works

1. **On startup**: Generates HTML transcripts from all sessions in `~/.claude/projects`
2. **Serves**: Runs a Python HTTP server on port 8765 to browse the generated pages
3. **Persists**: Generated transcripts are stored in a Docker volume and survive container restarts

## Monitor & Manage

```bash
# Check status
docker compose ps

# View logs
docker compose logs -f claude-transcripts

# Stop service
docker compose down
```

## Notes

- Runs on Claude Code sessions only (reads-only from `~/.claude`)
- Generates full HTML transcripts with pagination (index.html + page-001.html, etc.)
- First run processes all local sessions (can take a minute if you have many)
- Output lives in a Docker volume; remove container but keep volume to preserve transcripts
- To regenerate, restart the container: `docker compose restart claude-transcripts`
