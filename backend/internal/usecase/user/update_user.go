package user

import (
	"context"
	"strings"

	"dbclient/backend/internal/domain"
)

type UpdateUserInput struct {
	ID             int64
	Name           string
	Email          string
	Role           domain.Role
	Password       string
	EnvironmentIDs *[]int64
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

	if name := strings.TrimSpace(input.Name); name != "" {
		existing.Name = name
	}

	if email := strings.ToLower(strings.TrimSpace(input.Email)); email != "" {
		if !isValidEmail(email) {
			return domain.User{}, domain.NewValidationError("E-mail inválido")
		}
		existing.Email = email
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

	if existing.Role == domain.RoleAdmin {
		existing.EnvironmentIDs = nil
	} else if input.EnvironmentIDs != nil {
		if len(*input.EnvironmentIDs) == 0 {
			return domain.User{}, domain.NewValidationError("Selecione ao menos um ambiente para o usuário")
		}
		existing.EnvironmentIDs = *input.EnvironmentIDs
	}

	return uc.users.Update(ctx, existing)
}
