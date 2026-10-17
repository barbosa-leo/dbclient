package connection

import (
	"context"
	"strings"

	"dbclient/backend/internal/domain"
)

type ConnectionInput struct {
	EnvironmentID int64
	Name          string
	Host          string
	Port          int
	Database      string
	Username      string
	Password      string
	SSLMode       domain.SSLMode
}

type CreateConnection struct {
	connections  domain.ConnectionRepository
	environments domain.EnvironmentRepository
	cipher       domain.Cipher
}

func NewCreateConnection(
	connections domain.ConnectionRepository,
	environments domain.EnvironmentRepository,
	cipher domain.Cipher,
) *CreateConnection {
	return &CreateConnection{
		connections:  connections,
		environments: environments,
		cipher:       cipher,
	}
}

func (uc *CreateConnection) Execute(ctx context.Context, input ConnectionInput) (domain.Connection, error) {
	normalized, err := validateConnectionInput(input, true)
	if err != nil {
		return domain.Connection{}, err
	}

	if _, err := uc.environments.FindByID(ctx, normalized.EnvironmentID); err != nil {
		return domain.Connection{}, domain.NewValidationError("Environment inválido")
	}

	encrypted, err := uc.cipher.Encrypt(normalized.Password)
	if err != nil {
		return domain.Connection{}, err
	}

	return uc.connections.Create(ctx, domain.Connection{
		EnvironmentID:     normalized.EnvironmentID,
		Name:              normalized.Name,
		Host:              normalized.Host,
		Port:              normalized.Port,
		Database:          normalized.Database,
		Username:          normalized.Username,
		EncryptedPassword: encrypted,
		SSLMode:           normalized.SSLMode,
	})
}

func validateConnectionInput(input ConnectionInput, requirePassword bool) (ConnectionInput, error) {
	input.Name = strings.TrimSpace(input.Name)
	input.Host = strings.TrimSpace(input.Host)
	input.Database = strings.TrimSpace(input.Database)
	input.Username = strings.TrimSpace(input.Username)

	if input.EnvironmentID <= 0 {
		return ConnectionInput{}, domain.NewValidationError("Environment é obrigatório")
	}
	if input.Name == "" {
		return ConnectionInput{}, domain.NewValidationError("Nome é obrigatório")
	}
	if input.Host == "" {
		return ConnectionInput{}, domain.NewValidationError("Host é obrigatório")
	}
	if input.Port < 1 || input.Port > 65535 {
		return ConnectionInput{}, domain.NewValidationError("Porta deve estar entre 1 e 65535")
	}
	if input.Database == "" {
		return ConnectionInput{}, domain.NewValidationError("Database é obrigatório")
	}
	if input.Username == "" {
		return ConnectionInput{}, domain.NewValidationError("Usuário é obrigatório")
	}
	if requirePassword && strings.TrimSpace(input.Password) == "" {
		return ConnectionInput{}, domain.NewValidationError("Senha é obrigatória")
	}
	if !input.SSLMode.IsValid() {
		return ConnectionInput{}, domain.NewValidationError("Modo SSL inválido")
	}
	return input, nil
}
