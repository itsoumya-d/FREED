import Foundation
#if os(iOS) && canImport(ManagedSettings) && canImport(DeviceActivity)
import ManagedSettings
import DeviceActivity
#endif

// Host-only observation for initial strengthening. An unknown/absent projection
// is never initialized by a consumer, a reset marker or a private cleanup.
enum FreedAdultProtectionNativeObservation {
  static func capture(_ defaults: UserDefaults) throws -> FreedRetainedAdultProtection.Policy {
    #if FREED_NATIVE_FIXTURES
    if let fixtureCapture { return try fixtureCapture(defaults) }
    #endif
    #if os(iOS) && canImport(ManagedSettings) && canImport(DeviceActivity)
    if #available(iOS 15.0, *) {
      let installed = ManagedSettingsStore().webContent.blockedByFilter != nil
      let schedule = DeviceActivityCenter().schedule(for: DeviceActivityName("freed.nightGuard"))
      let start = schedule.flatMap { value in value.intervalStart.hour.flatMap { hour in value.intervalStart.minute.map { hour * 60 + $0 } } }
      let end = schedule.flatMap { value in value.intervalEnd.hour.flatMap { hour in value.intervalEnd.minute.map { hour * 60 + $0 } } }
      return FreedRetainedAdultProtection.Policy(continuous: installed,
        encryptedDNS: defaults.object(forKey: "freed.encryptedDns.cloudflareFamilies.configured") == nil || defaults.bool(forKey: "freed.encryptedDns.cloudflareFamilies.configured"),
        safari: defaults.object(forKey: "freed.safariContentBlocker.ruleCount") == nil || defaults.integer(forKey: "freed.safariContentBlocker.ruleCount") > 0,
        riskEnabled: schedule != nil || defaults.bool(forKey: "freed.riskWindowActive"),
        riskStartMinute: start, riskEndMinute: end)
    }
    #endif
    throw FreedRetainedAdultProtection.Failure.baselineUnknown
  }
  #if FREED_NATIVE_FIXTURES
  static var fixtureCapture: ((UserDefaults) throws -> FreedRetainedAdultProtection.Policy)?
  #endif
}

enum FreedAdultLockIntegrationFailure: Error { case authorizationRequired, integrationDisabled, operationInProgress, staleConfiguration, interruptedOperation, unknownOperation, invalidReadback }

// Host-only lower-boundary gate. Missing witnesses, corrupt journals and unavailable
// Keychain access propagate failure. There is no permissive UI/JS fallback.
final class FreedAdultProtectionLegacyGate {
  private let store: FriendLockRecordStore
  init(store: FriendLockRecordStore) { self.store = store }
  func requireUnenrolled() throws {
    guard try store.load() == nil else { throw FreedAdultLockIntegrationFailure.authorizationRequired }
  }
  static func requireUnenrolled() throws {
    if let authority = Thread.current.threadDictionary[authorityContextKey] as? LegacyAuthority { try authority.requireUnenrolled(); return }
    guard !FreedProtectionConfigurationLock.isInsideExclusiveAccess else { throw FriendLockFailure.storageConflict }
    #if FREED_NATIVE_FIXTURES
    if let fixtureStore { try FreedAdultProtectionLegacyGate(store: fixtureStore).requireUnenrolled(); return }
    #endif
    #if os(iOS)
    try FreedAdultProtectionLegacyGate(store: FriendLockRecordStore(bytes: FriendLockKeychainBytes())).requireUnenrolled()
    #else
    // Non-iOS native fixtures inject protected storage explicitly.
    throw FriendLockFailure.storageUnavailable
    #endif
  }
  #if FREED_NATIVE_FIXTURES
  static var fixtureStore: FriendLockRecordStore?
  #endif
  // Host-only logical ownership. This is neither a friend authorization nor a
  // replacement for the enrolled-record gate. No lock is held while awaiting OS.
  final class WriterLease {
    fileprivate let id = UUID()
    fileprivate init() {}
  }
  final class LegacyAuthority {
    let lease: WriterLease
    private let rejection: Error?
    fileprivate init(lease: WriterLease, rejection: Error?) { self.lease = lease; self.rejection = rejection }
    func requireUnenrolled() throws {
      try FreedAdultProtectionLegacyGate.requireCurrent(lease)
      if let rejection { throw rejection }
    }
  }
  private static let laneMutex = NSLock()
  private static var laneOwner: WriterLease?
  private static var waiting: [(WriterLease, CheckedContinuation<WriterLease, Error>)] = []
  private static var legacyTasks: [String: Task<[String: Any], Never>] = [:]
  private static let maximumQueuedWriters = 8
  static func acquireWriter() throws -> WriterLease {
    laneMutex.lock(); defer { laneMutex.unlock() }
    guard laneOwner == nil else { throw FreedAdultLockIntegrationFailure.operationInProgress }
    let lease = WriterLease(); laneOwner = lease; return lease
  }
  static func requireCurrent(_ lease: WriterLease) throws {
    laneMutex.lock(); defer { laneMutex.unlock() }
    guard laneOwner === lease else { throw FreedAdultLockIntegrationFailure.staleConfiguration }
  }
  static func releaseWriter(_ lease: WriterLease) {
    laneMutex.lock()
    guard laneOwner === lease else { laneMutex.unlock(); return }
    if waiting.isEmpty { laneOwner = nil; laneMutex.unlock(); return }
    let next = waiting.removeFirst(); laneOwner = next.0; laneMutex.unlock()
    next.1.resume(returning: next.0)
  }
  private static func waitForWriter() async throws -> WriterLease {
    try await withCheckedThrowingContinuation { continuation in
      laneMutex.lock()
      let lease = WriterLease()
      if laneOwner == nil { laneOwner = lease; laneMutex.unlock(); continuation.resume(returning: lease) }
      else if waiting.count < maximumQueuedWriters { waiting.append((lease, continuation)); laneMutex.unlock() }
      else { laneMutex.unlock(); continuation.resume(throwing: FreedAdultLockIntegrationFailure.operationInProgress) }
    }
  }
  // Run before entering configuration exclusion. The result may allow only
  // strengthening: a failed/corrupt/enrolled read never means unenrolled.
  static func authority(for lease: WriterLease) throws -> LegacyAuthority {
    try requireCurrent(lease)
    guard !FreedProtectionConfigurationLock.isInsideExclusiveAccess else { throw FriendLockFailure.storageConflict }
    do { try requireUnenrolled(); return LegacyAuthority(lease: lease, rejection: nil) }
    catch { return LegacyAuthority(lease: lease, rejection: error) }
  }
  static func enqueueLegacy(key: String, body: @escaping (LegacyAuthority) async -> [String: Any]) -> Task<[String: Any], Never> {
    laneMutex.lock(); defer { laneMutex.unlock() }
    if let joined = legacyTasks[key] { return joined }
    guard legacyTasks.count < maximumQueuedWriters else {
      return Task { ["operationAccepted": false, "operationPending": true, "removed": false, "error": "adult-writer-queue-full"] }
    }
    let task = Task { () -> [String: Any] in
      let result: [String: Any]
      do {
        let lease = try await waitForWriter()
        defer { releaseWriter(lease) }
        result = await body(try authority(for: lease))
      } catch { result = rejection(error) }
      finishLegacy(key)
      return result
    }
    legacyTasks[key] = task
    return task
  }
  private static func finishLegacy(_ key: String) {
    laneMutex.lock(); defer { laneMutex.unlock() }; legacyTasks.removeValue(forKey: key)
  }
  private static let authorityContextKey = "freed.adult.legacyAuthority"
  static func withAuthority<T>(_ authority: LegacyAuthority, _ body: () throws -> T) throws -> T {
    try requireCurrent(authority.lease)
    let previous = Thread.current.threadDictionary[authorityContextKey]
    Thread.current.threadDictionary[authorityContextKey] = authority
    defer { if let previous { Thread.current.threadDictionary[authorityContextKey] = previous } else { Thread.current.threadDictionary.removeObject(forKey: authorityContextKey) } }
    return try body()
  }
  static func withWriter<T>(_ body: () throws -> T) throws -> T {
    // Reentrant synchronous lower helpers reuse the exact admitted authority.
    if let current = Thread.current.threadDictionary[authorityContextKey] as? LegacyAuthority { return try withAuthority(current, body) }
    let lease = try acquireWriter(); defer { releaseWriter(lease) }
    return try withAuthority(authority(for: lease), body)
  }
  private static var callerObservers = 0
  private static func beginCallerObserver() -> Bool {
    laneMutex.lock(); defer { laneMutex.unlock() }
    guard callerObservers < 16 else { return false }; callerObservers += 1; return true
  }
  private static func endCallerObserver() { laneMutex.lock(); callerObservers -= 1; laneMutex.unlock() }
  static func waitForLegacy(_ task: Task<[String: Any], Never>, pending: [String: Any]) async -> [String: Any] {
    guard beginCallerObserver() else { return pending }
    return await withCheckedContinuation { continuation in
      let lock = NSLock(); var finished = false
      let complete: ([String: Any]) -> Void = { value in
        lock.lock(); let resume = !finished; finished = true; lock.unlock()
        if resume { continuation.resume(returning: value) }
      }
      DispatchQueue.global().asyncAfter(deadline: .now() + 8) { complete(pending) }
      Task { let value = await task.value; endCallerObserver(); complete(value) }
    }
  }
  static func rejection(_ error: Error) -> [String: Any] {
    let reason: String
    if case FreedAdultLockIntegrationFailure.operationInProgress = error { reason = "adult-writer-busy" }
    else { reason = error is FreedAdultLockIntegrationFailure ? "adult-lock-authorization-required" : "adult-lock-storage-unavailable" }
    return ["nativeConfigurationOperationAccepted": false, "adultWebPolicyOperationAccepted": false,
      "nightGuardOperationAccepted": false, "protectionConfigurationResetAccepted": false,
      "nativeConfigurationError": reason, "protectionConfigurationResetError": reason,
      "nativeConfigurationDiagnostics": ["stage": "adult-lock-boundary", "reason": reason]]
  }
}

