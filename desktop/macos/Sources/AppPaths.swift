import Foundation

struct AppPaths {
    let dataDir: URL
    let dumpDir: URL
    let logsDir: URL

    var serverLog: URL { logsDir.appendingPathComponent("server.log") }
    var pidFile: URL { dataDir.appendingPathComponent("server.pid") }
    var database: URL { dataDir.appendingPathComponent("dbclient.sqlite") }

    var hasExistingDatabase: Bool {
        FileManager.default.fileExists(atPath: database.path)
    }

    static func standard() throws -> AppPaths {
        let fm = FileManager.default
        let home = fm.homeDirectoryForCurrentUser
        let paths = AppPaths(
            dataDir: home.appendingPathComponent("Library/Application Support/DBClient"),
            dumpDir: home.appendingPathComponent("Library/Caches/DBClient/dumps"),
            logsDir: home.appendingPathComponent("Library/Logs/DBClient")
        )
        for dir in [paths.dataDir, paths.dumpDir, paths.logsDir] {
            try fm.createDirectory(at: dir, withIntermediateDirectories: true, attributes: [.posixPermissions: 0o700])
        }
        return paths
    }
}
