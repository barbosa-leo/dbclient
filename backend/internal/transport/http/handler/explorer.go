package handler

import (
	"net/http"

	"dbclient/backend/internal/usecase/explorer"
)

type ExplorerHandler struct {
	listDatabases *explorer.ListDatabases
	listSchemas   *explorer.ListSchemas
	listColumns   *explorer.ListColumns
}

func NewExplorerHandler(
	listDatabases *explorer.ListDatabases,
	listSchemas *explorer.ListSchemas,
	listColumns *explorer.ListColumns,
) *ExplorerHandler {
	return &ExplorerHandler{
		listDatabases: listDatabases,
		listSchemas:   listSchemas,
		listColumns:   listColumns,
	}
}

func (h *ExplorerHandler) Databases(w http.ResponseWriter, r *http.Request) {
	connID, err := parsePathInt64(r, "id")
	if err != nil {
		writeDomainError(w, err)
		return
	}

	dbs, err := h.listDatabases.Execute(r.Context(), connID)
	if err != nil {
		writeDomainError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, dbs)
}

func (h *ExplorerHandler) Schemas(w http.ResponseWriter, r *http.Request) {
	connID, err := parsePathInt64(r, "id")
	if err != nil {
		writeDomainError(w, err)
		return
	}

	database := r.URL.Query().Get("database")
	schemas, err := h.listSchemas.Execute(r.Context(), connID, database)
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
	database := r.URL.Query().Get("database")

	columns, err := h.listColumns.Execute(r.Context(), connID, schema, table, database)
	if err != nil {
		writeDomainError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, columns)
}
