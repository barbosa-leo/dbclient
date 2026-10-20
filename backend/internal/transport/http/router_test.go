package http_test

import (
	"bytes"
	"context"
	"encoding/json"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"dbclient/backend/internal/adapter/crypto"
	"dbclient/backend/internal/adapter/filestore"
	"dbclient/backend/internal/adapter/sqlite"
	"dbclient/backend/internal/domain"
	transporthttp "dbclient/backend/internal/transport/http"
	"dbclient/backend/internal/transport/http/handler"
	"dbclient/backend/internal/usecase/auth"
	"dbclient/backend/internal/usecase/connection"
	"dbclient/backend/internal/usecase/dump"
	"dbclient/backend/internal/usecase/environment"
	"dbclient/backend/internal/usecase/explorer"
	"dbclient/backend/internal/usecase/history"
	"dbclient/backend/internal/usecase/job"
	"dbclient/backend/internal/usecase/query"
	"dbclient/backend/internal/usecase/script"
	"dbclient/backend/internal/usecase/settings"
	"dbclient/backend/internal/usecase/user"
)

type fakeDriver struct{}

func (f *fakeDriver) Ping(ctx context.Context, creds domain.ConnectionCredentials) error {
	return nil
}

func (f *fakeDriver) ListSchemas(ctx context.Context, creds domain.ConnectionCredentials) ([]domain.SchemaInfo, error) {
	return []domain.SchemaInfo{
		{
			Name:       "public",
			Tables:     []domain.TableInfo{{Name: "customers", Kind: domain.TableKindTable}},
			Procedures: []string{},
			Functions:  []string{},
			Triggers:   []string{},
		},
	}, nil
}

func (f *fakeDriver) ListColumns(ctx context.Context, creds domain.ConnectionCredentials, schema, table string) ([]domain.ColumnInfo, error) {
	return []domain.ColumnInfo{
		{Name: "id", DataType: "bigint", Nullable: false, IsPrimaryKey: true},
	}, nil
}

func (f *fakeDriver) DescribeTable(ctx context.Context, creds domain.ConnectionCredentials, schema, table string) (domain.TableStructureInfo, error) {
	return domain.TableStructureInfo{
		Columns: []domain.ColumnInfo{
			{Name: "id", DataType: "bigint", Nullable: false, IsPrimaryKey: true},
		},
		ForeignKeys: []domain.ForeignKeyInfo{},
		Indexes:     []domain.IndexInfo{},
	}, nil
}

func (f *fakeDriver) GetObjectDefinition(ctx context.Context, creds domain.ConnectionCredentials, schema, category, name string) (string, error) {
	return "CREATE OR REPLACE VIEW \"public\".\"v_test\" AS\nSELECT 1;", nil
}

func (f *fakeDriver) DropObject(ctx context.Context, creds domain.ConnectionCredentials, schema, category, name string) error {
	return nil
}

func (f *fakeDriver) ExecuteQuery(ctx context.Context, creds domain.ConnectionCredentials, sql string, limit int, readOnly bool) (domain.QueryResult, error) {
	return domain.QueryResult{
		Columns:    []string{"id"},
		Rows:       [][]any{{1}},
		DurationMs: 2,
	}, nil
}

type fakeDumper struct{}

func (f *fakeDumper) Export(ctx context.Context, creds domain.ConnectionCredentials, dst io.Writer) error {
	_, err := dst.Write([]byte("-- dump\n"))
	return err
}

func (f *fakeDumper) Restore(ctx context.Context, creds domain.ConnectionCredentials, filePath string) error {
	return nil
}

func (f *fakeDumper) Run(ctx context.Context, creds domain.ConnectionCredentials, filePath string) error {
	return nil
}

