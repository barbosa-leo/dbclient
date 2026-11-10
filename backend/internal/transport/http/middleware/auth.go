package middleware

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"strconv"

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

type ConnectionAuthorizer interface {
	Execute(ctx context.Context, actor domain.User, connectionID int64, required domain.AccessLevel) (domain.AccessLevel, error)
}

func RequireConnectionAccess(authorizer ConnectionAuthorizer, required domain.AccessLevel) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			user, ok := UserFromContext(r.Context())
			if !ok {
				writeError(w, http.StatusUnauthorized, "Não autenticado")
				return
			}

			connectionID, err := strconv.ParseInt(r.PathValue("id"), 10, 64)
			if err != nil || connectionID <= 0 {
				writeError(w, http.StatusBadRequest, "Identificador inválido")
				return
			}

			if _, err := authorizer.Execute(r.Context(), user, connectionID, required); err != nil {
				var forbidden domain.ForbiddenError
				if errors.As(err, &forbidden) {
					writeError(w, http.StatusForbidden, forbidden.Message)
					return
				}
				writeError(w, http.StatusInternalServerError, "Falha ao verificar permissões")
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}

func writeError(w http.ResponseWriter, status int, message string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(map[string]string{"error": message})
}
