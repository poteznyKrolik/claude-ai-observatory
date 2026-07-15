package websocket

import (
	"encoding/json"
	"sync"
	"testing"
	"time"
)

// MockClient creates a test client without a real WebSocket connection
func newMockClient(hub *Hub) *Client {
	return &Client{
		hub:  hub,
		conn: nil,
		send: make(chan []byte, sendBufferSize),
	}
}

func TestNewHub(t *testing.T) {
	hub := NewHub()

	if hub == nil {
		t.Fatal("NewHub returned nil")
	}

	if hub.clients == nil {
		t.Error("clients map is nil")
	}

	if hub.broadcast == nil {
		t.Error("broadcast channel is nil")
	}

	if hub.register == nil {
		t.Error("register channel is nil")
	}

	if hub.unregister == nil {
		t.Error("unregister channel is nil")
	}
}

func TestHubClientRegistration(t *testing.T) {
	hub := NewHub()
	go hub.Run()

	// Give hub time to start
	time.Sleep(10 * time.Millisecond)

	// Create and register a client
	client := newMockClient(hub)
	hub.register <- client

	// Wait for registration to process
	time.Sleep(10 * time.Millisecond)

	// Check client count
	if count := hub.ClientCount(); count != 1 {
		t.Errorf("expected 1 client, got %d", count)
	}
}

func TestHubClientUnregistration(t *testing.T) {
	hub := NewHub()
	go hub.Run()

	time.Sleep(10 * time.Millisecond)

	// Create and register a client
	client := newMockClient(hub)
	hub.register <- client

	time.Sleep(10 * time.Millisecond)

	if hub.ClientCount() != 1 {
		t.Fatalf("expected 1 client before unregister, got %d", hub.ClientCount())
	}

	// Unregister the client
	hub.unregister <- client

	time.Sleep(10 * time.Millisecond)

	if count := hub.ClientCount(); count != 0 {
		t.Errorf("expected 0 clients after unregister, got %d", count)
	}
}

func TestHubDoubleUnregister(t *testing.T) {
	// Tests that unregistering a client twice doesn't panic
	hub := NewHub()
	go hub.Run()

	time.Sleep(10 * time.Millisecond)

	client := newMockClient(hub)
	hub.register <- client

	time.Sleep(10 * time.Millisecond)

	// Unregister twice - should not panic due to sync.Once in client.Close()
	hub.unregister <- client
	time.Sleep(10 * time.Millisecond)

	hub.unregister <- client
	time.Sleep(10 * time.Millisecond)

	if count := hub.ClientCount(); count != 0 {
		t.Errorf("expected 0 clients, got %d", count)
	}
}

func TestHubBroadcast(t *testing.T) {
	hub := NewHub()
	go hub.Run()

	time.Sleep(10 * time.Millisecond)

	// Register multiple clients
	client1 := newMockClient(hub)
	client2 := newMockClient(hub)
	client3 := newMockClient(hub)

	hub.register <- client1
	hub.register <- client2
	hub.register <- client3

	time.Sleep(20 * time.Millisecond)

	if hub.ClientCount() != 3 {
		t.Fatalf("expected 3 clients, got %d", hub.ClientCount())
	}

	// Broadcast a message
	testMsg := Message{
		Type:    "test",
		Payload: []string{"hello", "world"},
	}
	hub.Broadcast(testMsg)

	// Wait for broadcast to be processed
	time.Sleep(50 * time.Millisecond)

	// Check that all clients received the message
	for i, client := range []*Client{client1, client2, client3} {
		select {
		case data := <-client.send:
			var received Message
			if err := json.Unmarshal(data, &received); err != nil {
				t.Errorf("client %d: failed to unmarshal message: %v", i+1, err)
				continue
			}
			if received.Type != testMsg.Type {
				t.Errorf("client %d: expected type %s, got %s", i+1, testMsg.Type, received.Type)
			}
		case <-time.After(100 * time.Millisecond):
			t.Errorf("client %d: did not receive message", i+1)
		}
	}
}

