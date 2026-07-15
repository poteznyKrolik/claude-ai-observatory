package websocket

import (
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/gorilla/websocket"
	"github.com/tobilg/ai-observer/internal/logger"
)

const (
	// Time allowed to write a message to the peer.
	writeWait = 10 * time.Second

	// Time allowed to read the next pong message from the peer.
	pongWait = 60 * time.Second

	// Send pings to peer with this period. Must be less than pongWait.
	pingPeriod = (pongWait * 9) / 10

	// Maximum message size allowed from peer.
	maxMessageSize = 512

	// Size of client send buffer.
	sendBufferSize = 256
)

// allowedOrigins holds the list of allowed WebSocket origins
var allowedOrigins []string

// SetAllowedOrigins configures the allowed origins for WebSocket connections
func SetAllowedOrigins(origins []string) {
	allowedOrigins = origins
}

var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
	CheckOrigin: func(r *http.Request) bool {
		origin := r.Header.Get("Origin")
		if origin == "" {
			// Allow requests without Origin header (same-origin requests)
			return true
		}

		for _, allowed := range allowedOrigins {
			// Check for exact match
			if origin == allowed {
				return true
			}
			// Check for localhost with any port (development)
			if strings.HasPrefix(allowed, "http://localhost:") && strings.HasPrefix(origin, "http://localhost:") {
				return true
			}
		}

		logger.Warn("WebSocket origin rejected", "origin", origin, "allowed_origins", allowedOrigins)
		return false
	},
}

// Client represents a single websocket connection.
type Client struct {
	hub       *Hub
	conn      *websocket.Conn
	send      chan []byte
	closeOnce sync.Once // Ensures send channel is closed only once
}

// Close safely closes the client's send channel.
// Safe to call multiple times - only the first call will close the channel.
func (c *Client) Close() {
	c.closeOnce.Do(func() {
		close(c.send)
	})
}

// readPump pumps messages from the websocket connection to the hub.
// We mainly use this to detect disconnection.
func (c *Client) readPump() {
	defer func() {
		c.hub.unregister <- c
		c.conn.Close()
	}()

	c.conn.SetReadLimit(maxMessageSize)
	c.conn.SetReadDeadline(time.Now().Add(pongWait))
	c.conn.SetPongHandler(func(string) error {
		c.conn.SetReadDeadline(time.Now().Add(pongWait))
		return nil
	})

	for {
		_, _, err := c.conn.ReadMessage()
		if err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
				logger.Debug("WebSocket unexpected close", "error", err)
			}
			break
		}
		// We don't process incoming messages for now
		// This is mainly for receiving pong responses
	}
}

// writePump pumps messages from the hub to the websocket connection.
func (c *Client) writePump() {
	ticker := time.NewTicker(pingPeriod)
	defer func() {
		ticker.Stop()
		c.conn.Close()
	}()

	for {
		select {
		case message, ok := <-c.send:
			c.conn.SetWriteDeadline(time.Now().Add(writeWait))
			if !ok {
				// The hub closed the channel.
				c.conn.WriteMessage(websocket.CloseMessage, []byte{})
				return
			}

			w, err := c.conn.NextWriter(websocket.TextMessage)
			if err != nil {
				return
			}
			w.Write(message)

			// Add queued messages to the current websocket message.
			n := len(c.send)
			for i := 0; i < n; i++ {
				w.Write([]byte{'\n'})
				w.Write(<-c.send)
			}

			if err := w.Close(); err != nil {
				return
			}

		case <-ticker.C:
			c.conn.SetWriteDeadline(time.Now().Add(writeWait))
			if err := c.conn.WriteMessage(websocket.PingMessage, nil); err != nil {
				return
			}
		}
	}
}

// ServeWs handles websocket requests from the peer.
func ServeWs(hub *Hub, w http.ResponseWriter, r *http.Request) {
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		logger.Error("WebSocket upgrade error", "error", err)
		return
	}

	client := &Client{
		hub:  hub,
		conn: conn,
		send: make(chan []byte, sendBufferSize),
	}

	hub.register <- client

	// Start goroutines for reading and writing
	go client.writePump()
	go client.readPump()
}
