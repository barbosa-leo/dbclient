package dumper_test

import (
	"context"
	"errors"
	"os"
	"path/filepath"
	"runtime"
	"testing"

	"dbclient/backend/internal/adapter/dumper"
	"dbclient/backend/internal/domain"
)

type failingWriter struct{ err error }

func (w failingWriter) Write([]byte) (int, error) { return 0, w.err }

func TestExportReturnsDestinationErrorWhenPgDumpFailsToWrite(t *testing.T) {
	if runtime.GOOS == "windows" {
		t.Skip("fake pg_dump is a shell script")
	}

	binDir := t.TempDir()
	script := "#!/bin/sh\nhead -c 1048576 /dev/zero || exit 1\nexit 1\n"
	if err := os.WriteFile(filepath.Join(binDir, "pg_dump"), []byte(script), 0o755); err != nil {
		t.Fatalf("write fake pg_dump: %v", err)
	}
	t.Setenv("PATH", binDir+string(os.PathListSeparator)+os.Getenv("PATH"))

	creds := domain.ConnectionCredentials{Host: "localhost", Port: 5432, Database: "app", Username: "app"}
	err := dumper.NewPostgresDumper().Export(context.Background(), creds, failingWriter{err: domain.ErrFileTooLarge})

	if !errors.Is(err, domain.ErrFileTooLarge) {
		t.Fatalf("expected ErrFileTooLarge, got %v", err)
	}
}
