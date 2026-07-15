# Contributing to AI Observer

Thank you for your interest in contributing to AI Observer! This document provides guidelines and instructions for contributing.

## Getting Started

### Prerequisites

- Go 1.24+
- Node.js 20+
- pnpm
- Make

### Development Setup

```bash
# Clone the repository
git clone https://github.com/tobilg/ai-observer.git
cd ai-observer

# Install dependencies
make setup

# Run in development mode (backend + frontend)
make dev
```

The frontend runs at `http://localhost:5173` and proxies API requests to the backend at `http://localhost:8080`.

## Development Workflow

### Running Tests

```bash
# Run all tests
make test

# Run only backend tests
make backend-test

# Run only frontend tests
make frontend-test

# Run a specific Go test
cd backend && go test -v -run TestFunctionName ./path/to/package

# Run a specific frontend test
cd frontend && pnpm vitest run src/path/to/file.test.ts
```

### Linting

```bash
# Run all linters
make lint

# Run only backend linter
make backend-lint

# Run only frontend linter
make frontend-lint
```

### Building

```bash
# Build both backend and frontend
make all

# Build only backend
make backend

# Build only frontend
make frontend
```

## Code Style

### Go (Backend)

- Follow standard Go conventions and idioms
- Use `gofmt` for formatting (enforced by `golangci-lint`)
- Write table-driven tests where appropriate
- Add comments for exported functions and types

### TypeScript (Frontend)

- Use TypeScript strict mode
- Follow the existing code patterns in the codebase
- Use functional components with hooks
- Always use [shadcn/ui](https://ui.shadcn.com) components from the registry:
  ```bash
  cd frontend && pnpm dlx shadcn@latest add [component]
  ```

## Pull Request Process

1. **Fork the repository** and create your branch from `main`
2. **Make your changes** with clear, focused commits
3. **Add tests** for new functionality
4. **Run tests and linting** to ensure everything passes:
   ```bash
   make test
   make lint
   ```
5. **Update documentation** if you're changing behavior
6. **Submit a pull request** with a clear description of the changes

### Commit Messages

- Use clear, descriptive commit messages
- Start with a verb in present tense (e.g., "Add", "Fix", "Update")
- Keep the first line under 72 characters
- Reference issues when applicable (e.g., "Fix #123")

### Pull Request Description

Include:
- What changes you made and why
- Any breaking changes
- Screenshots for UI changes
- Testing steps if applicable

## Reporting Issues

### Bug Reports

When reporting bugs, please include:
- Steps to reproduce the issue
- Expected behavior
- Actual behavior
- Environment details (OS, browser, versions)
- Relevant logs or error messages

### Feature Requests

For feature requests, please describe:
- The problem you're trying to solve
- Your proposed solution
- Any alternatives you've considered

## Project Structure

```
ai-observer/
├── backend/
│   ├── cmd/server/       # Main entry point
│   ├── internal/
│   │   ├── api/          # API types and helpers
│   │   ├── handlers/     # HTTP handlers
│   │   ├── otlp/         # OTLP decoders
│   │   ├── server/       # Server setup
│   │   ├── storage/      # DuckDB storage layer
│   │   └── websocket/    # Real-time updates
│   └── pkg/compression/  # GZIP decompression
├── frontend/
│   └── src/
│       ├── components/   # React components
│       ├── pages/        # Page components
│       ├── stores/       # Zustand stores
│       └── lib/          # Utilities
└── Makefile
```

## Questions?

If you have questions, feel free to:
- Open an issue for discussion
- Check existing issues and pull requests

Thank you for contributing!
