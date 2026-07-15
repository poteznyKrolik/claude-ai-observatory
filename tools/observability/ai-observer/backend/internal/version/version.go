package version

// Version information set via ldflags at build time
var (
	Version   = "dev"     // -X 'github.com/tobilg/ai-observer/backend/internal/version.Version=...'
	GitCommit = "unknown" // -X 'github.com/tobilg/ai-observer/backend/internal/version.GitCommit=...'
	BuildDate = "unknown" // -X 'github.com/tobilg/ai-observer/backend/internal/version.BuildDate=...'
)
