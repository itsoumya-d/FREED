import Foundation
import Darwin

// Host-only. No credential material, user text, URLs, or portable authority is stored here.
enum FreedAdultChangeRequest: String, Codable {
  case continuousOff, dnsOff, adultOff, adultReset, dnsReplace, recoveryModeActivate
  var action: FriendLockAction {
    switch self {
    case .continuousOff, .recoveryModeActivate: return .disableAdultFilter
    case .dnsOff, .dnsReplace: return .disableEncryptedDNS
    case .adultOff, .adultReset: return .resetAdultProtection
    }
  }
  func desired(from before: FreedRetainedAdultProtection.Policy, dnsCandidate: FreedRecoveryDnsCandidate? = nil) -> FreedRetainedAdultProtection.Policy {
    var result = before
    switch self {
    case .continuousOff: result.continuous = false; result.hostedRecoveryDns = nil
    case .dnsOff: result.encryptedDNS = false; result.hostedRecoveryDns = nil
    case .dnsReplace: result.encryptedDNS = true
    case .recoveryModeActivate: result.hostedRecoveryDns = dnsCandidate?.identity
    case .adultOff, .adultReset:
      result.continuous = false; result.encryptedDNS = false; result.safari = false
      result.hostedRecoveryDns = nil
      result.riskEnabled = false; result.riskStartMinute = nil; result.riskEndMinute = nil
    }
    return result
  }
}
enum FreedAdultOperationPhase: String, Codable {
  case prepared, authorized, claimReserved, claimed, dispatchReserved, outcomeRecorded, completed, cancelling, cancelled, superseded
}
enum FreedAdultOperationAuthority: String, Codable { case friendLock, explicitUnenrolledPilot }
enum FreedAdultLayerStage: String, Codable { case untouched, dispatchReserved, observedApplied, observedUnchanged, failed, uncertain }
struct FreedAdultLayerStages: Codable, Equatable {
  var dns: FreedAdultLayerStage = .untouched
  var safari: FreedAdultLayerStage = .untouched
  var risk: FreedAdultLayerStage = .untouched
  var continuous: FreedAdultLayerStage = .untouched
  static func reserved(_ request: FreedAdultChangeRequest) -> Self {
    switch request {
    case .continuousOff, .recoveryModeActivate: return Self(continuous: .dispatchReserved)
    case .dnsOff, .dnsReplace: return Self(dns: .dispatchReserved)
    case .adultOff, .adultReset: return Self(dns: .dispatchReserved, safari: .dispatchReserved, risk: .dispatchReserved, continuous: .dispatchReserved)
    }
  }
}
enum FreedAdultLayer: String, Codable, CaseIterable { case dns, safari, risk, continuous }
enum FreedAdultCheckpointState: String, Codable { case reserved, applied, unchanged, failed, uncertain }
struct FreedAdultCheckpoint: Codable, Equatable {
  let index: Int
  var compensation = false
  let layer: FreedAdultLayer
  let operationID: String
  let deltaDigest: String
  let hostEpoch: UInt64
  let lockRevision: UInt64
  let authorizationGeneration: UInt64
  let nativeScope: FreedAdultNativeScope
  let expectedHash: String
  let desiredHash: String
  var state: FreedAdultCheckpointState
  var observedHash: String?
  var observation: Data?
}
struct FreedAdultStepObservation: Codable { let policy: FreedRetainedAdultProtection.Policy; let layer: Data }
extension FreedAdultChangeRequest {
  var orderedLayers: [FreedAdultLayer] {
    switch self { case .continuousOff, .recoveryModeActivate: return [.continuous]; case .dnsOff, .dnsReplace: return [.dns]; case .adultOff, .adultReset: return [.dns, .safari, .risk, .continuous] }
  }
}
struct FreedAdultOperation: Codable, Equatable {
  let request: FreedAdultChangeRequest
  let before: FreedNativeAdultSnapshot
  let desired: FreedRetainedAdultProtection.Policy
  let epoch: UInt64
  let dnsCandidate: FreedRecoveryDnsCandidate?
  let activationProof: FreedRecoveryDnsActivationProof?
  let authority: FreedAdultOperationAuthority
  var receipt: FriendLockReceipt
  var phase: FreedAdultOperationPhase
  var layers = FreedAdultLayerStages()
  var outcome: FreedNativeAdultMutationResult?
  var checkpoints: [FreedAdultCheckpoint] = []
  var compensations: [FreedAdultCheckpoint] = []
  init(request: FreedAdultChangeRequest, before: FreedNativeAdultSnapshot, desired: FreedRetainedAdultProtection.Policy,
       epoch: UInt64, receipt: FriendLockReceipt, phase: FreedAdultOperationPhase, dnsCandidate: FreedRecoveryDnsCandidate? = nil, activationProof: FreedRecoveryDnsActivationProof? = nil, authority: FreedAdultOperationAuthority = .friendLock) {
    self.request = request; self.before = before; self.desired = desired; self.epoch = epoch; self.receipt = receipt; self.phase = phase; self.dnsCandidate = dnsCandidate
    self.activationProof = activationProof
    self.authority = authority
  }
  private enum CodingKeys: String, CodingKey { case request, before, desired, epoch, receipt, phase, layers, outcome, checkpoints, compensations, dnsCandidate, activationProof, authority }
  init(from decoder: Decoder) throws {
    let c = try decoder.container(keyedBy: CodingKeys.self)
    request = try c.decode(FreedAdultChangeRequest.self, forKey: .request)
    before = try c.decode(FreedNativeAdultSnapshot.self, forKey: .before)
    desired = try c.decode(FreedRetainedAdultProtection.Policy.self, forKey: .desired)
    epoch = try c.decode(UInt64.self, forKey: .epoch); receipt = try c.decode(FriendLockReceipt.self, forKey: .receipt)
    dnsCandidate = try c.decodeIfPresent(FreedRecoveryDnsCandidate.self, forKey: .dnsCandidate)
    activationProof = try c.decodeIfPresent(FreedRecoveryDnsActivationProof.self, forKey: .activationProof)
    authority = try c.decodeIfPresent(FreedAdultOperationAuthority.self, forKey: .authority) ?? .friendLock
    phase = try c.decode(FreedAdultOperationPhase.self, forKey: .phase)
    layers = try c.decode(FreedAdultLayerStages.self, forKey: .layers)
    outcome = try c.decodeIfPresent(FreedNativeAdultMutationResult.self, forKey: .outcome)
    checkpoints = try c.decodeIfPresent([FreedAdultCheckpoint].self, forKey: .checkpoints) ?? []
    compensations = try c.decodeIfPresent([FreedAdultCheckpoint].self, forKey: .compensations) ?? []
  }
  func sameDispatch(as other: Self) -> Bool {
    request == other.request && before == other.before && desired == other.desired && epoch == other.epoch && receipt == other.receipt && dnsCandidate == other.dnsCandidate && activationProof == other.activationProof && authority == other.authority
  }
  func validateCheckpoints(using crypto: any FriendLockCrypto) throws {
    var projection = before.policy
    guard checkpoints.count <= request.orderedLayers.count else { throw FriendLockFailure.corrupt }
    for (index, step) in checkpoints.enumerated() {
      let prior = projection
      switch step.layer {
      case .dns:
        projection.encryptedDNS = request == .dnsReplace
        if request != .dnsReplace { projection.hostedRecoveryDns = nil }
      case .safari: projection.safari = false
      case .risk: projection.riskEnabled = false; projection.riskStartMinute = nil; projection.riskEndMinute = nil
      case .continuous:
        if request == .recoveryModeActivate { projection.hostedRecoveryDns = dnsCandidate?.identity }
        else { projection.continuous = false; projection.hostedRecoveryDns = nil }
      }
      if projection != prior { projection.revision += 1 }
      guard step.desiredHash == (try freedAdultHash(freedAdultEncode(projection), crypto: crypto)) else { throw FriendLockFailure.corrupt }
      guard !step.compensation, step.index == index, step.layer == request.orderedLayers[index], step.operationID == id,
        step.deltaDigest == receipt.deltaDigest, step.hostEpoch == epoch, step.lockRevision == receipt.lockRevision,
        step.authorizationGeneration == receipt.authorizationGeneration, step.nativeScope.valid,
        FriendLockReceipt.hex(step.expectedHash, 64), FriendLockReceipt.hex(step.desiredHash, 64),
        step.observedHash.map({ FriendLockReceipt.hex($0, 64) }) ?? true,
        index == 0 || [.applied, .unchanged].contains(checkpoints[index - 1].state),
        index == 0 || step.nativeScope == checkpoints[0].nativeScope,
        step.state == .reserved ? (step.observedHash == nil && step.observation == nil) : (step.observedHash != nil && step.observation != nil) else { throw FriendLockFailure.corrupt }
    }
    guard compensations.count <= checkpoints.count, compensations.count <= 4,
      compensations.isEmpty || checkpoints.last?.state == .failed else { throw FriendLockFailure.corrupt }
    for (index, step) in compensations.enumerated() {
      guard step.compensation, step.index == index,
        step.layer == checkpoints[checkpoints.count - 1 - index].layer,
        step.operationID == id, step.deltaDigest == receipt.deltaDigest, step.hostEpoch == epoch,
        step.lockRevision == receipt.lockRevision, step.authorizationGeneration == receipt.authorizationGeneration,
        step.nativeScope == checkpoints[0].nativeScope,
        FriendLockReceipt.hex(step.expectedHash, 64), FriendLockReceipt.hex(step.desiredHash, 64),
        step.observedHash.map({ FriendLockReceipt.hex($0, 64) }) ?? true,
        step.state == .reserved ? (step.observedHash == nil && step.observation == nil) : (step.observedHash != nil && step.observation != nil),
        index == 0 || [.applied, .unchanged].contains(compensations[index - 1].state) else { throw FriendLockFailure.corrupt }
    }
    for step in checkpoints + compensations {
      if let bytes = step.observation {
        guard bytes.count <= 4096, let observed = try? JSONDecoder().decode(FreedAdultStepObservation.self, from: bytes),
          observed.policy.valid, !observed.layer.isEmpty, observed.layer.count <= 3072 else { throw FriendLockFailure.corrupt }
        if [.applied, .unchanged].contains(step.state) {
          guard step.desiredHash == (try freedAdultHash(freedAdultEncode(observed.policy), crypto: crypto)) else { throw FriendLockFailure.corrupt }
        }
      }
    }
    if !checkpoints.isEmpty && ![.dispatchReserved, .outcomeRecorded, .completed, .superseded].contains(phase) { throw FriendLockFailure.corrupt }
  }
  var id: String { receipt.operationID }
  func change(using crypto: any FriendLockCrypto) throws -> FriendLockAdultChange {
    try Self.change(request: request, before: before, desired: desired, epoch: epoch, dnsCandidate: dnsCandidate, activationProof: activationProof, crypto: crypto)
  }
  static func change(request: FreedAdultChangeRequest, before: FreedNativeAdultSnapshot,
                     desired: FreedRetainedAdultProtection.Policy, epoch: UInt64,
                     dnsCandidate: FreedRecoveryDnsCandidate?, activationProof: FreedRecoveryDnsActivationProof? = nil, crypto: any FriendLockCrypto) throws -> FriendLockAdultChange {
    let encoder = JSONEncoder(); encoder.outputFormatting = [.sortedKeys]
    var fields = [
      "intent": request.rawValue, "hostEpoch": String(epoch),
      "beforePolicy": try encoder.encode(before.policy).base64EncodedString(),
      "desiredPolicy": try encoder.encode(desired).base64EncodedString(),
      "observedLayers": try crypto.digest(before.nativeReadback).base64EncodedString()]
    // Old operation digests remain byte-for-byte unchanged. New replacements
    // bind their exact private candidate, bootstrap identity and generation.
    if let dnsCandidate { fields["dnsCandidate"] = try encoder.encode(dnsCandidate).base64EncodedString() }
    if let activationProof { fields["activationProof"] = try encoder.encode(activationProof).base64EncodedString() }
    return try FriendLockAdultChange(action: request.action, fields: fields)
  }
  func validate(using crypto: any FriendLockCrypto) throws {
    try validateCheckpoints(using: crypto)
    guard ([.dnsReplace, .recoveryModeActivate].contains(request)) == (dnsCandidate != nil), dnsCandidate?.valid ?? true,
      authority == .friendLock || ([.dnsReplace, .recoveryModeActivate].contains(request) && receipt.lockRevision == 1 && receipt.authorizationGeneration == 0),
      (request == .recoveryModeActivate) == (activationProof != nil), activationProof?.valid ?? true,
      activationProof.map({ $0.profile == dnsCandidate?.identity }) ?? true,
      before.valid, desired.valid, desired == request.desired(from: before.policy, dnsCandidate: dnsCandidate), receipt.isValid,
      receipt.configuration == before.configuration,
      receipt.deltaDigest == (try change(using: crypto).digest(using: crypto)),
      epoch < UInt64.max else { throw FriendLockFailure.corrupt }
    switch phase {
    case .prepared: guard receipt.state == .awaitingSecret, outcome == nil else { throw FriendLockFailure.corrupt }
    case .authorized: guard receipt.state == .authorized, outcome == nil else { throw FriendLockFailure.corrupt }
    case .claimReserved: guard receipt.state == .authorized, outcome == nil else { throw FriendLockFailure.corrupt }
    case .claimed, .dispatchReserved: guard receipt.state == .inFlight, outcome == nil else { throw FriendLockFailure.corrupt }
    case .outcomeRecorded: guard receipt.state == .inFlight, outcome != nil else { throw FriendLockFailure.corrupt }
    case .completed: guard receipt.state == .completed, outcome != nil else { throw FriendLockFailure.corrupt }
    case .cancelled: guard receipt.state == .cancelled, outcome == nil else { throw FriendLockFailure.corrupt }
    case .cancelling: guard outcome == nil else { throw FriendLockFailure.corrupt }
    case .superseded: break
    }
    if [.prepared, .authorized, .claimReserved, .claimed, .cancelling, .cancelled].contains(phase) {
      guard layers == FreedAdultLayerStages() else { throw FriendLockFailure.corrupt }
    }
    if phase == .dispatchReserved {
      guard layers == .reserved(request) else { throw FriendLockFailure.corrupt }
    }
    if let outcome {
      guard outcome.accepted == (outcome.stage == .readback) else { throw FriendLockFailure.corrupt }
      guard outcome.resultingSnapshot.valid, outcome.layers == layers else { throw FriendLockFailure.corrupt }
      if outcome.accepted {
        var observed = outcome.resultingSnapshot.policy; observed.revision = desired.revision
        let done: Set<FreedAdultLayerStage> = [.observedApplied, .observedUnchanged]
        let reserved = FreedAdultLayerStages.reserved(request)
        let pairs = [(reserved.dns, layers.dns), (reserved.safari, layers.safari), (reserved.risk, layers.risk), (reserved.continuous, layers.continuous)]
        guard observed == desired, pairs.allSatisfy({ $0.0 == .untouched ? $0.1 == .untouched : done.contains($0.1) }) else { throw FriendLockFailure.corrupt }
      }
      if phase == .completed {
        let digest = try crypto.digest(outcome.resultingSnapshot.nativeReadback).map { String(format: "%02x", $0) }.joined()
        guard receipt.readbackDigest == digest, receipt.resultingConfiguration == outcome.resultingSnapshot.configuration else { throw FriendLockFailure.corrupt }
      }
    }
  }
}

