//go:build !desktop

package config

import (
	"strings"
	"testing"
)

func TestLoad_RejectsLocalModeOutsideDesktopBuild(t *testing.T) {
	setBaseEnv(t)
	t.Setenv("DBCLIENT_ADDR", "127.0.0.1:8080")
	t.Setenv("DBCLIENT_AUTH_MODE", "local")
	t.Setenv("DBCLIENT_LOCAL_TOKEN", strings.Repeat("a", 64))

	_, err := Load()
	if err == nil || !strings.Contains(err.Error(), "desktop build") {
		t.Fatalf("expected desktop build error, got %v", err)
	}
}
