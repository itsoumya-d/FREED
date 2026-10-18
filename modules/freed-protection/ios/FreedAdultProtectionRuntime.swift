import Foundation
#if os(iOS)
import ManagedSettings
import DeviceActivity
import SafariServices
import CryptoKit
import FamilyControls

// One host-owned graph. Initialization never replaces a missing enrolled journal.
// The exact core store is passed to the census; no caller supplies another store.
@available(iOS 15.1, *)
@MainActor
final class FreedAdultProtectionRuntime {
  private static var instance: FreedAdultProtectionRuntime?
  private let core: FriendLockCore
  private let operations: FreedAdultProtectionOperationStore
  let coordinator: FreedAdultProtectionLockCoordinator
  private let adapter: FreedProductionAdultMutationAdapter
  private let enrollmentEnabled: Bool
  private var initialization: Task<Void, Error>?
  private init(records: FriendLockRecordStore, operations: FreedAdultProtectionOperationStore,
               crypto: any FriendLockCrypto, providers: any FreedAdultNativeProviders, enrollmentEnabled: Bool = false) {
    self.enrollmentEnabled = enrollmentEnabled
    core = FriendLockCore(store: records, crypto: crypto)
    self.operations = operations
    let adapter = FreedProductionAdultMutationAdapter(providers: providers)
    self.adapter = adapter
    coordinator = FreedAdultProtectionLockCoordinator(core: core, crypto: crypto, adapter: adapter,
      operations: operations, coreRecords: records,
      enrollmentSnapshot: enrollmentEnabled ? { lease in
        guard let native = providers as? FreedAdultSystemProviders else { throw FriendLockFailure.baselineUnavailable }
        let snapshot = try await adapter.snapshot(lease: lease)
        try native.requireEnrollmentReady(snapshot)
        return snapshot
      } : nil)
  }
  #if os(iOS)
  private convenience init() throws {
    FreedProtectionAppExecution.install()
    let crypto = FriendLockNativeCrypto()
    let records = FriendLockRecordStore(bytes: try FriendLockKeychainBytes())
    let operations = FreedAdultProtectionOperationStore(bytes: try FreedAdultOperationFileBytes(), crypto: crypto)
    self.init(records: records, operations: operations, crypto: crypto, providers: FreedAdultSystemProviders())
  }
  static func shared() throws -> FreedAdultProtectionRuntime {
    if let instance { return instance }
    let created = try FreedAdultProtectionRuntime(); instance = created; return created
  }
  #endif
  #if FREED_NATIVE_FIXTURES
  static func fixture(coreBytes: any FriendLockProtectedBytes, operationBytes: any FreedAdultOperationBytes,
                      crypto: any FriendLockCrypto, providers: any FreedAdultNativeProviders, enrollmentEnabled: Bool = false) -> FreedAdultProtectionRuntime {
    Self(records: FriendLockRecordStore(bytes: coreBytes),
      operations: FreedAdultProtectionOperationStore(bytes: operationBytes, crypto: crypto), crypto: crypto, providers: providers, enrollmentEnabled: enrollmentEnabled)
  }
  var fixtureCore: FriendLockCore { core }
  var fixtureOperations: FreedAdultProtectionOperationStore { operations }
  #endif
  // Same production core; never initializes a journal or enters the DNS lane.
  func friendLockStatusForCleanup() async throws -> FriendLockStatus { try await core.status() }
  func initialize() async throws {
    if let initialization { return try await initialization.value }
    let task = Task {
      switch try await self.core.status() {
      case .notEnrolled: try await self.operations.initializeBeforeEnrollment(core: self.core)
      case .enrolled: _ = try await self.coordinator.reconcilePending()
      case .missingEnrolled: throw FriendLockFailure.missingEnrolled
      case .corrupt: throw FriendLockFailure.corrupt
      case .unavailable: throw FriendLockFailure.storageUnavailable
      }
    }
    initialization = task
    do { try await task.value; initialization = nil }
    catch { initialization = nil; throw error }
  }
  func executeObserved(operationID: String) async -> FreedAdultExecutionObservation {
    do { try await initialize() } catch { return .failed(error) }
    return await FreedAdultExecutionObserver.run { try await self.coordinator.execute(operationID: operationID) }
  }
  func snapshot() async throws -> FreedNativeAdultSnapshot {
    try await initialize()
    let lease = try FreedAdultProtectionLegacyGate.acquireWriter()
    defer { FreedAdultProtectionLegacyGate.releaseWriter(lease) }
    return try await adapter.snapshot(lease: lease)
  }
}

