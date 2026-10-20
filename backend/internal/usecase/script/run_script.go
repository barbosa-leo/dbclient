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
	Actor         domain.User
	ActorUserID   int64
	ActorUsername string
	ConnectionID  int64
	FileName      string
	Content       io.Reader
}

type RunScript struct {
	resolver *connection.ResolveCredentials
	runner   domain.ScriptRunner
	files    domain.FileStore
	jobs     *job.Manager
	settings domain.SettingsReader
	history  domain.ExecutionRecorder
	logger   *slog.Logger
}

func NewRunScript(
	resolver *connection.ResolveCredentials,
	runner domain.ScriptRunner,
	files domain.FileStore,
	jobs *job.Manager,
	settings domain.SettingsReader,
	history domain.ExecutionRecorder,
	logger *slog.Logger,
) *RunScript {
	return &RunScript{
		resolver: resolver,
		runner:   runner,
		files:    files,
		jobs:     jobs,
		settings: settings,
		history:  history,
		logger:   logger,
	}
}

func (uc *RunScript) Execute(ctx context.Context, input RunScriptInput) (domain.Job, error) {
	fileName := filepath.Base(strings.TrimSpace(input.FileName))
	if !strings.HasSuffix(strings.ToLower(fileName), ".sql") {
		return domain.Job{}, domain.NewValidationError("Apenas arquivos .sql são permitidos")
	}

	actor := input.Actor
	if actor.ID == 0 && input.ActorUserID != 0 {
		actor.ID = input.ActorUserID
	}
	conn, creds, err := uc.resolver.Execute(ctx, actor, input.ConnectionID)
	if err != nil {
		return domain.Job{}, err
	}

	current, err := uc.settings.Get(ctx)
	if err != nil {
		return domain.Job{}, err
	}

	counter := &countingReader{reader: input.Content}
	savedPath, err := uc.files.SaveStream(ctx, "script", counter, current.MaxFileSize)
	if err != nil {
		return domain.Job{}, err
	}
	fileSize := counter.count

	created := uc.jobs.Start(
		domain.JobKindScript,
		fileName,
		savedPath,
		input.ActorUserID,
		conn.ID,
		conn.Name,
		creds.Database,
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

			uc.recordExecution(jobCtx, input, conn, creds.Database, fileName, fileSize, runErr, durationMs)

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

func (uc *RunScript) recordExecution(
	ctx context.Context,
	input RunScriptInput,
	conn domain.Connection,
	database string,
	fileName string,
	fileSize int64,
	runErr error,
	durationMs int64,
) {
	record := domain.ExecutionRecord{
		UserID:         input.ActorUserID,
		Kind:           domain.ExecutionKindScript,
		ConnectionID:   conn.ID,
		ConnectionName: conn.Name,
		Database:       database,
		FileName:       fileName,
		FileSize:       fileSize,
		Success:        runErr == nil,
		DurationMs:     durationMs,
	}
	if runErr != nil {
		record.Error = runErr.Error()
	}

	// A conclusão do job pode ocorrer após cancelamento do contexto; o histórico deve ser gravado mesmo assim.
	if err := uc.history.Record(context.WithoutCancel(ctx), record); err != nil {
		uc.logger.WarnContext(ctx, "failed to record script history", slog.String("error", err.Error()))
	}
}

type countingReader struct {
	reader io.Reader
	count  int64
}

func (r *countingReader) Read(p []byte) (int, error) {
	n, err := r.reader.Read(p)
	r.count += int64(n)
	return n, err
}
