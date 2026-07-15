# Claude AI Observatory — Service Reference

Complete guide to all services, endpoints, and configuration.

---

## Service Lineup

### Spending & Analytics (Tokens, Costs)

#### 1. Tokdash (Claude)
**Port:** 55423  
**URL:** http://127.0.0.1:55423  
**Purpose:** Token usage dashboard for Claude Code sessions  
**Data Source:** `~/.claude` (read-only)  
**Tech:** Python/FastAPI  
**Command:** `docker compose up -d tokdash-claude`

**Features:**
- Real-time token count aggregation
- Cost breakdown by session
- Historical usage trends
- Single-agent focus (Claude only)

**Environment:**
- `TOKDASH_USAGE_DB_PATH=/data/usage.db`

---

#### 2. CodeBurn
**Port:** 4747  
**URL:** http://127.0.0.1:4747  
**Purpose:** Interactive spending dashboard by task/tool/model  
**Data Source:** Claude, Codex, Cursor, Kimi (read-only)  
**Tech:** TypeScript/Node.js  
**Command:** `docker compose up -d codeburn`

**Features:**
- Multi-agent spending breakdown
- Task-level cost attribution
- Model comparison
- Web interface (Vite + React)

**Keyboard Navigation:**
- Arrow keys: navigate
- `q`: quit
- Type to filter

---

#### 3. CCUsage (CLI)
**Purpose:** Command-line token analyzer  
**Tech:** Node.js/JavaScript  
**Command:** `docker compose run --rm ccusage`

**Features:**
- CLI cost reports
- Daily summaries
- Detailed token breakdowns
- No persistent service

**Usage:**
```bash
docker compose run --rm ccusage          # Daily summary
docker compose run --rm ccusage report   # Detailed report
docker compose run --rm ccusage month    # Monthly view
```

---

### Monitoring & Observability

#### 4. Claude Dashboard
**Ports:** 5173 (frontend), 3001 (API)  
**URL:** http://127.0.0.1:5173  
**Purpose:** Full observability UI with agent dispatch, sessions, token costs, hooks  
**Data Source:** `~/.claude` (read-only)  
**Tech:** React 19 + Express 5 + TypeScript + SQLite  
**Command:** `docker compose up -d claude-dashboard`

**Features:**
- Agent dispatch history
- Session activity timeline
- Real-time token costs
- Hook status monitoring
- System health metrics

**Endpoints:**
- `GET /` — Dashboard UI
- `GET /api/sessions` — List sessions
- `GET /api/costs` — Cost metrics
- `GET /api/health` — Health check

---

#### 5. Claude Agent Monitor
**Port:** 4820  
**URL:** http://127.0.0.1:4820  
**Purpose:** Real-time agent activity tracking with WebSocket updates  
**Data Source:** `~/.claude` (read-only)  
**Tech:** Node.js + Express + SQLite + WebSocket  
**Command:** `docker compose up -d claude-agent-monitor`

**Features:**
- Real-time agent dispatch
- Tool usage metrics
- Subagent orchestration tracking
- Live WebSocket updates
- OpenAPI/Swagger endpoints at `/api/docs`

**API:**
```bash
GET /api/sessions                    # Active sessions
GET /api/tools                       # Tool usage
POST /v1/completions               # OpenAI-compatible API
GET /metrics                        # Prometheus metrics
```

---

#### 6. AI Observer
**Ports:** 8080 (UI/API), 4318 (OTLP ingestion)  
**URL:** http://127.0.0.1:8080  
**Purpose:** Self-hosted observability platform for AI assistants  
**Data Source:** Claude, Codex, Gemini, Copilot, OpenCode  
**Tech:** Go + DuckDB + React (embedded)  
**Command:** `docker compose up -d ai-observer`

**Features:**
- Token usage and cost tracking
- API latency metrics
- Error rate monitoring
- Session activity timeline
- OTLP ingestion endpoint (real-time telemetry)
- Zero external dependencies (local DuckDB)

**Endpoints:**
```bash
GET http://127.0.0.1:8080          # Dashboard
POST http://127.0.0.1:4318/v1/traces  # OTLP traces
GET http://127.0.0.1:8080/api/...     # REST API
```

---

### Analytics

#### 7. Claude Transcripts
**Port:** 8765  
**URL:** http://127.0.0.1:8765  
**Purpose:** Generates browseable HTML transcripts of all Claude Code sessions  
**Data Source:** `~/.claude` (read-only)  
**Tech:** Python/FastAPI + HTTP server  
**Command:** `docker compose up -d claude-transcripts`

**Features:**
- Auto-generates HTML pages from session files
- Full-text search
- Timeline view
- Mobile-responsive
- Paginated transcripts (page-001.html, page-002.html, ...)

**API:**
```bash
GET http://127.0.0.1:8765         # Browse archive
```

**Output Location:** `/output` volume (Docker)

---

### Model Registry & Inference

#### 8. GGUF + llama.cpp Server
**Port:** 8000  
**URL:** http://127.0.0.1:8000  
**Purpose:** Local GGUF model inference with pure hardware tuning  
**Tech:** llama.cpp (C++) + KitOps packaging  
**Command:** `docker compose up -d gguf-llama-cpp-server`

