import Foundation

final class FriendLockFixtureKeychainAPI: FriendLockKeychainAPI {
    var values: [String: FriendLockKeychainItem] = [:]
    var unavailable = false
    var wrongAccessibility = false
    func read(service: String, account: String) throws -> FriendLockKeychainItem? {
        if unavailable { throw FriendLockFailure.storageUnavailable }
        guard let item = values[account] else { return nil }
        return wrongAccessibility ? FriendLockKeychainItem(data: item.data, thisDeviceOnly: false, synchronizable: false) : item
    }
    func write(service: String, account: String, data: Data) throws {
        if unavailable { throw FriendLockFailure.storageUnavailable }
        values[account] = FriendLockKeychainItem(data: data, thisDeviceOnly: true, synchronizable: false)
    }
    func remove(service: String, account: String) throws { values.removeValue(forKey: account) }
}
struct FriendLockFixtureAccess: FriendLockStorageAccess { func begin() throws {} ; func end() {} }

func friendLockAdapterCases() throws {
    let api = FriendLockFixtureKeychainAPI()
    let adapter = FriendLockKeychainBytes(api: api, access: FriendLockFixtureAccess())
    try adapter.write("witness", Data([1]))
    try friendExpect(try adapter.read("witness") == Data([1]), "real Keychain adapter native readback")
    api.unavailable = true
    do { _ = try adapter.read("witness"); throw NSError(domain: "expected-failure", code: 1) }
    catch FriendLockFailure.storageUnavailable { }
    api.unavailable = false; api.wrongAccessibility = true
    do { _ = try adapter.read("witness"); throw NSError(domain: "expected-failure", code: 1) }
    catch FriendLockFailure.corrupt { }
    api.wrongAccessibility = false
    do { try adapter.remove("witness"); throw NSError(domain: "expected-failure", code: 1) }
    catch FriendLockFailure.invalidScope { }
}
