# Observatory Development Workflow

**Established workflow for managing the Claude AI Observatory monorepo.**

---

## Overview

This is a **single-person tool collection** repository. The workflow balances ease of local development with clean git history and proper documentation.

---

## Standard Workflow

### 1. Start Development Session

```bash
cd /Users/marty/tools/claude-generated/claude-ai-observatory

# List available services
observatory ls

# Show available presets
observatory presets
```

### 2. Launch Services for Your Work

```bash
# Start a specific preset based on what you're working on
observatory start --preset analytics        # Token/spending dashboards
observatory start --preset monitoring       # Observability & UI
observatory start --preset integrations     # ChatGPT extraction
observatory start                            # All services (full stack)

# Or start individual services
observatory start transcripts tokdash       # Specific services only
```

### 3. Monitor & Iterate

```bash
# Check service health
observatory health

# View all endpoints
observatory endpoints

# Follow logs in real-time
observatory logs -f <service>

# Check Docker status
observatory status
```

### 4. Make Code Changes

Follow the established patterns:
- Edit tool directories under `tools/`
- Update corresponding Docker files
- Use meaningful commit messages
- Test locally with `observatory start --build`

### 5. Commit & Push

```bash
# Create feature branch
git checkout -b feature/description

# Make changes and test
observatory stop
observatory start --build

# Commit with clear message
git add <files>
git commit -m "feat: description of changes"

# Push to feature branch
git push origin feature/description
```

### 6. Review & Merge (Manual)

```bash
# View PR on GitHub
# https://github.com/poteznyKrolik/claude-ai-observatory/pull/N

# Review changes manually
# Merge via GitHub UI (or CLI)

git checkout main
git pull origin main
```

### 7. Relaunch with Latest

```bash
# Stop current session
observatory down

# Pull latest changes
git pull origin main

# Relaunch with fresh code
observatory start --preset <preset>
```

---

## Service Tiers

Choose the right tier for your work:

### Tier 1: Analytics (Token & Spending)
```bash
observatory start --preset analytics
```
Services:
- Claude Transcripts (8765) — Session transcripts
- Tokdash (55423) — Token dashboard
- CodeBurn (4747) — Spending breakdown

**Use when:** Working on token tracking, session recording, or spending analysis.

### Tier 2: Monitoring (Observability & UI)
```bash
observatory start --preset monitoring
```
Services:
- Claude Dashboard (5173) — Main observability UI
- Agent Monitor (4820) — Real-time agent activity
- AI Observer (8080) — Event platform

**Use when:** Building observability features, UI improvements, or agent tracking.

### Tier 3: Integrations
```bash
observatory start --preset integrations
```
Services:
- ChatGPT Extractor (5000) — Conversation export

**Use when:** Working on external tool integrations or data pipelines.

### Full Stack
```bash
observatory start
```

**Use when:** Testing cross-service interactions or doing full end-to-end work.

---

## Common Tasks

### Add a New Service

1. **Create service directory** under `tools/`
2. **Add Dockerfile** with health check
3. **Update `docker-compose.yml`** with service definition
4. **Update `observatory.py`** SERVICES registry
5. **Add to appropriate PRESETS group**
6. **Test:** `observatory start --build`
7. **Commit & push**

### Update Existing Service

1. **Modify service code** in `tools/`
2. **Update Dockerfile** if needed
3. **Test locally:** `observatory restart <service>`
4. **Rebuild if needed:** `observatory start --build`
5. **Verify endpoints:** `observatory endpoints`
6. **Check logs:** `observatory logs -f <service>`
7. **Commit & push**

### Debug Service Issue

```bash
# Check logs
observatory logs -f <service>

# Check endpoint health
curl http://127.0.0.1:<port>/health

# Check Docker status
observatory status

# Rebuild and restart
observatory stop <service>
observatory start <service> --build

# Nuclear option: full reset
observatory down -v
observatory start --build
```

### Clean Up & Start Fresh

```bash
# Remove all containers and volumes
observatory down -v

# Or just stop (keep data)
observatory stop
```

---

## Git Workflow

### Branch Strategy

- `main` — Production-ready, merged releases
- `feature/*` — New features and integrations
- `fix/*` — Bug fixes
- `docs/*` — Documentation updates

### Commit Message Format

```
type: brief description

Optional longer explanation here if needed.

Examples:
  feat: add ChatGPT extractor integration
  fix: correct tokdash port binding
  docs: update CLI guide
  refactor: simplify docker-compose structure
```

### Before Merging

1. ✅ All services start cleanly
2. ✅ Endpoints are healthy
3. ✅ Logs are clean (no errors)
4. ✅ Documentation is updated
5. ✅ Commit message is clear

---

## Testing Checklist

Before committing changes:

```bash
# 1. Build with changes
observatory stop
observatory start --build

# 2. Check status
observatory status

# 3. Verify health
observatory health

# 4. Test endpoints
observatory endpoints
curl http://127.0.0.1:<port>

# 5. Check logs
observatory logs <service>

# 6. Verify no errors
docker compose logs --all

# 7. Clean shutdown
observatory stop
```

---

## Documentation Updates

When making changes, update relevant docs:

- **CLI.md** — If CLI commands change
- **SERVICES.md** — If service config changes
- **CHANGELOG.md** — Record significant changes
- **README.md** — If quick-start changes
- **Tool-specific docs** — In tool directories

---

## Troubleshooting

### "Command not found: observatory"

```bash
# Make sure you're in the observatory directory
cd /Users/marty/tools/claude-generated/claude-ai-observatory

# Run install script
bash install.sh

# Or use UV directly
uv run observatory.py ls
```

### Service won't start

```bash
# Check logs
observatory logs <service>

# Rebuild image
observatory start <service> --build

# Full reset if needed
observatory down -v
observatory start --build
```

### Port already in use

```bash
# See what's on the port
lsof -i :<port>

# Kill process or change port in docker-compose.yml
```

### Out of memory

```bash
# Stop services
observatory stop

# Remove old images and volumes
docker system prune -a -v

# Restart with specific preset (uses less memory)
observatory start --preset analytics
```

---

## Performance Notes

| Preset | Services | Memory | Startup |
|--------|----------|--------|---------|
| analytics | 3 | ~2GB | ~30s |
| monitoring | 3 | ~2GB | ~45s |
| integrations | 1 | ~500MB | ~5s |
| all | 7 | ~4GB | ~60s |

---

## Release Process

When ready to release a new version:

1. **Test thoroughly** with all presets
2. **Update CHANGELOG.md** with changes
3. **Verify all docs** are current
4. **Commit final changes** to main
5. **Tag release:** `git tag v0.2.0`
6. **Push tags:** `git push --tags`

---

## Resources

- **CLI.md** — Complete CLI command reference
- **SERVICES.md** — Service configuration details
- **docker-compose.yml** — Master orchestration file
- **GitHub** — https://github.com/poteznyKrolik/claude-ai-observatory