// Logical ownership crosses awaits; the mutex itself never does. All instances
// join an exact in-process execution; the durable reservation fences new processes.
private enum FreedAdultExecutor {
  private static let mutex = NSLock()
  private static var revocations: [String: UUID] = [:]
  private static var coreTransitions: Set<String> = []
  static func beginCoreTransition(_ key: String) throws {
    mutex.lock(); defer { mutex.unlock() }
    guard coreTransitions.insert(key).inserted else { throw FreedAdultLockIntegrationFailure.interruptedOperation }
  }
  static func endCoreTransition(_ key: String) { mutex.lock(); coreTransitions.remove(key); mutex.unlock() }

  static func beginRevocation(_ key: String) -> UUID {
    mutex.lock(); defer { mutex.unlock() }
    let token = UUID(); revocations[key] = token; return token
  }
  static func finishRevocation(_ key: String, token: UUID) {
    mutex.lock(); defer { mutex.unlock() }
    if revocations[key] == token { revocations.removeValue(forKey: key) }
  }
  static func withNoRevocation<T>(_ key: String, _ body: () throws -> T) throws -> T {
    mutex.lock(); defer { mutex.unlock() }
    guard revocations[key] == nil else { throw FreedAdultLockIntegrationFailure.staleConfiguration }
    return try body()
  }
  private static var owner: UUID?
  private static var writerLease: FreedAdultProtectionLegacyGate.WriterLease?
  private static var execution: (key: String, task: Task<FreedNativeAdultMutationResult, Error>)?
  struct Admission { let token: UUID; let lease: FreedAdultProtectionLegacyGate.WriterLease }
  static func acquire() throws -> Admission {
    mutex.lock(); defer { mutex.unlock() }
    guard owner == nil else { throw FreedAdultLockIntegrationFailure.operationInProgress }
    writerLease = try FreedAdultProtectionLegacyGate.acquireWriter()
    let token = UUID(); owner = token; return Admission(token: token, lease: writerLease!)
  }
  static func release(_ admission: Admission) { releaseToken(admission.token) }
  private static func releaseToken(_ token: UUID) {
    mutex.lock(); defer { mutex.unlock() }
    if owner == token {
      owner = nil; execution = nil
      if let lease = writerLease { writerLease = nil; FreedAdultProtectionLegacyGate.releaseWriter(lease) }
    }
  }
  private static func start(key: String, body: @escaping (FreedAdultProtectionLegacyGate.WriterLease) async throws -> FreedNativeAdultMutationResult) throws -> (UUID, Task<FreedNativeAdultMutationResult, Error>) {
    mutex.lock(); defer { mutex.unlock() }
    if let owner, let execution, execution.key == key { return (owner, execution.task) }
    guard owner == nil else { throw FreedAdultLockIntegrationFailure.operationInProgress }
    writerLease = try FreedAdultProtectionLegacyGate.acquireWriter()
    let token = UUID(); owner = token
    let lease = writerLease!
    let task = Task { try await body(lease) }; execution = (key, task)
    return (token, task)
  }
  static func run(key: String, body: @escaping (FreedAdultProtectionLegacyGate.WriterLease) async throws -> FreedNativeAdultMutationResult) async throws -> FreedNativeAdultMutationResult {
    let (token, task) = try start(key: key, body: body)
    defer { releaseToken(token) }
    return try await task.value
  }
}

