//go:build windows

package main

import (
	"bufio"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"strings"
)

const (
	releaseDownloadBase = "https://github.com/barbosa-leo/dbclient/releases/download"
	installerAsset      = "DBClient-Windows-Setup.exe"
	checksumsAsset      = "SHA256SUMS"
	maxChecksumsBytes   = 64 * 1024
)

var releaseVersion = regexp.MustCompile(`^\d+\.\d+\.\d+$`)

// The download URL is built here from a validated version, never taken from the page.
func downloadInstaller(ctx context.Context, dir, version string) (string, error) {
	if !releaseVersion.MatchString(version) {
		return "", fmt.Errorf("versão inválida: %q", version)
	}
	base := fmt.Sprintf("%s/v%s/", releaseDownloadBase, version)

	expected, err := fetchChecksum(ctx, base+checksumsAsset, installerAsset)
	if err != nil {
		return "", err
	}

	resp, err := httpGet(ctx, base+installerAsset)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	dest := filepath.Join(dir, fmt.Sprintf("DBClient-Setup-%s.exe", version))
	partial := dest + ".part"
	file, err := os.Create(partial)
	if err != nil {
		return "", err
	}
	hash := sha256.New()
	_, copyErr := io.Copy(io.MultiWriter(file, hash), resp.Body)
	closeErr := file.Close()
	if copyErr != nil || closeErr != nil {
		os.Remove(partial)
		return "", fmt.Errorf("falha ao baixar o instalador: %w", firstError(copyErr, closeErr))
	}

	if actual := hex.EncodeToString(hash.Sum(nil)); actual != expected {
		os.Remove(partial)
		return "", fmt.Errorf("o instalador baixado não confere com o SHA-256 publicado")
	}
	if err := os.Rename(partial, dest); err != nil {
		os.Remove(partial)
		return "", err
	}
	return dest, nil
}

func fetchChecksum(ctx context.Context, url, asset string) (string, error) {
	resp, err := httpGet(ctx, url)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	scanner := bufio.NewScanner(io.LimitReader(resp.Body, maxChecksumsBytes))
	for scanner.Scan() {
		fields := strings.Fields(scanner.Text())
		if len(fields) == 2 && strings.TrimPrefix(fields[1], "*") == asset {
			return strings.ToLower(fields[0]), nil
		}
	}
	if err := scanner.Err(); err != nil {
		return "", err
	}
	return "", fmt.Errorf("%s não lista o %s", checksumsAsset, asset)
}

func httpGet(ctx context.Context, url string) (*http.Response, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return nil, err
	}
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, err
	}
	if resp.StatusCode != http.StatusOK {
		resp.Body.Close()
		return nil, fmt.Errorf("download de %s falhou (HTTP %d)", url, resp.StatusCode)
	}
	return resp, nil
}

func firstError(errs ...error) error {
	for _, err := range errs {
		if err != nil {
			return err
		}
	}
	return nil
}

// The installer closes the running app itself and, with /RELAUNCH, reopens it once the files are replaced.
func startInstaller(path string) error {
	cmd := exec.Command(path, "/S", "/RELAUNCH")
	if err := cmd.Start(); err != nil {
		return err
	}
	return cmd.Process.Release()
}

func updateStatusScript(state, message string) string {
	detail, _ := json.Marshal(map[string]string{"state": state, "message": message})
	return "window.dispatchEvent(new CustomEvent('dbclient-desktop-update', { detail: " + string(detail) + " }));"
}

const desktopBridgeScript = `window.dbclientDesktop = {
  platform: 'windows',
  installUpdate: function (version) { return window.dbclientInstallUpdate(version); },
};`
