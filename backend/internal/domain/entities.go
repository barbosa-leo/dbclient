package domain

import "time"

type Role string

const (
	RoleAdmin    Role = "admin"
	RoleOperator Role = "operator"
	RoleViewer   Role = "viewer"
)

func (r Role) IsValid() bool {
	return r == RoleAdmin || r == RoleOperator || r == RoleViewer
}

type User struct {
	ID                 int64  `json:"id"`
	Name               string `json:"name"`
	Email              string `json:"email"`
	PasswordHash       string `json:"-"`
	Role               Role   `json:"role"`
	MustChangePassword bool   `json:"mustChangePassword"`
}

type Session struct {
	Token     string
	UserID    int64
	ExpiresAt time.Time
}

type SSLMode string

const (
	SSLModeDisable    SSLMode = "disable"
	SSLModeAllow      SSLMode = "allow"
	SSLModePrefer     SSLMode = "prefer"
	SSLModeRequire    SSLMode = "require"
	SSLModeVerifyCA   SSLMode = "verify-ca"
	SSLModeVerifyFull SSLMode = "verify-full"
)

func (m SSLMode) IsValid() bool {
	switch m {
	case SSLModeDisable, SSLModeAllow, SSLModePrefer, SSLModeRequire, SSLModeVerifyCA, SSLModeVerifyFull:
		return true
	default:
		return false
	}
}

type Environment struct {
	ID   int64  `json:"id"`
	Name string `json:"name"`
}

type Connection struct {
	ID                int64   `json:"id"`
	EnvironmentID     int64   `json:"environmentId"`
	Name              string  `json:"name"`
	Host              string  `json:"host"`
	Port              int     `json:"port"`
	Database          string  `json:"database"`
	Username          string  `json:"username"`
	EncryptedPassword string  `json:"-"`
	SSLMode           SSLMode `json:"sslMode"`
}

type ConnectionCredentials struct {
	Host     string
	Port     int
	Database string
	Username string
	Password string
	SSLMode  SSLMode
}

type TableKind string

const (
	TableKindTable            TableKind = "table"
	TableKindView             TableKind = "view"
	TableKindMaterializedView TableKind = "materialized_view"
)

type TableInfo struct {
	Name string    `json:"name"`
	Kind TableKind `json:"kind"`
}

type SchemaInfo struct {
	Name       string      `json:"name"`
	Tables     []TableInfo `json:"tables"`
	Procedures []string    `json:"procedures"`
	Functions  []string    `json:"functions"`
	Triggers   []string    `json:"triggers"`
}

type ColumnInfo struct {
	Name         string  `json:"name"`
	DataType     string  `json:"dataType"`
	Nullable     bool    `json:"nullable"`
	DefaultValue *string `json:"defaultValue"`
	IsPrimaryKey bool    `json:"isPrimaryKey"`
}

type QueryResult struct {
	Columns      []string `json:"columns"`
	Rows         [][]any  `json:"rows"`
	RowsAffected *int64   `json:"rowsAffected"`
	DurationMs   int64    `json:"durationMs"`
}

type JobKind string

const (
	JobKindScript     JobKind = "script"
	JobKindDumpExport JobKind = "dump_export"
	JobKindDumpImport JobKind = "dump_import"
)

type JobStatus string

const (
	JobStatusPending JobStatus = "pending"
	JobStatusRunning JobStatus = "running"
	JobStatusDone    JobStatus = "done"
	JobStatusFailed  JobStatus = "failed"
)

type Job struct {
	ID       string    `json:"id"`
	Kind     JobKind   `json:"kind"`
	Status   JobStatus `json:"status"`
	Progress int       `json:"progress"`
	FileName string    `json:"fileName"`
	FilePath string    `json:"-"`
	Error    *string   `json:"error"`
}
