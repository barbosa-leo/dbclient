package sqlite

import (
	"context"
	"database/sql"
	"errors"

	"dbclient/backend/internal/domain"
)

type ConnectionRepo struct {
	db *sql.DB
}

func NewConnectionRepository(db *sql.DB) *ConnectionRepo {
	return &ConnectionRepo{db: db}
}

func (r *ConnectionRepo) List(ctx context.Context, environmentID *int64) ([]domain.Connection, error) {
	var (
		rows *sql.Rows
		err  error
	)
	if environmentID != nil {
		rows, err = r.db.QueryContext(
			ctx,
			`SELECT id, environment_id, name, host, port, database, username, encrypted_password, ssl_mode
			 FROM connections WHERE environment_id = ? ORDER BY id ASC`,
			*environmentID,
		)
	} else {
		rows, err = r.db.QueryContext(
			ctx,
			`SELECT id, environment_id, name, host, port, database, username, encrypted_password, ssl_mode
			 FROM connections ORDER BY id ASC`,
		)
	}
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	conns := make([]domain.Connection, 0)
	for rows.Next() {
		var c domain.Connection
		var sslMode string
		if err := rows.Scan(
			&c.ID,
			&c.EnvironmentID,
			&c.Name,
			&c.Host,
			&c.Port,
			&c.Database,
			&c.Username,
			&c.EncryptedPassword,
			&sslMode,
		); err != nil {
			return nil, err
		}
		c.SSLMode = domain.SSLMode(sslMode)
		conns = append(conns, c)
	}
	return conns, rows.Err()
}

func (r *ConnectionRepo) ListByUser(ctx context.Context, userID int64, environmentID *int64) ([]domain.Connection, error) {
	var (
		rows *sql.Rows
		err  error
	)
	if environmentID != nil {
		rows, err = r.db.QueryContext(
			ctx,
			`SELECT c.id, c.environment_id, c.name, c.host, c.port, c.database, c.username, c.encrypted_password, c.ssl_mode
			 FROM connections c
			 INNER JOIN user_environments ue ON c.environment_id = ue.environment_id
			 WHERE ue.user_id = ? AND c.environment_id = ? 
			 ORDER BY c.id ASC`,
			userID,
			*environmentID,
		)
	} else {
		rows, err = r.db.QueryContext(
			ctx,
			`SELECT c.id, c.environment_id, c.name, c.host, c.port, c.database, c.username, c.encrypted_password, c.ssl_mode
			 FROM connections c
			 INNER JOIN user_environments ue ON c.environment_id = ue.environment_id
			 WHERE ue.user_id = ? 
			 ORDER BY c.id ASC`,
			userID,
		)
	}
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	conns := make([]domain.Connection, 0)
	for rows.Next() {
		var c domain.Connection
		var sslMode string
		if err := rows.Scan(
			&c.ID,
			&c.EnvironmentID,
			&c.Name,
			&c.Host,
			&c.Port,
			&c.Database,
			&c.Username,
			&c.EncryptedPassword,
			&sslMode,
		); err != nil {
			return nil, err
		}
		c.SSLMode = domain.SSLMode(sslMode)
		conns = append(conns, c)
	}
	return conns, rows.Err()
}

func (r *ConnectionRepo) HasUserAccess(ctx context.Context, userID int64, connectionID int64) (bool, error) {
	var count int
	err := r.db.QueryRowContext(
		ctx,
		`SELECT COUNT(*)
		 FROM connections c
		 INNER JOIN user_environments ue ON c.environment_id = ue.environment_id
		 WHERE ue.user_id = ? AND c.id = ?`,
		userID,
		connectionID,
	).Scan(&count)
	return count > 0, err
}

func (r *ConnectionRepo) FindByID(ctx context.Context, id int64) (domain.Connection, error) {
	var c domain.Connection
	var sslMode string
	err := r.db.QueryRowContext(
		ctx,
		`SELECT id, environment_id, name, host, port, database, username, encrypted_password, ssl_mode
		 FROM connections WHERE id = ?`,
		id,
	).Scan(
		&c.ID,
		&c.EnvironmentID,
		&c.Name,
		&c.Host,
		&c.Port,
		&c.Database,
		&c.Username,
		&c.EncryptedPassword,
		&sslMode,
	)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return domain.Connection{}, domain.ErrNotFound
		}
		return domain.Connection{}, err
	}
	c.SSLMode = domain.SSLMode(sslMode)
	return c, nil
}

func (r *ConnectionRepo) Create(ctx context.Context, conn domain.Connection) (domain.Connection, error) {
	res, err := r.db.ExecContext(
		ctx,
		`INSERT INTO connections (environment_id, name, host, port, database, username, encrypted_password, ssl_mode)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
		conn.EnvironmentID,
		conn.Name,
		conn.Host,
		conn.Port,
		conn.Database,
		conn.Username,
		conn.EncryptedPassword,
		string(conn.SSLMode),
	)
	if err != nil {
		return domain.Connection{}, err
	}
	id, err := res.LastInsertId()
	if err != nil {
		return domain.Connection{}, err
	}
	conn.ID = id
	return conn, nil
}

func (r *ConnectionRepo) Update(ctx context.Context, conn domain.Connection) (domain.Connection, error) {
	res, err := r.db.ExecContext(
		ctx,
		`UPDATE connections
		 SET environment_id = ?, name = ?, host = ?, port = ?, database = ?, username = ?, encrypted_password = ?, ssl_mode = ?
		 WHERE id = ?`,
		conn.EnvironmentID,
		conn.Name,
		conn.Host,
		conn.Port,
		conn.Database,
		conn.Username,
		conn.EncryptedPassword,
		string(conn.SSLMode),
		conn.ID,
	)
	if err != nil {
		return domain.Connection{}, err
	}
	affected, err := res.RowsAffected()
	if err != nil {
		return domain.Connection{}, err
	}
	if affected == 0 {
		return domain.Connection{}, domain.ErrNotFound
	}
	return conn, nil
}

func (r *ConnectionRepo) Delete(ctx context.Context, id int64) error {
	res, err := r.db.ExecContext(ctx, `DELETE FROM connections WHERE id = ?`, id)
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

func (r *ConnectionRepo) CountByEnvironmentID(ctx context.Context, environmentID int64) (int, error) {
	var count int
	err := r.db.QueryRowContext(
		ctx,
		`SELECT COUNT(*) FROM connections WHERE environment_id = ?`,
		environmentID,
	).Scan(&count)
	return count, err
}
