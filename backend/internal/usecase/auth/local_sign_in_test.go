//go:build desktop

package auth_test

import (
	"context"
	"errors"
	"strings"
	"testing"
	"time"

	"dbclient/backend/internal/domain"
	"dbclient/backend/internal/usecase/auth"
)

const localToken = "0123456789abcdef0123456789abcdef"

type fakeUserRepo struct {
	domain.UserRepository
	users   []domain.User
	updated []domain.User
}

func (f *fakeUserRepo) List(ctx context.Context) ([]domain.User, error) {
	return f.users, nil
}

func (f *fakeUserRepo) Update(ctx context.Context, user domain.User) (domain.User, error) {
	f.updated = append(f.updated, user)
	return user, nil
}

type fakeSessionRepo struct {
	domain.SessionRepository
	created []domain.Session
}

func (f *fakeSessionRepo) Create(ctx context.Context, session domain.Session) error {
	f.created = append(f.created, session)
	return nil
}

func (f *fakeSessionRepo) DeleteExpired(ctx context.Context, now time.Time) error {
	return nil
}

type fakeHasher struct{}

func (fakeHasher) Hash(password string) (string, error) {
	return "hashed:" + password, nil
}

func (fakeHasher) Compare(hash, password string) error {
	if hash != "hashed:"+password {
		return errors.New("mismatch")
	}
	return nil
}

func TestLocalSignIn_RejectsInvalidToken(t *testing.T) {
	users := &fakeUserRepo{users: []domain.User{{ID: 1, Role: domain.RoleAdmin}}}
	sessions := &fakeSessionRepo{}
	uc := auth.NewLocalSignIn(users, sessions, fakeHasher{}, localToken, time.Hour)

	for _, token := range []string{"", "wrong", localToken + "x", strings.ToUpper(localToken)} {
		if _, err := uc.Execute(context.Background(), token); !errors.Is(err, domain.ErrUnauthorized) {
			t.Fatalf("token %q: expected ErrUnauthorized, got %v", token, err)
		}
	}
	if len(sessions.created) != 0 {
		t.Fatalf("expected no sessions, got %d", len(sessions.created))
	}
}

func TestLocalSignIn_CreatesSessionForOldestAdmin(t *testing.T) {
	users := &fakeUserRepo{users: []domain.User{
		{ID: 3, Role: domain.RoleOperator},
		{ID: 5, Role: domain.RoleAdmin},
		{ID: 2, Role: domain.RoleAdmin},
	}}
	sessions := &fakeSessionRepo{}
	uc := auth.NewLocalSignIn(users, sessions, fakeHasher{}, localToken, time.Hour)

	session, err := uc.Execute(context.Background(), localToken)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if session.UserID != 2 {
		t.Fatalf("expected session for admin 2, got %d", session.UserID)
	}
	if len(session.Token) != 64 || session.Token == localToken {
		t.Fatalf("expected a fresh 64-char session token, got %q", session.Token)
	}
	if time.Until(session.ExpiresAt) <= 0 || time.Until(session.ExpiresAt) > time.Hour {
		t.Fatalf("unexpected expiration: %v", session.ExpiresAt)
	}
	if len(sessions.created) != 1 {
		t.Fatalf("expected 1 session, got %d", len(sessions.created))
	}
	if len(users.updated) != 0 {
		t.Fatalf("expected no user update, got %d", len(users.updated))
	}
}

func TestLocalSignIn_RetiresDefaultPassword(t *testing.T) {
	admin := domain.User{ID: 1, Role: domain.RoleAdmin, PasswordHash: "hashed:admin", MustChangePassword: true}
	users := &fakeUserRepo{users: []domain.User{admin}}
	uc := auth.NewLocalSignIn(users, &fakeSessionRepo{}, fakeHasher{}, localToken, time.Hour)

	if _, err := uc.Execute(context.Background(), localToken); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(users.updated) != 1 {
		t.Fatalf("expected admin update, got %d", len(users.updated))
	}
	updated := users.updated[0]
	if updated.MustChangePassword {
		t.Fatal("expected MustChangePassword to be cleared")
	}
	if (fakeHasher{}).Compare(updated.PasswordHash, "admin") == nil {
		t.Fatal("expected default password to be replaced")
	}
}

func TestLocalSignIn_FailsWithoutAdmin(t *testing.T) {
	users := &fakeUserRepo{users: []domain.User{{ID: 1, Role: domain.RoleOperator}}}
	uc := auth.NewLocalSignIn(users, &fakeSessionRepo{}, fakeHasher{}, localToken, time.Hour)

	if _, err := uc.Execute(context.Background(), localToken); !errors.Is(err, domain.ErrForbidden) {
		t.Fatalf("expected ErrForbidden, got %v", err)
	}
}
