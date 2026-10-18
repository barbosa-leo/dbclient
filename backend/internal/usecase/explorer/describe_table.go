package explorer

import (
	"context"
	"strings"

	"dbclient/backend/internal/domain"
	"dbclient/backend/internal/usecase/connection"
)

type DescribeTable struct {
	resolver *connection.ResolveCredentials
	driver   domain.DatabaseDriver
}

func NewDescribeTable(resolver *connection.ResolveCredentials, driver domain.DatabaseDriver) *DescribeTable {
	return &DescribeTable{
		resolver: resolver,
		driver:   driver,
	}
}

func (uc *DescribeTable) Execute(
	ctx context.Context,
	connectionID int64,
	schema, table string,
) (domain.TableStructureInfo, error) {
	schema = strings.TrimSpace(schema)
	table = strings.TrimSpace(table)
	if schema == "" || table == "" {
		return domain.TableStructureInfo{}, domain.NewValidationError("Schema e tabela são obrigatórios")
	}

	_, creds, err := uc.resolver.Execute(ctx, connectionID)
	if err != nil {
		return domain.TableStructureInfo{}, err
	}
	return uc.driver.DescribeTable(ctx, creds, schema, table)
}