// Bytes boundary is injected in fixtures; the production implementation below is
// atomic, protected and host-local. Access brackets contain only synchronous I/O.
protocol FreedAdultOperationBytes {
  var identity: String { get }
  func beginAccess() throws
  func endAccess()
  func read(_ key: String) throws -> Data?
  func write(_ key: String, data: Data) throws
}
final class FreedAdultProtectionOperationStore {
  static let maximumRecords = 32, maximumBytes = 2 * 1024 * 1024, maximumRecordBytes = 65_536
  struct CleanupInvalidation: Codable, Equatable {
    let operationID: String
    let nativeEpoch: Int
    let hostEpoch: UInt64
    let lockRevision: UInt64
    let beforeGeneration: UInt64
    let beforeDigest: String
    var dispatchReserved = false
    var acknowledged = false
  }
  struct Journal: Codable, Equatable {
    var schema = 1
    var epoch: UInt64 = 0
    var invalidationPending = false
    // Missing/mismatched trusted halves cannot be cleared by rotation or account
    // invalidation. Their absent original dispatch history is not reconstructible.
    var authorityUncertain = false
    var records: [FreedAdultOperation] = []
    var cleanupInvalidations: [CleanupInvalidation] = []
    init() {}
    private enum CodingKeys: String, CodingKey { case schema, epoch, invalidationPending, authorityUncertain, records, cleanupInvalidations }
    init(from decoder: Decoder) throws {
      let values = try decoder.container(keyedBy: CodingKeys.self)
      schema = try values.decode(Int.self, forKey: .schema)
      epoch = try values.decode(UInt64.self, forKey: .epoch)
      invalidationPending = try values.decode(Bool.self, forKey: .invalidationPending)
      authorityUncertain = try values.decodeIfPresent(Bool.self, forKey: .authorityUncertain) ?? false
      records = try values.decode([FreedAdultOperation].self, forKey: .records)
      cleanupInvalidations = try values.decodeIfPresent([CleanupInvalidation].self, forKey: .cleanupInvalidations) ?? []
    }
  }
  private static let mutex = NSLock()
  private let bytes: any FreedAdultOperationBytes
  private let crypto: any FriendLockCrypto
  var identity: String { bytes.identity }
  init(bytes: any FreedAdultOperationBytes, crypto: any FriendLockCrypto) { self.bytes = bytes; self.crypto = crypto }
  private func access<T>(_ body: () throws -> T) throws -> T {
    Self.mutex.lock(); defer { Self.mutex.unlock() }
    try bytes.beginAccess(); defer { bytes.endAccess() }
    return try body()
  }
  private func encode<T: Encodable>(_ value: T) throws -> Data {
    let encoder = JSONEncoder(); encoder.outputFormatting = [.sortedKeys]; return try encoder.encode(value)
  }
  private func validate(_ journal: Journal) throws {
    guard journal.schema == 1, journal.epoch < UInt64.max,
      journal.records.count <= Self.maximumRecords,
      Set(journal.records.map(\.id)).count == journal.records.count else { throw FriendLockFailure.corrupt }
    guard journal.cleanupInvalidations.count <= 32,
      Set(journal.cleanupInvalidations.map(\.operationID)).count == journal.cleanupInvalidations.count,
      journal.cleanupInvalidations.filter({ !$0.acknowledged }).count <= 1 else { throw FriendLockFailure.corrupt }
    for cleanup in journal.cleanupInvalidations {
      guard UUID(uuidString: cleanup.operationID) != nil, cleanup.nativeEpoch >= 0,
        cleanup.hostEpoch <= journal.epoch, cleanup.beforeGeneration < 9_007_199_254_740_991,
        FriendLockReceipt.hex(cleanup.beforeDigest, 64), !cleanup.acknowledged || cleanup.dispatchReserved else { throw FriendLockFailure.corrupt }
    }
    for record in journal.records {
      try record.validate(using: crypto)
      guard record.epoch <= journal.epoch, try encode(record).count <= Self.maximumRecordBytes else { throw FriendLockFailure.corrupt }
    }
    // An unresolved reservation retains the lane even if the original process died.
    guard journal.records.filter({ [.claimReserved, .claimed, .dispatchReserved, .outcomeRecorded, .cancelling].contains($0.phase) }).count <= 1 else { throw FriendLockFailure.corrupt }
  }
  private func loadLocked() throws -> Journal {
    guard try bytes.read("witness") == Data([1]), let data = try bytes.read("operations") else { throw FriendLockFailure.storageUnavailable }
    guard data.count <= Self.maximumBytes,
      let journal = try? JSONDecoder().decode(Journal.self, from: data) else { throw FriendLockFailure.corrupt }
    try validate(journal); return journal
  }
  private func publishLocked(_ journal: Journal) throws {
    try validate(journal)
    let data = try encode(journal)
    guard data.count <= Self.maximumBytes else { throw FriendLockFailure.authorizationCapacity }
    try bytes.write("operations", data: data)
    guard try bytes.read("operations") == data else { throw FriendLockFailure.commitOutcomeUnknown }
  }
  // Must run before enrollment. Missing journal after enrollment is never initialized.
  // Startup/lifecycle owner must serialize enrollment with this bootstrap.
  func initializeBeforeEnrollment(core: FriendLockCore) async throws {
    guard try await core.status() == .notEnrolled else { throw FriendLockFailure.alreadyEnrolled }
    try access {
      if try bytes.read("witness") != nil { _ = try loadLocked(); return }
      guard try bytes.read("operations") == nil else { throw FriendLockFailure.corrupt }
      try bytes.write("witness", data: Data([1]))
      guard try bytes.read("witness") == Data([1]) else { throw FriendLockFailure.commitOutcomeUnknown }
      try publishLocked(Journal())
    }
  }
  func load() throws -> Journal { try access { try loadLocked() } }
  func update(_ body: (inout Journal) throws -> Void) throws {
    try access { var journal = try loadLocked(); try body(&journal); try publishLocked(journal) }
  }
  func required(_ id: String) throws -> FreedAdultOperation {
    guard let value = try load().records.first(where: { $0.id == id }) else { throw FreedAdultLockIntegrationFailure.unknownOperation }; return value
  }
  func replace(_ old: FreedAdultOperation, with value: FreedAdultOperation, requireCurrentEpoch: Bool = true) throws {
    try update { journal in
      guard let index = journal.records.firstIndex(where: { $0.id == old.id }), journal.records[index] == old,
        !requireCurrentEpoch || (!journal.invalidationPending && !journal.authorityUncertain && old.epoch == journal.epoch) else { throw FriendLockFailure.storageConflict }
      journal.records[index] = value
    }
  }
  func requireNoUnresolvedClaim() throws {
    let journal = try load()
    guard !journal.invalidationPending, !journal.authorityUncertain,
      !journal.records.contains(where: { [.claimReserved, .claimed, .dispatchReserved, .outcomeRecorded, .cancelling].contains($0.phase) }) else { throw FreedAdultLockIntegrationFailure.interruptedOperation }
  }
  func preflight() throws -> UInt64 {
    let journal = try load()
    guard !journal.invalidationPending, !journal.authorityUncertain,
      !journal.records.contains(where: { [.claimReserved, .claimed, .dispatchReserved, .outcomeRecorded, .cancelling].contains($0.phase) }) else { throw FreedAdultLockIntegrationFailure.interruptedOperation }
    // Reserve maximum space before core preparation, without evicting any receipt.
    guard journal.records.count < Self.maximumRecords,
      try encode(journal).count + Self.maximumRecordBytes <= Self.maximumBytes else { throw FriendLockFailure.authorizationCapacity }
    return journal.epoch
  }
}

