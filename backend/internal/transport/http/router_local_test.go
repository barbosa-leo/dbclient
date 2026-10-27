//go:build desktop

package http_test

import (
	"context"
	"encoding/json"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"dbclient/backend/internal/adapter/crypto"
	"dbclient/backend/internal/adapter/sqlite"
	"dbclient/backend/internal/domain"
	transporthttp "dbclient/backend/internal/transport/http"
	"dbclient/backend/internal/transport/http/handler"
	"dbclient/backend/internal/transport/http/middleware"
	"dbclient/backend/internal/usecase/auth"
)

func TestLocalModeRoutes(t *testing.T) {
	const token = "0123456789abcdef0123456789abcdef"

	ctx := context.Background()
	hasher := crypto.NewBcryptHasher()
	db, err := sqlite.Open(ctx, t.TempDir(), hasher)
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()

	userRepo := sqlite.NewUserRepository(db)
	sessionRepo := sqlite.NewSessionRepository(db)

	router := transporthttp.NewRouter(transporthttp.RouterDeps{
		Logger:      slog.New(slog.NewTextHandler(io.Discard, nil)),
		AuthSession: auth.NewAuthenticateSession(sessionRepo, userRepo),
		Auth:        handler.NewAuthHandler(nil, nil, nil),
		LocalAuth:   handler.NewLocalAuthHandler(auth.NewLocalSignIn(userRepo, sessionRepo, hasher, token, time.Hour)),
	})
	srv := httptest.NewServer(router)
	defer srv.Close()

	client := &http.Client{CheckRedirect: func(*http.Request, []*http.Request) error {
		return http.ErrUseLastResponse
	}}

	do := func(method, path string, cookie *http.Cookie) *http.Response {
		t.Helper()
		req, _ := http.NewRequest(method, srv.URL+path, nil)
		if cookie != nil {
			req.AddCookie(cookie)
		}
		res, err := client.Do(req)
		if err != nil {
			t.Fatalf("%s %s failed: %v", method, path, err)
		}
		t.Cleanup(func() { res.Body.Close() })
		return res
	}

	if res := do(http.MethodGet, "/api/auth/local?token=wrong", nil); res.StatusCode != http.StatusUnauthorized || len(res.Cookies()) != 0 {
		t.Fatalf("expected 401 without cookie for invalid token, got %d", res.StatusCode)
	}

	signIn := do(http.MethodGet, "/api/auth/local?token="+token, nil)
	if signIn.StatusCode != http.StatusSeeOther || signIn.Header.Get("Location") != "/" {
		t.Fatalf("expected 303 to /, got %d %q", signIn.StatusCode, signIn.Header.Get("Location"))
	}
	var session *http.Cookie
	for _, c := range signIn.Cookies() {
		if c.Name == middleware.SessionCookieName {
			session = c
		}
	}
	if session == nil || !session.HttpOnly || session.SameSite != http.SameSiteStrictMode {
		t.Fatalf("expected HttpOnly SameSite=Strict session cookie, got %+v", session)
	}

	me := do(http.MethodGet, "/api/auth/me", session)
	if me.StatusCode != http.StatusOK {
		t.Fatalf("expected 200 on /api/auth/me, got %d", me.StatusCode)
	}
	var user domain.User
	if err := json.NewDecoder(me.Body).Decode(&user); err != nil {
		t.Fatal(err)
	}
	if user.Role != domain.RoleAdmin || user.MustChangePassword {
		t.Fatalf("expected admin without pending password change, got %+v", user)
	}

	stored, err := userRepo.FindByID(ctx, user.ID)
	if err != nil {
		t.Fatal(err)
	}
	if hasher.Compare(stored.PasswordHash, "admin") == nil {
		t.Fatal("expected default admin password to be replaced")
	}

	if res := do(http.MethodGet, "/api/app-config", nil); res.StatusCode != http.StatusOK {
		t.Fatalf("expected 200 on /api/app-config, got %d", res.StatusCode)
	}

	for _, route := range []struct{ method, path string }{
		{http.MethodPost, "/api/auth/login"},
		{http.MethodPost, "/api/auth/logout"},
		{http.MethodPost, "/api/auth/password"},
		{http.MethodGet, "/api/users"},
		{http.MethodPost, "/api/users"},
		{http.MethodPut, "/api/users/1"},
		{http.MethodDelete, "/api/users/1"},
	} {
		if res := do(route.method, route.path, session); res.StatusCode != http.StatusNotFound {
			t.Fatalf("expected 404 on %s %s in local mode, got %d", route.method, route.path, res.StatusCode)
		}
	}
}
