import Foundation

// Package A only. None of these methods mutates DNS, adult filtering, account data or app leases.
enum FriendLockFailure: String, Error { case invalidPIN, pinMismatch, invalidScope, baselineUnavailable, alreadyEnrolled, notEnrolled, missingEnrolled, corrupt, storageUnavailable, commitOutcomeUnknown, storageConflict, incorrectSecret, throttled, scopeMismatch, unknownOperation, cancelled, authorizationCapacity, invalidTransition, cryptoUnavailable }
enum FriendLockStatus: String { case notEnrolled, enrolled, missingEnrolled, corrupt, unavailable }
enum FriendLockAction: String, Codable { case disableAdultFilter, disableEncryptedDNS, removeAdultDomains, addAdultExceptions, resetAdultProtection, reduceAdultSchedule }
enum FriendLockOperationState: String, Codable { case awaitingSecret, authorized, inFlight, completed, cancelled }

struct FriendLockConfiguration: Codable, Equatable {
    let revision: String
    let mutationGeneration: String
    init(revision: String, mutationGeneration: String) throws {
        guard Self.valid(revision), Self.valid(mutationGeneration) else { throw FriendLockFailure.invalidScope }
        self.revision = revision; self.mutationGeneration = mutationGeneration
    }
    static func valid(_ value: String) -> Bool {
        !value.isEmpty && value.utf8.count <= 128 && value.utf8.allSatisfy { $0 >= 33 && $0 <= 126 }
    }
    var isValid: Bool { Self.valid(revision) && Self.valid(mutationGeneration) }
}

