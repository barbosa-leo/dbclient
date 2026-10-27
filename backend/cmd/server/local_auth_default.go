//go:build !desktop

package main

import (
	"dbclient/backend/internal/config"
	"dbclient/backend/internal/domain"
	transporthttp "dbclient/backend/internal/transport/http"
)

func newLocalAuth(
	config.Config,
	domain.UserRepository,
	domain.SessionRepository,
	domain.PasswordHasher,
) transporthttp.LocalAuthRoutes {
	return nil
}
