import Foundation
import CryptoKit

final class FixtureOperationBytes: FreedAdultOperationBytes {
  let identity = UUID().uuidString
  var values: [String: Data] = [:]
  var failCleanupAcknowledgement = false
  var failCheckpointState: FreedAdultCheckpointState?
  var throwAfterCheckpointState: FreedAdultCheckpointState?
  var failPhase: FreedAdultOperationPhase?
  var dropPhase: FreedAdultOperationPhase?
  var unavailable = false
  var throwAfterPhase: FreedAdultOperationPhase?
  func beginAccess() throws { if unavailable { throw FriendLockFailure.storageUnavailable } }
  func endAccess() {}
  func read(_ key: String) throws -> Data? { precondition(!FreedProtectionConfigurationLock.isInsideExclusiveAccess, "Protected friend record read must precede configuration exclusion"); if unavailable { throw FriendLockFailure.storageUnavailable }; return values[key] }
  func write(_ key: String, data: Data) throws {
    if key == "operations", let journal = try? JSONDecoder().decode(FreedAdultProtectionOperationStore.Journal.self, from: data) {
      if failCleanupAcknowledgement, journal.cleanupInvalidations.last?.acknowledged == true { throw FriendLockFailure.commitOutcomeUnknown }
      if let failCheckpointState, journal.records.contains(where: {$0.phase == .dispatchReserved && $0.checkpoints.last?.state == failCheckpointState}) { throw FriendLockFailure.storageUnavailable }
      if let failPhase, journal.records.contains(where: { $0.phase == failPhase }) { throw FriendLockFailure.storageUnavailable }
      if let dropPhase, journal.records.contains(where: { $0.phase == dropPhase }) { return }
    }
    values[key] = data
    if key == "operations", let throwAfterCheckpointState,
      let journal = try? JSONDecoder().decode(FreedAdultProtectionOperationStore.Journal.self, from: data),
      journal.records.contains(where: {$0.phase == .dispatchReserved && $0.checkpoints.last?.state == throwAfterCheckpointState}) { throw FriendLockFailure.commitOutcomeUnknown }
    if key == "operations", let throwAfterPhase,
      let journal = try? JSONDecoder().decode(FreedAdultProtectionOperationStore.Journal.self, from: data),
      journal.records.contains(where: { $0.phase == throwAfterPhase }) { throw FriendLockFailure.commitOutcomeUnknown }
  }
}
final class FixtureBytes: FriendLockProtectedBytes {
  var values: [String: Data] = [:]
  var unavailable = false
  var failedWrite: String?
  var throwAfterCompletedCommit = false
  func read(_ key: String) throws -> Data? { precondition(!FreedProtectionConfigurationLock.isInsideExclusiveAccess, "Protected friend record read must precede configuration exclusion"); if unavailable { throw FriendLockFailure.storageUnavailable }; return values[key] }
  func write(_ key: String, _ data: Data) throws {
    if unavailable || failedWrite == key { throw FriendLockFailure.storageUnavailable }
    values[key] = data
    if throwAfterCompletedCommit, key == "journal",
      let object = try? JSONSerialization.jsonObject(with: data) as? [String: Any], object["phase"] as? String == "committed",
      let encoded = object["candidate"] as? String, let candidate = Data(base64Encoded: encoded),
      let record = try? JSONDecoder().decode(FriendLockRecord.self, from: candidate), record.operations.contains(where: { $0.state == .completed }) {
      throw FriendLockFailure.commitOutcomeUnknown
    }
  }
  func remove(_ key: String) throws { values.removeValue(forKey: key) }
}
struct FixtureCrypto: FriendLockCrypto {
  func random(_ count: Int) throws -> Data { Data((0..<count).map { _ in UInt8.random(in: 0...255) }) }
  func digest(_ data: Data) throws -> Data { Data(SHA256.hash(data: data)) }
  func derive(_ secret: String, salt: Data) throws -> Data {
    precondition(!Thread.isMainThread, "KDF must remain off main")
    return try digest(salt + Data(secret.utf8))
  }
}
final class FixtureAdapter: FreedNativeAdultMutationAdapter {
  let mutex = NSLock()
  var state: FreedNativeAdultSnapshot
  let configurationDirectory = FileManager.default.temporaryDirectory.appendingPathComponent("freed-c2-fixture-" + UUID().uuidString)
  var calls = 0
  var failure = false
  var partial = false
  var callback: CheckedContinuation<Void, Never>?
  var deferred = false
  var snapshotHook: (() async throws -> Void)?
  init() throws {
    state = FreedNativeAdultSnapshot(configuration: try FriendLockConfiguration(revision: "1", mutationGeneration: "1"),
      policy: FreedRetainedAdultProtection.Policy(continuous: true, encryptedDNS: true, safari: true, riskEnabled: false),
      nativeReadback: Self.readback("all-layers-installed"))
    try FileManager.default.createDirectory(at: configurationDirectory, withIntermediateDirectories: true)
  }
  static func readback(_ label: String) -> Data {
    try! freedAdultEncode(FreedAdultCanonicalReadback(scope: FreedAdultNativeScope(generation: 0, nativeEpoch: 0, appScopeEpoch: 1),
      layers: Dictionary(uniqueKeysWithValues: FreedAdultLayer.allCases.map { ($0.rawValue, Data(label.utf8)) })))
  }
  func snapshot(lease: FreedAdultProtectionLegacyGate.WriterLease) async throws -> FreedNativeAdultSnapshot {
    try FreedAdultProtectionLegacyGate.requireCurrent(lease)
    let value = try await snapshot()
    FreedAdultConfigurationAccess.fixtureContainer = configurationDirectory
    try FreedAdultConfigurationAccess.withExclusiveAccess { defaults in
      try FreedRetainedAdultProtection.stage(value.policy, defaults)
      defaults.set(try JSONSerialization.data(withJSONObject: ["scopeEpoch": 1]), forKey: "freed.appGroups.v1")
    }
    return value
  }
  func fenceNativeAuthority() async throws -> Int {
    FreedAdultConfigurationAccess.fixtureContainer = configurationDirectory
    return try FreedAdultConfigurationAccess.withExclusiveAccess { try FreedProtectionConfigurationLock.fenceAdultMutations($0) }
  }
  func snapshot() async throws -> FreedNativeAdultSnapshot { if let snapshotHook { try await snapshotHook() }; return capture() }
  func capture() -> FreedNativeAdultSnapshot { mutex.lock(); defer { mutex.unlock() }; return state }
  func begin(_ expected: FreedNativeAdultSnapshot) throws -> Bool {
    mutex.lock(); defer { mutex.unlock() }
    guard state.configuration == expected.configuration else { throw FreedAdultLockIntegrationFailure.staleConfiguration }
    calls += 1; return deferred
  }
  func perform(operation: FreedAdultOperation, context: FreedAdultMutationExecutionContext) async throws -> FreedNativeAdultMutationResult {
    let action = operation.request.action, expected = operation.before
    let permit = try await context.reserve(operation.request.orderedLayers[0])
    let shouldDefer = try begin(expected)
    if shouldDefer { await withCheckedContinuation { continuation in mutex.lock(); callback = continuation; mutex.unlock() } }
    // Actual adapter contract: re-check native generation at callback before OS/policy mutation.
    let result = try finish(action, expected)
    _ = try await context.record(permit, state: failure ? .failed : .applied)
    if partial {
      let failed = try await context.reserve(.safari)
      _ = try await context.record(failed, state: .failed)
    }
    return result
  }
  func finish(_ action: FriendLockAction, _ expected: FreedNativeAdultSnapshot) throws -> FreedNativeAdultMutationResult {
    mutex.lock(); defer { mutex.unlock() }
    guard state.configuration == expected.configuration else { throw FreedAdultLockIntegrationFailure.staleConfiguration }
    if failure { return FreedNativeAdultMutationResult(accepted: false, stage: .osReadbackFailed, resultingSnapshot: state, layers: .init(continuous: .failed)) }
    var policy = state.policy
    if partial {
      policy.encryptedDNS = false; policy.revision += 1
      state = FreedNativeAdultSnapshot(configuration: try FriendLockConfiguration(revision: String(policy.revision), mutationGeneration: "2"), policy: policy, nativeReadback: Self.readback("partial-dns-only-readback"))
      return FreedNativeAdultMutationResult(accepted: false, stage: .partial, resultingSnapshot: state,
        layers: .init(dns: .observedApplied, safari: .failed))
    }
    if action == .disableAdultFilter { policy.continuous = false }
    if action == .disableEncryptedDNS { policy.encryptedDNS = false }
    if policy != state.policy { policy.revision += 1 }
    state = FreedNativeAdultSnapshot(configuration: try FriendLockConfiguration(revision: String(policy.revision), mutationGeneration: "2"), policy: policy, nativeReadback: Self.readback("post-mutation-readback"))
    return FreedNativeAdultMutationResult(accepted: true, stage: .readback, resultingSnapshot: state, layers: action == .disableEncryptedDNS ? .init(dns: .observedApplied) : .init(continuous: .observedApplied))
  }
  func repair() throws {
    mutex.lock(); defer { mutex.unlock() }
    state = FreedNativeAdultSnapshot(configuration: try FriendLockConfiguration(revision: "repair", mutationGeneration: "3"), policy: state.policy, nativeReadback: Self.readback("stronger-repair"))
  }
  func releaseCallback() -> Bool {
    mutex.lock(); let continuation = callback; callback = nil; mutex.unlock()
    continuation?.resume(); return continuation != nil
  }
  func waiting() -> Bool { mutex.lock(); defer { mutex.unlock() }; return callback != nil }
}
func expect(_ condition: Bool, _ message: String) { precondition(condition, message) }
func rejects(_ label: String, _ body: () async throws -> Void) async {
  do { try await body(); preconditionFailure("Expected rejection: \(label)") } catch { }
}
var fixtureCoreRecords: [ObjectIdentifier: FriendLockRecordStore] = [:]
var fixtureOperations: [ObjectIdentifier: FreedAdultProtectionOperationStore] = [:]
var fixtureOperationBytes: [ObjectIdentifier: FixtureOperationBytes] = [:]
func freshCore() async throws -> (FriendLockCore, FixtureBytes, FriendLockRecordStore) {
  let bytes = FixtureBytes()
  let actual = FriendLockRecordStore(bytes: bytes)
  let core = FriendLockCore(store: actual, crypto: FixtureCrypto())
  let operationBytes = FixtureOperationBytes()
  let operations = FreedAdultProtectionOperationStore(bytes: operationBytes, crypto: FixtureCrypto())
  try await operations.initializeBeforeEnrollment(core: core)
  fixtureCoreRecords[ObjectIdentifier(core)] = actual
  fixtureOperations[ObjectIdentifier(core)] = operations
  fixtureOperationBytes[ObjectIdentifier(core)] = operationBytes
  return (core, bytes, actual)
}
func enroll(_ core: FriendLockCore, _ adapter: FixtureAdapter) async throws {
  _ = try await core.enroll(pin: "123456", confirmation: "123456", baseline: FriendLockBaseline(configuration: adapter.capture().configuration, adultProtectionInstalled: true, nativeReadback: adapter.capture().nativeReadback))
}
final class DroppedRetainedWriteDefaults: UserDefaults {
  var dropRetainedWrites = false
  override func set(_ value: Any?, forKey key: String) {
    if key == FreedRetainedAdultProtection.key && dropRetainedWrites { return }
    super.set(value, forKey: key)
  }
}
func runFix1Cases(_ parent: URL) async throws {
  let emptyStore = FriendLockRecordStore(bytes: FixtureBytes())
  FreedAdultProtectionLegacyGate.fixtureStore = emptyStore
  try FreedAdultProtectionLegacyGate.requireUnenrolled()
  let missingDomain = "freed.fix1.missing.\(UUID().uuidString)"
  let container = parent.appendingPathComponent("fix1-valid-container")
  try FileManager.default.createDirectory(at: container, withIntermediateDirectories: true)
  let installed = StubFilter.auto(Set<WebDomain>(), except: Set<WebDomain>())
  try FreedProtectionConfigurationLock.withExclusiveAccess(containerOverride: container, domain: missingDomain) { d in
    let monitor = MonitorAdultBoundary(defaults: d)
    monitor.store.webContent.blockedByFilter = installed
    let monitorAcknowledged = monitor.applyWebContentFilterForCurrentState()
    expect(monitor.store.webContent.blockedByFilter == installed, "Missing retained baseline must preserve installed filter")
    expect(!monitorAcknowledged, "Unknown monitor baseline must return failure status")
    let host = AdultMutationBoundary(defaults: d)
    host.store.webContent.blockedByFilter = installed
    expect(!host.applyWebContentFilterForCurrentState(), "Unknown host baseline must return failure status")
    expect(host.store.webContent.blockedByFilter == installed, "Actual host consumer must preserve installed filter on absent baseline")
    do { _ = try FreedRetainedAdultProtection.read(d); preconditionFailure("Missing native baseline must be unknown") } catch FreedRetainedAdultProtection.Failure.baselineUnknown { }
    let firstInstall = MonitorAdultBoundary(defaults: d)
    firstInstall.applyWebContentFilterForCurrentState()
    expect(firstInstall.store.webContent.blockedByFilter == nil, "Unknown first install must not manufacture an OS policy")
    let empty = FreedRetainedAdultProtection.Policy(continuous: false, encryptedDNS: false, safari: false, riskEnabled: false)
    try FreedRetainedAdultProtection.stage(empty, d)
    try FreedRetainedAdultProtection.acknowledged(d, expected: empty)
    monitor.applyWebContentFilterForCurrentState()
    expect(monitor.store.webContent.blockedByFilter == nil, "Explicit native acknowledged-empty policy may clear the filter")
  }
  // File ENOENT in an available container is the review's real missing-file path.
  try FileManager.default.removeItem(at: container.appendingPathComponent(FreedProtectionConfigurationLock.stateFileName))
  try FreedProtectionConfigurationLock.withExclusiveAccess(containerOverride: container, domain: missingDomain) { d in
    let monitor = MonitorAdultBoundary(defaults: d)
    monitor.store.webContent.blockedByFilter = installed
    monitor.clearOwnedProtection()
    expect(monitor.store.webContent.blockedByFilter == installed, "Missing atomic file in available container must preserve installed filter")
  }
  let absent = UserDefaults(suiteName: "freed.fix1.absent.\(UUID().uuidString)")!
  let absentCaller = AdultMutationBoundary(defaults: absent)
  absentCaller.store.webContent.blockedByFilter = installed
  expect(absentCaller.stopAdult()["nativeConfigurationOperationAccepted"] as? Bool == false && absentCaller.store.webContent.blockedByFilter == installed, "Full adult stop must reject unknown retained baseline")
  let absentStopCount = DeviceActivityCenter.stopped
  expect(absentCaller.stopRisk()["nativeConfigurationOperationAccepted"] as? Bool == false && DeviceActivityCenter.stopped == absentStopCount, "Full risk stop must reject unknown baseline before OS dispatch")
  let corrupt = UserDefaults(suiteName: "freed.fix1.corrupt.\(UUID().uuidString)")!
  corrupt.set(true, forKey: "freed.adultFilterActive")
  corrupt.set(true, forKey: "freed.riskWindowActive")
  corrupt.set(true, forKey: "freed.riskWindow.currentlyActive")
  let expectedRisk = Data("prior-risk-intent".utf8)
  corrupt.set(expectedRisk, forKey: "freed.riskWindow.expected.v1")
  corrupt.set(Data("corrupt".utf8), forKey: FreedRetainedAdultProtection.key)
  let rejected = AdultMutationBoundary(defaults: corrupt)
  rejected.store.webContent.blockedByFilter = installed
  let stopAdult = rejected.stopAdult()
  expect(stopAdult["nativeConfigurationOperationAccepted"] as? Bool == false, "Corrupt retained storage must reject full adult stop caller")
  expect((stopAdult["nativeConfigurationDiagnostics"] as? [String: Any])?["stage"] as? String == "retained-policy-read", "Full caller must return retained-read failure stage")
  expect(corrupt.bool(forKey: "freed.adultFilterActive") && rejected.store.webContent.blockedByFilter == installed && rejected.selectedShieldWrites == 0, "Corrupt adult stop must retain intent and dispatch no OS mutations")
  let beforeStops = DeviceActivityCenter.stopped
  let stopRisk = rejected.stopRisk()
  expect(stopRisk["nativeConfigurationOperationAccepted"] as? Bool == false, "Corrupt retained storage must reject full risk stop caller")
  expect(corrupt.bool(forKey: "freed.riskWindowActive") && corrupt.bool(forKey: "freed.riskWindow.currentlyActive") && corrupt.data(forKey: "freed.riskWindow.expected.v1") == expectedRisk && DeviceActivityCenter.stopped == beforeStops, "Corrupt risk stop must retain all intent and dispatch no monitor stop")
  let writes = DroppedRetainedWriteDefaults(suiteName: "freed.fix1.dropped.\(UUID().uuidString)")!
  writes.set(true, forKey: "freed.adultFilterActive"); writes.set(true, forKey: "freed.riskWindowActive")
  let prior = FreedRetainedAdultProtection.Policy(continuous: true, encryptedDNS: true, safari: true, riskEnabled: true)
  try FreedRetainedAdultProtection.stage(prior, writes)
  writes.dropRetainedWrites = true
  let rejectedWrite = AdultMutationBoundary(defaults: writes)
  rejectedWrite.store.webContent.blockedByFilter = installed
  let dropped = rejectedWrite.stopAdult()
  expect(dropped["nativeConfigurationOperationAccepted"] as? Bool == false && writes.bool(forKey: "freed.adultFilterActive"), "Failed retained write/readback must reject before adult intent changes")
  expect((dropped["nativeConfigurationDiagnostics"] as? [String: Any])?["stage"] as? String == "retained-policy-commit", "Failed retained write must report commit stage")
  expect(rejectedWrite.store.webContent.blockedByFilter == installed && rejectedWrite.selectedShieldWrites == 0, "Failed retained write must preserve OS filter")
  let droppedRisk = rejectedWrite.stopRisk()
  expect(droppedRisk["nativeConfigurationOperationAccepted"] as? Bool == false && writes.bool(forKey: "freed.riskWindowActive") && DeviceActivityCenter.stopped == beforeStops, "Failed retained write must reject before risk monitor dispatch")
  let fresh = UserDefaults(suiteName: "freed.fix1.first-strengthening.\(UUID().uuidString)")!
  let first = AdultMutationBoundary(defaults: fresh)
  var observations = 0
  FreedAdultProtectionNativeObservation.fixtureCapture = { _ in
    observations += 1
    return .init(continuous: first.store.webContent.blockedByFilter != nil, encryptedDNS: false, safari: false, riskEnabled: false)
  }
  try first.setAdultFilterActive(true)
  first.applyWebContentFilterForCurrentState()
  expect(observations == 1 && first.store.webContent.blockedByFilter != nil, "First strengthening must initialize from explicit native observation")
  let paused = first.stopAdult()
  expect(paused["active"] as? Bool == false && first.store.webContent.blockedByFilter == nil, "Explicit positively-unenrolled stop after acknowledgment retains normal behavior")
  FreedAdultProtectionNativeObservation.fixtureCapture = nil

  // Real atomic replacement failure: retain the old inode in scratch, obstruct
  // publication, and verify the full caller cannot reach its OS stop phase.
  let writeDomain = "freed.fix1.atomic-write.\(UUID().uuidString)"
  let writeContainer = parent.appendingPathComponent("fix1-atomic-write")
  try FileManager.default.createDirectory(at: writeContainer, withIntermediateDirectories: true)
  try FreedProtectionConfigurationLock.withExclusiveAccess(containerOverride: writeContainer, domain: writeDomain) { d in
    d.set(true, forKey: "freed.adultFilterActive");d.set(true, forKey: "freed.riskWindowActive")
    d.set(expectedRisk, forKey: "freed.riskWindow.expected.v1")
    try FreedRetainedAdultProtection.stage(prior, d)
  }
  let stateURL = writeContainer.appendingPathComponent(FreedProtectionConfigurationLock.stateFileName)
  let preservedURL = writeContainer.appendingPathComponent("preserved-original.plist")
  let oldData = try Data(contentsOf: stateURL)
  let atomic = AdultMutationBoundary(defaults: fresh, container: writeContainer, domain: writeDomain)
  atomic.store.webContent.blockedByFilter = installed
  atomic.onTransactionStart = { _ in
    try! FileManager.default.moveItem(at: stateURL, to: preservedURL)
    try! FileManager.default.createDirectory(at: stateURL, withIntermediateDirectories: false)
  }
  let publicationFailure = atomic.stopRisk()
  expect(publicationFailure["nativeConfigurationOperationAccepted"] as? Bool == false && DeviceActivityCenter.stopped == beforeStops, "Actual atomic write failure must reject full risk caller before OS dispatch")
  expect(atomic.store.webContent.blockedByFilter == installed && atomic.selectedShieldWrites == 0, "Actual atomic write failure preserves OS layer")
  try FileManager.default.removeItem(at: stateURL)
  try FileManager.default.moveItem(at: preservedURL, to: stateURL)
  expect(try Data(contentsOf: stateURL) == oldData, "Failed atomic publication must not mutate prior durable intent")
  print("Task72 Fix1 actual missing-state consumers / full stop callers / write failures: PASS")
}

