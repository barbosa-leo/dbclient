package updates

import (
	"context"

	"dbclient/backend/internal/domain"
)

type ListSeenUpdates struct {
	views domain.UpdateViewRepository
}

func NewListSeenUpdates(views domain.UpdateViewRepository) *ListSeenUpdates {
	return &ListSeenUpdates{views: views}
}

func (uc *ListSeenUpdates) Execute(ctx context.Context, userID int64) ([]string, error) {
	return uc.views.ListSeenVersions(ctx, userID)
}
