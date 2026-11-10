package connection

import (
	"context"
	"errors"

	"dbclient/backend/internal/domain"
)

type AuthorizeAccess struct {
	access domain.ConnectionAccessReader
}

func NewAuthorizeAccess(access domain.ConnectionAccessReader) *AuthorizeAccess {
	return &AuthorizeAccess{access: access}
}

func (uc *AuthorizeAccess) Execute(
	ctx context.Context,
	actor domain.User,
	connectionID int64,
	required domain.AccessLevel,
) (domain.AccessLevel, error) {
	if actor.Role == domain.RoleAdmin {
		return domain.AccessWrite, nil
	}
	if actor.ID == 0 {
		return "", domain.NewForbiddenError("Ambiente não autorizado para este usuário")
	}

	granted, err := uc.access.UserAccessLevel(ctx, actor.ID, connectionID)
	if errors.Is(err, domain.ErrNotFound) {
		return "", domain.NewForbiddenError("Ambiente não autorizado para este usuário")
	}
	if err != nil {
		return "", err
	}
	if !granted.Allows(required) {
		return "", domain.NewForbiddenError("Permissão de escrita necessária neste ambiente")
	}
	return granted, nil
}
