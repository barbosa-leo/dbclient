package http_test

import (
	"bytes"
	"encoding/json"
	"io"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"testing"

	"dbclient/backend/internal/domain"
)

type apiClient struct {
	t      *testing.T
	base   string
	cookie *http.Cookie
}

func (c *apiClient) do(method, path string, body any) *http.Response {
	c.t.Helper()
	var reader io.Reader
	if body != nil {
		b, _ := json.Marshal(body)
		reader = bytes.NewReader(b)
	}
	req, _ := http.NewRequest(method, c.base+path, reader)
	req.Header.Set("Content-Type", "application/json")
	if c.cookie != nil {
		req.AddCookie(c.cookie)
	}
	res, err := http.DefaultClient.Do(req)
	if err != nil {
		c.t.Fatalf("%s %s failed: %v", method, path, err)
	}
	c.t.Cleanup(func() { _ = res.Body.Close() })
	return res
}

func (c *apiClient) upload(path string) *http.Response {
	c.t.Helper()
	var buf bytes.Buffer
	mw := multipart.NewWriter(&buf)
	part, _ := mw.CreateFormFile("file", "script.sql")
	_, _ = part.Write([]byte("SELECT 1;"))
	_ = mw.Close()

	req, _ := http.NewRequest(http.MethodPost, c.base+path, &buf)
	req.Header.Set("Content-Type", mw.FormDataContentType())
	req.AddCookie(c.cookie)
	res, err := http.DefaultClient.Do(req)
	if err != nil {
		c.t.Fatalf("POST %s failed: %v", path, err)
	}
	c.t.Cleanup(func() { _ = res.Body.Close() })
	return res
}

func login(t *testing.T, base, email, password, newPassword string) *apiClient {
	t.Helper()
	anon := &apiClient{t: t, base: base}
	res := anon.do(http.MethodPost, "/api/auth/login", map[string]string{"email": email, "password": password})
	if res.StatusCode != http.StatusOK || len(res.Cookies()) == 0 {
		t.Fatalf("login %s failed with %d", email, res.StatusCode)
	}
	client := &apiClient{t: t, base: base, cookie: res.Cookies()[0]}
	change := client.do(http.MethodPost, "/api/auth/password", map[string]string{
		"currentPassword": password,
		"newPassword":     newPassword,
	})
	if change.StatusCode != http.StatusNoContent {
		t.Fatalf("password change for %s failed with %d", email, change.StatusCode)
	}
	return client
}

func expectStatus(t *testing.T, res *http.Response, want int, label string) {
	t.Helper()
	if res.StatusCode != want {
		body, _ := io.ReadAll(res.Body)
		t.Fatalf("%s: expected %d, got %d (%s)", label, want, res.StatusCode, body)
	}
}

