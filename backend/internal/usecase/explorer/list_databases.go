package explorer

import (
	"context"

	"dbclient/backend/internal/domain"
	"dbclient/backend/internal/usecase/connection"
)

type ListDatabases struct {
	resolver *connection.ResolveCredentials
	driver   domain.DatabaseDriver
}

func NewListDatabases(resolver *connection.ResolveCredentials, driver domain.DatabaseDriver) *ListDatabases {
	return &ListDatabases{
		resolver: resolver,
		driver:   driver,
	}
}

func (uc *ListDatabases) Execute(ctx context.Context, connectionID int64) ([]string, error) {
	_, creds, err := uc.resolver.Execute(ctx, connectionID, "")
	if err != nil {
		return nil, err
	}
	return uc.driver.ListDatabases(ctx, creds)
}
