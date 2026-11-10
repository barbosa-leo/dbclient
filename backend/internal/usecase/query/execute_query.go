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
	Actor         domain.User
	ActorUsername string
	ConnectionID  int64
	SQL           string
	Limit         int
	SaveHistory   bool
}

type ExecuteQuery struct {
	resolver *connection.ResolveCredentials
	driver   domain.DatabaseDriver
	history  domain.ExecutionRecorder
	logger   *slog.Logger
}

func NewExecuteQuery(
	resolver *connection.ResolveCredentials,
	driver domain.DatabaseDriver,
	history domain.ExecutionRecorder,
	logger *slog.Logger,
) *ExecuteQuery {
	return &ExecuteQuery{
		resolver: resolver,
		driver:   driver,
		history:  history,
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

	target, err := uc.resolver.Execute(ctx, input.Actor, input.ConnectionID, domain.AccessRead)
	if err != nil {
		return domain.QueryResult{}, err
	}
	conn, creds := target.Connection, target.Credentials
	readOnly := target.Level == domain.AccessRead

	start := time.Now()
	result, execErr := uc.driver.ExecuteQuery(ctx, creds, trimmed, limit, readOnly)
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

	if input.SaveHistory {
		uc.recordExecution(ctx, input, conn, creds.Database, trimmed, execErr, durationMs)
	}

	if execErr != nil {
		return domain.QueryResult{}, domain.NewValidationError(execErr.Error())
	}

	return result, nil
}

func (uc *ExecuteQuery) recordExecution(
	ctx context.Context,
	input ExecuteQueryInput,
	conn domain.Connection,
	database string,
	sqlText string,
	execErr error,
	durationMs int64,
) {
	record := domain.ExecutionRecord{
		UserID:         input.Actor.ID,
		Kind:           domain.ExecutionKindQuery,
		ConnectionID:   conn.ID,
		ConnectionName: conn.Name,
		Database:       database,
		SQL:            sqlText,
		Success:        execErr == nil,
		DurationMs:     durationMs,
	}
	if execErr != nil {
		record.Error = execErr.Error()
	}

	if err := uc.history.Record(ctx, record); err != nil {
		uc.logger.WarnContext(ctx, "failed to record query history", slog.String("error", err.Error()))
	}
}
