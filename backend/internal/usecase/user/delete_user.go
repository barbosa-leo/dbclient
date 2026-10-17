package user

import (
	"context"

	"dbclient/backend/internal/domain"
)

type DeleteUser struct {
	users    domain.UserRepository
	sessions domain.SessionRepository
}

func NewDeleteUser(users domain.UserRepository, sessions domain.SessionRepository) *DeleteUser {
	return &DeleteUser{
		users:    users,
		sessions: sessions,
	}
}

func (uc *DeleteUser) Execute(ctx context.Context, actorID, targetID int64) error {
	if actorID == targetID {
		return domain.NewConflictError("Não é permitido excluir o próprio usuário")
	}

	target, err := uc.users.FindByID(ctx, targetID)
	if err != nil {
		return err
	}

	if target.Role == domain.RoleAdmin {
		admins, err := uc.users.CountByRole(ctx, domain.RoleAdmin)
		if err != nil {
			return err
		}
		if admins <= 1 {
			return domain.NewConflictError("Não é possível remover o último administrador")
		}
	}

	_ = uc.sessions.DeleteByUserID(ctx, targetID)
	return uc.users.Delete(ctx, targetID)
}
