package handler

import (
	"net/http"

	"dbclient/backend/internal/usecase/explorer"
)

type ExplorerHandler struct {
	listSchemas *explorer.ListSchemas
	listColumns *explorer.ListColumns
}

func NewExplorerHandler(
	listSchemas *explorer.ListSchemas,
	listColumns *explorer.ListColumns,
) *ExplorerHandler {
	return &ExplorerHandler{
		listSchemas: listSchemas,
		listColumns: listColumns,
	}
}

func (h *ExplorerHandler) Schemas(w http.ResponseWriter, r *http.Request) {
	connID, err := parsePathInt64(r, "id")
	if err != nil {
		writeDomainError(w, err)
		return
	}

	schemas, err := h.listSchemas.Execute(r.Context(), connID)
	if err != nil {
		writeDomainError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, schemas)
}

func (h *ExplorerHandler) Columns(w http.ResponseWriter, r *http.Request) {
	connID, err := parsePathInt64(r, "id")
	if err != nil {
		writeDomainError(w, err)
		return
	}

	schema := r.PathValue("schema")
	table := r.PathValue("table")

	columns, err := h.listColumns.Execute(r.Context(), connID, schema, table)
	if err != nil {
		writeDomainError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, columns)
}
