package connection

import (
	"context"

	"dbclient/backend/internal/domain"
)

type TestConnectionInput struct {
	Actor        domain.User
	ConnectionID *int64
	Host         string
	Port         int
	Database     string
	Username     string
	Password     string
	SSLMode      domain.SSLMode
}

type TestConnection struct {
	resolver *ResolveCredentials
	driver   domain.DatabaseDriver
}

func NewTestConnection(resolver *ResolveCredentials, driver domain.DatabaseDriver) *TestConnection {
	return &TestConnection{
		resolver: resolver,
		driver:   driver,
	}
}

func (uc *TestConnection) Execute(ctx context.Context, input TestConnectionInput) error {
	creds := domain.ConnectionCredentials{
		Host:     input.Host,
		Port:     input.Port,
		Database: input.Database,
		Username: input.Username,
		Password: input.Password,
		SSLMode:  input.SSLMode,
	}

	if input.ConnectionID != nil && *input.ConnectionID > 0 {
		_, resolved, err := uc.resolver.Execute(ctx, input.Actor, *input.ConnectionID)
		if err != nil {
			return err
		}
		if creds.Host == "" {
			creds.Host = resolved.Host
		}
		if creds.Port <= 0 {
			creds.Port = resolved.Port
		}
		if creds.Database == "" {
			creds.Database = resolved.Database
		}
		if creds.Username == "" {
			creds.Username = resolved.Username
		}
		if creds.Password == "" {
			creds.Password = resolved.Password
		}
		if creds.SSLMode == "" {
			creds.SSLMode = resolved.SSLMode
		}
	}

	if creds.Host == "" || creds.Port <= 0 || creds.Database == "" || creds.Username == "" {
		return domain.NewValidationError("Host, porta, banco de dados e usuário são obrigatórios")
	}

	return uc.driver.Ping(ctx, creds)
}
