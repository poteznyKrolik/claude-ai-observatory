package handlers

import (
	"context"
	"net/http"

	"github.com/tobilg/ai-observer/internal/api"
	"github.com/tobilg/ai-observer/internal/logger"
	"github.com/tobilg/ai-observer/internal/otlp"
	"github.com/tobilg/ai-observer/internal/websocket"
)

// HandleMetrics handles POST /v1/metrics
func (h *Handlers) HandleMetrics(w http.ResponseWriter, r *http.Request) {
	log := logger.Logger()
	contentType := r.Header.Get("Content-Type")

	// Use format detection to handle Content-Type mismatches
	decoder, body, _, err := otlp.GetDecoderWithDetection(r.Body, contentType)
	if err != nil {
		api.WriteError(w, http.StatusBadRequest, err.Error())
		return
	}

	req, err := decoder.DecodeMetrics(body)
	if err != nil {
		log.Error("Failed to decode metrics", "error", err)
		api.WriteError(w, http.StatusBadRequest, "failed to decode metrics: "+err.Error())
		return
	}

	result := otlp.ConvertMetrics(req)

	// Derive delta metrics from cumulative metrics using DB lookup for previous values
	lookup := func(ctx context.Context, metricName, serviceName string, attributes map[string]string) (float64, bool) {
		return h.store.GetLatestMetricValue(ctx, metricName, serviceName, attributes)
	}
	deltaResult := otlp.ConvertCumulativeToDelta(r.Context(), result.Metrics, lookup)

	// Combine: original metrics + delta metrics + other derived metrics (like cost)
	allMetrics := append(deltaResult.Original, deltaResult.Deltas...)
	allMetrics = append(allMetrics, result.DerivedMetrics...)

	if err := h.store.InsertMetrics(r.Context(), allMetrics); err != nil {
		log.Error("Failed to store metrics", "error", err)
		api.WriteError(w, http.StatusInternalServerError, "failed to store metrics")
		return
	}

	// Broadcast to WebSocket clients
	if h.hub != nil && len(allMetrics) > 0 {
		h.hub.Broadcast(websocket.NewMetricsMessage(allMetrics))
	}

	log.Debug("Received metrics",
		"received", len(result.Metrics),
		"stored", len(allMetrics),
		"original", len(deltaResult.Original),
		"deltas", len(deltaResult.Deltas),
		"derived", len(result.DerivedMetrics))

	// OTLP success response
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	w.Write([]byte("{}"))
}
