package config

import (
	"os"
	"strconv"
)

type Config struct {
	// Server ports
	OTLPPort int
	APIPort  int

	// Database
	DatabasePath string

	// Frontend
	FrontendURL string
}

func Load() *Config {
	return &Config{
		OTLPPort:     getEnvInt("AI_OBSERVER_OTLP_PORT", 4318),
		APIPort:      getEnvInt("AI_OBSERVER_API_PORT", 8080),
		DatabasePath: getEnv("AI_OBSERVER_DATABASE_PATH", "./data/ai-observer.duckdb"),
		FrontendURL:  getEnv("AI_OBSERVER_FRONTEND_URL", "http://localhost:5173"),
	}
}

func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}

func getEnvInt(key string, defaultValue int) int {
	if value := os.Getenv(key); value != "" {
		if intValue, err := strconv.Atoi(value); err == nil {
			return intValue
		}
	}
	return defaultValue
}
