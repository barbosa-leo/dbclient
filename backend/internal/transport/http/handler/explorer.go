package handler

import (
	"net/http"

	"dbclient/backend/internal/transport/http/middleware"
	"dbclient/backend/internal/usecase/explorer"
)

type ExplorerHandler struct {
	listSchemas         *explorer.ListSchemas
	listColumns         *explorer.ListColumns
	describeTable       *explorer.DescribeTable
	getObjectDefinition *explorer.GetObjectDefinition
	dropObject          *explorer.DropObject
}

func NewExplorerHandler(
	listSchemas *explorer.ListSchemas,
	listColumns *explorer.ListColumns,
	describeTable *explorer.DescribeTable,
	getObjectDefinition *explorer.GetObjectDefinition,
	dropObject *explorer.DropObject,
) *ExplorerHandler {
	return &ExplorerHandler{
		listSchemas:         listSchemas,
		listColumns:         listColumns,
		describeTable:       describeTable,
		getObjectDefinition: getObjectDefinition,
		dropObject:          dropObject,
	}
}

func (h *ExplorerHandler) Schemas(w http.ResponseWriter, r *http.Request) {
	connID, err := parsePathInt64(r, "id")
	if err != nil {
		writeDomainError(w, err)
		return
	}

	actor, _ := middleware.UserFromContext(r.Context())
	schemas, err := h.listSchemas.Execute(r.Context(), actor, connID)
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

	actor, _ := middleware.UserFromContext(r.Context())
	columns, err := h.listColumns.Execute(r.Context(), actor, connID, schema, table)
	if err != nil {
		writeDomainError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, columns)
}

func (h *ExplorerHandler) Structure(w http.ResponseWriter, r *http.Request) {
	connID, err := parsePathInt64(r, "id")
	if err != nil {
		writeDomainError(w, err)
		return
	}

	schema := r.PathValue("schema")
	table := r.PathValue("table")

	actor, _ := middleware.UserFromContext(r.Context())
	structure, err := h.describeTable.Execute(r.Context(), actor, connID, schema, table)
	if err != nil {
		writeDomainError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, structure)
}

func (h *ExplorerHandler) ObjectDefinition(w http.ResponseWriter, r *http.Request) {
	connID, err := parsePathInt64(r, "id")
	if err != nil {
		writeDomainError(w, err)
		return
	}

	schema := r.PathValue("schema")
	category := r.PathValue("category")
	name := r.PathValue("name")

	actor, _ := middleware.UserFromContext(r.Context())
	definition, err := h.getObjectDefinition.Execute(r.Context(), actor, connID, schema, category, name)
	if err != nil {
		writeDomainError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"definition": definition})
}

func (h *ExplorerHandler) DropObject(w http.ResponseWriter, r *http.Request) {
	connID, err := parsePathInt64(r, "id")
	if err != nil {
		writeDomainError(w, err)
		return
	}

	schema := r.PathValue("schema")
	category := r.PathValue("category")
	name := r.PathValue("name")

	actor, _ := middleware.UserFromContext(r.Context())
	if err := h.dropObject.Execute(r.Context(), actor, connID, schema, category, name); err != nil {
		writeDomainError(w, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
