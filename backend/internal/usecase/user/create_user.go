package user

import (
	"context"
	"strings"

	"dbclient/backend/internal/domain"
)

type CreateUserInput struct {
	Username string
	Password string
	Role     domain.Role
}

type CreateUser struct {
	users  domain.UserRepository
	hasher domain.PasswordHasher
}

func NewCreateUser(users domain.UserRepository, hasher domain.PasswordHasher) *CreateUser {
	return &CreateUser{
		users:  users,
		hasher: hasher,
	}
}

func (uc *CreateUser) Execute(ctx context.Context, input CreateUserInput) (domain.User, error) {
	username := strings.TrimSpace(input.Username)
	if username == "" {
		return domain.User{}, domain.NewValidationError("Nome de usuário é obrigatório")
	}
	if strings.TrimSpace(input.Password) == "" {
		return domain.User{}, domain.NewValidationError("Senha é obrigatória")
	}
	if !input.Role.IsValid() {
		return domain.User{}, domain.NewValidationError("Papel inválido")
	}

	hash, err := uc.hasher.Hash(input.Password)
	if err != nil {
		return domain.User{}, err
	}

	return uc.users.Create(ctx, domain.User{
		Username:           username,
		PasswordHash:       hash,
		Role:               input.Role,
		MustChangePassword: true,
	})
}
