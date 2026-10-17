package query

import (
	"context"
	"log/slog"
	"strings"
	"time"
	"unicode/utf8"

	"dbclient/backend/internal/domain"
	"dbclient/backend/internal/usecase/connection"
)

const (
	MaxSQLLength = 5000
	MinRowLimit  = 10
	MaxRowLimit  = 10000
)

type ExecuteQueryInput struct {
	ActorUsername string
	ConnectionID  int64
	SQL           string
	Limit         int
}

type ExecuteQuery struct {
	resolver *connection.ResolveCredentials
	driver   domain.DatabaseDriver
	logger   *slog.Logger
}

func NewExecuteQuery(
	resolver *connection.ResolveCredentials,
	driver domain.DatabaseDriver,
	logger *slog.Logger,
) *ExecuteQuery {
	return &ExecuteQuery{
		resolver: resolver,
		driver:   driver,
		logger:   logger,
	}
}

func (uc *ExecuteQuery) Execute(ctx context.Context, input ExecuteQueryInput) (domain.QueryResult, error) {
	trimmed := strings.TrimSpace(input.SQL)
	if trimmed == "" {
		return domain.QueryResult{}, domain.NewValidationError("SQL é obrigatório")
	}
	if utf8.RuneCountInString(input.SQL) > MaxSQLLength {
		return domain.QueryResult{}, domain.NewValidationError("A consulta excede o limite de 5000 caracteres")
	}

	limit := input.Limit
	if limit < MinRowLimit {
		limit = MinRowLimit
	} else if limit > MaxRowLimit {
		limit = MaxRowLimit
	}

	conn, creds, err := uc.resolver.Execute(ctx, input.ConnectionID)
	if err != nil {
		return domain.QueryResult{}, err
	}

	start := time.Now()
	result, execErr := uc.driver.ExecuteQuery(ctx, creds, trimmed, limit)
	durationMs := time.Since(start).Milliseconds()

	status := "success"
	if execErr != nil {
		status = "failed"
	}

	uc.logger.InfoContext(
		ctx,
		"audit_execution",
		slog.String("user", input.ActorUsername),
		slog.Int64("connection_id", conn.ID),
		slog.String("connection_name", conn.Name),
		slog.String("database", creds.Database),
		slog.String("action", "query"),
		slog.String("status", status),
		slog.Int64("duration_ms", durationMs),
	)

	if execErr != nil {
		return domain.QueryResult{}, domain.NewValidationError(execErr.Error())
	}

	return result, nil
}
