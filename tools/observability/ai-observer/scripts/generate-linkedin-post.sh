#!/bin/bash
set -e

# Generate LinkedIn post summary using Claude
# Usage: ./scripts/generate-linkedin-post.sh [TAG]
# If TAG is not provided, uses the latest tag

TAG="${1:-$(git describe --tags --abbrev=0 2>/dev/null)}"

if [ -z "$TAG" ]; then
    echo "Error: No tag found. Please provide a tag as argument or create one first."
    exit 1
fi

echo "Generating LinkedIn post for $TAG..."

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
PROMPT="You are generating a LinkedIn post announcing AI Observer $TAG, an OpenTelemetry-compatible observability backend for AI coding tools (Claude Code, Gemini CLI, Codex CLI).

Analyze the ACTUAL CODE CHANGES below to understand what was implemented. Write a concise, professional summary suitable for LinkedIn.

## Commit Messages (for context only)
$COMMITS

## Files Changed (summary)
$DIFF

## Code Diff (analyze this carefully)
$DIFF_FULL

---

Generate a LinkedIn post with these rules:

Format:
- Start with a brief intro sentence about the release (e.g., \"AI Observer $TAG is now available.\")
- List new or changed features, one sentence per feature maximum
- Use dashes (-) for list items
- Plain text only, no markdown, no emojis, no hashtags
- Keep it concise and professional

Content rules:
- Focus only on NEW FEATURES and IMPROVEMENTS that users care about
- IGNORE bug fixes, typos, CI/CD changes, refactoring, and internal changes
- Analyze the actual code diff to understand what changed - don't just rephrase commit messages
- Be specific about what each feature does
- If there are no user-facing features, just write a brief summary of the improvements

Output ONLY the plain text post, no preamble or explanation."

# Generate post using Claude CLI
echo "Calling Claude to generate LinkedIn post..."
POST=$(echo "$PROMPT" | claude -p 2>/dev/null)

if [ -z "$POST" ]; then
    echo "Error: Failed to generate post with Claude."
    echo "Make sure the 'claude' CLI is installed and working."
    exit 1
fi

echo ""
echo "Generated LinkedIn post:"
echo "========================"
echo "$POST"
echo "========================"
echo ""

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
