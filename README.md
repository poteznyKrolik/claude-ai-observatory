# Claude AI Observatory

**Complete observability, analytics, and model management suite for Claude Code and LLM inference.**

A production-grade monorepo combining local token tracking, spending dashboards, inference monitoring, session analytics, and GGUF model management — all running locally with Docker Compose.

---

## What's Included

### 🎯 **Spending & Token Analytics**
- **Tokdash** — Token usage dashboard (Claude-only)
- **CodeBurn** — Spending breakdown by task/tool/model (multi-agent)
- **CCUsage** — CLI token analyzer and cost reporter

### 📊 **Monitoring & Observability**
- **AI Observer** — Real-time observability platform (Go + DuckDB)
- **Claude Dashboard** — Full observability UI (React + Express)
- **Claude Agent Monitor** — Real-time agent activity tracking

### 📝 **Session Analytics**
- **Claude Transcripts** — HTML transcript generator for sessions

### 🧠 **Model Management**
- **GGUF + llama.cpp Hub** — Production GGUF inference with pure hardware tuning (KitOps + Docker)

---

## Quick Start

### Option 1: Using the Observatory CLI (Recommended)

```bash
# Clone and setup
git clone https://github.com/poteznyKrolik/claude-ai-observatory.git
cd claude-ai-observatory

# Install CLI (one-time)
bash install.sh

# Start all services
observatory start

# Start specific preset
observatory start --preset analytics   # Token dashboards only
observatory start --preset monitoring  # Observability stack

# Check service health
observatory health

# View endpoints
observatory endpoints

# Stop services
observatory stop
```

**See [CLI.md](CLI.md) for complete CLI documentation.**

### Option 2: Using Docker Compose Directly

```bash
# Clone and setup
git clone https://github.com/poteznyKrolik/claude-ai-observatory.git
cd claude-ai-observatory

# Start all services
docker compose up -d --build

# Or start specific services
docker compose up -d --build claude-transcripts codeburn tokdash-claude

# View all services
docker compose ps

# Check endpoints
curl http://127.0.0.1:8765          # Transcripts
curl http://127.0.0.1:4747          # CodeBurn
curl http://127.0.0.1:5173          # Claude Dashboard
curl http://127.0.0.1:8080          # AI Observer
curl http://127.0.0.1:55423         # Tokdash
curl http://127.0.0.1:4820          # Agent Monitor

# Stop all
docker compose down
```

---

## Architecture

```
claude-ai-observatory/
├── README.md
├── docker-compose.yml              # Master orchestration (all services)
├── SERVICES.md                     # Service guide & endpoints
├── tools/
│   ├── transcripts/
│   │   └── app/                    # Claude Transcripts (HTML generator)
│   ├── spending/
│   │   ├── tokdash/                # Tokdash (Claude token dashboard)
│   │   ├── codeburn/               # CodeBurn (spending breakdown)
│   │   └── ccusage/                # CCUsage (CLI analyzer)
│   ├── monitoring/
│   │   ├── dashboard/              # Claude Dashboard (observability UI)
│   │   └── agent-monitor/          # Agent Monitor (activity tracking)
│   ├── observability/
│   │   └── ai-observer/            # AI Observer (platform)
│   └── registry/
│       └── llama/                  # GGUF + llama.cpp (model management)
└── docs/
    ├── GETTING_STARTED.md
    ├── DEPLOYMENT.md
    └── TROUBLESHOOTING.md
```

---

## Services & Ports

| Service | Port | Purpose | Multi-Agent | Notes |
|---------|------|---------|:----------:|-------|
| **Claude Transcripts** | 8765 | HTML transcript generator | ❌ | Claude-only |
| **Claude Dashboard** | 5173/3001 | Full observability UI | ❌ | React + Express |
| **Claude Agent Monitor** | 4820 | Real-time activity tracking | ❌ | WebSocket support |
| **Tokdash (Claude)** | 55423 | Token usage dashboard | ❌ | Claude-only |
| **CodeBurn** | 4747 | Spending breakdown | ✅ | Claude, Codex, Cursor, Kimi |
| **AI Observer** | 8080/4318 | Observability platform | ✅ | Go + DuckDB + OTLP |
| **GGUF Server** | 8000 | llama.cpp inference | — | Model management |

---

## Docker Compose Commands

```bash
# Start all services
docker compose up -d --build

# Start specific service(s)
docker compose up -d --build claude-dashboard tokdash-claude

# View logs (all)
docker compose logs -f

# View logs (specific service)
docker compose logs -f claude-dashboard

# Monitor resources
docker stats

# Check health
docker compose ps

# Stop all
docker compose down

# Remove volumes (delete persistent data)
docker compose down -v

# Rebuild images
docker compose build --no-cache

# Execute command in container
docker compose exec claude-dashboard npm run build

# Restart specific service
docker compose restart codeburn
```

---

## Configuration

### Start Specific Tools

Edit `docker-compose.yml` or selectively start services:

```bash
# Only monitoring stack
docker compose up -d claude-dashboard claude-agent-monitor ai-observer

# Only spending/analytics
docker compose up -d codeburn tokdash-claude ccusage

# Only transcripts
docker compose up -d claude-transcripts

# Only GGUF model server
docker compose up -d gguf-llama-cpp-server
```

### Hardware Tuning (GGUF/llama.cpp)

Edit `docker-compose.yml` under `gguf-llama-cpp-server`:

```yaml
environment:
  N_CTX: "2048"              # Context window
  N_BATCH: "512"             # Batch size
  N_THREADS: "0"             # Auto-detect CPUs
  # N_GPU_LAYERS: "33"       # Uncomment for GPU offloading
```

See `tools/registry/llama/README.md` for complete GPU/hardware tuning reference.

---

## Data Persistence

