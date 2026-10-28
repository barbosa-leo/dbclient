package handler

import (
	"net/http"

	"dbclient/backend/internal/transport/http/middleware"
	"dbclient/backend/internal/usecase/updates"
)

type UpdatesHandler struct {
	listSeen *updates.ListSeenUpdates
	markSeen *updates.MarkUpdatesSeen
}

func NewUpdatesHandler(listSeen *updates.ListSeenUpdates, markSeen *updates.MarkUpdatesSeen) *UpdatesHandler {
	return &UpdatesHandler{listSeen: listSeen, markSeen: markSeen}
}

type seenUpdatesPayload struct {
	Versions []string `json:"versions"`
}

func (h *UpdatesHandler) ListSeen(w http.ResponseWriter, r *http.Request) {
	user, _ := middleware.UserFromContext(r.Context())

	versions, err := h.listSeen.Execute(r.Context(), user.ID)
	if err != nil {
		writeDomainError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, seenUpdatesPayload{Versions: versions})
}

func (h *UpdatesHandler) MarkSeen(w http.ResponseWriter, r *http.Request) {
	user, _ := middleware.UserFromContext(r.Context())

	var payload seenUpdatesPayload
	if err := decodeJSON(r, &payload); err != nil {
		writeError(w, http.StatusBadRequest, "Payload inválido")
		return
	}
	if err := h.markSeen.Execute(r.Context(), user.ID, payload.Versions); err != nil {
		writeDomainError(w, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
