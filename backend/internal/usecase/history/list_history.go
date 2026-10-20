package history

import (
	"context"
	"time"

	"dbclient/backend/internal/domain"
)

const (
	defaultLimit = 50
	maxLimit     = 200
)

type ListHistoryInput struct {
	ActorID   int64
	ActorRole domain.Role
	Kind      domain.ExecutionKind
	Limit     int
}

type ListHistory struct {
	history  domain.ExecutionHistoryRepository
	settings domain.SettingsReader
}

func NewListHistory(history domain.ExecutionHistoryRepository, settings domain.SettingsReader) *ListHistory {
	return &ListHistory{
		history:  history,
		settings: settings,
	}
}

func (uc *ListHistory) Execute(ctx context.Context, input ListHistoryInput) ([]domain.ExecutionRecord, error) {
	if !input.Kind.IsValid() {
		return nil, domain.NewValidationError("Tipo de histórico inválido")
	}

	limit := input.Limit
	if limit <= 0 {
		limit = defaultLimit
	} else if limit > maxLimit {
		limit = maxLimit
	}

	retentionDays := 7
	if currentSettings, err := uc.settings.Get(ctx); err == nil && currentSettings.HistoryRetentionDays > 0 {
		retentionDays = currentSettings.HistoryRetentionDays
	}
	cutoff := time.Now().UTC().AddDate(0, 0, -retentionDays)

	filter := domain.ExecutionHistoryFilter{
		Kind:  input.Kind,
		Limit: limit,
		Since: &cutoff,
	}
	if input.ActorRole != domain.RoleAdmin {
		filter.UserID = &input.ActorID
	}
	return uc.history.List(ctx, filter)
}
