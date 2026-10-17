package handler

import (
	"net/http"
	"time"

	"dbclient/backend/internal/transport/http/middleware"
	"dbclient/backend/internal/usecase/auth"
)

type AuthHandler struct {
	login          *auth.Login
	logout         *auth.Logout
	changePassword *auth.ChangePassword
}

func NewAuthHandler(
	login *auth.Login,
	logout *auth.Logout,
	changePassword *auth.ChangePassword,
) *AuthHandler {
	return &AuthHandler{
		login:          login,
		logout:         logout,
		changePassword: changePassword,
	}
}

func (h *AuthHandler) Login(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Username string `json:"username"`
		Password string `json:"password"`
	}
	if err := decodeJSON(r, &body); err != nil {
		writeError(w, http.StatusBadRequest, "Payload inválido")
		return
	}

	user, session, err := h.login.Execute(r.Context(), body.Username, body.Password)
	if err != nil {
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

	writeJSON(w, http.StatusOK, user)
}

func (h *AuthHandler) Logout(w http.ResponseWriter, r *http.Request) {
	token := middleware.TokenFromContext(r.Context())
	_ = h.logout.Execute(r.Context(), token)

	http.SetCookie(w, &http.Cookie{
		Name:     middleware.SessionCookieName,
		Value:    "",
		Path:     "/",
		MaxAge:   -1,
		HttpOnly: true,
		SameSite: http.SameSiteStrictMode,
	})

	w.WriteHeader(http.StatusNoContent)
}

func (h *AuthHandler) Me(w http.ResponseWriter, r *http.Request) {
	user, ok := middleware.UserFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "Não autenticado")
		return
	}
	writeJSON(w, http.StatusOK, user)
}

func (h *AuthHandler) ChangePassword(w http.ResponseWriter, r *http.Request) {
	user, ok := middleware.UserFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "Não autenticado")
		return
	}

	var body struct {
		CurrentPassword string `json:"currentPassword"`
		NewPassword     string `json:"newPassword"`
	}
	if err := decodeJSON(r, &body); err != nil {
		writeError(w, http.StatusBadRequest, "Payload inválido")
		return
	}

	if err := h.changePassword.Execute(r.Context(), user.ID, body.CurrentPassword, body.NewPassword); err != nil {
		writeDomainError(w, err)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}
