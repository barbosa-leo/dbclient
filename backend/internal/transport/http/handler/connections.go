package handler

import (
	"net/http"
	"strconv"

	"dbclient/backend/internal/domain"
	"dbclient/backend/internal/usecase/connection"
)

type ConnectionHandler struct {
	listConnections  *connection.ListConnections
	createConnection *connection.CreateConnection
	updateConnection *connection.UpdateConnection
	deleteConnection *connection.DeleteConnection
}

func NewConnectionHandler(
	listConnections *connection.ListConnections,
	createConnection *connection.CreateConnection,
	updateConnection *connection.UpdateConnection,
	deleteConnection *connection.DeleteConnection,
) *ConnectionHandler {
	return &ConnectionHandler{
		listConnections:  listConnections,
		createConnection: createConnection,
		updateConnection: updateConnection,
		deleteConnection: deleteConnection,
	}
}

type connectionPayload struct {
	EnvironmentID int64          `json:"environmentId"`
	Name          string         `json:"name"`
	Host          string         `json:"host"`
	Port          int            `json:"port"`
	Database      string         `json:"database"`
	Username      string         `json:"username"`
	Password      string         `json:"password"`
	SSLMode       domain.SSLMode `json:"sslMode"`
}

func (h *ConnectionHandler) List(w http.ResponseWriter, r *http.Request) {
	var envID *int64
	if rawEnv := r.URL.Query().Get("environmentId"); rawEnv != "" {
		if parsed, err := strconv.ParseInt(rawEnv, 10, 64); err == nil && parsed > 0 {
			envID = &parsed
		}
	}

	conns, err := h.listConnections.Execute(r.Context(), envID)
	if err != nil {
		writeDomainError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, conns)
}

func (h *ConnectionHandler) Create(w http.ResponseWriter, r *http.Request) {
	var body connectionPayload
	if err := decodeJSON(r, &body); err != nil {
		writeError(w, http.StatusBadRequest, "Payload inválido")
		return
	}

	created, err := h.createConnection.Execute(r.Context(), connection.ConnectionInput{
		EnvironmentID: body.EnvironmentID,
		Name:          body.Name,
		Host:          body.Host,
		Port:          body.Port,
		Database:      body.Database,
		Username:      body.Username,
		Password:      body.Password,
		SSLMode:       body.SSLMode,
	})
	if err != nil {
		writeDomainError(w, err)
		return
	}
	writeJSON(w, http.StatusCreated, created)
}

func (h *ConnectionHandler) Update(w http.ResponseWriter, r *http.Request) {
	id, err := parsePathInt64(r, "id")
	if err != nil {
		writeDomainError(w, err)
		return
	}

	var body connectionPayload
	if err := decodeJSON(r, &body); err != nil {
		writeError(w, http.StatusBadRequest, "Payload inválido")
		return
	}

	updated, err := h.updateConnection.Execute(r.Context(), id, connection.ConnectionInput{
		EnvironmentID: body.EnvironmentID,
		Name:          body.Name,
		Host:          body.Host,
		Port:          body.Port,
		Database:      body.Database,
		Username:      body.Username,
		Password:      body.Password,
		SSLMode:       body.SSLMode,
	})
	if err != nil {
		writeDomainError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, updated)
}

func (h *ConnectionHandler) Delete(w http.ResponseWriter, r *http.Request) {
	id, err := parsePathInt64(r, "id")
	if err != nil {
		writeDomainError(w, err)
		return
	}

	if err := h.deleteConnection.Execute(r.Context(), id); err != nil {
		writeDomainError(w, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
