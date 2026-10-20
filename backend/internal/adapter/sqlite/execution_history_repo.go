package sqlite

import (
	"context"
	"database/sql"
	"time"

	"dbclient/backend/internal/domain"
)

const (
	maxHistoryPerUserAndKind = 200
	sqliteDateTimeLayout     = "2006-01-02 15:04:05"
)

type ExecutionHistoryRepo struct {
	db *sql.DB
}

func NewExecutionHistoryRepository(db *sql.DB) *ExecutionHistoryRepo {
	return &ExecutionHistoryRepo{db: db}
}

func (r *ExecutionHistoryRepo) DeleteOlderThan(ctx context.Context, before time.Time) error {
	_, err := r.db.ExecContext(
		ctx,
		`DELETE FROM execution_history WHERE created_at < ?`,
		before.UTC().Format(sqliteDateTimeLayout),
	)
	return err
}

func (r *ExecutionHistoryRepo) Record(ctx context.Context, record domain.ExecutionRecord) error {
	return r.RecordWithPurge(ctx, record, time.Time{})
}

func (r *ExecutionHistoryRepo) RecordWithPurge(ctx context.Context, record domain.ExecutionRecord, purgeBefore time.Time) error {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback() }()

	if !purgeBefore.IsZero() {
		_, err = tx.ExecContext(
			ctx,
			`DELETE FROM execution_history WHERE created_at < ?`,
			purgeBefore.UTC().Format(sqliteDateTimeLayout),
		)
		if err != nil {
			return err
		}
	}

	createdAt := record.CreatedAt
	if createdAt.IsZero() {
		createdAt = time.Now().UTC()
	}

	_, err = tx.ExecContext(
		ctx,
		`INSERT INTO execution_history
			(user_id, kind, connection_id, connection_name, database, sql_text, file_name, file_size, success, error, duration_ms, created_at)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		record.UserID,
		string(record.Kind),
		record.ConnectionID,
		record.ConnectionName,
		record.Database,
		record.SQL,
		record.FileName,
		record.FileSize,
		record.Success,
		record.Error,
		record.DurationMs,
		createdAt.Format(sqliteDateTimeLayout),
	)
	if err != nil {
		return err
	}

	_, err = tx.ExecContext(
		ctx,
		`DELETE FROM execution_history
		 WHERE user_id = ? AND kind = ?
		   AND id NOT IN (
			   SELECT id FROM execution_history WHERE user_id = ? AND kind = ? ORDER BY id DESC LIMIT ?
		   )`,
		record.UserID, string(record.Kind), record.UserID, string(record.Kind), maxHistoryPerUserAndKind,
	)
	if err != nil {
		return err
	}
	return tx.Commit()
}

func (r *ExecutionHistoryRepo) List(ctx context.Context, filter domain.ExecutionHistoryFilter) ([]domain.ExecutionRecord, error) {
	query := `SELECT h.id, h.user_id, u.email, h.kind, h.connection_id, h.connection_name, h.database,
			h.sql_text, h.file_name, h.file_size, h.success, h.error, h.duration_ms, h.created_at
		FROM execution_history h
		JOIN users u ON u.id = h.user_id
		WHERE h.kind = ?`
	args := []any{string(filter.Kind)}

	if filter.UserID != nil {
		query += ` AND h.user_id = ?`
		args = append(args, *filter.UserID)
	}
	if filter.Since != nil {
		query += ` AND h.created_at >= ?`
		args = append(args, filter.Since.UTC().Format(sqliteDateTimeLayout))
	}
	query += ` ORDER BY h.id DESC LIMIT ?`
	args = append(args, filter.Limit)

	rows, err := r.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	records := make([]domain.ExecutionRecord, 0)
	for rows.Next() {
		var rec domain.ExecutionRecord
		var kind string
		if err := rows.Scan(
			&rec.ID, &rec.UserID, &rec.UserEmail, &kind, &rec.ConnectionID, &rec.ConnectionName, &rec.Database,
			&rec.SQL, &rec.FileName, &rec.FileSize, &rec.Success, &rec.Error, &rec.DurationMs, &rec.CreatedAt,
		); err != nil {
			return nil, err
		}
		rec.Kind = domain.ExecutionKind(kind)
		records = append(records, rec)
	}
	return records, rows.Err()
}
