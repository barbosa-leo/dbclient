//go:build windows

package main

import (
	"crypto/rand"
	"encoding/base64"
	"errors"
	"fmt"
	"os"
	"unsafe"

	"golang.org/x/sys/windows"
)

// The key is encrypted with DPAPI (user scope): only this Windows account on this machine can decrypt it.
func loadOrCreateEncryptionKey(path string, existingDatabase string) (string, error) {
	sealed, err := os.ReadFile(path)
	if err == nil {
		plain, err := dpapiUnprotect(sealed)
		if err != nil {
			return "", fmt.Errorf("falha ao descriptografar a chave em %s: %w", path, err)
		}
		return string(plain), nil
	}
	if !errors.Is(err, os.ErrNotExist) {
		return "", err
	}

	// Generating a new key over existing data would silently orphan every stored connection password.
	if existingDatabase != "" {
		return "", fmt.Errorf(
			"a chave de criptografia não foi encontrada em %s, mas já existe um banco em %s. "+
				"Restaure o arquivo da chave ou remova esse diretório para começar do zero "+
				"(as senhas das conexões salvas serão perdidas)",
			path, existingDatabase,
		)
	}

	raw := make([]byte, 32)
	if _, err := rand.Read(raw); err != nil {
		return "", err
	}
	key := base64.StdEncoding.EncodeToString(raw)

	sealed, err = dpapiProtect([]byte(key))
	if err != nil {
		return "", fmt.Errorf("falha ao proteger a chave de criptografia: %w", err)
	}
	if err := os.WriteFile(path, sealed, 0o600); err != nil {
		return "", err
	}
	return key, nil
}

func dpapiProtect(data []byte) ([]byte, error) {
	in := windows.DataBlob{Size: uint32(len(data)), Data: &data[0]}
	var out windows.DataBlob
	if err := windows.CryptProtectData(&in, nil, nil, 0, nil, windows.CRYPTPROTECT_UI_FORBIDDEN, &out); err != nil {
		return nil, err
	}
	return takeBlob(out), nil
}

func dpapiUnprotect(data []byte) ([]byte, error) {
	if len(data) == 0 {
		return nil, errors.New("arquivo vazio")
	}
	in := windows.DataBlob{Size: uint32(len(data)), Data: &data[0]}
	var out windows.DataBlob
	if err := windows.CryptUnprotectData(&in, nil, nil, 0, nil, windows.CRYPTPROTECT_UI_FORBIDDEN, &out); err != nil {
		return nil, err
	}
	return takeBlob(out), nil
}

func takeBlob(blob windows.DataBlob) []byte {
	defer windows.LocalFree(windows.Handle(unsafe.Pointer(blob.Data)))
	return append([]byte(nil), unsafe.Slice(blob.Data, blob.Size)...)
}
