package connection

import (
	"context"

	"dbclient/backend/internal/domain"
)

type ResolvedConnection struct {
	Connection  domain.Connection
	Credentials domain.ConnectionCredentials
	Level       domain.AccessLevel
}

type ResolveCredentials struct {
	connections domain.ConnectionRepository
	authorize   *AuthorizeAccess
	cipher      domain.Cipher
}

func NewResolveCredentials(
	connections domain.ConnectionRepository,
	authorize *AuthorizeAccess,
	cipher domain.Cipher,
) *ResolveCredentials {
	return &ResolveCredentials{
		connections: connections,
		authorize:   authorize,
		cipher:      cipher,
	}
}

func (uc *ResolveCredentials) Execute(
	ctx context.Context,
	actor domain.User,
	connectionID int64,
	required domain.AccessLevel,
) (ResolvedConnection, error) {
	level, err := uc.authorize.Execute(ctx, actor, connectionID, required)
	if err != nil {
		return ResolvedConnection{}, err
	}

	conn, err := uc.connections.FindByID(ctx, connectionID)
	if err != nil {
		return ResolvedConnection{}, err
	}

	username, encryptedPassword := conn.Username, conn.EncryptedPassword
	if level == domain.AccessRead && conn.HasReadOnlyCredentials() {
		username, encryptedPassword = conn.ReadOnlyUsername, conn.EncryptedReadOnlyPassword
	}

	password, err := uc.cipher.Decrypt(encryptedPassword)
	if err != nil {
		return ResolvedConnection{}, err
	}

	return ResolvedConnection{
		Connection: conn,
		Credentials: domain.ConnectionCredentials{
			Host:     conn.Host,
			Port:     conn.Port,
			Database: conn.Database,
			Username: username,
			Password: password,
			SSLMode:  conn.SSLMode,
		},
		Level: level,
	}, nil
}
