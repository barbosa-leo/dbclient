package user

import (
	"context"
	"net/mail"
	"strings"

	"dbclient/backend/internal/domain"
)

type CreateUserInput struct {
	Name         string
	Email        string
	Password     string
	Role         domain.Role
	Environments []domain.EnvironmentAccess
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

func normalizeEnvironments(role domain.Role, envs []domain.EnvironmentAccess) ([]domain.EnvironmentAccess, error) {
	if role == domain.RoleAdmin {
		return nil, nil
	}
	if len(envs) == 0 {
		return nil, domain.NewValidationError("Selecione ao menos um ambiente para o usuário")
	}

	seen := make(map[int64]struct{}, len(envs))
	normalized := make([]domain.EnvironmentAccess, 0, len(envs))
	for _, access := range envs {
		if access.EnvironmentID <= 0 {
			return nil, domain.NewValidationError("Ambiente inválido")
		}
		if !access.Level.IsValid() {
			return nil, domain.NewValidationError("Nível de acesso inválido")
		}
		if _, dup := seen[access.EnvironmentID]; dup {
			return nil, domain.NewValidationError("Ambiente informado mais de uma vez")
		}
		seen[access.EnvironmentID] = struct{}{}
		normalized = append(normalized, access)
	}
	return normalized, nil
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
	envs, err := normalizeEnvironments(input.Role, input.Environments)
	if err != nil {
		return domain.User{}, err
	}

	hash, err := uc.hasher.Hash(input.Password)
	if err != nil {
		return domain.User{}, err
	}

	return uc.users.Create(ctx, domain.User{
		Name:               name,
		Email:              email,
		PasswordHash:       hash,
		Role:               input.Role,
		MustChangePassword: true,
		Environments:       envs,
	})
}
