# AI Observer Frontend

React dashboard for the AI Observer OpenTelemetry-compatible observability backend.

## Tech Stack

- **React 19** with TypeScript
- **Vite 7** for bundling and dev server
- **Tailwind CSS v4** for styling
- **Zustand** for state management
- **React Router** for navigation
- **Recharts** for visualizations
- **Vitest** for testing

## Development

```bash
# Install dependencies
pnpm install

# Start dev server (localhost:5173)
pnpm dev

# Build for production
pnpm build

# Preview production build
pnpm preview
```

## Testing

```bash
# Run tests in watch mode
pnpm test

# Run tests once
pnpm test:run

# Run tests with coverage
pnpm test:coverage
```

### Test Coverage

| Module | Statements | Branch | Functions | Lines |
|--------|------------|--------|-----------|-------|
| components/ui | 100% | 100% | 100% | 100% |
| lib | 100% | ~98% | 100% | 100% |
| stores | 100% | 100% | 100% | 100% |
| hooks | ~84% | ~70% | 88% | ~83% |

## Project Structure

```
src/
├── components/
│   ├── layout/          # Layout components (Header, Sidebar, Layout)
│   └── ui/              # Reusable UI primitives (Badge, Button, Card, Input, Select)
├── hooks/
│   └── useWebSocket.ts  # WebSocket connection management
├── lib/
│   ├── api.ts           # REST API client
│   └── utils.ts         # Utility functions (formatting, styling)
├── pages/
│   ├── Dashboard.tsx    # Home page with stats and recent activity
│   ├── TracesPage.tsx   # Trace viewer with span waterfall
│   ├── MetricsPage.tsx  # Metrics visualization
│   └── LogsPage.tsx     # Log viewer
├── stores/
│   └── telemetryStore.ts # Zustand store for real-time telemetry data
├── test/
│   └── setup.ts         # Test setup with mocks
├── types/
│   ├── traces.ts        # Trace/Span interfaces
│   ├── metrics.ts       # Metric interfaces
│   └── logs.ts          # Log interfaces
├── App.tsx              # Router setup
└── main.tsx             # Entry point
```

## Configuration

### Path Alias

The `@` alias maps to `./src`:

```typescript
import { Button } from '@/components/ui/button'
import { api } from '@/lib/api'
```

### Dev Server Proxy

The dev server proxies API and WebSocket requests to the backend:

- `/api/*` → `http://localhost:8080`
- `/ws` → `ws://localhost:8080`

## Metrics Page Timeframes

The metrics page supports configurable timeframes with automatic data granularity and refresh rates. The timeframe is persisted in the URL via the `?timeframe=` parameter.

| Timeframe | URL Value | Data Interval | X-axis Tick | Auto-refresh |
|-----------|-----------|---------------|-------------|--------------|
| Last 1 minute | `1m` | 1 second | 5 seconds | 5 seconds |
| Last 5 minutes | `5m` | 5 seconds | 20 seconds | 20 seconds |
| Last 15 minutes | `15m` | 10 seconds | 1 minute | 1 minute |
| Last 30 minutes | `30m` | 30 seconds | 2.5 minutes | 2.5 minutes |
| Last 1 hour | `1h` | 1 minute | 5 minutes | 5 minutes |
| Last 6 hours | `6h` | 5 minutes | 30 minutes | 30 minutes |
| Last 12 hours | `12h` | 10 minutes | 1 hour | 1 hour |
| Last 24 hours | `24h` | 15 minutes | 2 hours | 2 hours |
| Last 7 days | `7d` | 1 hour | 12 hours | 12 hours |
| Last 30 days | `30d` | 6 hours | 2.5 days | 2.5 days |

- **Data Interval**: Backend aggregation bucket size (query granularity)
- **X-axis Tick**: Spacing between labels on the chart's X-axis
- **Auto-refresh**: Chart refresh rate (matches X-axis tick spacing)

Default timeframe is `15m` (Last 15 minutes).

## Supported Metrics

AI Observer collects OpenTelemetry metrics from various AI coding tools. Each metric includes metadata for display names, descriptions, units, and breakdown attributes for multi-series visualization.

### Documentation Sources

