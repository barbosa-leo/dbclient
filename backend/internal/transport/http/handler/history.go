package handler

import (
	"net/http"
	"strconv"

	"dbclient/backend/internal/domain"
	"dbclient/backend/internal/transport/http/middleware"
	"dbclient/backend/internal/usecase/history"
)

type HistoryHandler struct {
	listHistory *history.ListHistory
}

func NewHistoryHandler(listHistory *history.ListHistory) *HistoryHandler {
	return &HistoryHandler{listHistory: listHistory}
}

func (h *HistoryHandler) List(w http.ResponseWriter, r *http.Request) {
	user, _ := middleware.UserFromContext(r.Context())

	limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))
	records, err := h.listHistory.Execute(r.Context(), history.ListHistoryInput{
		ActorID:   user.ID,
		ActorRole: user.Role,
		Kind:      domain.ExecutionKind(r.URL.Query().Get("kind")),
		Limit:     limit,
	})
	if err != nil {
		writeDomainError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, records)
}
