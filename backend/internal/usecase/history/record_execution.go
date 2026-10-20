package history

import (
	"context"
	"log/slog"
	"time"

	"dbclient/backend/internal/domain"
)

type RecordExecution struct {
	settings domain.SettingsReader
	history  domain.ExecutionHistoryRepository
	logger   *slog.Logger
}

func NewRecordExecution(
	settings domain.SettingsReader,
	history domain.ExecutionHistoryRepository,
	logger *slog.Logger,
) *RecordExecution {
	return &RecordExecution{
		settings: settings,
		history:  history,
		logger:   logger,
	}
}

func (uc *RecordExecution) Record(ctx context.Context, record domain.ExecutionRecord) error {
	currentSettings, err := uc.settings.Get(ctx)
	if err != nil {
		uc.logger.WarnContext(ctx, "failed to get settings for execution history", slog.String("error", err.Error()))
		return err
	}

	if !currentSettings.HistoryEnabled {
		return nil
	}

	retentionDays := currentSettings.HistoryRetentionDays
	if retentionDays <= 0 {
		retentionDays = 7
	}

	purgeBefore := time.Now().UTC().AddDate(0, 0, -retentionDays)
	return uc.history.RecordWithPurge(ctx, record, purgeBefore)
}

