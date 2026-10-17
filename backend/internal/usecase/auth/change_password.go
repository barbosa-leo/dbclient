package auth

import (
	"context"
	"strings"

	"dbclient/backend/internal/domain"
)

type ChangePassword struct {
	users  domain.UserRepository
	hasher domain.PasswordHasher
}

func NewChangePassword(users domain.UserRepository, hasher domain.PasswordHasher) *ChangePassword {
	return &ChangePassword{
		users:  users,
		hasher: hasher,
	}
}

func (uc *ChangePassword) Execute(ctx context.Context, userID int64, currentPassword, newPassword string) error {
	if strings.TrimSpace(newPassword) == "" {
		return domain.NewValidationError("Nova senha é obrigatória")
	}

	user, err := uc.users.FindByID(ctx, userID)
	if err != nil {
		return err
	}

	if err := uc.hasher.Compare(user.PasswordHash, currentPassword); err != nil {
		return domain.NewValidationError("Senha atual incorreta")
	}

	hash, err := uc.hasher.Hash(newPassword)
	if err != nil {
		return err
	}

	user.PasswordHash = hash
	user.MustChangePassword = false
	_, err = uc.users.Update(ctx, user)
	return err
}
