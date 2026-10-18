package handler

import (
	"net/http"

	"dbclient/backend/internal/usecase/explorer"
)

type ExplorerHandler struct {
	listSchemas         *explorer.ListSchemas
	listColumns         *explorer.ListColumns
	getObjectDefinition *explorer.GetObjectDefinition
	dropObject          *explorer.DropObject
}

func NewExplorerHandler(
	listSchemas *explorer.ListSchemas,
	listColumns *explorer.ListColumns,
	getObjectDefinition *explorer.GetObjectDefinition,
	dropObject *explorer.DropObject,
) *ExplorerHandler {
	return &ExplorerHandler{
		listSchemas:         listSchemas,
		listColumns:         listColumns,
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

func (h *ExplorerHandler) ObjectDefinition(w http.ResponseWriter, r *http.Request) {
	connID, err := parsePathInt64(r, "id")
	if err != nil {
		writeDomainError(w, err)
		return
	}

	schema := r.PathValue("schema")
	category := r.PathValue("category")
	name := r.PathValue("name")

	definition, err := h.getObjectDefinition.Execute(r.Context(), connID, schema, category, name)
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

	if err := h.dropObject.Execute(r.Context(), connID, schema, category, name); err != nil {
		writeDomainError(w, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
