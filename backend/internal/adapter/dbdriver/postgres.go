package dbdriver

import (
	"context"
	"fmt"
	"net/url"
	"strconv"
	"strings"
	"time"

	"dbclient/backend/internal/domain"

	"github.com/jackc/pgx/v5"
)

const defaultConnectTimeout = 10 * time.Second
const defaultQueryTimeout = 30 * time.Second

type PostgresDriver struct{}

func NewPostgresDriver() *PostgresDriver {
	return &PostgresDriver{}
}

func (d *PostgresDriver) ListSchemas(ctx context.Context, creds domain.ConnectionCredentials) ([]domain.SchemaInfo, error) {
	conn, cancel, err := connect(ctx, creds, defaultConnectTimeout)
	if err != nil {
		return nil, err
	}
	defer cancel()
	defer conn.Close(ctx)

	schemaRows, err := conn.Query(
		ctx,
		`SELECT nspname
		 FROM pg_namespace
		 WHERE nspname NOT IN ('pg_catalog', 'information_schema', 'pg_toast')
		   AND nspname NOT LIKE 'pg_temp_%'
		   AND nspname NOT LIKE 'pg_toast_temp_%'
		 ORDER BY nspname ASC`,
	)
	if err != nil {
		return nil, err
	}

	schemas := make([]domain.SchemaInfo, 0)
	indexByName := make(map[string]int)
	for schemaRows.Next() {
		var name string
		if err := schemaRows.Scan(&name); err != nil {
			schemaRows.Close()
			return nil, err
		}
		indexByName[name] = len(schemas)
		schemas = append(schemas, domain.SchemaInfo{
			Name:       name,
			Tables:     make([]domain.TableInfo, 0),
			Procedures: make([]string, 0),
			Functions:  make([]string, 0),
			Triggers:   make([]string, 0),
		})
	}
	schemaRows.Close()
	if err := schemaRows.Err(); err != nil {
		return nil, err
	}

	relRows, err := conn.Query(
		ctx,
		`SELECT n.nspname,
		        c.relname,
		        CASE c.relkind
		          WHEN 'r' THEN 'table'
		          WHEN 'p' THEN 'table'
		          WHEN 'v' THEN 'view'
		          WHEN 'm' THEN 'materialized_view'
		        END AS kind
		 FROM pg_class c
		 JOIN pg_namespace n ON n.oid = c.relnamespace
		 WHERE c.relkind IN ('r', 'p', 'v', 'm')
		   AND n.nspname NOT IN ('pg_catalog', 'information_schema', 'pg_toast')
		   AND n.nspname NOT LIKE 'pg_temp_%'
		 ORDER BY n.nspname ASC, c.relname ASC`,
	)
	if err != nil {
		return nil, err
	}
	for relRows.Next() {
		var schemaName, tableName, kind string
		if err := relRows.Scan(&schemaName, &tableName, &kind); err != nil {
			relRows.Close()
			return nil, err
		}
		if idx, ok := indexByName[schemaName]; ok {
			schemas[idx].Tables = append(schemas[idx].Tables, domain.TableInfo{
				Name: tableName,
				Kind: domain.TableKind(kind),
			})
		}
	}
	relRows.Close()
	if err := relRows.Err(); err != nil {
		return nil, err
	}

	routineRows, err := conn.Query(
		ctx,
		`SELECT n.nspname, p.proname, p.prokind
		 FROM pg_proc p
		 JOIN pg_namespace n ON n.oid = p.pronamespace
		 WHERE p.prokind IN ('f', 'p')
		   AND n.nspname NOT IN ('pg_catalog', 'information_schema', 'pg_toast')
		 ORDER BY n.nspname ASC, p.proname ASC`,
	)
	if err == nil {
		for routineRows.Next() {
			var schemaName, routineName string
			var prokind byte
			if scanErr := routineRows.Scan(&schemaName, &routineName, &prokind); scanErr == nil {
				if idx, ok := indexByName[schemaName]; ok {
					if prokind == 'p' {
						schemas[idx].Procedures = append(schemas[idx].Procedures, routineName)
					} else {
						schemas[idx].Functions = append(schemas[idx].Functions, routineName)
					}
				}
			}
		}
		routineRows.Close()
	}

	trigRows, err := conn.Query(
		ctx,
		`SELECT n.nspname, t.tgname
		 FROM pg_trigger t
		 JOIN pg_class c ON c.oid = t.tgrelid
		 JOIN pg_namespace n ON n.oid = c.relnamespace
		 WHERE NOT t.tgisinternal
		   AND n.nspname NOT IN ('pg_catalog', 'information_schema', 'pg_toast')
		 ORDER BY n.nspname ASC, t.tgname ASC`,
	)
	if err == nil {
		for trigRows.Next() {
			var schemaName, trigName string
			if scanErr := trigRows.Scan(&schemaName, &trigName); scanErr == nil {
				if idx, ok := indexByName[schemaName]; ok {
					schemas[idx].Triggers = append(schemas[idx].Triggers, trigName)
				}
			}
		}
		trigRows.Close()
	}

	return schemas, nil
}

