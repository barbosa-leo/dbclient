package crypto_test

import (
	"bytes"
	"testing"

	"dbclient/backend/internal/adapter/crypto"
)

func TestAESGCMCipherRoundTrip(t *testing.T) {
	key := bytes.Repeat([]byte{0x42}, 32)
	c, err := crypto.NewAESGCMCipher(key)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	cipherText, err := c.Encrypt("super-secret-password")
	if err != nil {
		t.Fatalf("encrypt failed: %v", err)
	}

	plain, err := c.Decrypt(cipherText)
	if err != nil {
		t.Fatalf("decrypt failed: %v", err)
	}
	if plain != "super-secret-password" {
		t.Fatalf("expected decrypted secret, got %q", plain)
	}
}

func TestBcryptHasher(t *testing.T) {
	h := crypto.NewBcryptHasher()
	hash, err := h.Hash("pass123")
	if err != nil {
		t.Fatalf("hash failed: %v", err)
	}
	if err := h.Compare(hash, "pass123"); err != nil {
		t.Fatalf("compare valid password failed: %v", err)
	}
	if err := h.Compare(hash, "wrong"); err == nil {
		t.Fatalf("expected error on wrong password")
	}
}
