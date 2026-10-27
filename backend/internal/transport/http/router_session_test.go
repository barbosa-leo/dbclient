package http_test

import (
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"testing"

	transporthttp "dbclient/backend/internal/transport/http"
	"dbclient/backend/internal/transport/http/handler"
)

func TestSessionModeDoesNotExposeLocalRoutes(t *testing.T) {
	router := transporthttp.NewRouter(transporthttp.RouterDeps{
		Logger: slog.New(slog.NewTextHandler(io.Discard, nil)),
		Auth:   handler.NewAuthHandler(nil, nil, nil),
	})
	srv := httptest.NewServer(router)
	defer srv.Close()

	for _, path := range []string{"/api/auth/local?token=anything", "/api/app-config"} {
		res, err := http.Get(srv.URL + path)
		if err != nil {
			t.Fatal(err)
		}
		res.Body.Close()
		if res.StatusCode != http.StatusNotFound {
			t.Fatalf("expected 404 on %s in session mode, got %d", path, res.StatusCode)
		}
	}
}
