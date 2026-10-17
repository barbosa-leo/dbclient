package auth

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"strings"
	"time"

	"dbclient/backend/internal/domain"
)

type Login struct {
	users      domain.UserRepository
	sessions   domain.SessionRepository
	hasher     domain.PasswordHasher
	sessionTTL time.Duration
}

func NewLogin(
	users domain.UserRepository,
	sessions domain.SessionRepository,
	hasher domain.PasswordHasher,
	sessionTTL time.Duration,
) *Login {
	return &Login{
		users:      users,
		sessions:   sessions,
		hasher:     hasher,
		sessionTTL: sessionTTL,
	}
}

func (uc *Login) Execute(ctx context.Context, username, password string) (domain.User, domain.Session, error) {
	trimmed := strings.TrimSpace(username)
	if trimmed == "" || password == "" {
		return domain.User{}, domain.Session{}, domain.ErrUnauthorized
	}

	user, err := uc.users.FindByUsername(ctx, trimmed)
	if err != nil {
		return domain.User{}, domain.Session{}, domain.ErrUnauthorized
	}

	if err := uc.hasher.Compare(user.PasswordHash, password); err != nil {
		return domain.User{}, domain.Session{}, domain.ErrUnauthorized
	}

	var rawToken [32]byte
	if _, err := rand.Read(rawToken[:]); err != nil {
		return domain.User{}, domain.Session{}, err
	}

	now := time.Now().UTC()
	_ = uc.sessions.DeleteExpired(ctx, now)

	session := domain.Session{
		Token:     hex.EncodeToString(rawToken[:]),
		UserID:    user.ID,
		ExpiresAt: now.Add(uc.sessionTTL),
	}
	if err := uc.sessions.Create(ctx, session); err != nil {
		return domain.User{}, domain.Session{}, err
	}

	return user, session, nil
}
