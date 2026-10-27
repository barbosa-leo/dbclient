package config

import (
	"strings"
	"testing"
)

const testEncryptionKey = "MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY="

func setBaseEnv(t *testing.T) {
	t.Helper()
	t.Setenv("DBCLIENT_ENCRYPTION_KEY", testEncryptionKey)
	t.Setenv("DBCLIENT_ADDR", "")
	t.Setenv("DBCLIENT_AUTH_MODE", "")
	t.Setenv("DBCLIENT_LOCAL_TOKEN", "")
}

func TestLoad_DefaultsToSessionMode(t *testing.T) {
	setBaseEnv(t)

	cfg, err := Load()
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if cfg.AuthMode != AuthModeSession {
		t.Fatalf("expected session mode, got %q", cfg.AuthMode)
	}
}

func TestLoad_RejectsUnknownAuthMode(t *testing.T) {
	setBaseEnv(t)
	t.Setenv("DBCLIENT_AUTH_MODE", "none")

	_, err := Load()
	if err == nil || !strings.Contains(err.Error(), "DBCLIENT_AUTH_MODE") {
		t.Fatalf("expected auth mode error, got %v", err)
	}
}
