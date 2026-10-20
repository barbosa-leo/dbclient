package handler

import (
	"net/http"

	"dbclient/backend/internal/domain"
	"dbclient/backend/internal/transport/http/middleware"
	"dbclient/backend/internal/usecase/user"
)

type UserHandler struct {
	listUsers  *user.ListUsers
	createUser *user.CreateUser
	updateUser *user.UpdateUser
	deleteUser *user.DeleteUser
}

func NewUserHandler(
	listUsers *user.ListUsers,
	createUser *user.CreateUser,
	updateUser *user.UpdateUser,
	deleteUser *user.DeleteUser,
) *UserHandler {
	return &UserHandler{
		listUsers:  listUsers,
		createUser: createUser,
		updateUser: updateUser,
		deleteUser: deleteUser,
	}
}

func (h *UserHandler) List(w http.ResponseWriter, r *http.Request) {
	users, err := h.listUsers.Execute(r.Context())
	if err != nil {
		writeDomainError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, users)
}

func (h *UserHandler) Create(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Name           string      `json:"name"`
		Email          string      `json:"email"`
		Password       string      `json:"password"`
		Role           domain.Role `json:"role"`
		EnvironmentIDs []int64     `json:"environmentIds"`
	}
	if err := decodeJSON(r, &body); err != nil {
		writeError(w, http.StatusBadRequest, "Payload inválido")
		return
	}

	created, err := h.createUser.Execute(r.Context(), user.CreateUserInput{
		Name:           body.Name,
		Email:          body.Email,
		Password:       body.Password,
		Role:           body.Role,
		EnvironmentIDs: body.EnvironmentIDs,
	})
	if err != nil {
		writeDomainError(w, err)
		return
	}
	writeJSON(w, http.StatusCreated, created)
}

func (h *UserHandler) Update(w http.ResponseWriter, r *http.Request) {
	id, err := parsePathInt64(r, "id")
	if err != nil {
		writeDomainError(w, err)
		return
	}

	var body struct {
		Name           string      `json:"name"`
		Email          string      `json:"email"`
		Role           domain.Role `json:"role"`
		Password       string      `json:"password"`
		EnvironmentIDs *[]int64    `json:"environmentIds"`
	}
	if err := decodeJSON(r, &body); err != nil {
		writeError(w, http.StatusBadRequest, "Payload inválido")
		return
	}

	updated, err := h.updateUser.Execute(r.Context(), user.UpdateUserInput{
		ID:             id,
		Name:           body.Name,
		Email:          body.Email,
		Role:           body.Role,
		Password:       body.Password,
		EnvironmentIDs: body.EnvironmentIDs,
	})
	if err != nil {
		writeDomainError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, updated)
}

func (h *UserHandler) Delete(w http.ResponseWriter, r *http.Request) {
	actor, _ := middleware.UserFromContext(r.Context())
	targetID, err := parsePathInt64(r, "id")
	if err != nil {
		writeDomainError(w, err)
		return
	}

	if err := h.deleteUser.Execute(r.Context(), actor.ID, targetID); err != nil {
		writeDomainError(w, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
