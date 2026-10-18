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

func findPostgresBinary(name string) (string, error) {
	if p, err := exec.LookPath(name); err == nil {
		return p, nil
	}
	candidates := []string{
		"/opt/homebrew/opt/libpq/bin/" + name,
		"/opt/homebrew/bin/" + name,
		"/usr/local/opt/libpq/bin/" + name,
		"/usr/local/bin/" + name,
		"/usr/bin/" + name,
	}
	for _, c := range candidates {
		if _, err := os.Stat(c); err == nil {
			return c, nil
		}
	}
	return "", fmt.Errorf("utilitário '%s' não encontrado no sistema (verifique se postgresql-client ou libpq está instalado)", name)
}

func (d *PostgresDumper) Export(ctx context.Context, creds domain.ConnectionCredentials, dst io.Writer) error {
	binPath, err := findPostgresBinary("pg_dump")
	if err != nil {
		return err
	}

	args := []string{
		"--format=plain",
		"--no-owner",
		"--no-privileges",
		"--host", creds.Host,
		"--port", strconv.Itoa(creds.Port),
		"--username", creds.Username,
		"--dbname", creds.Database,
	}

	cmd := exec.CommandContext(ctx, binPath, args...)
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
	binPath, err := findPostgresBinary("psql")
	if err != nil {
		return err
	}

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

	cmd := exec.CommandContext(ctx, binPath, args...)
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

	currentPath := os.Getenv("PATH")
	extraPaths := "/opt/homebrew/opt/libpq/bin:/opt/homebrew/bin:/usr/local/opt/libpq/bin"
	if currentPath != "" {
		env = append(env, "PATH="+extraPaths+":"+currentPath)
	} else {
		env = append(env, "PATH="+extraPaths)
	}

	return env
}
