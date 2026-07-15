package websocket

import "time"

type MessageType string

const (
	MessageTypeTraces  MessageType = "traces"
	MessageTypeMetrics MessageType = "metrics"
	MessageTypeLogs    MessageType = "logs"
)

type Message struct {
	Type      MessageType `json:"type"`
	Timestamp time.Time   `json:"timestamp"`
	Payload   interface{} `json:"payload"`
}

func NewTracesMessage(payload interface{}) Message {
	return Message{
		Type:      MessageTypeTraces,
		Timestamp: time.Now(),
		Payload:   payload,
	}
}

func NewMetricsMessage(payload interface{}) Message {
	return Message{
		Type:      MessageTypeMetrics,
		Timestamp: time.Now(),
		Payload:   payload,
	}
}

func NewLogsMessage(payload interface{}) Message {
	return Message{
		Type:      MessageTypeLogs,
		Timestamp: time.Now(),
		Payload:   payload,
	}
}
