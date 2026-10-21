package sqlite_test

import (
	"context"
	"testing"
	"time"

	"dbclient/backend/internal/adapter/crypto"
	"dbclient/backend/internal/adapter/sqlite"
	"dbclient/backend/internal/domain"
)

func TestExecutionHistoryRepo_RecordAndDeleteOlderThan(t *testing.T) {
	ctx := context.Background()
	hasher := crypto.NewBcryptHasher()

	db, err := sqlite.Open(ctx, t.TempDir(), hasher)
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()

	userRepo := sqlite.NewUserRepository(db)
	user, err := userRepo.FindByEmail(ctx, "admin@dbclient.local")
	if err != nil {
		t.Fatal(err)
	}

	repo := sqlite.NewExecutionHistoryRepository(db)

	oldTime := time.Now().UTC().AddDate(0, 0, -10)
	err = repo.Record(ctx, domain.ExecutionRecord{
		UserID:    user.ID,
		Kind:      domain.ExecutionKindQuery,
		SQL:       "SELECT 'old'",
		CreatedAt: oldTime,
	})
	if err != nil {
		t.Fatalf("failed to record old execution: %v", err)
	}

	newTime := time.Now().UTC()
	err = repo.Record(ctx, domain.ExecutionRecord{
		UserID:    user.ID,
		Kind:      domain.ExecutionKindQuery,
		SQL:       "SELECT 'new'",
		CreatedAt: newTime,
	})
	if err != nil {
		t.Fatalf("failed to record new execution: %v", err)
	}

	list, err := repo.List(ctx, domain.ExecutionHistoryFilter{
		Kind:   domain.ExecutionKindQuery,
		UserID: &user.ID,
		Limit:  50,
	})
	if err != nil {
		t.Fatal(err)
	}
	if len(list) != 2 {
		t.Fatalf("expected 2 records, got %d", len(list))
	}

	cutoff := time.Now().UTC().AddDate(0, 0, -7)
	if err := repo.DeleteOlderThan(ctx, cutoff); err != nil {
		t.Fatalf("failed to purge old records: %v", err)
	}

	listAfter, err := repo.List(ctx, domain.ExecutionHistoryFilter{
		Kind:   domain.ExecutionKindQuery,
		UserID: &user.ID,
		Limit:  50,
	})
	if err != nil {
		t.Fatal(err)
	}
	if len(listAfter) != 1 {
		t.Fatalf("expected 1 record after purge, got %d", len(listAfter))
	}
	if listAfter[0].SQL != "SELECT 'old'" && listAfter[0].SQL != "SELECT 'new'" {
		t.Fatalf("unexpected record: %s", listAfter[0].SQL)
	}
	if listAfter[0].SQL != "SELECT 'new'" {
		t.Fatalf("expected 'SELECT new' to remain, got %s", listAfter[0].SQL)
	}
}
