package environment

import (
	"context"

	"dbclient/backend/internal/domain"
)

type ListEnvironments struct {
	environments domain.EnvironmentRepository
}

func NewListEnvironments(environments domain.EnvironmentRepository) *ListEnvironments {
	return &ListEnvironments{environments: environments}
}

func (uc *ListEnvironments) Execute(ctx context.Context) ([]domain.Environment, error) {
	return uc.environments.List(ctx)
}