func TestHubBroadcastOrder(t *testing.T) {
	hub := NewHub()
	go hub.Run()

	time.Sleep(10 * time.Millisecond)

	client := newMockClient(hub)
	hub.register <- client

	time.Sleep(10 * time.Millisecond)

	// Send multiple messages
	messages := []Message{
		{Type: "msg1", Payload: "first"},
		{Type: "msg2", Payload: "second"},
		{Type: "msg3", Payload: "third"},
	}

	for _, msg := range messages {
		hub.Broadcast(msg)
	}

	time.Sleep(50 * time.Millisecond)

	// Verify order
	for i, expected := range messages {
		select {
		case data := <-client.send:
			var received Message
			if err := json.Unmarshal(data, &received); err != nil {
				t.Errorf("message %d: failed to unmarshal: %v", i+1, err)
				continue
			}
			if received.Type != expected.Type {
				t.Errorf("message %d: expected type %s, got %s", i+1, expected.Type, received.Type)
			}
		case <-time.After(100 * time.Millisecond):
			t.Errorf("message %d: not received", i+1)
		}
	}
}

func TestHubConcurrentRegistration(t *testing.T) {
	hub := NewHub()
	go hub.Run()

	time.Sleep(10 * time.Millisecond)

	// Concurrently register many clients
	numClients := 100
	var wg sync.WaitGroup
	clients := make([]*Client, numClients)

	for i := 0; i < numClients; i++ {
		wg.Add(1)
		go func(idx int) {
			defer wg.Done()
			client := newMockClient(hub)
			clients[idx] = client
			hub.register <- client
		}(i)
	}

	wg.Wait()
	time.Sleep(100 * time.Millisecond)

	if count := hub.ClientCount(); count != numClients {
		t.Errorf("expected %d clients, got %d", numClients, count)
	}
}

func TestHubConcurrentBroadcast(t *testing.T) {
	hub := NewHub()
	go hub.Run()

	time.Sleep(10 * time.Millisecond)

	// Register a few clients
	numClients := 5
	clients := make([]*Client, numClients)
	for i := 0; i < numClients; i++ {
		clients[i] = newMockClient(hub)
		hub.register <- clients[i]
	}

	time.Sleep(20 * time.Millisecond)

	// Concurrently broadcast messages
	numMessages := 50
	var wg sync.WaitGroup

	for i := 0; i < numMessages; i++ {
		wg.Add(1)
		go func(idx int) {
			defer wg.Done()
			hub.Broadcast(Message{Type: "concurrent", Payload: idx})
		}(i)
	}

	wg.Wait()
	time.Sleep(100 * time.Millisecond)

	// Count received messages per client
	for i, client := range clients {
		count := 0
		timeout := time.After(200 * time.Millisecond)
	drain:
		for {
			select {
			case <-client.send:
				count++
			case <-timeout:
				break drain
			default:
				break drain
			}
		}

		// All messages should have been received (some may be dropped if buffer full)
		if count == 0 {
			t.Errorf("client %d received 0 messages", i)
		}
	}
}

func TestClientClose(t *testing.T) {
	hub := NewHub()
	client := newMockClient(hub)

	// First close should succeed
	client.Close()

	// Second close should not panic (sync.Once ensures this)
	client.Close()

	// Third close should still not panic
	client.Close()
}

func TestHubBroadcastChannelFull(t *testing.T) {
	hub := NewHub()
	// Don't start hub.Run() - broadcast channel will fill up

	// Fill the broadcast channel
	for i := 0; i < 256; i++ {
		hub.Broadcast(Message{Type: "fill", Payload: i})
	}

	// This should not block - it should drop the message
	done := make(chan bool)
	go func() {
		hub.Broadcast(Message{Type: "overflow", Payload: "dropped"})
		done <- true
	}()

	select {
	case <-done:
		// Success - didn't block
	case <-time.After(100 * time.Millisecond):
		t.Error("Broadcast blocked when channel was full")
	}
}
