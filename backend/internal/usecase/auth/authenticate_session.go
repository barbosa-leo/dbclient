package auth

import (
	"context"
	"time"

	"dbclient/backend/internal/domain"
)

type AuthenticateSession struct {
	sessions domain.SessionRepository
	users    domain.UserRepository
}

func NewAuthenticateSession(sessions domain.SessionRepository, users domain.UserRepository) *AuthenticateSession {
	return &AuthenticateSession{
		sessions: sessions,
		users:    users,
	}
}

func (uc *AuthenticateSession) Execute(ctx context.Context, token string) (domain.User, error) {
	if token == "" {
		return domain.User{}, domain.ErrUnauthorized
	}

	session, err := uc.sessions.FindByToken(ctx, token)
	if err != nil {
		return domain.User{}, domain.ErrUnauthorized
	}

	if time.Now().UTC().After(session.ExpiresAt) {
		_ = uc.sessions.DeleteByToken(ctx, token)
		return domain.User{}, domain.ErrUnauthorized
	}

	user, err := uc.users.FindByID(ctx, session.UserID)
	if err != nil {
		return domain.User{}, domain.ErrUnauthorized
	}

	return user, nil
}
