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

func (uc *ListEnvironments) Execute(ctx context.Context, actor domain.User) ([]domain.Environment, error) {
	if actor.Role == domain.RoleAdmin || actor.Role == "" {
		return uc.environments.List(ctx)
	}
	return uc.environments.ListByUser(ctx, actor.ID)
}
