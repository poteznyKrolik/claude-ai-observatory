package middleware

import (
	"context"
	"net/http"
	"time"
)

// DefaultRequestTimeout is the default timeout for HTTP requests (5 seconds)
const DefaultRequestTimeout = 5 * time.Second

// ContextTimeoutMiddleware adds a timeout to the request context.
// Handlers should check ctx.Done() and ctx.Err() to handle timeouts gracefully.
// This is safer than wrapping ResponseWriter which breaks WebSocket hijacking.
func ContextTimeoutMiddleware(timeout time.Duration) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			// Skip timeout for WebSocket upgrade requests
			if r.Header.Get("Upgrade") == "websocket" {
				next.ServeHTTP(w, r)
				return
			}

			// Create a context with timeout
			ctx, cancel := context.WithTimeout(r.Context(), timeout)
			defer cancel()

			// Serve with the new context
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

// DefaultContextTimeoutMiddleware applies the default 5-second context timeout
func DefaultContextTimeoutMiddleware(next http.Handler) http.Handler {
	return ContextTimeoutMiddleware(DefaultRequestTimeout)(next)
}