struct FreedNativeAdultSnapshot: Codable, Equatable {
  let configuration: FriendLockConfiguration
  let policy: FreedRetainedAdultProtection.Policy
  // Canonical stable native observation ONLY: no diagnostics, translated strings,
  // observation IDs or timestamps. The production adapter must derive this binding.
  let nativeReadback: Data
  var valid: Bool { configuration.isValid && policy.valid && !nativeReadback.isEmpty && nativeReadback.count <= 32_768 }
}
enum FreedNativeAdultMutationStage: String, Codable { case readback, osReadbackFailed, partial }
struct FreedNativeAdultMutationResult: Codable, Equatable {
  let accepted: Bool
  let stage: FreedNativeAdultMutationStage
  let resultingSnapshot: FreedNativeAdultSnapshot
  let layers: FreedAdultLayerStages
}
// Adapter owns exact per-layer native revalidation, dispatch and acknowledgment.
// The operation is native-derived/validated and never an Expo/JS argument. The
// journal's reservation is NOT a lower-layer permit or an OS atomicity guarantee.
protocol FreedNativeAdultMutationAdapter {
  func snapshot(lease: FreedAdultProtectionLegacyGate.WriterLease) async throws -> FreedNativeAdultSnapshot
  func perform(operation: FreedAdultOperation, context: FreedAdultMutationExecutionContext) async throws -> FreedNativeAdultMutationResult
  func fenceNativeAuthority() async throws -> Int
}
struct FreedAdultOperationStatus {
  let operationID: String
  let request: FreedAdultChangeRequest
  let phase: FreedAdultOperationPhase
  let accepted: Bool?
  let layers: FreedAdultLayerStages
}
actor FreedAdultProtectionLockCoordinator {
  static let mutationEnforcementAvailable = false
  private let core: FriendLockCore
  // Same protected authority used by core; required for a complete receipt census.
  // core.retry alone cannot discover a core operation whose host record is missing.
  // Only its non-secret receipt fields are copied into the host reconciliation.
  private let coreRecords: FriendLockRecordStore
  private let crypto: any FriendLockCrypto
  private let adapter: any FreedNativeAdultMutationAdapter
  private let operations: FreedAdultProtectionOperationStore
  private let enrollmentSnapshot: ((FreedAdultProtectionLegacyGate.WriterLease) async throws -> FreedNativeAdultSnapshot)?
  init(core: FriendLockCore, crypto: any FriendLockCrypto, adapter: any FreedNativeAdultMutationAdapter,
       operations: FreedAdultProtectionOperationStore, coreRecords: FriendLockRecordStore,
       enrollmentSnapshot: ((FreedAdultProtectionLegacyGate.WriterLease) async throws -> FreedNativeAdultSnapshot)? = nil) {
    self.enrollmentSnapshot = enrollmentSnapshot
    self.coreRecords = coreRecords
    self.core = core; self.crypto = crypto; self.adapter = adapter; self.operations = operations
  }
  func enroll(pin: String, confirmation: String) async throws -> FriendLockEnrollment {
    guard let enrollmentSnapshot else { throw FreedAdultLockIntegrationFailure.integrationDisabled }
    let token = try FreedAdultExecutor.acquire(); defer { FreedAdultExecutor.release(token) }
    try FreedAdultExecutor.beginCoreTransition(operations.identity)
    defer { FreedAdultExecutor.endCoreTransition(operations.identity) }
    try FreedAdultExecutor.withNoRevocation(operations.identity) {}
    switch try await core.status() {
    case .notEnrolled: break
    case .enrolled: throw FriendLockFailure.alreadyEnrolled
    case .missingEnrolled: throw FriendLockFailure.missingEnrolled
    case .corrupt: throw FriendLockFailure.corrupt
    case .unavailable: throw FriendLockFailure.storageUnavailable
    }
    try await operations.initializeBeforeEnrollment(core: core)
    let journal = try enrollmentJournal()
    let before = try await enrollmentSnapshot(token.lease)
    let candidate = try await core.deriveEnrollment(pin: pin, confirmation: confirmation,
      baseline: FriendLockBaseline(configuration: before.configuration, adultProtectionInstalled: true, nativeReadback: before.nativeReadback))
    let after = try await enrollmentSnapshot(token.lease)
    guard before == after, try enrollmentJournal() == journal, try coreRecords.load() == nil else { throw FreedAdultLockIntegrationFailure.staleConfiguration }
    let scope = try FreedAdultCanonicalReadback.decode(before).scope
    return try await core.publishEnrollment(candidate) { commit in
      try FreedAdultExecutor.withNoRevocation(self.operations.identity) {
        try FreedAdultProtectionLegacyGate.requireCurrent(token.lease)
        try FreedAdultConfigurationAccess.withExclusiveAccess { defaults in
          guard try FreedAdultNativeScope.capture(defaults) == scope,
            try FreedRetainedAdultProtection.read(defaults) == before.policy,
            try FreedAccountProtectionCleanup.read(defaults).records.allSatisfy({ $0.terminal }),
            defaults.object(forKey: FreedAdultLayerPermit.reservationKey) == nil else { throw FreedAdultLockIntegrationFailure.staleConfiguration }
          try commit()
        }
      }
    }
  }
  private func enrollmentJournal() throws -> FreedAdultProtectionOperationStore.Journal {
    let value = try operations.load()
    guard !value.invalidationPending, !value.authorityUncertain,
      value.records.allSatisfy({ $0.authority == .explicitUnenrolledPilot && [.completed, .cancelled, .superseded].contains($0.phase) }),
      value.cleanupInvalidations.isEmpty else { throw FreedAdultLockIntegrationFailure.interruptedOperation }
    return value
  }
  func enrollmentReady() async -> Bool {
    guard let enrollmentSnapshot else { return false }
    do {
      let token = try FreedAdultExecutor.acquire(); defer { FreedAdultExecutor.release(token) }
      guard try await core.status() == .notEnrolled else { return false }
      try await operations.initializeBeforeEnrollment(core: core)
      _ = try enrollmentJournal()
      _ = try await enrollmentSnapshot(token.lease)
      return true
    } catch { return false }
  }
  // Compatibility for existing native callers; compound Off has its own explicit
  // request, with a distinct canonical digest from reset despite identical policy.
  func prepare(action: FriendLockAction) async throws -> FriendLockReceipt {
    let request: FreedAdultChangeRequest
    switch action {
    case .disableAdultFilter: request = .continuousOff
    case .disableEncryptedDNS: request = .dnsOff
    case .resetAdultProtection: request = .adultReset
    default: throw FreedAdultLockIntegrationFailure.integrationDisabled
    }
    return try await prepare(request: request)
  }
  func prepare(request: FreedAdultChangeRequest, dnsCandidate: FreedRecoveryDnsCandidate? = nil, activationProof: FreedRecoveryDnsActivationProof? = nil) async throws -> FriendLockReceipt {
    guard ([.dnsReplace, .recoveryModeActivate].contains(request)) == (dnsCandidate != nil),
      (request == .recoveryModeActivate) == (activationProof != nil) else { throw FreedAdultLockIntegrationFailure.authorizationRequired }
    let token = try FreedAdultExecutor.acquire(); defer { FreedAdultExecutor.release(token) }
    try await reconcileBookkeepingOnly()
    let epoch = try operations.preflight()
    let before = try await adapter.snapshot(lease: token.lease)
    guard before.valid else { throw FreedAdultLockIntegrationFailure.invalidReadback }
    guard try operations.preflight() == epoch else { throw FreedAdultLockIntegrationFailure.staleConfiguration }
    // Rebuild the same bounded canonical change before a core ID exists.
    let desired = request.desired(from: before.policy, dnsCandidate: dnsCandidate)
    if let dnsCandidate {
      guard try FreedAdultCanonicalReadback.decode(before).scope == dnsCandidate.nativeScope else { throw FreedAdultLockIntegrationFailure.staleConfiguration }
      try FreedAdultConfigurationAccess.withExclusiveAccess { try FreedRecoveryDnsPilotBoundary.requireCurrent(dnsCandidate, $0) }
      if request == .dnsReplace, let hosted = before.policy.hostedRecoveryDns, hosted != dnsCandidate.identity {
        // Replacing an active hosted mode requires a fresh .auto/Families
        // rollback first; a saved-only candidate may not become sole protection.
        throw FreedAdultLockIntegrationFailure.authorizationRequired
      }
      if request == .recoveryModeActivate {
        guard before.policy.continuous, before.policy.encryptedDNS, let activationProof else { throw FreedAdultLockIntegrationFailure.authorizationRequired }
        #if os(iOS)
        if #available(iOS 16.0, *) {
          try await MainActor.run { try FreedRecoveryDnsPilot.requireActivationProof(activationProof, candidate: dnsCandidate) }
        } else { throw FreedAdultLockIntegrationFailure.integrationDisabled }
        #else
        throw FreedAdultLockIntegrationFailure.integrationDisabled
        #endif
      }
    }
    let change = try FreedAdultOperation.change(request: request, before: before, desired: desired,
      epoch: epoch, dnsCandidate: dnsCandidate, activationProof: activationProof, crypto: crypto)
    let authority: FreedAdultOperationAuthority
    let receipt: FriendLockReceipt
    if [.dnsReplace, .recoveryModeActivate].contains(request), try await core.status() == .notEnrolled {
      try FreedAdultProtectionLegacyGate(store: coreRecords).requireUnenrolled()
      authority = .explicitUnenrolledPilot
      receipt = FriendLockReceipt(operationID: try crypto.random(16).map { String(format: "%02x", $0) }.joined(),
        deltaDigest: try change.digest(using: crypto), configuration: before.configuration,
        lockRevision: 1, authorizationGeneration: 0, state: .authorized)
    } else {
      authority = .friendLock
      receipt = try await core.prepare(change: change, configuration: before.configuration)
    }
    guard try await adapter.snapshot(lease: token.lease) == before else { throw FreedAdultLockIntegrationFailure.staleConfiguration }
    let operation = FreedAdultOperation(request: request, before: before, desired: desired, epoch: epoch, receipt: receipt,
      phase: authority == .friendLock ? .prepared : .authorized, dnsCandidate: dnsCandidate, activationProof: activationProof, authority: authority)
    try operations.update { journal in
      guard !journal.invalidationPending, !journal.authorityUncertain, journal.epoch == epoch, journal.records.count < FreedAdultProtectionOperationStore.maximumRecords,
        !journal.records.contains(where: { [.claimReserved, .claimed, .dispatchReserved, .outcomeRecorded, .cancelling].contains($0.phase) }) else { throw FriendLockFailure.storageConflict }
      journal.records.append(operation)
    }
    // If publication failed the orphan core receipt has no journal execution path.
    return receipt
  }
  func authorize(operationID: String, pin: String) async throws -> FriendLockReceipt {
    let token = try FreedAdultExecutor.acquire(); defer { FreedAdultExecutor.release(token) }
    let operation = try current(operationID)
    guard operation.authority == .friendLock else { throw FreedAdultLockIntegrationFailure.authorizationRequired }
    guard [.prepared, .authorized].contains(operation.phase) else { throw FreedAdultLockIntegrationFailure.interruptedOperation }
    guard try await adapter.snapshot(lease: token.lease) == operation.before else { throw FreedAdultLockIntegrationFailure.staleConfiguration }
    let receipt = try await core.authorize(pin: pin, change: operation.change(using: crypto), configuration: operation.before.configuration, operationID: operationID)
    try bind(receipt, to: operation)
    guard receipt.state == .authorized, try await adapter.snapshot(lease: token.lease) == operation.before else { throw FreedAdultLockIntegrationFailure.staleConfiguration }
    var authorized = operation; authorized.receipt = receipt; authorized.phase = .authorized
    try operations.replace(operation, with: authorized)
    return receipt
  }
  func execute(operationID: String) async throws -> FreedNativeAdultMutationResult {
    try await FreedAdultExecutor.run(key: operations.identity + ":" + operationID) { lease in try await self.executeOnce(operationID, lease: lease) }
  }
  private func executeOnce(_ id: String, lease: FreedAdultProtectionLegacyGate.WriterLease) async throws -> FreedNativeAdultMutationResult {
    try await reconcileBookkeepingOnly()
    var operation = try current(id)
    if operation.outcome != nil { return try await finishBookkeeping(operation) }
    try operations.requireNoUnresolvedClaim()
    // Never use a fresh observation to resurrect an ambiguous old dispatch.
    guard operation.phase == .authorized else { throw FreedAdultLockIntegrationFailure.interruptedOperation }
    guard try await adapter.snapshot(lease: lease) == operation.before else { throw FreedAdultLockIntegrationFailure.staleConfiguration }
    let change = try operation.change(using: crypto)
    let previous = try await retryReceipt(operation)
    try bind(previous, to: operation)
    guard previous.state == .authorized else { throw FreedAdultLockIntegrationFailure.interruptedOperation }
    // Reserve the host lane BEFORE the core can become inFlight. Both the
    // pre-claim and post-claim crash gaps now retain durable exclusion.
    var claimReserved = operation; claimReserved.phase = .claimReserved
    try operations.replace(operation, with: claimReserved); operation = claimReserved
    var receipt: FriendLockReceipt
    if operation.authority == .explicitUnenrolledPilot {
      try FreedAdultProtectionLegacyGate(store: coreRecords).requireUnenrolled()
      receipt = operation.receipt; receipt.state = .inFlight
    } else { receipt = try await core.claim(operationID: id, change: change, configuration: operation.before.configuration) }
    try bind(receipt, to: operation)
    guard receipt.state == .inFlight else { throw FreedAdultLockIntegrationFailure.interruptedOperation }
    var claimed = operation; claimed.receipt = receipt; claimed.phase = .claimed
    try operations.replace(operation, with: claimed); operation = claimed
    // Claim and dispatch reservation are separate commits. Death here requires a
    // new explicit action, never silent continuation under the old claim.
    guard try await adapter.snapshot(lease: lease) == operation.before else { throw FreedAdultLockIntegrationFailure.staleConfiguration }
    let verified = try await retryReceipt(operation)
    try bind(verified, to: operation)
    guard verified.state == .inFlight else { throw FreedAdultLockIntegrationFailure.interruptedOperation }
    var reserved = operation; reserved.phase = .dispatchReserved; reserved.layers = .reserved(operation.request)
    try operations.replace(operation, with: reserved); operation = reserved
    // No terminal in-memory error cache. If OS, observation or outcome storage
    // fails, the durable reservation stays unresolved and blocks redispatch.
    let unenrolledAuthority: FreedAdultProtectionLegacyGate.LegacyAuthority?
    if operation.authority == .explicitUnenrolledPilot {
      // Read protected storage before configuration exclusion. The held adult
      // writer prevents an enrollment from interleaving with this exact dispatch.
      try FreedAdultProtectionLegacyGate(store: coreRecords).requireUnenrolled()
      unenrolledAuthority = FreedAdultProtectionLegacyGate.LegacyAuthority(lease: lease, rejection: nil)
    } else { unenrolledAuthority = nil }
    let context = FreedAdultMutationExecutionContext(operation: operation, lease: lease,
      operations: operations, crypto: crypto, snapshot: { try await self.adapter.snapshot(lease: lease) },
      validate: { try await self.validateExecution(operation) },
      requireUnenrolled: unenrolledAuthority.map { authority in { try authority.requireUnenrolled() } })
    let result = try await adapter.perform(operation: operation, context: context)
    operation = try await validateExecution(operation)
    try context.validateFinal(operation, result: result)
    guard result.resultingSnapshot.valid, try await adapter.snapshot(lease: lease) == result.resultingSnapshot else { throw FreedAdultLockIntegrationFailure.invalidReadback }
    if result.accepted {
      var observed = result.resultingSnapshot.policy; observed.revision = operation.desired.revision
      guard observed == operation.desired else { throw FreedAdultLockIntegrationFailure.invalidReadback }
    }
    var recorded = operation; recorded.outcome = result; recorded.layers = result.layers; recorded.phase = .outcomeRecorded
    try FreedAdultExecutor.withNoRevocation(operations.identity) { try operations.replace(operation, with: recorded) }
    return try await finishBookkeeping(recorded)
  }
  private func validateExecution(_ original: FreedAdultOperation) async throws -> FreedAdultOperation {
    try reconcileCoreHalves()
    let current = try self.current(original.id)
    guard current.sameDispatch(as: original), current.phase == .dispatchReserved else { throw FriendLockFailure.storageConflict }
    let receipt = try await retryReceipt(current)
    try bind(receipt, to: current)
    guard receipt == current.receipt, receipt.state == .inFlight else { throw FriendLockFailure.scopeMismatch }
    // Awaiting core may interleave revocation. Reload the complete current host record.
    guard try self.current(current.id) == current else { throw FriendLockFailure.storageConflict }
    return current
  }
  private func finishBookkeeping(_ operation: FreedAdultOperation) async throws -> FreedNativeAdultMutationResult {
    try FreedAdultExecutor.withNoRevocation(operations.identity) {}
    guard [.outcomeRecorded, .completed].contains(operation.phase), let result = operation.outcome else { throw FreedAdultLockIntegrationFailure.interruptedOperation }
    // Core completion validates exact saved result bytes; it does not turn a
    // partial/failed OS result into accepted success and never calls the adapter.
    var receipt: FriendLockReceipt
    if operation.authority == .explicitUnenrolledPilot {
      try FreedAdultProtectionLegacyGate(store: coreRecords).requireUnenrolled()
      receipt = operation.receipt; receipt.state = .completed
      receipt.resultingConfiguration = result.resultingSnapshot.configuration
      receipt.readbackDigest = try freedAdultHash(result.resultingSnapshot.nativeReadback, crypto: crypto)
    } else {
      receipt = try await core.complete(operationID: operation.id, change: operation.change(using: crypto),
        originalConfiguration: operation.before.configuration, resultingConfiguration: result.resultingSnapshot.configuration,
        nativeReadback: result.resultingSnapshot.nativeReadback)
    }
    try bind(receipt, to: operation)
    var completed = operation; completed.receipt = receipt; completed.phase = .completed
    try FreedAdultExecutor.withNoRevocation(operations.identity) { try operations.replace(operation, with: completed) }
    return result
  }
  private func retryReceipt(_ operation: FreedAdultOperation) async throws -> FriendLockReceipt {
    if operation.authority == .explicitUnenrolledPilot {
      try FreedAdultProtectionLegacyGate(store: coreRecords).requireUnenrolled()
      try FreedAdultConfigurationAccess.withExclusiveAccess { defaults in
        guard let candidate = operation.dnsCandidate else { throw FreedAdultLockIntegrationFailure.authorizationRequired }
        try FreedRecoveryDnsPilotBoundary.requireCurrent(candidate, defaults)
      }
      return operation.receipt
    }
    return try await core.retry(operationID: operation.id, change: operation.change(using: crypto), configuration: operation.before.configuration)
  }
  func getOperation(operationID: String) throws -> FreedAdultOperationStatus {
    status(try operations.required(operationID))
  }
  // Read-only public projection. Raw policy/readback, digests and private scope never cross JS.
  func deviceAdultOperation(_ id: String, pending: Bool = false) throws -> [String: Any] {
    let value = try operations.required(id)
    var result: [String: Any] = ["schema": 1, "kind": "operation", "operationID": value.id, "action": value.request.rawValue,
      "phase": value.phase.rawValue, "authorization": value.receipt.state.rawValue,
      "generation": String(value.epoch), "lockRevision": String(value.receipt.lockRevision),
      "authorizationGeneration": String(value.receipt.authorizationGeneration),
      "accepted": value.phase == .completed ? (value.outcome?.accepted as Any? ?? NSNull()) : NSNull(),
      "observation": value.phase == .completed ? "settled" : pending ? "pending" : "unknown",
      "historicalReceipt": true, "currentStatus": "unknown", "historicalResultStale": NSNull(),
      "layers": ["dns": value.layers.dns.rawValue, "safari": value.layers.safari.rawValue,
        "risk": value.layers.risk.rawValue, "continuous": value.layers.continuous.rawValue]]
    result["pinRequired"] = value.authority == .friendLock
    result["authorizationSource"] = value.authority.rawValue
    if let outcome = value.outcome,
      let readback = try? FreedAdultCanonicalReadback.decode(outcome.resultingSnapshot),
      let dnsBytes = readback.layers["dns"] {
      struct DNS: Decodable { let loaded: FreedLoadedDnsObservation }
      if let dns = try? JSONDecoder().decode(DNS.self, from: dnsBytes).loaded {
        result["dnsProfileSaved"] = dns.recognized && dns.hasSettings
        result["dnsSystemEnabled"] = dns.enabled
        result["hostedModeRetained"] = outcome.resultingSnapshot.policy.hostedRecoveryDns != nil
      }
    }
    return result
  }
  func deviceAdultPendingIDs() throws -> [String] {
    try operations.load().records.filter { ![.completed, .cancelled, .superseded].contains($0.phase) }.map(\.id)
  }
  // Startup/foreground hooks may call this once integrated. It has no adapter
  // dispatch path: ambiguous reservations remain explicit and block new work.
  func reconcilePending() async throws -> [FreedAdultOperationStatus] {
    let token = try FreedAdultExecutor.acquire(); defer { FreedAdultExecutor.release(token) }
    try await reconcileBookkeepingOnly()
    return try operations.load().records.map(status)
  }
  private func reconcileBookkeepingOnly() async throws {
    try FreedAdultExecutor.withNoRevocation(operations.identity) {}
    try reconcileCoreHalves()
    let journal = try operations.load()
    guard !journal.invalidationPending, !journal.authorityUncertain else { throw FreedAdultLockIntegrationFailure.interruptedOperation }
    for operation in journal.records where operation.epoch == journal.epoch && operation.phase == .outcomeRecorded {
      _ = try await finishBookkeeping(operation)
    }
  }
  // Reads each protected store under its own short transaction. No journal lock
  // is nested with the core lock/KDF. A full host CAS fences interleaved changes.
  private func reconcileCoreHalves() throws {
    let original = try operations.load()
    guard !original.invalidationPending, !original.authorityUncertain else { throw FreedAdultLockIntegrationFailure.interruptedOperation }
    guard let record = try coreRecords.load() else {
      guard original.records.allSatisfy({ $0.authority == .explicitUnenrolledPilot }) else { throw FriendLockFailure.notEnrolled }
      return
    }
    let receipts = record.operations
    var candidate = original
    var uncertain = false
    for receipt in receipts {
      guard let index = original.records.firstIndex(where: { $0.id == receipt.operationID }) else {
        uncertain = true; continue
      }
      let operation = original.records[index]
      do { try bind(receipt, to: operation) } catch { uncertain = true; continue }
      switch receipt.state {
      case .inFlight:
        switch operation.phase {
        case .prepared, .authorized, .claimReserved:
          // Compatibility with an older core-first claim and interrupted host
          // publication. Preserve the original native request, never dispatch it.
          candidate.records[index].receipt = receipt
          candidate.records[index].phase = .claimed
        case .claimed, .dispatchReserved, .outcomeRecorded, .cancelling: break
        default: uncertain = true
        }
      case .completed:
        if operation.phase == .completed {
          if operation.receipt != receipt { uncertain = true }
        } else if operation.phase != .outcomeRecorded || operation.outcome == nil { uncertain = true }
      case .cancelled:
        if [.prepared, .authorized, .claimReserved, .claimed, .cancelling, .cancelled].contains(operation.phase) {
          candidate.records[index].receipt = receipt
          candidate.records[index].phase = .cancelled
        } else { uncertain = true }
      case .authorized:
        if ![.prepared, .authorized, .claimReserved, .cancelling].contains(operation.phase) { uncertain = true }
      case .awaitingSecret:
        if ![.prepared, .cancelling].contains(operation.phase) { uncertain = true }
      }
    }
    for operation in original.records where operation.authority == .friendLock && operation.epoch == original.epoch && operation.phase != .superseded {
      if !receipts.contains(where: { $0.operationID == operation.id }) { uncertain = true }
    }
    if candidate.records.filter({ [.claimReserved, .claimed, .dispatchReserved, .outcomeRecorded, .cancelling].contains($0.phase) }).count > 1 { uncertain = true }
    if uncertain {
      // Missing a single record may hide a dispatched OS request. Retain an
      // irreversible-to-this-package fence, even after core invalidation/rotation.
      try operations.update { journal in
        guard journal == original else { throw FriendLockFailure.storageConflict }
        journal.authorityUncertain = true
      }
      throw FreedAdultLockIntegrationFailure.interruptedOperation
    }
    if candidate != original {
      try operations.update { journal in
        guard journal == original else { throw FriendLockFailure.storageConflict }
        journal = candidate
      }
    }
  }
  private func status(_ operation: FreedAdultOperation) -> FreedAdultOperationStatus {
    FreedAdultOperationStatus(operationID: operation.id, request: operation.request, phase: operation.phase,
      accepted: operation.phase == .completed ? operation.outcome?.accepted : nil, layers: operation.layers)
  }
  func cancel(operationID: String) async throws -> FriendLockReceipt {
    let operation = try current(operationID)
    if operation.phase == .cancelled { return operation.receipt }
    guard [.prepared, .authorized, .claimReserved, .claimed, .cancelling].contains(operation.phase) else { throw FreedAdultLockIntegrationFailure.interruptedOperation }
    // Fence before awaiting core; any suspended authorize/claim CAS must fail.
    var fenced = operation; fenced.phase = .cancelling
    try operations.replace(operation, with: fenced)
    var receipt: FriendLockReceipt
    if operation.authority == .explicitUnenrolledPilot {
      receipt = operation.receipt; receipt.state = .cancelled
    } else { receipt = try await core.cancel(operationID: operationID) }
    try bind(receipt, to: operation)
    var cancelled = fenced; cancelled.receipt = receipt; cancelled.phase = .cancelled
    try operations.replace(fenced, with: cancelled)
    return receipt
  }
  private func fence() throws -> UInt64 {
    var epoch: UInt64 = 0
    try operations.update { journal in
      guard journal.epoch < UInt64.max - 1 else { throw FriendLockFailure.corrupt }
      journal.epoch += 1; epoch = journal.epoch; journal.invalidationPending = true
      for index in journal.records.indices where [.prepared, .authorized, .claimReserved, .claimed].contains(journal.records[index].phase) {
        journal.records[index].phase = .superseded
      }
    }
    return epoch
  }
  private func acknowledgeFence(_ epoch: UInt64) throws {
    try operations.update { journal in
      guard journal.epoch == epoch else { throw FriendLockFailure.storageConflict }
      journal.invalidationPending = false
    }
  }
  // Invalidation/rotation must not erase the only remaining witness of a
  // missing host record. First retain uncertainty in the host journal. Storage
  // failure leaves the already-committed epoch/invalidation fence in place.
  private func preserveMissingHalvesBeforeCoreTransition() throws {
    let journal = try operations.load()
    guard let record = try coreRecords.load() else { return }
    var missing = false
    for receipt in record.operations {
      guard let operation = journal.records.first(where: { $0.id == receipt.operationID }) else { missing = true; continue }
      do { try bind(receipt, to: operation) } catch { missing = true }
    }
    if missing {
      try operations.update { current in
        guard current == journal else { throw FriendLockFailure.storageConflict }
        current.authorityUncertain = true
      }
    }
  }
  enum CleanupInvalidationStatus: String { case pending, acknowledged, unavailable }
  private var cleanupInvalidationTasks: [String: Task<CleanupInvalidationStatus, Error>] = [:]
  func privateCleanupInvalidationStatus(operationID: String) throws -> CleanupInvalidationStatus {
    guard let record = try operations.load().cleanupInvalidations.first(where: { $0.operationID == operationID }) else { return .unavailable }
    return record.acknowledged ? .acknowledged : .pending
  }
  func invalidateForPrivateCleanup(operationID: String) async throws -> CleanupInvalidationStatus {
    if let task = cleanupInvalidationTasks[operationID] { return try await task.value }
    let task = Task { try await self.performPrivateCleanupInvalidation(operationID) }
    cleanupInvalidationTasks[operationID] = task
    defer { cleanupInvalidationTasks.removeValue(forKey: operationID) }
    return try await task.value
  }
  private func performPrivateCleanupInvalidation(_ id: String) async throws -> CleanupInvalidationStatus {
    try FreedAdultExecutor.beginCoreTransition(operations.identity)
    defer { FreedAdultExecutor.endCoreTransition(operations.identity) }
    if try privateCleanupInvalidationStatus(operationID: id) == .acknowledged { return .acknowledged }
    // An ID is a lookup only. Validate the native-issued committed tombstone.
    let native = try FreedAdultConfigurationAccess.withExclusiveAccess { d -> FreedAccountProtectionCleanup.Record in
      let value = try FreedAccountProtectionCleanup.required(id, d)
      guard value.privateStoreErased, try FreedAccountProtectionCleanup.ownsRevokedNamespace(value, d),
        value.nativeEpoch == (try FreedProtectionConfigurationLock.adultMutationEpoch(d)) else { throw FreedAdultLockIntegrationFailure.staleConfiguration }
      return value
    }
    let token = FreedAdultExecutor.beginRevocation(operations.identity)
    var journal = try operations.load()
    var reservation = journal.cleanupInvalidations.first(where: { $0.operationID == id })
    if reservation == nil {
      guard !journal.invalidationPending, let current = try coreRecords.load(),
        current.authorizationGeneration < 9_007_199_254_740_991 else { throw FreedAdultLockIntegrationFailure.interruptedOperation }
      let digest = try freedAdultHash(freedAdultEncode(current), crypto: crypto)
      try operations.update { value in
        guard value == journal, value.epoch < UInt64.max - 1 else { throw FriendLockFailure.storageConflict }
        if value.cleanupInvalidations.count == 32 {
          guard let index = value.cleanupInvalidations.firstIndex(where: { $0.acknowledged }) else { throw FriendLockFailure.authorizationCapacity }
          value.cleanupInvalidations.remove(at: index)
        }
        value.epoch += 1; value.invalidationPending = true
        value.cleanupInvalidations.append(.init(operationID: id, nativeEpoch: native.nativeEpoch!, hostEpoch: value.epoch,
          lockRevision: current.lockRevision, beforeGeneration: current.authorizationGeneration, beforeDigest: digest))
      }
      journal = try operations.load(); reservation = journal.cleanupInvalidations.first(where: { $0.operationID == id })
    }
    guard var reserved = reservation, reserved.nativeEpoch == native.nativeEpoch, journal.epoch == reserved.hostEpoch else { throw FriendLockFailure.storageConflict }
    try preserveMissingHalvesBeforeCoreTransition()
    guard let before = try coreRecords.load(), before.lockRevision == reserved.lockRevision else { throw FreedAdultLockIntegrationFailure.interruptedOperation }
    if before.authorizationGeneration == reserved.beforeGeneration + 1 && before.operations.isEmpty && reserved.dispatchReserved {
      // Lost host acknowledgement: verify the existing transition; never invalidate again.
    } else {
      guard before.authorizationGeneration == reserved.beforeGeneration,
        try freedAdultHash(freedAdultEncode(before), crypto: crypto) == reserved.beforeDigest else { return .pending }
      // Revalidate native ownership immediately before dispatch, without holding
      // configuration exclusion across protected storage or awaits.
      try FreedAdultConfigurationAccess.withExclusiveAccess { d in
        guard try FreedAccountProtectionCleanup.ownsRevokedNamespace(native, d),
          native.nativeEpoch == (try FreedProtectionConfigurationLock.adultMutationEpoch(d)) else { throw FreedAdultLockIntegrationFailure.staleConfiguration }
      }
      if !reserved.dispatchReserved {
        try operations.update { value in
          guard value.epoch == reserved.hostEpoch, let index = value.cleanupInvalidations.firstIndex(where: { $0 == reserved }) else { throw FriendLockFailure.storageConflict }
          value.cleanupInvalidations[index].dispatchReserved = true
        }
        reserved.dispatchReserved = true
      }
      try await core.invalidateAuthorizations()
      guard let after = try coreRecords.load(), after.lockRevision == reserved.lockRevision,
        after.authorizationGeneration == reserved.beforeGeneration + 1, after.operations.isEmpty else { return .pending }
    }
    try operations.update { value in
      guard value.epoch == reserved.hostEpoch, let index = value.cleanupInvalidations.firstIndex(where: { $0 == reserved }) else { throw FriendLockFailure.storageConflict }
      value.cleanupInvalidations[index].acknowledged = true
      value.invalidationPending = false
      for index in value.records.indices where [.prepared, .authorized, .claimReserved, .claimed].contains(value.records[index].phase) {
        value.records[index].phase = .superseded
      }
    }
    FreedAdultExecutor.finishRevocation(operations.identity, token: token)
    return .acknowledged
  }
  func invalidate() async throws {
    try FreedAdultExecutor.beginCoreTransition(operations.identity)
    defer { FreedAdultExecutor.endCoreTransition(operations.identity) }
    if let journal = try? operations.load(), !journal.cleanupInvalidations.allSatisfy({ $0.acknowledged }) { throw FreedAdultLockIntegrationFailure.interruptedOperation }
    let token = FreedAdultExecutor.beginRevocation(operations.identity)
    _ = try await adapter.fenceNativeAuthority()
    let epoch = try fence()
    try preserveMissingHalvesBeforeCoreTransition()
    try await core.invalidateAuthorizations()
    try acknowledgeFence(epoch)
    FreedAdultExecutor.finishRevocation(operations.identity, token: token)
  }
  func rotate(secret: FriendLockSecret, pin: String, confirmation: String) async throws -> FriendLockEnrollment {
    try FreedAdultExecutor.beginCoreTransition(operations.identity)
    defer { FreedAdultExecutor.endCoreTransition(operations.identity) }
    if let journal = try? operations.load(), !journal.cleanupInvalidations.allSatisfy({ $0.acknowledged }) { throw FreedAdultLockIntegrationFailure.interruptedOperation }
    let token = FreedAdultExecutor.beginRevocation(operations.identity)
    _ = try await adapter.fenceNativeAuthority()
    let epoch = try fence()
    try preserveMissingHalvesBeforeCoreTransition()
    let enrollment = try await core.rotate(secret: secret, newPIN: pin, confirmation: confirmation)
    try acknowledgeFence(epoch)
    FreedAdultExecutor.finishRevocation(operations.identity, token: token)
    return enrollment
  }
  private func current(_ id: String) throws -> FreedAdultOperation {
    try FreedAdultExecutor.withNoRevocation(operations.identity) {}
    let journal = try operations.load()
    guard let operation = journal.records.first(where: { $0.id == id }) else { throw FreedAdultLockIntegrationFailure.unknownOperation }
    guard !journal.invalidationPending, !journal.authorityUncertain, operation.epoch == journal.epoch, operation.phase != .superseded else { throw FreedAdultLockIntegrationFailure.staleConfiguration }
    return operation
  }
  private func bind(_ receipt: FriendLockReceipt, to operation: FreedAdultOperation) throws {
    guard receipt.isValid, receipt.operationID == operation.id,
      receipt.deltaDigest == operation.receipt.deltaDigest, receipt.configuration == operation.before.configuration,
      receipt.lockRevision == operation.receipt.lockRevision, receipt.authorizationGeneration == operation.receipt.authorizationGeneration else { throw FriendLockFailure.scopeMismatch }
  }
}

