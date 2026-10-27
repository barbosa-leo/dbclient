//go:build desktop

package auth

import (
	"context"
	"crypto/rand"
	"crypto/subtle"
	"encoding/hex"
	"time"

	"dbclient/backend/internal/domain"
)

type LocalSignIn struct {
	users      domain.UserRepository
	sessions   domain.SessionRepository
	hasher     domain.PasswordHasher
	token      []byte
	sessionTTL time.Duration
}

func NewLocalSignIn(
	users domain.UserRepository,
	sessions domain.SessionRepository,
	hasher domain.PasswordHasher,
	token string,
	sessionTTL time.Duration,
) *LocalSignIn {
	return &LocalSignIn{
		users:      users,
		sessions:   sessions,
		hasher:     hasher,
		token:      []byte(token),
		sessionTTL: sessionTTL,
	}
}

func (uc *LocalSignIn) Execute(ctx context.Context, token string) (domain.Session, error) {
	if len(uc.token) == 0 || subtle.ConstantTimeCompare([]byte(token), uc.token) != 1 {
		return domain.Session{}, domain.ErrUnauthorized
	}

	admin, err := uc.findAdmin(ctx)
	if err != nil {
		return domain.Session{}, err
	}

	if admin.MustChangePassword {
		if err := uc.retireDefaultPassword(ctx, admin); err != nil {
			return domain.Session{}, err
		}
	}

	rawToken, err := randomHex(32)
	if err != nil {
		return domain.Session{}, err
	}

	now := time.Now().UTC()
	_ = uc.sessions.DeleteExpired(ctx, now)

	session := domain.Session{
		Token:     rawToken,
		UserID:    admin.ID,
		ExpiresAt: now.Add(uc.sessionTTL),
	}
	if err := uc.sessions.Create(ctx, session); err != nil {
		return domain.Session{}, err
	}
	return session, nil
}

func (uc *LocalSignIn) findAdmin(ctx context.Context) (domain.User, error) {
	users, err := uc.users.List(ctx)
	if err != nil {
		return domain.User{}, err
	}

	var admin *domain.User
	for i := range users {
		if users[i].Role == domain.RoleAdmin && (admin == nil || users[i].ID < admin.ID) {
			admin = &users[i]
		}
	}
	if admin == nil {
		return domain.User{}, domain.NewForbiddenError("Nenhum administrador disponível para o modo local")
	}
	return *admin, nil
}

// Local mode never asks for a password, so the migration's default one would otherwise stay valid
// forever and travel with the database if it is ever moved to a web installation.
func (uc *LocalSignIn) retireDefaultPassword(ctx context.Context, admin domain.User) error {
	password, err := randomHex(32)
	if err != nil {
		return err
	}
	hash, err := uc.hasher.Hash(password)
	if err != nil {
		return err
	}

	admin.PasswordHash = hash
	admin.MustChangePassword = false
	_, err = uc.users.Update(ctx, admin)
	return err
}

func randomHex(size int) (string, error) {
	buf := make([]byte, size)
	if _, err := rand.Read(buf); err != nil {
		return "", err
	}
	return hex.EncodeToString(buf), nil
}
