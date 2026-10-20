package explorer

import (
	"context"
	"strings"

	"dbclient/backend/internal/domain"
	"dbclient/backend/internal/usecase/connection"
)

type ListColumns struct {
	resolver *connection.ResolveCredentials
	driver   domain.DatabaseDriver
}

func NewListColumns(resolver *connection.ResolveCredentials, driver domain.DatabaseDriver) *ListColumns {
	return &ListColumns{
		resolver: resolver,
		driver:   driver,
	}
}

func (uc *ListColumns) Execute(
	ctx context.Context,
	actor domain.User,
	connectionID int64,
	schema, table string,
) ([]domain.ColumnInfo, error) {
	schema = strings.TrimSpace(schema)
	table = strings.TrimSpace(table)
	if schema == "" || table == "" {
		return nil, domain.NewValidationError("Schema e tabela são obrigatórios")
	}

	_, creds, err := uc.resolver.Execute(ctx, actor, connectionID)
	if err != nil {
		return nil, err
	}
	return uc.driver.ListColumns(ctx, creds, schema, table)
}
