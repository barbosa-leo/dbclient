package settings

import (
	"context"

	"dbclient/backend/internal/domain"
)

type GetSettings struct {
	settings domain.SettingsReader
}

func NewGetSettings(settings domain.SettingsReader) *GetSettings {
	return &GetSettings{settings: settings}
}

func (uc *GetSettings) Execute(ctx context.Context) (domain.Settings, error) {
	return uc.settings.Get(ctx)
}

func (uc *GetSettings) MaxFileSize(ctx context.Context) (int64, error) {
	current, err := uc.settings.Get(ctx)
	if err != nil {
		return 0, err
	}
	return current.MaxFileSize, nil
}
