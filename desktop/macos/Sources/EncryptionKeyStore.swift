import Foundation
import Security

enum EncryptionKeyError: LocalizedError {
    case keychain(OSStatus)
    case invalidItem
    case randomGeneration(OSStatus)
    case missingKeyForExistingData(URL)

    var errorDescription: String? {
        switch self {
        case .keychain(let status):
            let message = SecCopyErrorMessageString(status, nil) as String? ?? "status \(status)"
            return "Falha ao acessar o Keychain: \(message)"
        case .invalidItem:
            return "O item da chave de criptografia no Keychain está corrompido."
        case .randomGeneration(let status):
            return "Falha ao gerar a chave de criptografia (status \(status))."
        case .missingKeyForExistingData(let database):
            return """
            A chave de criptografia não foi encontrada no Keychain, mas já existe um banco em \(database.path).
            Restaure o item "DBClient" no Keychain ou remova esse diretório para começar do zero \
            (as senhas das conexões salvas serão perdidas).
            """
        }
    }
}

struct EncryptionKeyStore {
    let service: String
    private let account = "encryption-key"

    init(service: String) {
        self.service = service
    }

    // Generating a new key over existing data would silently orphan every stored connection password.
    func loadOrCreate(existingDatabase: URL?) throws -> String {
        if let key = try load() {
            return key
        }
        if let existingDatabase {
            throw EncryptionKeyError.missingKeyForExistingData(existingDatabase)
        }
        let key = try generate()
        try save(key)
        return key
    }

    private var baseQuery: [String: Any] {
        [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
        ]
    }

    private func load() throws -> String? {
        var query = baseQuery
        query[kSecReturnData as String] = true
        query[kSecMatchLimit as String] = kSecMatchLimitOne

        var item: CFTypeRef?
        let status = SecItemCopyMatching(query as CFDictionary, &item)
        if status == errSecItemNotFound {
            return nil
        }
        guard status == errSecSuccess else {
            throw EncryptionKeyError.keychain(status)
        }
        guard let data = item as? Data, let key = String(data: data, encoding: .utf8), !key.isEmpty else {
            throw EncryptionKeyError.invalidItem
        }
        return key
    }

    private func save(_ key: String) throws {
        var query = baseQuery
        query[kSecValueData as String] = Data(key.utf8)
        query[kSecAttrLabel as String] = "DBClient"
        query[kSecAttrDescription as String] = "Chave AES-256 das credenciais de conexão"

        let status = SecItemAdd(query as CFDictionary, nil)
        guard status == errSecSuccess else {
            throw EncryptionKeyError.keychain(status)
        }
    }

    private func generate() throws -> String {
        var bytes = [UInt8](repeating: 0, count: 32)
        let status = SecRandomCopyBytes(kSecRandomDefault, bytes.count, &bytes)
        guard status == errSecSuccess else {
            throw EncryptionKeyError.randomGeneration(status)
        }
        return Data(bytes).base64EncodedString()
    }
}