// The only JS-facing adapter uses this runtime's exact protected Core and coordinator.
// Default production construction keeps enrollment disabled. Only native fixtures inject its gate.
@available(iOS 15.1, *)
extension FreedAdultProtectionRuntime {
  private enum PublicInputFailure: Error { case invalid }
  static func deviceAdultError(_ error: Error) -> [String: Any] {
    let code: String
    if let failure = error as? FriendLockFailure { code = failure.rawValue }
    else if let failure = error as? FreedAdultLockIntegrationFailure {
      switch failure {
      case .authorizationRequired: code = "authorizationRequired"
      case .integrationDisabled: code = "integrationDisabled"
      case .operationInProgress: code = "operationInProgress"
      case .staleConfiguration: code = "staleConfiguration"
      case .interruptedOperation: code = "interruptedOperation"
      case .unknownOperation: code = "unknownOperation"
      case .invalidReadback: code = "invalidReadback"
      }
    } else { code = "unavailable" }
    return ["schema": 1, "kind": "error", "code": code]
  }
  func deviceAdultBridge(_ command: String, _ request: [String: Any]) async -> [String: Any] {
    func failure(_ code: String) -> [String: Any] { ["schema": 1, "kind": "error", "code": code] }
    func exact(_ keys: [String]) -> Bool { Set(request.keys) == Set(keys) }
    func text(_ key: String, _ limit: Int = 128) throws -> String {
      guard let value = request[key] as? String, value.utf8.count <= limit else { throw PublicInputFailure.invalid }; return value
    }
    do {
      guard command.utf8.count <= 16, request.count <= 6 else { return failure("invalidInput") }
      if command == "status" {
        guard request.isEmpty else { return failure("invalidInput") }
        // No journal initialization, configuration snapshot, DNS lane or account admission.
        let credential = try await core.status()
        let journal = try? operations.load()
        let pending = try? await coordinator.deviceAdultPendingIDs()
        let operationUnavailable = journal == nil || journal?.invalidationPending == true || journal?.authorityUncertain == true || journal?.cleanupInvalidations.contains(where: { !$0.acknowledged }) == true
        let mutationUnavailable = credential != .enrolled || operationUnavailable
        let mutationReason = credential == .notEnrolled ? "notEnrolled" : credential != .enrolled ? "protectedRecordUnavailable" : operationUnavailable ? "operationStateUnavailable" : "baselineUnobserved"
        let enrollmentReady = enrollmentEnabled ? await coordinator.enrollmentReady() : false
        return ["schema": 1, "kind": "status", "platform": "ios", "credential": credential.rawValue,
          "bridgeAvailable": true, "mutationAvailability": mutationUnavailable ? "unavailable" : "unknown", "mutationReason": mutationReason,
          "enrollmentAvailable": enrollmentReady, "enrollmentReason": enrollmentEnabled ? (credential == .enrolled ? "alreadyEnrolled" : enrollmentReady ? "nativeReady" : "nativeReadinessUnavailable") : "integrationDisabled",
          "actions": ["continuousOff", "dnsOff", "adultOff", "adultReset"],
          "pendingKnown": pending != nil, "pendingOperationIDs": pending ?? [],
          "observations": ["continuous": "unknown", "risk": "unknown", "safari": "unknown", "dns": "unknown"]]
      }
      if command == "enroll" {
        guard enrollmentEnabled else { return failure("integrationDisabled") }
        guard exact(["pin", "confirmation"]) else { return failure("invalidInput") }
        let result = try await coordinator.enroll(pin: text("pin", 64), confirmation: text("confirmation", 64))
        return ["schema": 1, "kind": "enrollment", "credential": "enrolled", "keyPresentation": "required", "lockRevision": String(result.lockRevision), "recoveryKey": result.recoveryKey]
      }
      if command == "prepare" {
        guard exact(["action"]) else { return failure("invalidInput") }
        guard let action = FreedAdultChangeRequest(rawValue: try text("action")) else { return failure("unsupportedAction") }
        try await initialize()
        let receipt = try await coordinator.prepare(request: action)
        return try await coordinator.deviceAdultOperation(receipt.operationID)
      }
      if command == "rotate" {
        guard exact(["secretType", "secret", "pin", "confirmation"]) else { return failure("invalidInput") }
        let type = try text("secretType"), secret = try text("secret"), pin = try text("pin", 64), confirmation = try text("confirmation", 64)
        guard ["pin", "recovery"].contains(type) else { return failure("invalidInput") }
        try await initialize()
        let result = try await coordinator.rotate(secret: type == "pin" ? .pin(secret) : .recovery(secret), pin: pin, confirmation: confirmation)
        return ["schema": 1, "kind": "rotation", "lockRevision": String(result.lockRevision), "recoveryKey": result.recoveryKey]
      }
      guard ["authorize", "execute", "read", "cancel"].contains(command), exact(command == "authorize" ? ["operationID", "pin"] : ["operationID"]) else { return failure("invalidInput") }
      let id = try text("operationID", 32)
      guard FriendLockReceipt.hex(id, 32) else { return failure("invalidInput") }
      if command == "read" { return try await coordinator.deviceAdultOperation(id) }
      try await initialize()
      switch command {
      case "authorize": _ = try await coordinator.authorize(operationID: id, pin: try text("pin", 64))
      case "cancel": _ = try await coordinator.cancel(operationID: id)
      case "execute":
        switch await executeObserved(operationID: id) {
        case .pending: return try await coordinator.deviceAdultOperation(id, pending: true)
        case .completed: break
        case .failed(let error): return Self.deviceAdultError(error)
        }
      default: return failure("invalidInput")
      }
      return try await coordinator.deviceAdultOperation(id)
    } catch is PublicInputFailure { return failure("invalidInput") }
    catch { return Self.deviceAdultError(error) }
  }
}

