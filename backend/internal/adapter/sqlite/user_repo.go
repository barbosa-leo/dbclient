package sqlite

import (
	"context"
	"database/sql"
	"errors"
	"strings"

	"dbclient/backend/internal/domain"
)

type UserRepo struct {
	db *sql.DB
}

func NewUserRepository(db *sql.DB) *UserRepo {
	return &UserRepo{db: db}
}

func (r *UserRepo) FindByID(ctx context.Context, id int64) (domain.User, error) {
	row := r.db.QueryRowContext(
		ctx,
		`SELECT id, username, password_hash, role, must_change_password FROM users WHERE id = ?`,
		id,
	)
	return scanUser(row)
}

func (r *UserRepo) FindByUsername(ctx context.Context, username string) (domain.User, error) {
	row := r.db.QueryRowContext(
		ctx,
		`SELECT id, username, password_hash, role, must_change_password FROM users WHERE username = ?`,
		username,
	)
	return scanUser(row)
}

func (r *UserRepo) List(ctx context.Context) ([]domain.User, error) {
	rows, err := r.db.QueryContext(
		ctx,
		`SELECT id, username, password_hash, role, must_change_password FROM users ORDER BY id ASC`,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	users := make([]domain.User, 0)
	for rows.Next() {
		var u domain.User
		var role string
		var mustChange int
		if err := rows.Scan(&u.ID, &u.Username, &u.PasswordHash, &role, &mustChange); err != nil {
			return nil, err
		}
		u.Role = domain.Role(role)
		u.MustChangePassword = mustChange != 0
		users = append(users, u)
	}
	return users, rows.Err()
}

func (r *UserRepo) Create(ctx context.Context, user domain.User) (domain.User, error) {
	mustChange := 0
	if user.MustChangePassword {
		mustChange = 1
	}
	res, err := r.db.ExecContext(
		ctx,
		`INSERT INTO users (username, password_hash, role, must_change_password) VALUES (?, ?, ?, ?)`,
		user.Username,
		user.PasswordHash,
		string(user.Role),
		mustChange,
	)
	if err != nil {
		if isUniqueConstraintError(err) {
			return domain.User{}, domain.NewConflictError("Já existe um usuário com esse nome")
		}
		return domain.User{}, err
	}
	id, err := res.LastInsertId()
	if err != nil {
		return domain.User{}, err
	}
	user.ID = id
	return user, nil
}

func (r *UserRepo) Update(ctx context.Context, user domain.User) (domain.User, error) {
	mustChange := 0
	if user.MustChangePassword {
		mustChange = 1
	}
	res, err := r.db.ExecContext(
		ctx,
		`UPDATE users SET password_hash = ?, role = ?, must_change_password = ? WHERE id = ?`,
		user.PasswordHash,
		string(user.Role),
		mustChange,
		user.ID,
	)
	if err != nil {
		return domain.User{}, err
	}
	affected, err := res.RowsAffected()
	if err != nil {
		return domain.User{}, err
	}
	if affected == 0 {
		return domain.User{}, domain.ErrNotFound
	}
	return user, nil
}

func (r *UserRepo) Delete(ctx context.Context, id int64) error {
	res, err := r.db.ExecContext(ctx, `DELETE FROM users WHERE id = ?`, id)
	if err != nil {
		return err
	}
	affected, err := res.RowsAffected()
	if err != nil {
		return err
	}
	if affected == 0 {
		return domain.ErrNotFound
	}
	return nil
}

func (r *UserRepo) CountByRole(ctx context.Context, role domain.Role) (int, error) {
	var count int
	err := r.db.QueryRowContext(ctx, `SELECT COUNT(*) FROM users WHERE role = ?`, string(role)).Scan(&count)
	return count, err
}

func scanUser(row *sql.Row) (domain.User, error) {
	var u domain.User
	var role string
	var mustChange int
	if err := row.Scan(&u.ID, &u.Username, &u.PasswordHash, &role, &mustChange); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return domain.User{}, domain.ErrNotFound
		}
		return domain.User{}, err
	}
	u.Role = domain.Role(role)
	u.MustChangePassword = mustChange != 0
	return u, nil
}

func isUniqueConstraintError(err error) bool {
	return err != nil && strings.Contains(strings.ToLower(err.Error()), "unique constraint")
}