- **Claude Code**: [Monitoring Usage Metrics](https://code.claude.com/docs/en/monitoring-usage#available-metrics-and-events)
- **Gemini CLI**: [Telemetry - Logs and Metrics](https://geminicli.com/docs/cli/telemetry/#logs-and-metrics)
- **Codex CLI**: [Configuration - Event Catalog](https://github.com/openai/codex/blob/main/docs/config.md#event-catalog)

### Claude Code Metrics

| Metric Name | Display Name | Unit | Description | Breakdown Attributes |
|-------------|--------------|------|-------------|---------------------|
| `claude_code.session.count` | Sessions | count | Number of coding sessions started | — |
| `claude_code.lines_of_code.count` | Lines of Code | count | Lines of code added or removed | `type` (added/removed) |
| `claude_code.pull_request.count` | Pull Requests | count | Number of pull requests created | — |
| `claude_code.commit.count` | Commits | count | Number of commits made | — |
| `claude_code.cost.usage` | Cost | USD | Total cost incurred in USD | `model` |
| `claude_code.token.usage` | Token Usage | tokens | Token consumption by type | `type` (input/output/cacheRead/cacheCreation), `model` |
| `claude_code.code_edit_tool.decision` | Edit Decisions | count | Code edit tool usage decisions | `tool`, `decision`, `language` |
| `claude_code.active_time.total` | Active Time | seconds | Total active coding time | — |

### Gemini CLI Metrics

| Metric Name | Display Name | Unit | Description | Breakdown Attributes |
|-------------|--------------|------|-------------|---------------------|
| `gemini_cli.session.count` | Sessions | count | Number of CLI sessions | — |
| `gemini_cli.tool.call.count` | Tool Calls | count | Number of tool invocations | `function_name`, `success`, `decision`, `tool_type` |
| `gemini_cli.tool.call.latency` | Tool Latency | ms | Tool call execution time | `function_name` |
| `gemini_cli.api.request.count` | API Requests | count | Number of API requests made | `model`, `status_code`, `error_type` |
| `gemini_cli.api.request.latency` | API Latency | ms | API request latency | `model` |
| `gemini_cli.token.usage` | Token Usage | tokens | Token consumption | `type` (input/output/thought/cache/tool), `model` |
| `gemini_cli.file.operation.count` | File Operations | count | File read/write operations | `operation`, `programming_language`, `extension` |
| `gemini_cli.lines.changed` | Lines Changed | count | Code lines modified | `function_name`, `type` (added/removed) |
| `gemini_cli.agent.run.count` | Agent Runs | count | Number of agent executions | `agent_name`, `terminate_reason` |
| `gemini_cli.agent.duration` | Agent Duration | ms | Agent execution time | `agent_name` |
| `gemini_cli.agent.turns` | Agent Turns | count | Conversation turns per agent | `agent_name` |
| `gemini_cli.chat_compression` | Chat Compression | count | Chat message compression events | — |
| `gemini_cli.chat.invalid_chunk.count` | Invalid Chunks | count | Invalid streaming chunks received | — |
| `gemini_cli.chat.content_retry.count` | Content Retries | count | Content generation retry attempts | — |
| `gemini_cli.chat.content_retry_failure.count` | Retry Failures | count | Failed retry attempts | — |
| `gemini_cli.slash_command.model.call_count` | Model Commands | count | Slash command model invocations | `slash_command.model.model_name` |
| `gemini_cli.model_routing.latency` | Routing Latency | ms | Model routing decision time | `routing.decision_model`, `routing.decision_source` |
| `gemini_cli.model_routing.failure.count` | Routing Failures | count | Model routing failures | `routing.decision_source` |
| `gemini_cli.ui.flicker.count` | UI Flicker | count | UI flicker events detected | — |
| `gemini_cli.startup.duration` | Startup Duration | ms | CLI startup time | `phase` |
| `gemini_cli.memory.usage` | Memory Usage | bytes | Memory consumption | `memory_type`, `component` |
| `gemini_cli.cpu.usage` | CPU Usage | % | CPU utilization | `component` |
| `gemini_cli.tool.queue.depth` | Tool Queue Depth | count | Pending tools in queue | — |
| `gemini_cli.tool.execution.breakdown` | Tool Execution | ms | Detailed tool execution timing | `function_name`, `phase` |
| `gemini_cli.api.request.breakdown` | API Breakdown | ms | Detailed API request timing | `model`, `phase` |
| `gemini_cli.token.efficiency` | Token Efficiency | ratio | Token usage efficiency | `model`, `metric` |
| `gemini_cli.performance.score` | Performance Score | score | Overall performance score | `category` |
| `gemini_cli.performance.regression` | Perf Regressions | count | Performance regression events | `metric`, `severity` |
| `gemini_cli.performance.regression.percentage_change` | Regression % | % | Regression percentage change | `metric`, `severity` |
| `gemini_cli.performance.baseline.comparison` | Baseline Comparison | % | Comparison to performance baseline | `metric`, `category` |
| `gen_ai.client.token.usage` | GenAI Token Usage | tokens | Generic AI token usage | `gen_ai.token.type`, `gen_ai.request.model` |
| `gen_ai.client.operation.duration` | GenAI Op Duration | seconds | Generic AI operation duration | `gen_ai.operation.name`, `gen_ai.request.model` |

### Codex CLI Events

| Event Name | Display Name | Description | Breakdown Attributes |
|------------|--------------|-------------|---------------------|
| `codex.conversation_starts` | Sessions | Conversation session started | — |
| `codex.api_request` | API Requests | API request made | `http.response.status_code` |
| `codex.sse_event` | SSE Events | Server-sent events received | `event.kind` |
| `codex.tool_decision` | Tool Decisions | Tool execution decisions | `tool_name`, `decision`, `source` |
| `codex.tool_result` | Tool Results | Tool execution outcomes | `tool_name`, `success` |

### Value Calculation

Metrics are aggregated based on their type:

| Metric Type | Aggregation | Description |
|-------------|-------------|-------------|
| **Counter (monotonic)** | Sum | Cumulative totals summed over interval |
| **Counter (non-monotonic)** | Delta | Difference between max and min per interval |
| **Gauge** | Average | Average value per interval |
| **Histogram** | Average/Percentile | Average of sum/count or bucket analysis |

### Breakdown Attributes

Many metrics support breakdown attributes for multi-series visualization. When viewing a chart:

- **Token Usage metrics** can be broken down by `type` (input, output, cache tokens) or by `model`
- **Lines Changed metrics** can show separate series for `added` vs `removed` lines
- **Tool metrics** can be grouped by `function_name`, `decision`, or `success` status
- **API metrics** can be grouped by `model`, `status_code`, or `error_type`

The breakdown attribute can be configured per-widget in the dashboard. If not specified, the default breakdown (usually `type`) is used.

### Value Formatting

Values are automatically formatted based on their unit:

| Unit | Format Example |
|------|----------------|
| count | 1,234 / 1.2K / 1.2M |
| tokens | 1,234 tokens |
| seconds | 45.2s / 2.5m / 1.2h |
| milliseconds | 234ms |
| bytes | 1.2 KB / 5.4 MB / 2.1 GB |
| USD | $1.23 / $12.34 |
| percent | 45.2% |

## Linting

```bash
pnpm lint
```

Uses ESLint with TypeScript and React plugins.
