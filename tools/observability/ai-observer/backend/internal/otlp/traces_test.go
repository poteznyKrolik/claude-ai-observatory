package otlp

import (
	"testing"
	"time"

	coltracepb "go.opentelemetry.io/proto/otlp/collector/trace/v1"
	commonpb "go.opentelemetry.io/proto/otlp/common/v1"
	resourcepb "go.opentelemetry.io/proto/otlp/resource/v1"
	tracepb "go.opentelemetry.io/proto/otlp/trace/v1"
)

func TestConvertTraces(t *testing.T) {
	traceID := []byte{1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16}
	spanID := []byte{1, 2, 3, 4, 5, 6, 7, 8}
	parentSpanID := []byte{8, 7, 6, 5, 4, 3, 2, 1}
	startTime := uint64(time.Now().UnixNano())
	endTime := startTime + uint64(100*time.Millisecond)

	req := &coltracepb.ExportTraceServiceRequest{
		ResourceSpans: []*tracepb.ResourceSpans{
			{
				Resource: &resourcepb.Resource{
					Attributes: []*commonpb.KeyValue{
						{Key: "service.name", Value: &commonpb.AnyValue{Value: &commonpb.AnyValue_StringValue{StringValue: "test-service"}}},
					},
				},
				ScopeSpans: []*tracepb.ScopeSpans{
					{
						Scope: &commonpb.InstrumentationScope{
							Name:    "test-scope",
							Version: "1.0.0",
						},
						Spans: []*tracepb.Span{
							{
								TraceId:           traceID,
								SpanId:            spanID,
								ParentSpanId:      parentSpanID,
								Name:              "test-span",
								Kind:              tracepb.Span_SPAN_KIND_SERVER,
								StartTimeUnixNano: startTime,
								EndTimeUnixNano:   endTime,
								Status: &tracepb.Status{
									Code:    tracepb.Status_STATUS_CODE_OK,
									Message: "success",
								},
								Attributes: []*commonpb.KeyValue{
									{Key: "http.method", Value: &commonpb.AnyValue{Value: &commonpb.AnyValue_StringValue{StringValue: "GET"}}},
								},
							},
						},
					},
				},
			},
		},
	}

	spans := ConvertTraces(req)

	if len(spans) != 1 {
		t.Fatalf("got %d spans, want 1", len(spans))
	}

	span := spans[0]
	if span.ServiceName != "test-service" {
		t.Errorf("ServiceName = %q, want %q", span.ServiceName, "test-service")
	}
	if span.SpanName != "test-span" {
		t.Errorf("SpanName = %q, want %q", span.SpanName, "test-span")
	}
	if span.SpanKind != "SERVER" {
		t.Errorf("SpanKind = %q, want %q", span.SpanKind, "SERVER")
	}
	if span.StatusCode != "OK" {
		t.Errorf("StatusCode = %q, want %q", span.StatusCode, "OK")
	}
	if span.ScopeName != "test-scope" {
		t.Errorf("ScopeName = %q, want %q", span.ScopeName, "test-scope")
	}
	if span.SpanAttributes["http.method"] != "GET" {
		t.Errorf("SpanAttributes[http.method] = %q, want %q", span.SpanAttributes["http.method"], "GET")
	}
	expectedDuration := int64(100 * time.Millisecond)
	if span.Duration != expectedDuration {
		t.Errorf("Duration = %d, want %d", span.Duration, expectedDuration)
	}
}

func TestConvertTraces_EmptyRequest(t *testing.T) {
	req := &coltracepb.ExportTraceServiceRequest{}
	spans := ConvertTraces(req)

	if len(spans) != 0 {
		t.Errorf("got %d spans, want 0 for empty request", len(spans))
	}
}

