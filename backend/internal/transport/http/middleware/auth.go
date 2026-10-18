package middleware

import (
	"encoding/json"
	"net/http"

	"dbclient/backend/internal/domain"
	"dbclient/backend/internal/usecase/auth"
)

const SessionCookieName = "dbclient_session"

func Authenticate(authSession *auth.AuthenticateSession, allowMustChangePassword bool) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			cookie, err := r.Cookie(SessionCookieName)
			if err != nil || cookie.Value == "" {
				writeError(w, http.StatusUnauthorized, "Não autenticado")
				return
			}

			user, err := authSession.Execute(r.Context(), cookie.Value)
			if err != nil {
				writeError(w, http.StatusUnauthorized, "Não autenticado")
				return
			}

			if user.MustChangePassword && !allowMustChangePassword {
				writeError(w, http.StatusForbidden, "Troca de senha obrigatória")
				return
			}

			ctx := WithUser(r.Context(), user, cookie.Value)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

func RequireAdmin(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		user, ok := UserFromContext(r.Context())
		if !ok {
			writeError(w, http.StatusUnauthorized, "Não autenticado")
			return
		}
		if user.Role != domain.RoleAdmin {
			writeError(w, http.StatusForbidden, "Acesso negado")
			return
		}
		next.ServeHTTP(w, r)
	})
}

func RequireOperatorOrAdmin(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		user, ok := UserFromContext(r.Context())
		if !ok {
			writeError(w, http.StatusUnauthorized, "Não autenticado")
			return
		}
		if user.Role != domain.RoleAdmin && user.Role != domain.RoleOperator {
			writeError(w, http.StatusForbidden, "Acesso negado")
			return
		}
		next.ServeHTTP(w, r)
	})
}

func writeError(w http.ResponseWriter, status int, message string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(map[string]string{"error": message})
}
