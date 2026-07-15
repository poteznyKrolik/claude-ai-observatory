#!/usr/bin/env bash
# Claude Observatory — UV Self-Installing CLI Wrapper
#
# This script installs uv (if needed) and creates convenient shell aliases
# for the observatory CLI using UV's dependency management.
#
# Usage:
#   bash install.sh
#   # Then use: observatory ls

set -euo pipefail

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo -e "${BLUE}═══════════════════════════════════════${NC}"
echo -e "${BLUE}  Claude Observatory — Installation${NC}"
echo -e "${BLUE}═══════════════════════════════════════${NC}"

# Check if UV is installed
if ! command -v uv &> /dev/null; then
    echo -e "${YELLOW}📦 Installing UV...${NC}"
    curl -LsSf https://astral.sh/uv/install.sh | sh

    # Source UV to PATH
    export PATH="$HOME/.cargo/bin:$PATH"

    echo -e "${GREEN}✓ UV installed${NC}"
else
    UV_VERSION=$(uv --version)
    echo -e "${GREEN}✓ UV already installed: ${UV_VERSION}${NC}"
fi

# Install CLI dependencies
echo -e "${BLUE}📦 Installing CLI dependencies...${NC}"
uv pip install typer rich docker pydantic pyyaml requests -q 2>/dev/null || true

# Create shell aliases
echo -e "${BLUE}📝 Creating shell aliases...${NC}"

OBSERVATORY_ALIAS="alias observatory='uv run ${PROJECT_DIR}/observatory.py'"

# Detect shell
SHELL_RC=""
if [ -n "${BASH_VERSION:-}" ]; then
    SHELL_RC="$HOME/.bashrc"
elif [ -n "${ZSH_VERSION:-}" ]; then
    SHELL_RC="$HOME/.zshrc"
elif [ -f "$HOME/.bashrc" ]; then
    SHELL_RC="$HOME/.bashrc"
elif [ -f "$HOME/.zshrc" ]; then
    SHELL_RC="$HOME/.zshrc"
fi

if [ -n "$SHELL_RC" ]; then
    if ! grep -q "observatory=" "$SHELL_RC" 2>/dev/null; then
        echo "" >> "$SHELL_RC"
        echo "# Claude Observatory CLI (UV-managed)" >> "$SHELL_RC"
        echo "$OBSERVATORY_ALIAS" >> "$SHELL_RC"
        echo -e "${GREEN}✓ Added alias to ${SHELL_RC}${NC}"
    fi
fi

# Create direct executable script
OBSERVATORY_BIN="${PROJECT_DIR}/observatory"
cat > "$OBSERVATORY_BIN" << 'EOF'
#!/usr/bin/env bash
# Claude Observatory — CLI Wrapper with UV
# Runs: uv run observatory.py <args>

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
exec uv run "${PROJECT_DIR}/observatory.py" "$@"
EOF
chmod +x "$OBSERVATORY_BIN"

echo -e "${BLUE}═══════════════════════════════════════${NC}"
echo -e "${GREEN}✅ Installation complete!${NC}"
echo -e "${BLUE}═══════════════════════════════════════${NC}"

echo ""
echo -e "${BLUE}📖 Usage:${NC}"
echo ""
echo -e "  Add to PATH (optional):"
echo -e "  ${YELLOW}export PATH=\"${PROJECT_DIR}:\$PATH\"${NC}"
echo ""
echo -e "  Then use directly:"
echo -e "  ${YELLOW}observatory --help${NC}"
echo -e "  ${YELLOW}observatory ls${NC}"
echo -e "  ${YELLOW}observatory status${NC}"
echo ""
echo -e "  Or via UV:"
echo -e "  ${YELLOW}uv run ${PROJECT_DIR}/observatory.py ls${NC}"
echo ""
echo -e "${BLUE}📚 Quick commands:${NC}"
echo -e "  observatory ls                      # List all services"
echo -e "  observatory presets                 # Show available presets"
echo -e "  observatory start                   # Start all services"
echo -e "  observatory start --preset analytics # Start analytics stack"
echo -e "  observatory stop                    # Stop services"
echo -e "  observatory status                  # Check status"
echo -e "  observatory logs <service>          # Show logs"
echo -e "  observatory logs -f chatgpt         # Follow logs"
echo -e "  observatory health                  # Check service health"
echo -e "  observatory endpoints               # Show all endpoints"
echo -e "  observatory info <service>          # Get service details"
echo ""
