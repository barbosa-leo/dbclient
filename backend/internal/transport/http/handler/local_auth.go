//go:build desktop

package handler

import (
	"errors"
	"net/http"
	"time"

	"dbclient/backend/internal/domain"
	"dbclient/backend/internal/transport/http/middleware"
	"dbclient/backend/internal/usecase/auth"
)

type LocalAuthHandler struct {
	signIn *auth.LocalSignIn
}

func NewLocalAuthHandler(signIn *auth.LocalSignIn) *LocalAuthHandler {
	return &LocalAuthHandler{signIn: signIn}
}

func (h *LocalAuthHandler) SignIn(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Cache-Control", "no-store")
	w.Header().Set("Referrer-Policy", "no-referrer")

	session, err := h.signIn.Execute(r.Context(), r.URL.Query().Get("token"))
	if err != nil {
		if errors.Is(err, domain.ErrUnauthorized) {
			writeError(w, http.StatusUnauthorized, "Token local inválido")
			return
		}
		writeDomainError(w, err)
		return
	}

	http.SetCookie(w, &http.Cookie{
		Name:     middleware.SessionCookieName,
		Value:    session.Token,
		Path:     "/",
		Expires:  session.ExpiresAt,
		MaxAge:   int(time.Until(session.ExpiresAt).Seconds()),
		HttpOnly: true,
		SameSite: http.SameSiteStrictMode,
	})
	http.Redirect(w, r, "/", http.StatusSeeOther)
}

func (h *LocalAuthHandler) AppConfig(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, map[string]string{"authMode": "local"})
}
