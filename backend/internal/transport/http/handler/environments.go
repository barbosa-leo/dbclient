package handler

import (
	"net/http"

	"dbclient/backend/internal/usecase/environment"
)

type EnvironmentHandler struct {
	listEnvironments  *environment.ListEnvironments
	createEnvironment *environment.CreateEnvironment
	deleteEnvironment *environment.DeleteEnvironment
}

func NewEnvironmentHandler(
	listEnvironments *environment.ListEnvironments,
	createEnvironment *environment.CreateEnvironment,
	deleteEnvironment *environment.DeleteEnvironment,
) *EnvironmentHandler {
	return &EnvironmentHandler{
		listEnvironments:  listEnvironments,
		createEnvironment: createEnvironment,
		deleteEnvironment: deleteEnvironment,
	}
}

func (h *EnvironmentHandler) List(w http.ResponseWriter, r *http.Request) {
	envs, err := h.listEnvironments.Execute(r.Context())
	if err != nil {
		writeDomainError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, envs)
}

func (h *EnvironmentHandler) Create(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Name string `json:"name"`
	}
	if err := decodeJSON(r, &body); err != nil {
		writeError(w, http.StatusBadRequest, "Payload inválido")
		return
	}

	created, err := h.createEnvironment.Execute(r.Context(), body.Name)
	if err != nil {
		writeDomainError(w, err)
		return
	}
	writeJSON(w, http.StatusCreated, created)
}

func (h *EnvironmentHandler) Delete(w http.ResponseWriter, r *http.Request) {
	id, err := parsePathInt64(r, "id")
	if err != nil {
		writeDomainError(w, err)
		return
	}

	if err := h.deleteEnvironment.Execute(r.Context(), id); err != nil {
		writeDomainError(w, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
