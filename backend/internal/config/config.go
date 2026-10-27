package config

import (
	"encoding/base64"
	"errors"
	"fmt"
	"net"
	"os"
	"strconv"
	"time"
)

type AuthMode string

const (
	AuthModeSession AuthMode = "session"
	AuthModeLocal   AuthMode = "local"
)

const minLocalTokenLength = 32

type Config struct {
	EncryptionKey        []byte
	Addr                 string
	DataDir              string
	DumpDir              string
	DumpTTL              time.Duration
	SessionTTL           time.Duration
	RateLimitEnabled     bool
	RateLimitAPI         int
	RateLimitAuth        int
	RateLimitQuery       int
	InitialAdminPassword string
	TrustedProxies       string
	AuthMode             AuthMode
	LocalToken           string
}

func Load() (Config, error) {
	rawKey := os.Getenv("DBCLIENT_ENCRYPTION_KEY")
	if rawKey == "" {
		return Config{}, errors.New("DBCLIENT_ENCRYPTION_KEY is required")
	}

	key, err := base64.StdEncoding.DecodeString(rawKey)
	if err != nil {
		return Config{}, fmt.Errorf("DBCLIENT_ENCRYPTION_KEY must be valid base64: %w", err)
	}
	if len(key) != 32 {
		return Config{}, fmt.Errorf("DBCLIENT_ENCRYPTION_KEY must decode to 32 bytes, got %d", len(key))
	}

	dumpTTL, err := parseDurationEnv("DBCLIENT_DUMP_TTL", 24*time.Hour)
	if err != nil {
		return Config{}, err
	}

	sessionTTL, err := parseDurationEnv("DBCLIENT_SESSION_TTL", 12*time.Hour)
	if err != nil {
		return Config{}, err
	}

	addr := stringEnv("DBCLIENT_ADDR", ":8080")
	authMode := AuthMode(stringEnv("DBCLIENT_AUTH_MODE", string(AuthModeSession)))
	localToken := os.Getenv("DBCLIENT_LOCAL_TOKEN")
	if err := validateAuthMode(authMode, addr, localToken); err != nil {
		return Config{}, err
	}

	return Config{
		EncryptionKey:        key,
		Addr:                 addr,
		DataDir:              stringEnv("DBCLIENT_DATA_DIR", "/data"),
		DumpDir:              stringEnv("DBCLIENT_DUMP_DIR", "/tmp/dbclient"),
		DumpTTL:              dumpTTL,
		SessionTTL:           sessionTTL,
		RateLimitEnabled:     boolEnv("DBCLIENT_RATE_LIMIT_ENABLED", true),
		RateLimitAPI:         intEnv("DBCLIENT_RATE_LIMIT_API", 120),
		RateLimitAuth:        intEnv("DBCLIENT_RATE_LIMIT_AUTH", 10),
		RateLimitQuery:       intEnv("DBCLIENT_RATE_LIMIT_QUERY", 60),
		InitialAdminPassword: stringEnv("DBCLIENT_INITIAL_ADMIN_PASSWORD", "admin"),
		TrustedProxies:       stringEnv("DBCLIENT_TRUSTED_PROXIES", ""),
		AuthMode:             authMode,
		LocalToken:           localToken,
	}, nil
}

func validateAuthMode(mode AuthMode, addr, localToken string) error {
	switch mode {
	case AuthModeSession:
		return nil
	case AuthModeLocal:
	default:
		return fmt.Errorf("DBCLIENT_AUTH_MODE must be %q or %q", AuthModeSession, AuthModeLocal)
	}

	if !localModeSupported {
		return errors.New("DBCLIENT_AUTH_MODE=local requires a desktop build (-tags desktop)")
	}
	if len(localToken) < minLocalTokenLength {
		return fmt.Errorf("DBCLIENT_LOCAL_TOKEN must have at least %d characters in local mode", minLocalTokenLength)
	}
	if !isLoopbackAddr(addr) {
		return errors.New("DBCLIENT_ADDR must be a loopback address (e.g. 127.0.0.1:8080) in local mode")
	}
	return nil
}

func isLoopbackAddr(addr string) bool {
	host, _, err := net.SplitHostPort(addr)
	if err != nil {
		return false
	}
	if host == "localhost" {
		return true
	}
	ip := net.ParseIP(host)
	return ip != nil && ip.IsLoopback()
}

func stringEnv(name, fallback string) string {
	if v := os.Getenv(name); v != "" {
		return v
	}
	return fallback
}

func parseDurationEnv(name string, fallback time.Duration) (time.Duration, error) {
	v := os.Getenv(name)
	if v == "" {
		return fallback, nil
	}
	d, err := time.ParseDuration(v)
	if err != nil || d <= 0 {
		return 0, fmt.Errorf("%s must be a positive duration", name)
	}
	return d, nil
}

func intEnv(name string, fallback int) int {
	if v := os.Getenv(name); v != "" {
		if n, err := strconv.Atoi(v); err == nil && n > 0 {
			return n
		}
	}
	return fallback
}

func boolEnv(name string, fallback bool) bool {
	if v := os.Getenv(name); v != "" {
		if b, err := strconv.ParseBool(v); err == nil {
			return b
		}
	}
	return fallback
}
