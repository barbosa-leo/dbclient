package connection

import (
	"context"

	"dbclient/backend/internal/domain"
)

type ListConnections struct {
	connections domain.ConnectionRepository
}

func NewListConnections(connections domain.ConnectionRepository) *ListConnections {
	return &ListConnections{connections: connections}
}

func (uc *ListConnections) Execute(ctx context.Context, actor domain.User, environmentID *int64) ([]domain.Connection, error) {
	if actor.Role == domain.RoleAdmin || actor.Role == "" {
		return uc.connections.List(ctx, environmentID)
	}
	return uc.connections.ListByUser(ctx, actor.ID, environmentID)
}
