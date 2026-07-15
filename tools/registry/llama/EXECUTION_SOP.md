# Execution Standard Operating Procedure

## Complete Workflow: Model Registry → Deployment → Inference

---

## Phase 1: Setup & Prerequisites

### 1.1 Install Dependencies

```bash
# Docker & Docker Compose (required)
docker --version          # Should be 20.10+
docker compose version    # Should be 2.0+

# KitOps CLI (for manual ModelKit operations)
# https://kitops.ml/docs/install
curl -fsSL https://get.kitops.ml | sh

# Verify installation
kit version
```

### 1.2 Obtain a GGUF Model

Download a GGUF-quantized model and place it in `./models/`:

```bash
# Example: Download a Mistral 7B Q4_K_M from HuggingFace
cd /Users/marty/tools/claude-generated/gguf-llama-hub

# Using wget/curl
wget -O models/mistral-7b-instruct-q4_k_m.gguf \
  https://huggingface.co/TheBloke/Mistral-7B-Instruct-v0.2-GGUF/resolve/main/Mistral-7B-Instruct-v0.2.Q4_K_M.gguf

# Or using Hugging Face CLI
huggingface-cli download TheBloke/Mistral-7B-Instruct-v0.2-GGUF \
  Mistral-7B-Instruct-v0.2.Q4_K_M.gguf \
  --local-dir ./models --local-dir-use-symlinks False
```

### 1.3 Update Model Reference

Edit `docker-compose.yml` to point to your actual model filename:

```yaml
environment:
  MODEL: /models/mistral-7b-instruct-q4_k_m.gguf  # Update this
```

### 1.4 Update Model SOP

Edit `./models/model_sop.md` with your model's metadata:

```markdown
- **Model Name:** `mistral-7b-instruct-v0.2-q4_k_m`
- **Source Repository:** `https://huggingface.co/TheBloke/Mistral-7B-Instruct-v0.2-GGUF`
- **File Size:** `4.6 GB`
- **License Type:** `Apache 2.0`
```

---

## Phase 2: Build & Package ModelKit

### 2.1 Build the ModelKit (OCI Artifact)

```bash
cd /Users/marty/tools/claude-generated/gguf-llama-hub

# Run the KitOps builder service (builds ModelKit from Kitfile)
docker compose run --rm kitops kit pack -f Kitfile --output modelkit.tar

# Expected output:
# ==> Packed modelkit.tar (contains model + SOP + config reference)
```

### 2.2 Verify ModelKit Contents

```bash
# List contents of the packed ModelKit
docker compose run --rm kitops tar -tzf modelkit.tar | head -20

# Expected:
# models/mistral-7b-instruct-q4_k_m.gguf
# models/model_sop.md
# docker-compose.reference.yml
# EXECUTION_SOP.md
```

### 2.3 Tag & Push to Registry (Optional)

Push to a local or remote OCI registry:

```bash
# Tag the ModelKit
docker compose run --rm kitops kit tag modelkit.tar:latest \
  localhost:5000/llama-models:mistral-7b-q4-v1

# Push to local registry (requires registry service running)
docker compose run --rm kitops kit push \
  localhost:5000/llama-models:mistral-7b-q4-v1

# Or push to HuggingFace/GitHub Container Registry
# kit push modelkit.tar:latest ghcr.io/username/llama-models:latest
```

---

## Phase 3: Deploy & Run llama.cpp Server

### 3.1 Start the Server

```bash
# Start llama.cpp server with Docker Compose
cd /Users/marty/tools/claude-generated/gguf-llama-hub

docker compose up -d llama-cpp-server

# Follow logs in real-time
docker compose logs -f llama-cpp-server

# Expected startup log:
# Loading model: /models/mistral-7b-instruct-q4_k_m.gguf
# [1/X] Loading model...
# llama server listening on http://0.0.0.0:8000
```

### 3.2 Verify Server Health

```bash
# Check server health
curl -s http://127.0.0.1:8000/health | jq .

# Expected response:
# {
#   "status": "ok"
# }

# Check Docker container status
docker compose ps

# Expected:
# llama-cpp-server   Up ... (healthy)
```

### 3.3 Test the API (OpenAI-compatible)

```bash
# Send a test completion request
curl http://127.0.0.1:8000/v1/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "model",
    "prompt": "[INST] What is the capital of France? [/INST]",
    "temperature": 0.7,
    "n_predict": 128
  }' | jq .

# Expected response includes:
# {
#   "choices": [
#     {
#       "text": "The capital of France is Paris. It is ..."
#     }
#   ]
# }
```

---

## Phase 4: Advanced Tuning & Optimization

### 4.1 Enable GPU Acceleration (NVIDIA CUDA)

Edit `docker-compose.yml` under `llama-cpp-server`:

```yaml
environment:
  N_GPU_LAYERS: "33"  # Offload all layers to GPU
  CUDA_VISIBLE_DEVICES: "0"  # Use GPU 0

# Uncomment the runtime section:
runtime: nvidia
deploy:
  resources:
    reservations:
      devices:
        - driver: nvidia
          count: 1
          capabilities: [gpu]
```

Verify NVIDIA support:

```bash
# Check Docker GPU access
docker run --rm --gpus all nvidia/cuda:12.0.1-runtime-ubuntu22.04 nvidia-smi

# Restart server
docker compose restart llama-cpp-server

# Verify GPU offloading in logs
docker compose logs llama-cpp-server | grep -i "gpu\|cuda"
```

### 4.2 Enable Apple Metal GPU (macOS)

Edit `docker-compose.yml`:

```yaml
environment:
  GGML_METAL: "1"  # Enable Metal GPU acceleration
