package sqlite

import (
	"context"
	"database/sql"
	"fmt"
	"path/filepath"
	"testing"

	"dbclient/backend/internal/adapter/crypto"
)

func TestMigrationNinePreservesUsersAndMapsRoles(t *testing.T) {
	ctx := context.Background()
	hasher := crypto.NewBcryptHasher()
	dsn := fmt.Sprintf("file:%s?_pragma=foreign_keys(1)", filepath.Join(t.TempDir(), "db.sqlite"))
	db, err := sql.Open("sqlite", dsn)
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	db.SetMaxOpenConns(1)

	if err := runMigrationList(ctx, db, hasher, migrations[:8]); err != nil {
		t.Fatal(err)
	}

	const seed = `
INSERT INTO users (id, name, email, password_hash, role, must_change_password) VALUES
	(2, 'Op', 'op@x.local', 'h', 'operator', 0),
	(3, 'View', 'view@x.local', 'h', 'viewer', 0);
INSERT INTO environments (id, name) VALUES (1, 'prod'), (2, 'dev');
INSERT INTO user_environments (user_id, environment_id) VALUES (2, 1), (2, 2), (3, 1);
INSERT INTO sessions (token, user_id, expires_at) VALUES ('tok', 2, '2999-01-01');
INSERT INTO execution_history (user_id, kind, connection_id, connection_name, database, success, duration_ms)
	VALUES (3, 'query', 1, 'c', 'd', 1, 1);
INSERT INTO update_views (user_id, version) VALUES (3, '0.1.0');
INSERT INTO connections (environment_id, name, host, port, database, username, encrypted_password, ssl_mode)
	VALUES (1, 'c', 'h', 5432, 'd', 'u', 'p', 'prefer');
`
	if _, err := db.ExecContext(ctx, seed); err != nil {
		t.Fatal(err)
	}

	if err := runMigrations(ctx, db, hasher); err != nil {
		t.Fatal(err)
	}

	roles := map[int64]string{}
	rows, err := db.QueryContext(ctx, `SELECT id, role FROM users`)
	if err != nil {
		t.Fatal(err)
	}
	for rows.Next() {
		var id int64
		var role string
		if err := rows.Scan(&id, &role); err != nil {
			t.Fatal(err)
		}
		roles[id] = role
	}
	rows.Close()
	if roles[1] != "admin" || roles[2] != "member" || roles[3] != "member" {
		t.Fatalf("unexpected roles: %v", roles)
	}

	levels := map[string]string{}
	rows, err = db.QueryContext(ctx, `SELECT user_id, environment_id, access_level FROM user_environments`)
	if err != nil {
		t.Fatal(err)
	}
	for rows.Next() {
		var userID, envID int64
		var level string
		if err := rows.Scan(&userID, &envID, &level); err != nil {
			t.Fatal(err)
		}
		levels[fmt.Sprintf("%d/%d", userID, envID)] = level
	}
	rows.Close()
	want := map[string]string{"2/1": "write", "2/2": "write", "3/1": "read"}
	if fmt.Sprint(levels) != fmt.Sprint(want) {
		t.Fatalf("unexpected access levels: %v", levels)
	}

	for table, expected := range map[string]int{"sessions": 1, "execution_history": 1, "update_views": 1} {
		var count int
		if err := db.QueryRowContext(ctx, `SELECT COUNT(*) FROM `+table).Scan(&count); err != nil {
			t.Fatal(err)
		}
		if count != expected {
			t.Fatalf("%s lost rows during migration: %d", table, count)
		}
	}

	var readOnlyUser string
	if err := db.QueryRowContext(ctx, `SELECT readonly_username FROM connections`).Scan(&readOnlyUser); err != nil || readOnlyUser != "" {
		t.Fatalf("expected empty read-only username, got %q err=%v", readOnlyUser, err)
	}

	var fkEnabled int
	if err := db.QueryRowContext(ctx, `PRAGMA foreign_keys`).Scan(&fkEnabled); err != nil || fkEnabled != 1 {
		t.Fatalf("foreign keys must be re-enabled after migration, got %d err=%v", fkEnabled, err)
	}

	if _, err := db.ExecContext(ctx, `DELETE FROM users WHERE id = 3`); err != nil {
		t.Fatal(err)
	}
	var orphan int
	if err := db.QueryRowContext(ctx, `SELECT COUNT(*) FROM update_views WHERE user_id = 3`).Scan(&orphan); err != nil || orphan != 0 {
		t.Fatalf("cascade from users must still work after the rebuild, got %d err=%v", orphan, err)
	}

	if _, err := db.ExecContext(ctx, `UPDATE users SET role = 'viewer' WHERE id = 2`); err == nil {
		t.Fatal("legacy roles must be rejected by the new CHECK constraint")
	}
}
