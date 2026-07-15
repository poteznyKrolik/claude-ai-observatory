package otlp

import (
	"fmt"
	"io"

	collogspb "go.opentelemetry.io/proto/otlp/collector/logs/v1"
	colmetricspb "go.opentelemetry.io/proto/otlp/collector/metrics/v1"
	coltracepb "go.opentelemetry.io/proto/otlp/collector/trace/v1"
	"google.golang.org/protobuf/encoding/protojson"
)

// JSONDecoder decodes OTLP JSON messages
type JSONDecoder struct{}

// DecodeTraces decodes a JSON-encoded traces request
func (d *JSONDecoder) DecodeTraces(r io.Reader) (*coltracepb.ExportTraceServiceRequest, error) {
	data, err := io.ReadAll(r)
	if err != nil {
		return nil, fmt.Errorf("reading body: %w", err)
	}

	req := &coltracepb.ExportTraceServiceRequest{}
	if err := protojson.Unmarshal(data, req); err != nil {
		return nil, fmt.Errorf("unmarshaling JSON traces: %w", err)
	}

	return req, nil
}

// DecodeMetrics decodes a JSON-encoded metrics request
func (d *JSONDecoder) DecodeMetrics(r io.Reader) (*colmetricspb.ExportMetricsServiceRequest, error) {
	data, err := io.ReadAll(r)
	if err != nil {
		return nil, fmt.Errorf("reading body: %w", err)
	}

	req := &colmetricspb.ExportMetricsServiceRequest{}
	if err := protojson.Unmarshal(data, req); err != nil {
		return nil, fmt.Errorf("unmarshaling JSON metrics: %w", err)
	}

	return req, nil
}

// DecodeLogs decodes a JSON-encoded logs request
func (d *JSONDecoder) DecodeLogs(r io.Reader) (*collogspb.ExportLogsServiceRequest, error) {
	data, err := io.ReadAll(r)
	if err != nil {
		return nil, fmt.Errorf("reading body: %w", err)
	}

	req := &collogspb.ExportLogsServiceRequest{}
	if err := protojson.Unmarshal(data, req); err != nil {
		return nil, fmt.Errorf("unmarshaling JSON logs: %w", err)
	}

	return req, nil
}
