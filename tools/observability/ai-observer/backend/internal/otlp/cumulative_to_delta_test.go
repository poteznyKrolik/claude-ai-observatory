package otlp

import (
	"context"
	"testing"

	"github.com/tobilg/ai-observer/internal/api"
)

func TestConvertCumulativeToDelta_BasicConversion(t *testing.T) {
	cumulativeTemp := int32(2)
	isMonotonic := true

	// Simulate a lookup that returns a previous value
	// ConvertCumulativeToDelta uses essential attributes (type, model) for series matching
	prevValues := map[string]float64{
		"gemini_cli.token.usage|gemini-cli|model=gemini-2.5-flash|type=input": 100.0,
	}
	lookup := func(ctx context.Context, metricName, serviceName string, attributes map[string]string) (float64, bool) {
		key := BuildSeriesKey(metricName, serviceName, attributes)
		v, ok := prevValues[key]
		return v, ok
	}

	metrics := []api.MetricDataPoint{
		{
			MetricName:             "gemini_cli.token.usage",
			ServiceName:            "gemini-cli",
			MetricType:             "sum",
			Attributes:             map[string]string{"type": "input", "model": "gemini-2.5-flash"},
			Value:                  ptr(150.0), // +50 from previous 100
			AggregationTemporality: &cumulativeTemp,
			IsMonotonic:            &isMonotonic,
		},
	}

	result := ConvertCumulativeToDelta(context.Background(), metrics, lookup)

	// Should have 1 original metric
	if len(result.Original) != 1 {
		t.Fatalf("Expected 1 original metric, got %d", len(result.Original))
	}

	// Should have 1 delta metric
	if len(result.Deltas) != 1 {
		t.Fatalf("Expected 1 delta metric, got %d", len(result.Deltas))
	}

	// Delta should have .delta suffix
	if result.Deltas[0].MetricName != "gemini_cli.token.usage.delta" {
		t.Errorf("Expected metric name with .delta suffix, got %s", result.Deltas[0].MetricName)
	}

	// Should have delta of 50 (150 - 100)
	if *result.Deltas[0].Value != 50.0 {
		t.Errorf("Expected delta 50, got %f", *result.Deltas[0].Value)
	}

	// Should have DELTA temporality
	if *result.Deltas[0].AggregationTemporality != 1 {
		t.Errorf("Expected DELTA temporality (1), got %d", *result.Deltas[0].AggregationTemporality)
	}

	// Original should be unchanged
	if *result.Original[0].Value != 150.0 {
		t.Errorf("Expected original value 150, got %f", *result.Original[0].Value)
	}
}

func TestConvertCumulativeToDelta_NoPreviousValue(t *testing.T) {
	cumulativeTemp := int32(2)
	isMonotonic := true

	// Lookup returns false (no previous value)
	lookup := func(ctx context.Context, metricName, serviceName string, attributes map[string]string) (float64, bool) {
		return 0, false
	}

	metrics := []api.MetricDataPoint{
		{
			MetricName:             "gemini_cli.token.usage",
			ServiceName:            "gemini-cli",
			MetricType:             "sum",
			Attributes:             map[string]string{"type": "input", "model": "gemini-2.5-flash"},
			Value:                  ptr(100.0),
			AggregationTemporality: &cumulativeTemp,
			IsMonotonic:            &isMonotonic,
		},
	}

	result := ConvertCumulativeToDelta(context.Background(), metrics, lookup)

	// Original should be preserved
	if len(result.Original) != 1 {
		t.Errorf("Expected 1 original metric, got %d", len(result.Original))
	}

	// No delta (no previous value)
	if len(result.Deltas) != 0 {
		t.Errorf("Expected 0 delta metrics when no previous value, got %d", len(result.Deltas))
	}
}

func TestConvertCumulativeToDelta_ZeroDelta(t *testing.T) {
	cumulativeTemp := int32(2)
	isMonotonic := true

	// Previous value equals current value
	lookup := func(ctx context.Context, metricName, serviceName string, attributes map[string]string) (float64, bool) {
		return 100.0, true
	}

	metrics := []api.MetricDataPoint{
		{
			MetricName:             "gemini_cli.token.usage",
			ServiceName:            "gemini-cli",
			MetricType:             "sum",
			Attributes:             map[string]string{"type": "input", "model": "gemini-2.5-flash"},
			Value:                  ptr(100.0), // Same as previous
			AggregationTemporality: &cumulativeTemp,
			IsMonotonic:            &isMonotonic,
		},
	}

	result := ConvertCumulativeToDelta(context.Background(), metrics, lookup)

	// Original should be preserved
	if len(result.Original) != 1 {
		t.Errorf("Expected 1 original metric, got %d", len(result.Original))
	}

	// No delta (zero change)
	if len(result.Deltas) != 0 {
		t.Errorf("Expected 0 delta metrics for zero delta, got %d", len(result.Deltas))
	}
}