// Constructed only after this file's coordinator has validated the full census,
// inFlight receipt and durable dispatch reservation. A lease alone cannot mint it.
final class FreedAdultMutationExecutionContext {
  let lease: FreedAdultProtectionLegacyGate.WriterLease
  private let original: FreedAdultOperation
  private let operations: FreedAdultProtectionOperationStore
  private let crypto: any FriendLockCrypto
  private let snapshot: () async throws -> FreedNativeAdultSnapshot
  private let validate: () async throws -> FreedAdultOperation
  private let requireUnenrolled: (() throws -> Void)?
  private var previous: FreedNativeAdultSnapshot
  fileprivate init(operation: FreedAdultOperation, lease: FreedAdultProtectionLegacyGate.WriterLease,
                   operations: FreedAdultProtectionOperationStore, crypto: any FriendLockCrypto,
                   snapshot: @escaping () async throws -> FreedNativeAdultSnapshot,
                   validate: @escaping () async throws -> FreedAdultOperation, requireUnenrolled: (() throws -> Void)? = nil) {
    original = operation; self.lease = lease; self.operations = operations; self.crypto = crypto
    self.snapshot = snapshot; self.validate = validate; previous = operation.before
    self.requireUnenrolled = requireUnenrolled
  }
  func reserve(_ layer: FreedAdultLayer) async throws -> FreedAdultLayerPermit {
    try FreedAdultProtectionLegacyGate.requireCurrent(lease)
    let current = try await validate()
    guard current.checkpoints.count < current.request.orderedLayers.count,
      current.request.orderedLayers[current.checkpoints.count] == layer,
      current.checkpoints.allSatisfy({ [.applied, .unchanged].contains($0.state) }) else { throw FreedAdultLockIntegrationFailure.interruptedOperation }
    let observed = try await snapshot()
    guard observed == previous else { throw FreedAdultLockIntegrationFailure.staleConfiguration }
    let canonical = try FreedAdultCanonicalReadback.decode(observed)
    guard canonical.scope == (try FreedAdultCanonicalReadback.decode(original.before)).scope else { throw FreedAdultLockIntegrationFailure.staleConfiguration }
    var desired = observed.policy
    switch layer {
    case .dns:
      desired.encryptedDNS = original.request == .dnsReplace
      if original.request != .dnsReplace { desired.hostedRecoveryDns = nil }
    case .safari: desired.safari = false
    case .risk: desired.riskEnabled = false; desired.riskStartMinute = nil; desired.riskEndMinute = nil
    case .continuous:
      if original.request == .recoveryModeActivate { desired.hostedRecoveryDns = original.dnsCandidate?.identity }
      else { desired.continuous = false; desired.hostedRecoveryDns = nil }
    }
    if desired != observed.policy { desired.revision += 1 }
    let step = FreedAdultCheckpoint(index: current.checkpoints.count, layer: layer,
      operationID: current.id, deltaDigest: current.receipt.deltaDigest, hostEpoch: current.epoch,
      lockRevision: current.receipt.lockRevision, authorizationGeneration: current.receipt.authorizationGeneration,
      nativeScope: canonical.scope, expectedHash: try freedAdultHash(canonical.layers[layer.rawValue]!, crypto: crypto),
      desiredHash: try freedAdultHash(freedAdultEncode(desired), crypto: crypto), state: .reserved)
    var reserved = current; reserved.checkpoints.append(step)
    try operations.replace(current, with: reserved)
    // A second census after snapshot/reservation prevents using an interleaved
    // host transition; native revocation covers the following synchronous gap.
    guard try await validate() == reserved else { throw FriendLockFailure.storageConflict }
    let permit = FreedAdultLayerPermit(request: original.request, lease: lease, step: step, before: observed.policy, desired: desired,
      expectedLayer: canonical.layers[layer.rawValue]!, crypto: crypto, dnsCandidate: original.dnsCandidate, activationProof: original.activationProof, requireUnenrolled: requireUnenrolled)
    try FreedAdultConfigurationAccess.withExclusiveAccess { defaults in
      guard try FreedAdultNativeScope.capture(defaults) == step.nativeScope,
        try FreedRetainedAdultProtection.read(defaults) == observed.policy else { throw FreedAdultLockIntegrationFailure.staleConfiguration }
      defaults.set(try freedAdultEncode(step), forKey: FreedAdultLayerPermit.reservationKey)
    }
    return permit
  }
  func reserveCompensation(_ layer: FreedAdultLayer) async throws -> FreedAdultLayerPermit {
    let current = try await validate()
    guard current.checkpoints.last?.state == .failed, current.compensations.count < current.checkpoints.count,
      current.checkpoints[current.checkpoints.count - 1 - current.compensations.count].layer == layer,
      current.compensations.allSatisfy({ [.applied, .unchanged].contains($0.state) }) else { throw FreedAdultLockIntegrationFailure.interruptedOperation }
    let observed = try await snapshot()
    guard observed == previous else { throw FreedAdultLockIntegrationFailure.staleConfiguration }
    let canonical = try FreedAdultCanonicalReadback.decode(observed)
    guard canonical.scope == (try FreedAdultCanonicalReadback.decode(original.before)).scope else { throw FreedAdultLockIntegrationFailure.staleConfiguration }
    var desired = observed.policy
    switch layer {
    case .dns:
      desired.encryptedDNS = original.before.policy.encryptedDNS
      desired.hostedRecoveryDns = original.before.policy.hostedRecoveryDns
    case .safari: desired.safari = original.before.policy.safari
    case .risk:
      desired.riskEnabled = original.before.policy.riskEnabled
      desired.riskStartMinute = original.before.policy.riskStartMinute; desired.riskEndMinute = original.before.policy.riskEndMinute
    case .continuous:
      desired.continuous = original.before.policy.continuous
      desired.hostedRecoveryDns = desired.encryptedDNS ? original.before.policy.hostedRecoveryDns : nil
    }
    if desired != observed.policy { desired.revision += 1 }
    var step = FreedAdultCheckpoint(index: current.compensations.count, layer: layer, operationID: current.id,
      deltaDigest: current.receipt.deltaDigest, hostEpoch: current.epoch, lockRevision: current.receipt.lockRevision,
      authorizationGeneration: current.receipt.authorizationGeneration, nativeScope: canonical.scope,
      expectedHash: try freedAdultHash(canonical.layers[layer.rawValue]!, crypto: crypto),
      desiredHash: try freedAdultHash(freedAdultEncode(desired), crypto: crypto), state: .reserved)
    step.compensation = true
    var reserved = current; reserved.compensations.append(step)
    try operations.replace(current, with: reserved)
    guard try await validate() == reserved else { throw FriendLockFailure.storageConflict }
    let permit = FreedAdultLayerPermit(request: original.request, lease: lease, step: step, before: observed.policy, desired: desired,
      expectedLayer: canonical.layers[layer.rawValue]!, crypto: crypto, dnsCandidate: original.dnsCandidate, activationProof: original.activationProof, requireUnenrolled: requireUnenrolled)
    try FreedAdultConfigurationAccess.withExclusiveAccess { defaults in
      guard try FreedAdultNativeScope.capture(defaults) == step.nativeScope,
        try FreedRetainedAdultProtection.read(defaults) == observed.policy else { throw FreedAdultLockIntegrationFailure.staleConfiguration }
      defaults.set(try freedAdultEncode(step), forKey: FreedAdultLayerPermit.reservationKey)
    }
    return permit
  }
  func record(_ permit: FreedAdultLayerPermit, state: FreedAdultCheckpointState) async throws -> FreedNativeAdultSnapshot {
    guard state != .reserved else { throw FriendLockFailure.invalidTransition }
    let current = try await validate()
    guard (permit.step.compensation ? current.compensations.last : current.checkpoints.last) == permit.step else { throw FriendLockFailure.storageConflict }
    let observed = try await snapshot()
    guard try FreedAdultCanonicalReadback.decode(observed).scope == permit.step.nativeScope else { throw FreedAdultLockIntegrationFailure.staleConfiguration }
    if [.applied, .unchanged].contains(state), observed.policy != permit.desired { throw FreedAdultLockIntegrationFailure.invalidReadback }
    var updated = current
    let actualLayer = try FreedAdultCanonicalReadback.decode(observed).layers[permit.step.layer.rawValue]!
    guard actualLayer.count <= 3072 else { throw FreedAdultLockIntegrationFailure.invalidReadback }
    let actualObservation = try freedAdultEncode(FreedAdultStepObservation(policy: observed.policy, layer: actualLayer))
    guard actualObservation.count <= 4096 else { throw FreedAdultLockIntegrationFailure.invalidReadback }
    if permit.step.compensation {
      updated.compensations[permit.step.index].state = state
      updated.compensations[permit.step.index].observation = actualObservation
      updated.compensations[permit.step.index].observedHash = try freedAdultHash(observed.nativeReadback, crypto: crypto)
    } else {
      updated.checkpoints[permit.step.index].state = state
      updated.checkpoints[permit.step.index].observation = actualObservation
      updated.checkpoints[permit.step.index].observedHash = try freedAdultHash(observed.nativeReadback, crypto: crypto)
    }
    try operations.replace(current, with: updated)
    permit.retire()
    previous = observed
    return observed
  }
  func validateFinal(_ current: FreedAdultOperation, result: FreedNativeAdultMutationResult) throws {
    try current.validateCheckpoints(using: crypto)
    guard !current.checkpoints.isEmpty, current.checkpoints.allSatisfy({ $0.state != .reserved && $0.state != .uncertain }),
      (current.compensations.last ?? current.checkpoints.last)?.observedHash == (try freedAdultHash(result.resultingSnapshot.nativeReadback, crypto: crypto)) else { throw FreedAdultLockIntegrationFailure.invalidReadback }
    var summary = FreedAdultLayerStages()
    for step in current.checkpoints {
      switch step.state {
      case .applied: summary.set(step.layer, .observedApplied)
      case .unchanged: summary.set(step.layer, .observedUnchanged)
      case .failed: summary.set(step.layer, .failed)
      default: throw FreedAdultLockIntegrationFailure.invalidReadback
      }
    }
    guard summary == result.layers else { throw FreedAdultLockIntegrationFailure.invalidReadback }
    guard current.compensations.allSatisfy({ $0.state != .reserved && $0.state != .uncertain }) else { throw FreedAdultLockIntegrationFailure.invalidReadback }
    if result.accepted {
      guard current.compensations.isEmpty, current.checkpoints.count == current.request.orderedLayers.count,
        current.checkpoints.allSatisfy({ [.applied, .unchanged].contains($0.state) }) else { throw FreedAdultLockIntegrationFailure.invalidReadback }
    }
  }
}

