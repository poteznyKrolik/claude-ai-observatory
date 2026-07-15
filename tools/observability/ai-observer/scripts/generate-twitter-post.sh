#!/bin/bash
set -e

# Generate Twitter post summary using Claude
# Usage: ./scripts/generate-twitter-post.sh [TAG]
# If TAG is not provided, uses the latest tag

TAG="${1:-$(git describe --tags --abbrev=0 2>/dev/null)}"

if [ -z "$TAG" ]; then
    echo "Error: No tag found. Please provide a tag as argument or create one first."
    exit 1
fi

echo "Generating Twitter post for $TAG..."

# Get previous tag
PREV_TAG=$(git describe --tags --abbrev=0 "$TAG^" 2>/dev/null || echo "")

# Get commits since previous tag (or all commits if no previous tag)
if [ -n "$PREV_TAG" ]; then
    echo "Getting commits from $PREV_TAG to $TAG..."
    COMMITS=$(git log "$PREV_TAG".."$TAG" --pretty=format:"- %s" 2>/dev/null || echo "")
    echo "Getting code diff from $PREV_TAG to $TAG..."
    DIFF=$(git diff "$PREV_TAG".."$TAG" --stat 2>/dev/null || echo "")
    DIFF_FULL=$(git diff "$PREV_TAG".."$TAG" -- '*.go' '*.ts' '*.tsx' '*.json' '*.md' 2>/dev/null | head -c 50000 || echo "")
else
    echo "Getting all commits up to $TAG..."
    COMMITS=$(git log "$TAG" --pretty=format:"- %s" 2>/dev/null || echo "")
    DIFF=""
    DIFF_FULL=""
fi

if [ -z "$COMMITS" ]; then
    echo "Error: No commits found."
    exit 1
fi

echo ""
echo "Commits:"
echo "$COMMITS"
echo ""
echo "Files changed:"
echo "$DIFF"
echo ""

# Create prompt for Claude
PROMPT="You are generating a Twitter post announcing AI Observer $TAG, an OpenTelemetry-compatible observability backend for AI coding tools (Claude Code, Gemini CLI, Codex CLI).

Analyze the ACTUAL CODE CHANGES below to understand what was implemented.

## Commit Messages (for context only)
$COMMITS

## Files Changed (summary)
$DIFF

## Code Diff (analyze this carefully)
$DIFF_FULL

---

Generate a Twitter post with these STRICT rules:

Format:
- MAXIMUM 280 characters total (this is a hard limit)
- Plain text only, no markdown, no emojis, no hashtags
- Brief intro mentioning AI Observer $TAG
- Use dashes (-) for listing features

Content rules:
- Include only the TOP 3 most important new features or improvements
- IGNORE bug fixes, typos, CI/CD changes, refactoring, and internal changes
- Be extremely concise - use abbreviations if needed
- Analyze the actual code diff to understand what changed
- If fewer than 3 user-facing features exist, only mention what's relevant

Output ONLY the plain text tweet, no preamble or explanation. Count your characters carefully."

# Generate post using Claude CLI
echo "Calling Claude to generate Twitter post..."
POST=$(echo "$PROMPT" | claude -p 2>/dev/null)

if [ -z "$POST" ]; then
    echo "Error: Failed to generate post with Claude."
    echo "Make sure the 'claude' CLI is installed and working."
    exit 1
fi

# Count characters
CHAR_COUNT=${#POST}

echo ""
echo "Generated Twitter post ($CHAR_COUNT/280 characters):"
echo "========================"
echo "$POST"
echo "========================"
echo ""

if [ "$CHAR_COUNT" -gt 280 ]; then
    echo "WARNING: Post exceeds 280 character limit!"
fi

# Copy to clipboard
if command -v pbcopy &> /dev/null; then
    # macOS
    echo "$POST" | pbcopy
    echo "Copied to clipboard (pbcopy)"
elif command -v xclip &> /dev/null; then
    # Linux with xclip
    echo "$POST" | xclip -selection clipboard
    echo "Copied to clipboard (xclip)"
elif command -v xsel &> /dev/null; then
    # Linux with xsel
    echo "$POST" | xsel --clipboard --input
    echo "Copied to clipboard (xsel)"
else
    echo "Note: Could not copy to clipboard (no pbcopy/xclip/xsel found)"
fi
