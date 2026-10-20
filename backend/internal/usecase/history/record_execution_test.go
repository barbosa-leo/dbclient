package history_test

import (
	"context"
	"io"
	"log/slog"
	"testing"
	"time"

	"dbclient/backend/internal/domain"
	"dbclient/backend/internal/usecase/history"
)

type fakeSettingsReader struct {
	settings domain.Settings
	err      error
}

func (f *fakeSettingsReader) Get(ctx context.Context) (domain.Settings, error) {
	return f.settings, f.err
}

type fakeHistoryRepo struct {
	records      []domain.ExecutionRecord
	purgedBefore time.Time
}

func (f *fakeHistoryRepo) Record(ctx context.Context, record domain.ExecutionRecord) error {
	f.records = append(f.records, record)
	return nil
}

func (f *fakeHistoryRepo) RecordWithPurge(ctx context.Context, record domain.ExecutionRecord, purgeBefore time.Time) error {
	f.purgedBefore = purgeBefore
	f.records = append(f.records, record)
	return nil
}

func (f *fakeHistoryRepo) DeleteOlderThan(ctx context.Context, before time.Time) error {
	f.purgedBefore = before
	return nil
}

func (f *fakeHistoryRepo) List(ctx context.Context, filter domain.ExecutionHistoryFilter) ([]domain.ExecutionRecord, error) {
	return f.records, nil
}

func TestRecordExecution_Disabled(t *testing.T) {
	settingsReader := &fakeSettingsReader{
		settings: domain.Settings{
			HistoryEnabled:       false,
			HistoryRetentionDays: 7,
		},
	}
	historyRepo := &fakeHistoryRepo{}
	logger := slog.New(slog.NewTextHandler(io.Discard, nil))

	uc := history.NewRecordExecution(settingsReader, historyRepo, logger)
	err := uc.Record(context.Background(), domain.ExecutionRecord{
		Kind: domain.ExecutionKindQuery,
		SQL:  "SELECT 1",
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(historyRepo.records) != 0 {
		t.Fatalf("expected 0 records when history disabled, got %d", len(historyRepo.records))
	}
}

func TestRecordExecution_EnabledWithPurge(t *testing.T) {
	settingsReader := &fakeSettingsReader{
		settings: domain.Settings{
			HistoryEnabled:       true,
			HistoryRetentionDays: 10,
		},
	}
	historyRepo := &fakeHistoryRepo{}
	logger := slog.New(slog.NewTextHandler(io.Discard, nil))

	uc := history.NewRecordExecution(settingsReader, historyRepo, logger)
	now := time.Now().UTC()
	err := uc.Record(context.Background(), domain.ExecutionRecord{
		Kind: domain.ExecutionKindQuery,
		SQL:  "SELECT 2",
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(historyRepo.records) != 1 {
		t.Fatalf("expected 1 record, got %d", len(historyRepo.records))
	}
	expectedPurgeBefore := now.AddDate(0, 0, -10)
	if historyRepo.purgedBefore.Before(expectedPurgeBefore.Add(-5*time.Second)) ||
		historyRepo.purgedBefore.After(expectedPurgeBefore.Add(5*time.Second)) {
		t.Fatalf("unexpected purgedBefore: %v (expected around %v)", historyRepo.purgedBefore, expectedPurgeBefore)
	}
}

