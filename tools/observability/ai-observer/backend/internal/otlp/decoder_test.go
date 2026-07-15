package otlp

import (
	"testing"
)

func TestGetDecoder_Protobuf(t *testing.T) {
	tests := []struct {
		contentType string
	}{
		{"application/x-protobuf"},
		{"application/x-protobuf; charset=utf-8"},
		{"APPLICATION/X-PROTOBUF"},
	}

	for _, tt := range tests {
		t.Run(tt.contentType, func(t *testing.T) {
			decoder, err := GetDecoder(tt.contentType)
			if err != nil {
				t.Fatalf("GetDecoder(%q) error = %v", tt.contentType, err)
			}
			if _, ok := decoder.(*ProtoDecoder); !ok {
				t.Errorf("GetDecoder(%q) = %T, want *ProtoDecoder", tt.contentType, decoder)
			}
		})
	}
}

func TestGetDecoder_JSON(t *testing.T) {
	tests := []struct {
		contentType string
	}{
		{"application/json"},
		{"application/json; charset=utf-8"},
		{"APPLICATION/JSON"},
	}

	for _, tt := range tests {
		t.Run(tt.contentType, func(t *testing.T) {
			decoder, err := GetDecoder(tt.contentType)
			if err != nil {
				t.Fatalf("GetDecoder(%q) error = %v", tt.contentType, err)
			}
			if _, ok := decoder.(*JSONDecoder); !ok {
				t.Errorf("GetDecoder(%q) = %T, want *JSONDecoder", tt.contentType, decoder)
			}
		})
	}
}

func TestGetDecoder_EmptyDefaultsToProtobuf(t *testing.T) {
	decoder, err := GetDecoder("")
	if err != nil {
		t.Fatalf("GetDecoder(\"\") error = %v", err)
	}
	if _, ok := decoder.(*ProtoDecoder); !ok {
		t.Errorf("GetDecoder(\"\") = %T, want *ProtoDecoder (default)", decoder)
	}
}

func TestGetDecoder_UnsupportedContentType(t *testing.T) {
	tests := []string{
		"text/plain",
		"text/html",
		"application/xml",
		"multipart/form-data",
	}

	for _, ct := range tests {
		t.Run(ct, func(t *testing.T) {
			_, err := GetDecoder(ct)
			if err == nil {
				t.Errorf("GetDecoder(%q) expected error, got nil", ct)
			}
		})
	}
}
