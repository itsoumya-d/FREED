import Foundation
import CryptoKit

// Non-secret, bounded operation identity in the existing atomic enforcement file.
// Every mutator is called inside configuration exclusion. No OS or protected-core
// call is allowed in the fencing/erasure transactions.
enum FreedAccountProtectionCleanup {
  static let key = "freed.protectionConfiguration.privateCleanup.v1"
  enum Failure: Error { case corrupt, capacity, unknownOperation, staleBinding, bindingUpgradeRequired }
  enum Phase: String, Codable { case prepared, fenced, privateErased, runtimePending, completed, supersededRuntime }
  enum ProcessScrubState: String, Codable {
    case pending, busy, suspended, notApplicable
    var resolved: Bool { self == .suspended || self == .notApplicable }
  }
  struct Resources: Codable, Equatable {
    var stores: [String] = []
    var monitors: [String] = []
    var captures: [String] = []
    var notifications: [String] = []
    var notificationsUnverified = true
    var legacyDomain: String?
    var legacyKeys: [String: String]? = [:]
    var valid: Bool {
      stores.count <= 12 && monitors.count <= 20 && captures.count <= 8 && notifications.count <= 32
        && (legacyDomain?.utf8.count ?? 0) <= 256
        && (legacyKeys?.count ?? 0) <= 128
        && (legacyKeys?.allSatisfy { FreedRetainedAdultProtection.privateNamespace($0.key) && $0.key.utf8.count <= 256 && $0.value.count == 64 } ?? true)
        && [stores, monitors, captures, notifications].allSatisfy { values in
          Set(values).count == values.count && values.allSatisfy { !$0.isEmpty && $0.utf8.count <= 512 }
        }
        && stores.allSatisfy { name in (0..<6).contains { slot in (0..<2).contains { name == "freed.app-group.slot\(slot).bank\($0)" } } }
        && monitors.allSatisfy { $0.hasPrefix("freed.group.") || $0.hasPrefix("freed.appGuard.schedule.") || $0 == "freed.selectedAppDailyLimit" || $0 == "freed.earnedUnlockWindow" }
        && captures.allSatisfy { $0.range(of: #"^[a-f0-9-]{36}\.jpg$"#, options: .regularExpression) != nil }
    }
  }
  struct Record: Codable, Equatable {
    let operationID: String
    let original: FreedRetainedAdultProtection.OwnerFence
    let bindingID: String
    let admissionRevision: Int
    var resultingGeneration: Int?
    var nativeEpoch: Int?
    var phase: Phase = .prepared
    // Preparation is inert. Only explicit Module execution commits this marker.
    // Absent markers admit only positively fenced historical work, never a reservation.
    var executionRequested: Bool? = false
    var executionAdmitted: Bool {
      executionRequested == true || (executionRequested == nil && resultingGeneration != nil && nativeEpoch != nil && phase != .prepared)
    }
    var executionState: String {
      if terminal { return "completed" }
      if executionRequested == true { return resultingGeneration == nil ? "armed" : "inProgress" }
      return executionAdmitted ? "legacyInProgress" : "reserved"
    }
    var coreInvalidationPending = true
    var privateStoreErased = false
    var legacyPrivateStoreErased = false
    var legacyPrivateCopyState = "pending-observation"
    // Optional for decoding pre-fix receipts. Missing unresolved work is pending;
    // already completed historical receipts remain immutable exact replays.
    var processScrubState: ProcessScrubState? = .pending
    var processScrubResolved: Bool { processScrubState?.resolved ?? (phase == .completed) }
    var localRuntimeScrubComplete = false
    var runtimeScrubComplete = false
    var resources: Resources
    let retainedPolicyDigest: String?
    var retainedPolicyState: String
    var terminal: Bool { phase == .completed && !coreInvalidationPending }
    func receipt(replayed: Bool = false) -> [String: Any] {
      ["version": 2, "operationID": operationID, "privateCleanupAccepted": true,
       "executionRequested": executionRequested == true, "executionAdmitted": executionAdmitted, "executionState": executionState,
       "nativeAuthorityRevoked": resultingGeneration != nil, "privateStoreErased": privateStoreErased && legacyPrivateStoreErased, "privateProjectionErased": privateStoreErased, "legacyPrivateCopyState": legacyPrivateCopyState, "legacyPrivateCopyPhysicallyDurable": false,
       "runtimeScrubComplete": runtimeScrubComplete && processScrubResolved, "processScrubState": processScrubState?.rawValue ?? (terminal ? "legacyCompleted" : "pending"),
       "processScrubPending": !processScrubResolved, "coreInvalidationPending": coreInvalidationPending,
       "retainedPolicyState": retainedPolicyState, "dnsObservationState": "deferred",
       "safariObservationState": "deferred", "phase": phase.rawValue, "replayed": replayed,
       "friendLockMutationEnforcementAvailable": false]
    }
  }
  struct Journal: Codable {
    var schema = 1
    var admissionRevision = 0
    var versionedBinding = false
    var currentBindingID: String?
    var records: [Record] = []
  }
  static func retainedFingerprint(_ defaults: UserDefaults) -> String? {
    guard let data = defaults.data(forKey: FreedRetainedAdultProtection.key),
      (try? FreedRetainedAdultProtection.read(defaults)) != nil else { return nil }
    return SHA256.hash(data: data).map { String(format: "%02x", $0) }.joined()
  }
  static func legacyFingerprint(_ value: Any) throws -> String {
    let data = try PropertyListSerialization.data(fromPropertyList: ["value": value], format: .binary, options: 0)
    return SHA256.hash(data: data).map { String(format: "%02x", $0) }.joined()
  }
  static func scrubLegacy(_ record: inout Record, _ defaults: UserDefaults) throws {
    guard try ownsRevokedNamespace(record, defaults), record.privateStoreErased else { throw Failure.staleBinding }
    guard let captured = record.resources.legacyKeys, let expectedDomain = record.resources.legacyDomain,
      let observed = FreedProtectionConfigurationLock.legacyConfiguration(defaults), observed.domain == expectedDomain else {
      record.legacyPrivateStoreErased = false; record.legacyPrivateCopyState = "ownership-unverified"; return
    }
    if let currentOwner = observed.values["freed.appGroups.v1"],
      captured["freed.appGroups.v1"] != (try legacyFingerprint(currentOwner)) {
      record.legacyPrivateStoreErased = false; record.legacyPrivateCopyState = "legacy-owner-changed"; return
    }
    // Only captured keys whose original value still matches. New/changed values
    // are residual privacy work, never implicitly attributed to the old owner.
    for (key, digest) in captured {
      if let value = observed.values[key], try legacyFingerprint(value) == digest {
        FreedProtectionConfigurationLock.removeLegacyConfigurationKey(key, defaults: defaults)
      }
    }
    guard let final = FreedProtectionConfigurationLock.legacyConfiguration(defaults) else { throw Failure.corrupt }
    record.legacyPrivateStoreErased = !final.values.keys.contains(where: FreedRetainedAdultProtection.privateNamespace)
    record.legacyPrivateCopyState = record.legacyPrivateStoreErased ? "absence-observed" : "changed-or-unowned-residual"
  }
  static func legacyPrivateAllowed(_ defaults: UserDefaults) -> Bool {
    guard let journal = try? read(defaults) else { return false }
    return journal.admissionRevision == 0 && !journal.versionedBinding
  }
  static func read(_ defaults: UserDefaults) throws -> Journal {
    guard let raw = defaults.object(forKey: key) else { return Journal() }
    guard let data = raw as? Data, data.count <= 131_072,
      let value = try? JSONDecoder().decode(Journal.self, from: data) else { throw Failure.corrupt }
    try validate(value); return value
  }
  static func validate(_ value: Journal) throws {
    guard value.schema == 1, value.admissionRevision >= 0, value.admissionRevision < 9_007_199_254_740_990,
      value.records.count <= 32, Set(value.records.map(\.operationID)).count == value.records.count,
      value.currentBindingID.map({ UUID(uuidString: $0) != nil }) ?? true else { throw Failure.corrupt }
    let unresolved = value.records.filter { !$0.terminal }
    let fences = unresolved.map { "\($0.original.ownerDigest):\($0.original.generation):\($0.original.scopeEpoch):\($0.bindingID)" }
    guard Set(fences).count == fences.count else { throw Failure.corrupt }
    for record in value.records {
      guard UUID(uuidString: record.operationID) != nil, UUID(uuidString: record.bindingID) != nil,
        record.original.ownerDigest.count == 64, record.original.ownerDigest.allSatisfy({ $0.isHexDigit }),
        record.original.generation >= 0, record.original.generation < 9_007_199_254_740_990,
        record.original.scopeEpoch >= 0, record.original.scopeEpoch < 9_007_199_254_740_990,
        record.nativeEpoch.map({ $0 >= 0 && $0 < 9_007_199_254_740_991 }) ?? true,
        ["retained-intent", "unverified"].contains(record.retainedPolicyState),
        record.admissionRevision >= 0, record.admissionRevision <= value.admissionRevision,
        record.resources.valid, try JSONEncoder().encode(record).count <= 8192,
        record.retainedPolicyDigest.map({ $0.count == 64 }) ?? true,
        (record.resultingGeneration == nil) == (record.nativeEpoch == nil),
        record.resultingGeneration.map({ $0 == record.original.generation + 1 }) ?? true,
        record.executionRequested != false || (record.phase == .prepared && record.resultingGeneration == nil && !record.privateStoreErased && !record.localRuntimeScrubComplete && !record.runtimeScrubComplete),
        !record.privateStoreErased || record.resultingGeneration != nil,
        record.phase != .prepared || record.resultingGeneration == nil,
        ![.fenced, .privateErased, .runtimePending, .completed].contains(record.phase) || record.resultingGeneration != nil,
        record.phase != .completed || (record.privateStoreErased && record.legacyPrivateStoreErased && record.runtimeScrubComplete && !record.coreInvalidationPending),
        (record.processScrubState == nil || record.processScrubResolved || (!record.localRuntimeScrubComplete && !record.runtimeScrubComplete)),
        !record.runtimeScrubComplete || (record.localRuntimeScrubComplete && !record.resources.notificationsUnverified) else { throw Failure.corrupt }
    }
  }
  static func stage(_ value: Journal, _ defaults: UserDefaults) throws {
    try validate(value)
    let encoder = JSONEncoder(); encoder.outputFormatting = [.sortedKeys]
    let data = try encoder.encode(value)
    guard data.count <= 131_072 else { throw Failure.capacity }
    defaults.set(data, forKey: key)
  }
  static func required(_ id: String, _ defaults: UserDefaults) throws -> Record {
    guard let record = try read(defaults).records.first(where: { $0.operationID == id }) else { throw Failure.unknownOperation }
    return record
  }
  static func replace(_ record: Record, _ defaults: UserDefaults) throws {
    var journal = try read(defaults)
    guard let index = journal.records.firstIndex(where: { $0.operationID == record.operationID }),
      journal.records[index].original == record.original, journal.records[index].bindingID == record.bindingID else { throw Failure.unknownOperation }
    guard !journal.records[index].terminal || journal.records[index] == record else { throw Failure.staleBinding }
    journal.records[index] = record; try stage(journal, defaults)
  }
  static func originalCurrent(_ record: Record, _ defaults: UserDefaults) -> Bool {
    guard let data = defaults.data(forKey: "freed.appGroups.v1"),
      let state = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any] else { return false }
    return state["ownerDigest"] as? String == record.original.ownerDigest
      && state["generation"] as? Int == record.original.generation
      && state["scopeEpoch"] as? Int == record.original.scopeEpoch
      && FreedProtectionConfigurationLock.generation(defaults) == record.original.generation
  }
  static func prepare(original: FreedRetainedAdultProtection.OwnerFence, bindingID: String,
                      resources: Resources, defaults: UserDefaults) throws -> Record {
    var journal = try read(defaults)
    if let prior = journal.records.first(where: { $0.original == original && $0.bindingID == bindingID }) { return prior }
    var resources = resources
    guard resources.valid, journal.currentBindingID == bindingID else { throw Failure.staleBinding }
    // Reading retained intent must never migrate or replace unknown bytes.
    if let legacy = FreedProtectionConfigurationLock.legacyConfiguration(defaults) {
      resources.legacyDomain = legacy.domain
      let privateValues = legacy.values.filter { FreedRetainedAdultProtection.privateNamespace($0.key) }
      if privateValues.isEmpty { resources.legacyKeys = [:] }
      else if let data = legacy.values["freed.appGroups.v1"] as? Data,
        let originalOwner = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any],
        originalOwner["ownerDigest"] as? String == original.ownerDigest {
        resources.legacyKeys = try privateValues.mapValues { try legacyFingerprint($0) }
      } else { resources.legacyKeys = nil }
    } else { resources.legacyKeys = nil }
    guard resources.valid else { throw Failure.capacity }
    let retained = retainedFingerprint(defaults)
    let record = Record(operationID: UUID().uuidString.lowercased(), original: original,
      bindingID: bindingID, admissionRevision: journal.admissionRevision, resources: resources,
      retainedPolicyDigest: retained, retainedPolicyState: retained == nil ? "unverified" : "retained-intent")
    guard originalCurrent(record, defaults) else { throw Failure.staleBinding }
    while journal.records.count >= 32 {
      guard let index = journal.records.firstIndex(where: \.terminal) else { throw Failure.capacity }
      journal.records.remove(at: index)
    }
    journal.records.append(record)
    while (try JSONEncoder().encode(journal).count) > 131_072 {
      guard let index = journal.records.firstIndex(where: \.terminal) else { throw Failure.capacity }
      journal.records.remove(at: index)
    }
    try stage(journal, defaults); return record
  }
  // Only the explicit execute entry calls this; reconcile/status never arms work.
  // The containing transaction must commit before any runtime/Core/OS effect.
  static func arm(_ id: String, _ defaults: UserDefaults) throws -> Record {
    var record = try required(id, defaults)
    if record.terminal || record.executionAdmitted { return record }
    let journal = try read(defaults)
    guard record.phase == .prepared, record.resultingGeneration == nil, record.nativeEpoch == nil,
      originalCurrent(record, defaults), journal.currentBindingID == record.bindingID,
      journal.admissionRevision == record.admissionRevision else { throw Failure.staleBinding }
    record.executionRequested = true
    try replace(record, defaults)
    return record
  }
  static func fence(_ id: String, _ defaults: UserDefaults) throws -> Record {
    var journal = try read(defaults)
    guard let index = journal.records.firstIndex(where: { $0.operationID == id }) else { throw Failure.unknownOperation }
    var record = journal.records[index]
    guard record.phase == .prepared else { return record }
    guard record.executionAdmitted else { throw Failure.staleBinding }
    guard originalCurrent(record, defaults), journal.currentBindingID == record.bindingID,
      journal.admissionRevision == record.admissionRevision else { throw Failure.staleBinding }
    record.resultingGeneration = record.original.generation + 1
    defaults.set(record.resultingGeneration, forKey: FreedProtectionConfigurationLock.generationKey)
    defaults.set(true, forKey: FreedProtectionConfigurationLock.resetMarkerKey)
    journal.admissionRevision += 1
    record.nativeEpoch = try FreedProtectionConfigurationLock.fenceAdultMutations(defaults)
    record.phase = .fenced; journal.records[index] = record
    try stage(journal, defaults); return record
  }
  static func ownsRevokedNamespace(_ record: Record, _ defaults: UserDefaults) throws -> Bool {
    let journal = try read(defaults)
    return record.resultingGeneration != nil && journal.currentBindingID == record.bindingID
      && journal.admissionRevision == record.admissionRevision + 1
      && FreedProtectionConfigurationLock.generation(defaults) == record.resultingGeneration
  }
  static func acknowledgeCore(_ id: String, _ defaults: UserDefaults) throws {
    var record = try required(id, defaults)
    if record.terminal { return }
    guard record.executionAdmitted else { throw Failure.staleBinding }
    record.coreInvalidationPending = false
    record.localRuntimeScrubComplete = record.localRuntimeScrubComplete && record.processScrubResolved
    record.runtimeScrubComplete = record.runtimeScrubComplete && record.processScrubResolved
    if record.runtimeScrubComplete && record.privateStoreErased && record.legacyPrivateStoreErased { record.phase = .completed; record.resources = Resources(notificationsUnverified: false) }
    try replace(record, defaults)
  }
  static func erase(_ id: String, _ defaults: UserDefaults) throws -> Record {
    var record = try required(id, defaults)
    if record.privateStoreErased || record.terminal { return record }
    guard record.phase == .fenced else { throw Failure.staleBinding }
    guard try ownsRevokedNamespace(record, defaults) else {
      record.phase = .supersededRuntime; try replace(record, defaults); return record
    }
    FreedRetainedAdultProtection.erasePrivateNamespaces(defaults)
    guard FreedRetainedAdultProtection.privateNamespacesAbsent(defaults) else { throw Failure.corrupt }
    record.privateStoreErased = true; record.phase = .privateErased
    if let retained = record.retainedPolicyDigest, retainedFingerprint(defaults) != retained {
      record.retainedPolicyState = "unverified"
    }
    try replace(record, defaults); return record
  }
}
