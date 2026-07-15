package otlp

import (
	"context"
	"sort"
	"strings"

	"github.com/tobilg/ai-observer/internal/api"
	"github.com/tobilg/ai-observer/internal/logger"
)

// cumulativeToDeltaMetrics defines which metrics should be converted from cumulative to delta.
// Only sum/counter metrics - histograms like gen_ai.client.token.usage are excluded.
var cumulativeToDeltaMetrics = map[string]bool{
	"gemini_cli.token.usage":          true,
	"gemini_cli.api.request.count":    true,
	"gemini_cli.file.operation.count": true,
	"gemini_cli.session.count":        true,
}

// essentialAttributes defines which attributes to use for series matching per metric.
// Include attributes that define the metric series (type, model) but NOT session-specific
// ones (session.id, installation.id, user.email) which change every session.
var essentialAttributes = map[string][]string{
	"gemini_cli.token.usage":          {"type", "model"},
	"gemini_cli.api.request.count":    {"model", "status_code"},
	"gemini_cli.file.operation.count": {"operation"},
	"gemini_cli.session.count":        {},
}

// filterEssentialAttributes returns only the essential attributes for a metric.
func filterEssentialAttributes(metricName string, attrs map[string]string) map[string]string {
	essentialKeys, ok := essentialAttributes[metricName]
	if !ok || len(essentialKeys) == 0 {
		return map[string]string{} // No filtering, use empty map
	}

	filtered := make(map[string]string)
	for _, key := range essentialKeys {
		if val, exists := attrs[key]; exists {
			filtered[key] = val
		}
	}
	return filtered
}

// PreviousValueLookup is a function that looks up the previous value for a metric series from storage.
// Returns the previous value and true if found, or 0 and false if not found.
type PreviousValueLookup func(ctx context.Context, metricName, serviceName string, attributes map[string]string) (float64, bool)

// BuildSeriesKey creates a unique key for a metric series based on metric name,
// service name, and all attributes (sorted for consistency).
func BuildSeriesKey(metricName, serviceName string, attributes map[string]string) string {
	var parts []string
	parts = append(parts, metricName)
	parts = append(parts, serviceName)

	// Sort attribute keys for consistent ordering
	keys := make([]string, 0, len(attributes))
	for k := range attributes {
		keys = append(keys, k)
	}
	sort.Strings(keys)

	for _, k := range keys {
		parts = append(parts, k+"="+attributes[k])
	}

	return strings.Join(parts, "|")
}

// ShouldConvertToDelta returns true if the metric should be converted from cumulative to delta.
func ShouldConvertToDelta(metricName string) bool {
	return cumulativeToDeltaMetrics[metricName]
}

// CumulativeToDeltaResult contains both the original metrics and derived delta metrics.
type CumulativeToDeltaResult struct {
	// Original metrics (including cumulative values for future lookups)
	Original []api.MetricDataPoint
	// Derived delta metrics (for visualization)
	Deltas []api.MetricDataPoint
}

// ConvertCumulativeToDelta processes cumulative metrics and creates derived delta metrics.
// Original cumulative metrics are preserved for future lookups.
// Delta metrics are created as separate derived metrics for visualization.
func ConvertCumulativeToDelta(ctx context.Context, metrics []api.MetricDataPoint, lookup PreviousValueLookup) CumulativeToDeltaResult {
	var original []api.MetricDataPoint
	var deltas []api.MetricDataPoint

	for _, m := range metrics {
		// Always keep the original metric
		original = append(original, m)

		// Check if this metric should have a delta derived
		if !cumulativeToDeltaMetrics[m.MetricName] {
			continue
		}

		// Only derive delta for sum metrics with cumulative temporality
		if m.MetricType != "sum" {
			logger.Debug("Skipping metric: not a sum", "metric", m.MetricName, "type", m.MetricType)
			continue
		}
		if m.AggregationTemporality == nil {
			logger.Debug("Skipping metric: no aggregation temporality", "metric", m.MetricName)
			continue
		}
		if *m.AggregationTemporality != 2 {
			logger.Debug("Skipping metric: not cumulative", "metric", m.MetricName, "temporality", *m.AggregationTemporality)
			continue
		}

		// Skip if no value
		if m.Value == nil {
			logger.Debug("Skipping metric: no value", "metric", m.MetricName)
			continue
		}

		currentValue := *m.Value

		// Filter to essential attributes for lookup (type, model, etc.)
		// Excludes session-specific attrs like session.id, installation.id, user.email
		lookupAttrs := filterEssentialAttributes(m.MetricName, m.Attributes)
		logger.Debug("Processing metric", "metric", m.MetricName, "currentValue", currentValue, "lookupAttrs", lookupAttrs)

		// Look up previous cumulative value from storage using essential attributes
		prevValue, hasPrev := lookup(ctx, m.MetricName, m.ServiceName, lookupAttrs)

		// Calculate delta
		var delta float64
		if hasPrev {
			delta = currentValue - prevValue
			logger.Debug("Calculated delta", "metric", m.MetricName, "prev", prevValue, "current", currentValue, "delta", delta)
			// Handle counter reset (current < previous)
			if delta < 0 {
				delta = currentValue
				logger.Debug("Counter reset detected", "metric", m.MetricName)
			}
		} else {
			// No previous value - skip delta derivation
			logger.Debug("No previous value, skipping delta", "metric", m.MetricName)
			continue
		}

		// Skip zero deltas (no change)
		if delta == 0 {
			logger.Debug("Zero delta, skipping", "metric", m.MetricName)
			continue
		}

		// Create derived delta metric with ".delta" suffix
		derived := m
		derived.MetricName = m.MetricName + ".delta"
		derived.Value = &delta
		deltaTemp := int32(1) // DELTA temporality
		derived.AggregationTemporality = &deltaTemp

		logger.Debug("Created delta metric", "metric", derived.MetricName, "value", delta)
		deltas = append(deltas, derived)
	}

	logger.Debug("ConvertCumulativeToDelta complete", "originals", len(original), "deltas", len(deltas))
	return CumulativeToDeltaResult{Original: original, Deltas: deltas}
}
