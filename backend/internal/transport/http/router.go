package http

import (
	"io/fs"
	"log/slog"
	"net/http"
	"path"
	"strings"

	"dbclient/backend/internal/transport/http/handler"
	"dbclient/backend/internal/transport/http/middleware"
	"dbclient/backend/internal/usecase/auth"
)

type RouterDeps struct {
	Logger        *slog.Logger
	AuthSession   *auth.AuthenticateSession
	Health        *handler.HealthHandler
	Auth          *handler.AuthHandler
	Users         *handler.UserHandler
	Environments  *handler.EnvironmentHandler
	Connections   *handler.ConnectionHandler
	Explorer      *handler.ExplorerHandler
	Query         *handler.QueryHandler
	Script        *handler.ScriptHandler
	Dump          *handler.DumpHandler
	FrontendFiles fs.FS
}

func NewRouter(deps RouterDeps) http.Handler {
	mux := http.NewServeMux()

	requireAuth := middleware.Authenticate(deps.AuthSession, false)
	requireAuthAllowPasswordChange := middleware.Authenticate(deps.AuthSession, true)
	requireAdmin := func(h http.HandlerFunc) http.Handler {
		return requireAuth(middleware.RequireAdmin(h))
	}
	requireOperator := func(h http.HandlerFunc) http.Handler {
		return requireAuth(h)
	}

	mux.HandleFunc("GET /healthz", deps.Health.Check)

	mux.HandleFunc("POST /api/auth/login", deps.Auth.Login)
	mux.Handle("POST /api/auth/logout", requireAuthAllowPasswordChange(http.HandlerFunc(deps.Auth.Logout)))
	mux.Handle("GET /api/auth/me", requireAuthAllowPasswordChange(http.HandlerFunc(deps.Auth.Me)))
	mux.Handle("POST /api/auth/password", requireAuthAllowPasswordChange(http.HandlerFunc(deps.Auth.ChangePassword)))

	mux.Handle("GET /api/users", requireAdmin(deps.Users.List))
	mux.Handle("POST /api/users", requireAdmin(deps.Users.Create))
	mux.Handle("PUT /api/users/{id}", requireAdmin(deps.Users.Update))
	mux.Handle("DELETE /api/users/{id}", requireAdmin(deps.Users.Delete))

	mux.Handle("GET /api/environments", requireOperator(deps.Environments.List))
	mux.Handle("POST /api/environments", requireAdmin(deps.Environments.Create))
	mux.Handle("DELETE /api/environments/{id}", requireAdmin(deps.Environments.Delete))

	mux.Handle("GET /api/connections", requireOperator(deps.Connections.List))
	mux.Handle("POST /api/connections", requireAdmin(deps.Connections.Create))
	mux.Handle("PUT /api/connections/{id}", requireAdmin(deps.Connections.Update))
	mux.Handle("DELETE /api/connections/{id}", requireAdmin(deps.Connections.Delete))

	mux.Handle("GET /api/connections/{id}/schemas", requireOperator(deps.Explorer.Schemas))
	mux.Handle("GET /api/connections/{id}/schemas/{schema}/tables/{table}/columns", requireOperator(deps.Explorer.Columns))
	mux.Handle("GET /api/connections/{id}/schemas/{schema}/objects/{category}/{name}/definition", requireOperator(deps.Explorer.ObjectDefinition))
	mux.Handle("DELETE /api/connections/{id}/schemas/{schema}/objects/{category}/{name}", requireOperator(deps.Explorer.DropObject))

	mux.Handle("POST /api/connections/{id}/query", requireOperator(deps.Query.Execute))
	mux.Handle("POST /api/connections/{id}/scripts", requireAdmin(deps.Script.Run))

	mux.Handle("POST /api/connections/{id}/dumps/export", requireAdmin(deps.Dump.Export))
	mux.Handle("POST /api/connections/{id}/dumps/import", requireAdmin(deps.Dump.Import))

	mux.Handle("GET /api/jobs/{id}", requireAdmin(deps.Dump.GetJob))
	mux.Handle("POST /api/jobs/{id}/cancel", requireAdmin(deps.Dump.CancelJob))
	mux.Handle("GET /api/jobs/{id}/download", requireAdmin(deps.Dump.DownloadJob))

	mux.Handle("/", newSPAHandler(deps.FrontendFiles))

	return middleware.Logging(deps.Logger)(mux)
}

func newSPAHandler(distFS fs.FS) http.Handler {
	if distFS == nil {
		return http.NotFoundHandler()
	}

	fileServer := http.FileServer(http.FS(distFS))

	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if strings.HasPrefix(r.URL.Path, "/api/") {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusNotFound)
			_, _ = w.Write([]byte(`{"error":"Não encontrado"}`))
			return
		}

		cleanPath := strings.TrimPrefix(path.Clean(r.URL.Path), "/")
		if cleanPath == "" {
			cleanPath = "index.html"
		}

		if existsInFS(distFS, cleanPath) {
			fileServer.ServeHTTP(w, r)
			return
		}

		htmlCandidate := cleanPath + ".html"
		if existsInFS(distFS, htmlCandidate) {
			r2 := r.Clone(r.Context())
			r2.URL.Path = "/" + htmlCandidate
			fileServer.ServeHTTP(w, r2)
			return
		}

		indexCandidate := cleanPath + "/index.html"
		if existsInFS(distFS, indexCandidate) {
			r2 := r.Clone(r.Context())
			r2.URL.Path = "/" + cleanPath + "/"
			fileServer.ServeHTTP(w, r2)
			return
		}

		if existsInFS(distFS, "index.html") {
			r2 := r.Clone(r.Context())
			r2.URL.Path = "/"
			fileServer.ServeHTTP(w, r2)
			return
		}

		http.NotFound(w, r)
	})
}

func existsInFS(fsys fs.FS, name string) bool {
	info, err := fs.Stat(fsys, name)
	return err == nil && !info.IsDir()
}