func TestEndToEndFlow(t *testing.T) {
	ctx := context.Background()
	hasher := crypto.NewBcryptHasher()
	cipher, err := crypto.NewAESGCMCipher(bytes.Repeat([]byte{0x11}, 32))
	if err != nil {
		t.Fatal(err)
	}

	db, err := sqlite.Open(ctx, t.TempDir(), hasher)
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()

	files, err := filestore.NewLocalFileStore(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}

	userRepo := sqlite.NewUserRepository(db)
	sessionRepo := sqlite.NewSessionRepository(db)
	envRepo := sqlite.NewEnvironmentRepository(db)
	connRepo := sqlite.NewConnectionRepository(db)
	settingsRepo := sqlite.NewSettingsRepository(db)
	historyRepo := sqlite.NewExecutionHistoryRepository(db)

	drv := &fakeDriver{}
	dmp := &fakeDumper{}
	jobs := job.NewManager(files)
	logger := slog.New(slog.NewTextHandler(io.Discard, nil))

	loginUC := auth.NewLogin(userRepo, sessionRepo, hasher, 12*time.Hour)
	logoutUC := auth.NewLogout(sessionRepo)
	authSessionUC := auth.NewAuthenticateSession(sessionRepo, userRepo)
	changePassUC := auth.NewChangePassword(userRepo, hasher)

	listUsersUC := user.NewListUsers(userRepo)
	createUserUC := user.NewCreateUser(userRepo, hasher)
	updateUserUC := user.NewUpdateUser(userRepo, hasher)
	deleteUserUC := user.NewDeleteUser(userRepo, sessionRepo)

	getSettingsUC := settings.NewGetSettings(settingsRepo)
	updateSettingsUC := settings.NewUpdateSettings(settingsRepo)

	recordExecutionUC := history.NewRecordExecution(settingsRepo, historyRepo, logger)
	listHistoryUC := history.NewListHistory(historyRepo, settingsRepo)

	listEnvsUC := environment.NewListEnvironments(envRepo)
	createEnvUC := environment.NewCreateEnvironment(envRepo)
	deleteEnvUC := environment.NewDeleteEnvironment(envRepo, connRepo)

	listConnsUC := connection.NewListConnections(connRepo)
	createConnUC := connection.NewCreateConnection(connRepo, envRepo, cipher)
	updateConnUC := connection.NewUpdateConnection(connRepo, envRepo, cipher)
	deleteConnUC := connection.NewDeleteConnection(connRepo)
	resolveUC := connection.NewResolveCredentials(connRepo, cipher)
	testConnUC := connection.NewTestConnection(resolveUC, drv)

	router := transporthttp.NewRouter(transporthttp.RouterDeps{
		Logger:       logger,
		AuthSession:  authSessionUC,
		Health:       handler.NewHealthHandler(db),
		Auth:         handler.NewAuthHandler(loginUC, logoutUC, changePassUC),
		Users:        handler.NewUserHandler(listUsersUC, createUserUC, updateUserUC, deleteUserUC),
		Settings:     handler.NewSettingsHandler(getSettingsUC, updateSettingsUC),
		History:      handler.NewHistoryHandler(listHistoryUC),
		Environments: handler.NewEnvironmentHandler(listEnvsUC, createEnvUC, deleteEnvUC),
		Connections:  handler.NewConnectionHandler(listConnsUC, createConnUC, updateConnUC, deleteConnUC, testConnUC),
		Explorer: handler.NewExplorerHandler(
			explorer.NewListSchemas(resolveUC, drv),
			explorer.NewListColumns(resolveUC, drv),
			explorer.NewDescribeTable(resolveUC, drv),
			explorer.NewGetObjectDefinition(resolveUC, drv),
			explorer.NewDropObject(resolveUC, drv),
		),
		Query:  handler.NewQueryHandler(query.NewExecuteQuery(resolveUC, drv, recordExecutionUC, logger)),
		Script: handler.NewScriptHandler(script.NewRunScript(resolveUC, dmp, files, jobs, settingsRepo, recordExecutionUC, logger), getSettingsUC),
		Dump: handler.NewDumpHandler(
			dump.NewExportDump(resolveUC, dmp, files, jobs, settingsRepo, logger),
			dump.NewImportDump(resolveUC, dmp, files, jobs, settingsRepo, logger),
			jobs,
			getSettingsUC,
		),
	})

	srv := httptest.NewServer(router)
	defer srv.Close()

	res, err := http.Get(srv.URL + "/healthz")
	if err != nil || res.StatusCode != http.StatusOK {
		t.Fatalf("expected 200 on /healthz, got %v (err=%v)", res, err)
	}

	loginPayload, _ := json.Marshal(map[string]string{"email": "admin@dbclient.local", "password": "admin"})
	loginRes, err := http.Post(srv.URL+"/api/auth/login", "application/json", bytes.NewReader(loginPayload))
	if err != nil || loginRes.StatusCode != http.StatusOK {
		t.Fatalf("login failed: %v", err)
	}
	cookies := loginRes.Cookies()
	if len(cookies) == 0 {
		t.Fatal("expected session cookie")
	}
	sessionCookie := cookies[0]

	doReq := func(method, path string, body any) *http.Response {
		var reader io.Reader
		if body != nil {
			b, _ := json.Marshal(body)
			reader = bytes.NewReader(b)
		}
		req, _ := http.NewRequest(method, srv.URL+path, reader)
		req.Header.Set("Content-Type", "application/json")
		req.AddCookie(sessionCookie)
		resp, reqErr := http.DefaultClient.Do(req)
		if reqErr != nil {
			t.Fatalf("%s %s failed: %v", method, path, reqErr)
		}
		return resp
	}

	blockedRes := doReq(http.MethodGet, "/api/environments", nil)
	if blockedRes.StatusCode != http.StatusForbidden {
		t.Fatalf("expected 403 before password change, got %d", blockedRes.StatusCode)
	}

	passRes := doReq(http.MethodPost, "/api/auth/password", map[string]string{
		"currentPassword": "admin",
		"newPassword":     "newadminpass",
	})
	if passRes.StatusCode != http.StatusNoContent {
		t.Fatalf("expected 204 on password change, got %d", passRes.StatusCode)
	}

	envRes := doReq(http.MethodPost, "/api/environments", map[string]string{"name": "Production"})
	if envRes.StatusCode != http.StatusCreated {
		t.Fatalf("expected 201 creating environment, got %d", envRes.StatusCode)
	}

	connRes := doReq(http.MethodPost, "/api/connections", map[string]any{
		"environmentId": 1,
		"name":          "Main DB",
		"host":          "localhost",
		"port":          5432,
		"database":      "app",
		"username":      "postgres",
		"password":      "secret",
		"sslMode":       "prefer",
	})
	if connRes.StatusCode != http.StatusCreated {
		t.Fatalf("expected 201 creating connection, got %d", connRes.StatusCode)
	}

	conflictEnvDel := doReq(http.MethodDelete, "/api/environments/1", nil)
	if conflictEnvDel.StatusCode != http.StatusConflict {
		t.Fatalf("expected 409 deleting non-empty environment, got %d", conflictEnvDel.StatusCode)
	}

	queryRes := doReq(http.MethodPost, "/api/connections/1/query", map[string]any{
		"sql":         "SELECT 1",
		"limit":       50,
		"saveHistory": true,
	})
	if queryRes.StatusCode != http.StatusOK {
		t.Fatalf("expected 200 on query, got %d", queryRes.StatusCode)
	}

	settingsRes := doReq(http.MethodGet, "/api/settings", nil)
	if settingsRes.StatusCode != http.StatusOK {
		t.Fatalf("expected 200 on GET /api/settings, got %d", settingsRes.StatusCode)
	}
	var currentSettings domain.Settings
	if err := json.NewDecoder(settingsRes.Body).Decode(&currentSettings); err != nil {
		t.Fatalf("failed to decode settings: %v", err)
	}
	if !currentSettings.HistoryEnabled || currentSettings.HistoryRetentionDays != 7 || currentSettings.MaxFileSize != 52428800 {
		t.Fatalf("unexpected settings values: %+v", currentSettings)
	}

	updateSettingsRes := doReq(http.MethodPut, "/api/settings", domain.Settings{
		MaxFileSize:          10485760,
		HistoryEnabled:       true,
		HistoryRetentionDays: 14,
	})
	if updateSettingsRes.StatusCode != http.StatusOK {
		t.Fatalf("expected 200 on PUT /api/settings, got %d", updateSettingsRes.StatusCode)
	}

	historyRes := doReq(http.MethodGet, "/api/history?kind=query", nil)
	if historyRes.StatusCode != http.StatusOK {
		t.Fatalf("expected 200 on GET /api/history, got %d", historyRes.StatusCode)
	}
	var historyEntries []domain.ExecutionRecord
	if err := json.NewDecoder(historyRes.Body).Decode(&historyEntries); err != nil {
		t.Fatalf("failed to decode history: %v", err)
	}
	if len(historyEntries) != 1 || historyEntries[0].SQL != "SELECT 1" || !historyEntries[0].Success {
		t.Fatalf("unexpected history entries: %+v", historyEntries)
	}
}
