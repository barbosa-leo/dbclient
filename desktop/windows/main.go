//go:build windows

package main

import (
	"context"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"runtime"
	"sync/atomic"
	"time"

	webview2 "github.com/jchv/go-webview2"
)

const (
	appName          = "DBClient"
	serverExecutable = "dbclient-server.exe"
	iconFile         = "DBClient.ico"
	webView2Download = "https://go.microsoft.com/fwlink/p/?LinkId=2124703"
	healthTimeout    = 30 * time.Second
	updateTimeout    = 10 * time.Minute
)

var errWebView2Missing = errors.New("Microsoft Edge WebView2 Runtime não encontrado")

func init() {
	// Win32 windows and their message loop must stay on the thread that created them.
	runtime.LockOSThread()
}

func main() {
	err := run()
	if errors.Is(err, errWebView2Missing) {
		if askYesNo(0, appName, "O DBClient precisa do Microsoft Edge WebView2 Runtime, que não está instalado.\n\nDeseja abrir a página de download?") {
			openExternal(webView2Download)
		}
		os.Exit(1)
	}
	if err != nil {
		showError(0, "Não foi possível iniciar o DBClient", err.Error())
		os.Exit(1)
	}
}

func run() error {
	release, alreadyRunning, err := acquireSingleInstance()
	if err != nil {
		return err
	}
	if alreadyRunning {
		focusExistingWindow()
		return nil
	}
	defer release()

	enableDPIAwareness()

	exe, err := os.Executable()
	if err != nil {
		return err
	}
	installDir := filepath.Dir(exe)

	paths, err := resolvePaths()
	if err != nil {
		return err
	}

	existingDatabase := ""
	if paths.hasExistingDatabase() {
		existingDatabase = paths.database()
	}
	key, err := loadOrCreateEncryptionKey(paths.keyFile(), existingDatabase)
	if err != nil {
		return err
	}

	port, err := preferredPort(paths.portFile())
	if err != nil {
		return err
	}

	srv, err := startServer(serverConfig{
		executable:    filepath.Join(installDir, serverExecutable),
		port:          port,
		encryptionKey: key,
		paths:         paths,
	})
	if err != nil {
		return err
	}
	defer srv.Stop()

	view := webview2.NewWithOptions(webview2.WebViewOptions{
		DataPath:  paths.webViewDir,
		AutoFocus: true,
		WindowOptions: webview2.WindowOptions{
			Title:  appName,
			Width:  1280,
			Height: 820,
			Center: true,
		},
	})
	if view == nil {
		return errWebView2Missing
	}

	hwnd := uintptr(view.Window())
	setWindowIcon(hwnd, filepath.Join(installDir, iconFile))
	view.SetSize(900, 600, webview2.HintMin)
	view.SetHtml(statusPage("Iniciando o servidor…"))

	fail := func(message string) {
		view.Dispatch(func() {
			showError(hwnd, appName, fmt.Sprintf("%s\n\nDetalhes em %s", message, paths.serverLog()))
			view.Destroy()
		})
	}

	var updating atomic.Bool
	notifyUpdate := func(state, message string) {
		view.Dispatch(func() { view.Eval(updateStatusScript(state, message)) })
	}
	// Bound functions run on the UI thread, so the download goes to a goroutine and reports back through events.
	err = view.Bind("dbclientInstallUpdate", func(version string) {
		if !updating.CompareAndSwap(false, true) {
			return
		}
		go func() {
			notifyUpdate("downloading", "")
			ctx, cancel := context.WithTimeout(context.Background(), updateTimeout)
			defer cancel()
			installer, err := downloadInstaller(ctx, paths.updatesDir, version)
			if err != nil {
				updating.Store(false)
				notifyUpdate("failed", err.Error())
				return
			}
			view.Dispatch(func() {
				if err := startInstaller(installer); err != nil {
					updating.Store(false)
					view.Eval(updateStatusScript("failed", err.Error()))
					return
				}
				view.Eval(updateStatusScript("installing", ""))
				view.Terminate()
			})
		}()
	})
	if err != nil {
		return err
	}
	view.Init(desktopBridgeScript)

	srv.OnUnexpectedExit(func(code int) {
		fail(fmt.Sprintf("O servidor do DBClient foi encerrado inesperadamente (código %d).", code))
	})

	go func() {
		if err := srv.WaitUntilHealthy(healthTimeout); err != nil {
			fail("Não foi possível iniciar o servidor: " + err.Error())
			return
		}
		view.Dispatch(func() { view.Navigate(srv.signInURL) })
	}()

	view.Run()
	return nil
}