@available(iOS 15.1, *)
@MainActor
final class FreedAdultSystemProviders: FreedAdultNativeProviders {
  private let store = ManagedSettingsStore()
  private let center = DeviceActivityCenter()
  private let night = DeviceActivityName("freed.nightGuard")
  private let safariIdentifier = "app.freed.recovery.safari-content-blocker"
  private let crypto = FriendLockNativeCrypto()
  private var undo: [String: (FreedAdultLayerPermit) async throws -> Void] = [:]
  private struct Risk: Codable {
    struct Schedule: Codable { let start: DateComponents; let end: DateComponents; let repeats: Bool; let warning: DateComponents? }
    struct Event: Codable { let name: String; let applications: [String]; let categories: [String]; let domains: [String]; let threshold: DateComponents; let includesPast: Bool? }
    let present: Bool
    let schedule: Schedule?
    let events: [Event]
  }
  private struct SafariLocal: Codable {
    let selectedHash: String
    let publication: FreedRetainedAdultProtection.SafariPublication?
  }
  // Positive installed coverage comes from supported native providers, never saved intent.
  #if FREED_NATIVE_FIXTURES
  static var fixtureAuthorizationApproved = true
  #endif
  func requireEnrollmentReady(_ snapshot: FreedNativeAdultSnapshot) throws {
    #if FREED_NATIVE_FIXTURES
    let authorized = Self.fixtureAuthorizationApproved
    #else
    let authorized = AuthorizationCenter.shared.authorizationStatus == .approved
    #endif
    let readback = try FreedAdultCanonicalReadback.decode(snapshot)
    guard authorized, snapshot.policy.continuous,
      try JSONDecoder().decode(String.self, from: readback.layers["continuous"]!) == "auto-empty-exceptions" else { throw FriendLockFailure.baselineUnavailable }
    struct DNS: Decodable { let loaded: FreedLoadedDnsObservation }
    let dns = try JSONDecoder().decode(DNS.self, from: readback.layers["dns"]!).loaded
    guard dns.recognized, !snapshot.policy.encryptedDNS || (dns.hasSettings && dns.enabled) else { throw FriendLockFailure.baselineUnavailable }
    let safari = try JSONDecoder().decode(FreedProductionAdultMutationAdapter.SafariObservation.self, from: readback.layers["safari"]!)
    guard !snapshot.policy.safari || safari.enabled else { throw FriendLockFailure.baselineUnavailable }
    try FreedAdultConfigurationAccess.withExclusiveAccess { defaults in
      guard try FreedAccountProtectionCleanup.read(defaults).records.allSatisfy({ $0.terminal }),
        defaults.object(forKey: FreedAdultLayerPermit.reservationKey) == nil else { throw FreedAdultLockIntegrationFailure.interruptedOperation }
      if snapshot.policy.safari {
        let bytes = try Data(contentsOf: container().appendingPathComponent("safari-content-blocker-rules.json"))
        guard let rules = try JSONSerialization.jsonObject(with: bytes) as? [[String: Any]],
          rules.contains(where: { ($0["action"] as? [String: Any])?["type"] as? String == "block" }) else { throw FriendLockFailure.baselineUnavailable }
      }
    }
  }
  private func tokenStrings<T: Encodable & Hashable>(_ tokens: Set<T>) throws -> [String] {
    try tokens.map { try freedAdultEncode($0).base64EncodedString() }.sorted()
  }
  private func riskData() throws -> Data {
    let schedule = center.schedule(for: night)
    let events = try center.events(for: night).map { name, event in
      var includesPast: Bool?
      if #available(iOS 17.4, *) { includesPast = event.includesPastActivity }
      return try Risk.Event(name: name.rawValue, applications: tokenStrings(event.applications),
        categories: tokenStrings(event.categories), domains: tokenStrings(event.webDomains), threshold: event.threshold, includesPast: includesPast)
    }.sorted { $0.name < $1.name }
    return try freedAdultEncode(Risk(present: center.activities.contains(night), schedule: schedule.map {
      Risk.Schedule(start: $0.intervalStart, end: $0.intervalEnd, repeats: $0.repeats, warning: $0.warningTime)
    }, events: events))
  }
  private func filterData() throws -> Data {
    let value: String
    switch store.webContent.blockedByFilter {
    case nil: value = "unset"
    case .auto(let domains, let exceptions) where domains.isEmpty && exceptions.isEmpty: value = "auto-empty-exceptions"
    default: throw FreedAdultLockIntegrationFailure.invalidReadback
    }
    return try freedAdultEncode(value)
  }
  // Compensation may only preserve or strengthen the currently installed filter.
  // Reverse continuous restoration precedes risk restoration, so a temporarily
  // false effective policy cannot authorize clearing the surviving risk filter.
  // The caller has already checked its exact permit inside configuration exclusion.
  private func restoreCompensatingFilter(_ defaults: UserDefaults) throws {
    let before = try filterData()
    if try FreedRetainedAdultProtection.filterDecision(defaults) {
      store.webContent.blockedByFilter = .auto([], except: [])
      guard store.webContent.blockedByFilter == .auto([], except: []) else { throw FreedAdultLockIntegrationFailure.invalidReadback }
    } else {
      guard try filterData() == before else { throw FreedAdultLockIntegrationFailure.invalidReadback }
    }
  }
  private func container() throws -> URL {
    #if FREED_NATIVE_FIXTURES
    if let path = FreedAdultConfigurationAccess.fixtureContainer { return path }
    #endif
    guard let url = FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: FreedProtectionConfigurationLock.appGroupIdentifier) else { throw FreedProtectionConfigurationLock.AccessError.containerUnavailable }
    return url
  }
  private func safariLocal(_ defaults: UserDefaults) throws -> Data {
    let retained = try FreedRetainedAdultProtection.read(defaults)
    let publication = try FreedRetainedAdultProtection.SafariPublication.read(defaults)
    let selected: URL
    if !retained.safari, let publication {
      selected = try container().appendingPathComponent(FreedRetainedAdultProtection.SafariPublication.fileName)
      guard try Data(contentsOf: selected) == FreedRetainedAdultProtection.SafariPublication.inert,
        try freedAdultHash(Data(contentsOf: selected), crypto: crypto) == publication.payloadHash else { throw FreedAdultLockIntegrationFailure.invalidReadback }
    } else {
      selected = try container().appendingPathComponent("safari-content-blocker-rules.json")
    }
    let bytes = try Data(contentsOf: selected)
    guard !bytes.isEmpty, bytes.count <= 16 * 1024 * 1024 else { throw FreedAdultLockIntegrationFailure.invalidReadback }
    return try freedAdultEncode(SafariLocal(selectedHash: freedAdultHash(bytes, crypto: crypto), publication: publication))
  }
  func localLayers(_ defaults: UserDefaults) throws -> [String: Data] {
    try ["continuous": filterData(), "risk": riskData(), "safari": safariLocal(defaults)]
  }
  func observeDNS(lease: FreedAdultProtectionLegacyGate.WriterLease) async throws -> FreedLoadedDnsObservation {
    try await FreedAdultDNSProvider.observe(lease: lease)
  }
  func observeSafariSettled(lease: FreedAdultProtectionLegacyGate.WriterLease) async throws -> Bool {
    try FreedAdultProtectionLegacyGate.requireCurrent(lease)
    let result: Bool = try await settled { registered, callback in
      registered()
      SFContentBlockerManager.getStateOfContentBlocker(withIdentifier: safariIdentifier) { state, error in
        if let error { callback(.failure(error)) }
        else if let state { callback(.success(state.isEnabled)) }
        else { callback(.failure(FreedAdultLockIntegrationFailure.invalidReadback)) }
      }
    }
    try FreedAdultProtectionLegacyGate.requireCurrent(lease)
    return result
  }
  // Registration and callback settlement are distinct. An error after registering
  // retains ownership until Apple's real callback, including inline/duplicate cases.
  private func settled<T>(_ register: (@escaping () -> Void, @escaping (Result<T, Error>) -> Void) throws -> Void) async throws -> T {
    try await withCheckedThrowingContinuation { continuation in
      let lock = NSLock(); var registered = false; var finishedRegistration = false; var response: Result<T, Error>?; var error: Error?; var resumed = false
      func resolve() {
        lock.lock()
        guard finishedRegistration, let response, !resumed else { lock.unlock(); return }
        resumed = true; let result: Result<T, Error> = error.map { .failure($0) } ?? response; lock.unlock()
        continuation.resume(with: result)
      }
      do { try register({ lock.lock(); registered = true; lock.unlock() }, { result in lock.lock(); if response == nil { response = result }; lock.unlock(); resolve() }) }
      catch let caught { lock.lock(); error = caught; if !registered && response == nil { response = .failure(caught) }; lock.unlock() }
      lock.lock(); finishedRegistration = true; lock.unlock(); resolve()
    }
  }
  func perform(_ layer: FreedAdultLayer, permit: FreedAdultLayerPermit) async throws {
    guard !permit.step.compensation, permit.step.layer == layer else { throw FreedAdultLockIntegrationFailure.authorizationRequired }
    if permit.request == .recoveryModeActivate {
      #if os(iOS)
      guard #available(iOS 16.0, *), layer == .continuous, let candidate = permit.dnsCandidate,
        let proof = permit.activationProof, permit.before.continuous, permit.before.encryptedDNS,
        permit.desired.continuous, permit.desired.encryptedDNS, permit.desired.hostedRecoveryDns == candidate.identity else {
        throw FreedAdultLockIntegrationFailure.authorizationRequired
      }
      let dns = try await observeDNS(lease: permit.lease)
      guard dns.recognized, dns.enabled, dns.pilot == candidate.identity else { throw FreedRecoveryDnsPilotFailure.profileUnavailable }
      guard dns.failoverSupported, dns.failoverMatches == true else { throw FreedRecoveryDnsPilotFailure.modeUnsupported }
      try FreedRecoveryDnsPilot.requireActivationProof(proof, candidate: candidate)
      do { try FreedAdultConfigurationAccess.withExclusiveAccess { defaults in
        let observed = try filterData()
        // The profile observation and exact in-process proof were obtained in
        // this same admitted adult lane. No suspend separates proof recheck,
        // native dispatch, readback and retained publication.
        try FreedRecoveryDnsPilot.requireActivationProof(proof, candidate: candidate)
        try permit.beginDispatch(defaults, layer: .continuous, observed: observed)
        undo[permit.step.operationID + ":continuous"] = { [self] repair in
          try FreedAdultConfigurationAccess.withExclusiveAccess { defaults in
            let observed = try filterData()
            try repair.beginDispatch(defaults, layer: .continuous, observed: observed)
            // Compensation is strengthening and never clears a stronger filter.
            try FreedRecoveryDnsNativeFilter.installAuto()
            try repair.publish(defaults, layer: .continuous, observed: observed)
            defaults.set(repair.desired.continuous, forKey: "freed.adultFilterActive")
          }
        }
        let previous = store.webContent.blockedByFilter
        store.webContent.blockedByFilter = nil
        guard store.webContent.blockedByFilter == nil else { throw FreedAdultLockIntegrationFailure.invalidReadback }
        do {
          try permit.publish(defaults, layer: .continuous, observed: observed)
          // Adult intent remains true; ads/challenges gain no adult unlock.
          defaults.set(true, forKey: "freed.adultFilterActive")
        } catch {
          // A failed intent publication cannot leave the OS weakener applied.
          store.webContent.blockedByFilter = previous ?? .auto([], except: [])
          throw error
        }
      } } catch { try? FreedRecoveryDnsNativeFilter.installAuto(); throw error }
      return
      #else
      throw FreedAdultLockIntegrationFailure.integrationDisabled
      #endif
    }
    switch layer {
    case .dns:
      if permit.request == .dnsReplace { _ = try await FreedAdultDNSProvider.replace(permit: permit, lease: permit.lease) }
      else { _ = try await FreedAdultDNSProvider.remove(permit: permit, lease: permit.lease) }
    case .safari: try await disableSafari(permit)
    case .risk:
      try FreedAdultConfigurationAccess.withExclusiveAccess { defaults in
        let observed = try riskData()
        let priorSchedule = center.schedule(for: night), priorEvents = center.events(for: night)
        let priorIntent = defaults.data(forKey: "freed.riskWindow.expected.v1")
        undo[permit.step.operationID + ":risk"] = { [self] repair in
          try FreedAdultConfigurationAccess.withExclusiveAccess { defaults in
            let observed = try riskData()
            try repair.beginDispatch(defaults, layer: .risk, observed: observed)
            try repair.publish(defaults, layer: .risk, observed: observed)
            defaults.set(priorIntent, forKey: "freed.riskWindow.expected.v1")
            defaults.set(repair.desired.riskEnabled, forKey: "freed.riskWindowActive")
            try restoreCompensatingFilter(defaults)
            if let priorSchedule { try center.startMonitoring(night, during: priorSchedule, events: priorEvents) }
            guard center.schedule(for: night) == priorSchedule, center.events(for: night) == priorEvents else { throw FreedAdultLockIntegrationFailure.invalidReadback }
          }
        }
        try permit.beginDispatch(defaults, layer: .risk, observed: observed)
        try permit.publish(defaults, layer: .risk, observed: observed)
        defaults.set(false, forKey: "freed.riskWindowActive")
        defaults.set(false, forKey: "freed.riskWindow.currentlyActive")
        defaults.removeObject(forKey: "freed.riskWindow.expected.v1")
        guard FreedProtectionConfigurationLock.persist(defaults) else { throw FreedRetainedAdultProtection.Failure.persistence }
        center.stopMonitoring([night])
        guard !center.activities.contains(night), center.schedule(for: night) == nil, center.events(for: night).isEmpty else { throw FreedAdultLockIntegrationFailure.invalidReadback }
      }
    case .continuous:
      try FreedAdultConfigurationAccess.withExclusiveAccess { defaults in
        let observed = try filterData()
        undo[permit.step.operationID + ":continuous"] = { [self] repair in
          try FreedAdultConfigurationAccess.withExclusiveAccess { defaults in
            let observed = try filterData()
            try repair.beginDispatch(defaults, layer: .continuous, observed: observed)
            try repair.publish(defaults, layer: .continuous, observed: observed)
            defaults.set(repair.desired.continuous, forKey: "freed.adultFilterActive")
            try restoreCompensatingFilter(defaults)
          }
        }
        try permit.beginDispatch(defaults, layer: .continuous, observed: observed)
        try permit.publish(defaults, layer: .continuous, observed: observed)
        defaults.set(false, forKey: "freed.adultFilterActive")
        let required = try FreedRetainedAdultProtection.filterDecision(defaults)
        store.webContent.blockedByFilter = required ? .auto([], except: []) : nil
        guard store.webContent.blockedByFilter == (required ? .auto([], except: []) : nil) else { throw FreedAdultLockIntegrationFailure.invalidReadback }
        if permit.request == .adultReset {
          // The final layer follows acknowledged DNS/Safari/risk checkpoints.
          // Only adult setup metadata is cleared; retained policy/publication and
          // app authority remain available to their separate consumers.
          for key in ["freed.safariContentBlocker.version", "freed.safariContentBlocker.checksum",
            "freed.safariContentBlocker.generatedAt", "freed.safariContentBlocker.ruleCount",
            "freed.safariContentBlocker.lastReloadError", "freed.safariContentBlocker.stateKnown",
            "freed.safariContentBlocker.enabled", "freed.safariContentBlocker.stateCheckedAt", "freed.safariContentBlocker.stateError"] {
            defaults.removeObject(forKey: key)
          }
        }
      }
    }
  }
  func compensate(_ layer: FreedAdultLayer, permit: FreedAdultLayerPermit) async throws {
    guard permit.step.compensation, permit.step.layer == layer else { throw FreedAdultLockIntegrationFailure.authorizationRequired }
    if layer == .dns { try await FreedAdultDNSProvider.compensate(permit: permit); return }
    guard let restore = undo[permit.step.operationID + ":" + layer.rawValue] else { throw FreedAdultLockIntegrationFailure.interruptedOperation }
    try await restore(permit)
  }
  func discard(_ operationID: String) {
    undo = undo.filter { !$0.key.hasPrefix(operationID + ":") }
    FreedAdultDNSProvider.discard(operationID)
  }
  private func disableSafari(_ permit: FreedAdultLayerPermit) async throws {
    let enabled = try await observeSafariSettled(lease: permit.lease)
    var selected: FreedRetainedAdultProtection.SafariPublication?
    try FreedAdultConfigurationAccess.withExclusiveAccess { defaults in
      let before = try freedAdultEncode(FreedProductionAdultMutationAdapter.SafariObservation(local: safariLocal(defaults), enabled: enabled))
      try permit.beginDispatch(defaults, layer: .safari, observed: before)
      let previous = try FreedRetainedAdultProtection.SafariPublication.read(defaults)
      let previousLocal = try safariLocal(defaults)
      undo[permit.step.operationID + ":safari"] = { [self] repair in
        let enabled = try await observeSafariSettled(lease: repair.lease)
        try FreedAdultConfigurationAccess.withExclusiveAccess { defaults in
          let observed = try freedAdultEncode(FreedProductionAdultMutationAdapter.SafariObservation(local: safariLocal(defaults), enabled: enabled))
          try repair.beginDispatch(defaults, layer: .safari, observed: observed)
          try repair.publish(defaults, layer: .safari, observed: observed)
          if let previous { try previous.stage(defaults) } else { defaults.removeObject(forKey: FreedRetainedAdultProtection.SafariPublication.key) }
          guard try safariLocal(defaults) == previousLocal else { throw FreedAdultLockIntegrationFailure.invalidReadback }
        }
        let _: Bool = try await settled { registered, callback in
          try FreedAdultConfigurationAccess.withExclusiveAccess { defaults in
            try repair.validate(defaults, layer: .safari, observed: Data(), published: true)
            guard try safariLocal(defaults) == previousLocal else { throw FreedAdultLockIntegrationFailure.staleConfiguration }
            registered()
            SFContentBlockerManager.reloadContentBlocker(withIdentifier: safariIdentifier) { error in callback(error.map { .failure($0) } ?? .success(true)) }
          }
        }
      }
      let bytes = FreedRetainedAdultProtection.SafariPublication.inert
      let path = try container().appendingPathComponent(FreedRetainedAdultProtection.SafariPublication.fileName)
      try bytes.write(to: path, options: .atomic)
      guard try Data(contentsOf: path) == bytes else { throw FreedAdultLockIntegrationFailure.invalidReadback }
      let publication = FreedRetainedAdultProtection.SafariPublication(generation: (previous?.generation ?? 0) + 1,
        nativeEpoch: permit.step.nativeScope.nativeEpoch, payloadHash: try freedAdultHash(bytes, crypto: crypto), reloadAcknowledged: false)
      try permit.publish(defaults, layer: .safari, observed: before)
      try publication.stage(defaults)
      selected = publication
    }
    guard var publication = selected else { throw FreedAdultLockIntegrationFailure.invalidReadback }
    let _: Bool = try await settled { registered, callback in
      try FreedAdultConfigurationAccess.withExclusiveAccess { defaults in
        try permit.validate(defaults, layer: .safari, observed: Data(), published: true)
        guard try FreedRetainedAdultProtection.SafariPublication.read(defaults) == publication else { throw FreedAdultLockIntegrationFailure.staleConfiguration }
        registered()
        SFContentBlockerManager.reloadContentBlocker(withIdentifier: safariIdentifier) { error in
          callback(error.map { .failure($0) } ?? .success(true))
        }
      }
    }
    try FreedAdultConfigurationAccess.withExclusiveAccess { defaults in
      try permit.validate(defaults, layer: .safari, observed: Data(), published: true)
      guard try FreedRetainedAdultProtection.SafariPublication.read(defaults) == publication else { throw FreedAdultLockIntegrationFailure.staleConfiguration }
      publication.reloadAcknowledged = true
      try publication.stage(defaults)
    }
  }
}
#endif
