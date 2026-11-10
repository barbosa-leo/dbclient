package dbdriver

import (
	"context"
	"net/url"
	"os"
	"strconv"
	"strings"
	"testing"

	"dbclient/backend/internal/domain"
)

func integrationCredentials(t *testing.T) domain.ConnectionCredentials {
	t.Helper()
	raw := os.Getenv("DBCLIENT_TEST_POSTGRES_URL")
	if raw == "" {
		t.Skip("DBCLIENT_TEST_POSTGRES_URL not set")
	}
	u, err := url.Parse(raw)
	if err != nil {
		t.Fatal(err)
	}
	port, _ := strconv.Atoi(u.Port())
	password, _ := u.User.Password()
	return domain.ConnectionCredentials{
		Host:     u.Hostname(),
		Port:     port,
		Database: strings.TrimPrefix(u.Path, "/"),
		Username: u.User.Username(),
		Password: password,
		SSLMode:  domain.SSLModeDisable,
	}
}

func TestReadOnlyQueryCannotWrite(t *testing.T) {
	creds := integrationCredentials(t)
	ctx := context.Background()
	d := NewPostgresDriver()

	if _, err := d.ExecuteQuery(ctx, creds, "CREATE TABLE IF NOT EXISTS readonly_guard (id int)", 10, false); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _, _ = d.ExecuteQuery(ctx, creds, "DROP TABLE IF EXISTS readonly_guard", 10, false) })
	if _, err := d.ExecuteQuery(ctx, creds, "TRUNCATE readonly_guard; INSERT INTO readonly_guard VALUES (1), (2)", 10, false); err != nil {
		t.Fatal(err)
	}

	for _, attempt := range []string{
		"SELECT 1; COMMIT; DELETE FROM readonly_guard",
		"SELECT 1; SET TRANSACTION READ WRITE; DELETE FROM readonly_guard",
		"WITH d AS (DELETE FROM readonly_guard RETURNING *) SELECT * FROM d",
		"DO $$ BEGIN COMMIT; DELETE FROM readonly_guard; END $$",
		"DELETE FROM readonly_guard",
	} {
		if _, err := d.ExecuteQuery(ctx, creds, attempt, 10, true); err == nil {
			t.Errorf("read-only execution accepted %q", attempt)
		}
	}

	res, err := d.ExecuteQuery(ctx, creds, "SELECT count(*) FROM readonly_guard", 10, true)
	if err != nil {
		t.Fatal(err)
	}
	if len(res.Rows) != 1 || res.Rows[0][0] != int64(2) {
		t.Fatalf("rows were modified through a read-only execution: %+v", res.Rows)
	}

	for _, allowed := range []string{"EXPLAIN SELECT * FROM readonly_guard", "SHOW server_version"} {
		if _, err := d.ExecuteQuery(ctx, creds, allowed, 10, true); err != nil {
			t.Errorf("read-only execution rejected %q: %v", allowed, err)
		}
	}
}
