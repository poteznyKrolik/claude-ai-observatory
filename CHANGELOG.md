# Changelog

All notable changes to Claude AI Observatory are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] — 2026-07-15

### Added

#### CLI Wrapper (UV-Based)
- **observatory.py** — Standalone Python CLI script (300+ lines)
  - Typer framework for modern command interface
  - Rich terminal output (colored tables, panels)
  - Service registry with type classification
  - Health check endpoint testing
  - Docker Compose orchestration wrapper

- **install.sh** — Automated installation script
  - Detects and installs UV (Astral package manager)
  - Installs CLI dependencies
  - Creates shell alias `observatory`
  - Creates executable wrapper
  - Provides setup guidance

- **observatory** — Bash wrapper script
  - Invokes `uv run observatory.py`
  - Direct executable access to CLI

#### Documentation
- **CLI.md** — 474-line comprehensive CLI guide
  - Installation methods (quick + manual)
  - Complete command reference
  - Common workflows (analytics, monitoring, extraction)
  - Troubleshooting guide
  - Architecture overview
  - API reference

- **README.md** — Updated with CLI section
  - Quick-start guide (CLI-first approach)
  - Links to CLI.md
  - Both CLI and docker-compose examples

#### Service Management
- Service registry with 7 containerized services
  - Analytics: Transcripts, Tokdash, CodeBurn
  - Monitoring: Dashboard, Agent Monitor, AI Observer
  - Integrations: ChatGPT Extractor

- Preset groups for quick stack startup
  - `all` — all 7 services
  - `analytics` — token/spending dashboards
  - `monitoring` — observability stack
  - `transcripts` — HTML transcript generator
  - `integrations` — ChatGPT data extraction

#### Commands
- `observatory ls` — List all services
- `observatory presets` — Show available presets
- `observatory start [services]` — Start services (supports --preset and --build)
- `observatory stop [services]` — Stop services
- `observatory down [-v]` — Remove containers (--remove-volumes for data cleanup)
- `observatory status` — Docker Compose status
- `observatory logs [service]` — Show logs (supports -f for follow, --tail N)
- `observatory restart [services]` — Restart services
- `observatory endpoints [services]` — Show service endpoints
- `observatory health` — Check endpoint health status
- `observatory info <service>` — Show service details

#### ChatGPT Extractor Integration
- Docker container for conversation extraction
- Flask API wrapper (wsgi.py)
- Endpoints:
  - `POST /api/extract` — Extract conversations from JSON
  - `GET /api/extract/formats` — List supported formats
  - `GET /health` — Health check
  - `GET /api/stats` — Extraction statistics

- DOCKER_SETUP.md — Complete usage guide

#### Python Package Structure
- **pyproject.toml** — Project metadata
  - Python 3.9+ requirement
  - CLI entry point configuration
  - Dependencies: typer, rich, docker, pydantic, pyyaml, requests

- **src/observatory/** — Package modules
  - `__init__.py` — Package metadata
  - `cli.py` — CLI framework (placeholder)
  - `config.py` — Service registry configuration
  - `docker.py` — Docker Compose wrapper

### Changed
- **docker-compose.yml** — Commented out GGUF server (use separate docker-compose)
- **README.md** — Added CLI as primary method, kept docker-compose alternative

### Fixed
- Removed duplicate `volumes:` section in docker-compose.yml
- Fixed chatgpt-extractor imports and dependencies
- Corrected tokdash command flags

---

## Installation

### From GitHub

```bash
git clone https://github.com/poteznyKrolik/claude-ai-observatory.git
cd claude-ai-observatory
bash install.sh
```

### Requirements

- **Docker** (compose v2)
- **UV** (installed automatically by install.sh)
- **Python 3.9+** (handled by UV)
- **~2GB RAM** for full stack

---

## Usage Quick Reference

```bash
# Start all services
observatory start

# Start analytics stack only
observatory start --preset analytics

# Monitor services
observatory health
observatory endpoints
observatory logs -f <service>

# Stop services
observatory stop

# See CLI.md for complete reference
```

---

## Architecture

```
CLI Layer (Typer)
    ↓
Service Registry (7 services, 3 types)
    ↓
DockerCompose Wrapper
    ↓
docker-compose.yml (9 services, shared logging/volumes)
    ↓
Docker Daemon
```

---

## Services

| Service | Port | Type | Purpose |
|---------|------|------|---------|
| Claude Transcripts | 8765 | Analytics | HTML session transcripts |
| Tokdash | 55423 | Analytics | Token usage dashboard |
| CodeBurn | 4747 | Analytics | Spending breakdown |
| Claude Dashboard | 5173 | Monitoring | Observability UI |
| Agent Monitor | 4820 | Monitoring | Real-time agent tracking |
| AI Observer | 8080 | Monitoring | Observability platform |
| ChatGPT Extractor | 5000 | Integrations | Conversation extraction |

---

## File Structure

```
.
├── README.md                      # Project overview (updated)
├── CLI.md                         # CLI documentation (NEW)
├── CHANGELOG.md                   # This file (NEW)
├── SERVICES.md                    # Service reference
├── DEPLOYMENT.md                  # Production guide
├── docker-compose.yml             # Master orchestration
├── pyproject.toml                 # Python config (NEW)
├── install.sh                     # Installation script (NEW)
├── observatory                    # CLI wrapper (NEW)
├── observatory.py                 # Standalone CLI (NEW)
├── src/
│   └── observatory/               # Package (NEW)
│       ├── __init__.py
│       ├── cli.py
│       ├── config.py
│       └── docker.py
├── tools/
│   ├── transcripts/
│   ├── spending/
│   ├── monitoring/
│   ├── observability/
│   ├── registry/
│   │   └── llama/
│   └── external/
│       └── chatgpt-extractor/      # ChatGPT integration (NEW)
│           ├── Dockerfile
│           ├── wsgi.py
│           ├── DOCKER_SETUP.md
│           └── [source files]
└── .gitignore                     # Security layer
```

---

## Contributing

1. Create feature branch: `git checkout -b feature/description`
2. Make changes and test: `observatory start --build`
3. Commit: `git commit -m "feat: description"`
4. Push: `git push origin feature/description`
5. Open PR on GitHub

---

## License

MIT — See LICENSE file in project root.

---

## Contact

- **GitHub:** https://github.com/poteznyKrolik/claude-ai-observatory
- **Issues:** https://github.com/poteznyKrolik/claude-ai-observatory/issues
