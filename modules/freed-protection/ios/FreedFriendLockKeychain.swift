import Foundation
import Security
import CommonCrypto
import CryptoKit
import Darwin
import LocalAuthentication

struct FriendLockNativeCrypto: FriendLockCrypto {
    func random(_ count: Int) throws -> Data {
        guard (1...64).contains(count) else { throw FriendLockFailure.cryptoUnavailable }
        var bytes = Data(count: count)
        let status = bytes.withUnsafeMutableBytes { SecRandomCopyBytes(kSecRandomDefault, count, $0.baseAddress!) }
        guard status == errSecSuccess else { throw FriendLockFailure.cryptoUnavailable }; return bytes
    }
    func digest(_ data: Data) throws -> Data { Data(SHA256.hash(data: data)) }
    func derive(_ secret: String, salt: Data) throws -> Data {
        guard salt.count == 16, !secret.isEmpty, secret.utf8.count <= 64 else { throw FriendLockFailure.cryptoUnavailable }
        var input = Data(secret.utf8), output = Data(count: 32)
        defer { input.resetBytes(in: 0..<input.count) }
        let status = input.withUnsafeBytes { password in
            salt.withUnsafeBytes { saltBytes in
                output.withUnsafeMutableBytes { result in
                    CCKeyDerivationPBKDF(CCPBKDFAlgorithm(kCCPBKDF2), password.baseAddress!.assumingMemoryBound(to: Int8.self), input.count,
                        saltBytes.baseAddress!.assumingMemoryBound(to: UInt8.self), salt.count,
                        CCPseudoRandomAlgorithm(kCCPRFHmacAlgSHA256), 600_000,
                        result.baseAddress!.assumingMemoryBound(to: UInt8.self), result.count)
                }
            }
        }
        guard status == kCCSuccess else { throw FriendLockFailure.cryptoUnavailable }; return output
    }
}

// Inject only public platform I/O. Fixtures never instantiate SystemKeychainAPI.
struct FriendLockKeychainItem { let data: Data; let thisDeviceOnly: Bool; let synchronizable: Bool }
protocol FriendLockKeychainAPI {
    func read(service: String, account: String) throws -> FriendLockKeychainItem?
    func write(service: String, account: String, data: Data) throws
    func remove(service: String, account: String) throws
}
protocol FriendLockStorageAccess { func begin() throws; func end() }
final class FriendLockNativeStorageAccess: FriendLockStorageAccess {
    private let directory: URL
    private var descriptor: Int32 = -1
    init() throws {
        guard let base = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask).first else { throw FriendLockFailure.storageUnavailable }
        directory = base.appendingPathComponent("FreedDeviceAdultSecurity", isDirectory: true)
    }
    func begin() throws {
        do {
            try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
            var location = directory; var resource = URLResourceValues(); resource.isExcludedFromBackup = true; try location.setResourceValues(resource)
            #if os(iOS)
            try FileManager.default.setAttributes([.protectionKey: FileProtectionType.completeUntilFirstUserAuthentication], ofItemAtPath: directory.path)
            #endif
            descriptor = open(directory.appendingPathComponent("transaction.lock").path, O_CREAT | O_RDWR | O_NOFOLLOW, S_IRUSR | S_IWUSR)
            guard descriptor >= 0, flock(descriptor, LOCK_EX | LOCK_NB) == 0 else { if descriptor >= 0 { close(descriptor) }; descriptor = -1; throw FriendLockFailure.storageUnavailable }
        } catch { throw FriendLockFailure.storageUnavailable }
    }
    func end() { if descriptor >= 0 { flock(descriptor, LOCK_UN); close(descriptor); descriptor = -1 } }
}
struct FriendLockSystemKeychainAPI: FriendLockKeychainAPI {
    private func query(service: String, account: String) -> [String: Any] {
        let context = LAContext(); context.interactionNotAllowed = true
        return [kSecClass as String: kSecClassGenericPassword, kSecAttrService as String: service,
         kSecAttrAccount as String: account, kSecAttrSynchronizable as String: false,
         kSecUseAuthenticationContext as String: context]
    }
    func read(service: String, account: String) throws -> FriendLockKeychainItem? {
        var request = query(service: service, account: account)
        request[kSecReturnAttributes as String] = true; request[kSecReturnData as String] = true; request[kSecMatchLimit as String] = kSecMatchLimitOne
        var result: CFTypeRef?
        let status = SecItemCopyMatching(request as CFDictionary, &result)
        if status == errSecItemNotFound { return nil }
        guard status == errSecSuccess else { throw FriendLockFailure.storageUnavailable }
        guard let attributes = result as? [String: Any], let data = attributes[kSecValueData as String] as? Data else { throw FriendLockFailure.corrupt }
        return FriendLockKeychainItem(data: data,
            thisDeviceOnly: attributes[kSecAttrAccessible as String] as? String == kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly as String,
            synchronizable: attributes[kSecAttrSynchronizable as String] as? Bool ?? false)
    }
    func write(service: String, account: String, data: Data) throws {
        let request = query(service: service, account: account)
        let attributes: [String: Any] = [kSecValueData as String: data, kSecAttrAccessible as String: kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly]
        var status = SecItemUpdate(request as CFDictionary, attributes as CFDictionary)
        if status == errSecItemNotFound {
            var item = request; item.merge(attributes) { _, new in new }; status = SecItemAdd(item as CFDictionary, nil)
        }
        guard status == errSecSuccess else { throw FriendLockFailure.storageUnavailable }
    }
    func remove(service: String, account: String) throws {
        let status = SecItemDelete(query(service: service, account: account) as CFDictionary)
        guard status == errSecSuccess || status == errSecItemNotFound else { throw FriendLockFailure.storageUnavailable }
    }
}

// Host-only, non-synchronizable, ThisDeviceOnly. No account/access-group/biometric/cloud coupling.
final class FriendLockKeychainBytes: FriendLockProtectedBytes {
    private let service = "app.freed.device-adult.friend-lock.v1"
    private let api: any FriendLockKeychainAPI
    private let access: any FriendLockStorageAccess
    convenience init() throws { self.init(api: FriendLockSystemKeychainAPI(), access: try FriendLockNativeStorageAccess()) }
    init(api: any FriendLockKeychainAPI, access: any FriendLockStorageAccess) { self.api = api; self.access = access }
    private func validate(_ key: String) throws {
        guard ["witness", "record", "journal"].contains(key) else { throw FriendLockFailure.invalidScope }
    }
    func beginAccess() throws { try access.begin() }
    func endAccess() { access.end() }
    func read(_ key: String) throws -> Data? {
        try validate(key)
        guard let item = try api.read(service: service, account: key) else { return nil }
        guard item.thisDeviceOnly, !item.synchronizable, item.data.count <= FriendLockRecordStore.maximumJournalBytes else { throw FriendLockFailure.corrupt }
        return item.data
    }
    func write(_ key: String, _ data: Data) throws {
        try validate(key)
        guard data.count <= FriendLockRecordStore.maximumJournalBytes else { throw FriendLockFailure.corrupt }
        try api.write(service: service, account: key, data: data)
    }
    func remove(_ key: String) throws {
        try validate(key); guard key != "witness" else { throw FriendLockFailure.invalidScope }
        try api.remove(service: service, account: key)
    }
}
