# Model Standard Operating Procedure (SOP)

**Document Version:** 1.0  
**Last Updated:** 2026-07-14  
**Status:** Template (Update with actual model details)

---

## 1. Model Inventory

### Source Information
- **Model Name:** `[e.g., llama-3.1-8b-instruct-q4_k_m]`
- **Base Model:** `[e.g., Meta Llama 3.1, Mistral 7B, etc.]`
- **Source Repository:** `[e.g., huggingface.co/TheBloke/...]`
- **Original Model URL:** `[Link to HuggingFace model card]`
- **Download Date:** `[YYYY-MM-DD]`

### Quantization Details
- **Quantization Type:** `[e.g., Q4_K_M, Q5_K_M, F16, etc.]`
- **Quantization Bits:** `[4, 5, 8, 16]`
- **File Size:** `[e.g., 4.5 GB]`
- **GGUF Version:** `[e.g., v3, v4]`
- **Quantizer:** `[e.g., TheBloke, AutoGGUF, etc.]`

### Licensing
- **License Type:** `[MIT, Apache 2.0, CC-BY-SA-4.0, Proprietary, etc.]`
- **License URL:** `[Link to license terms]`
- **Commercial Use Allowed:** `[Yes/No/Conditional]`
- **Attribution Required:** `[Yes/No]`
- **Redistribution Allowed:** `[Yes/No/With conditions]`

---

## 2. Operational Guidelines

### Recommended Context Window
```
Context Size: 2048 tokens (safe default)
Maximum Context: 4096 tokens (with caution)
Maximum Observed: 8192 tokens (risk of OOM)
```

### Prompt Template Format
Replace the template placeholders with your instruction:

```
[INST] <<SYS>>
You are a helpful assistant.
<</SYS>>

{user_instruction}
[/INST]
```

**Example:**
```
[INST] <<SYS>>
You are a code assistant specializing in Python.
<</SYS>>

Write a function to validate email addresses.
[/INST]
```

### Known Constraints & Tuning Notes

**Thread Count:**
- **Recommended:** CPU core count - 1 (e.g., 7 threads on 8-core)
- **Max Threads:** Physical core count (HT disabled)
- **Min Threads:** 1 (will be slow)

**Batch Size (n_batch):**
- **Recommended:** 512 (balanced latency/throughput)
- **Range:** 128–2048
- **Too high:** OOM risk
- **Too low:** Underutilized GPU

**Context Size (n_ctx):**
- **Safe Default:** 2048
- **Memory Rule:** ~6GB VRAM for full context on Q4_K_M 7B model
- **Overflow:** Tokens beyond context are truncated

**GPU Layer Offloading (CUDA/Metal):**
- **Full GPU:** ngl=33 (offload all layers + KV cache)
- **Partial:** ngl=10-20 (offload key layers, keep some CPU)
- **CPU-only:** ngl=0 (disables GPU, default)
- **Requirement:** Sufficient VRAM ≥ model size × quantization factor

### Temperature & Sampling
- **Temperature:** 0.7 (default, balanced creativity)
- **Top-P:** 0.9 (nucleus sampling)
- **Top-K:** 40 (top-K filtering)
- **Min-P:** 0.05 (minimum probability threshold)

### Observed Performance Metrics
- **First Token Latency:** ~200ms (CPU), ~50ms (GPU with offload)
- **Tokens/Sec:** 5–10 (CPU), 20–50 (GPU with Q4_K_M)
- **VRAM Usage:** ~7–8GB (full Q4_K_M 7B with context=2048)
- **RAM Usage:** ~4GB (base model + KV cache)

---

## 3. Troubleshooting

### OOM (Out of Memory)
- Reduce context size (n_ctx) → 1024 or 512
- Reduce batch size (n_batch) → 256
- Reduce GPU offloading (ngl) → remove or set to 0
- Use CPU-only mode

### Slow Token Generation
- Increase thread count (if CPU-bound)
- Enable GPU offloading (ngl > 0)
- Reduce context size
- Check system load (top/Activity Monitor)

### Model Not Loading
- Verify GGUF file is valid: `file models/*.gguf`
- Check file permissions: `ls -la models/*.gguf`
- Verify container mount: `docker exec llama-server ls -la /models/`

### CUDA/GPU Not Detected
- Verify NVIDIA drivers: `nvidia-smi`
- Check Docker GPU runtime: `docker run --gpus all ubuntu nvidia-smi`
- Ensure CUDA compute capability ≥ 5.2

---

## 4. Maintenance & Updates

- **Last Verified:** [DATE]
- **Tested Hardware:** [CPU: Model, RAM: Xgb, GPU: Model or None]
- **Tested OS:** [macOS 13+, Ubuntu 22.04, Windows WSL2]
- **Notes:** Add any specific quirks or optimizations discovered in production.

