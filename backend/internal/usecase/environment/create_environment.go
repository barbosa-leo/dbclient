package environment

import (
	"context"
	"strings"

	"dbclient/backend/internal/domain"
)

type CreateEnvironment struct {
	environments domain.EnvironmentRepository
}

func NewCreateEnvironment(environments domain.EnvironmentRepository) *CreateEnvironment {
	return &CreateEnvironment{environments: environments}
}

func (uc *CreateEnvironment) Execute(ctx context.Context, name string) (domain.Environment, error) {
	trimmed := strings.TrimSpace(name)
	if trimmed == "" {
		return domain.Environment{}, domain.NewValidationError("Nome do environment é obrigatório")
	}
	return uc.environments.Create(ctx, trimmed)
}
