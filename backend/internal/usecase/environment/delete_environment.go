package environment

import (
	"context"

	"dbclient/backend/internal/domain"
)

type DeleteEnvironment struct {
	environments domain.EnvironmentRepository
	connections  domain.ConnectionRepository
}

func NewDeleteEnvironment(
	environments domain.EnvironmentRepository,
	connections domain.ConnectionRepository,
) *DeleteEnvironment {
	return &DeleteEnvironment{
		environments: environments,
		connections:  connections,
	}
}

func (uc *DeleteEnvironment) Execute(ctx context.Context, id int64) error {
	count, err := uc.connections.CountByEnvironmentID(ctx, id)
	if err != nil {
		return err
	}
	if count > 0 {
		return domain.NewConflictError("Remova ou mova as conexões deste environment antes de excluí-lo")
	}
	return uc.environments.Delete(ctx, id)
}
