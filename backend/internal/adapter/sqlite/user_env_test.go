package sqlite_test

import (
	"bytes"
	"context"
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
		Name:           "Operador 1",
		Email:          "op1@dbclient.local",
		PasswordHash:   "hash",
		Role:           domain.RoleOperator,
		EnvironmentIDs: []int64{env1.ID},
	})
	if err != nil {
		t.Fatal(err)
	}

	if len(operatorUser.EnvironmentIDs) != 1 || operatorUser.EnvironmentIDs[0] != env1.ID {
		t.Fatalf("expected env1 in created user, got %v", operatorUser.EnvironmentIDs)
	}

	fetchedUser, err := userRepo.FindByID(ctx, operatorUser.ID)
	if err != nil {
		t.Fatal(err)
	}
	if len(fetchedUser.EnvironmentIDs) != 1 || fetchedUser.EnvironmentIDs[0] != env1.ID {
		t.Fatalf("expected env1 in FindByID, got %v", fetchedUser.EnvironmentIDs)
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
	if foundOp == nil || len(foundOp.EnvironmentIDs) != 1 || foundOp.EnvironmentIDs[0] != env1.ID {
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

	hasAccess1, err := connRepo.HasUserAccess(ctx, operatorUser.ID, conn1.ID)
	if err != nil || !hasAccess1 {
		t.Fatalf("expected access to conn1, got %v, err=%v", hasAccess1, err)
	}

	hasAccess2, err := connRepo.HasUserAccess(ctx, operatorUser.ID, conn2.ID)
	if err != nil || hasAccess2 {
		t.Fatalf("expected NO access to conn2, got %v, err=%v", hasAccess2, err)
	}

	fetchedUser.EnvironmentIDs = []int64{env1.ID, env2.ID}
	updatedUser, err := userRepo.Update(ctx, fetchedUser)
	if err != nil {
		t.Fatal(err)
	}
	if len(updatedUser.EnvironmentIDs) != 2 {
		t.Fatalf("expected 2 envs after update, got %v", updatedUser.EnvironmentIDs)
	}

	hasAccess2After, err := connRepo.HasUserAccess(ctx, operatorUser.ID, conn2.ID)
	if err != nil || !hasAccess2After {
		t.Fatalf("expected access to conn2 after update, got %v", hasAccess2After)
	}
}
