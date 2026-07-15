# Contributing to claude-code-dashboard

Thank you for your interest in contributing. This document covers how to get set up, the project structure, and the process for submitting changes.

## Prerequisites

- Node.js 20 or higher
- npm 9 or higher
- git

## Development Setup

```bash
# Clone the repository
git clone https://github.com/ek33450505/claude-code-dashboard.git
cd claude-code-dashboard

# Install dependencies
npm install

# Start the development servers (frontend + backend concurrently)
npm run dev
```

The frontend runs on `http://localhost:5173` and the Express backend on `http://localhost:3001`.

> **Note:** This tool reads your local `~/.claude/` directory. It is designed to run locally only — do not expose it to a public network.

## Project Structure

```
src/
  views/          # Top-level page components (AgentsView, SessionsView, etc.)
  components/     # Shared UI components
  api/            # TanStack Query hooks (useAgents.ts, useSessions.ts, etc.)
  engine/         # Client-side data processing
  types/          # Shared TypeScript types
  utils/          # Utility functions

server/
  routes/         # Express route handlers (agents.ts, sessions.ts, etc.)
  parsers/        # File parsers for ~/.claude/ data (JSONL, markdown, etc.)
  watchers/       # File system watchers for live updates
  utils/          # Server-side utilities
```

## Code Style

- **TypeScript** with strict mode (`tsconfig.json`)
- **Tailwind CSS v4** for all styling — no inline styles, no CSS modules
- **React 19** — use function components and hooks only
- **TanStack Query v5** for all data fetching (`src/api/`)
- Run `npx tsc --noEmit` before submitting to verify the build is type-clean

## Testing

Tests live alongside source files:

```
src/components/Foo.tsx     →  src/components/Foo.test.ts
server/routes/agents.ts    →  server/__tests__/agents.test.ts
```

Run the test suite:

```bash
npm test          # run once (CI mode)
npm run test:watch  # watch mode during development
```

Cover happy path, edge cases, and error states. Prefer `getByRole` / `getByText` over `getByTestId` in React Testing Library tests.

## Commit Format

Use conventional commits:

```
feat:     a new feature
fix:      a bug fix
docs:     documentation changes only
chore:    tooling, dependency updates, config
refactor: code restructuring with no behavior change
test:     adding or updating tests
```

Examples:

```
feat: add token usage sparkline to agent cards
fix: correct session duration calculation for active sessions
docs: update CONTRIBUTING with Tailwind v4 note
```

## Pull Request Process

1. Fork the repository and create a branch from `main`:
   ```bash
   git checkout -b feat/your-feature-name
   ```
2. Make your changes following the code style and testing conventions above.
3. Verify the build is type-clean: `npx tsc --noEmit`
4. Run tests: `npm test`
5. Open a pull request against `main` with a clear description of what changed and why.

The PR template will prompt you for the required checklist items.

## Questions

Open a GitHub Issue with the `question` label if you are unsure about anything before starting a larger contribution.
