package filestore

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"time"

	"dbclient/backend/internal/domain"
)

type LocalFileStore struct {
	dir string
}

func NewLocalFileStore(dir string) (*LocalFileStore, error) {
	if err := os.MkdirAll(dir, 0o750); err != nil {
		return nil, fmt.Errorf("create dump dir: %w", err)
	}
	return &LocalFileStore{dir: dir}, nil
}

func (s *LocalFileStore) SaveStream(ctx context.Context, prefix string, r io.Reader, maxBytes int64) (string, error) {
	path, writer, err := s.CreateWriter(prefix, maxBytes)
	if err != nil {
		return "", err
	}

	buf := make([]byte, 32*1024)
	for {
		if err := ctx.Err(); err != nil {
			_ = writer.Close()
			_ = os.Remove(path)
			return "", err
		}
		n, readErr := r.Read(buf)
		if n > 0 {
			if _, writeErr := writer.Write(buf[:n]); writeErr != nil {
				_ = writer.Close()
				_ = os.Remove(path)
				return "", writeErr
			}
		}
		if readErr != nil {
			if readErr == io.EOF {
				break
			}
			_ = writer.Close()
			_ = os.Remove(path)
			return "", readErr
		}
	}

	if err := writer.Close(); err != nil {
		_ = os.Remove(path)
		return "", err
	}
	return path, nil
}

func (s *LocalFileStore) CreateWriter(prefix string, maxBytes int64) (string, io.WriteCloser, error) {
	var randBytes [8]byte
	if _, err := rand.Read(randBytes[:]); err != nil {
		return "", nil, err
	}
	fileName := fmt.Sprintf("%s-%s.sql", prefix, hex.EncodeToString(randBytes[:]))
	fullPath := filepath.Join(s.dir, fileName)

	file, err := os.OpenFile(fullPath, os.O_CREATE|os.O_WRONLY|os.O_TRUNC, 0o600)
	if err != nil {
		return "", nil, err
	}

	return fullPath, &limitedFileWriter{
		file:     file,
		path:     fullPath,
		maxBytes: maxBytes,
	}, nil
}

func (s *LocalFileStore) Open(path string) (io.ReadCloser, error) {
	return os.Open(path)
}

func (s *LocalFileStore) Remove(path string) error {
	if path == "" {
		return nil
	}
	if err := os.Remove(path); err != nil && !os.IsNotExist(err) {
		return err
	}
	return nil
}

func (s *LocalFileStore) CleanupExpired(ttl time.Duration) error {
	entries, err := os.ReadDir(s.dir)
	if err != nil {
		return err
	}
	cutoff := time.Now().Add(-ttl)
	for _, entry := range entries {
		if entry.IsDir() {
			continue
		}
		info, err := entry.Info()
		if err != nil {
			continue
		}
		if info.ModTime().Before(cutoff) {
			_ = os.Remove(filepath.Join(s.dir, entry.Name()))
		}
	}
	return nil
}

type limitedFileWriter struct {
	file     *os.File
	path     string
	written  int64
	maxBytes int64
}

func (w *limitedFileWriter) Write(p []byte) (int, error) {
	if w.maxBytes > 0 && w.written+int64(len(p)) > w.maxBytes {
		return 0, domain.ErrFileTooLarge
	}
	n, err := w.file.Write(p)
	w.written += int64(n)
	return n, err
}

func (w *limitedFileWriter) Close() error {
	return w.file.Close()
}
