package sqlite

import (
	"context"
	"database/sql"
	"errors"

	"dbclient/backend/internal/domain"
)

type EnvironmentRepo struct {
	db *sql.DB
}

func NewEnvironmentRepository(db *sql.DB) *EnvironmentRepo {
	return &EnvironmentRepo{db: db}
}

func (r *EnvironmentRepo) List(ctx context.Context) ([]domain.Environment, error) {
	rows, err := r.db.QueryContext(ctx, `SELECT id, name FROM environments ORDER BY id ASC`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	envs := make([]domain.Environment, 0)
	for rows.Next() {
		var env domain.Environment
		if err := rows.Scan(&env.ID, &env.Name); err != nil {
			return nil, err
		}
		envs = append(envs, env)
	}
	return envs, rows.Err()
}

func (r *EnvironmentRepo) FindByID(ctx context.Context, id int64) (domain.Environment, error) {
	var env domain.Environment
	err := r.db.QueryRowContext(ctx, `SELECT id, name FROM environments WHERE id = ?`, id).Scan(&env.ID, &env.Name)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return domain.Environment{}, domain.ErrNotFound
		}
		return domain.Environment{}, err
	}
	return env, nil
}

func (r *EnvironmentRepo) Create(ctx context.Context, name string) (domain.Environment, error) {
	res, err := r.db.ExecContext(ctx, `INSERT INTO environments (name) VALUES (?)`, name)
	if err != nil {
		if isUniqueConstraintError(err) {
			return domain.Environment{}, domain.NewConflictError("Já existe um environment com esse nome")
		}
		return domain.Environment{}, err
	}
	id, err := res.LastInsertId()
	if err != nil {
		return domain.Environment{}, err
	}
	return domain.Environment{ID: id, Name: name}, nil
}

func (r *EnvironmentRepo) Delete(ctx context.Context, id int64) error {
	res, err := r.db.ExecContext(ctx, `DELETE FROM environments WHERE id = ?`, id)
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
