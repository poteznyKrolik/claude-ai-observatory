package middleware

import (
	"net/http"

	"github.com/tobilg/ai-observer/internal/api"
)

// MaxPayloadBytes is the default maximum payload size (10 MB)
const MaxPayloadBytes int64 = 10 * 1024 * 1024 // 10 MB

// PayloadLimitMiddleware limits the size of incoming request bodies
func PayloadLimitMiddleware(maxBytes int64) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			// Check Content-Length header first (may be absent)
			if r.ContentLength > maxBytes {
				api.WriteErrorFromError(w, api.NewPayloadTooLargeError(maxBytes, r.ContentLength))
				return
			}

			// Wrap the body with a limited reader
			r.Body = http.MaxBytesReader(w, r.Body, maxBytes)
			next.ServeHTTP(w, r)
		})
	}
}

// DefaultPayloadLimitMiddleware applies the default 10MB limit
func DefaultPayloadLimitMiddleware(next http.Handler) http.Handler {
	return PayloadLimitMiddleware(MaxPayloadBytes)(next)
}