actor C1HeldWriter {
  var started = false
  var callback: CheckedContinuation<Void, Never>?
  func hold() async { started = true; await withCheckedContinuation { callback = $0 } }
  func release() { callback?.resume(); callback = nil }
}
func runC1AdmissionCases(_ directory: URL) async throws {
  FreedAdultProtectionLegacyGate.fixtureStore = FriendLockRecordStore(bytes: FixtureBytes())
  let holder = C1HeldWriter()
  let task = FreedAdultProtectionLegacyGate.enqueueLegacy(key: "c1-held") { _ in await holder.hold(); return ["settled": true] }
  for _ in 0..<1000 { if await holder.started { break }; await Task.yield() }
  expect(await holder.started, "Fixture must hold actual outer writer admission")
  let d = UserDefaults(suiteName: "freed.c1.busy.\(UUID().uuidString)")!
  let policy = FreedRetainedAdultProtection.Policy(continuous: true, encryptedDNS: true, safari: true, riskEnabled: true)
  try FreedRetainedAdultProtection.stage(policy, d)
  d.set(true, forKey: "freed.adultFilterActive"); d.set(true, forKey: "freed.riskWindowActive")
  let lower = AdultMutationBoundary(defaults: d)
  lower.store.webContent.blockedByFilter = .auto(Set<WebDomain>(), except: Set<WebDomain>())
  let stops = DeviceActivityCenter.stopped
  expect(lower.stopAdult()["nativeConfigurationError"] as? String == "adult-writer-busy", "Actual synchronous continuous stop must reject conflicting async writer")
  expect(lower.stopRisk()["nativeConfigurationError"] as? String == "adult-writer-busy", "Actual synchronous risk stop must reject conflicting async writer")
  expect(lower.store.webContent.blockedByFilter != nil && DeviceActivityCenter.stopped == stops, "Busy admission cannot mutate a lower OS layer")
  let container = directory.appendingPathComponent("c1-epoch")
  try FileManager.default.createDirectory(at: container, withIntermediateDirectories: true)
  let domain = "freed.c1.epoch.\(UUID().uuidString)"
  let epoch = try FreedProtectionConfigurationLock.withExclusiveAccess(containerOverride: container, domain: domain) { defaults in try FreedProtectionConfigurationLock.fenceAdultMutations(defaults) }
  expect(epoch == 1, "Short durable epoch fence must not wait for an async writer")
  let reloaded = try FreedProtectionConfigurationLock.withExclusiveAccess(containerOverride: container, domain: domain) { try FreedProtectionConfigurationLock.adultMutationEpoch($0) }
  expect(reloaded == epoch, "Native epoch fence must survive a fresh file read")
  await holder.release(); _ = await task.value
  try FreedAdultProtectionLegacyGate.withWriter {
    try FreedProtectionConfigurationLock.withExclusiveAccess(containerOverride: container, domain: domain) { _ in try FreedAdultProtectionLegacyGate.requireUnenrolled() }
  }
  do {
    try FreedProtectionConfigurationLock.withExclusiveAccess(containerOverride: container, domain: domain) { _ in try FreedAdultProtectionLegacyGate.requireUnenrolled() }
    preconditionFailure("Unadmitted lower call may not acquire protected storage while configuration is excluded")
  } catch FriendLockFailure.storageConflict { }
  print("C1 actual adult entrances: synchronous busy, untouched OS layers, independent durable epoch and no nested protected-record lock: PASS")
}

