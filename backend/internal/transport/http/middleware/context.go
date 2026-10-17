package middleware

import (
	"context"

	"dbclient/backend/internal/domain"
)

type contextKey string

const (
	userContextKey  contextKey = "auth_user"
	tokenContextKey contextKey = "auth_token"
)

func WithUser(ctx context.Context, user domain.User, token string) context.Context {
	ctx = context.WithValue(ctx, userContextKey, user)
	return context.WithValue(ctx, tokenContextKey, token)
}

func UserFromContext(ctx context.Context) (domain.User, bool) {
	u, ok := ctx.Value(userContextKey).(domain.User)
	return u, ok
}

func TokenFromContext(ctx context.Context) string {
	t, _ := ctx.Value(tokenContextKey).(string)
	return t
}
