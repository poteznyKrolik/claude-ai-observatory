package api

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestWriteError(t *testing.T) {
	tests := []struct {
		name       string
		statusCode int
		message    string
		wantError  string
	}{
		{
			name:       "bad request",
			statusCode: http.StatusBadRequest,
			message:    "invalid input",
			wantError:  "Bad Request",
		},
		{
			name:       "not found",
			statusCode: http.StatusNotFound,
			message:    "resource not found",
			wantError:  "Not Found",
		},
		{
			name:       "internal server error",
			statusCode: http.StatusInternalServerError,
			message:    "database connection failed",
			wantError:  "Internal Server Error",
		},
		{
			name:       "unauthorized",
			statusCode: http.StatusUnauthorized,
			message:    "missing token",
			wantError:  "Unauthorized",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			rec := httptest.NewRecorder()

			WriteError(rec, tt.statusCode, tt.message)

			// Check status code
			if rec.Code != tt.statusCode {
				t.Errorf("expected status %d, got %d", tt.statusCode, rec.Code)
			}

			// Check Content-Type header
			if ct := rec.Header().Get("Content-Type"); ct != "application/json" {
				t.Errorf("expected Content-Type application/json, got %s", ct)
			}

			// Parse response body
			var resp ErrorResponse
			if err := json.NewDecoder(rec.Body).Decode(&resp); err != nil {
				t.Fatalf("failed to decode response: %v", err)
			}

			if resp.Error != tt.wantError {
				t.Errorf("expected error %q, got %q", tt.wantError, resp.Error)
			}
			if resp.Message != tt.message {
				t.Errorf("expected message %q, got %q", tt.message, resp.Message)
			}
		})
	}
}

func TestWriteError_EmptyMessage(t *testing.T) {
	rec := httptest.NewRecorder()

	WriteError(rec, http.StatusBadRequest, "")

	if rec.Code != http.StatusBadRequest {
		t.Errorf("expected status 400, got %d", rec.Code)
	}

	var resp ErrorResponse
	if err := json.NewDecoder(rec.Body).Decode(&resp); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}

	if resp.Error != "Bad Request" {
		t.Errorf("expected error 'Bad Request', got %q", resp.Error)
	}
	if resp.Message != "" {
		t.Errorf("expected empty message, got %q", resp.Message)
	}
}

func TestWriteJSON(t *testing.T) {
	tests := []struct {
		name       string
		statusCode int
		data       interface{}
	}{
		{
			name:       "simple object",
			statusCode: http.StatusOK,
			data:       map[string]string{"key": "value"},
		},
		{
			name:       "created response",
			statusCode: http.StatusCreated,
			data:       map[string]interface{}{"id": 123, "name": "test"},
		},
		{
			name:       "array response",
			statusCode: http.StatusOK,
			data:       []string{"item1", "item2", "item3"},
		},
		{
			name:       "nested object",
			statusCode: http.StatusOK,
			data: map[string]interface{}{
				"user": map[string]interface{}{
					"name":  "John",
					"email": "john@example.com",
				},
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			rec := httptest.NewRecorder()

			WriteJSON(rec, tt.statusCode, tt.data)

			// Check status code
			if rec.Code != tt.statusCode {
				t.Errorf("expected status %d, got %d", tt.statusCode, rec.Code)
			}

			// Check Content-Type header
			if ct := rec.Header().Get("Content-Type"); ct != "application/json" {
				t.Errorf("expected Content-Type application/json, got %s", ct)
			}

			// Verify body is valid JSON
			var result interface{}
			if err := json.NewDecoder(rec.Body).Decode(&result); err != nil {
				t.Fatalf("failed to decode response: %v", err)
			}
		})
	}
}

func TestWriteJSON_EmptyObject(t *testing.T) {
	rec := httptest.NewRecorder()

	WriteJSON(rec, http.StatusOK, map[string]interface{}{})

	if rec.Code != http.StatusOK {
		t.Errorf("expected status 200, got %d", rec.Code)
	}

	body := rec.Body.String()
	if body != "{}\n" {
		t.Errorf("expected empty JSON object, got %q", body)
	}
}

func TestWriteJSON_Nil(t *testing.T) {
	rec := httptest.NewRecorder()

	WriteJSON(rec, http.StatusOK, nil)

	if rec.Code != http.StatusOK {
		t.Errorf("expected status 200, got %d", rec.Code)
	}

	body := rec.Body.String()
	if body != "null\n" {
		t.Errorf("expected null, got %q", body)
	}
}

func TestWriteJSON_Struct(t *testing.T) {
	type TestData struct {
		ID      int    `json:"id"`
		Name    string `json:"name"`
		Active  bool   `json:"active"`
		private string // Should not be serialized
	}

	rec := httptest.NewRecorder()

	data := TestData{
		ID:      1,
		Name:    "Test",
		Active:  true,
		private: "secret",
	}

	WriteJSON(rec, http.StatusOK, data)

	if rec.Code != http.StatusOK {
		t.Errorf("expected status 200, got %d", rec.Code)
	}

	var result map[string]interface{}
	if err := json.NewDecoder(rec.Body).Decode(&result); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}

	if result["id"].(float64) != 1 {
		t.Errorf("expected id 1, got %v", result["id"])
	}
	if result["name"].(string) != "Test" {
		t.Errorf("expected name 'Test', got %v", result["name"])
	}
	if result["active"].(bool) != true {
		t.Errorf("expected active true, got %v", result["active"])
	}
	if _, exists := result["private"]; exists {
		t.Error("private field should not be serialized")
	}
}

func TestWriteJSON_NoContent(t *testing.T) {
	rec := httptest.NewRecorder()

	// 204 No Content typically has no body, but WriteJSON will still encode
	WriteJSON(rec, http.StatusNoContent, struct{}{})

	if rec.Code != http.StatusNoContent {
		t.Errorf("expected status 204, got %d", rec.Code)
	}
}

// Test ErrorResponse struct directly
func TestErrorResponse_JSON(t *testing.T) {
	resp := ErrorResponse{
		Error:   "Not Found",
		Message: "user not found",
	}

	data, err := json.Marshal(resp)
	if err != nil {
		t.Fatalf("failed to marshal: %v", err)
	}

	expected := `{"error":"Not Found","message":"user not found"}`
	if string(data) != expected {
		t.Errorf("expected %s, got %s", expected, string(data))
	}
}

func TestErrorResponse_OmitEmptyMessage(t *testing.T) {
	resp := ErrorResponse{
		Error: "Bad Request",
	}

	data, err := json.Marshal(resp)
	if err != nil {
		t.Fatalf("failed to marshal: %v", err)
	}

	// Message field should be omitted when empty
	expected := `{"error":"Bad Request"}`
	if string(data) != expected {
		t.Errorf("expected %s, got %s", expected, string(data))
	}
}
