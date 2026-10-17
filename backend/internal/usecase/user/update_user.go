package user

import (
	"context"
	"strings"

	"dbclient/backend/internal/domain"
)

type UpdateUserInput struct {
	ID       int64
	Role     domain.Role
	Password string
}

type UpdateUser struct {
	users  domain.UserRepository
	hasher domain.PasswordHasher
}

func NewUpdateUser(users domain.UserRepository, hasher domain.PasswordHasher) *UpdateUser {
	return &UpdateUser{
		users:  users,
		hasher: hasher,
	}
}

func (uc *UpdateUser) Execute(ctx context.Context, input UpdateUserInput) (domain.User, error) {
	existing, err := uc.users.FindByID(ctx, input.ID)
	if err != nil {
		return domain.User{}, err
	}

	if input.Role != "" {
		if !input.Role.IsValid() {
			return domain.User{}, domain.NewValidationError("Papel inválido")
		}
		if existing.Role == domain.RoleAdmin && input.Role != domain.RoleAdmin {
			admins, err := uc.users.CountByRole(ctx, domain.RoleAdmin)
			if err != nil {
				return domain.User{}, err
			}
			if admins <= 1 {
				return domain.User{}, domain.NewConflictError("Não é possível remover o último administrador")
			}
		}
		existing.Role = input.Role
	}

	if strings.TrimSpace(input.Password) != "" {
		hash, err := uc.hasher.Hash(input.Password)
		if err != nil {
			return domain.User{}, err
		}
		existing.PasswordHash = hash
		existing.MustChangePassword = true
	}

	return uc.users.Update(ctx, existing)
}
