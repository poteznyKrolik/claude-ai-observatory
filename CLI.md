# Claude Observatory CLI

**Complete observability suite orchestration for Claude Code and LLM inference.**

The `observatory` CLI provides a unified interface to manage all 7+ services in the Claude AI Observatory monorepo. Built with [UV](https://astral.sh/uv/) for zero-dependency Python dependency management and [Typer](https://typer.tiangolo.com/) for a modern CLI experience.

---

## Installation

### Quick Start (One Command)

```bash
cd /Users/marty/tools/claude-generated/claude-ai-observatory
bash install.sh
```

The script:
- ✅ Installs UV (if needed)
- ✅ Installs CLI dependencies (typer, rich, docker, pydantic)
- ✅ Creates shell alias `observatory`
- ✅ Creates executable `./observatory` wrapper

Then use immediately:

```bash
observatory --help
observatory ls
observatory start --preset analytics
```

### Manual Installation

```bash
# Install UV (once)
curl -LsSf https://astral.sh/uv/install.sh | sh

# Install dependencies in observatory project
uv pip install typer rich docker pydantic pyyaml requests

# Run CLI directly
uv run observatory.py ls
```

---

## Usage

### List All Services

```bash
observatory ls
```

Shows all 7+ services with container name, type, port, and description.

**Output:**
```
                      Claude Observatory Services                           
┏━━━━━━━━━━━━━━━┳━━━━━━━━━━━━━━━━━━━┳━━━━━━━━━━━━━━┳━━━━━━━┳━━━━━━━━━━━━━━━━━━━┓
┃ Name          ┃ Container         ┃ Type         ┃ Port  ┃ Description       ┃
├───────────────┼───────────────────┼──────────────┼───────┼───────────────────┤
│ transcripts   │ claude-transcrip… │ analytics    │ 8765  │ HTML transcript   │
│ tokdash       │ tokdash-claude    │ analytics    │ 55423 │ Token usage dash  │
│ codeburn      │ codeburn          │ analytics    │ 4747  │ Spending breakdn  │
│ dashboard     │ claude-dashboard  │ monitoring   │ 5173  │ Full observ UI    │
│ agent-monitor │ claude-agent-mon… │ monitoring   │ 4820  │ Real-time track   │
│ observer      │ ai-observer       │ monitoring   │ 8080  │ Observ platform   │
│ chatgpt       │ chatgpt-extractor │ integrations │ 5000  │ ChatGPT extract   │
└───────────────┴───────────────────┴──────────────┴───────┴───────────────────┘
```

### Show Available Presets

```bash
observatory presets
```

**Output:**
```
                         🎯 Available Presets                         
┏━━━━━━━━━━━━━━┳━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
┃ Preset       ┃ Services                                              ┃
├──────────────┼───────────────────────────────────────────────────────┤
│ all          │ transcripts, codeburn, tokdash, dashboard, ...        │
│ analytics    │ transcripts, codeburn, tokdash                        │
│ monitoring   │ dashboard, agent-monitor, observer                    │
│ transcripts  │ transcripts                                           │
│ integrations │ chatgpt                                               │
└──────────────┴───────────────────────────────────────────────────────┘
```

### Start Services

```bash
# Start all services
observatory start

# Start with rebuild
observatory start --build

# Start specific services
observatory start transcripts tokdash

# Start preset group
observatory start --preset analytics
observatory start --preset monitoring
observatory start --preset integrations
```

### Stop Services

```bash
# Stop all services
observatory stop

# Stop specific services
observatory stop dashboard agent-monitor
```

### Check Status

```bash
observatory status
```

Shows Docker Compose status for all containers.

### View Logs

```bash
# Show last 100 lines
observatory logs transcripts

# Follow logs in real-time
observatory logs -f tokdash

# Custom tail size
observatory logs --tail 50 chatgpt
```

### Show Service Endpoints

```bash
# Show all endpoints
observatory endpoints

# Show specific services
observatory endpoints chatgpt tokdash dashboard
```

**Output:**
```
                      📊 Service Endpoints                      
┏━━━━━━━━━━━━━━━━━━━┳━━━━━━━━━━━━━━━━━━━━━━━━┳━━━━━━━━━━━━━━┓
┃ Service           ┃ Endpoint               ┃ Type         ┃
├───────────────────┼────────────────────────┼──────────────┤
│ Claude Dashboard  │ http://127.0.0.1:5173  │ monitoring   │
│ ChatGPT Extractor │ http://127.0.0.1:5000  │ integrations │
│ Tokdash           │ http://127.0.0.1:55423 │ analytics    │
└───────────────────┴────────────────────────┴──────────────┘
```

### Check Service Health

```bash
observatory health
```

Tests `/health` endpoints and shows status:
- ✅ = healthy (200)
- ❌ = unhealthy (non-200)
- ⚠️ = unreachable/timeout

### Get Service Details

```bash
observatory info transcripts
```

Shows detailed info: container name, port, endpoint, description, dependencies, mounts.

### Restart Services

```bash
# Restart all
observatory restart

# Restart specific services
observatory restart codeburn observer
```

### Stop and Remove (Down)

```bash
# Remove containers (keep volumes)
observatory down

# Remove containers AND volumes
observatory down -v
```

---

## Service Groups

### Analytics (Spending & Tokens)

```bash
observatory start --preset analytics
```

Services:
- **Transcripts** (8765) — HTML transcript generator for sessions
- **Tokdash** (55423) — Token usage dashboard (Claude-only)
- **CodeBurn** (4747) — Spending breakdown by task/tool/model

### Monitoring (Observability)

```bash
observatory start --preset monitoring
```

Services:
- **Claude Dashboard** (5173) — Full observability UI
- **Agent Monitor** (4820) — Real-time agent tracking
- **AI Observer** (8080) — Real-time observability platform (Go + DuckDB)

### Integrations

```bash
observatory start --preset integrations
```

Services:
- **ChatGPT Extractor** (5000) — Extract ChatGPT conversations

### All Services

```bash
observatory start --preset all
observatory start  # (same)
```

---

## Common Workflows

### 1. Start Analytics Stack Only

```bash
observatory start --preset analytics
# Open http://127.0.0.1:8765  (Transcripts)
# Open http://127.0.0.1:55423 (Tokdash)
# Open http://127.0.0.1:4747  (CodeBurn)
```

### 2. Monitor Agent Activity

```bash
observatory start --preset monitoring
# Open http://127.0.0.1:5173  (Dashboard)
# Open http://127.0.0.1:4820  (Agent Monitor)
```

### 3. Extract ChatGPT Data

```bash
observatory start chatgpt
curl -X POST http://127.0.0.1:5000/api/extract \
  -F "file=@conversations.json"
```

### 4. Follow Real-Time Logs

```bash
# Monitor one service
observatory logs -f dashboard

# In another terminal, start services
observatory start --preset monitoring
```

### 5. Check Health of Specific Services

```bash
observatory health  # All services

# Manual test specific endpoint
curl http://127.0.0.1:8765/health  # Transcripts
curl http://127.0.0.1:5000/health  # ChatGPT Extractor
```

### 6. Clean Up and Start Fresh

```bash
# Stop and remove all data
observatory down -v

# Start from scratch
observatory start --build
```

---

## Environment Variables

The CLI respects Docker Compose environment variables:

```bash
# Set custom project directory (if not in observatory root)
COMPOSE_PROJECT_NAME=observatory observatory status

# Use custom compose file
COMPOSE_FILE=docker-compose.yml observatory ls
```

---

## Troubleshooting

### Command Not Found

```bash
# Make sure observatory is in PATH
export PATH="/Users/marty/tools/claude-generated/claude-ai-observatory:$PATH"

# Or use full path
/Users/marty/tools/claude-generated/claude-ai-observatory/observatory ls

# Or use UV directly
uv run /path/to/observatory.py ls
```

### Permission Denied

```bash
# Make scripts executable
chmod +x /Users/marty/tools/claude-generated/claude-ai-observatory/observatory
chmod +x /Users/marty/tools/claude-generated/claude-ai-observatory/observatory.py
chmod +x /Users/marty/tools/claude-generated/claude-ai-observatory/install.sh
```

### Services Won't Start

```bash
# Check logs
observatory logs <service>

# Rebuild images
observatory start --build

# Remove old images
docker compose -f docker-compose.yml down -v
observatory start --build
```

### Docker Not Found

```bash
# Install Docker Desktop or Docker CLI
# https://www.docker.com/products/docker-desktop

# Test Docker
docker --version
docker ps
```

### UV Not Found

```bash
# Install UV
curl -LsSf https://astral.sh/uv/install.sh | sh

# Add to PATH
export PATH="$HOME/.cargo/bin:$PATH"
```

---

## Architecture

### CLI Stack

```
observatory (shell wrapper)
    ↓
uv run observatory.py
    ↓
[Typer CLI Framework]
    ├── start/stop/restart
    ├── logs/status
    ├── health/endpoints
    └── info/ls/presets
    ↓
[DockerCompose Wrapper]
    ├── docker compose up -d
    ├── docker compose logs
    ├── docker compose ps
    └── docker compose down
    ↓
Docker Daemon ← docker-compose.yml
```

### Service Dependencies

```
All Services → docker-compose.yml (master orchestration)
    ├── [Shared Volumes]
    │   ├── claude-transcripts-output
    │   ├── tokdash-claude-data
    │   ├── codeburn-data
    │   ├── ai-observer-data
    │   └── chatgpt-extractor-{input,output}
    │
    ├── [Shared Logging]
    │   └── json-file driver (10m max-size, 3 files)
    │
    └── [Shared Network]
        └── 127.0.0.1 (localhost only)
```

---

## API Reference

### CLI Commands

| Command | Arguments | Options | Purpose |
|---------|-----------|---------|---------|
| `ls` | — | — | List all services |
| `presets` | — | — | Show available presets |
| `start` | `[services]` | `--preset`, `--build` | Start services |
| `stop` | `[services]` | — | Stop services |
| `restart` | `[services]` | — | Restart services |
| `down` | — | `-v`, `--remove-volumes` | Remove containers |
| `status` | — | — | Show Docker Compose status |
| `logs` | `[service]` | `-f`, `--tail` | Show logs |
| `endpoints` | `[services]` | — | Show service endpoints |
| `health` | — | — | Check service health |
| `info` | `service` | — | Show service details |

---

## Contributing

The CLI is defined in:
- **CLI Logic:** `observatory.py` (standalone script)
- **Config:** `src/observatory/config.py` (service registry)
- **Docker:** `src/observatory/docker.py` (wrapper)
- **Installation:** `install.sh` (UV setup)

To add a new service:

1. Add to `SERVICES` dict in `observatory.py`
2. Add to appropriate `PRESETS` group
3. Ensure `docker-compose.yml` has corresponding service
4. Test: `observatory ls` and `observatory info <service>`

---

## License

MIT — See LICENSE file in project root.

---

## Quick Links

- **GitHub:** https://github.com/poteznyKrolik/claude-ai-observatory
- **Issues:** https://github.com/poteznyKrolik/claude-ai-observatory/issues
- **Services.md:** Detailed service guide and API reference
- **README.md:** Project overview