**Features:**
- OpenAI-compatible API
- Full hardware control (CPU threads, GPU offloading, batch size)
- GGUF model loading
- KitOps model packaging (OCI registry)
- Health checks

**Endpoints:**
```bash
POST /v1/completions               # Text completion
POST /v1/chat/completions          # Chat completion
GET /health                        # Health check
GET /props                         # Model properties
GET /metrics                       # Prometheus metrics (if enabled)
```

**OpenAI-Compatible Request:**
```bash
curl http://127.0.0.1:8000/v1/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "model",
    "prompt": "[INST] Your prompt [/INST]",
    "temperature": 0.7,
    "top_p": 0.9,
    "n_predict": 128
  }'
```

**Configuration (docker-compose.yml):**
```yaml
environment:
  MODEL: /models/model.gguf         # GGUF file path
  N_CTX: "2048"                     # Context window
  N_BATCH: "512"                    # Batch size
  N_THREADS: "0"                    # Auto-detect CPUs
  N_GPU_LAYERS: "33"                # GPU offloading (0-33)
  TEMPERATURE: "0.7"                # Sampling temperature
  TOP_K: "40"                       # Top-K sampling
  TOP_P: "0.9"                      # Nucleus sampling
```

**For GPU (NVIDIA CUDA):**
```yaml
N_GPU_LAYERS: "33"
runtime: nvidia
```

**For GPU (Apple Metal):**
```yaml
GGML_METAL: "1"
```

---

## Composite Commands

### Start Everything
```bash
docker compose up -d --build
```

### Start Only Spending Stack
```bash
docker compose up -d tokdash-claude codeburn claude-transcripts
```

### Start Only Monitoring Stack
```bash
docker compose up -d claude-dashboard claude-agent-monitor ai-observer
```

### Start Only Model Server
```bash
docker compose up -d gguf-llama-cpp-server
```

### Health Check (All)
```bash
curl http://127.0.0.1:8765 &
curl http://127.0.0.1:4747 &
curl http://127.0.0.1:5173 &
curl http://127.0.0.1:4820 &
curl http://127.0.0.1:8080 &
curl http://127.0.0.1:55423 &
curl http://127.0.0.1:8000/health &
```

---

## Data Flow

```
Claude Code Sessions
      ↓
    ~/.claude/
      ↓
   ┌─────────────────────────────────────────┐
   │  Docker Volumes (RO mounts)             │
   │ ├─ tokdash-claude (token tracking)     │
   │ ├─ codeburn (spending analysis)        │
   │ ├─ claude-dashboard (observability)    │
   │ ├─ claude-agent-monitor (activity)     │
   │ ├─ ai-observer (telemetry)             │
   │ ├─ claude-transcripts (archive)        │
   │ └─ gguf-llama-cpp (inference)          │
   └─────────────────────────────────────────┘
      ↓
    Web UIs & APIs
```

---

## Performance Notes

| Service | Memory | CPU | GPU | Notes |
|---------|--------|-----|-----|-------|
| Tokdash | 512MB | 1 core | — | Lightweight |
| CodeBurn | 1GB | 2 cores | — | Builds on startup |
| Claude Dashboard | 2GB | 2 cores | — | Full-stack (React+Express) |
| Claude Agent Monitor | 1GB | 2 cores | — | WebSocket overhead |
| AI Observer | 2GB | 2 cores | — | DuckDB analysis |
| Transcripts | 512MB | 1 core | — | Batch generator |
| llama.cpp | 8–16GB | 4–8 cores | Optional | Depends on model size |

**Total (All Services):** ~15–20GB RAM, 4–8 CPU cores recommended

---

## Environment Variables Reference

### Tokdash
- `TOKDASH_USAGE_DB_PATH` — Database file path

### CodeBurn
- None (reads from mounted directories)

### Claude Dashboard
- `NODE_ENV` — production/development
- `VITE_API_URL` — API base URL

### Claude Agent Monitor
- `NODE_ENV` — production/development
- `CLAUDE_HOME` — Claude directory path
- `DASHBOARD_HOST` — Bind address
- `DASHBOARD_PORT` — Listen port

### AI Observer
- `AI_OBSERVER_DATABASE_PATH` — DuckDB file path
- `AI_OBSERVER_API_PORT` — API port (8080)
- `AI_OBSERVER_OTLP_PORT` — OTLP port (4318)
- `AI_OBSERVER_LOG_LEVEL` — DEBUG/INFO/WARN/ERROR
- `AI_OBSERVER_CLAUDE_PATH` — Claude directory path

### Transcripts
- None (uses mounted directories)

### llama.cpp
- `MODEL` — GGUF file path
- `N_CTX` — Context window (2048)
- `N_BATCH` — Batch size (512)
- `N_THREADS` — CPU threads (0 = auto)
- `N_GPU_LAYERS` — GPU offload count (0 = CPU only)
- `TEMPERATURE` — Sampling temperature (0.7)
- `TOP_K` — Top-K sampling (40)
- `TOP_P` — Nucleus sampling (0.9)
- `DTYPE` — f32/f16/q8
- `HOST` — Bind address (0.0.0.0)
- `PORT` — Listen port (8000)
- `GGML_METAL` — Enable Metal GPU (macOS)

