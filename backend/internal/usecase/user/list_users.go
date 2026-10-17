package user

import (
	"context"

	"dbclient/backend/internal/domain"
)

type ListUsers struct {
	users domain.UserRepository
}

func NewListUsers(users domain.UserRepository) *ListUsers {
	return &ListUsers{users: users}
}

func (uc *ListUsers) Execute(ctx context.Context) ([]domain.User, error) {
	return uc.users.List(ctx)
}