// Integrations build this from the actual native before/desired state, never a JS digest.
struct FriendLockAdultChange {
    let action: FriendLockAction
    private let canonical: Data
    init(action: FriendLockAction, fields: [String: String]) throws {
        guard !fields.isEmpty, fields.count <= 128 else { throw FriendLockFailure.invalidScope }
        var data = Data()
        func append(_ value: String) throws {
            let bytes = Data(value.utf8)
            guard bytes.count <= 4096 else { throw FriendLockFailure.invalidScope }
            var length = UInt32(bytes.count).bigEndian
            withUnsafeBytes(of: &length) { data.append(contentsOf: $0) }; data.append(bytes)
        }
        try append("freed-device-adult-change-v1"); try append(action.rawValue)
        for key in fields.keys.sorted() {
            guard FriendLockConfiguration.valid(key) else { throw FriendLockFailure.invalidScope }
            try append(key); try append(fields[key]!)
        }
        guard data.count <= 32_768 else { throw FriendLockFailure.invalidScope }
        self.action = action; canonical = data
    }
    func digest(using crypto: any FriendLockCrypto) throws -> String { try crypto.digest(canonical).friendHex }
}
struct FriendLockBaseline { let configuration: FriendLockConfiguration; let adultProtectionInstalled: Bool; let nativeReadback: Data }
struct FriendLockEnrollment: CustomStringConvertible, CustomDebugStringConvertible {
    let lockRevision: UInt64
    // One-time presentation to the trusted person. Never log, persist in JS, export or back up.
    let recoveryKey: String
    var description: String { "FriendLockEnrollment(revision: \(lockRevision), recoveryKey: <redacted>)" }
    var debugDescription: String { description }
}
enum FriendLockSecret { case pin(String), recovery(String) }
struct FriendLockInstant { let session: String; let milliseconds: Int64 }
protocol FriendLockClock { func now() -> FriendLockInstant }
final class FriendLockElapsedClock: FriendLockClock {
    private let session = UUID().uuidString
    func now() -> FriendLockInstant { FriendLockInstant(session: session, milliseconds: Int64(ProcessInfo.processInfo.systemUptime * 1_000)) }
}
protocol FriendLockCrypto {
    func random(_ count: Int) throws -> Data
    func digest(_ data: Data) throws -> Data
    func derive(_ secret: String, salt: Data) throws -> Data
}
extension Data {
    fileprivate var friendHex: String { map { String(format: "%02x", $0) }.joined() }
    func friendConstantEquals(_ other: Data) -> Bool {
        guard count == other.count else { return false }
        var difference: UInt8 = 0
        for (left, right) in zip(self, other) { difference |= left ^ right }
        return difference == 0
    }
}
struct FriendLockVerifier: Codable {
    let salt: Data
    let derived: Data
    var isValid: Bool { salt.count == 16 && derived.count == 32 }
}
struct FriendLockThrottle: Codable {
    var failures = 0
    var remainingMilliseconds: Int64 = 0
    var session = ""
    var lastMilliseconds: Int64 = 0
    var isValid: Bool { (0...1_000_000).contains(failures) && (0...3_600_000).contains(remainingMilliseconds) && session.utf8.count <= 128 && lastMilliseconds >= 0 }
    mutating func advance(_ instant: FriendLockInstant) {
        if session == instant.session, instant.milliseconds >= lastMilliseconds {
            remainingMilliseconds = max(0, remainingMilliseconds - min(remainingMilliseconds, instant.milliseconds - lastMilliseconds))
        }
        // A new process/reboot or elapsed-clock rollback retains the entire persisted remainder.
        session = instant.session; lastMilliseconds = max(0, instant.milliseconds)
    }
    mutating func reserve(_ instant: FriendLockInstant) {
        failures = min(1_000_000, failures + 1)
        remainingMilliseconds = failures < 5 ? 0 : failures == 5 ? 60_000 : failures == 6 ? 300_000 : failures == 7 ? 900_000 : 3_600_000
        session = instant.session; lastMilliseconds = max(0, instant.milliseconds)
    }
}
struct FriendLockReceipt: Codable, Equatable {
    let operationID: String
    let deltaDigest: String
    let configuration: FriendLockConfiguration
    let lockRevision: UInt64
    let authorizationGeneration: UInt64
    var state: FriendLockOperationState
    var resultingConfiguration: FriendLockConfiguration?
    var readbackDigest: String?
    var isValid: Bool {
        Self.hex(operationID, 32) && Self.hex(deltaDigest, 64) && configuration.isValid && lockRevision > 0 &&
        (resultingConfiguration?.isValid ?? true) && (readbackDigest.map { Self.hex($0, 64) } ?? true) &&
        (state != .completed || (resultingConfiguration != nil && readbackDigest != nil)) &&
        (state == .completed || (resultingConfiguration == nil && readbackDigest == nil))
    }
    static func hex(_ value: String, _ length: Int) -> Bool { value.utf8.count == length && value.utf8.allSatisfy { (48...57).contains($0) || (97...102).contains($0) } }
}
struct FriendLockRecord: Codable {
    var schema = 1
    var lockRevision: UInt64 = 1
    var authorizationGeneration: UInt64 = 0
    let enrollmentBaselineDigest: String
    var pin: FriendLockVerifier
    var recovery: FriendLockVerifier
    var pinThrottle = FriendLockThrottle()
    var recoveryThrottle = FriendLockThrottle()
    var operations: [FriendLockReceipt] = []
    var isValid: Bool {
        schema == 1 && lockRevision > 0 && lockRevision <= 9_007_199_254_740_991 && authorizationGeneration <= 9_007_199_254_740_991 && FriendLockReceipt.hex(enrollmentBaselineDigest, 64) && pin.isValid && recovery.isValid &&
        pinThrottle.isValid && recoveryThrottle.isValid && operations.count <= 32 &&
        Set(operations.map(\.operationID)).count == operations.count && operations.allSatisfy { $0.isValid && $0.lockRevision == lockRevision && $0.authorizationGeneration == authorizationGeneration }
    }
}

