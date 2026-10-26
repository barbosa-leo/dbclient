import Darwin
import Foundation

enum ServerError: LocalizedError {
    case binaryNotFound(URL)
    case noFreePort
    case exitedEarly(Int32)
    case healthTimeout

    var errorDescription: String? {
        switch self {
        case .binaryNotFound(let url):
            return "Binário do servidor não encontrado em \(url.path)."
        case .noFreePort:
            return "Nenhuma porta local disponível para o servidor."
        case .exitedEarly(let status):
            return "O servidor encerrou durante a inicialização (código \(status))."
        case .healthTimeout:
            return "O servidor não respondeu ao health check a tempo."
        }
    }
}

final class ServerProcess {
    // Finder launches apps with a minimal PATH, so pg_dump/psql from Homebrew or Postgres.app would not be found.
    private static let searchPath = [
        "/opt/homebrew/opt/libpq/bin",
        "/opt/homebrew/bin",
        "/usr/local/opt/libpq/bin",
        "/usr/local/bin",
        "/Applications/Postgres.app/Contents/Versions/latest/bin",
        "/usr/bin",
        "/bin",
        "/usr/sbin",
        "/sbin",
    ].joined(separator: ":")

    private static let shutdownGrace: TimeInterval = 10
    private static let maxLogBytes = 10 * 1024 * 1024

    let baseURL: URL
    var onUnexpectedExit: ((Int32) -> Void)?

    private let process = Process()
    private let pidFile: URL
    private var stopCompletion: (() -> Void)?
    private var stopping = false

    var isRunning: Bool { process.isRunning }

    init(executable: URL, port: Int, encryptionKey: String, paths: AppPaths) throws {
        guard FileManager.default.isExecutableFile(atPath: executable.path) else {
            throw ServerError.binaryNotFound(executable)
        }

        baseURL = URL(string: "http://127.0.0.1:\(port)")!
        pidFile = paths.pidFile

        var environment = ProcessInfo.processInfo.environment
        environment["PATH"] = Self.searchPath
        environment["DBCLIENT_ENCRYPTION_KEY"] = encryptionKey
        environment["DBCLIENT_ADDR"] = "127.0.0.1:\(port)"
        environment["DBCLIENT_DATA_DIR"] = paths.dataDir.path
        environment["DBCLIENT_DUMP_DIR"] = paths.dumpDir.path

        let log = try Self.openLog(at: paths.serverLog)
        process.executableURL = executable
        process.environment = environment
        process.standardOutput = log
        process.standardError = log
        process.standardInput = FileHandle.nullDevice
        process.terminationHandler = { [weak self] finished in
            let status = finished.terminationStatus
            DispatchQueue.main.async { self?.didTerminate(status: status) }
        }
    }

    func start() throws {
        try process.run()
        try? String(process.processIdentifier).write(to: pidFile, atomically: true, encoding: .utf8)
    }

    func waitUntilHealthy(timeout: TimeInterval = 30) async throws {
        let configuration = URLSessionConfiguration.ephemeral
        configuration.timeoutIntervalForRequest = 1
        let session = URLSession(configuration: configuration)
        defer { session.invalidateAndCancel() }

        let healthURL = baseURL.appendingPathComponent("healthz")
        let deadline = Date().addingTimeInterval(timeout)
        while Date() < deadline {
            guard process.isRunning else {
                throw ServerError.exitedEarly(process.terminationStatus)
            }
            if let (_, response) = try? await session.data(from: healthURL),
               (response as? HTTPURLResponse)?.statusCode == 200 {
                return
            }
            try await Task.sleep(nanoseconds: 200_000_000)
        }
        throw ServerError.healthTimeout
    }

    func stop(completion: @escaping () -> Void) {
        guard process.isRunning else {
            completion()
            return
        }
        stopping = true
        stopCompletion = completion
        process.terminate()

        let pid = process.processIdentifier
        DispatchQueue.main.asyncAfter(deadline: .now() + Self.shutdownGrace) { [weak self] in
            guard let self, self.process.isRunning else { return }
            kill(pid, SIGKILL)
        }
    }

    private func didTerminate(status: Int32) {
        try? FileManager.default.removeItem(at: pidFile)
        if stopping {
            stopCompletion?()
            stopCompletion = nil
            return
        }
        onUnexpectedExit?(status)
    }

    private static func openLog(at url: URL) throws -> FileHandle {
        let fm = FileManager.default
        if let size = (try? fm.attributesOfItem(atPath: url.path))?[.size] as? Int, size > maxLogBytes {
            let rotated = url.appendingPathExtension("1")
            try? fm.removeItem(at: rotated)
            try? fm.moveItem(at: url, to: rotated)
        }
        if !fm.fileExists(atPath: url.path) {
            fm.createFile(atPath: url.path, contents: nil, attributes: [.posixPermissions: 0o600])
        }
        let handle = try FileHandle(forWritingTo: url)
        handle.seekToEndOfFile()
        return handle
    }

    // A crash or force quit of the shell leaves the server orphaned and holding the port.
    static func terminateOrphan(pidFile: URL, executable: URL) {
        defer { try? FileManager.default.removeItem(at: pidFile) }
        guard let raw = try? String(contentsOf: pidFile, encoding: .utf8),
              let pid = pid_t(raw.trimmingCharacters(in: .whitespacesAndNewlines)),
              executablePath(of: pid) == executable.resolvingSymlinksInPath().path else {
            return
        }
        kill(pid, SIGTERM)
        for _ in 0..<50 where kill(pid, 0) == 0 {
            usleep(100_000)
        }
        if kill(pid, 0) == 0 {
            kill(pid, SIGKILL)
        }
    }

    private static func executablePath(of pid: pid_t) -> String? {
        var buffer = [CChar](repeating: 0, count: 4 * Int(MAXPATHLEN))
        let length = proc_pidpath(pid, &buffer, UInt32(buffer.count))
        guard length > 0 else {
            return nil
        }
        return URL(fileURLWithPath: String(cString: buffer)).resolvingSymlinksInPath().path
    }
}
