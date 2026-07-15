# GGUF + llama.cpp Local Registry

**Production-grade local model management system combining KitOps (OCI model packaging) with pure llama.cpp inference (raw hardware tuning).**

No Ollama. No abstraction layers. **Raw GGUF + explicit tuning flags.**

---

## Architecture

```
┌─ ./models/
│  ├─ model.gguf               # Your GGUF-quantized model
│  └─ model_sop.md             # Operational documentation
│
├─ Kitfile                      # KitOps recipe (OCI packaging)
├─ docker-compose.yml          # Multi-service orchestration
├─ EXECUTION_SOP.md            # Step-by-step deployment guide
└─ README.md                    # This file
```

---

## What's Included

### 1. **Kitfile** — OCI Model Registry

Packages your GGUF model + documentation into an OCI-compliant artifact:

```bash
kit pack -f Kitfile --output modelkit.tar
kit push modelkit.tar:latest <registry>/llama-models:latest
```

**Features:**
- Version control for models
- Push to any OCI registry (Docker Hub, GitHub Container Registry, local Kubernetes)
- Portable: reproducible deployments across environments
- Bundles documentation (SOP) with model

### 2. **Model SOP** — Operational Handbook

`./models/model_sop.md` documents:

- Model metadata (source, license, quantization type)
- Recommended tuning (context size, temperature, thread count)
- Known constraints (OOM risks, GPU requirements)
- Performance metrics (latency, tokens/sec)
- Troubleshooting guide

**Update this with your specific model's details.**

### 3. **docker-compose.yml** — Orchestration + Raw Tuning

Two services:

#### KitOps Builder Service
```yaml
kitops:
  image: ghcr.io/jozu/kitops:latest
  # Builds ModelKit from Kitfile
  # Standalone: docker compose run kitops kit pack -f Kitfile
```

#### llama.cpp Server
```yaml
llama-cpp-server:
  image: ghcr.io/ggerganov/llama.cpp:server
  # Pure llama.cpp inference with explicit hardware flags:
  #   - N_CTX: Context window size (2048, 4096, 8192)
  #   - N_BATCH: Batch size for inference (128-2048)
  #   - N_THREADS: CPU thread count
  #   - N_GPU_LAYERS: GPU layer offloading (CUDA)
  #   - GGML_METAL: Apple Metal GPU acceleration
  #   - TEMPERATURE, TOP_P, TOP_K: Sampling parameters
```

**All flags are environment variables — full control, no abstraction.**

---

## Quick Start

### 1. Place Your Model

```bash
cd /Users/marty/tools/claude-generated/gguf-llama-hub

# Download a GGUF model to ./models/
# Example: Mistral 7B Q4_K_M (4.6 GB)
wget -O models/mistral-7b-q4_k_m.gguf \
  https://huggingface.co/TheBloke/Mistral-7B-Instruct-v0.2-GGUF/resolve/main/Mistral-7B-Instruct-v0.2.Q4_K_M.gguf
```

### 2. Update Configuration

Edit `docker-compose.yml`:

```yaml
environment:
  MODEL: /models/mistral-7b-q4_k_m.gguf  # ← Your model filename
  N_CTX: "2048"                           # ← Adjust to your needs
  N_BATCH: "512"                          # ← Batch size
  N_THREADS: "0"                          # ← Auto-detect CPUs
  # N_GPU_LAYERS: "33"                   # ← Uncomment for GPU
```

### 3. Build ModelKit (Optional but Recommended)

```bash
docker compose run --rm kitops kit pack -f Kitfile --output modelkit.tar
```

### 4. Start Server

```bash
docker compose up -d llama-cpp-server

# Watch startup logs
docker compose logs -f llama-cpp-server

# Check health
curl http://127.0.0.1:8000/health
```

### 5. Send Inference Request

```bash
curl http://127.0.0.1:8000/v1/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "model",
    "prompt": "[INST] Hello, world! [/INST]",
    "temperature": 0.7,
    "n_predict": 128
  }' | jq .
```

---

## Hardware Tuning Reference

### CPU Optimization

```yaml
N_THREADS: "0"           # Auto-detect (recommended)
N_THREADS: "8"           # Explicit: 8 threads
N_BATCH: "512"           # Default batch
N_BATCH: "1024"          # Larger batch = higher throughput
N_CTX: "4096"            # Increase context at cost of RAM
```

### GPU Acceleration (NVIDIA CUDA)

```yaml
N_GPU_LAYERS: "0"        # CPU-only (default)
N_GPU_LAYERS: "10"       # Partial offload (10 layers)
N_GPU_LAYERS: "33"       # Full offload (all 33 layers)
```

Requires:
- NVIDIA GPU
- NVIDIA drivers (`nvidia-smi` shows GPU)
- Docker GPU runtime enabled
- Uncomment `runtime: nvidia` in compose file

### GPU Acceleration (macOS Metal)

```yaml
GGML_METAL: "1"
```

