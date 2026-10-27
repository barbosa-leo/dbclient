//go:build desktop

package main

import (
	"dbclient/backend/internal/config"
	"dbclient/backend/internal/domain"
	transporthttp "dbclient/backend/internal/transport/http"
	"dbclient/backend/internal/transport/http/handler"
	"dbclient/backend/internal/usecase/auth"
)

func newLocalAuth(
	cfg config.Config,
	users domain.UserRepository,
	sessions domain.SessionRepository,
	hasher domain.PasswordHasher,
) transporthttp.LocalAuthRoutes {
	if cfg.AuthMode != config.AuthModeLocal {
		return nil
	}
	signIn := auth.NewLocalSignIn(users, sessions, hasher, cfg.LocalToken, cfg.SessionTTL)
	return handler.NewLocalAuthHandler(signIn)
}
