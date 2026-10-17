package connection

import (
	"context"
	"strings"

	"dbclient/backend/internal/domain"
)

type UpdateConnection struct {
	connections  domain.ConnectionRepository
	environments domain.EnvironmentRepository
	cipher       domain.Cipher
}

func NewUpdateConnection(
	connections domain.ConnectionRepository,
	environments domain.EnvironmentRepository,
	cipher domain.Cipher,
) *UpdateConnection {
	return &UpdateConnection{
		connections:  connections,
		environments: environments,
		cipher:       cipher,
	}
}

func (uc *UpdateConnection) Execute(ctx context.Context, id int64, input ConnectionInput) (domain.Connection, error) {
	normalized, err := validateConnectionInput(input, false)
	if err != nil {
		return domain.Connection{}, err
	}

	existing, err := uc.connections.FindByID(ctx, id)
	if err != nil {
		return domain.Connection{}, err
	}

	if _, err := uc.environments.FindByID(ctx, normalized.EnvironmentID); err != nil {
		return domain.Connection{}, domain.NewValidationError("Environment inválido")
	}

	encryptedPassword := existing.EncryptedPassword
	if strings.TrimSpace(normalized.Password) != "" {
		encryptedPassword, err = uc.cipher.Encrypt(normalized.Password)
		if err != nil {
			return domain.Connection{}, err
		}
	}

	return uc.connections.Update(ctx, domain.Connection{
		ID:                id,
		EnvironmentID:     normalized.EnvironmentID,
		Name:              normalized.Name,
		Host:              normalized.Host,
		Port:              normalized.Port,
		Database:          normalized.Database,
		Username:          normalized.Username,
		EncryptedPassword: encryptedPassword,
		SSLMode:           normalized.SSLMode,
	})
}
