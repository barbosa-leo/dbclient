package dump

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

type ImportDumpInput struct {
	Actor         domain.User
	ActorUsername string
	ConnectionID  int64
	FileName      string
	Content       io.Reader
}

type ImportDump struct {
	resolver *connection.ResolveCredentials
	dumper   domain.Dumper
	files    domain.FileStore
	jobs     *job.Manager
	settings domain.SettingsReader
	logger   *slog.Logger
}

func NewImportDump(
	resolver *connection.ResolveCredentials,
	dumper domain.Dumper,
	files domain.FileStore,
	jobs *job.Manager,
	settings domain.SettingsReader,
	logger *slog.Logger,
) *ImportDump {
	return &ImportDump{
		resolver: resolver,
		dumper:   dumper,
		files:    files,
		jobs:     jobs,
		settings: settings,
		logger:   logger,
	}
}

func (uc *ImportDump) Execute(ctx context.Context, input ImportDumpInput) (domain.Job, error) {
	fileName := filepath.Base(strings.TrimSpace(input.FileName))
	if !strings.HasSuffix(strings.ToLower(fileName), ".sql") {
		return domain.Job{}, domain.NewValidationError("Apenas arquivos .sql são permitidos")
	}

	conn, creds, err := uc.resolver.Execute(ctx, input.Actor, input.ConnectionID)
	if err != nil {
		return domain.Job{}, err
	}

	current, err := uc.settings.Get(ctx)
	if err != nil {
		return domain.Job{}, err
	}

	savedPath, err := uc.files.SaveStream(ctx, "dump-import", input.Content, current.MaxFileSize)
	if err != nil {
		return domain.Job{}, err
	}

	created := uc.jobs.Start(
		domain.JobKindDumpImport,
		fileName,
		savedPath,
		0,
		conn.ID,
		conn.Name,
		creds.Database,
		func(jobCtx context.Context, setProgress func(int)) error {
			defer func() { _ = uc.files.Remove(savedPath) }()

			start := time.Now()
			setProgress(50)
			restoreErr := uc.dumper.Restore(jobCtx, creds, savedPath)
			durationMs := time.Since(start).Milliseconds()

			status := "success"
			if restoreErr != nil {
				status = "failed"
			}

			uc.logger.InfoContext(
				jobCtx,
				"audit_execution",
				slog.String("user", input.ActorUsername),
				slog.Int64("connection_id", conn.ID),
				slog.String("connection_name", conn.Name),
				slog.String("database", creds.Database),
				slog.String("action", "dump_import"),
				slog.String("file", fileName),
				slog.String("status", status),
				slog.Int64("duration_ms", durationMs),
			)

			return restoreErr
		},
	)

	return created, nil
}
