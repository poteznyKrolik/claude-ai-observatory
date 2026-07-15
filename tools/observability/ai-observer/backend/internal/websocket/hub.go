package websocket

import (
	"encoding/json"
	"sync"

	"github.com/tobilg/ai-observer/internal/logger"
)

// Hub maintains the set of active clients and broadcasts messages to them.
type Hub struct {
	// Registered clients
	clients map[*Client]bool

	// Inbound messages to broadcast
	broadcast chan Message

	// Register requests from clients
	register chan *Client

	// Unregister requests from clients
	unregister chan *Client

	// Mutex for client map
	mu sync.RWMutex
}

// NewHub creates a new Hub instance.
func NewHub() *Hub {
	return &Hub{
		clients:    make(map[*Client]bool),
		broadcast:  make(chan Message, 256),
		register:   make(chan *Client),
		unregister: make(chan *Client),
	}
}

// Run starts the hub's main loop.
func (h *Hub) Run() {
	for {
		select {
		case client := <-h.register:
			h.mu.Lock()
			h.clients[client] = true
			count := len(h.clients)
			h.mu.Unlock()
			logger.Debug("WebSocket client connected", "total_clients", count)

		case client := <-h.unregister:
			h.mu.Lock()
			if _, ok := h.clients[client]; ok {
				delete(h.clients, client)
				client.Close() // Safe to call multiple times
			}
			count := len(h.clients)
			h.mu.Unlock()
			logger.Debug("WebSocket client disconnected", "total_clients", count)

		case message := <-h.broadcast:
			data, err := json.Marshal(message)
			if err != nil {
				logger.Error("Error marshaling WebSocket message", "error", err)
				continue
			}

			h.mu.RLock()
			// Collect clients that need to be disconnected
			var toDisconnect []*Client
			for client := range h.clients {
				select {
				case client.send <- data:
				default:
					// Client buffer full, mark for disconnect
					toDisconnect = append(toDisconnect, client)
				}
			}
			h.mu.RUnlock()

			// Disconnect clients with full buffers (outside the read lock)
			for _, c := range toDisconnect {
				select {
				case h.unregister <- c:
				default:
					// Unregister channel is full, skip this client for now
					logger.Warn("Unregister channel full, skipping client disconnect")
				}
			}
		}
	}
}

// Broadcast sends a message to all connected clients.
func (h *Hub) Broadcast(msg Message) {
	select {
	case h.broadcast <- msg:
	default:
		logger.Warn("Broadcast channel full, dropping message", "message_type", msg.Type)
	}
}

// ClientCount returns the number of connected clients.
func (h *Hub) ClientCount() int {
	h.mu.RLock()
	defer h.mu.RUnlock()
	return len(h.clients)
}
