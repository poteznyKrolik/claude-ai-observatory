package handlers

import (
	"bytes"
	"io"
	"net/http"

	"github.com/tobilg/ai-observer/internal/api"
	"github.com/tobilg/ai-observer/internal/logger"
	"github.com/tobilg/ai-observer/internal/otlp"
	"github.com/tobilg/ai-observer/internal/websocket"
)

// HandleLogs handles POST /v1/logs
func (h *Handlers) HandleLogs(w http.ResponseWriter, r *http.Request) {
	log := logger.Logger()
	contentType := r.Header.Get("Content-Type")

	// Read body for processing
	rawBody, err := io.ReadAll(r.Body)
	if err != nil {
		log.Error("Failed to read logs body", "error", err)
		api.WriteError(w, http.StatusBadRequest, "failed to read body")
		return
	}

	// Use format detection to handle Content-Type mismatches
	decoder, body, _, err := otlp.GetDecoderWithDetection(bytes.NewReader(rawBody), contentType)
	if err != nil {
		log.Error("Failed to detect logs format", "error", err)
		api.WriteError(w, http.StatusBadRequest, err.Error())
		return
	}

	req, err := decoder.DecodeLogs(body)
	if err != nil {
		log.Error("Failed to decode logs", "error", err)
		api.WriteError(w, http.StatusBadRequest, "failed to decode logs: "+err.Error())
		return
	}

	result := otlp.ConvertLogs(req)

	// Store logs
	if err := h.store.InsertLogs(r.Context(), result.Logs); err != nil {
		log.Error("Failed to store logs", "error", err)
		api.WriteError(w, http.StatusInternalServerError, "failed to store logs")
		return
	}

	// Store derived metrics (e.g., from Codex SSE events)
	if len(result.DerivedMetrics) > 0 {
		if err := h.store.InsertMetrics(r.Context(), result.DerivedMetrics); err != nil {
			// Log but don't fail the request - metrics are supplementary
			log.Warn("Failed to store derived metrics", "error", err)
		} else {
			log.Debug("Stored derived metrics from logs", "count", len(result.DerivedMetrics))
		}

		// Broadcast derived metrics to WebSocket clients
		if h.hub != nil {
			h.hub.Broadcast(websocket.NewMetricsMessage(result.DerivedMetrics))
		}
	}

	// Broadcast logs to WebSocket clients
	if h.hub != nil && len(result.Logs) > 0 {
		h.hub.Broadcast(websocket.NewLogsMessage(result.Logs))
	}

	log.Debug("Received log records", "count", len(result.Logs))

	// OTLP success response
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	w.Write([]byte("{}"))
}
