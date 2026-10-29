import CryptoKit
import Foundation

enum UpdateError: LocalizedError {
    case invalidVersion(String)
    case httpStatus(URL, Int)
    case checksumMissing
    case checksumMismatch

    var errorDescription: String? {
        switch self {
        case .invalidVersion(let version):
            return "Versão inválida: \(version)."
        case .httpStatus(let url, let status):
            return "Download de \(url.lastPathComponent) falhou (HTTP \(status))."
        case .checksumMissing:
            return "O release não publica o SHA-256 do instalador."
        case .checksumMismatch:
            return "O instalador baixado não confere com o SHA-256 publicado."
        }
    }
}

// The download URL is built here from a validated version, never taken from the page.
struct UpdateDownloader {
    private static let releaseBase = URL(string: "https://github.com/barbosa-leo/dbclient/releases/download")!
    private static let asset = "DBClient-macOS.dmg"
    private static let checksums = "SHA256SUMS"

    let directory: URL

    func download(version: String) async throws -> URL {
        guard version.range(of: #"^\d+\.\d+\.\d+$"#, options: .regularExpression) != nil else {
            throw UpdateError.invalidVersion(version)
        }
        let base = Self.releaseBase.appendingPathComponent("v\(version)")

        let expected = try await checksum(from: base.appendingPathComponent(Self.checksums))
        let assetURL = base.appendingPathComponent(Self.asset)
        let (downloaded, response) = try await URLSession.shared.download(from: assetURL)
        try Self.requireOK(response, url: assetURL)

        let digest = SHA256.hash(data: try Data(contentsOf: downloaded, options: .mappedIfSafe))
        guard digest.map({ String(format: "%02x", $0) }).joined() == expected else {
            try? FileManager.default.removeItem(at: downloaded)
            throw UpdateError.checksumMismatch
        }

        let destination = directory.appendingPathComponent("DBClient-\(version).dmg")
        try? FileManager.default.removeItem(at: destination)
        try FileManager.default.moveItem(at: downloaded, to: destination)
        return destination
    }

    private func checksum(from url: URL) async throws -> String {
        let (data, response) = try await URLSession.shared.data(from: url)
        try Self.requireOK(response, url: url)
        for line in String(decoding: data, as: UTF8.self).split(whereSeparator: \.isNewline) {
            let fields = line.split(whereSeparator: \.isWhitespace)
            if fields.count == 2, fields[1].trimmingPrefix("*") == Self.asset {
                return fields[0].lowercased()
            }
        }
        throw UpdateError.checksumMissing
    }

    private static func requireOK(_ response: URLResponse, url: URL) throws {
        let status = (response as? HTTPURLResponse)?.statusCode ?? 0
        guard status == 200 else {
            throw UpdateError.httpStatus(url, status)
        }
    }
}
