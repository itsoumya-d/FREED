import Foundation

// Boundary injection exercises the production transactional adapter; never uses Mac Keychain.
final class FriendLockMemoryBytes: FriendLockProtectedBytes {
    var values: [String: Data] = [:]
    var failWriteKey: String?
    var failReadAfterRecordWrite = false
    var readFailureArmed = false
    var recordWrites = 0
    var failReadOnRecordWrite: Int?
    var failRecordWrites: Set<Int> = []
    var journalWrites = 0
    var failAfterJournalWrite: Int?
    var unavailable = false
    func read(_ key: String) throws -> Data? {
        if unavailable { throw FriendLockFailure.storageUnavailable }
        if key == "record", readFailureArmed {
            readFailureArmed = false
            throw FriendLockFailure.storageUnavailable
        }
        return values[key]
    }
    func write(_ key: String, _ data: Data) throws {
        if unavailable { throw FriendLockFailure.storageUnavailable }
        if key == failWriteKey { failWriteKey = nil; throw FriendLockFailure.storageUnavailable }
        if key == "record" { recordWrites += 1; if failRecordWrites.contains(recordWrites) { throw FriendLockFailure.storageUnavailable } }
        values[key] = data
        if key == "journal" { journalWrites += 1; if failAfterJournalWrite == journalWrites { unavailable = true } }
        if key == "record", failReadAfterRecordWrite || failReadOnRecordWrite == recordWrites {
            failReadAfterRecordWrite = false; readFailureArmed = true
        }
    }
    func remove(_ key: String) throws {
        if unavailable { throw FriendLockFailure.storageUnavailable }
        values.removeValue(forKey: key)
    }
}

final class FriendLockTestClock: FriendLockClock {
    var milliseconds: Int64 = 1_000
    var session = "fixture-process-1"
    func now() -> FriendLockInstant { FriendLockInstant(session: session, milliseconds: milliseconds) }
}

func friendExpect(_ value: Bool, _ name: String) throws {
    if !value { throw NSError(domain: "friend-lock-fixture", code: 1, userInfo: [NSLocalizedDescriptionKey: name]) }
}

