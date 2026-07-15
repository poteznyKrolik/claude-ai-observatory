package frontend

import (
	"embed"
	"io/fs"
	"net/http"
)

//go:embed dist/*
var distFS embed.FS

// GetFileSystem returns an http.FileSystem rooted at dist/
func GetFileSystem() (http.FileSystem, error) {
	sub, err := fs.Sub(distFS, "dist")
	if err != nil {
		return nil, err
	}
	return http.FS(sub), nil
}