final class FreedAdultOperationFileBytes: FreedAdultOperationBytes {
  private let directory: URL
  private var lockFD: Int32 = -1
  var identity: String { directory.standardizedFileURL.path }
  #if os(iOS)
  convenience init() throws {
    let support = try FileManager.default.url(for: .applicationSupportDirectory, in: .userDomainMask, appropriateFor: nil, create: true)
    try self.init(directory: support.appendingPathComponent("FreedAdultOperations", isDirectory: true))
  }
  #endif
  // Explicit directory injection is only exposed to native fixtures.
  #if FREED_NATIVE_FIXTURES
  convenience init(fixtureDirectory: URL) throws { try self.init(directory: fixtureDirectory) }
  #endif
  private init(directory: URL) throws {
    self.directory = directory
    try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true, attributes: [.posixPermissions: 0o700])
    try protect(directory)
  }
  private func protect(_ url: URL) throws {
    var url = url; var values = URLResourceValues(); values.isExcludedFromBackup = true; try url.setResourceValues(values)
    #if os(iOS)
    try FileManager.default.setAttributes([.protectionKey: FileProtectionType.complete], ofItemAtPath: url.path)
    let attributes = try FileManager.default.attributesOfItem(atPath: url.path)
    guard attributes[.protectionKey] as? FileProtectionType == .complete else { throw FriendLockFailure.storageUnavailable }
    #endif
    guard try url.resourceValues(forKeys: [.isExcludedFromBackupKey]).isExcludedFromBackup == true else { throw FriendLockFailure.storageUnavailable }
  }
  func beginAccess() throws {
    let path = directory.appendingPathComponent("lock").path
    let fd = open(path, O_CREAT | O_RDWR | O_NOFOLLOW | O_CLOEXEC, S_IRUSR | S_IWUSR)
    guard fd >= 0 else { throw FriendLockFailure.storageUnavailable }
    guard flock(fd, LOCK_EX) == 0 else { close(fd); throw FriendLockFailure.storageUnavailable }
    do {
      try protect(URL(fileURLWithPath: path))
      // A killed atomic replacement may leave an uncommitted temporary. Under
      // the interprocess lock it cannot belong to a live writer. Never prune an
      // authoritative operation or an unresolved record to reclaim capacity.
      for file in try FileManager.default.contentsOfDirectory(at: directory, includingPropertiesForKeys: nil) {
        let name = file.lastPathComponent
        if name.hasPrefix("pending-"), UUID(uuidString: String(name.dropFirst(8))) != nil {
          try FileManager.default.removeItem(at: file)
        }
      }
    } catch { flock(fd, LOCK_UN); close(fd); throw error }
    lockFD = fd
  }
  func endAccess() { if lockFD >= 0 { flock(lockFD, LOCK_UN); close(lockFD); lockFD = -1 } }
  private func url(_ key: String) throws -> URL {
    guard ["witness", "operations"].contains(key) else { throw FriendLockFailure.corrupt }
    return directory.appendingPathComponent(key)
  }
  func read(_ key: String) throws -> Data? {
    let path = try url(key)
    let fd = open(path.path, O_RDONLY | O_NOFOLLOW | O_CLOEXEC)
    if fd < 0 { if errno == ENOENT { return nil }; throw FriendLockFailure.storageUnavailable }
    defer { close(fd) }
    var info = stat()
    guard fstat(fd, &info) == 0, (info.st_mode & S_IFMT) == S_IFREG,
      info.st_size >= 0, info.st_size <= FreedAdultProtectionOperationStore.maximumBytes else { throw FriendLockFailure.corrupt }
    var data = Data(count: Int(info.st_size))
    try data.withUnsafeMutableBytes { buffer in
      var offset = 0
      while offset < buffer.count {
        let count = Darwin.read(fd, buffer.baseAddress!.advanced(by: offset), buffer.count - offset)
        if count < 0 && errno == EINTR { continue }
        guard count > 0 else { throw FriendLockFailure.storageUnavailable }; offset += count
      }
    }
    return data
  }
  func write(_ key: String, data: Data) throws {
    let destination = try url(key)
    guard data.count <= FreedAdultProtectionOperationStore.maximumBytes else { throw FriendLockFailure.authorizationCapacity }
    let temporary = directory.appendingPathComponent("pending-\(UUID().uuidString)")
    // Complete protection is installed before any journal bytes are written.
    guard FileManager.default.createFile(atPath: temporary.path, contents: nil, attributes: [.posixPermissions: 0o600]) else { throw FriendLockFailure.storageUnavailable }
    defer { try? FileManager.default.removeItem(at: temporary) }
    try protect(temporary)
    let fd = open(temporary.path, O_WRONLY | O_NOFOLLOW | O_CLOEXEC)
    guard fd >= 0 else { throw FriendLockFailure.storageUnavailable }
    defer { close(fd) }
    try data.withUnsafeBytes { buffer in
      var offset = 0
      while offset < buffer.count {
        let count = Darwin.write(fd, buffer.baseAddress!.advanced(by: offset), buffer.count - offset)
        if count < 0 && errno == EINTR { continue }
        guard count > 0 else { throw FriendLockFailure.storageUnavailable }; offset += count
      }
    }
    guard fsync(fd) == 0, rename(temporary.path, destination.path) == 0 else { throw FriendLockFailure.storageUnavailable }
    let directoryFD = open(directory.path, O_RDONLY | O_DIRECTORY | O_CLOEXEC)
    guard directoryFD >= 0 else { throw FriendLockFailure.commitOutcomeUnknown }
    defer { close(directoryFD) }
    guard fsync(directoryFD) == 0 else { throw FriendLockFailure.commitOutcomeUnknown }
  }
}
