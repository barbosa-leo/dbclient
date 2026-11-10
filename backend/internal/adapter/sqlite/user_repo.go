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
		`SELECT id, name, email, password_hash, role, must_change_password FROM users WHERE id = ?`,
		id,
	)
	u, err := scanUser(row)
	if err != nil {
		return domain.User{}, err
	}
	envs, err := r.loadUserEnvironments(ctx, u.ID)
	if err != nil {
		return domain.User{}, err
	}
	u.Environments = envs
	return u, nil
}

func (r *UserRepo) FindByEmail(ctx context.Context, email string) (domain.User, error) {
	row := r.db.QueryRowContext(
		ctx,
		`SELECT id, name, email, password_hash, role, must_change_password FROM users WHERE email = ?`,
		email,
	)
	u, err := scanUser(row)
	if err != nil {
		return domain.User{}, err
	}
	envs, err := r.loadUserEnvironments(ctx, u.ID)
	if err != nil {
		return domain.User{}, err
	}
	u.Environments = envs
	return u, nil
}

func (r *UserRepo) List(ctx context.Context) ([]domain.User, error) {
	rows, err := r.db.QueryContext(
		ctx,
		`SELECT id, name, email, password_hash, role, must_change_password FROM users ORDER BY id ASC`,
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
		if err := rows.Scan(&u.ID, &u.Name, &u.Email, &u.PasswordHash, &role, &mustChange); err != nil {
			return nil, err
		}
		u.Role = domain.Role(role)
		u.MustChangePassword = mustChange != 0
		u.Environments = make([]domain.EnvironmentAccess, 0)
		users = append(users, u)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	envRows, err := r.db.QueryContext(ctx, `SELECT user_id, environment_id, access_level FROM user_environments ORDER BY environment_id ASC`)
	if err != nil {
		return nil, err
	}
	defer envRows.Close()

	envMap := make(map[int64][]domain.EnvironmentAccess)
	for envRows.Next() {
		var uid int64
		var access domain.EnvironmentAccess
		var level string
		if err := envRows.Scan(&uid, &access.EnvironmentID, &level); err != nil {
			return nil, err
		}
		access.Level = domain.AccessLevel(level)
		envMap[uid] = append(envMap[uid], access)
	}
	if err := envRows.Err(); err != nil {
		return nil, err
	}

	for i := range users {
		if envs, ok := envMap[users[i].ID]; ok {
			users[i].Environments = envs
		}
	}

	return users, nil
}

func (r *UserRepo) loadUserEnvironments(ctx context.Context, userID int64) ([]domain.EnvironmentAccess, error) {
	rows, err := r.db.QueryContext(
		ctx,
		`SELECT environment_id, access_level FROM user_environments WHERE user_id = ? ORDER BY environment_id ASC`,
		userID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	envs := make([]domain.EnvironmentAccess, 0)
	for rows.Next() {
		var access domain.EnvironmentAccess
		var level string
		if err := rows.Scan(&access.EnvironmentID, &level); err != nil {
			return nil, err
		}
		access.Level = domain.AccessLevel(level)
		envs = append(envs, access)
	}
	return envs, rows.Err()
}

func replaceUserEnvironments(ctx context.Context, tx *sql.Tx, user domain.User) error {
	if _, err := tx.ExecContext(ctx, `DELETE FROM user_environments WHERE user_id = ?`, user.ID); err != nil {
		return err
	}
	if user.Role == domain.RoleAdmin {
		return nil
	}
	for _, access := range user.Environments {
		if _, err := tx.ExecContext(
			ctx,
			`INSERT INTO user_environments (user_id, environment_id, access_level) VALUES (?, ?, ?)
			 ON CONFLICT (user_id, environment_id) DO UPDATE SET access_level = excluded.access_level`,
			user.ID,
			access.EnvironmentID,
			string(access.Level),
		); err != nil {
			return err
		}
	}
	return nil
}

func (r *UserRepo) Create(ctx context.Context, user domain.User) (domain.User, error) {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return domain.User{}, err
	}
	defer tx.Rollback()

	mustChange := 0
	if user.MustChangePassword {
		mustChange = 1
	}
	res, err := tx.ExecContext(
		ctx,
		`INSERT INTO users (name, email, password_hash, role, must_change_password) VALUES (?, ?, ?, ?, ?)`,
		user.Name,
		user.Email,
		user.PasswordHash,
		string(user.Role),
		mustChange,
	)
	if err != nil {
		if isUniqueConstraintError(err) {
			return domain.User{}, domain.NewConflictError("Já existe um usuário com esse e-mail")
		}
		return domain.User{}, err
	}
	id, err := res.LastInsertId()
	if err != nil {
		return domain.User{}, err
	}
	user.ID = id

	if err := replaceUserEnvironments(ctx, tx, user); err != nil {
		return domain.User{}, err
	}

	if err := tx.Commit(); err != nil {
		return domain.User{}, err
	}
	return user, nil
}

func (r *UserRepo) Update(ctx context.Context, user domain.User) (domain.User, error) {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return domain.User{}, err
	}
	defer tx.Rollback()

	mustChange := 0
	if user.MustChangePassword {
		mustChange = 1
	}
	res, err := tx.ExecContext(
		ctx,
		`UPDATE users SET name = ?, email = ?, password_hash = ?, role = ?, must_change_password = ? WHERE id = ?`,
		user.Name,
		user.Email,
		user.PasswordHash,
		string(user.Role),
		mustChange,
		user.ID,
	)
	if err != nil {
		if isUniqueConstraintError(err) {
			return domain.User{}, domain.NewConflictError("Já existe um usuário com esse e-mail")
		}
		return domain.User{}, err
	}
	affected, err := res.RowsAffected()
	if err != nil {
		return domain.User{}, err
	}
	if affected == 0 {
		return domain.User{}, domain.ErrNotFound
	}

	if err := replaceUserEnvironments(ctx, tx, user); err != nil {
		return domain.User{}, err
	}

	if err := tx.Commit(); err != nil {
		return domain.User{}, err
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
	if err := row.Scan(&u.ID, &u.Name, &u.Email, &u.PasswordHash, &role, &mustChange); err != nil {
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