@main struct AdultLockIntegrationCases {
  static func main() async throws {
    let temporary = FileManager.default.temporaryDirectory.appendingPathComponent("freed-task72-\(UUID().uuidString)")
    if CommandLine.arguments.contains("--c2-fix1-only") {
      let mode = CommandLine.arguments.first(where: { $0.hasPrefix("--c2-fix1-mode=") }).map { String($0.dropFirst("--c2-fix1-mode=".count)) } ?? "preserve"
      try await runC2RiskOnlyCompensationCase(temporary, mode: mode)
      try? FileManager.default.removeItem(at: temporary)
      return
    }
    try FileManager.default.createDirectory(at: temporary, withIntermediateDirectories: true)
    defer { try? FileManager.default.removeItem(at: temporary) }
    if CommandLine.arguments.contains("--task82-only") { try await runAccountCleanupCoreCases(temporary);return }
    try await runAccountCleanupCoreCases(temporary)
    try await runFix1Cases(temporary)
    try await runC1AdmissionCases(temporary)
    try await runTask79BFix1Cases()
    try await runTask79BCases(temporary)
    let (core, bytes, store) = try await freshCore(), adapter = try FixtureAdapter()
    try await enroll(core, adapter)
    FreedAdultProtectionLegacyGate.fixtureStore = store
    let gate = FreedAdultProtectionLegacyGate(store: store)
    await rejects("enrolled lower gate") { try gate.requireUnenrolled() }
    let defaults = UserDefaults(suiteName: "freed.task72.fixture.\(UUID().uuidString)")!
    defaults.set(true, forKey: "freed.adultFilterActive")
    expect(!FreedProtectionResetPolicy.persistEmptyConfiguration(in: defaults, domain: "fixture"), "Enrolled legacy reset must reject before intent mutation")
    expect(defaults.bool(forKey: "freed.adultFilterActive"), "Enrolled legacy reset must retain adult intent")
    let lower = AdultMutationBoundary(defaults: defaults)
    await rejects("Actual lower adult setter must propagate denial") { try lower.setAdultFilterActive(false) }
    expect(defaults.bool(forKey: "freed.adultFilterActive"), "Actual lower adult setter must retain enrolled intent")
    await rejects("Actual lower risk setter must propagate denial") { try lower.setRiskWindowMonitoringActive(false) }
    // Missing, corrupt and unavailable storage all reject. No permissive nil conversion.
    let prior = bytes.values
    for mode in 0..<3 {
      bytes.values = prior; bytes.unavailable = mode == 0
      if mode == 1 { bytes.values.removeValue(forKey: "record") }
      if mode == 2 { bytes.values["journal"] = Data("corrupt".utf8) }
      await rejects("secure storage failure \(mode)") { try gate.requireUnenrolled() }
      expect(!FreedProtectionResetPolicy.persistEmptyConfiguration(in: defaults, domain: "fixture"), "Unavailable lower reset must reject")
    }
    bytes.values = prior; bytes.unavailable = false
    let manager = NEDNSSettingsManager.shared()
    await MainActor.run {
      manager.storedSettings = NEDNSOverHTTPSSettings(servers: ["1.1.1.3"])
      manager.storedEnabled = true
    }
    let rejectedDNS = await FreedEncryptedDnsController.shared.configure(enabled: false)
    expect(rejectedDNS["operationAccepted"] as? Bool == false, "Actual lower DNS disable rejects enrolled storage")
    let rejectedResetDNS = await FreedEncryptedDnsController.shared.resetConfiguration()
    expect(rejectedResetDNS["removed"] as? Bool == false, "Actual lower DNS reset rejects enrolled storage")
    let removeCount = manager.removeCount
    expect(removeCount == 0, "Unauthorized legacy DNS must never dispatch OS removal")
    await MainActor.run {
      DnsFixtureConfigurationLock.d.set(true, forKey: "freed.encryptedDns.cloudflareFamilies.configured")
      manager.afterSave = {
        DnsFixtureConfigurationLock.gen += 1
        DnsFixtureConfigurationLock.reset = true
      }
    }
    let staleDNS = await FreedEncryptedDnsController.shared.configure(enabled: true)
    expect(staleDNS["operationAccepted"] as? Bool == false, "Deferred DNS save reports stale account/repair generation")
    expect(manager.removeCount == 0 && manager.storedSettings != nil, "Actual late DNS callback cannot remove the stronger OS layer")
    await MainActor.run { DnsFixtureConfigurationLock.reset = false }

    let safariPath = temporary.appendingPathComponent("safari-fixture.json")
    let oldSafari = Data(#"[{"trigger":{"url-filter":"adult-a"},"action":{"type":"block"}},{"trigger":{"url-filter":"adult-b"},"action":{"type":"block"}}]"#.utf8)
    try oldSafari.write(to: safariPath)
    defaults.set(2, forKey: "freed.safariContentBlocker.ruleCount")
    let safari = SafariMutationBoundary(defaults: defaults, path: safariPath)
    await rejects("Actual Safari reduction gate") {
      _ = try safari.configureSafariContentBlockerRulesFile(rulesJson: #"[{"trigger":{"url-filter":"adult-a"},"action":{"type":"block"}}]"#, version: "v2", checksum: "caller-checksum", generatedAt: "now")
    }
    expect(try Data(contentsOf: safariPath) == oldSafari, "Unauthorized Safari publication preserves prior bytes")
    _ = try safari.configureSafariContentBlockerRulesFile(rulesJson: String(decoding: oldSafari, as: UTF8.self), version: "v2", checksum: "caller-checksum", generatedAt: "now")
    expect(try Data(contentsOf: safariPath) == oldSafari, "Locked exact Safari repair remains usable")
    let coordinator = FreedAdultProtectionLockCoordinator(core: core, crypto: FixtureCrypto(), adapter: adapter, operations: fixtureOperations[ObjectIdentifier(core)]!, coreRecords: fixtureCoreRecords[ObjectIdentifier(core)]!)
    await rejects("disabled native enrollment") { _ = try await coordinator.enroll(pin: "654321", confirmation: "654321") }
    expect(!FreedAdultProtectionLockCoordinator.mutationEnforcementAvailable, "Public enforcement must remain disabled")
    let prepared = try await coordinator.prepare(action: .disableAdultFilter)
    await rejects("wrong PIN") { _ = try await coordinator.authorize(operationID: prepared.operationID, pin: "000000") }
    expect(adapter.calls == 0, "Wrong PIN cannot mutate OS")
    _ = try await coordinator.authorize(operationID: prepared.operationID, pin: "123456")
    let result = try await coordinator.execute(operationID: prepared.operationID)
    expect(result.accepted && !result.resultingSnapshot.policy.continuous && result.resultingSnapshot.policy.encryptedDNS, "Exact action retains other layers")
    _ = try await coordinator.execute(operationID: prepared.operationID)
    expect(adapter.calls == 1, "Completed exact retry must not repeat OS mutation")

    for repairFirst in [false, true] {
      let (raceCore, _, _) = try await freshCore(), raceAdapter = try FixtureAdapter()
      try await enroll(raceCore, raceAdapter)
      let first = FreedAdultProtectionLockCoordinator(core: raceCore, crypto: FixtureCrypto(), adapter: raceAdapter, operations: fixtureOperations[ObjectIdentifier(raceCore)]!, coreRecords: fixtureCoreRecords[ObjectIdentifier(raceCore)]!)
      let other = FreedAdultProtectionLockCoordinator(core: raceCore, crypto: FixtureCrypto(), adapter: raceAdapter, operations: fixtureOperations[ObjectIdentifier(raceCore)]!, coreRecords: fixtureCoreRecords[ObjectIdentifier(raceCore)]!)
      let one = try await first.prepare(action: .disableEncryptedDNS)
      let two = try await other.prepare(action: .disableAdultFilter)
      _ = try await first.authorize(operationID: one.operationID, pin: "123456")
      _ = try await other.authorize(operationID: two.operationID, pin: "123456")
      raceAdapter.deferred = true
      let execution = Task { try await first.execute(operationID: one.operationID) }
      while !raceAdapter.waiting() { await Task.yield() }
      let duplicate = Task { try await first.execute(operationID: one.operationID) }
      await rejects("exclusive cross-coordinator executor") { _ = try await other.execute(operationID: two.operationID) }
      if repairFirst { try raceAdapter.repair() }
      expect(raceAdapter.releaseCallback(), "Deferred callback must exist")
      if repairFirst {
        await rejects("newer repair fences old callback") { _ = try await execution.value }
        await rejects("duplicate returns original failure") { _ = try await duplicate.value }
        expect(try await raceAdapter.snapshot().policy.encryptedDNS, "Late callback preserves stronger DNS")
      } else {
        _ = try await execution.value; _ = try await duplicate.value
        expect(!(try await raceAdapter.snapshot().policy.encryptedDNS), "Authorized action reaches native adapter")
      }
      expect(raceAdapter.calls == 1, "Both callback orders have one OS executor")
    }

    let (throttleCore, _, _) = try await freshCore(), throttleAdapter = try FixtureAdapter()
    try await enroll(throttleCore, throttleAdapter)
    let throttleCoordinator = FreedAdultProtectionLockCoordinator(core: throttleCore, crypto: FixtureCrypto(), adapter: throttleAdapter, operations: fixtureOperations[ObjectIdentifier(throttleCore)]!, coreRecords: fixtureCoreRecords[ObjectIdentifier(throttleCore)]!)
    let throttledOperation = try await throttleCoordinator.prepare(action: .disableAdultFilter)
    for _ in 0..<5 { await rejects("Wrong PIN reserves persistent attempt") { _ = try await throttleCoordinator.authorize(operationID: throttledOperation.operationID, pin: "000000") } }
    do { _ = try await throttleCoordinator.authorize(operationID: throttledOperation.operationID, pin: "123456"); preconditionFailure("Expected persistent throttle") } catch FriendLockFailure.throttled { }
    expect(throttleAdapter.calls == 0, "Throttle cannot reach native OS mutation")
    let (staleCore, _, _) = try await freshCore(), staleAdapter = try FixtureAdapter()
    try await enroll(staleCore, staleAdapter)
    let staleCoordinator = FreedAdultProtectionLockCoordinator(core: staleCore, crypto: FixtureCrypto(), adapter: staleAdapter, operations: fixtureOperations[ObjectIdentifier(staleCore)]!, coreRecords: fixtureCoreRecords[ObjectIdentifier(staleCore)]!)
    let staleOperation = try await staleCoordinator.prepare(action: .disableAdultFilter)
    _ = try await staleCoordinator.authorize(operationID: staleOperation.operationID, pin: "123456")
    try staleAdapter.repair()
    await rejects("Repair invalidates exact authorized configuration") { _ = try await staleCoordinator.execute(operationID: staleOperation.operationID) }
    expect(staleAdapter.calls == 0, "Stale scope cannot execute")
    let (completeCore, completeBytes, _) = try await freshCore(), completeAdapter = try FixtureAdapter()
    try await enroll(completeCore, completeAdapter)
    let completeCoordinator = FreedAdultProtectionLockCoordinator(core: completeCore, crypto: FixtureCrypto(), adapter: completeAdapter, operations: fixtureOperations[ObjectIdentifier(completeCore)]!, coreRecords: fixtureCoreRecords[ObjectIdentifier(completeCore)]!)
    let completeOperation = try await completeCoordinator.prepare(action: .disableAdultFilter)
    _ = try await completeCoordinator.authorize(operationID: completeOperation.operationID, pin: "123456")
    completeAdapter.deferred = true
    let completing = Task { try await completeCoordinator.execute(operationID: completeOperation.operationID) }
    while !completeAdapter.waiting() { await Task.yield() }
    completeBytes.failedWrite = "journal"
    expect(completeAdapter.releaseCallback(), "Completion callback exists")
    await rejects("Completion commit failure after OS action is never replayed") { _ = try await completing.value }
    await rejects("Completion-commit exact retry returns original uncertainty") { _ = try await completeCoordinator.execute(operationID: completeOperation.operationID) }
    expect(completeAdapter.calls == 1, "Commit/readback failure cannot dispatch OS mutation twice")

    let (cancelCore, _, _) = try await freshCore(), cancelAdapter = try FixtureAdapter()
    try await enroll(cancelCore, cancelAdapter)
    let cancelCoordinator = FreedAdultProtectionLockCoordinator(core: cancelCore, crypto: FixtureCrypto(), adapter: cancelAdapter, operations: fixtureOperations[ObjectIdentifier(cancelCore)]!, coreRecords: fixtureCoreRecords[ObjectIdentifier(cancelCore)]!)
    let cancelled = try await cancelCoordinator.prepare(action: .disableAdultFilter)
    _ = try await cancelCoordinator.authorize(operationID: cancelled.operationID, pin: "123456")
    _ = try await cancelCoordinator.cancel(operationID: cancelled.operationID)
    await rejects("Cancelled operation cannot execute") { _ = try await cancelCoordinator.execute(operationID: cancelled.operationID) }
    let rotated = try await cancelCoordinator.prepare(action: .disableEncryptedDNS)
    _ = try await cancelCoordinator.authorize(operationID: rotated.operationID, pin: "123456")
    _ = try await cancelCoordinator.rotate(secret: .pin("123456"), pin: "654321", confirmation: "654321")
    await rejects("Credential rotation invalidates adapter preparation") { _ = try await cancelCoordinator.execute(operationID: rotated.operationID) }
    let afterRotation = try await cancelAdapter.snapshot()
    expect(cancelAdapter.calls == 0 && afterRotation.policy.continuous, "Cancellation and rotation retain stronger native layers")

    let (readbackCore, _, _) = try await freshCore(), readbackAdapter = try FixtureAdapter()
    try await enroll(readbackCore, readbackAdapter)
    let readbackCoordinator = FreedAdultProtectionLockCoordinator(core: readbackCore, crypto: FixtureCrypto(), adapter: readbackAdapter, operations: fixtureOperations[ObjectIdentifier(readbackCore)]!, coreRecords: fixtureCoreRecords[ObjectIdentifier(readbackCore)]!)
    let wrongResult = try await readbackCoordinator.prepare(action: .resetAdultProtection)
    _ = try await readbackCoordinator.authorize(operationID: wrongResult.operationID, pin: "123456")
    await rejects("An accepted adapter flag without exact desired layer readback is insufficient") { _ = try await readbackCoordinator.execute(operationID: wrongResult.operationID) }
    await rejects("Bad readback exact retry cannot repeat OS mutation") { _ = try await readbackCoordinator.execute(operationID: wrongResult.operationID) }
    expect(readbackAdapter.calls == 1, "Invalid layer readback remains a single original outcome")

    let (failedCore, failedBytes, _) = try await freshCore(), failedAdapter = try FixtureAdapter()
    try await enroll(failedCore, failedAdapter)
    let failed = FreedAdultProtectionLockCoordinator(core: failedCore, crypto: FixtureCrypto(), adapter: failedAdapter, operations: fixtureOperations[ObjectIdentifier(failedCore)]!, coreRecords: fixtureCoreRecords[ObjectIdentifier(failedCore)]!)
    let operation = try await failed.prepare(action: .disableAdultFilter)
    _ = try await failed.authorize(operationID: operation.operationID, pin: "123456")
    failedAdapter.failure = true
    let failure = try await failed.execute(operationID: operation.operationID)
    expect(!failure.accepted && failure.stage == .osReadbackFailed && failure.resultingSnapshot.policy.continuous, "OS failure preserves stronger layer and stage")
    _ = try await failed.execute(operationID: operation.operationID)
    expect(failedAdapter.calls == 1, "Failed readback retry preserves original failure")
    let interrupted = try await failed.prepare(action: .disableEncryptedDNS)
    _ = try await failed.authorize(operationID: interrupted.operationID, pin: "123456")
    failedBytes.failedWrite = "journal"
    await rejects("claim commit fails before OS mutation") { _ = try await failed.execute(operationID: interrupted.operationID) }
    expect(failedAdapter.calls == 1, "Failed claim commit cannot reach OS")

    // Real atomic App Group adapter, retention migration and owner-fenced cleanup.
    let domain = "freed.task72.atomic.\(UUID().uuidString)"
    try FreedProtectionConfigurationLock.withExclusiveAccess(containerOverride: temporary, domain: domain) { d in
      d.set(true, forKey: "freed.adultFilterActive"); d.set(true, forKey: "freed.encryptedDns.cloudflareFamilies.configured")
      d.set(12, forKey: "freed.safariContentBlocker.ruleCount")
      d.set(4, forKey: FreedProtectionConfigurationLock.generationKey)
      d.set(try JSONSerialization.data(withJSONObject: ["ownerDigest": "owner-a", "generation": 4, "scopeEpoch": 9]), forKey: "freed.appGroups.v1")
      d.set(Data("private-intervention".utf8), forKey: "freed.pendingIntervention.record")
      let retained = try FreedRetainedAdultProtection.migrate(d)
      try FreedRetainedAdultProtection.acknowledged(d, expected: retained)
      do { _ = try FreedRetainedAdultProtection.stagePrivateCleanup(d, expected: .init(ownerDigest: "owner-b", generation: 4, scopeEpoch: 9), domain: domain); preconditionFailure("Stale owner must reject") } catch { }
      _ = try FreedRetainedAdultProtection.stagePrivateCleanup(d, expected: .init(ownerDigest: "owner-a", generation: 4, scopeEpoch: 9), domain: domain)
      expect(FreedRetainedAdultProtection.shouldFilter(d) && FreedRetainedAdultProtection.retainsSafari(d), "Account/app reset retains adult filtering and Safari")
      expect(try FreedRetainedAdultProtection.read(d).encryptedDNS, "Account cleanup retains DNS intent")
      expect(d.data(forKey: "freed.pendingIntervention.record") == nil && d.data(forKey: "freed.appGroups.v1") == nil, "Private authority is erased")
      let consumer = MonitorAdultBoundary(defaults: d)
      consumer.clearOwnedProtection()
      expect(consumer.store.webContent.blockedByFilter != nil, "Actual DeviceActivity reset/expiry consumer retains adult filter")
    }
    do { try FreedProtectionConfigurationLock.withExclusiveAccess(containerOverride: temporary, domain: domain) { d in
      expect(FreedRetainedAdultProtection.shouldFilter(d), "Committed retained baseline survives a fresh atomic snapshot")
      d.set(Data("corrupt".utf8), forKey: FreedRetainedAdultProtection.key)
      expect(FreedRetainedAdultProtection.shouldFilter(d) && FreedRetainedAdultProtection.retainsSafari(d), "Corrupt retention refuses weakening")
      do { _ = try FreedRetainedAdultProtection.migrate(d); preconditionFailure("Corrupt migration must reject") } catch { }
      throw FixtureFailure.rollback
    } } catch FixtureFailure.rollback { }
    try FreedProtectionConfigurationLock.withExclusiveAccess(containerOverride: temporary, domain: domain) { d in
      expect(FreedRetainedAdultProtection.shouldFilter(d), "Interrupted retained write restores prior committed policy")
    }
    let riskDefaults = UserDefaults(suiteName: "freed.task72.risk.\(UUID().uuidString)")!
    riskDefaults.set(true, forKey: FreedProtectionConfigurationLock.resetMarkerKey)
    try FreedRetainedAdultProtection.stage(.init(continuous: false, encryptedDNS: true, safari: true, riskEnabled: true, riskStartMinute: 23 * 60, riskEndMinute: 5 * 60), riskDefaults)
    var utc = Calendar(identifier: .gregorian); utc.timeZone = TimeZone(secondsFromGMT: 0)!
    let midnight = utc.date(from: DateComponents(year: 2026, month: 10, day: 13, hour: 0))!
    let morning = utc.date(from: DateComponents(year: 2026, month: 10, day: 13, hour: 7))!
    expect(FreedRetainedAdultProtection.shouldFilter(riskDefaults, at: midnight, calendar: utc), "Retained risk window survives private reset overnight")
    expect(!FreedRetainedAdultProtection.shouldFilter(riskDefaults, at: morning, calendar: utc), "Native risk expiry executes authorized schedule only")
    let unavailable = FreedProtectionConfigurationLock.sharedDefaults(containerOverride: temporary.appendingPathComponent("missing-container"), domain: domain)
    expect(FreedRetainedAdultProtection.shouldFilter(unavailable) && FreedRetainedAdultProtection.retainsSafari(unavailable), "Unavailable atomic storage cannot look like an authorized empty policy")
    print("Task72 native coordinator / lower gates / retained consumers: PASS")
    try await runC2SystemAdapterCases(temporary)
    try await runC2SystemAdapterCases(temporary, mode:"continuousOnly")
    try await runC2SystemAdapterCases(temporary, mode:"reset")
    for layer in ["dns","safari","risk","continuous"] { try await runC2SystemAdapterCases(temporary, mode: layer) }
    try await runC2HeldDNSFenceCase(temporary)
    try await runC2HeldDNSFenceCase(temporary,safari:true)
    try await runC2CheckpointCrashCases()
    for mode in ["preserve", "restore", "rejectRestore", "stale"] { try await runC2RiskOnlyCompensationCase(temporary, mode: mode) }
  }
}
enum FixtureFailure: Error { case rollback }

// Recreate the actual store/coordinator at boundaries; core/OS/protected-byte
// boundaries are injected. These are deterministic crash-gap fixtures, not kills
// of a signed process or proof of daemon callback ordering.
func recreated(_ core: FriendLockCore, _ adapter: FixtureAdapter) -> FreedAdultProtectionLockCoordinator {
  FreedAdultProtectionLockCoordinator(core: core, crypto: FixtureCrypto(), adapter: adapter,
    operations: FreedAdultProtectionOperationStore(bytes: fixtureOperationBytes[ObjectIdentifier(core)]!, crypto: FixtureCrypto()),
    coreRecords: fixtureCoreRecords[ObjectIdentifier(core)]!)
}
func runTask79BCases(_ temporary: URL) async throws {
  // Real host file backend: durable bootstrap/readback and reconstruction.
  let fileRoot = temporary.appendingPathComponent("host-operations")
  let (fileCore, _, _) = try await freshCore()
  let fileStore = FreedAdultProtectionOperationStore(bytes: try FreedAdultOperationFileBytes(fixtureDirectory: fileRoot), crypto: FixtureCrypto())
  try await fileStore.initializeBeforeEnrollment(core: fileCore)
  expect(try fileStore.load().records.isEmpty, "Actual fsync/atomic store initializes before enrollment")
  let fileAdapter = try FixtureAdapter(); try await enroll(fileCore, fileAdapter)
  let fileCoordinator = FreedAdultProtectionLockCoordinator(core: fileCore, crypto: FixtureCrypto(), adapter: fileAdapter, operations: fileStore, coreRecords: fixtureCoreRecords[ObjectIdentifier(fileCore)]!)
  let filePrepared = try await fileCoordinator.prepare(request: .continuousOff)
  let orphanTemporary = fileRoot.appendingPathComponent("pending-\(UUID().uuidString)")
  try Data("uncommitted-temporary".utf8).write(to: orphanTemporary)
  let reopen = FreedAdultProtectionOperationStore(bytes: try FreedAdultOperationFileBytes(fixtureDirectory: fileRoot), crypto: FixtureCrypto())
  let reopenedCoordinator = FreedAdultProtectionLockCoordinator(core: fileCore, crypto: FixtureCrypto(), adapter: fileAdapter, operations: reopen, coreRecords: fixtureCoreRecords[ObjectIdentifier(fileCore)]!)
  expect(try reopen.required(filePrepared.operationID).phase == .prepared, "Prepared operation survives actual file backend recreation")
  expect(!FileManager.default.fileExists(atPath: orphanTemporary.path), "Store reclaims only orphan atomic temporaries under interprocess exclusion")
  _ = try await reopenedCoordinator.authorize(operationID: filePrepared.operationID, pin: "123456")
  _ = try await reopenedCoordinator.execute(operationID: filePrepared.operationID)
  expect(try reopen.required(filePrepared.operationID).phase == .completed, "Actual file store persists exact completed result")
  let savedFile = try Data(contentsOf: fileRoot.appendingPathComponent("operations"))
  try FileManager.default.removeItem(at: fileRoot.appendingPathComponent("operations"))
  await rejects("Existing core enrollment never bootstraps missing host journal") { try await reopen.initializeBeforeEnrollment(core: fileCore) }
  await rejects("Missing host half cannot execute core-completed operation") { _ = try await reopenedCoordinator.execute(operationID: filePrepared.operationID) }
  try savedFile.write(to: fileRoot.appendingPathComponent("operations"))

  // Recreate after prepare and authorize, and join the same ID across instances.
  let (core, _, _) = try await freshCore(), adapter = try FixtureAdapter()
  try await enroll(core, adapter)
  let prepared = try await recreated(core, adapter).prepare(request: .dnsOff)
  _ = try await recreated(core, adapter).authorize(operationID: prepared.operationID, pin: "123456")
  adapter.deferred = true
  let execution = Task { try await recreated(core, adapter).execute(operationID: prepared.operationID) }
  while !adapter.waiting() { await Task.yield() }
  let joined = Task { try await recreated(core, adapter).execute(operationID: prepared.operationID) }
  await Task.yield()
  await rejects("Cancellation after durable dispatch does not claim reversal") { _ = try await recreated(core, adapter).cancel(operationID: prepared.operationID) }
  expect(adapter.releaseCallback(), "Durable execution callback exists")
  _ = try await execution.value; _ = try await joined.value
  _ = try await recreated(core, adapter).execute(operationID: prepared.operationID)
  expect(adapter.calls == 1, "Cross-instance exact execution and completed restart dispatch only once")

  // Store failure at each claim/reservation/outcome/acknowledgment boundary.
  for phase in [FreedAdultOperationPhase.claimed, .dispatchReserved, .outcomeRecorded, .completed] {
    for afterWrite in [false, true] {
      let (core, _, _) = try await freshCore(), adapter = try FixtureAdapter()
      try await enroll(core, adapter)
      let operation = try await recreated(core, adapter).prepare(request: .continuousOff)
      _ = try await recreated(core, adapter).authorize(operationID: operation.operationID, pin: "123456")
      let bytes = fixtureOperationBytes[ObjectIdentifier(core)]!
      if afterWrite { bytes.throwAfterPhase = phase } else { bytes.failPhase = phase }
      await rejects("Injected crash/failure at \(phase), after durable write=\(afterWrite)") { _ = try await recreated(core, adapter).execute(operationID: operation.operationID) }
      bytes.throwAfterPhase = nil; bytes.failPhase = nil
      let saved = try fixtureOperations[ObjectIdentifier(core)]!.required(operation.operationID)
      if saved.outcome != nil {
        let result = try await recreated(core, adapter).execute(operationID: operation.operationID)
        expect(result.accepted, "Saved exact accepted outcome finishes bookkeeping after recreation")
      } else {
        await rejects("No trusted outcome after restart never reissues weakening") { _ = try await recreated(core, adapter).execute(operationID: operation.operationID) }
      }
      expect(adapter.calls == ([.outcomeRecorded, .completed].contains(phase) ? 1 : 0), "Crash boundary never duplicates weakening dispatch")
    }
  }

  // Dropped writes are detected by exact readback, retaining prior reservation.
  for phase in [FreedAdultOperationPhase.prepared, .authorized, .dispatchReserved, .outcomeRecorded] {
    let (core, _, coreStore) = try await freshCore(), adapter = try FixtureAdapter()
    try await enroll(core, adapter)
    let bytes = fixtureOperationBytes[ObjectIdentifier(core)]!
    if phase == .prepared {
      bytes.dropPhase = phase
      await rejects("Dropped preparation cannot return executable ID") { _ = try await recreated(core, adapter).prepare(request: .continuousOff) }
      bytes.dropPhase = nil
      let orphan = try coreStore.load()!.operations.last!
      await rejects("Orphaned core preparation has no execution path") { _ = try await recreated(core, adapter).execute(operationID: orphan.operationID) }
    } else {
      let receipt = try await recreated(core, adapter).prepare(request: .continuousOff)
      if phase == .authorized {
        bytes.dropPhase = phase
        await rejects("Dropped authorized journal write is not acknowledged") { _ = try await recreated(core, adapter).authorize(operationID: receipt.operationID, pin: "123456") }
        bytes.dropPhase = nil
        await rejects("Core authorization alone cannot execute") { _ = try await recreated(core, adapter).execute(operationID: receipt.operationID) }
        _ = try await recreated(core, adapter).authorize(operationID: receipt.operationID, pin: "123456")
      } else {
        _ = try await recreated(core, adapter).authorize(operationID: receipt.operationID, pin: "123456")
        bytes.dropPhase = phase
        await rejects("Dropped reservation/outcome fails exact readback") { _ = try await recreated(core, adapter).execute(operationID: receipt.operationID) }
        bytes.dropPhase = nil
        await rejects("Dropped write restart cannot repeat OS action") { _ = try await recreated(core, adapter).execute(operationID: receipt.operationID) }
      }
    }
    expect(adapter.calls == (phase == .outcomeRecorded ? 1 : 0), "Dropped write preserves conservative execution count")
  }

  // Core outcome uncertainty is recoverable bookkeeping, including rejected OS results.
  for failedOS in [false, true] {
    let (core, coreBytes, _) = try await freshCore(), adapter = try FixtureAdapter()
    try await enroll(core, adapter); adapter.failure = failedOS
    let receipt = try await recreated(core, adapter).prepare(request: .continuousOff)
    _ = try await recreated(core, adapter).authorize(operationID: receipt.operationID, pin: "123456")
    adapter.deferred = true
    let task = Task { try await recreated(core, adapter).execute(operationID: receipt.operationID) }
    while !adapter.waiting() { await Task.yield() }
    coreBytes.failedWrite = "journal"
    expect(adapter.releaseCallback(), "Core failure callback exists")
    await rejects("Core completion cannot acknowledge failed protected commit") { _ = try await task.value }
    coreBytes.failedWrite = nil
    let result = try await recreated(core, adapter).execute(operationID: receipt.operationID)
    expect(result.accepted == !failedOS && adapter.calls == 1, "Bookkeeping replay preserves rejected/accepted original result and never dispatches")
  }

  // Explicit Off and reset have different core binding despite equal desired policy.
  let (intentCore, _, _) = try await freshCore(), intentAdapter = try FixtureAdapter()
  try await enroll(intentCore, intentAdapter)
  let off = try await recreated(intentCore, intentAdapter).prepare(request: .adultOff)
  let reset = try await recreated(intentCore, intentAdapter).prepare(request: .adultReset)
  let intentStore = fixtureOperations[ObjectIdentifier(intentCore)]!
  expect(try off.deltaDigest != reset.deltaDigest && intentStore.required(off.operationID).desired == intentStore.required(reset.operationID).desired, "Off and reset bind distinct canonical intent")
  _ = try await recreated(intentCore, intentAdapter).cancel(operationID: off.operationID)
  _ = try await recreated(intentCore, intentAdapter).cancel(operationID: off.operationID)
  await rejects("Unknown ID fails without reconstruction") { _ = try await recreated(intentCore, intentAdapter).execute(operationID: String(repeating: "a", count: 32)) }

  // Corruption, missing halves, unavailable storage and forged original change.
  let intentBytes = fixtureOperationBytes[ObjectIdentifier(intentCore)]!
  let valid = intentBytes.values
  for fault in ["missing-witness", "missing-record", "schema", "change", "receipt", "unavailable"] {
    intentBytes.values = valid
    switch fault {
    case "missing-witness": intentBytes.values.removeValue(forKey: "witness")
    case "missing-record": intentBytes.values.removeValue(forKey: "operations")
    case "schema": intentBytes.values["operations"] = Data("{\"schema\":99}".utf8)
    case "change":
      var object = try JSONSerialization.jsonObject(with: valid["operations"]!) as! [String: Any]
      var records = object["records"] as! [[String: Any]]; records[1]["request"] = "adultOff"; object["records"] = records
      intentBytes.values["operations"] = try JSONSerialization.data(withJSONObject: object)
    case "receipt":
      var object = try JSONSerialization.jsonObject(with: valid["operations"]!) as! [String: Any]
      var records = object["records"] as! [[String: Any]]
      var receipt = records[1]["receipt"] as! [String: Any]; receipt["lockRevision"] = 2; records[1]["receipt"] = receipt; object["records"] = records
      intentBytes.values["operations"] = try JSONSerialization.data(withJSONObject: object)
    default: intentBytes.unavailable = true
    }
    await rejects("Corrupt/missing/unavailable host authority rejects: \(fault)") { _ = try await recreated(intentCore, intentAdapter).authorize(operationID: reset.operationID, pin: "123456") }
    intentBytes.unavailable = false
  }
  intentBytes.values = valid
  expect(intentAdapter.calls == 0, "All invalid authority fixtures preserve OS state")

  // Capacity rejection happens before core.prepare; records are never evicted.
  let (capacityCore, _, capacityCoreStore) = try await freshCore(), capacityAdapter = try FixtureAdapter()
  try await enroll(capacityCore, capacityAdapter)
  for _ in 0..<32 { _ = try await recreated(capacityCore, capacityAdapter).prepare(request: .continuousOff) }
  await rejects("Bounded host journal refuses 33rd record") { _ = try await recreated(capacityCore, capacityAdapter).prepare(request: .continuousOff) }
  expect(try capacityCoreStore.load()!.operations.count == 32, "Capacity checked before generating orphan core request")
  let capacityBytes = fixtureOperationBytes[ObjectIdentifier(capacityCore)]!
  let beforeCapacity = capacityBytes.values
  capacityBytes.values["operations"] = Data(repeating: 0, count: 2 * 1024 * 1024 + 1)
  await rejects("Oversized journal is corrupt") { _ = try await recreated(capacityCore, capacityAdapter).prepare(request: .continuousOff) }
  capacityBytes.values = beforeCapacity

  // Async observation/KDF suspension is fenced by durable epoch and CAS.
  let (staleCore, _, _) = try await freshCore(), staleAdapter = try FixtureAdapter()
  try await enroll(staleCore, staleAdapter)
  let stale = try await recreated(staleCore, staleAdapter).prepare(request: .continuousOff)
  var observations = 0
  staleAdapter.snapshotHook = {
    observations += 1
    if observations == 2 { try staleAdapter.repair() }
  }
  await rejects("Native snapshot changes after core authorization") { _ = try await recreated(staleCore, staleAdapter).authorize(operationID: stale.operationID, pin: "123456") }
  expect(staleAdapter.calls == 0, "Awaited stale native snapshot never mutates OS")
  staleAdapter.snapshotHook = nil
  let (epochCore, _, _) = try await freshCore(), epochAdapter = try FixtureAdapter()
  try await enroll(epochCore, epochAdapter)
  let epochReceipt = try await recreated(epochCore, epochAdapter).prepare(request: .continuousOff)
  let epochStore = fixtureOperations[ObjectIdentifier(epochCore)]!
  var epochObservations = 0
  epochAdapter.snapshotHook = {
    epochObservations += 1
    if epochObservations == 2 { try epochStore.update { $0.epoch += 1; $0.invalidationPending = true } }
  }
  await rejects("Epoch changes across authorization await") { _ = try await recreated(epochCore, epochAdapter).authorize(operationID: epochReceipt.operationID, pin: "123456") }
  await rejects("Pending invalidation survives coordinator recreation") { _ = try await recreated(epochCore, epochAdapter).execute(operationID: epochReceipt.operationID) }
  expect(epochAdapter.calls == 0, "Epoch fence does not change filtering")
  // Core committed but returned an uncertain completion: retry uses saved bytes.
  let (unknownCore, unknownBytes, unknownCoreStore) = try await freshCore(), unknownAdapter = try FixtureAdapter()
  try await enroll(unknownCore, unknownAdapter)
  let unknown = try await recreated(unknownCore, unknownAdapter).prepare(request: .continuousOff)
  _ = try await recreated(unknownCore, unknownAdapter).authorize(operationID: unknown.operationID, pin: "123456")
  unknownBytes.throwAfterCompletedCommit = true
  do { _ = try await recreated(unknownCore, unknownAdapter).execute(operationID: unknown.operationID); preconditionFailure("Expected uncertain completion") }
  catch FriendLockFailure.commitOutcomeUnknown { }
  unknownBytes.throwAfterCompletedCommit = false
  expect(try unknownCoreStore.load()!.operations.first!.state == .completed, "Uncertain core completion actually committed before losing acknowledgment")
  let reconciled = try await recreated(unknownCore, unknownAdapter).reconcilePending()
  expect(reconciled.first?.phase == .completed && reconciled.first?.accepted == true && unknownAdapter.calls == 1, "Restart reconciliation completes exact bookkeeping only after uncertain core acknowledgment")

  let (prepareEpochCore, _, prepareEpochStore) = try await freshCore(), prepareEpochAdapter = try FixtureAdapter()
  try await enroll(prepareEpochCore, prepareEpochAdapter)
  prepareEpochAdapter.snapshotHook = { try fixtureOperations[ObjectIdentifier(prepareEpochCore)]!.update { $0.epoch += 1 } }
  await rejects("Epoch changed during async preparation snapshot") { _ = try await recreated(prepareEpochCore, prepareEpochAdapter).prepare(request: .dnsOff) }
  expect(try prepareEpochStore.load()!.operations.isEmpty, "Stale preparation snapshot creates no core operation")

  // Exact partial outcomes retain their per-layer failures after recreation.
  let (partialCore, _, _) = try await freshCore(), partialAdapter = try FixtureAdapter()
  try await enroll(partialCore, partialAdapter); partialAdapter.partial = true
  let partialReceipt = try await recreated(partialCore, partialAdapter).prepare(request: .adultOff)
  _ = try await recreated(partialCore, partialAdapter).authorize(operationID: partialReceipt.operationID, pin: "123456")
  let partialResult = try await recreated(partialCore, partialAdapter).execute(operationID: partialReceipt.operationID)
  let partialRetry = try await recreated(partialCore, partialAdapter).execute(operationID: partialReceipt.operationID)
  expect(partialRetry == partialResult && !partialResult.accepted && partialResult.layers.dns == .observedApplied && partialResult.layers.safari == .failed && partialResult.layers.continuous == .untouched && partialAdapter.calls == 1, "Partial readback survives completed bookkeeping without promotion or continuation")

  // Bound canonical readback and record size, not just the number of records.
  let (largeCore, _, largeCoreStore) = try await freshCore(), largeAdapter = try FixtureAdapter()
  try await enroll(largeCore, largeAdapter)
  let largeSnapshot = largeAdapter.capture()
  largeAdapter.state = FreedNativeAdultSnapshot(configuration: largeSnapshot.configuration, policy: largeSnapshot.policy, nativeReadback: Data(repeating: 7, count: 32_769))
  await rejects("Canonical readback larger than core limit rejects before prepare") { _ = try await recreated(largeCore, largeAdapter).prepare(request: .continuousOff) }
  expect(try largeCoreStore.load()!.operations.isEmpty, "Oversized canonical observation creates no core receipt")
  largeAdapter.state = FreedNativeAdultSnapshot(configuration: largeSnapshot.configuration, policy: largeSnapshot.policy, nativeReadback: Data(repeating: 7, count: 32_768))
  let boundedReceipt = try await recreated(largeCore, largeAdapter).prepare(request: .continuousOff)
  let boundedStore = fixtureOperations[ObjectIdentifier(largeCore)]!
  let bounded = try boundedStore.required(boundedReceipt.operationID)
  // A before+outcome pair that exceeds 64 KiB is rejected; no truncated outcome.
  let inFlight = try await largeCore.authorize(pin: "123456", change: bounded.change(using: FixtureCrypto()), configuration: bounded.before.configuration, operationID: bounded.id)
  var authorizedLarge = bounded; authorizedLarge.receipt = inFlight; authorizedLarge.phase = .authorized
  try boundedStore.replace(bounded, with: authorizedLarge)
  let claimedLargeReceipt = try await largeCore.claim(operationID: bounded.id, change: bounded.change(using: FixtureCrypto()), configuration: bounded.before.configuration)
  var claimedLarge = authorizedLarge; claimedLarge.receipt = claimedLargeReceipt; claimedLarge.phase = .claimed
  try boundedStore.replace(authorizedLarge, with: claimedLarge)
  var reservedLarge = claimedLarge; reservedLarge.phase = .dispatchReserved; reservedLarge.layers = .reserved(.continuousOff)
  try boundedStore.replace(claimedLarge, with: reservedLarge)
  var oversizedOutcome = reservedLarge; oversizedOutcome.phase = .outcomeRecorded; oversizedOutcome.layers = .init(continuous: .failed)
  oversizedOutcome.outcome = .init(accepted: false, stage: .osReadbackFailed, resultingSnapshot: largeAdapter.capture(), layers: oversizedOutcome.layers)
  await rejects("Record over 64 KiB rejects without truncating readback") { try boundedStore.replace(reservedLarge, with: oversizedOutcome) }
  expect(try boundedStore.required(bounded.id).phase == .dispatchReserved, "Oversized outcome retains ambiguous reservation")
  let status = try await recreated(largeCore, largeAdapter).reconcilePending()
  expect(status.first?.phase == .dispatchReserved && status.first?.accepted == nil && largeAdapter.calls == 0, "Reconciliation reports unresolved reservation without OS dispatch")
  print("Task79B durable actual store/coordinator restart / dropped-write / capacity / binding / async-epoch / partial-result cases: PASS")
}


func runTask79BFix1Cases() async throws {
  for legacyHalf in [false, true] {
  for preauthorized in [true, false] {
    let (core, _, coreStore) = try await freshCore(), adapter = try FixtureAdapter()
    try await enroll(core, adapter)
    let first = try await recreated(core, adapter).prepare(request: .continuousOff)
    _ = try await recreated(core, adapter).authorize(operationID: first.operationID, pin: "123456")
    var second: FriendLockReceipt?
    if preauthorized {
      second = try await recreated(core, adapter).prepare(request: .dnsOff)
      _ = try await recreated(core, adapter).authorize(operationID: second!.operationID, pin: "123456")
    }
    let bytes = fixtureOperationBytes[ObjectIdentifier(core)]!
    bytes.failPhase = .claimed
    await rejects("I1 first host claimed write fails after core claim") { _ = try await recreated(core, adapter).execute(operationID: first.operationID) }
    bytes.failPhase = nil
    if legacyHalf {
      // Reproduce the old core-first claim half from the reviewed implementation.
      // The original exact host input/authorized receipt survives, but not claimed.
      try fixtureOperations[ObjectIdentifier(core)]!.update { journal in
        let index = journal.records.firstIndex(where: { $0.id == first.operationID })!
        journal.records[index].phase = .authorized
      }
    }
    expect(try coreStore.load()!.operations.first(where: { $0.operationID == first.operationID })!.state == .inFlight, "I1 core claim committed before host claim acknowledgment")
    if let second {
      await rejects("I1 distinct preauthorized ID cannot dispatch around unresolved core claim") { _ = try await recreated(core, adapter).execute(operationID: second.operationID) }
    } else {
      await rejects("I1 fresh request cannot bypass unresolved core claim") { _ = try await recreated(core, adapter).prepare(request: .dnsOff) }
    }
    expect(adapter.calls == 0, "I1 both distinct paths have zero dispatch before explicit cancellation")
    _ = try await recreated(core, adapter).cancel(operationID: first.operationID)
    _ = try await recreated(core, adapter).cancel(operationID: first.operationID)
    if second == nil {
      second = try await recreated(core, adapter).prepare(request: .dnsOff)
      _ = try await recreated(core, adapter).authorize(operationID: second!.operationID, pin: "123456")
    }
    _ = try await recreated(core, adapter).execute(operationID: second!.operationID)
    expect(adapter.calls == 1, "I1 only an explicit distinct operation dispatches after safe pre-dispatch cancellation")
  }
  }
  // Loss of one valid host record must not hide an existing core inFlight half.
  for transitionFirst in [false, true] {
  let (missingCore, _, _) = try await freshCore(), missingAdapter = try FixtureAdapter()
  try await enroll(missingCore, missingAdapter)
  let missing = try await recreated(missingCore, missingAdapter).prepare(request: .continuousOff)
  let other = try await recreated(missingCore, missingAdapter).prepare(request: .dnsOff)
  _ = try await recreated(missingCore, missingAdapter).authorize(operationID: missing.operationID, pin: "123456")
  _ = try await recreated(missingCore, missingAdapter).authorize(operationID: other.operationID, pin: "123456")
  let missingBytes = fixtureOperationBytes[ObjectIdentifier(missingCore)]!
  missingBytes.failPhase = .claimed
  await rejects("I1 missing-record setup reaches core claim without OS call") { _ = try await recreated(missingCore, missingAdapter).execute(operationID: missing.operationID) }
  missingBytes.failPhase = nil
  var object = try JSONSerialization.jsonObject(with: missingBytes.values["operations"]!) as! [String: Any]
  var records = object["records"] as! [[String: Any]]
  records.removeAll { (($0["receipt"] as? [String: Any])?["operationID"] as? String) == missing.operationID }
  object["records"] = records
  missingBytes.values["operations"] = try JSONSerialization.data(withJSONObject: object)
  if transitionFirst { try await recreated(missingCore, missingAdapter).invalidate() }
  await rejects("I1 missing single host record cannot hide core inFlight from distinct dispatch") { _ = try await recreated(missingCore, missingAdapter).execute(operationID: other.operationID) }
  await rejects("I1 missing single host record blocks fresh preparation") { _ = try await recreated(missingCore, missingAdapter).prepare(request: .continuousOff) }
  expect(missingAdapter.calls == 0, "I1 missing half never reconstructs dispatch authority")
  expect(try fixtureOperations[ObjectIdentifier(missingCore)]!.load().authorityUncertain, "I1 missing single record leaves a durable uncertainty fence")
  if !transitionFirst { try await recreated(missingCore, missingAdapter).invalidate() }
  await rejects("I1 core invalidation cannot erase unknown dispatch history") { _ = try await recreated(missingCore, missingAdapter).prepare(request: .dnsOff) }
  expect(missingAdapter.calls == 0, "I1 invalidation never resolves missing native dispatch history by assumption")
  }
  print("Task79B Fix1 cross-operation claim gap / missing single host record: PASS")
}
