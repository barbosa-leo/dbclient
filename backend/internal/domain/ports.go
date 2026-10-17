package domain

import (
	"context"
	"io"
	"time"
)

type UserRepository interface {
	FindByID(ctx context.Context, id int64) (User, error)
	FindByUsername(ctx context.Context, username string) (User, error)
	List(ctx context.Context) ([]User, error)
	Create(ctx context.Context, user User) (User, error)
	Update(ctx context.Context, user User) (User, error)
	Delete(ctx context.Context, id int64) error
	CountByRole(ctx context.Context, role Role) (int, error)
}

type SessionRepository interface {
	Create(ctx context.Context, session Session) error
	FindByToken(ctx context.Context, token string) (Session, error)
	DeleteByToken(ctx context.Context, token string) error
	DeleteByUserID(ctx context.Context, userID int64) error
	DeleteExpired(ctx context.Context, now time.Time) error
}

type EnvironmentRepository interface {
	List(ctx context.Context) ([]Environment, error)
	FindByID(ctx context.Context, id int64) (Environment, error)
	Create(ctx context.Context, name string) (Environment, error)
	Delete(ctx context.Context, id int64) error
}

type ConnectionRepository interface {
	List(ctx context.Context, environmentID *int64) ([]Connection, error)
	FindByID(ctx context.Context, id int64) (Connection, error)
	Create(ctx context.Context, conn Connection) (Connection, error)
	Update(ctx context.Context, conn Connection) (Connection, error)
	Delete(ctx context.Context, id int64) error
	CountByEnvironmentID(ctx context.Context, environmentID int64) (int, error)
}

type PasswordHasher interface {
	Hash(password string) (string, error)
	Compare(hash, password string) error
}

type Cipher interface {
	Encrypt(plaintext string) (string, error)
	Decrypt(ciphertext string) (string, error)
}

type DatabaseDriver interface {
	ListDatabases(ctx context.Context, creds ConnectionCredentials) ([]string, error)
	ListSchemas(ctx context.Context, creds ConnectionCredentials) ([]SchemaInfo, error)
	ListColumns(ctx context.Context, creds ConnectionCredentials, schema, table string) ([]ColumnInfo, error)
	ExecuteQuery(ctx context.Context, creds ConnectionCredentials, sql string, limit int) (QueryResult, error)
}

type Dumper interface {
	Export(ctx context.Context, creds ConnectionCredentials, dst io.Writer) error
	Restore(ctx context.Context, creds ConnectionCredentials, filePath string) error
}

type ScriptRunner interface {
	Run(ctx context.Context, creds ConnectionCredentials, filePath string) error
}

type FileStore interface {
	SaveStream(ctx context.Context, prefix string, r io.Reader, maxBytes int64) (string, error)
	CreateWriter(prefix string, maxBytes int64) (path string, writer io.WriteCloser, err error)
	Open(path string) (io.ReadCloser, error)
	Remove(path string) error
	CleanupExpired(ttl time.Duration) error
}
