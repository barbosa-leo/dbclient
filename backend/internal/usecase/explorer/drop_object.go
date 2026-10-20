package explorer

import (
	"context"
	"strings"

	"dbclient/backend/internal/domain"
	"dbclient/backend/internal/usecase/connection"
)

type DropObject struct {
	resolver *connection.ResolveCredentials
	driver   domain.DatabaseDriver
}

func NewDropObject(resolver *connection.ResolveCredentials, driver domain.DatabaseDriver) *DropObject {
	return &DropObject{
		resolver: resolver,
		driver:   driver,
	}
}

func (uc *DropObject) Execute(
	ctx context.Context,
	actor domain.User,
	connectionID int64,
	schema, category, name string,
) error {
	schema = strings.TrimSpace(schema)
	category = strings.TrimSpace(category)
	name = strings.TrimSpace(name)
	if schema == "" || category == "" || name == "" {
		return domain.NewValidationError("Schema, categoria e nome do objeto são obrigatórios")
	}

	_, creds, err := uc.resolver.Execute(ctx, actor, connectionID)
	if err != nil {
		return err
	}
	return uc.driver.DropObject(ctx, creds, schema, category, name)
}
