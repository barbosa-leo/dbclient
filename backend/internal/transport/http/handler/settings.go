package handler

import (
	"net/http"

	"dbclient/backend/internal/domain"
	"dbclient/backend/internal/usecase/settings"
)

type SettingsHandler struct {
	getSettings    *settings.GetSettings
	updateSettings *settings.UpdateSettings
}

func NewSettingsHandler(
	getSettings *settings.GetSettings,
	updateSettings *settings.UpdateSettings,
) *SettingsHandler {
	return &SettingsHandler{
		getSettings:    getSettings,
		updateSettings: updateSettings,
	}
}

func (h *SettingsHandler) Get(w http.ResponseWriter, r *http.Request) {
	current, err := h.getSettings.Execute(r.Context())
	if err != nil {
		writeDomainError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, current)
}

func (h *SettingsHandler) Update(w http.ResponseWriter, r *http.Request) {
	var body domain.Settings
	if err := decodeJSON(r, &body); err != nil {
		writeError(w, http.StatusBadRequest, "Payload inválido")
		return
	}

	updated, err := h.updateSettings.Execute(r.Context(), body)
	if err != nil {
		writeDomainError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, updated)
}