func TestConvertCumulativeToDelta_CounterReset(t *testing.T) {
	cumulativeTemp := int32(2)
	isMonotonic := true

	// Previous value is higher than current (counter reset)
	lookup := func(ctx context.Context, metricName, serviceName string, attributes map[string]string) (float64, bool) {
		return 1000.0, true
	}

	metrics := []api.MetricDataPoint{
		{
			MetricName:             "gemini_cli.token.usage",
			ServiceName:            "gemini-cli",
			MetricType:             "sum",
			Attributes:             map[string]string{"type": "input", "model": "gemini-2.5-flash"},
			Value:                  ptr(50.0), // Less than previous (reset)
			AggregationTemporality: &cumulativeTemp,
			IsMonotonic:            &isMonotonic,
		},
	}

	result := ConvertCumulativeToDelta(context.Background(), metrics, lookup)

	if len(result.Deltas) != 1 {
		t.Fatalf("Expected 1 delta metric after counter reset, got %d", len(result.Deltas))
	}

	// On counter reset, should use the new value as delta
	if *result.Deltas[0].Value != 50.0 {
		t.Errorf("Expected delta 50 after reset, got %f", *result.Deltas[0].Value)
	}
}

func TestConvertCumulativeToDelta_NonCumulativePassthrough(t *testing.T) {
	deltaTemp := int32(1)
	isMonotonic := true

	lookup := func(ctx context.Context, metricName, serviceName string, attributes map[string]string) (float64, bool) {
		return 0, false
	}

	// A metric that's already DELTA should pass through unchanged (no delta derived)
	metrics := []api.MetricDataPoint{
		{
			MetricName:             "gemini_cli.token.usage",
			ServiceName:            "gemini-cli",
			MetricType:             "sum",
			Attributes:             map[string]string{"type": "input", "model": "gemini-2.5-flash"},
			Value:                  ptr(100.0),
			AggregationTemporality: &deltaTemp, // Already DELTA
			IsMonotonic:            &isMonotonic,
		},
	}

	result := ConvertCumulativeToDelta(context.Background(), metrics, lookup)

	// Original preserved
	if len(result.Original) != 1 {
		t.Fatalf("Expected 1 original metric, got %d", len(result.Original))
	}

	// No delta derived (already DELTA)
	if len(result.Deltas) != 0 {
		t.Errorf("Expected 0 delta metrics for already-DELTA metric, got %d", len(result.Deltas))
	}

	if *result.Original[0].Value != 100.0 {
		t.Errorf("Expected unchanged value 100, got %f", *result.Original[0].Value)
	}
}

func TestConvertCumulativeToDelta_NonListedMetricPassthrough(t *testing.T) {
	cumulativeTemp := int32(2)

	lookup := func(ctx context.Context, metricName, serviceName string, attributes map[string]string) (float64, bool) {
		return 0, false
	}

	// A cumulative metric NOT in the conversion list should pass through (no delta derived)
	metrics := []api.MetricDataPoint{
		{
			MetricName:             "some.other.metric",
			ServiceName:            "some-service",
			MetricType:             "sum",
			Attributes:             map[string]string{},
			Value:                  ptr(100.0),
			AggregationTemporality: &cumulativeTemp,
		},
	}

	result := ConvertCumulativeToDelta(context.Background(), metrics, lookup)

	// Original preserved
	if len(result.Original) != 1 {
		t.Fatalf("Expected 1 original metric, got %d", len(result.Original))
	}

	// No delta derived (not in conversion list)
	if len(result.Deltas) != 0 {
		t.Errorf("Expected 0 delta metrics for non-listed metric, got %d", len(result.Deltas))
	}

	// Should keep CUMULATIVE temporality
	if *result.Original[0].AggregationTemporality != 2 {
		t.Errorf("Expected CUMULATIVE temporality (2), got %d", *result.Original[0].AggregationTemporality)
	}
}

func TestBuildSeriesKey(t *testing.T) {
	key := BuildSeriesKey("gemini_cli.token.usage", "gemini-cli", map[string]string{
		"type":  "input",
		"model": "gemini-2.5-flash",
	})

	// Keys should be sorted alphabetically
	expected := "gemini_cli.token.usage|gemini-cli|model=gemini-2.5-flash|type=input"
	if key != expected {
		t.Errorf("Expected key %q, got %q", expected, key)
	}
}

func TestShouldConvertToDelta(t *testing.T) {
	tests := []struct {
		metricName string
		expected   bool
	}{
		{"gemini_cli.token.usage", true},
		{"gemini_cli.api.request.count", true},
		{"gemini_cli.file.operation.count", true},
		{"gemini_cli.session.count", true},
		{"gen_ai.client.token.usage", false}, // histogram, not a sum - can't convert
		{"some.other.metric", false},
		{"gemini_cli.cost.usage", false}, // derived metric, not in list
	}

	for _, tc := range tests {
		t.Run(tc.metricName, func(t *testing.T) {
			result := ShouldConvertToDelta(tc.metricName)
			if result != tc.expected {
				t.Errorf("ShouldConvertToDelta(%q) = %v, expected %v", tc.metricName, result, tc.expected)
			}
		})
	}
}

func ptr(f float64) *float64 {
	return &f
}
