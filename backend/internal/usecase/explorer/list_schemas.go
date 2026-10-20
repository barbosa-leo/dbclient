package explorer

import (
	"context"

	"dbclient/backend/internal/domain"
	"dbclient/backend/internal/usecase/connection"
)

type ListSchemas struct {
	resolver *connection.ResolveCredentials
	driver   domain.DatabaseDriver
}

func NewListSchemas(resolver *connection.ResolveCredentials, driver domain.DatabaseDriver) *ListSchemas {
	return &ListSchemas{
		resolver: resolver,
		driver:   driver,
	}
}

func (uc *ListSchemas) Execute(ctx context.Context, actor domain.User, connectionID int64) ([]domain.SchemaInfo, error) {
	_, creds, err := uc.resolver.Execute(ctx, actor, connectionID)
	if err != nil {
		return nil, err
	}
	return uc.driver.ListSchemas(ctx, creds)
}
