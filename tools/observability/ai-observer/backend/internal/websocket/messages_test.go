package websocket

import (
	"testing"
	"time"
)

func TestNewTracesMessage(t *testing.T) {
	payload := map[string]string{"trace": "data"}
	before := time.Now()
	msg := NewTracesMessage(payload)
	after := time.Now()

	if msg.Type != MessageTypeTraces {
		t.Errorf("Type = %q, want %q", msg.Type, MessageTypeTraces)
	}
	if msg.Timestamp.Before(before) || msg.Timestamp.After(after) {
		t.Errorf("Timestamp not in expected range")
	}
	if msg.Payload == nil {
		t.Error("Payload is nil")
	}
}

func TestNewMetricsMessage(t *testing.T) {
	payload := []int{1, 2, 3}
	msg := NewMetricsMessage(payload)

	if msg.Type != MessageTypeMetrics {
		t.Errorf("Type = %q, want %q", msg.Type, MessageTypeMetrics)
	}
	if msg.Payload == nil {
		t.Error("Payload is nil")
	}
}

func TestNewLogsMessage(t *testing.T) {
	payload := "log entry"
	msg := NewLogsMessage(payload)

	if msg.Type != MessageTypeLogs {
		t.Errorf("Type = %q, want %q", msg.Type, MessageTypeLogs)
	}
	if msg.Payload != payload {
		t.Errorf("Payload = %v, want %v", msg.Payload, payload)
	}
}

func TestMessageTypes(t *testing.T) {
	if MessageTypeTraces != "traces" {
		t.Errorf("MessageTypeTraces = %q, want %q", MessageTypeTraces, "traces")
	}
	if MessageTypeMetrics != "metrics" {
		t.Errorf("MessageTypeMetrics = %q, want %q", MessageTypeMetrics, "metrics")
	}
	if MessageTypeLogs != "logs" {
		t.Errorf("MessageTypeLogs = %q, want %q", MessageTypeLogs, "logs")
	}
}
