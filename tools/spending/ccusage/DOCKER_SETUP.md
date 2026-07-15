# CCUsage — Docker Setup

CLI tool for analyzing coding agent token usage and costs. Generates token breakdowns and cost reports from Claude Code, Codex, Cursor, and other agent logs.

## Usage

This is a CLI tool (not a server), so it's invoked with specific commands:

```bash
# View daily summary
docker compose run --rm ccusage

# View detailed report
docker compose run --rm ccusage report --detailed

# View by month
docker compose run --rm ccusage month
```

## Supported Agents

- Claude Code
- Codex
- Cursor
- Kimi
- And others

## Notes

- Reads local agent logs from mounted directories
- Displays token counts, costs, and breakdowns
- No background server required
- Run individual reports as needed