// This is a synchronous, exact lower-layer capability; it cannot be decoded or
// initialized by an adapter, an operation ID, or a held writer lease.
final class FreedAdultLayerPermit {
  let request: FreedAdultChangeRequest
  let lease: FreedAdultProtectionLegacyGate.WriterLease
  let step: FreedAdultCheckpoint
  let before: FreedRetainedAdultProtection.Policy
  let desired: FreedRetainedAdultProtection.Policy
  let expectedLayer: Data
  let dnsCandidate: FreedRecoveryDnsCandidate?
  let activationProof: FreedRecoveryDnsActivationProof?
  private let requireUnenrolled: (() throws -> Void)?
  private let crypto: any FriendLockCrypto
  private let mutex = NSLock()
  static let reservationKey = "freed.deviceAdult.reservation.v1"
  private var active = true
  private var dispatched = false
  fileprivate init(request: FreedAdultChangeRequest, lease: FreedAdultProtectionLegacyGate.WriterLease, step: FreedAdultCheckpoint,
                   before: FreedRetainedAdultProtection.Policy, desired: FreedRetainedAdultProtection.Policy,
                   expectedLayer: Data, crypto: any FriendLockCrypto, dnsCandidate: FreedRecoveryDnsCandidate? = nil, activationProof: FreedRecoveryDnsActivationProof? = nil, requireUnenrolled: (() throws -> Void)? = nil) {
    self.request = request; self.lease = lease; self.step = step; self.before = before; self.desired = desired
    self.expectedLayer = expectedLayer; self.crypto = crypto
    self.dnsCandidate = dnsCandidate
    self.activationProof = activationProof
    self.requireUnenrolled = requireUnenrolled
  }
  fileprivate func retire() { mutex.lock(); active = false; mutex.unlock() }
  func validate(_ defaults: UserDefaults, layer: FreedAdultLayer, observed: Data, published: Bool = false) throws {
    mutex.lock(); let active = self.active; mutex.unlock()
    guard active, FreedProtectionConfigurationLock.isInsideExclusiveAccess, layer == step.layer,
      try FreedAdultNativeScope.capture(defaults) == step.nativeScope,
      defaults.data(forKey: Self.reservationKey) == (try freedAdultEncode(step)),
      try FreedRetainedAdultProtection.read(defaults) == (published ? desired : before),
      published || observed == expectedLayer else { throw FreedAdultLockIntegrationFailure.staleConfiguration }
    try FreedAdultProtectionLegacyGate.requireCurrent(lease)
    try requireUnenrolled?()
    if [.dnsReplace, .recoveryModeActivate].contains(request), !step.compensation {
      guard let dnsCandidate else { throw FreedAdultLockIntegrationFailure.authorizationRequired }
      try FreedRecoveryDnsPilotBoundary.requireCurrent(dnsCandidate, defaults)
    }
  }
  func beginDispatch(_ defaults: UserDefaults, layer: FreedAdultLayer, observed: Data) throws {
    try validate(defaults, layer: layer, observed: observed)
    mutex.lock(); defer { mutex.unlock() }
    guard !dispatched else { throw FreedAdultLockIntegrationFailure.interruptedOperation }
    dispatched = true
  }
  func publish(_ defaults: UserDefaults, layer: FreedAdultLayer, observed: Data) throws {
    try validate(defaults, layer: layer, observed: observed)
    try FreedRetainedAdultProtection.stage(desired, defaults)
    try FreedRetainedAdultProtection.acknowledged(defaults, expected: desired)
  }
  var identity: String { "enrolled:" + (step.compensation ? "compensation:" : "forward:") + step.operationID + ":" + String(step.index) + ":" + String(step.hostEpoch) + ":" + String(step.nativeScope.nativeEpoch) }
}