@main struct FriendLockCoreCases {
    static func rejects(_ expected: FriendLockFailure, _ operation: () async throws -> Void) async throws {
        do { try await operation(); throw NSError(domain: "expected-failure", code: 1) }
        catch let failure as FriendLockFailure { try friendExpect(failure == expected, "expected \(expected), got \(failure)") }
    }
    static func main() async throws {
        try friendLockAdapterCases()
        let vector = try FriendLockNativeCrypto().derive("123456", salt: Data(repeating: 7, count: 16)).map { String(format: "%02x", $0) }.joined()
        try friendExpect(vector == "0be74e7558e56becceb023ea559588f19bcffe4e9e5ef85d75e02917f383522d", "PBKDF2 SHA256 600000 known vector")
        let bytes = FriendLockMemoryBytes()
        let store = FriendLockRecordStore(bytes: bytes)
        let clock = FriendLockTestClock()
        let core = FriendLockCore(store: store, crypto: FriendLockNativeCrypto(), clock: clock)
        let context = try FriendLockConfiguration(revision: "adult-7", mutationGeneration: "generation-12")
        let change = try FriendLockAdultChange(action: .disableEncryptedDNS, fields: ["provider": "cloudflare-families", "enabled": "false"])
        let baseline = FriendLockBaseline(configuration: context, adultProtectionInstalled: true, nativeReadback: Data("native-filter-installed".utf8))

        try friendExpect(try await core.status() == .notEnrolled, "fresh native state")
        try await rejects(.invalidPIN) { _ = try await core.enroll(pin: "１２３４５６", confirmation: "１２３４５６", baseline: baseline) }
        try await rejects(.pinMismatch) { _ = try await core.enroll(pin: "123456", confirmation: "123457", baseline: baseline) }
        try friendExpect(bytes.values.isEmpty, "invalid enrollment must not mutate")
        let enrolled = try await core.enroll(pin: "123456", confirmation: "123456", baseline: baseline)
        try friendExpect(enrolled.recoveryKey.count == 64 && enrolled.lockRevision == 1, "native enrollment receipt")
        try friendExpect(!(bytes.values["record"]?.range(of: Data("123456".utf8)) != nil), "PIN absent from record")
        try friendExpect(!(bytes.values["record"]?.range(of: Data(enrolled.recoveryKey.utf8)) != nil), "recovery key absent from record")

        let request = try await core.prepare(change: change, configuration: context)
        try await rejects(.invalidTransition) { _ = try await core.claim(operationID: request.operationID, change: change, configuration: context) }
        for _ in 0..<5 { try await rejects(.incorrectSecret) { _ = try await core.authorize(pin: "000000", change: change, configuration: context, operationID: request.operationID) } }
        try await rejects(.throttled) { _ = try await core.authorize(pin: "123456", change: change, configuration: context) }
        clock.session = "fixture-process-2"; clock.milliseconds = 0
        let reopened = FriendLockCore(store: FriendLockRecordStore(bytes: bytes), crypto: FriendLockNativeCrypto(), clock: clock)
        try await rejects(.throttled) { _ = try await reopened.authorize(pin: "123456", change: change, configuration: context) }
        clock.milliseconds = 59_999
        try await rejects(.throttled) { _ = try await reopened.authorize(pin: "123456", change: change, configuration: context) }
        clock.milliseconds = 60_000
        let receipt = try await reopened.authorize(pin: "123456", change: change, configuration: context, operationID: request.operationID)
        let authRetry = try await reopened.authorize(pin: "000000", change: change, configuration: context, operationID: request.operationID)
        try friendExpect(authRetry == receipt, "lost authorization response retries exact operation without a second grant")
        let claimed = try await reopened.claim(operationID: receipt.operationID, change: change, configuration: context)
        try friendExpect(claimed.state == .inFlight, "claim is durable")
        let retry = try await reopened.retry(operationID: receipt.operationID, change: change, configuration: context)
        try friendExpect(retry == claimed, "same operation exact retry")
        let other = try FriendLockAdultChange(action: .disableEncryptedDNS, fields: ["enabled": "true", "provider": "cloudflare-families"])
        try await rejects(.scopeMismatch) { _ = try await reopened.retry(operationID: receipt.operationID, change: other, configuration: context) }
        let resultContext = try FriendLockConfiguration(revision: "adult-8", mutationGeneration: "generation-13")
        let completed = try await reopened.complete(operationID: receipt.operationID, change: change, originalConfiguration: context, resultingConfiguration: resultContext, nativeReadback: Data("native-exact-off-readback".utf8))
        let completedRetry = try await reopened.retry(operationID: receipt.operationID, change: change, configuration: resultContext)
        try friendExpect(completedRetry == completed, "completed exact retry preserves receipt")
        try await rejects(.scopeMismatch) { _ = try await reopened.retry(operationID: receipt.operationID, change: change, configuration: context) }

        bytes.failReadOnRecordWrite = bytes.recordWrites + 2 // reservation succeeds, credential rotation readback fails
        try await rejects(.storageUnavailable) { _ = try await reopened.rotate(secret: .recovery(enrolled.recoveryKey), newPIN: "654321", confirmation: "654321") }
        // Failed reservation/rotation must retain old verifier, with no authorization on failure.
        let afterFailedRotation = try await reopened.authorize(pin: "123456", change: change, configuration: resultContext)
        _ = try await reopened.cancel(operationID: afterFailedRotation.operationID)
        let rotated = try await reopened.rotate(secret: .recovery(enrolled.recoveryKey), newPIN: "654321", confirmation: "654321")
        try friendExpect(rotated.lockRevision == 2 && rotated.recoveryKey != enrolled.recoveryKey, "rotation changes code/key/revision")
        try await rejects(.incorrectSecret) { _ = try await reopened.authorize(pin: "123456", change: change, configuration: resultContext) }
        try await rejects(.incorrectSecret) { _ = try await reopened.rotate(secret: .recovery(enrolled.recoveryKey), newPIN: "888888", confirmation: "888888") }
        try await rejects(.unknownOperation) { _ = try await reopened.retry(operationID: receipt.operationID, change: change, configuration: resultContext) }
        let newReceipt = try await reopened.authorize(pin: "654321", change: change, configuration: resultContext)
        try await reopened.invalidateAuthorizations()
        try await rejects(.unknownOperation) { _ = try await reopened.claim(operationID: newReceipt.operationID, change: change, configuration: resultContext) }

        let saved = bytes.values["record"]!
        bytes.values["record"] = nil
        try friendExpect(try await reopened.status() == .missingEnrolled, "missing enrolled record fails closed")
        try await rejects(.missingEnrolled) { _ = try await reopened.authorize(pin: "654321", change: change, configuration: resultContext) }
        bytes.values["record"] = Data([0, 1, 2])
        try friendExpect(try await reopened.status() == .corrupt, "corruption distinct from no enrollment")
        bytes.values["record"] = saved
        bytes.failWriteKey = "record"
        try await rejects(.storageUnavailable) { _ = try await reopened.authorize(pin: "654321", change: change, configuration: resultContext) }
        let retryAfterStoreFailure = try await reopened.authorize(pin: "654321", change: change, configuration: resultContext)
        _ = try await reopened.cancel(operationID: retryAfterStoreFailure.operationID)
        try await rejects(.cancelled) { _ = try await reopened.claim(operationID: retryAfterStoreFailure.operationID, change: change, configuration: resultContext) }
        // Persistent journal rolls back after an interrupted write and a failed immediate rollback.
        let beforeInterrupted = try FriendLockRecordStore(bytes: bytes).load()!
        bytes.failReadOnRecordWrite = bytes.recordWrites + 1
        bytes.failRecordWrites = [bytes.recordWrites + 2]
        try await rejects(.storageUnavailable) { _ = try await reopened.authorize(pin: "654321", change: change, configuration: resultContext) }
        let recovered = try FriendLockRecordStore(bytes: bytes).load()!
        try friendExpect(recovered.lockRevision == beforeInterrupted.lockRevision && recovered.pinThrottle.failures == beforeInterrupted.pinThrottle.failures, "journal rollback retains previous credentials and counters")
        let setupBytes = FriendLockMemoryBytes(); setupBytes.failWriteKey = "record"
        let interruptedSetup = FriendLockCore(store: FriendLockRecordStore(bytes: setupBytes), crypto: FriendLockNativeCrypto(), clock: clock)
        try await rejects(.storageUnavailable) { _ = try await interruptedSetup.enroll(pin: "123456", confirmation: "123456", baseline: baseline) }
        try friendExpect(try await interruptedSetup.status() == .missingEnrolled, "interrupted enrollment remains fail closed")
        try await supplementalCases(baseline: baseline, change: change, context: context)
        try await commitOutageCases(baseline: baseline, change: change, context: context)
        print("PASS friend-lock Swift policy/store failure fixtures (source only; no device or native mutation enforcement)")
    }
    static func supplementalCases(baseline: FriendLockBaseline, change: FriendLockAdultChange, context: FriendLockConfiguration) async throws {
        let bytes = FriendLockMemoryBytes(), clock = FriendLockTestClock()
        let store = FriendLockRecordStore(bytes: bytes)
        let core = FriendLockCore(store: store, crypto: FriendLockNativeCrypto(), clock: clock)
        let disabled = FriendLockBaseline(configuration: context, adultProtectionInstalled: false, nativeReadback: Data([1]))
        try await rejects(.baselineUnavailable) { _ = try await core.enroll(pin: "123456", confirmation: "123456", baseline: disabled) }
        let enrollment = try await core.enroll(pin: "123456", confirmation: "123456", baseline: baseline)
        try await rejects(.invalidPIN) { _ = try await core.rotate(secret: .recovery(enrollment.recoveryKey), newPIN: "123456", confirmation: "123456") }
        let request = try await core.prepare(change: change, configuration: context)
        let newer = try FriendLockConfiguration(revision: "adult-repair-8", mutationGeneration: "repair-generation-13")
        try await rejects(.scopeMismatch) { _ = try await core.authorize(pin: "123456", change: change, configuration: newer, operationID: request.operationID) }
        let delays: [Int64] = [0, 0, 0, 0, 60_000, 300_000, 900_000, 3_600_000, 3_600_000]
        for delay in delays {
            try await rejects(.incorrectSecret) { _ = try await core.authorize(pin: "bad", change: change, configuration: context, operationID: request.operationID) }
            try friendExpect(try store.load()!.pinThrottle.remainingMilliseconds == delay, "persistent PIN escalation")
            if delay > 0 { try await rejects(.throttled) { _ = try await core.authorize(pin: "123456", change: change, configuration: context, operationID: request.operationID) } }
            clock.milliseconds += delay
        }
        async let first = core.authorize(pin: "123456", change: change, configuration: context, operationID: request.operationID)
        async let second = core.authorize(pin: "123456", change: change, configuration: context, operationID: request.operationID)
        let firstResult = try await first
        let secondResult = try await second
        try friendExpect(secondResult == firstResult, "concurrent exact authorization receipt")
        let exact = try await core.authorize(pin: "000000", change: change, configuration: context, operationID: request.operationID)
        try friendExpect(exact == firstResult, "authorization exact retry")
        for _ in 0..<4 { try await rejects(.incorrectSecret) { _ = try await core.rotate(secret: .recovery(String(repeating: "0", count: 64)), newPIN: "654321", confirmation: "654321") } }
        // A prior same-code rotation attempt also consumed the recovery throttle.
        try await rejects(.throttled) { _ = try await core.rotate(secret: .recovery(enrollment.recoveryKey), newPIN: "654321", confirmation: "654321") }
        clock.milliseconds += 60_000
        try await rejects(.incorrectSecret) { _ = try await core.rotate(secret: .recovery(String(repeating: "0", count: 64)), newPIN: "654321", confirmation: "654321") }
        try await rejects(.throttled) { _ = try await core.rotate(secret: .recovery(enrollment.recoveryKey), newPIN: "654321", confirmation: "654321") }
        clock.milliseconds += 300_000
        _ = try await core.rotate(secret: .recovery(enrollment.recoveryKey), newPIN: "654321", confirmation: "654321")
        for _ in 0..<32 { _ = try await core.prepare(change: change, configuration: context) }
        try await rejects(.authorizationCapacity) { _ = try await core.prepare(change: change, configuration: context) }
        try await core.invalidateAuthorizations()
        try friendExpect(try store.load()!.operations.isEmpty, "native generation invalidation reclaims bounded receipts")
        bytes.unavailable = true
        try friendExpect(try await core.status() == .unavailable, "unavailable store status")
        try await rejects(.storageUnavailable) { _ = try await core.authorize(pin: "654321", change: change, configuration: context) }
        bytes.unavailable = false
        let saved = bytes.values["record"]!
        bytes.values["record"] = Data(repeating: 0, count: 65_537)
        try friendExpect(try await core.status() == .corrupt, "bounded record overflow")
        bytes.values["record"] = saved
    }
    static func commitOutageCases(baseline: FriendLockBaseline, change: FriendLockAdultChange, context: FriendLockConfiguration) async throws {
        let bytes = FriendLockMemoryBytes(), clock = FriendLockTestClock()
        let core = FriendLockCore(store: FriendLockRecordStore(bytes: bytes), crypto: FriendLockNativeCrypto(), clock: clock)
        let first = try await core.enroll(pin: "123456", confirmation: "123456", baseline: baseline)
        let previous = bytes.values["record"]!
        bytes.failAfterJournalWrite = bytes.journalWrites + 4 // reservation commit, then rotation committed-phase write
        try await rejects(.commitOutcomeUnknown) { _ = try await core.rotate(secret: .recovery(first.recoveryKey), newPIN: "654321", confirmation: "654321") }
        try friendExpect(try await core.status() == .unavailable, "unreadable final outcome fails closed")
        bytes.unavailable = false
        let retained = bytes.values["journal"]!
        let json = try JSONSerialization.jsonObject(with: retained) as! [String: Any]
        let old = Data(base64Encoded: json["previous"] as! String)!
        let oldRecord = try JSONDecoder().decode(FriendLockRecord.self, from: old)
        let original = try JSONDecoder().decode(FriendLockRecord.self, from: previous)
        try friendExpect(oldRecord.pin.derived == original.pin.derived && json["phase"] as? String == "committed", "committed journal retains prior credential")
        let reopened = FriendLockCore(store: FriendLockRecordStore(bytes: bytes), crypto: FriendLockNativeCrypto(), clock: clock)
        try friendExpect(try await reopened.status() == .enrolled, "restart resolves committed outcome by native readback")
        try await rejects(.incorrectSecret) { _ = try await reopened.authorize(pin: "123456", change: change, configuration: context) }
        _ = try await reopened.authorize(pin: "654321", change: change, configuration: context)
        // Lost one-time recovery response is replaced using the submitted new PIN, without filtering changes.
        let recovered = try await reopened.rotate(secret: .pin("654321"), newPIN: "777777", confirmation: "777777")
        try friendExpect(recovered.lockRevision == 3 && recovered.recoveryKey.count == 64, "PIN rotation repairs lost key presentation")
    }
}
