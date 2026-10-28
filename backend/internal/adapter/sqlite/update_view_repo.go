package sqlite

import (
	"context"
	"database/sql"
)

type UpdateViewRepo struct {
	db *sql.DB
}

func NewUpdateViewRepository(db *sql.DB) *UpdateViewRepo {
	return &UpdateViewRepo{db: db}
}

func (r *UpdateViewRepo) ListSeenVersions(ctx context.Context, userID int64) ([]string, error) {
	rows, err := r.db.QueryContext(ctx, `SELECT version FROM update_views WHERE user_id = ? ORDER BY seen_at, version`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	versions := []string{}
	for rows.Next() {
		var version string
		if err := rows.Scan(&version); err != nil {
			return nil, err
		}
		versions = append(versions, version)
	}
	return versions, rows.Err()
}

func (r *UpdateViewRepo) MarkSeen(ctx context.Context, userID int64, versions []string) error {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback() }()

	stmt, err := tx.PrepareContext(ctx, `INSERT OR IGNORE INTO update_views (user_id, version) VALUES (?, ?)`)
	if err != nil {
		return err
	}
	defer stmt.Close()

	for _, version := range versions {
		if _, err := stmt.ExecContext(ctx, userID, version); err != nil {
			return err
		}
	}
	return tx.Commit()
}
