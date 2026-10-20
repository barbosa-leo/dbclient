package settings

import (
	"context"

	"dbclient/backend/internal/domain"
)

const (
	minMaxFileSize          int64 = 1024 * 1024
	maxMaxFileSize          int64 = 10 * 1024 * 1024 * 1024
	minHistoryRetentionDays int   = 1
	maxHistoryRetentionDays int   = 365
)

type UpdateSettings struct {
	settings domain.SettingsRepository
}

func NewUpdateSettings(settings domain.SettingsRepository) *UpdateSettings {
	return &UpdateSettings{settings: settings}
}

func (uc *UpdateSettings) Execute(ctx context.Context, input domain.Settings) (domain.Settings, error) {
	if input.MaxFileSize < minMaxFileSize || input.MaxFileSize > maxMaxFileSize {
		return domain.Settings{}, domain.NewValidationError("Tamanho máximo de arquivo deve estar entre 1 MB e 10 GB")
	}
	if input.HistoryRetentionDays < minHistoryRetentionDays || input.HistoryRetentionDays > maxHistoryRetentionDays {
		return domain.Settings{}, domain.NewValidationError("Período de retenção do histórico deve estar entre 1 e 365 dias")
	}
	if err := uc.settings.Update(ctx, input); err != nil {
		return domain.Settings{}, err
	}
	return input, nil
}
