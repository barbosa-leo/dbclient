package sqlite

import (
	"context"
	"database/sql"
	"fmt"
	"os"

	"dbclient/backend/internal/domain"
)

type migration struct {
	version int
	apply   func(ctx context.Context, tx *sql.Tx, hasher domain.PasswordHasher) error
}

var migrations = []migration{
	{
		version: 1,
		apply: func(ctx context.Context, tx *sql.Tx, hasher domain.PasswordHasher) error {
			const schema = `
CREATE TABLE IF NOT EXISTS users (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	username TEXT NOT NULL UNIQUE COLLATE NOCASE,
	password_hash TEXT NOT NULL,
	role TEXT NOT NULL CHECK (role IN ('admin', 'operator')),
	must_change_password INTEGER NOT NULL DEFAULT 1,
	created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS sessions (
	token TEXT PRIMARY KEY,
	user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
	expires_at DATETIME NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);

CREATE TABLE IF NOT EXISTS environments (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	name TEXT NOT NULL UNIQUE COLLATE NOCASE,
	created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS connections (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	environment_id INTEGER NOT NULL REFERENCES environments(id) ON DELETE RESTRICT,
	name TEXT NOT NULL,
	host TEXT NOT NULL,
	port INTEGER NOT NULL,
	database TEXT NOT NULL,
	username TEXT NOT NULL,
	encrypted_password TEXT NOT NULL,
	ssl_mode TEXT NOT NULL,
	created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_connections_environment_id ON connections(environment_id);
`
			if _, err := tx.ExecContext(ctx, schema); err != nil {
				return err
			}

			var count int
			if err := tx.QueryRowContext(ctx, `SELECT COUNT(*) FROM users WHERE username = 'admin'`).Scan(&count); err != nil {
				return err
			}
			if count == 0 {
				initialPassword := os.Getenv("DBCLIENT_INITIAL_ADMIN_PASSWORD")
				if initialPassword == "" {
					initialPassword = "admin"
				}
				hash, err := hasher.Hash(initialPassword)
				if err != nil {
					return err
				}
				_, err = tx.ExecContext(
					ctx,
					`INSERT INTO users (username, password_hash, role, must_change_password) VALUES (?, ?, ?, 1)`,
					"admin",
					hash,
					string(domain.RoleAdmin),
				)
				if err != nil {
					return err
				}
			}
			return nil
		},
	},
	{
		version: 2,
		apply: func(ctx context.Context, tx *sql.Tx, hasher domain.PasswordHasher) error {
			const migrateUsers = `
CREATE TABLE users_new (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	username TEXT NOT NULL UNIQUE COLLATE NOCASE,
	password_hash TEXT NOT NULL,
	role TEXT NOT NULL CHECK (role IN ('admin', 'operator', 'viewer')),
	must_change_password INTEGER NOT NULL DEFAULT 1,
	created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO users_new (id, username, password_hash, role, must_change_password, created_at)
SELECT id, username, password_hash, role, must_change_password, created_at FROM users;

CREATE TABLE sessions_backup AS SELECT token, user_id, expires_at FROM sessions;
DROP TABLE sessions;
DROP TABLE users;
ALTER TABLE users_new RENAME TO users;

CREATE TABLE sessions (
	token TEXT PRIMARY KEY,
	user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
	expires_at DATETIME NOT NULL
);

INSERT INTO sessions (token, user_id, expires_at)
SELECT token, user_id, expires_at FROM sessions_backup;
DROP TABLE sessions_backup;

CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);
`
			_, err := tx.ExecContext(ctx, migrateUsers)
			return err
		},
	},
	{
		version: 3,
		apply: func(ctx context.Context, tx *sql.Tx, hasher domain.PasswordHasher) error {
			const migrateUsers = `
CREATE TABLE users_new (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	name TEXT NOT NULL,
	email TEXT NOT NULL UNIQUE COLLATE NOCASE,
	password_hash TEXT NOT NULL,
	role TEXT NOT NULL CHECK (role IN ('admin', 'operator', 'viewer')),
	must_change_password INTEGER NOT NULL DEFAULT 1,
	created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO users_new (id, name, email, password_hash, role, must_change_password, created_at)
SELECT
	id,
	CASE WHEN LOWER(username) = 'admin' THEN 'Administrador' ELSE username END,
	CASE
		WHEN LOWER(username) = 'admin' THEN 'admin@dbclient.local'
		WHEN INSTR(username, '@') > 0 THEN LOWER(username)
		ELSE LOWER(username) || '@dbclient.local'
	END,
	password_hash,
	role,
	must_change_password,
	created_at
FROM users;

CREATE TABLE sessions_backup AS SELECT token, user_id, expires_at FROM sessions;
DROP TABLE sessions;
DROP TABLE users;
ALTER TABLE users_new RENAME TO users;

CREATE TABLE sessions (
	token TEXT PRIMARY KEY,
	user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
	expires_at DATETIME NOT NULL
);

INSERT INTO sessions (token, user_id, expires_at)
SELECT token, user_id, expires_at FROM sessions_backup;
DROP TABLE sessions_backup;

CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);
`
			_, err := tx.ExecContext(ctx, migrateUsers)
			return err
		},
	},
	{
		version: 4,
		apply: func(ctx context.Context, tx *sql.Tx, hasher domain.PasswordHasher) error {
			const settingsSchema = `
CREATE TABLE IF NOT EXISTS settings (
	key TEXT PRIMARY KEY,
	value TEXT NOT NULL
);

INSERT OR IGNORE INTO settings (key, value) VALUES ('max_file_size', '52428800');
`
			_, err := tx.ExecContext(ctx, settingsSchema)
			return err
		},
	},
	{
		version: 5,
		apply: func(ctx context.Context, tx *sql.Tx, hasher domain.PasswordHasher) error {
			const historySchema = `
CREATE TABLE IF NOT EXISTS execution_history (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
	kind TEXT NOT NULL CHECK (kind IN ('query', 'script')),
	connection_id INTEGER NOT NULL,
	connection_name TEXT NOT NULL,
	database TEXT NOT NULL,
	sql_text TEXT NOT NULL DEFAULT '',
	file_name TEXT NOT NULL DEFAULT '',
	file_size INTEGER NOT NULL DEFAULT 0,
	success INTEGER NOT NULL,
	error TEXT NOT NULL DEFAULT '',
	duration_ms INTEGER NOT NULL,
	created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_execution_history_user_kind ON execution_history(user_id, kind, id DESC);
CREATE INDEX IF NOT EXISTS idx_execution_history_kind ON execution_history(kind, id DESC);
`
			_, err := tx.ExecContext(ctx, historySchema)
			return err
		},
	},
	{
		version: 6,
		apply: func(ctx context.Context, tx *sql.Tx, hasher domain.PasswordHasher) error {
			const settingsSeed = `
INSERT OR IGNORE INTO settings (key, value) VALUES ('history_enabled', 'true');
INSERT OR IGNORE INTO settings (key, value) VALUES ('history_retention_days', '7');
`
			_, err := tx.ExecContext(ctx, settingsSeed)
			return err
		},
	},
	{
		version: 7,
		apply: func(ctx context.Context, tx *sql.Tx, hasher domain.PasswordHasher) error {
			const schema = `
CREATE TABLE IF NOT EXISTS user_environments (
	user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
	environment_id INTEGER NOT NULL REFERENCES environments(id) ON DELETE CASCADE,
	PRIMARY KEY (user_id, environment_id)
);
CREATE INDEX IF NOT EXISTS idx_user_environments_env ON user_environments(environment_id);

INSERT OR IGNORE INTO user_environments (user_id, environment_id)
SELECT u.id, e.id FROM users u CROSS JOIN environments e WHERE u.role != 'admin';
`
			_, err := tx.ExecContext(ctx, schema)
			return err
		},
	},
}

func runMigrations(ctx context.Context, db *sql.DB, hasher domain.PasswordHasher) error {
	const createTable = `
CREATE TABLE IF NOT EXISTS schema_migrations (
	version INTEGER PRIMARY KEY,
	applied_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);`
	if _, err := db.ExecContext(ctx, createTable); err != nil {
		return err
	}

	for _, m := range migrations {
		var exists int
		err := db.QueryRowContext(ctx, `SELECT COUNT(*) FROM schema_migrations WHERE version = ?`, m.version).Scan(&exists)
		if err != nil {
			return err
		}
		if exists > 0 {
			continue
		}

		tx, err := db.BeginTx(ctx, nil)
		if err != nil {
			return err
		}

		if err := m.apply(ctx, tx, hasher); err != nil {
			_ = tx.Rollback()
			return fmt.Errorf("migration %d: %w", m.version, err)
		}

		if _, err := tx.ExecContext(ctx, `INSERT INTO schema_migrations (version) VALUES (?)`, m.version); err != nil {
			_ = tx.Rollback()
			return fmt.Errorf("record migration %d: %w", m.version, err)
		}

		if err := tx.Commit(); err != nil {
			return err
		}
	}

	return nil
}
