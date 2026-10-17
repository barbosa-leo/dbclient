package script

import (
	"context"
	"io"
	"log/slog"
	"path/filepath"
	"strings"
	"time"

	"dbclient/backend/internal/domain"
	"dbclient/backend/internal/usecase/connection"
	"dbclient/backend/internal/usecase/job"
)

type RunScriptInput struct {
	ActorUsername string
	ConnectionID  int64
	FileName      string
	Content       io.Reader
}

type RunScript struct {
	resolver    *connection.ResolveCredentials
	runner      domain.ScriptRunner
	files       domain.FileStore
	jobs        *job.Manager
	maxFileSize int64
	logger      *slog.Logger
}

func NewRunScript(
	resolver *connection.ResolveCredentials,
	runner domain.ScriptRunner,
	files domain.FileStore,
	jobs *job.Manager,
	maxFileSize int64,
	logger *slog.Logger,
) *RunScript {
	return &RunScript{
		resolver:    resolver,
		runner:      runner,
		files:       files,
		jobs:        jobs,
		maxFileSize: maxFileSize,
		logger:      logger,
	}
}

func (uc *RunScript) Execute(ctx context.Context, input RunScriptInput) (domain.Job, error) {
	fileName := filepath.Base(strings.TrimSpace(input.FileName))
	if !strings.HasSuffix(strings.ToLower(fileName), ".sql") {
		return domain.Job{}, domain.NewValidationError("Apenas arquivos .sql são permitidos")
	}

	conn, creds, err := uc.resolver.Execute(ctx, input.ConnectionID)
	if err != nil {
		return domain.Job{}, err
	}

	savedPath, err := uc.files.SaveStream(ctx, "script", input.Content, uc.maxFileSize)
	if err != nil {
		return domain.Job{}, err
	}

	created := uc.jobs.Start(
		domain.JobKindScript,
		fileName,
		savedPath,
		func(jobCtx context.Context, setProgress func(int)) error {
			defer func() { _ = uc.files.Remove(savedPath) }()

			start := time.Now()
			setProgress(50)
			runErr := uc.runner.Run(jobCtx, creds, savedPath)
			durationMs := time.Since(start).Milliseconds()

			status := "success"
			if runErr != nil {
				status = "failed"
			}

			uc.logger.InfoContext(
				jobCtx,
				"audit_execution",
				slog.String("user", input.ActorUsername),
				slog.Int64("connection_id", conn.ID),
				slog.String("connection_name", conn.Name),
				slog.String("database", creds.Database),
				slog.String("action", "script"),
				slog.String("file", fileName),
				slog.String("status", status),
				slog.Int64("duration_ms", durationMs),
			)

			return runErr
		},
	)

	return created, nil
}
