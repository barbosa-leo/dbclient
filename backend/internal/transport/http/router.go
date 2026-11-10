package http

import (
	"io/fs"
	"log/slog"
	"net/http"
	"path"
	"strings"

	"dbclient/backend/internal/domain"
	"dbclient/backend/internal/transport/http/handler"
	"dbclient/backend/internal/transport/http/middleware"
	"dbclient/backend/internal/usecase/auth"
)

type LocalAuthRoutes interface {
	SignIn(w http.ResponseWriter, r *http.Request)
	AppConfig(w http.ResponseWriter, r *http.Request)
}

type RouterDeps struct {
	Logger        *slog.Logger
	AuthSession   *auth.AuthenticateSession
	Authorizer    middleware.ConnectionAuthorizer
	RateLimiter   *middleware.RateLimiter
	Health        *handler.HealthHandler
	Auth          *handler.AuthHandler
	Users         *handler.UserHandler
	Settings      *handler.SettingsHandler
	History       *handler.HistoryHandler
	Updates       *handler.UpdatesHandler
	Environments  *handler.EnvironmentHandler
	Connections   *handler.ConnectionHandler
	Explorer      *handler.ExplorerHandler
	Query         *handler.QueryHandler
	Script        *handler.ScriptHandler
	Dump          *handler.DumpHandler
	LocalAuth     LocalAuthRoutes
	FrontendFiles fs.FS
}

func NewRouter(deps RouterDeps) http.Handler {
	mux := http.NewServeMux()

	requireAuth := middleware.Authenticate(deps.AuthSession, false)
	requireAuthAllowPasswordChange := middleware.Authenticate(deps.AuthSession, true)
	requireAdmin := func(h http.HandlerFunc) http.Handler {
		return requireAuth(middleware.RequireAdmin(h))
	}
	requireMember := func(h http.HandlerFunc) http.Handler {
		return requireAuth(h)
	}
	requireRead := func(h http.HandlerFunc) http.Handler {
		return requireAuth(middleware.RequireConnectionAccess(deps.Authorizer, domain.AccessRead)(h))
	}
	requireWrite := func(h http.HandlerFunc) http.Handler {
		return requireAuth(middleware.RequireConnectionAccess(deps.Authorizer, domain.AccessWrite)(h))
	}

	mux.HandleFunc("GET /healthz", deps.Health.Check)

	mux.Handle("GET /api/auth/me", requireAuthAllowPasswordChange(http.HandlerFunc(deps.Auth.Me)))

	if deps.LocalAuth != nil {
		mux.HandleFunc("GET /api/auth/local", deps.LocalAuth.SignIn)
		mux.HandleFunc("GET /api/app-config", deps.LocalAuth.AppConfig)
	} else {
		mux.HandleFunc("POST /api/auth/login", deps.Auth.Login)
		mux.Handle("POST /api/auth/logout", requireAuthAllowPasswordChange(http.HandlerFunc(deps.Auth.Logout)))
		mux.Handle("POST /api/auth/password", requireAuthAllowPasswordChange(http.HandlerFunc(deps.Auth.ChangePassword)))

		mux.Handle("GET /api/users", requireAdmin(deps.Users.List))
		mux.Handle("POST /api/users", requireAdmin(deps.Users.Create))
		mux.Handle("PUT /api/users/{id}", requireAdmin(deps.Users.Update))
		mux.Handle("DELETE /api/users/{id}", requireAdmin(deps.Users.Delete))
	}

	mux.Handle("GET /api/settings", requireAdmin(deps.Settings.Get))
	mux.Handle("PUT /api/settings", requireAdmin(deps.Settings.Update))

	mux.Handle("GET /api/environments", requireMember(deps.Environments.List))
	mux.Handle("POST /api/environments", requireAdmin(deps.Environments.Create))
	mux.Handle("DELETE /api/environments/{id}", requireAdmin(deps.Environments.Delete))

	mux.Handle("GET /api/connections", requireMember(deps.Connections.List))
	mux.Handle("POST /api/connections", requireAdmin(deps.Connections.Create))
	mux.Handle("POST /api/connections/test", requireAdmin(deps.Connections.Test))
	mux.Handle("POST /api/connections/{id}/test", requireRead(deps.Connections.TestByID))
	mux.Handle("PUT /api/connections/{id}", requireAdmin(deps.Connections.Update))
	mux.Handle("DELETE /api/connections/{id}", requireAdmin(deps.Connections.Delete))

	mux.Handle("GET /api/connections/{id}/schemas", requireRead(deps.Explorer.Schemas))
	mux.Handle("GET /api/connections/{id}/schemas/{schema}/tables/{table}/columns", requireRead(deps.Explorer.Columns))
	mux.Handle("GET /api/connections/{id}/schemas/{schema}/tables/{table}/structure", requireRead(deps.Explorer.Structure))
	mux.Handle("GET /api/connections/{id}/schemas/{schema}/objects/{category}/{name}/definition", requireRead(deps.Explorer.ObjectDefinition))
	mux.Handle("DELETE /api/connections/{id}/schemas/{schema}/objects/{category}/{name}", requireWrite(deps.Explorer.DropObject))

	mux.Handle("GET /api/history", requireMember(deps.History.List))

	mux.Handle("GET /api/updates/seen", requireMember(deps.Updates.ListSeen))
	mux.Handle("POST /api/updates/seen", requireMember(deps.Updates.MarkSeen))

	mux.Handle("POST /api/connections/{id}/query", requireRead(deps.Query.Execute))
	mux.Handle("POST /api/connections/{id}/scripts", requireWrite(deps.Script.Run))

	mux.Handle("POST /api/connections/{id}/dumps/export", requireRead(deps.Dump.Export))
	mux.Handle("POST /api/connections/{id}/dumps/import", requireWrite(deps.Dump.Import))
	mux.Handle("GET /api/dumps", requireMember(deps.Dump.ListUserDumps))
	mux.Handle("DELETE /api/dumps/{id}", requireMember(deps.Dump.DeleteDump))

	mux.Handle("GET /api/jobs/{id}", requireMember(deps.Dump.GetJob))
	mux.Handle("POST /api/jobs/{id}/cancel", requireMember(deps.Dump.CancelJob))
	mux.Handle("GET /api/jobs/{id}/download", requireMember(deps.Dump.DownloadJob))

	mux.Handle("/", newSPAHandler(deps.FrontendFiles))

	var handler http.Handler = mux
	if deps.RateLimiter != nil {
		handler = deps.RateLimiter.Middleware()(handler)
	}

	return middleware.Logging(deps.Logger)(handler)
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
