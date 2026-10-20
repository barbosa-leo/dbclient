package explorer

import (
	"context"
	"strings"

	"dbclient/backend/internal/domain"
	"dbclient/backend/internal/usecase/connection"
)

type GetObjectDefinition struct {
	resolver *connection.ResolveCredentials
	driver   domain.DatabaseDriver
}

func NewGetObjectDefinition(resolver *connection.ResolveCredentials, driver domain.DatabaseDriver) *GetObjectDefinition {
	return &GetObjectDefinition{
		resolver: resolver,
		driver:   driver,
	}
}

func (uc *GetObjectDefinition) Execute(
	ctx context.Context,
	actor domain.User,
	connectionID int64,
	schema, category, name string,
) (string, error) {
	schema = strings.TrimSpace(schema)
	category = strings.TrimSpace(category)
	name = strings.TrimSpace(name)
	if schema == "" || category == "" || name == "" {
		return "", domain.NewValidationError("Schema, categoria e nome do objeto são obrigatórios")
	}

	_, creds, err := uc.resolver.Execute(ctx, actor, connectionID)
	if err != nil {
		return "", err
	}
	return uc.driver.GetObjectDefinition(ctx, creds, schema, category, name)
}
