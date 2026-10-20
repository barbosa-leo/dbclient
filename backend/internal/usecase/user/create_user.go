package user

import (
	"context"
	"net/mail"
	"strings"

	"dbclient/backend/internal/domain"
)

type CreateUserInput struct {
	Name           string
	Email          string
	Password       string
	Role           domain.Role
	EnvironmentIDs []int64
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

func isValidEmail(email string) bool {
	addr, err := mail.ParseAddress(email)
	return err == nil && addr.Address == email && strings.Contains(email, "@")
}

func (uc *CreateUser) Execute(ctx context.Context, input CreateUserInput) (domain.User, error) {
	name := strings.TrimSpace(input.Name)
	if name == "" {
		return domain.User{}, domain.NewValidationError("Nome é obrigatório")
	}
	email := strings.ToLower(strings.TrimSpace(input.Email))
	if email == "" {
		return domain.User{}, domain.NewValidationError("E-mail é obrigatório")
	}
	if !isValidEmail(email) {
		return domain.User{}, domain.NewValidationError("E-mail inválido")
	}
	if strings.TrimSpace(input.Password) == "" {
		return domain.User{}, domain.NewValidationError("Senha é obrigatória")
	}
	if !input.Role.IsValid() {
		return domain.User{}, domain.NewValidationError("Papel inválido")
	}
	if input.Role != domain.RoleAdmin && len(input.EnvironmentIDs) == 0 {
		return domain.User{}, domain.NewValidationError("Selecione ao menos um ambiente para o usuário")
	}

	hash, err := uc.hasher.Hash(input.Password)
	if err != nil {
		return domain.User{}, err
	}

	envIDs := input.EnvironmentIDs
	if input.Role == domain.RoleAdmin {
		envIDs = nil
	}

	return uc.users.Create(ctx, domain.User{
		Name:               name,
		Email:              email,
		PasswordHash:       hash,
		Role:               input.Role,
		MustChangePassword: true,
		EnvironmentIDs:     envIDs,
	})
}
