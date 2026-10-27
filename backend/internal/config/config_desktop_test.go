//go:build desktop

package config

import (
	"strings"
	"testing"
)

func TestLoad_LocalMode(t *testing.T) {
	validToken := strings.Repeat("a", 64)

	tests := []struct {
		name    string
		addr    string
		token   string
		wantErr string
	}{
		{name: "ipv4 loopback", addr: "127.0.0.1:8080", token: validToken},
		{name: "ipv6 loopback", addr: "[::1]:8080", token: validToken},
		{name: "localhost", addr: "localhost:8080", token: validToken},
		{name: "all interfaces", addr: ":8080", token: validToken, wantErr: "loopback"},
		{name: "public interface", addr: "0.0.0.0:8080", token: validToken, wantErr: "loopback"},
		{name: "lan address", addr: "192.168.0.10:8080", token: validToken, wantErr: "loopback"},
		{name: "missing token", addr: "127.0.0.1:8080", token: "", wantErr: "DBCLIENT_LOCAL_TOKEN"},
		{name: "short token", addr: "127.0.0.1:8080", token: "short", wantErr: "DBCLIENT_LOCAL_TOKEN"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			setBaseEnv(t)
			t.Setenv("DBCLIENT_ADDR", tt.addr)
			t.Setenv("DBCLIENT_AUTH_MODE", "local")
			t.Setenv("DBCLIENT_LOCAL_TOKEN", tt.token)

			cfg, err := Load()
			if tt.wantErr != "" {
				if err == nil || !strings.Contains(err.Error(), tt.wantErr) {
					t.Fatalf("expected error containing %q, got %v", tt.wantErr, err)
				}
				return
			}
			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
			if cfg.AuthMode != AuthModeLocal || cfg.LocalToken != tt.token {
				t.Fatalf("unexpected config: mode=%q", cfg.AuthMode)
			}
		})
	}
}
