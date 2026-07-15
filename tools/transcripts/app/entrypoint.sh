#!/bin/bash
set -e

# Generate transcripts from all local Claude sessions on startup
echo "Generating Claude Code transcripts..."
claude-code-transcripts all -o /output 2>&1 || echo "First generation may warn if no sessions exist yet"

# Start a simple HTTP server
echo "Starting HTTP server on 0.0.0.0:8765..."
cd /output
exec python3 -m http.server 8765 --bind 0.0.0.0