func TestEnvironmentAccessLevels(t *testing.T) {
	drv := &fakeDriver{}
	srv := httptest.NewServer(newTestRouter(t, drv))
	defer srv.Close()

	admin := login(t, srv.URL, "admin@dbclient.local", "admin", "newadminpass")

	for _, name := range []string{"Produção", "Dev", "Restrito"} {
		expectStatus(t, admin.do(http.MethodPost, "/api/environments", map[string]string{"name": name}), http.StatusCreated, "create env "+name)
	}
	connection := func(envID int, name string, extra map[string]any) {
		payload := map[string]any{
			"environmentId": envID, "name": name, "host": "localhost", "port": 5432,
			"database": "app", "username": "owner", "password": "secret", "sslMode": "prefer",
		}
		for k, v := range extra {
			payload[k] = v
		}
		expectStatus(t, admin.do(http.MethodPost, "/api/connections", payload), http.StatusCreated, "create conn "+name)
	}
	connection(1, "prod", map[string]any{"readOnlyUsername": "reader", "readOnlyPassword": "readerpass"})
	connection(2, "dev", nil)
	connection(3, "restricted", nil)

	expectStatus(t, admin.do(http.MethodPost, "/api/users", map[string]any{
		"name": "Ana", "email": "ana@dbclient.local", "password": "initialpass", "role": "member",
		"environments": []map[string]any{
			{"environmentId": 1, "level": "read"},
			{"environmentId": 2, "level": "write"},
		},
	}), http.StatusCreated, "create member")

	expectStatus(t, admin.do(http.MethodPost, "/api/users", map[string]any{
		"name": "Bia", "email": "bia@dbclient.local", "password": "initialpass", "role": "member",
		"environments": []map[string]any{{"environmentId": 1, "level": "admin"}},
	}), http.StatusBadRequest, "invalid access level")

	member := login(t, srv.URL, "ana@dbclient.local", "initialpass", "anapassword")

	var me domain.User
	if err := json.NewDecoder(member.do(http.MethodGet, "/api/auth/me", nil).Body).Decode(&me); err != nil {
		t.Fatal(err)
	}
	if me.Role != domain.RoleMember || len(me.Environments) != 2 ||
		me.Environments[0] != (domain.EnvironmentAccess{EnvironmentID: 1, Level: domain.AccessRead}) ||
		me.Environments[1] != (domain.EnvironmentAccess{EnvironmentID: 2, Level: domain.AccessWrite}) {
		t.Fatalf("unexpected /api/auth/me: %+v", me)
	}

	var conns []domain.Connection
	if err := json.NewDecoder(member.do(http.MethodGet, "/api/connections", nil).Body).Decode(&conns); err != nil {
		t.Fatal(err)
	}
	if len(conns) != 2 {
		t.Fatalf("expected the 2 granted connections, got %+v", conns)
	}

	query := map[string]any{"sql": "SELECT 1", "limit": 10}
	drop := "/schemas/public/objects/views/v_test"

	expectStatus(t, member.do(http.MethodPost, "/api/connections/1/query", query), http.StatusOK, "read env query")
	expectStatus(t, member.do(http.MethodGet, "/api/connections/1/schemas", nil), http.StatusOK, "read env explorer")
	expectStatus(t, member.do(http.MethodPost, "/api/connections/1/dumps/export", nil), http.StatusAccepted, "read env export")
	expectStatus(t, member.do(http.MethodDelete, "/api/connections/1"+drop, nil), http.StatusForbidden, "read env drop")
	expectStatus(t, member.upload("/api/connections/1/scripts"), http.StatusForbidden, "read env script")
	expectStatus(t, member.upload("/api/connections/1/dumps/import"), http.StatusForbidden, "read env import")

	expectStatus(t, member.do(http.MethodPost, "/api/connections/2/query", query), http.StatusOK, "write env query")
	expectStatus(t, member.do(http.MethodDelete, "/api/connections/2"+drop, nil), http.StatusNoContent, "write env drop")
	expectStatus(t, member.upload("/api/connections/2/scripts"), http.StatusAccepted, "write env script")

	expectStatus(t, member.do(http.MethodPost, "/api/connections/3/query", query), http.StatusForbidden, "no access query")
	expectStatus(t, member.do(http.MethodGet, "/api/connections/3/schemas", nil), http.StatusForbidden, "no access explorer")
	expectStatus(t, member.do(http.MethodPost, "/api/connections/3/dumps/export", nil), http.StatusForbidden, "no access export")
	expectStatus(t, member.do(http.MethodPost, "/api/connections/999/query", query), http.StatusForbidden, "unknown connection")

	expectStatus(t, member.do(http.MethodPost, "/api/environments", map[string]string{"name": "X"}), http.StatusForbidden, "member admin route")

	want := []queryCall{
		{Username: "reader", ReadOnly: true},
		{Username: "owner", ReadOnly: false},
	}
	if len(drv.queries) != len(want) || drv.queries[0] != want[0] || drv.queries[1] != want[1] {
		t.Fatalf("unexpected driver calls: %+v", drv.queries)
	}

	expectStatus(t, admin.do(http.MethodPost, "/api/connections/1/query", query), http.StatusOK, "admin query")
	if last := drv.queries[len(drv.queries)-1]; last != (queryCall{Username: "owner", ReadOnly: false}) {
		t.Fatalf("admin should use the primary credentials with writes, got %+v", last)
	}
}