```

Restart:

```bash
docker compose restart llama-cpp-server
```

### 4.3 Tune for Latency vs Throughput

**For low latency (interactive use):**

```yaml
environment:
  N_BATCH: "128"      # Smaller batch → lower latency
  N_THREADS: "4"      # Fewer threads
  N_PREDICT: "64"     # Shorter predictions
```

**For throughput (batch processing):**

```yaml
environment:
  N_BATCH: "1024"     # Larger batch → more throughput
  N_THREADS: "0"      # Auto-detect, use all cores
  N_PREDICT: "512"    # Longer predictions
  PARALLELS: "4"      # Handle multiple requests
```

### 4.4 Monitor Performance

```bash
# Real-time resource usage
docker stats llama-cpp-server

# Detailed server metrics (if exposed)
curl http://127.0.0.1:8000/metrics 2>/dev/null | head -20
```

---

## Phase 5: Production Hardening

### 5.1 Restrict Network Access

Edit `docker-compose.yml`:

```yaml
ports:
  - "127.0.0.1:8000:8000"  # Localhost only (already set)
```

Access from external hosts via reverse proxy only:

```bash
# Example: Using SSH tunnel for remote access
ssh -L 8000:127.0.0.1:8000 user@remote-host

# Then access locally as http://127.0.0.1:8000
```

### 5.2 Add API Authentication

Wrap llama.cpp with a reverse proxy (nginx) + auth:

```bash
# Example: Using docker-compose with nginx sidecar
# (Implementation left as exercise; see nginx auth docs)
```

### 5.3 Persistent Logs & Monitoring

```bash
# View persistent logs
docker compose logs llama-cpp-server --tail 100

# Export logs to file
docker compose logs llama-cpp-server > deployment.log

# Setup log rotation (already configured in compose)
docker compose logs --tail 1 llama-cpp-server  # Recent only
```

---

## Phase 6: Troubleshooting

### Model Won't Load

```bash
# Verify file exists and is readable
ls -lh ./models/*.gguf

# Check inside container
docker compose exec llama-cpp-server ls -la /models/

# Verify GGUF format
file ./models/model.gguf
# Should output: ... GGUF ...
```

### OOM (Out of Memory)

```bash
# Reduce context window
docker compose down
# Edit docker-compose.yml:
#   N_CTX: "1024"  (from 2048)
docker compose up -d llama-cpp-server

# Or reduce batch size
#   N_BATCH: "256"  (from 512)
```

### GPU Not Detected

```bash
# Verify NVIDIA drivers
nvidia-smi

# Check Docker GPU support
docker run --rm --gpus all nvidia/cuda:12.0.1-runtime-ubuntu22.04 nvidia-smi

# If GPU still not detected, check logs
docker compose logs llama-cpp-server | grep -i "gpu\|cuda\|metal"

# Fall back to CPU (remove N_GPU_LAYERS or set to 0)
```

### Slow Response

```bash
# Check system load
top -n 1 | head -20

# Increase threads (if CPU-bound)
# N_THREADS: "8"  (increase)

# Enable GPU offloading (if available)
# N_GPU_LAYERS: "33"

# Reduce batch size to free resources for other tasks
# N_BATCH: "256"
```

---

## Phase 7: Cleanup & Shutdown

### Graceful Shutdown

```bash
# Stop all services
docker compose down

# Expected: containers stopped, volumes preserved

# To also remove volumes:
docker compose down -v
```

### Archive Model State

```bash
# Backup KV cache and logs
tar -czf backup-$(date +%Y%m%d).tar.gz models/ ./docker-compose.yml

# Store in version control or archive storage
```

---

## Automation: Shell Aliases

Add to `~/.bashrc` or `~/.zshrc`:

```bash
# Quick start
alias gguf-start="cd ~/tools/claude-generated/gguf-llama-hub && docker compose up -d llama-cpp-server && docker compose logs -f llama-cpp-server"

# Quick stop
alias gguf-stop="cd ~/tools/claude-generated/gguf-llama-hub && docker compose down"

# Health check
alias gguf-health="curl -s http://127.0.0.1:8000/health | jq . && echo '' && docker compose ps llama-cpp-server"

# Test inference
alias gguf-test="curl http://127.0.0.1:8000/v1/completions -H 'Content-Type: application/json' -d '{\"model\": \"model\", \"prompt\": \"[INST] Hello! [/INST]\", \"n_predict\": 50}' | jq ."

# Logs
alias gguf-logs="cd ~/tools/claude-generated/gguf-llama-hub && docker compose logs -f llama-cpp-server"

# Stats
alias gguf-stats="docker stats llama-cpp-server"
```

Then use:

```bash
source ~/.bashrc
gguf-start     # Start server
gguf-health    # Check status
gguf-test      # Send test query
gguf-stop      # Stop server
```

---

## Reference: API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/v1/completions` | POST | Text completion (OpenAI-compatible) |
| `/v1/chat/completions` | POST | Chat completion (OpenAI-compatible) |
| `/v1/embeddings` | POST | Generate embeddings |
| `/health` | GET | Health check |
| `/metrics` | GET | Prometheus metrics (if enabled) |
| `/props` | GET | Model properties |

---

## Success Criteria

✅ Docker Compose up with no errors  
✅ Server responds to health check  
✅ API responds with valid completions  
✅ Model loads without OOM  
✅ Inference latency acceptable for use case  
✅ GPU offloading working (if applicable)  

