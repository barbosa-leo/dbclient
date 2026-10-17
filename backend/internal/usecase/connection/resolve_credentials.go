package connection

import (
	"context"

	"dbclient/backend/internal/domain"
)

type ResolveCredentials struct {
	connections domain.ConnectionRepository
	cipher      domain.Cipher
}

func NewResolveCredentials(
	connections domain.ConnectionRepository,
	cipher domain.Cipher,
) *ResolveCredentials {
	return &ResolveCredentials{
		connections: connections,
		cipher:      cipher,
	}
}

func (uc *ResolveCredentials) Execute(
	ctx context.Context,
	connectionID int64,
) (domain.Connection, domain.ConnectionCredentials, error) {
	conn, err := uc.connections.FindByID(ctx, connectionID)
	if err != nil {
		return domain.Connection{}, domain.ConnectionCredentials{}, err
	}

	password, err := uc.cipher.Decrypt(conn.EncryptedPassword)
	if err != nil {
		return domain.Connection{}, domain.ConnectionCredentials{}, err
	}

	return conn, domain.ConnectionCredentials{
		Host:     conn.Host,
		Port:     conn.Port,
		Database: conn.Database,
		Username: conn.Username,
		Password: password,
		SSLMode:  conn.SSLMode,
	}, nil
}
