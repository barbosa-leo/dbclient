package dumper

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"io"
	"os"
	"os/exec"
	"strconv"
	"strings"

	"dbclient/backend/internal/domain"
)

type PostgresDumper struct{}

func NewPostgresDumper() *PostgresDumper {
	return &PostgresDumper{}
}

func (d *PostgresDumper) Export(ctx context.Context, creds domain.ConnectionCredentials, dst io.Writer) error {
	args := []string{
		"--format=plain",
		"--no-owner",
		"--no-privileges",
		"--host", creds.Host,
		"--port", strconv.Itoa(creds.Port),
		"--username", creds.Username,
		"--dbname", creds.Database,
	}

	cmd := exec.CommandContext(ctx, "pg_dump", args...)
	cmd.Env = buildPostgresEnv(creds)
	cmd.Stdout = dst

	var stderr bytes.Buffer
	cmd.Stderr = &stderr

	if err := cmd.Run(); err != nil {
		msg := strings.TrimSpace(stderr.String())
		if msg != "" {
			return fmt.Errorf("%s: %w", msg, err)
		}
		return err
	}
	return nil
}

func (d *PostgresDumper) Restore(ctx context.Context, creds domain.ConnectionCredentials, filePath string) error {
	return runPsqlFile(ctx, creds, filePath)
}

func (d *PostgresDumper) Run(ctx context.Context, creds domain.ConnectionCredentials, filePath string) error {
	return runPsqlFile(ctx, creds, filePath)
}

func runPsqlFile(ctx context.Context, creds domain.ConnectionCredentials, filePath string) error {
	args := []string{
		"--single-transaction",
		"-v", "ON_ERROR_STOP=1",
		"--quiet",
		"--host", creds.Host,
		"--port", strconv.Itoa(creds.Port),
		"--username", creds.Username,
		"--dbname", creds.Database,
		"--file", filePath,
	}

	cmd := exec.CommandContext(ctx, "psql", args...)
	cmd.Env = buildPostgresEnv(creds)

	var stderr bytes.Buffer
	cmd.Stderr = &stderr

	if err := cmd.Run(); err != nil {
		msg := strings.TrimSpace(stderr.String())
		if msg != "" {
			return errors.New(msg)
		}
		return err
	}
	return nil
}

func buildPostgresEnv(creds domain.ConnectionCredentials) []string {
	env := os.Environ()
	env = append(env, "PGPASSWORD="+creds.Password)
	if creds.SSLMode != "" {
		env = append(env, "PGSSLMODE="+string(creds.SSLMode))
	}
	return env
}
