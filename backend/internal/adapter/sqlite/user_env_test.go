package sqlite_test

import (
	"bytes"
	"context"
	"errors"
	"testing"

	"dbclient/backend/internal/adapter/crypto"
	"dbclient/backend/internal/adapter/sqlite"
	"dbclient/backend/internal/domain"
)

func TestUserEnvironments(t *testing.T) {
	ctx := context.Background()
	hasher := crypto.NewBcryptHasher()
	cipher, err := crypto.NewAESGCMCipher(bytes.Repeat([]byte{0x22}, 32))
	if err != nil {
		t.Fatal(err)
	}

	db, err := sqlite.Open(ctx, t.TempDir(), hasher)
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()

	userRepo := sqlite.NewUserRepository(db)
	envRepo := sqlite.NewEnvironmentRepository(db)
	connRepo := sqlite.NewConnectionRepository(db)

	env1, err := envRepo.Create(ctx, "Produção")
	if err != nil {
		t.Fatal(err)
	}
	env2, err := envRepo.Create(ctx, "Staging")
	if err != nil {
		t.Fatal(err)
	}

	encPass, _ := cipher.Encrypt("pass")
	conn1, err := connRepo.Create(ctx, domain.Connection{
		EnvironmentID:     env1.ID,
		Name:              "Prod DB",
		Host:              "localhost",
		Port:              5432,
		Database:          "prod",
		Username:          "postgres",
		EncryptedPassword: encPass,
		SSLMode:           domain.SSLModeDisable,
	})
	if err != nil {
		t.Fatal(err)
	}

	conn2, err := connRepo.Create(ctx, domain.Connection{
		EnvironmentID:     env2.ID,
		Name:              "Staging DB",
		Host:              "localhost",
		Port:              5432,
		Database:          "staging",
		Username:          "postgres",
		EncryptedPassword: encPass,
		SSLMode:           domain.SSLModeDisable,
	})
	if err != nil {
		t.Fatal(err)
	}

	operatorUser, err := userRepo.Create(ctx, domain.User{
		Name:         "Operador 1",
		Email:        "op1@dbclient.local",
		PasswordHash: "hash",
		Role:         domain.RoleMember,
		Environments: []domain.EnvironmentAccess{{EnvironmentID: env1.ID, Level: domain.AccessRead}},
	})
	if err != nil {
		t.Fatal(err)
	}

	if len(operatorUser.Environments) != 1 || operatorUser.Environments[0].EnvironmentID != env1.ID {
		t.Fatalf("expected env1 in created user, got %v", operatorUser.Environments)
	}

	fetchedUser, err := userRepo.FindByID(ctx, operatorUser.ID)
	if err != nil {
		t.Fatal(err)
	}
	if len(fetchedUser.Environments) != 1 || fetchedUser.Environments[0] != (domain.EnvironmentAccess{EnvironmentID: env1.ID, Level: domain.AccessRead}) {
		t.Fatalf("expected env1 read in FindByID, got %v", fetchedUser.Environments)
	}

	allUsers, err := userRepo.List(ctx)
	if err != nil {
		t.Fatal(err)
	}
	var foundOp *domain.User
	for i := range allUsers {
		if allUsers[i].ID == operatorUser.ID {
			foundOp = &allUsers[i]
			break
		}
	}
	if foundOp == nil || len(foundOp.Environments) != 1 || foundOp.Environments[0].EnvironmentID != env1.ID {
		t.Fatalf("expected env1 in List, got %+v", foundOp)
	}

	envs, err := envRepo.ListByUser(ctx, operatorUser.ID)
	if err != nil {
		t.Fatal(err)
	}
	if len(envs) != 1 || envs[0].ID != env1.ID {
		t.Fatalf("expected only env1 in ListByUser, got %+v", envs)
	}

	conns, err := connRepo.ListByUser(ctx, operatorUser.ID, nil)
	if err != nil {
		t.Fatal(err)
	}
	if len(conns) != 1 || conns[0].ID != conn1.ID {
		t.Fatalf("expected only conn1 in ListByUser, got %+v", conns)
	}

	level1, err := connRepo.UserAccessLevel(ctx, operatorUser.ID, conn1.ID)
	if err != nil || level1 != domain.AccessRead {
		t.Fatalf("expected read access to conn1, got %q, err=%v", level1, err)
	}

	if _, err := connRepo.UserAccessLevel(ctx, operatorUser.ID, conn2.ID); !errors.Is(err, domain.ErrNotFound) {
		t.Fatalf("expected NO access to conn2, got err=%v", err)
	}

	fetchedUser.Environments = []domain.EnvironmentAccess{
		{EnvironmentID: env1.ID, Level: domain.AccessWrite},
		{EnvironmentID: env2.ID, Level: domain.AccessRead},
	}
	updatedUser, err := userRepo.Update(ctx, fetchedUser)
	if err != nil {
		t.Fatal(err)
	}
	if len(updatedUser.Environments) != 2 {
		t.Fatalf("expected 2 envs after update, got %v", updatedUser.Environments)
	}

	level1After, err := connRepo.UserAccessLevel(ctx, operatorUser.ID, conn1.ID)
	if err != nil || level1After != domain.AccessWrite {
		t.Fatalf("expected write access to conn1 after update, got %q, err=%v", level1After, err)
	}
	level2After, err := connRepo.UserAccessLevel(ctx, operatorUser.ID, conn2.ID)
	if err != nil || level2After != domain.AccessRead {
		t.Fatalf("expected read access to conn2 after update, got %q, err=%v", level2After, err)
	}
}
