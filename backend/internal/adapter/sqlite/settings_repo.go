package sqlite

import (
	"context"
	"database/sql"
	"strconv"

	"dbclient/backend/internal/domain"
)

const (
	settingMaxFileSize          = "max_file_size"
	settingHistoryEnabled       = "history_enabled"
	settingHistoryRetentionDays = "history_retention_days"

	defaultMaxFileSize          int64 = 52428800
	defaultHistoryEnabled             = true
	defaultHistoryRetentionDays       = 7
)

type SettingsRepo struct {
	db *sql.DB
}

func NewSettingsRepository(db *sql.DB) *SettingsRepo {
	return &SettingsRepo{db: db}
}

func (r *SettingsRepo) Get(ctx context.Context) (domain.Settings, error) {
	rows, err := r.db.QueryContext(ctx, `SELECT key, value FROM settings`)
	if err != nil {
		return domain.Settings{}, err
	}
	defer rows.Close()

	settings := domain.Settings{
		MaxFileSize:          defaultMaxFileSize,
		HistoryEnabled:       defaultHistoryEnabled,
		HistoryRetentionDays: defaultHistoryRetentionDays,
	}

	for rows.Next() {
		var key, val string
		if err := rows.Scan(&key, &val); err != nil {
			return domain.Settings{}, err
		}
		switch key {
		case settingMaxFileSize:
			if n, err := strconv.ParseInt(val, 10, 64); err == nil && n > 0 {
				settings.MaxFileSize = n
			}
		case settingHistoryEnabled:
			if b, err := strconv.ParseBool(val); err == nil {
				settings.HistoryEnabled = b
			}
		case settingHistoryRetentionDays:
			if n, err := strconv.Atoi(val); err == nil && n > 0 {
				settings.HistoryRetentionDays = n
			}
		}
	}

	return settings, rows.Err()
}

func (r *SettingsRepo) Update(ctx context.Context, settings domain.Settings) error {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback() }()

	stmt, err := tx.PrepareContext(ctx, `INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value`)
	if err != nil {
		return err
	}
	defer stmt.Close()

	entries := [][2]string{
		{settingMaxFileSize, strconv.FormatInt(settings.MaxFileSize, 10)},
		{settingHistoryEnabled, strconv.FormatBool(settings.HistoryEnabled)},
		{settingHistoryRetentionDays, strconv.Itoa(settings.HistoryRetentionDays)},
	}

	for _, entry := range entries {
		if _, err := stmt.ExecContext(ctx, entry[0], entry[1]); err != nil {
			return err
		}
	}

	return tx.Commit()
}
