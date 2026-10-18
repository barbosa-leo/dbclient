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

func (d *PostgresDriver) Ping(ctx context.Context, creds domain.ConnectionCredentials) error {
	conn, cancel, err := connect(ctx, creds, 5*time.Second)
	if err != nil {
		return err
	}
	defer cancel()
	defer conn.Close(ctx)

	if err := conn.Ping(ctx); err != nil {
		return enrichConnectionError(err, creds.Host)
	}
	return nil
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

func (d *PostgresDriver) DescribeTable(ctx context.Context, creds domain.ConnectionCredentials, schema, table string) (domain.TableStructureInfo, error) {
	conn, cancel, err := connect(ctx, creds, defaultConnectTimeout)
	if err != nil {
		return domain.TableStructureInfo{}, err
	}
	defer cancel()
	defer conn.Close(ctx)

	cols, err := d.ListColumns(ctx, creds, schema, table)
	if err != nil {
		return domain.TableStructureInfo{}, err
	}

	const fkQuery = `
SELECT
	con.conname AS constraint_name,
	att.attname AS column_name,
	ref_ns.nspname AS ref_schema,
	ref_cls.relname AS ref_table,
	ref_att.attname AS ref_column,
	CASE con.confupdtype
		WHEN 'a' THEN 'NO ACTION'
		WHEN 'r' THEN 'RESTRICT'
		WHEN 'c' THEN 'CASCADE'
		WHEN 'n' THEN 'SET NULL'
		WHEN 'd' THEN 'SET DEFAULT'
		ELSE 'NO ACTION'
	END AS on_update,
	CASE con.confdeltype
		WHEN 'a' THEN 'NO ACTION'
		WHEN 'r' THEN 'RESTRICT'
		WHEN 'c' THEN 'CASCADE'
		WHEN 'n' THEN 'SET NULL'
		WHEN 'd' THEN 'SET DEFAULT'
		ELSE 'NO ACTION'
	END AS on_delete
FROM pg_constraint con
JOIN pg_class cls ON cls.oid = con.conrelid
JOIN pg_namespace ns ON ns.oid = cls.relnamespace
JOIN pg_attribute att ON att.attrelid = con.conrelid AND att.attnum = con.conkey[1]
JOIN pg_class ref_cls ON ref_cls.oid = con.confrelid
JOIN pg_namespace ref_ns ON ref_ns.oid = ref_cls.relnamespace
JOIN pg_attribute ref_att ON ref_att.attrelid = con.confrelid AND ref_att.attnum = con.confkey[1]
WHERE con.contype = 'f'
  AND ns.nspname = $1
  AND cls.relname = $2
ORDER BY con.conname ASC`

	fkRows, err := conn.Query(ctx, fkQuery, schema, table)
	if err != nil {
		return domain.TableStructureInfo{}, err
	}
	defer fkRows.Close()

	foreignKeys := make([]domain.ForeignKeyInfo, 0)
	for fkRows.Next() {
		var fk domain.ForeignKeyInfo
		if scanErr := fkRows.Scan(&fk.Name, &fk.Column, &fk.ReferencedSchema, &fk.ReferencedTable, &fk.ReferencedColumn, &fk.OnUpdate, &fk.OnDelete); scanErr == nil {
			foreignKeys = append(foreignKeys, fk)
		}
	}
	fkRows.Close()

	const idxQuery = `
SELECT
	idx_cls.relname AS index_name,
	am.amname AS access_method,
	idx.indisunique AS is_unique,
	idx.indisprimary AS is_primary,
	ARRAY(
		SELECT att.attname
		FROM unnest(idx.indkey) WITH ORDINALITY AS k(attnum, ord)
		JOIN pg_attribute att ON att.attrelid = tbl_cls.oid AND att.attnum = k.attnum
		ORDER BY k.ord
	) AS column_names
FROM pg_index idx
JOIN pg_class idx_cls ON idx_cls.oid = idx.indexrelid
JOIN pg_class tbl_cls ON tbl_cls.oid = idx.indrelid
JOIN pg_namespace ns ON ns.oid = tbl_cls.relnamespace
JOIN pg_am am ON am.oid = idx_cls.relam
WHERE ns.nspname = $1
  AND tbl_cls.relname = $2
ORDER BY idx.indisprimary DESC, idx_cls.relname ASC`

	idxRows, err := conn.Query(ctx, idxQuery, schema, table)
	if err != nil {
		return domain.TableStructureInfo{}, err
	}
	defer idxRows.Close()

	indexes := make([]domain.IndexInfo, 0)
	for idxRows.Next() {
		var item domain.IndexInfo
		if scanErr := idxRows.Scan(&item.Name, &item.Method, &item.IsUnique, &item.IsPrimary, &item.Columns); scanErr == nil {
			indexes = append(indexes, item)
		}
	}
	idxRows.Close()

	return domain.TableStructureInfo{
		Columns:     cols,
		ForeignKeys: foreignKeys,
		Indexes:     indexes,
	}, nil
}

func (d *PostgresDriver) GetObjectDefinition(ctx context.Context, creds domain.ConnectionCredentials, schema, category, name string) (string, error) {
	conn, cancel, err := connect(ctx, creds, defaultConnectTimeout)
	if err != nil {
		return "", err
	}
	defer cancel()
	defer conn.Close(ctx)

	switch category {
	case "views":
		var relkind byte
		var viewDef string
		err := conn.QueryRow(
			ctx,
			`SELECT c.relkind, pg_catalog.pg_get_viewdef(c.oid, true)
			 FROM pg_class c
			 JOIN pg_namespace n ON n.oid = c.relnamespace
			 WHERE n.nspname = $1
			   AND c.relname = $2
			   AND c.relkind IN ('v', 'm')`,
			schema,
			name,
		).Scan(&relkind, &viewDef)
		if err != nil {
			if err == pgx.ErrNoRows {
				return "", domain.ErrNotFound
			}
			return "", err
		}
		qualified := fmt.Sprintf("%s.%s", quotePGIdentifier(schema), quotePGIdentifier(name))
		body := strings.TrimSpace(viewDef)
		if !strings.HasSuffix(body, ";") {
			body += ";"
		}
		if relkind == 'm' {
			return fmt.Sprintf("DROP MATERIALIZED VIEW IF EXISTS %s;\nCREATE MATERIALIZED VIEW %s AS\n%s", qualified, qualified, body), nil
		}
		return fmt.Sprintf("CREATE OR REPLACE VIEW %s AS\n%s", qualified, body), nil

	case "procedures", "functions":
		prokind := "f"
		if category == "procedures" {
			prokind = "p"
		}
		var funcDef string
		err := conn.QueryRow(
			ctx,
			`SELECT pg_catalog.pg_get_functiondef(p.oid)
			 FROM pg_proc p
			 JOIN pg_namespace n ON n.oid = p.pronamespace
			 WHERE n.nspname = $1
			   AND p.proname = $2
			   AND p.prokind = $3
			 ORDER BY p.oid ASC
			 LIMIT 1`,
			schema,
			name,
			prokind,
		).Scan(&funcDef)
		if err != nil {
			if err == pgx.ErrNoRows {
				return "", domain.ErrNotFound
			}
			return "", err
		}
		trimmed := strings.TrimSpace(funcDef)
		if !strings.HasSuffix(trimmed, ";") {
			trimmed += ";"
		}
		return trimmed, nil

	case "triggers":
		var trigDef string
		err := conn.QueryRow(
			ctx,
			`SELECT pg_catalog.pg_get_triggerdef(t.oid, true)
			 FROM pg_trigger t
			 JOIN pg_class c ON c.oid = t.tgrelid
			 JOIN pg_namespace n ON n.oid = c.relnamespace
			 WHERE NOT t.tgisinternal
			   AND n.nspname = $1
			   AND t.tgname = $2
			 ORDER BY t.oid ASC
			 LIMIT 1`,
			schema,
			name,
		).Scan(&trigDef)
		if err != nil {
			if err == pgx.ErrNoRows {
				return "", domain.ErrNotFound
			}
			return "", err
		}
		trimmed := strings.TrimSpace(trigDef)
		if strings.HasPrefix(trimmed, "CREATE TRIGGER ") {
			trimmed = "CREATE OR REPLACE TRIGGER " + strings.TrimPrefix(trimmed, "CREATE TRIGGER ")
		}
		if !strings.HasSuffix(trimmed, ";") {
			trimmed += ";"
		}
		return trimmed, nil

	default:
		return "", domain.NewValidationError("Categoria de objeto inválida")
	}
}

func quotePGIdentifier(ident string) string {
	return `"` + strings.ReplaceAll(ident, `"`, `""`) + `"`
}

func (d *PostgresDriver) DropObject(ctx context.Context, creds domain.ConnectionCredentials, schema, category, name string) error {
	conn, cancel, err := connect(ctx, creds, defaultConnectTimeout)
	if err != nil {
		return err
	}
	defer cancel()
	defer conn.Close(ctx)

	qualified := fmt.Sprintf("%s.%s", quotePGIdentifier(schema), quotePGIdentifier(name))

	switch category {
	case "tables":
		_, err := conn.Exec(ctx, fmt.Sprintf("DROP TABLE %s", qualified))
		return err

	case "views":
		var relkind byte
		err := conn.QueryRow(
			ctx,
			`SELECT c.relkind
			 FROM pg_class c
			 JOIN pg_namespace n ON n.oid = c.relnamespace
			 WHERE n.nspname = $1
			   AND c.relname = $2
			   AND c.relkind IN ('v', 'm')`,
			schema,
			name,
		).Scan(&relkind)
		if err != nil {
			if err == pgx.ErrNoRows {
				return domain.ErrNotFound
			}
			return err
		}
		if relkind == 'm' {
			_, err = conn.Exec(ctx, fmt.Sprintf("DROP MATERIALIZED VIEW %s", qualified))
			return err
		}
		_, err = conn.Exec(ctx, fmt.Sprintf("DROP VIEW %s", qualified))
		return err

	case "procedures", "functions":
		prokind := "f"
		keyword := "FUNCTION"
		if category == "procedures" {
			prokind = "p"
			keyword = "PROCEDURE"
		}
		var args string
		err := conn.QueryRow(
			ctx,
			`SELECT pg_catalog.pg_get_function_identity_arguments(p.oid)
			 FROM pg_proc p
			 JOIN pg_namespace n ON n.oid = p.pronamespace
			 WHERE n.nspname = $1
			   AND p.proname = $2
			   AND p.prokind = $3
			 ORDER BY p.oid ASC
			 LIMIT 1`,
			schema,
			name,
			prokind,
		).Scan(&args)
		if err != nil {
			if err == pgx.ErrNoRows {
				return domain.ErrNotFound
			}
			return err
		}
		_, err = conn.Exec(ctx, fmt.Sprintf("DROP %s %s(%s)", keyword, qualified, args))
		return err

	case "triggers":
		var tableName string
		err := conn.QueryRow(
			ctx,
			`SELECT c.relname
			 FROM pg_trigger t
			 JOIN pg_class c ON c.oid = t.tgrelid
			 JOIN pg_namespace n ON n.oid = c.relnamespace
			 WHERE NOT t.tgisinternal
			   AND n.nspname = $1
			   AND t.tgname = $2
			 ORDER BY t.oid ASC
			 LIMIT 1`,
			schema,
			name,
		).Scan(&tableName)
		if err != nil {
			if err == pgx.ErrNoRows {
				return domain.ErrNotFound
			}
			return err
		}
		qualifiedTable := fmt.Sprintf("%s.%s", quotePGIdentifier(schema), quotePGIdentifier(tableName))
		_, err = conn.Exec(ctx, fmt.Sprintf("DROP TRIGGER %s ON %s", quotePGIdentifier(name), qualifiedTable))
		return err

	default:
		return domain.NewValidationError("Categoria de objeto inválida")
	}
}

func (d *PostgresDriver) ExecuteQuery(ctx context.Context, creds domain.ConnectionCredentials, sqlText string, limit int, readOnly bool) (domain.QueryResult, error) {
	queryCtx, cancel := context.WithTimeout(ctx, defaultQueryTimeout)
	defer cancel()

	conn, err := connectRaw(queryCtx, creds)
	if err != nil {
		return domain.QueryResult{}, err
	}
	defer conn.Close(queryCtx)

	start := time.Now()
	txOpts := pgx.TxOptions{}
	if readOnly {
		txOpts.AccessMode = pgx.ReadOnly
	}
	tx, err := conn.BeginTx(queryCtx, txOpts)
	if err != nil {
		return domain.QueryResult{}, err
	}
	defer func() {
		_ = tx.Rollback(queryCtx)
	}()

	rows, err := tx.Query(queryCtx, sqlText, pgx.QueryExecModeSimpleProtocol)
	if err != nil {
		return domain.QueryResult{}, err
	}

	fields := rows.FieldDescriptions()
	columns := make([]string, len(fields))
	for i, fd := range fields {
		columns[i] = fd.Name
	}

	resultRows := make([][]any, 0)
	for rows.Next() {
		if len(resultRows) >= limit {
			continue
		}
		values, err := rows.Values()
		if err != nil {
			rows.Close()
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

	if err := tx.Commit(queryCtx); err != nil {
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
		return nil, nil, enrichConnectionError(err, creds.Host)
	}
	return conn, cancel, nil
}

func enrichConnectionError(err error, host string) error {
	if err == nil {
		return nil
	}
	msg := err.Error()
	if strings.Contains(msg, "connection refused") && (host == "localhost" || host == "127.0.0.1") {
		return fmt.Errorf("%s (Dica: se a aplicação estiver em container Docker e o banco no host, use 'host.docker.internal' como Host)", msg)
	}
	return err
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