// Serial worker queue owns verification. KDF never executes on the UI thread or under an enforcement lock.
final class FriendLockCore {
    private static let queue = DispatchQueue(label: "app.freed.device-adult.friend-lock", qos: .userInitiated)
    private let store: FriendLockRecordStore
    private let crypto: any FriendLockCrypto
    private let clock: any FriendLockClock
    init(store: FriendLockRecordStore, crypto: any FriendLockCrypto, clock: any FriendLockClock = FriendLockElapsedClock()) { self.store = store; self.crypto = crypto; self.clock = clock }
    private func serial<T>(_ body: @escaping () throws -> T) async throws -> T {
        try await withCheckedThrowingContinuation { continuation in Self.queue.async { do { continuation.resume(returning: try body()) } catch { continuation.resume(throwing: error) } } }
    }
    func status() async throws -> FriendLockStatus {
        try await serial {
            do { return try self.store.load() == nil ? .notEnrolled : .enrolled }
            catch FriendLockFailure.missingEnrolled { return .missingEnrolled }
            catch FriendLockFailure.corrupt { return .corrupt }
            catch { return .unavailable }
        }
    }
    // Native-only, one-use candidate. Its verifier/key never enters a receipt or a cache.
    final class EnrollmentCandidate {
        fileprivate let issuer: FriendLockCore
        fileprivate let record: FriendLockRecord
        fileprivate let key: String
        fileprivate var consumed = false
        fileprivate init(_ issuer: FriendLockCore, _ record: FriendLockRecord, _ key: String) {
            self.issuer = issuer; self.record = record; self.key = key
        }
    }
    func deriveEnrollment(pin: String, confirmation: String, baseline: FriendLockBaseline) async throws -> EnrollmentCandidate {
        try await serial {
            try Self.validatePIN(pin, confirmation)
            guard baseline.adultProtectionInstalled, !baseline.nativeReadback.isEmpty, baseline.nativeReadback.count <= 32_768 else { throw FriendLockFailure.baselineUnavailable }
            guard try self.store.load() == nil else { throw FriendLockFailure.alreadyEnrolled }
            let key = try self.crypto.random(32).friendHex
            let record = FriendLockRecord(enrollmentBaselineDigest: try self.crypto.digest(baseline.nativeReadback).friendHex, pin: try self.verifier(pin), recovery: try self.verifier(key))
            return EnrollmentCandidate(self, record, key)
        }
    }
    // The integration supplies only synchronous exclusion/validation here. No OS await,
    // KDF or protected lock precedes that exclusion; store CAS/readback are unchanged.
    func publishEnrollment(_ candidate: EnrollmentCandidate,
        publication: @escaping (() throws -> Void) throws -> Void = { try $0() }) async throws -> FriendLockEnrollment {
        try await serial {
            guard candidate.issuer === self, !candidate.consumed else { throw FriendLockFailure.storageConflict }
            candidate.consumed = true
            var committed = false
            try publication {
                guard !committed else { throw FriendLockFailure.storageConflict }
                try FriendLockEnrollmentPublication.withCommit { try self.store.publish(candidate.record, expected: nil) }
                committed = true
            }
            guard committed else { throw FriendLockFailure.invalidTransition }
            return FriendLockEnrollment(lockRevision: candidate.record.lockRevision, recoveryKey: candidate.key)
        }
    }
    func enroll(pin: String, confirmation: String, baseline: FriendLockBaseline) async throws -> FriendLockEnrollment {
        let candidate = try await deriveEnrollment(pin: pin, confirmation: confirmation, baseline: baseline)
        return try await publishEnrollment(candidate)
    }
    func prepare(change: FriendLockAdultChange, configuration: FriendLockConfiguration) async throws -> FriendLockReceipt {
        try await serial {
            var record = try self.requiredRecord(); let old = record
            guard record.operations.count < 32 else { throw FriendLockFailure.authorizationCapacity }
            let receipt = FriendLockReceipt(operationID: try self.crypto.random(16).friendHex, deltaDigest: try change.digest(using: self.crypto), configuration: configuration, lockRevision: record.lockRevision, authorizationGeneration: record.authorizationGeneration, state: .awaitingSecret)
            guard !record.operations.contains(where: { $0.operationID == receipt.operationID }) else { throw FriendLockFailure.cryptoUnavailable }
            record.operations.append(receipt); try self.store.publish(record, expected: old); return receipt
        }
    }
    func authorize(pin: String, change: FriendLockAdultChange, configuration: FriendLockConfiguration, operationID: String? = nil) async throws -> FriendLockReceipt {
        try await serial {
            var record = try self.requiredRecord()
            let prepared = try operationID.map { try self.scoped(record, $0, change, configuration) }
            if let prepared, prepared.state != .awaitingSecret { return prepared }
            guard prepared != nil || record.operations.count < 32 else { throw FriendLockFailure.authorizationCapacity }
            record = try self.verify(.pin(pin), record: record)
            let old = record
            var receipt: FriendLockReceipt
            if var pending = prepared {
                pending.state = .authorized; receipt = pending
                record.operations[record.operations.firstIndex(where: { $0.operationID == pending.operationID })!] = pending
            } else {
                receipt = FriendLockReceipt(operationID: try self.crypto.random(16).friendHex, deltaDigest: try change.digest(using: self.crypto), configuration: configuration, lockRevision: record.lockRevision, authorizationGeneration: record.authorizationGeneration, state: .authorized)
                guard !record.operations.contains(where: { $0.operationID == receipt.operationID }) else { throw FriendLockFailure.cryptoUnavailable }
                record.operations.append(receipt)
            }
            record.pinThrottle = FriendLockThrottle()
            try self.store.publish(record, expected: old)
            return receipt
        }
    }
    func retry(operationID: String, change: FriendLockAdultChange, configuration: FriendLockConfiguration) async throws -> FriendLockReceipt {
        try await serial { let record = try self.requiredRecord(); return try self.scoped(record, operationID, change, configuration) }
    }
    func claim(operationID: String, change: FriendLockAdultChange, configuration: FriendLockConfiguration) async throws -> FriendLockReceipt {
        try await serial {
            var record = try self.requiredRecord(); let old = record
            var receipt = try self.scoped(record, operationID, change, configuration)
            guard receipt.state != .awaitingSecret else { throw FriendLockFailure.invalidTransition }
            if receipt.state == .authorized {
                receipt.state = .inFlight; record.operations[record.operations.firstIndex(where: { $0.operationID == operationID })!] = receipt
                try self.store.publish(record, expected: old)
            }
            return receipt // Completed is returned for exact retry, never permission to repeat mutation.
        }
    }
    func complete(operationID: String, change: FriendLockAdultChange, originalConfiguration: FriendLockConfiguration, resultingConfiguration: FriendLockConfiguration, nativeReadback: Data) async throws -> FriendLockReceipt {
        try await serial {
            guard !nativeReadback.isEmpty, nativeReadback.count <= 32_768 else { throw FriendLockFailure.baselineUnavailable }
            var record = try self.requiredRecord(); let old = record
            guard let index = record.operations.firstIndex(where: { $0.operationID == operationID }) else { throw FriendLockFailure.unknownOperation }
            var receipt = record.operations[index]
            guard receipt.deltaDigest == (try change.digest(using: self.crypto)), receipt.configuration == originalConfiguration else { throw FriendLockFailure.scopeMismatch }
            let digest = try self.crypto.digest(nativeReadback).friendHex
            if receipt.state == .completed {
                guard receipt.resultingConfiguration == resultingConfiguration, receipt.readbackDigest == digest else { throw FriendLockFailure.scopeMismatch }; return receipt
            }
            guard receipt.state == .inFlight else { throw receipt.state == .cancelled ? FriendLockFailure.cancelled : FriendLockFailure.invalidTransition }
            receipt.state = .completed; receipt.resultingConfiguration = resultingConfiguration; receipt.readbackDigest = digest
            record.operations[index] = receipt; try self.store.publish(record, expected: old); return receipt
        }
    }
    func cancel(operationID: String) async throws -> FriendLockReceipt {
        try await serial {
            var record = try self.requiredRecord(); let old = record
            guard let index = record.operations.firstIndex(where: { $0.operationID == operationID }) else { throw FriendLockFailure.unknownOperation }
            guard record.operations[index].state != .completed else { throw FriendLockFailure.invalidTransition }
            record.operations[index].state = .cancelled; try self.store.publish(record, expected: old); return record.operations[index]
        }
    }
    func invalidateAuthorizations() async throws {
        try await serial {
            var record = try self.requiredRecord(); let old = record
            guard record.authorizationGeneration < 9_007_199_254_740_991 else { throw FriendLockFailure.corrupt }
            record.authorizationGeneration += 1; record.operations = []; try self.store.publish(record, expected: old)
        }
    }
    func rotate(secret: FriendLockSecret, newPIN: String, confirmation: String) async throws -> FriendLockEnrollment {
        try await serial {
            try Self.validatePIN(newPIN, confirmation)
            var record = try self.verify(secret, record: self.requiredRecord()); let old = record
            guard record.lockRevision < 9_007_199_254_740_991, record.authorizationGeneration < 9_007_199_254_740_991 else { throw FriendLockFailure.corrupt }
            guard !(try self.crypto.derive(newPIN, salt: record.pin.salt).friendConstantEquals(record.pin.derived)) else { throw FriendLockFailure.invalidPIN }
            let key = try self.crypto.random(32).friendHex
            record.pin = try self.verifier(newPIN); record.recovery = try self.verifier(key)
            record.lockRevision += 1; record.authorizationGeneration += 1; record.operations = []
            switch secret { case .pin: record.pinThrottle = FriendLockThrottle(); case .recovery: record.recoveryThrottle = FriendLockThrottle() }
            try self.store.publish(record, expected: old)
            return FriendLockEnrollment(lockRevision: record.lockRevision, recoveryKey: key)
        }
    }
    private static func validatePIN(_ pin: String, _ confirmation: String) throws {
        guard pin.utf8.count == 6, pin.utf8.allSatisfy({ (48...57).contains($0) }) else { throw FriendLockFailure.invalidPIN }
        guard pin == confirmation else { throw FriendLockFailure.pinMismatch }
    }
    private func verifier(_ value: String) throws -> FriendLockVerifier { let salt = try crypto.random(16); return FriendLockVerifier(salt: salt, derived: try crypto.derive(value, salt: salt)) }
    private func requiredRecord() throws -> FriendLockRecord { guard let record = try store.load() else { throw FriendLockFailure.notEnrolled }; return record }
    private func verify(_ secret: FriendLockSecret, record: FriendLockRecord) throws -> FriendLockRecord {
        var reserved = record
        let isPIN: Bool; let input: String; let verifier: FriendLockVerifier
        switch secret { case .pin(let value): isPIN = true; input = value; verifier = record.pin; case .recovery(let value): isPIN = false; input = value; verifier = record.recovery }
        var throttle = isPIN ? record.pinThrottle : record.recoveryThrottle
        let now = clock.now(); throttle.advance(now)
        if throttle.remainingMilliseconds > 0 {
            if isPIN { reserved.pinThrottle = throttle } else { reserved.recoveryThrottle = throttle }
            try store.publish(reserved, expected: record); throw FriendLockFailure.throttled
        }
        throttle.reserve(now)
        if isPIN { reserved.pinThrottle = throttle } else { reserved.recoveryThrottle = throttle }
        // Persist before KDF. Process death, crypto failure and interruption consume the attempt conservatively.
        try store.publish(reserved, expected: record)
        let validFormat = isPIN ? input.utf8.count == 6 && input.utf8.allSatisfy({ (48...57).contains($0) }) : FriendLockReceipt.hex(input, 64)
        guard validFormat, try crypto.derive(input, salt: verifier.salt).friendConstantEquals(verifier.derived) else { throw FriendLockFailure.incorrectSecret }
        return reserved // Caller clears only after the authorized/rotated record commits durably.
    }
    private func scoped(_ record: FriendLockRecord, _ operationID: String, _ change: FriendLockAdultChange, _ configuration: FriendLockConfiguration) throws -> FriendLockReceipt {
        guard let receipt = record.operations.first(where: { $0.operationID == operationID }) else { throw FriendLockFailure.unknownOperation }
        guard receipt.state != .cancelled else { throw FriendLockFailure.cancelled }
        let expected = receipt.state == .completed ? receipt.resultingConfiguration : receipt.configuration
        guard receipt.deltaDigest == (try change.digest(using: crypto)), expected == configuration, receipt.lockRevision == record.lockRevision, receipt.authorizationGeneration == record.authorizationGeneration else { throw FriendLockFailure.scopeMismatch }
        return receipt
    }
}

// Read-only marker for the explicit enrollment commit's configuration -> protected order.
// Ordinary protected reads retain their existing exclusion assertion.
enum FriendLockEnrollmentPublication {
    private static let key = "freed.friendLock.enrollmentPublication"
    static var active: Bool { Thread.current.threadDictionary[key] as? Bool == true }
    fileprivate static func withCommit<T>(_ body: () throws -> T) throws -> T {
        guard !active else { throw FriendLockFailure.storageConflict }
        Thread.current.threadDictionary[key] = true
        defer { Thread.current.threadDictionary.removeObject(forKey: key) }
        return try body()
    }
}
