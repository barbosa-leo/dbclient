//go:build windows

package main

import (
	"os"
	"path/filepath"
)

type appPaths struct {
	baseDir    string
	dataDir    string
	dumpDir    string
	logsDir    string
	webViewDir string
}

func (p appPaths) serverLog() string { return filepath.Join(p.logsDir, "server.log") }
func (p appPaths) keyFile() string   { return filepath.Join(p.baseDir, "encryption.key") }
func (p appPaths) portFile() string  { return filepath.Join(p.baseDir, "server-port") }
func (p appPaths) database() string  { return filepath.Join(p.dataDir, "dbclient.sqlite") }

func (p appPaths) hasExistingDatabase() bool {
	_, err := os.Stat(p.database())
	return err == nil
}

func resolvePaths() (appPaths, error) {
	localAppData, err := os.UserCacheDir()
	if err != nil {
		return appPaths{}, err
	}

	base := filepath.Join(localAppData, appName)
	paths := appPaths{
		baseDir:    base,
		dataDir:    filepath.Join(base, "data"),
		dumpDir:    filepath.Join(base, "dumps"),
		logsDir:    filepath.Join(base, "logs"),
		webViewDir: filepath.Join(base, "WebView2"),
	}
	for _, dir := range []string{paths.dataDir, paths.dumpDir, paths.logsDir, paths.webViewDir} {
		if err := os.MkdirAll(dir, 0o700); err != nil {
			return appPaths{}, err
		}
	}
	return paths, nil
}
