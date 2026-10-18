package handler

import (
	"net/http"

	"dbclient/backend/internal/transport/http/middleware"
	"dbclient/backend/internal/usecase/query"
)

type QueryHandler struct {
	executeQuery *query.ExecuteQuery
}

func NewQueryHandler(executeQuery *query.ExecuteQuery) *QueryHandler {
	return &QueryHandler{executeQuery: executeQuery}
}

func (h *QueryHandler) Execute(w http.ResponseWriter, r *http.Request) {
	user, _ := middleware.UserFromContext(r.Context())
	connID, err := parsePathInt64(r, "id")
	if err != nil {
		writeDomainError(w, err)
		return
	}

	var body struct {
		SQL   string `json:"sql"`
		Limit int    `json:"limit"`
	}
	if err := decodeJSON(r, &body); err != nil {
		writeError(w, http.StatusBadRequest, "Payload inválido")
		return
	}

	res, err := h.executeQuery.Execute(r.Context(), query.ExecuteQueryInput{
		ActorUsername: user.Email,
		ActorRole:     user.Role,
		ConnectionID:  connID,
		SQL:           body.SQL,
		Limit:         body.Limit,
	})
	if err != nil {
		writeDomainError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, res)
}
