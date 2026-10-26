import Darwin
import Foundation

// The web UI keeps state in localStorage, which is scoped by origin (including the port),
// so the same port is reused across launches whenever it is free.
enum PortAllocator {
    private static let defaultsKey = "serverPort"

    static func preferredPort() -> Int? {
        let defaults = UserDefaults.standard
        let stored = defaults.integer(forKey: defaultsKey)
        if stored > 0, bind(port: UInt16(stored)) != nil {
            return stored
        }
        guard let port = bind(port: 0) else {
            return nil
        }
        defaults.set(port, forKey: defaultsKey)
        return port
    }

    private static func bind(port: UInt16) -> Int? {
        let fd = socket(AF_INET, SOCK_STREAM, 0)
        guard fd >= 0 else {
            return nil
        }
        defer { close(fd) }

        // Go listeners set SO_REUSEADDR, so ports left in TIME_WAIT by the previous server are still usable.
        var reuse: Int32 = 1
        setsockopt(fd, SOL_SOCKET, SO_REUSEADDR, &reuse, socklen_t(MemoryLayout<Int32>.size))

        var addr = sockaddr_in()
        addr.sin_len = UInt8(MemoryLayout<sockaddr_in>.size)
        addr.sin_family = sa_family_t(AF_INET)
        addr.sin_port = port.bigEndian
        addr.sin_addr.s_addr = inet_addr("127.0.0.1")

        var length = socklen_t(MemoryLayout<sockaddr_in>.size)
        let bound = withUnsafeMutablePointer(to: &addr) {
            $0.withMemoryRebound(to: sockaddr.self, capacity: 1) { pointer in
                Darwin.bind(fd, pointer, length) == 0 && getsockname(fd, pointer, &length) == 0
            }
        }
        guard bound else {
            return nil
        }
        return Int(UInt16(bigEndian: addr.sin_port))
    }
}
