package sqlite

import (
	"context"
	"database/sql"
	"errors"
	"time"

	"dbclient/backend/internal/domain"
)

type SessionRepo struct {
	db *sql.DB
}

func NewSessionRepository(db *sql.DB) *SessionRepo {
	return &SessionRepo{db: db}
}

func (r *SessionRepo) Create(ctx context.Context, session domain.Session) error {
	_, err := r.db.ExecContext(
		ctx,
		`INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)`,
		session.Token,
		session.UserID,
		session.ExpiresAt.UTC().Format(time.RFC3339Nano),
	)
	return err
}

func (r *SessionRepo) FindByToken(ctx context.Context, token string) (domain.Session, error) {
	var s domain.Session
	var rawExpires string
	err := r.db.QueryRowContext(
		ctx,
		`SELECT token, user_id, expires_at FROM sessions WHERE token = ?`,
		token,
	).Scan(&s.Token, &s.UserID, &rawExpires)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return domain.Session{}, domain.ErrUnauthorized
		}
		return domain.Session{}, err
	}

	expiresAt, err := time.Parse(time.RFC3339Nano, rawExpires)
	if err != nil {
		return domain.Session{}, err
	}
	s.ExpiresAt = expiresAt
	return s, nil
}

func (r *SessionRepo) DeleteByToken(ctx context.Context, token string) error {
	_, err := r.db.ExecContext(ctx, `DELETE FROM sessions WHERE token = ?`, token)
	return err
}

func (r *SessionRepo) DeleteByUserID(ctx context.Context, userID int64) error {
	_, err := r.db.ExecContext(ctx, `DELETE FROM sessions WHERE user_id = ?`, userID)
	return err
}

func (r *SessionRepo) DeleteExpired(ctx context.Context, now time.Time) error {
	_, err := r.db.ExecContext(
		ctx,
		`DELETE FROM sessions WHERE expires_at <= ?`,
		now.UTC().Format(time.RFC3339Nano),
	)
	return err
}
