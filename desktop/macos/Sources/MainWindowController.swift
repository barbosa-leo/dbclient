import AppKit
import WebKit

final class MainWindowController: NSWindowController, WKNavigationDelegate, WKUIDelegate, WKDownloadDelegate,
    WKScriptMessageHandler
{
    private static let bridgeName = "dbclientDesktop"
    private static let bridgeScript = """
        window.dbclientDesktop = {
          platform: 'macos',
          installUpdate: function (version) {
            window.webkit.messageHandlers.dbclientDesktop.postMessage({ action: 'installUpdate', version: version });
          },
        };
        """

    private let webView: WKWebView
    private var origin: URL?
    var onInstallUpdate: ((String) -> Void)?

    init() {
        let configuration = WKWebViewConfiguration()
        configuration.websiteDataStore = .default()
        configuration.userContentController.addUserScript(
            WKUserScript(source: Self.bridgeScript, injectionTime: .atDocumentStart, forMainFrameOnly: true)
        )
        webView = WKWebView(frame: .zero, configuration: configuration)

        let window = NSWindow(
            contentRect: NSRect(x: 0, y: 0, width: 1280, height: 820),
            styleMask: [.titled, .closable, .miniaturizable, .resizable],
            backing: .buffered,
            defer: false
        )
        window.title = "DBClient"
        window.minSize = NSSize(width: 900, height: 600)
        window.contentView = webView
        window.center()
        window.setFrameAutosaveName("MainWindow")

        super.init(window: window)

        webView.navigationDelegate = self
        webView.uiDelegate = self
        webView.allowsBackForwardNavigationGestures = false
        configuration.userContentController.add(self, name: Self.bridgeName)
    }

    required init?(coder: NSCoder) {
        nil
    }

    func showStatus(_ message: String) {
        webView.loadHTMLString(StatusPage.html(message: message), baseURL: nil)
    }

    func load(_ url: URL) {
        origin = url
        webView.load(URLRequest(url: url))
    }

    func reload() {
        webView.reload()
    }

    func zoom(by delta: CGFloat) {
        webView.pageZoom = min(max(webView.pageZoom + delta, 0.5), 3)
    }

    func resetZoom() {
        webView.pageZoom = 1
    }

    func notifyUpdate(state: String, message: String? = nil) {
        var detail = ["state": state]
        detail["message"] = message
        guard let json = try? JSONSerialization.data(withJSONObject: detail),
              let detailJSON = String(data: json, encoding: .utf8)
        else { return }
        webView.evaluateJavaScript(
            "window.dispatchEvent(new CustomEvent('dbclient-desktop-update', { detail: \(detailJSON) }));"
        )
    }

    private func isInternal(_ url: URL) -> Bool {
        if ["about", "blob", "data"].contains(url.scheme) {
            return true
        }
        guard let origin else {
            return false
        }
        return url.scheme == origin.scheme && url.host == origin.host && url.port == origin.port
    }

    private func isAttachment(_ response: URLResponse) -> Bool {
        let disposition = (response as? HTTPURLResponse)?.value(forHTTPHeaderField: "Content-Disposition")
        return disposition?.lowercased().hasPrefix("attachment") ?? false
    }

    // MARK: - WKNavigationDelegate

    func webView(
        _ webView: WKWebView,
        decidePolicyFor navigationAction: WKNavigationAction,
        decisionHandler: @escaping @MainActor @Sendable (WKNavigationActionPolicy) -> Void
    ) {
        if navigationAction.shouldPerformDownload {
            decisionHandler(.download)
            return
        }
        guard let url = navigationAction.request.url else {
            decisionHandler(.cancel)
            return
        }
        if isInternal(url) {
            decisionHandler(.allow)
            return
        }
        NSWorkspace.shared.open(url)
        decisionHandler(.cancel)
    }

    func webView(
        _ webView: WKWebView,
        decidePolicyFor navigationResponse: WKNavigationResponse,
        decisionHandler: @escaping @MainActor @Sendable (WKNavigationResponsePolicy) -> Void
    ) {
        if !navigationResponse.canShowMIMEType || isAttachment(navigationResponse.response) {
            decisionHandler(.download)
            return
        }
        decisionHandler(.allow)
    }

    func webView(_ webView: WKWebView, navigationAction: WKNavigationAction, didBecome download: WKDownload) {
        download.delegate = self
    }

    func webView(_ webView: WKWebView, navigationResponse: WKNavigationResponse, didBecome download: WKDownload) {
        download.delegate = self
    }

    func webViewWebContentProcessDidTerminate(_ webView: WKWebView) {
        webView.reload()
    }

    // MARK: - WKScriptMessageHandler

    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        guard message.frameInfo.isMainFrame,
              let url = message.frameInfo.request.url, isInternal(url),
              let body = message.body as? [String: Any],
              body["action"] as? String == "installUpdate",
              let version = body["version"] as? String
        else { return }
        onInstallUpdate?(version)
    }

    // MARK: - WKDownloadDelegate

    func download(
        _ download: WKDownload,
        decideDestinationUsing response: URLResponse,
        suggestedFilename: String,
        completionHandler: @escaping @MainActor @Sendable (URL?) -> Void
    ) {
        guard let window else {
            completionHandler(nil)
            return
        }
        let panel = NSSavePanel()
        panel.nameFieldStringValue = suggestedFilename
        panel.canCreateDirectories = true
        panel.directoryURL = FileManager.default.urls(for: .downloadsDirectory, in: .userDomainMask).first
        panel.beginSheetModal(for: window) { result in
            guard result == .OK, let destination = panel.url else {
                completionHandler(nil)
                return
            }
            // WKDownload refuses to overwrite; the save panel already asked the user to confirm replacement.
            try? FileManager.default.removeItem(at: destination)
            completionHandler(destination)
        }
    }

    func download(_ download: WKDownload, didFailWithError error: Error, resumeData: Data?) {
        guard let window else { return }
        NSAlert(error: error).beginSheetModal(for: window)
    }

    // MARK: - WKUIDelegate

    func webView(
        _ webView: WKWebView,
        createWebViewWith configuration: WKWebViewConfiguration,
        for navigationAction: WKNavigationAction,
        windowFeatures: WKWindowFeatures
    ) -> WKWebView? {
        guard let url = navigationAction.request.url else {
            return nil
        }
        if isInternal(url) {
            webView.load(navigationAction.request)
        } else {
            NSWorkspace.shared.open(url)
        }
        return nil
    }

    func webView(
        _ webView: WKWebView,
        runOpenPanelWith parameters: WKOpenPanelParameters,
        initiatedByFrame frame: WKFrameInfo,
        completionHandler: @escaping @MainActor @Sendable ([URL]?) -> Void
    ) {
        guard let window else {
            completionHandler(nil)
            return
        }
        let panel = NSOpenPanel()
        panel.canChooseFiles = true
        panel.canChooseDirectories = parameters.allowsDirectories
        panel.allowsMultipleSelection = parameters.allowsMultipleSelection
        panel.beginSheetModal(for: window) { result in
            completionHandler(result == .OK ? panel.urls : nil)
        }
    }

    func webView(
        _ webView: WKWebView,
        runJavaScriptAlertPanelWithMessage message: String,
        initiatedByFrame frame: WKFrameInfo,
        completionHandler: @escaping @MainActor @Sendable () -> Void
    ) {
        let alert = NSAlert()
        alert.messageText = message
        alert.addButton(withTitle: "OK")
        presentSheet(alert) { _ in completionHandler() }
    }

    func webView(
        _ webView: WKWebView,
        runJavaScriptConfirmPanelWithMessage message: String,
        initiatedByFrame frame: WKFrameInfo,
        completionHandler: @escaping @MainActor @Sendable (Bool) -> Void
    ) {
        let alert = NSAlert()
        alert.messageText = message
        alert.addButton(withTitle: "OK")
        alert.addButton(withTitle: "Cancelar")
        presentSheet(alert) { completionHandler($0 == .alertFirstButtonReturn) }
    }

    func webView(
        _ webView: WKWebView,
        runJavaScriptTextInputPanelWithPrompt prompt: String,
        defaultText: String?,
        initiatedByFrame frame: WKFrameInfo,
        completionHandler: @escaping @MainActor @Sendable (String?) -> Void
    ) {
        let input = NSTextField(frame: NSRect(x: 0, y: 0, width: 280, height: 24))
        input.stringValue = defaultText ?? ""
        let alert = NSAlert()
        alert.messageText = prompt
        alert.accessoryView = input
        alert.addButton(withTitle: "OK")
        alert.addButton(withTitle: "Cancelar")
        alert.window.initialFirstResponder = input
        presentSheet(alert) { completionHandler($0 == .alertFirstButtonReturn ? input.stringValue : nil) }
    }

    private func presentSheet(_ alert: NSAlert, completion: @escaping (NSApplication.ModalResponse) -> Void) {
        guard let window else {
            completion(alert.runModal())
            return
        }
        alert.beginSheetModal(for: window, completionHandler: completion)
    }
}
