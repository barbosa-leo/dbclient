package handler

import (
	"encoding/json"
	"errors"
	"net/http"
	"strconv"

	"dbclient/backend/internal/domain"
)

func writeJSON(w http.ResponseWriter, status int, payload any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	if payload != nil {
		_ = json.NewEncoder(w).Encode(payload)
	}
}

func writeError(w http.ResponseWriter, status int, message string) {
	writeJSON(w, status, map[string]string{"error": message})
}

func writeDomainError(w http.ResponseWriter, err error) {
	switch {
	case errors.Is(err, domain.ErrValidation):
		writeError(w, http.StatusBadRequest, err.Error())
	case errors.Is(err, domain.ErrUnauthorized):
		writeError(w, http.StatusUnauthorized, "Usuário ou senha inválidos")
	case errors.Is(err, domain.ErrForbidden):
		msg := "Acesso negado"
		var fe domain.ForbiddenError
		if errors.As(err, &fe) && fe.Message != "" {
			msg = fe.Message
		}
		writeError(w, http.StatusForbidden, msg)
	case errors.Is(err, domain.ErrNotFound):
		writeError(w, http.StatusNotFound, "Recurso não encontrado")
	case errors.Is(err, domain.ErrConflict):
		writeError(w, http.StatusConflict, err.Error())
	case errors.Is(err, domain.ErrFileTooLarge):
		writeError(w, http.StatusRequestEntityTooLarge, "O arquivo excede o tamanho máximo permitido")
	default:
		writeError(w, http.StatusInternalServerError, err.Error())
	}
}

func decodeJSON(r *http.Request, dst any) error {
	dec := json.NewDecoder(r.Body)
	return dec.Decode(dst)
}

func parsePathInt64(r *http.Request, name string) (int64, error) {
	raw := r.PathValue(name)
	id, err := strconv.ParseInt(raw, 10, 64)
	if err != nil || id <= 0 {
		return 0, domain.NewValidationError("Identificador inválido")
	}
	return id, nil
}
