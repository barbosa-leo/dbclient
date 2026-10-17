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

func (uc *ListConnections) Execute(ctx context.Context, environmentID *int64) ([]domain.Connection, error) {
	return uc.connections.List(ctx, environmentID)
}
