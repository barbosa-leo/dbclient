package auth

import (
	"context"

	"dbclient/backend/internal/domain"
)

type Logout struct {
	sessions domain.SessionRepository
}

func NewLogout(sessions domain.SessionRepository) *Logout {
	return &Logout{sessions: sessions}
}

func (uc *Logout) Execute(ctx context.Context, token string) error {
	if token == "" {
		return nil
	}
	return uc.sessions.DeleteByToken(ctx, token)
}
