package server

import (
	"context"
	"net/http"
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/tobilg/ai-observer/internal/config"
)

// getTestConfig returns a config with test-appropriate ports
func getTestConfig(t *testing.T) *config.Config {
	t.Helper()

	// Create a temp directory for the test database
	tmpDir := t.TempDir()
	dbPath := filepath.Join(tmpDir, "test.duckdb")

	return &config.Config{
		APIPort:      18080, // Use non-standard ports for testing
		OTLPPort:     14318,
		DatabasePath: dbPath,
		FrontendURL:  "http://localhost:5173",
	}
}

func TestNewServer(t *testing.T) {
	cfg := getTestConfig(t)

	server, err := New(cfg)
	if err != nil {
		t.Fatalf("Failed to create server: %v", err)
	}

	if server == nil {
		t.Fatal("Server is nil")
	}

	if server.storage == nil {
		t.Error("Server storage is nil")
	}

	if server.wsHub == nil {
		t.Error("Server wsHub is nil")
	}

	if server.config == nil {
		t.Error("Server config is nil")
	}

	// Cleanup
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	server.storage.Close()
	_ = ctx
}

func TestServerStartAndShutdown(t *testing.T) {
	cfg := getTestConfig(t)

	server, err := New(cfg)
	if err != nil {
		t.Fatalf("Failed to create server: %v", err)
	}

	// Start server in goroutine
	serverErr := make(chan error, 1)
	go func() {
		err := server.ListenAndServe()
		if err != nil && err != http.ErrServerClosed {
			serverErr <- err
		}
		close(serverErr)
	}()

	// Wait for server to start
	time.Sleep(100 * time.Millisecond)

	// Check for startup errors
	select {
	case err := <-serverErr:
		if err != nil {
			t.Fatalf("Server failed to start: %v", err)
		}
	default:
		// No error, server is running
	}

	// Test that API endpoint is responding
	resp, err := http.Get("http://localhost:18080/health")
	if err != nil {
		t.Errorf("Failed to reach health endpoint: %v", err)
	} else {
		resp.Body.Close()
		if resp.StatusCode != http.StatusOK {
			t.Errorf("Expected status 200, got %d", resp.StatusCode)
		}
	}

	// Test graceful shutdown
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if err := server.Shutdown(ctx); err != nil {
		t.Errorf("Shutdown returned error: %v", err)
	}
}

func TestServerShutdownTimeout(t *testing.T) {
	cfg := getTestConfig(t)

	server, err := New(cfg)
	if err != nil {
		t.Fatalf("Failed to create server: %v", err)
	}

	// Start server
	go func() {
		_ = server.ListenAndServe()
	}()

	time.Sleep(100 * time.Millisecond)

	// Shutdown with very short timeout
	ctx, cancel := context.WithTimeout(context.Background(), 1*time.Millisecond)
	defer cancel()

	// This may or may not error depending on how fast shutdown completes
	// The important thing is it doesn't hang
	start := time.Now()
	_ = server.Shutdown(ctx)
	elapsed := time.Since(start)

	// Should complete within a reasonable time (not hang forever)
	if elapsed > 1*time.Second {
		t.Errorf("Shutdown took too long: %v", elapsed)
	}
}

func TestServerShutdownBeforeStart(t *testing.T) {
	cfg := getTestConfig(t)

	server, err := New(cfg)
	if err != nil {
		t.Fatalf("Failed to create server: %v", err)
	}

	// Shutdown without starting - should not panic
	ctx, cancel := context.WithTimeout(context.Background(), 1*time.Second)
	defer cancel()

	// This should succeed without error
	err = server.Shutdown(ctx)
	if err != nil {
		t.Errorf("Shutdown before start returned error: %v", err)
	}
}

func TestServerMultiplePorts(t *testing.T) {
	cfg := getTestConfig(t)

	server, err := New(cfg)
	if err != nil {
		t.Fatalf("Failed to create server: %v", err)
	}

	go func() {
		_ = server.ListenAndServe()
	}()

	time.Sleep(200 * time.Millisecond)

	// Test API server port
	apiResp, err := http.Get("http://localhost:18080/health")
	if err != nil {
		t.Errorf("Failed to reach API server: %v", err)
	} else {
		apiResp.Body.Close()
	}

	// Test OTLP server port
	otlpResp, err := http.Post("http://localhost:14318/v1/traces", "application/json", nil)
	if err != nil {
		t.Errorf("Failed to reach OTLP server: %v", err)
	} else {
		otlpResp.Body.Close()
	}

	// Cleanup
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	server.Shutdown(ctx)
}

func TestServerDatabaseCreation(t *testing.T) {
	cfg := getTestConfig(t)

	server, err := New(cfg)
	if err != nil {
		t.Fatalf("Failed to create server: %v", err)
	}

	// Check that database file was created
	if _, err := os.Stat(cfg.DatabasePath); os.IsNotExist(err) {
		t.Error("Database file was not created")
	}

	// Cleanup
	server.storage.Close()
}

func TestServerConcurrentRequests(t *testing.T) {
	cfg := getTestConfig(t)

	server, err := New(cfg)
	if err != nil {
		t.Fatalf("Failed to create server: %v", err)
	}

	go func() {
		_ = server.ListenAndServe()
	}()

	time.Sleep(200 * time.Millisecond)

	// Make concurrent requests
	const numRequests = 50
	results := make(chan error, numRequests)

	for i := 0; i < numRequests; i++ {
		go func() {
			resp, err := http.Get("http://localhost:18080/health")
			if err != nil {
				results <- err
				return
			}
			resp.Body.Close()
			if resp.StatusCode != http.StatusOK {
				results <- err
			} else {
				results <- nil
			}
		}()
	}

	// Collect results
	var errors int
	for i := 0; i < numRequests; i++ {
		if err := <-results; err != nil {
			errors++
		}
	}

	if errors > 0 {
		t.Errorf("%d/%d requests failed", errors, numRequests)
	}

	// Cleanup
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	server.Shutdown(ctx)
}