All services use Docker named volumes (survive restarts):

```
claude-transcripts-output
claude-dashboard-data
claude-agent-monitor-data
ai-observer-data
tokdash-claude-data
codeburn-data
gguf-llama-cache
```

Backup:
```bash
docker volume ls | grep claude
docker volume inspect <volume-name>
```

Remove volumes (⚠️ deletes data):
```bash
docker compose down -v
```

---

## Service Details

### Spending & Analytics

#### Tokdash (Claude)
- **Port:** 55423
- **Purpose:** Token usage dashboard
- **Data:** Monitors `~/.claude` sessions
- **Run:** `docker compose up -d tokdash-claude`

#### CodeBurn
- **Port:** 4747
- **Purpose:** Spending breakdown by task/tool/model
- **Data:** Monitors Claude, Codex, Cursor, Kimi
- **Run:** `docker compose up -d codeburn`

#### CCUsage
- **CLI Tool:** No persistent service
- **Purpose:** Token analysis and cost reports
- **Run:** `docker compose run --rm ccusage`

### Monitoring

#### Claude Dashboard
- **Ports:** 5173 (frontend), 3001 (API)
- **Purpose:** Full observability UI with agent dispatch, sessions, costs
- **Data:** Reads from `~/.claude`
- **Run:** `docker compose up -d claude-dashboard`

#### Claude Agent Monitor
- **Port:** 4820
- **Purpose:** Real-time agent activity, tool usage, WebSocket updates
- **Data:** Reads from `~/.claude`
- **Run:** `docker compose up -d claude-agent-monitor`

### Observability

#### AI Observer
- **Ports:** 8080 (UI/API), 4318 (OTLP ingestion)
- **Purpose:** Real-time observability with DuckDB backend
- **Data:** Monitors Claude Code, Gemini, Codex, Copilot, OpenCode
- **Run:** `docker compose up -d ai-observer`

### Analytics

#### Claude Transcripts
- **Port:** 8765
- **Purpose:** Generates browseable HTML transcripts of all Claude Code sessions
- **Data:** Reads from `~/.claude`, outputs to volume
- **Run:** `docker compose up -d claude-transcripts`

### Model Registry & Inference

#### GGUF + llama.cpp
- **Port:** 8000 (OpenAI-compatible API)
- **Purpose:** Local GGUF model inference with pure hardware tuning
- **Stack:** KitOps (packaging) + llama.cpp (inference)
- **Run:** `docker compose up -d gguf-llama-cpp-server`
- **Docs:** See `tools/registry/llama/README.md` for complete guide

---

## Deployment

### Local Development
```bash
docker compose up -d --build
```

### Production Recommendations
1. Use reverse proxy (nginx) for authentication
2. Bind to `127.0.0.1` only (default)
3. Set resource limits in compose file
4. Enable log rotation (configured by default)
5. Regular backups of volumes
6. Monitor resource usage: `docker stats`

### Kubernetes
Helm charts and Kustomize templates coming soon. For now, adapt compose to K8s manifests.

---

## Troubleshooting

### Service Won't Start
```bash
docker compose logs <service-name>  # Check logs
docker compose ps                   # Check status
```

### OOM Error
```bash
# Reduce resource allocation or context window
docker compose down
# Edit docker-compose.yml, then:
docker compose up -d --build
```

### Port Already in Use
```bash
lsof -i :8080  # Find what's using port
# Edit docker-compose.yml to change port
```

### GPU Not Detected (llama.cpp)
```bash
nvidia-smi                    # Verify drivers
docker run --rm --gpus all \
  nvidia/cuda:12.0.1-runtime-ubuntu22.04 nvidia-smi
# If working, uncomment N_GPU_LAYERS in docker-compose.yml
```

See individual service READMEs for detailed troubleshooting.

---

## Documentation

- **CLI.md** — Complete CLI guide and command reference ⭐ (start here!)
- **SERVICES.md** — Detailed service guide and API reference
- **DEPLOYMENT.md** — Production deployment guide
- **TROUBLESHOOTING.md** — Common issues and solutions
- **tools/registry/llama/EXECUTION_SOP.md** — GGUF deployment workflow
- **tools/registry/llama/README.md** — Model management guide
- **tools/external/chatgpt-extractor/DOCKER_SETUP.md** — ChatGPT extractor guide

---

## Contributing

All tools are independently versioned. To contribute:

1. **Fork the repo:** `github.com/poteznyKrolik/claude-ai-observatory`
2. **Create a branch:** `git checkout -b feature/your-feature`
3. **Make changes:** Update relevant tool directory
4. **Test:** `docker compose up -d --build` + verify endpoints
5. **Commit:** Follow conventional commit format
6. **Push:** `git push origin feature/your-feature`
7. **Open PR:** Describe changes and testing

---

## License

All tools are MIT licensed. See individual LICENSE files in each tool directory.

---

## Quick Links

- **GitHub:** https://github.com/poteznyKrolik/claude-ai-observatory
- **Issues:** https://github.com/poteznyKrolik/claude-ai-observatory/issues
- **Discussions:** https://github.com/poteznyKrolik/claude-ai-observatory/discussions

---

## Status

| Component | Status | Last Updated |
|-----------|--------|--------------|
| Transcripts | ✅ Stable | 2026-07-14 |
| CodeBurn | ✅ Stable | 2026-07-14 |
| CCUsage | ✅ Stable | 2026-07-14 |
| Claude Dashboard | ✅ Stable | 2026-07-14 |
| Agent Monitor | ✅ Stable | 2026-07-14 |
| AI Observer | ✅ Stable | 2026-07-14 |
| GGUF Registry | ✅ Stable | 2026-07-14 |

---

**Built for DevOps, MLOps, and AI researchers who demand complete control over their local AI infrastructure.**
