package frontend

import (
	"io"
	"net/http"
	"os"
	"path"
	"strings"
)

// SPAHandler serves embedded frontend files with SPA routing support
type SPAHandler struct {
	fs http.FileSystem
}

// NewSPAHandler creates a new SPA handler for the embedded frontend
func NewSPAHandler() (*SPAHandler, error) {
	fsys, err := GetFileSystem()
	if err != nil {
		return nil, err
	}
	return &SPAHandler{fs: fsys}, nil
}

// ServeHTTP serves static files and falls back to index.html for SPA routing
func (h *SPAHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	// Clean the path
	upath := r.URL.Path
	if upath == "" {
		upath = "/"
	}

	// For root path or paths without extension (SPA routes), serve index.html directly
	if upath == "/" || (!strings.Contains(path.Base(upath), ".") && !strings.HasPrefix(upath, "/assets/")) {
		h.serveIndex(w, r)
		return
	}

	// Try to open the file
	f, err := h.fs.Open(path.Clean(upath))
	if err != nil {
		if os.IsNotExist(err) {
			// File not found - serve index.html for SPA routing
			h.serveIndex(w, r)
			return
		}
		http.Error(w, "Internal Server Error", http.StatusInternalServerError)
		return
	}
	defer f.Close()

	// Check if it's a directory
	stat, err := f.Stat()
	if err != nil {
		http.Error(w, "Internal Server Error", http.StatusInternalServerError)
		return
	}

	// If directory, serve index.html
	if stat.IsDir() {
		h.serveIndex(w, r)
		return
	}

	// Serve the file with proper content type
	http.FileServer(h.fs).ServeHTTP(w, r)
}

func (h *SPAHandler) serveIndex(w http.ResponseWriter, r *http.Request) {
	// Open index.html directly and serve its contents
	// This avoids http.FileServer's redirect from /index.html to /
	f, err := h.fs.Open("index.html")
	if err != nil {
		http.Error(w, "index.html not found", http.StatusNotFound)
		return
	}
	defer f.Close()

	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	io.Copy(w, f)
}