func (d *PostgresDriver) ListColumns(ctx context.Context, creds domain.ConnectionCredentials, schema, table string) ([]domain.ColumnInfo, error) {
	conn, cancel, err := connect(ctx, creds, defaultConnectTimeout)
	if err != nil {
		return nil, err
	}
	defer cancel()
	defer conn.Close(ctx)

	const query = `
SELECT
	a.attname AS column_name,
	pg_catalog.format_type(a.atttypid, a.atttypmod) AS data_type,
	NOT a.attnotnull AS is_nullable,
	pg_catalog.pg_get_expr(d.adbin, d.adrelid) AS column_default,
	EXISTS (
		SELECT 1
		FROM pg_index i
		WHERE i.indrelid = c.oid
		  AND i.indisprimary
		  AND a.attnum = ANY(i.indkey)
	) AS is_primary_key
FROM pg_attribute a
JOIN pg_class c ON c.oid = a.attrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
LEFT JOIN pg_attrdef d ON d.adrelid = c.oid AND d.adnum = a.attnum
WHERE n.nspname = $1
  AND c.relname = $2
  AND a.attnum > 0
  AND NOT a.attisdropped
ORDER BY a.attnum ASC`

	rows, err := conn.Query(ctx, query, schema, table)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	cols := make([]domain.ColumnInfo, 0)
	for rows.Next() {
		var col domain.ColumnInfo
		if err := rows.Scan(&col.Name, &col.DataType, &col.Nullable, &col.DefaultValue, &col.IsPrimaryKey); err != nil {
			return nil, err
		}
		cols = append(cols, col)
	}
	return cols, rows.Err()
}

func (d *PostgresDriver) ExecuteQuery(ctx context.Context, creds domain.ConnectionCredentials, sqlText string, limit int) (domain.QueryResult, error) {
	queryCtx, cancel := context.WithTimeout(ctx, defaultQueryTimeout)
	defer cancel()

	conn, err := connectRaw(queryCtx, creds)
	if err != nil {
		return domain.QueryResult{}, err
	}
	defer conn.Close(queryCtx)

	start := time.Now()
	rows, err := conn.Query(queryCtx, sqlText)
	if err != nil {
		return domain.QueryResult{}, err
	}
	defer rows.Close()

	fields := rows.FieldDescriptions()
	columns := make([]string, len(fields))
	for i, fd := range fields {
		columns[i] = fd.Name
	}

	resultRows := make([][]any, 0)
	for rows.Next() {
		if len(resultRows) >= limit {
			break
		}
		values, err := rows.Values()
		if err != nil {
			return domain.QueryResult{}, err
		}
		normalized := make([]any, len(values))
		for i, v := range values {
			normalized[i] = normalizeValue(v)
		}
		resultRows = append(resultRows, normalized)
	}
	rows.Close()
	if err := rows.Err(); err != nil {
		return domain.QueryResult{}, err
	}

	durationMs := time.Since(start).Milliseconds()
	tag := rows.CommandTag()

	var rowsAffected *int64
	if len(columns) == 0 && !strings.HasPrefix(strings.ToUpper(tag.String()), "SELECT") {
		affected := tag.RowsAffected()
		rowsAffected = &affected
	}

	return domain.QueryResult{
		Columns:      columns,
		Rows:         resultRows,
		RowsAffected: rowsAffected,
		DurationMs:   durationMs,
	}, nil
}

func connect(ctx context.Context, creds domain.ConnectionCredentials, timeout time.Duration) (*pgx.Conn, context.CancelFunc, error) {
	connCtx, cancel := context.WithTimeout(ctx, timeout)
	conn, err := connectRaw(connCtx, creds)
	if err != nil {
		cancel()
		return nil, nil, err
	}
	return conn, cancel, nil
}

func connectRaw(ctx context.Context, creds domain.ConnectionCredentials) (*pgx.Conn, error) {
	u := &url.URL{
		Scheme: "postgres",
		User:   url.UserPassword(creds.Username, creds.Password),
		Host:   fmt.Sprintf("%s:%d", creds.Host, creds.Port),
		Path:   "/" + creds.Database,
	}
	q := u.Query()
	sslMode := string(creds.SSLMode)
	if sslMode == "" {
		sslMode = string(domain.SSLModePrefer)
	}
	q.Set("sslmode", sslMode)
	q.Set("connect_timeout", strconv.Itoa(int(defaultConnectTimeout.Seconds())))
	u.RawQuery = q.Encode()

	return pgx.Connect(ctx, u.String())
}

func normalizeValue(v any) any {
	switch val := v.(type) {
	case nil:
		return nil
	case []byte:
		return string(val)
	case [16]byte:
		return fmt.Sprintf("%x-%x-%x-%x-%x", val[0:4], val[4:6], val[6:8], val[8:10], val[10:16])
	case time.Time:
		return val.UTC().Format(time.RFC3339)
	default:
		return val
	}
}
