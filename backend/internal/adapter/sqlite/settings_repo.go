package sqlite

import (
	"context"
	"database/sql"
	"errors"
	"strconv"

	"dbclient/backend/internal/domain"
)

const settingMaxFileSize = "max_file_size"

type SettingsRepo struct {
	db *sql.DB
}

func NewSettingsRepository(db *sql.DB) *SettingsRepo {
	return &SettingsRepo{db: db}
}

func (r *SettingsRepo) Get(ctx context.Context) (domain.Settings, error) {
	var raw string
	err := r.db.QueryRowContext(ctx, `SELECT value FROM settings WHERE key = ?`, settingMaxFileSize).Scan(&raw)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return domain.Settings{}, domain.ErrNotFound
		}
		return domain.Settings{}, err
	}

	maxFileSize, err := strconv.ParseInt(raw, 10, 64)
	if err != nil {
		return domain.Settings{}, err
	}
	return domain.Settings{MaxFileSize: maxFileSize}, nil
}

func (r *SettingsRepo) Update(ctx context.Context, settings domain.Settings) error {
	_, err := r.db.ExecContext(
		ctx,
		`INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
		settingMaxFileSize,
		strconv.FormatInt(settings.MaxFileSize, 10),
	)
	return err
}