Works on:
- Apple Silicon (M1/M2/M3/M4)
- Intel Mac with Metal support

### Memory Optimization

```yaml
N_CTX: "1024"            # Reduce context to save RAM
N_BATCH: "256"           # Smaller batch
GGML_LOCK_RAM: "1"       # Pin model to RAM (avoid swap)
```

### Latency vs Throughput Trade-off

**Low Latency (interactive):**
```yaml
N_BATCH: "128"
N_THREADS: "4"
N_PREDICT: "64"
N_CTX: "1024"
```

**High Throughput (batch):**
```yaml
N_BATCH: "1024"
N_THREADS: "0"
N_PREDICT: "512"
N_CTX: "2048"
PARALLELS: "4"
```

---

## Complete Deployment Workflow

See **`EXECUTION_SOP.md`** for detailed step-by-step instructions:

1. **Phase 1:** Setup & download model
2. **Phase 2:** Build & package ModelKit (KitOps)
3. **Phase 3:** Deploy & verify llama.cpp server
4. **Phase 4:** Advanced tuning (GPU, latency/throughput)
5. **Phase 5:** Production hardening (auth, monitoring)
6. **Phase 6:** Troubleshooting
7. **Phase 7:** Cleanup & automation

---

## Model Registry Integration

### Push to Registry

```bash
# Local registry
docker compose run --rm kitops kit push modelkit.tar:latest \
  localhost:5000/llama-models:latest

# GitHub Container Registry
docker compose run --rm kitops kit push modelkit.tar:latest \
  ghcr.io/username/llama-models:latest

# HuggingFace Hub
docker compose run --rm kitops kit push modelkit.tar:latest \
  huggingface.co/username/llama-models:latest
```

### Pull from Registry

```bash
# Unpack ModelKit from registry
docker compose run --rm kitops kit unpack \
  ghcr.io/username/llama-models:latest ./models/
```

---

## API Reference

### OpenAI-Compatible Endpoints

**Completions:**
```bash
POST /v1/completions
{
  "model": "model",
  "prompt": "...",
  "temperature": 0.7,
  "top_p": 0.9,
  "n_predict": 128
}
```

**Chat:**
```bash
POST /v1/chat/completions
{
  "model": "model",
  "messages": [
    {"role": "user", "content": "Hello!"}
  ]
}
```

**Health:**
```bash
GET /health
```

---

## Docker Compose Commands

```bash
# Start all services
docker compose up -d

# Start only server (skip KitOps builder)
docker compose up -d llama-cpp-server

# View logs
docker compose logs -f llama-cpp-server

# Check status
docker compose ps

# Stop all
docker compose down

# View resource usage
docker stats llama-cpp-server

# Execute command in running container
docker compose exec llama-cpp-server ls -la /models/

# Rebuild image
docker compose up -d --build llama-cpp-server
```

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Model won't load | Verify `./models/*.gguf` exists and matches `MODEL` env var in compose |
| OOM error | Reduce `N_CTX` (2048→1024), `N_BATCH` (512→256), or disable GPU |
| Slow inference | Increase `N_THREADS` (if CPU-bound), enable GPU (`N_GPU_LAYERS: 33`), or increase `N_BATCH` |
| GPU not detected | Check `nvidia-smi`, enable `runtime: nvidia`, verify CUDA compute capability ≥ 5.2 |
| Port already in use | Change `ports: - "127.0.0.1:8001:8000"` to different port |

See `EXECUTION_SOP.md` for detailed troubleshooting.

---

## Files

| File | Purpose |
|------|---------|
| `Kitfile` | KitOps OCI recipe; packages model + SOP into ModelKit artifact |
| `models/model_sop.md` | Model documentation: specs, tuning, constraints, metrics |
| `docker-compose.yml` | Multi-service orchestration: KitOps builder + llama.cpp server |
| `EXECUTION_SOP.md` | Complete deployment workflow: 7 phases, automation, API reference |
| `README.md` | This file |

---

## Success Criteria

✅ Model loads without error  
✅ Server responds to `/health` endpoint  
✅ Inference returns valid completions  
✅ Tuning flags take effect (measure latency/throughput)  
✅ ModelKit packaged and versioned  
✅ GPU offloading working (if applicable)  

---

## Next Steps

1. **Place your model** in `./models/`
2. **Update `model_sop.md`** with metadata
3. **Edit `docker-compose.yml`** to match your hardware
4. **Follow `EXECUTION_SOP.md`** Phase by phase
5. **Push ModelKit** to your OCI registry
6. **Deploy** to production with version control

---

## References

- **llama.cpp**: https://github.com/ggerganov/llama.cpp
- **KitOps**: https://kitops.ml
- **GGUF Format**: https://github.com/ggerganov/ggml/blob/master/docs/gguf.md
- **OpenAI API Compatibility**: https://github.com/ggerganov/llama.cpp/tree/master/examples/server

