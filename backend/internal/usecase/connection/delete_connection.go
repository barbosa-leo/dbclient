package connection

import (
	"context"

	"dbclient/backend/internal/domain"
)

type DeleteConnection struct {
	connections domain.ConnectionRepository
}

func NewDeleteConnection(connections domain.ConnectionRepository) *DeleteConnection {
	return &DeleteConnection{connections: connections}
}

func (uc *DeleteConnection) Execute(ctx context.Context, id int64) error {
	return uc.connections.Delete(ctx, id)
}
