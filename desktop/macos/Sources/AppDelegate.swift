import AppKit

final class AppDelegate: NSObject, NSApplicationDelegate {
    private static let serverExecutableName = "dbclient-server"

    private var windowController: MainWindowController?
    private var server: ServerProcess?
    private var paths: AppPaths?
    private var updating = false

    func applicationDidFinishLaunching(_ notification: Notification) {
        NSApp.mainMenu = MainMenu.build()

        let controller = MainWindowController()
        controller.onInstallUpdate = { [weak self] version in
            Task { @MainActor in await self?.downloadUpdate(version: version) }
        }
        windowController = controller
        controller.showWindow(nil)
        NSApp.activate(ignoringOtherApps: true)

        Task { @MainActor in await startServer() }
    }

    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool {
        true
    }

    func applicationShouldTerminate(_ sender: NSApplication) -> NSApplication.TerminateReply {
        guard let server, server.isRunning else {
            return .terminateNow
        }
        windowController?.showStatus("Encerrando…")
        server.stop { sender.reply(toApplicationShouldTerminate: true) }
        return .terminateLater
    }

    @MainActor
    private func startServer() async {
        windowController?.showStatus("Iniciando o servidor…")
        do {
            let paths = try AppPaths.standard()
            self.paths = paths

            guard let executable = Bundle.main.url(forAuxiliaryExecutable: Self.serverExecutableName) else {
                throw ServerError.binaryNotFound(Bundle.main.bundleURL.appendingPathComponent("Contents/MacOS/\(Self.serverExecutableName)"))
            }
            ServerProcess.terminateOrphan(pidFile: paths.pidFile, executable: executable)

            // Keychain access may block on an authorization prompt (e.g. after an ad-hoc signed rebuild).
            windowController?.showStatus("Aguardando acesso ao Keychain…")
            let keyStore = EncryptionKeyStore(service: Bundle.main.bundleIdentifier ?? "com.dbclient.desktop")
            let existingDatabase = paths.hasExistingDatabase ? paths.database : nil
            let key = try await Task.detached { try keyStore.loadOrCreate(existingDatabase: existingDatabase) }.value
            windowController?.showStatus("Iniciando o servidor…")

            guard let port = PortAllocator.preferredPort() else {
                throw ServerError.noFreePort
            }

            let server = try ServerProcess(executable: executable, port: port, encryptionKey: key, paths: paths)
            server.onUnexpectedExit = { [weak self] status in self?.serverDidExitUnexpectedly(status: status) }
            self.server = server
            try server.start()
            try await server.waitUntilHealthy()

            windowController?.load(server.signInURL)
        } catch {
            presentFatal(title: "Não foi possível iniciar o DBClient", error: error)
        }
    }

    // Replacing the bundle in /Applications needs App Management consent on unsigned builds, so the
    // downloaded DMG is opened for the user to drag the app instead.
    @MainActor
    private func downloadUpdate(version: String) async {
        guard !updating, let paths else { return }
        updating = true
        defer { updating = false }

        windowController?.notifyUpdate(state: "downloading")
        do {
            let dmg = try await UpdateDownloader(directory: paths.updatesDir).download(version: version)
            NSWorkspace.shared.open(dmg)
            windowController?.notifyUpdate(state: "ready")
        } catch {
            windowController?.notifyUpdate(state: "failed", message: error.localizedDescription)
        }
    }

    private func serverDidExitUnexpectedly(status: Int32) {
        let alert = NSAlert()
        alert.alertStyle = .critical
        alert.messageText = "O servidor do DBClient foi encerrado inesperadamente"
        alert.informativeText = "Código de saída \(status). Detalhes em \(paths?.serverLog.path ?? "~/Library/Logs/DBClient")."
        alert.addButton(withTitle: "Reiniciar")
        alert.addButton(withTitle: "Sair")
        alert.addButton(withTitle: "Abrir logs")

        switch alert.runModal() {
        case .alertFirstButtonReturn:
            Task { @MainActor in await startServer() }
        case .alertThirdButtonReturn:
            openLogs(nil)
            NSApp.terminate(nil)
        default:
            NSApp.terminate(nil)
        }
    }

    private func presentFatal(title: String, error: Error) {
        let alert = NSAlert()
        alert.alertStyle = .critical
        alert.messageText = title
        alert.informativeText = error.localizedDescription
        alert.addButton(withTitle: "Sair")
        alert.addButton(withTitle: "Abrir logs")
        if alert.runModal() == .alertSecondButtonReturn {
            openLogs(nil)
        }
        NSApp.terminate(nil)
    }

    // MARK: - Menu actions

    @objc func reloadPage(_ sender: Any?) {
        windowController?.reload()
    }

    @objc func zoomIn(_ sender: Any?) {
        windowController?.zoom(by: 0.1)
    }

    @objc func zoomOut(_ sender: Any?) {
        windowController?.zoom(by: -0.1)
    }

    @objc func resetZoom(_ sender: Any?) {
        windowController?.resetZoom()
    }

    // The browser has no session cookie of its own, so it goes through the local sign-in as well.
    @objc func openInBrowser(_ sender: Any?) {
        guard let url = server?.signInURL else { return }
        NSWorkspace.shared.open(url)
    }

    @objc func openLogs(_ sender: Any?) {
        let logs = paths?.logsDir ?? FileManager.default.homeDirectoryForCurrentUser.appendingPathComponent("Library/Logs/DBClient")
        NSWorkspace.shared.open(logs)
    }

    @objc func openDataFolder(_ sender: Any?) {
        guard let dataDir = paths?.dataDir else { return }
        NSWorkspace.shared.open(dataDir)
    }
}
