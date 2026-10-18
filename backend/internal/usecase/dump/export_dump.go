package dump

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"time"

	"dbclient/backend/internal/domain"
	"dbclient/backend/internal/usecase/connection"
	"dbclient/backend/internal/usecase/job"
)

type ExportDump struct {
	resolver    *connection.ResolveCredentials
	dumper      domain.Dumper
	files       domain.FileStore
	jobs        *job.Manager
	maxFileSize int64
	logger      *slog.Logger
}

func NewExportDump(
	resolver *connection.ResolveCredentials,
	dumper domain.Dumper,
	files domain.FileStore,
	jobs *job.Manager,
	maxFileSize int64,
	logger *slog.Logger,
) *ExportDump {
	return &ExportDump{
		resolver:    resolver,
		dumper:      dumper,
		files:       files,
		jobs:        jobs,
		maxFileSize: maxFileSize,
		logger:      logger,
	}
}

func (uc *ExportDump) Execute(ctx context.Context, actorUserID int64, actorUsername string, connectionID int64) (domain.Job, error) {
	conn, creds, err := uc.resolver.Execute(ctx, connectionID)
	if err != nil {
		return domain.Job{}, err
	}

	path, writer, err := uc.files.CreateWriter("dump-export", uc.maxFileSize)
	if err != nil {
		return domain.Job{}, err
	}

	stamp := time.Now().UTC().Format("2006-01-02-15-04-05")
	fileName := fmt.Sprintf("%s-%s.sql", creds.Database, stamp)

	created := uc.jobs.Start(
		domain.JobKindDumpExport,
		fileName,
		path,
		actorUserID,
		conn.ID,
		conn.Name,
		creds.Database,
		func(jobCtx context.Context, setProgress func(int)) error {
			start := time.Now()
			setProgress(40)

			exportErr := uc.dumper.Export(jobCtx, creds, writer)
			closeErr := writer.Close()
			if exportErr == nil && closeErr != nil {
				exportErr = closeErr
			}

			durationMs := time.Since(start).Milliseconds()
			status := "success"
			if exportErr != nil {
				status = "failed"
				_ = uc.files.Remove(path)
				if errors.Is(exportErr, domain.ErrFileTooLarge) {
					exportErr = errors.New("Dump excedeu o limite máximo de 50 MB")
				}
			}

			uc.logger.InfoContext(
				jobCtx,
				"audit_execution",
				slog.String("user", actorUsername),
				slog.Int64("connection_id", conn.ID),
				slog.String("connection_name", conn.Name),
				slog.String("database", creds.Database),
				slog.String("action", "dump_export"),
				slog.String("file", fileName),
				slog.String("status", status),
				slog.Int64("duration_ms", durationMs),
			)

			return exportErr
		},
	)

	return created, nil
}
