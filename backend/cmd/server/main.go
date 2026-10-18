package main

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"dbclient/backend/internal/adapter/crypto"
	"dbclient/backend/internal/adapter/dbdriver"
	"dbclient/backend/internal/adapter/dumper"
	"dbclient/backend/internal/adapter/filestore"
	"dbclient/backend/internal/adapter/sqlite"
	"dbclient/backend/internal/config"
	transporthttp "dbclient/backend/internal/transport/http"
	"dbclient/backend/internal/transport/http/handler"
	"dbclient/backend/internal/usecase/auth"
	"dbclient/backend/internal/usecase/connection"
	"dbclient/backend/internal/usecase/dump"
	"dbclient/backend/internal/usecase/environment"
	"dbclient/backend/internal/usecase/explorer"
	"dbclient/backend/internal/usecase/job"
	"dbclient/backend/internal/usecase/query"
	"dbclient/backend/internal/usecase/script"
	"dbclient/backend/internal/usecase/user"
	"dbclient/backend/web"
)

func main() {
	logger := slog.New(slog.NewJSONHandler(os.Stdout, nil))
	slog.SetDefault(logger)

	cfg, err := config.Load()
	if err != nil {
		logger.Error("failed to load configuration", slog.String("error", err.Error()))
		os.Exit(1)
	}

	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer stop()

	hasher := crypto.NewBcryptHasher()
	cipher, err := crypto.NewAESGCMCipher(cfg.EncryptionKey)
	if err != nil {
		logger.Error("failed to initialize cipher", slog.String("error", err.Error()))
		os.Exit(1)
	}

	db, err := sqlite.Open(ctx, cfg.DataDir, hasher)
	if err != nil {
		logger.Error("failed to open sqlite", slog.String("error", err.Error()))
		os.Exit(1)
	}
	defer db.Close()

	files, err := filestore.NewLocalFileStore(cfg.DumpDir)
	if err != nil {
		logger.Error("failed to initialize file store", slog.String("error", err.Error()))
		os.Exit(1)
	}

	userRepo := sqlite.NewUserRepository(db)
	sessionRepo := sqlite.NewSessionRepository(db)
	environmentRepo := sqlite.NewEnvironmentRepository(db)
	connectionRepo := sqlite.NewConnectionRepository(db)

	pgDriver := dbdriver.NewPostgresDriver()
	pgDumper := dumper.NewPostgresDumper()
	jobManager := job.NewManager(files)

	loginUC := auth.NewLogin(userRepo, sessionRepo, hasher, cfg.SessionTTL)
	logoutUC := auth.NewLogout(sessionRepo)
	authSessionUC := auth.NewAuthenticateSession(sessionRepo, userRepo)
	changePasswordUC := auth.NewChangePassword(userRepo, hasher)

	listUsersUC := user.NewListUsers(userRepo)
	createUserUC := user.NewCreateUser(userRepo, hasher)
	updateUserUC := user.NewUpdateUser(userRepo, hasher)
	deleteUserUC := user.NewDeleteUser(userRepo, sessionRepo)

	listEnvironmentsUC := environment.NewListEnvironments(environmentRepo)
	createEnvironmentUC := environment.NewCreateEnvironment(environmentRepo)
	deleteEnvironmentUC := environment.NewDeleteEnvironment(environmentRepo, connectionRepo)

	listConnectionsUC := connection.NewListConnections(connectionRepo)
	createConnectionUC := connection.NewCreateConnection(connectionRepo, environmentRepo, cipher)
	updateConnectionUC := connection.NewUpdateConnection(connectionRepo, environmentRepo, cipher)
	deleteConnectionUC := connection.NewDeleteConnection(connectionRepo)
	resolveCredsUC := connection.NewResolveCredentials(connectionRepo, cipher)

	listSchemasUC := explorer.NewListSchemas(resolveCredsUC, pgDriver)
	listColumnsUC := explorer.NewListColumns(resolveCredsUC, pgDriver)
	getObjectDefUC := explorer.NewGetObjectDefinition(resolveCredsUC, pgDriver)
	dropObjectUC := explorer.NewDropObject(resolveCredsUC, pgDriver)

	executeQueryUC := query.NewExecuteQuery(resolveCredsUC, pgDriver, logger)
	runScriptUC := script.NewRunScript(resolveCredsUC, pgDumper, files, jobManager, cfg.MaxFileSize, logger)
	exportDumpUC := dump.NewExportDump(resolveCredsUC, pgDumper, files, jobManager, cfg.MaxFileSize, logger)
	importDumpUC := dump.NewImportDump(resolveCredsUC, pgDumper, files, jobManager, cfg.MaxFileSize, logger)

	frontendFS, _ := web.DistFS()

	router := transporthttp.NewRouter(transporthttp.RouterDeps{
		Logger:        logger,
		AuthSession:   authSessionUC,
		Health:        handler.NewHealthHandler(db),
		Auth:          handler.NewAuthHandler(loginUC, logoutUC, changePasswordUC),
		Users:         handler.NewUserHandler(listUsersUC, createUserUC, updateUserUC, deleteUserUC),
		Environments:  handler.NewEnvironmentHandler(listEnvironmentsUC, createEnvironmentUC, deleteEnvironmentUC),
		Connections:   handler.NewConnectionHandler(listConnectionsUC, createConnectionUC, updateConnectionUC, deleteConnectionUC),
		Explorer:      handler.NewExplorerHandler(listSchemasUC, listColumnsUC, getObjectDefUC, dropObjectUC),
		Query:         handler.NewQueryHandler(executeQueryUC),
		Script:        handler.NewScriptHandler(runScriptUC, cfg.MaxFileSize),
		Dump:          handler.NewDumpHandler(exportDumpUC, importDumpUC, jobManager, cfg.MaxFileSize),
		FrontendFiles: frontendFS,
	})

	go startCleanupLoop(ctx, files, sessionRepo, cfg.DumpTTL)

	server := &http.Server{
		Addr:              cfg.Addr,
		Handler:           router,
		ReadHeaderTimeout: 10 * time.Second,
	}

	go func() {
		logger.Info("starting server", slog.String("addr", cfg.Addr))
		if err := server.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			logger.Error("server failed", slog.String("error", err.Error()))
			os.Exit(1)
		}
	}()

	<-ctx.Done()
	logger.Info("shutting down server")

	shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	_ = server.Shutdown(shutdownCtx)
}

func startCleanupLoop(
	ctx context.Context,
	files *filestore.LocalFileStore,
	sessions *sqlite.SessionRepo,
	ttl time.Duration,
) {
	ticker := time.NewTicker(15 * time.Minute)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case now := <-ticker.C:
			_ = files.CleanupExpired(ttl)
			_ = sessions.DeleteExpired(ctx, now)
		}
	}
}
