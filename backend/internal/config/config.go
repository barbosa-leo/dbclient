package config

import (
	"encoding/base64"
	"errors"
	"fmt"
	"os"
	"time"
)

type Config struct {
	EncryptionKey []byte
	Addr          string
	DataDir       string
	DumpDir       string
	DumpTTL       time.Duration
	SessionTTL    time.Duration
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

	return Config{
		EncryptionKey: key,
		Addr:          stringEnv("DBCLIENT_ADDR", ":8080"),
		DataDir:       stringEnv("DBCLIENT_DATA_DIR", "/data"),
		DumpDir:       stringEnv("DBCLIENT_DUMP_DIR", "/tmp/dbclient"),
		DumpTTL:       dumpTTL,
		SessionTTL:    sessionTTL,
	}, nil
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
