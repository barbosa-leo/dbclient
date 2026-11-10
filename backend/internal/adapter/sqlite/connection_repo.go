package sqlite

import (
	"context"
	"database/sql"
	"errors"

	"dbclient/backend/internal/domain"
)

const connectionColumns = `c.id, c.environment_id, c.name, c.host, c.port, c.database, c.username,
	c.encrypted_password, c.readonly_username, c.readonly_encrypted_password, c.ssl_mode`

type rowScanner interface {
	Scan(dest ...any) error
}

type ConnectionRepo struct {
	db *sql.DB
}

func NewConnectionRepository(db *sql.DB) *ConnectionRepo {
	return &ConnectionRepo{db: db}
}

func (r *ConnectionRepo) List(ctx context.Context, environmentID *int64) ([]domain.Connection, error) {
	if environmentID != nil {
		return r.query(
			ctx,
			`SELECT `+connectionColumns+` FROM connections c WHERE c.environment_id = ? ORDER BY c.id ASC`,
			*environmentID,
		)
	}
	return r.query(ctx, `SELECT `+connectionColumns+` FROM connections c ORDER BY c.id ASC`)
}

func (r *ConnectionRepo) ListByUser(ctx context.Context, userID int64, environmentID *int64) ([]domain.Connection, error) {
	const base = `SELECT ` + connectionColumns + `
		 FROM connections c
		 INNER JOIN user_environments ue ON c.environment_id = ue.environment_id
		 WHERE ue.user_id = ?`
	if environmentID != nil {
		return r.query(ctx, base+` AND c.environment_id = ? ORDER BY c.id ASC`, userID, *environmentID)
	}
	return r.query(ctx, base+` ORDER BY c.id ASC`, userID)
}

func (r *ConnectionRepo) UserAccessLevel(ctx context.Context, userID int64, connectionID int64) (domain.AccessLevel, error) {
	var level string
	err := r.db.QueryRowContext(
		ctx,
		`SELECT ue.access_level
		 FROM connections c
		 INNER JOIN user_environments ue ON c.environment_id = ue.environment_id
		 WHERE ue.user_id = ? AND c.id = ?`,
		userID,
		connectionID,
	).Scan(&level)
	if errors.Is(err, sql.ErrNoRows) {
		return "", domain.ErrNotFound
	}
	if err != nil {
		return "", err
	}
	return domain.AccessLevel(level), nil
}

func (r *ConnectionRepo) FindByID(ctx context.Context, id int64) (domain.Connection, error) {
	row := r.db.QueryRowContext(ctx, `SELECT `+connectionColumns+` FROM connections c WHERE c.id = ?`, id)
	conn, err := scanConnection(row)
	if errors.Is(err, sql.ErrNoRows) {
		return domain.Connection{}, domain.ErrNotFound
	}
	return conn, err
}

func (r *ConnectionRepo) Create(ctx context.Context, conn domain.Connection) (domain.Connection, error) {
	res, err := r.db.ExecContext(
		ctx,
		`INSERT INTO connections (environment_id, name, host, port, database, username, encrypted_password,
			readonly_username, readonly_encrypted_password, ssl_mode)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		conn.EnvironmentID,
		conn.Name,
		conn.Host,
		conn.Port,
		conn.Database,
		conn.Username,
		conn.EncryptedPassword,
		conn.ReadOnlyUsername,
		conn.EncryptedReadOnlyPassword,
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
		 SET environment_id = ?, name = ?, host = ?, port = ?, database = ?, username = ?, encrypted_password = ?,
			readonly_username = ?, readonly_encrypted_password = ?, ssl_mode = ?
		 WHERE id = ?`,
		conn.EnvironmentID,
		conn.Name,
		conn.Host,
		conn.Port,
		conn.Database,
		conn.Username,
		conn.EncryptedPassword,
		conn.ReadOnlyUsername,
		conn.EncryptedReadOnlyPassword,
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

func (r *ConnectionRepo) query(ctx context.Context, query string, args ...any) ([]domain.Connection, error) {
	rows, err := r.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	conns := make([]domain.Connection, 0)
	for rows.Next() {
		conn, err := scanConnection(rows)
		if err != nil {
			return nil, err
		}
		conns = append(conns, conn)
	}
	return conns, rows.Err()
}

func scanConnection(row rowScanner) (domain.Connection, error) {
	var c domain.Connection
	var sslMode string
	if err := row.Scan(
		&c.ID,
		&c.EnvironmentID,
		&c.Name,
		&c.Host,
		&c.Port,
		&c.Database,
		&c.Username,
		&c.EncryptedPassword,
		&c.ReadOnlyUsername,
		&c.EncryptedReadOnlyPassword,
		&sslMode,
	); err != nil {
		return domain.Connection{}, err
	}
	c.SSLMode = domain.SSLMode(sslMode)
	return c, nil
}
