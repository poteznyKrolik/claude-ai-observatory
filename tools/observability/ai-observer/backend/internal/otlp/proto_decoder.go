package otlp

import (
	"fmt"
	"io"

	collogspb "go.opentelemetry.io/proto/otlp/collector/logs/v1"
	colmetricspb "go.opentelemetry.io/proto/otlp/collector/metrics/v1"
	coltracepb "go.opentelemetry.io/proto/otlp/collector/trace/v1"
	"google.golang.org/protobuf/proto"
)

// ProtoDecoder decodes OTLP protobuf messages
type ProtoDecoder struct{}

// DecodeTraces decodes a protobuf-encoded traces request
func (d *ProtoDecoder) DecodeTraces(r io.Reader) (*coltracepb.ExportTraceServiceRequest, error) {
	data, err := io.ReadAll(r)
	if err != nil {
		return nil, fmt.Errorf("reading body: %w", err)
	}

	req := &coltracepb.ExportTraceServiceRequest{}
	if err := proto.Unmarshal(data, req); err != nil {
		return nil, fmt.Errorf("unmarshaling traces: %w", err)
	}

	return req, nil
}

// DecodeMetrics decodes a protobuf-encoded metrics request
func (d *ProtoDecoder) DecodeMetrics(r io.Reader) (*colmetricspb.ExportMetricsServiceRequest, error) {
	data, err := io.ReadAll(r)
	if err != nil {
		return nil, fmt.Errorf("reading body: %w", err)
	}

	req := &colmetricspb.ExportMetricsServiceRequest{}
	if err := proto.Unmarshal(data, req); err != nil {
		return nil, fmt.Errorf("unmarshaling metrics: %w", err)
	}

	return req, nil
}

// DecodeLogs decodes a protobuf-encoded logs request
func (d *ProtoDecoder) DecodeLogs(r io.Reader) (*collogspb.ExportLogsServiceRequest, error) {
	data, err := io.ReadAll(r)
	if err != nil {
		return nil, fmt.Errorf("reading body: %w", err)
	}

	req := &collogspb.ExportLogsServiceRequest{}
	if err := proto.Unmarshal(data, req); err != nil {
		// Try with DiscardUnknown in case there are newer/unknown fields
		opts := proto.UnmarshalOptions{DiscardUnknown: true}
		if err2 := opts.Unmarshal(data, req); err2 != nil {
			return nil, fmt.Errorf("unmarshaling logs: %w (also tried with DiscardUnknown: %v)", err, err2)
		}
	}

	return req, nil
}

// DecodeLogsWithCodexFallback tries standard decoding first, then falls back to Codex CLI format
func (d *ProtoDecoder) DecodeLogsWithCodexFallback(r io.Reader) (*collogspb.ExportLogsServiceRequest, error) {
	data, err := io.ReadAll(r)
	if err != nil {
		return nil, fmt.Errorf("reading body: %w", err)
	}

	req := &collogspb.ExportLogsServiceRequest{}
	if err := proto.Unmarshal(data, req); err != nil {
		// Standard decoding failed, return error with marker for handler to try Codex decoder
		return nil, &CodexFormatError{Data: data, OriginalError: err}
	}

	return req, nil
}

// CodexFormatError indicates the data might be in Codex CLI's non-standard format
type CodexFormatError struct {
	Data          []byte
	OriginalError error
}

func (e *CodexFormatError) Error() string {
	return fmt.Sprintf("standard OTLP decode failed: %v", e.OriginalError)
}
