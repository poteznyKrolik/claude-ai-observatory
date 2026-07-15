package config

import (
	"os"
	"testing"
)

func TestLoad_Defaults(t *testing.T) {
	// Clear relevant env vars
	os.Unsetenv("AI_OBSERVER_OTLP_PORT")
	os.Unsetenv("AI_OBSERVER_API_PORT")
	os.Unsetenv("AI_OBSERVER_DATABASE_PATH")
	os.Unsetenv("AI_OBSERVER_FRONTEND_URL")

	cfg := Load()

	if cfg.OTLPPort != 4318 {
		t.Errorf("OTLPPort = %d, want 4318", cfg.OTLPPort)
	}
	if cfg.APIPort != 8080 {
		t.Errorf("APIPort = %d, want 8080", cfg.APIPort)
	}
	if cfg.DatabasePath != "./data/ai-observer.duckdb" {
		t.Errorf("DatabasePath = %s, want ./data/ai-observer.duckdb", cfg.DatabasePath)
	}
	if cfg.FrontendURL != "http://localhost:5173" {
		t.Errorf("FrontendURL = %s, want http://localhost:5173", cfg.FrontendURL)
	}
}

func TestLoad_CustomValues(t *testing.T) {
	os.Setenv("AI_OBSERVER_OTLP_PORT", "9999")
	os.Setenv("AI_OBSERVER_API_PORT", "3000")
	os.Setenv("AI_OBSERVER_DATABASE_PATH", "/custom/path.duckdb")
	os.Setenv("AI_OBSERVER_FRONTEND_URL", "https://example.com")
	defer func() {
		os.Unsetenv("AI_OBSERVER_OTLP_PORT")
		os.Unsetenv("AI_OBSERVER_API_PORT")
		os.Unsetenv("AI_OBSERVER_DATABASE_PATH")
		os.Unsetenv("AI_OBSERVER_FRONTEND_URL")
	}()

	cfg := Load()

	if cfg.OTLPPort != 9999 {
		t.Errorf("OTLPPort = %d, want 9999", cfg.OTLPPort)
	}
	if cfg.APIPort != 3000 {
		t.Errorf("APIPort = %d, want 3000", cfg.APIPort)
	}
	if cfg.DatabasePath != "/custom/path.duckdb" {
		t.Errorf("DatabasePath = %s, want /custom/path.duckdb", cfg.DatabasePath)
	}
	if cfg.FrontendURL != "https://example.com" {
		t.Errorf("FrontendURL = %s, want https://example.com", cfg.FrontendURL)
	}
}

func TestLoad_InvalidIntFallsBackToDefault(t *testing.T) {
	os.Setenv("AI_OBSERVER_OTLP_PORT", "not-a-number")
	os.Setenv("AI_OBSERVER_API_PORT", "")
	defer func() {
		os.Unsetenv("AI_OBSERVER_OTLP_PORT")
		os.Unsetenv("AI_OBSERVER_API_PORT")
	}()

	cfg := Load()

	if cfg.OTLPPort != 4318 {
		t.Errorf("OTLPPort = %d, want 4318 (default on invalid)", cfg.OTLPPort)
	}
	if cfg.APIPort != 8080 {
		t.Errorf("APIPort = %d, want 8080 (default on empty)", cfg.APIPort)
	}
}