func TestExtractServiceName(t *testing.T) {
	tests := []struct {
		name  string
		attrs []*commonpb.KeyValue
		want  string
	}{
		{
			name: "with service.name",
			attrs: []*commonpb.KeyValue{
				{Key: "service.name", Value: &commonpb.AnyValue{Value: &commonpb.AnyValue_StringValue{StringValue: "my-service"}}},
			},
			want: "my-service",
		},
		{
			name:  "without service.name",
			attrs: []*commonpb.KeyValue{},
			want:  "unknown",
		},
		{
			name:  "nil attrs",
			attrs: nil,
			want:  "unknown",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := extractServiceName(tt.attrs)
			if got != tt.want {
				t.Errorf("extractServiceName() = %q, want %q", got, tt.want)
			}
		})
	}
}

func TestSpanKindToString(t *testing.T) {
	tests := []struct {
		kind tracepb.Span_SpanKind
		want string
	}{
		{tracepb.Span_SPAN_KIND_INTERNAL, "INTERNAL"},
		{tracepb.Span_SPAN_KIND_SERVER, "SERVER"},
		{tracepb.Span_SPAN_KIND_CLIENT, "CLIENT"},
		{tracepb.Span_SPAN_KIND_PRODUCER, "PRODUCER"},
		{tracepb.Span_SPAN_KIND_CONSUMER, "CONSUMER"},
		{tracepb.Span_SPAN_KIND_UNSPECIFIED, "UNSPECIFIED"},
	}

	for _, tt := range tests {
		t.Run(tt.want, func(t *testing.T) {
			got := spanKindToString(tt.kind)
			if got != tt.want {
				t.Errorf("spanKindToString(%v) = %q, want %q", tt.kind, got, tt.want)
			}
		})
	}
}

func TestStatusCodeToString(t *testing.T) {
	tests := []struct {
		code tracepb.Status_StatusCode
		want string
	}{
		{tracepb.Status_STATUS_CODE_OK, "OK"},
		{tracepb.Status_STATUS_CODE_ERROR, "ERROR"},
		{tracepb.Status_STATUS_CODE_UNSET, "UNSET"},
	}

	for _, tt := range tests {
		t.Run(tt.want, func(t *testing.T) {
			got := statusCodeToString(tt.code)
			if got != tt.want {
				t.Errorf("statusCodeToString(%v) = %q, want %q", tt.code, got, tt.want)
			}
		})
	}
}

func TestBytesToHex(t *testing.T) {
	tests := []struct {
		name  string
		input []byte
		want  string
	}{
		{"normal", []byte{0x01, 0x02, 0x03}, "010203"},
		{"empty", []byte{}, ""},
		{"nil", nil, ""},
		{"full trace id", []byte{1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16}, "0102030405060708090a0b0c0d0e0f10"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := bytesToHex(tt.input)
			if got != tt.want {
				t.Errorf("bytesToHex(%v) = %q, want %q", tt.input, got, tt.want)
			}
		})
	}
}

func TestNanosToTime(t *testing.T) {
	nanos := uint64(1609459200000000000) // 2021-01-01 00:00:00 UTC
	got := nanosToTime(nanos)

	if got.Year() != 2021 || got.Month() != 1 || got.Day() != 1 {
		t.Errorf("nanosToTime(%d) = %v, want 2021-01-01", nanos, got)
	}
}

func TestAnyValueToString(t *testing.T) {
	tests := []struct {
		name  string
		value *commonpb.AnyValue
		want  string
	}{
		{"nil", nil, ""},
		{"string", &commonpb.AnyValue{Value: &commonpb.AnyValue_StringValue{StringValue: "test"}}, "test"},
		{"bool true", &commonpb.AnyValue{Value: &commonpb.AnyValue_BoolValue{BoolValue: true}}, "true"},
		{"bool false", &commonpb.AnyValue{Value: &commonpb.AnyValue_BoolValue{BoolValue: false}}, "false"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := anyValueToString(tt.value)
			if got != tt.want {
				t.Errorf("anyValueToString() = %q, want %q", got, tt.want)
			}
		})
	}
}
