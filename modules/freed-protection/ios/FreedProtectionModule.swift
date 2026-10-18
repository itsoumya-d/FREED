import ExpoModulesCore
import Foundation

// Expo bridge carrier is host-only; extensions share only lifecycle state.
final class FreedAccountBindingSession: SharedObject {
  let state: FreedAccountBindingSessionState
  init(module: UUID) throws { state = try FreedAccountBindingLifecycle.issue(module: module); super.init() }
  override func sharedObjectWillRelease() { state.retire() }
}

#if canImport(UserNotifications)
import UserNotifications
#endif

#if canImport(NetworkExtension)
import NetworkExtension
#endif

// MARK: - Optional encrypted DNS

// Loaded OS fields only; marker metadata and presentation strings confer no
// authority. Unknown settings remain an explicit mismatch for the later adapter.
struct FreedEncryptedDnsPolicy {
  static func configurationLabel(selected: String?, preferred: String) -> String {
    let labels = [
      "en": "FREED · Cloudflare Families encrypted DNS",
      "hi": "FREED · Cloudflare Families एन्क्रिप्टेड DNS",
      "es": "FREED · DNS cifrado de Cloudflare Families",
      "pt": "FREED · DNS criptografado do Cloudflare Families",
      "fr": "FREED · DNS chiffré Cloudflare Families",
      "de": "FREED · Verschlüsseltes Cloudflare Families DNS",
      "ar": "FREED · DNS مشفّر من Cloudflare Families",
      "ja": "FREED · Cloudflare Families 暗号化DNS",
      "ko": "FREED · Cloudflare Families 암호화 DNS",
      "zh-Hans": "FREED · Cloudflare Families 加密 DNS"
    ]
    if let selected, let label = labels[selected] { return label }
    let language = preferred.replacingOccurrences(of: "_", with: "-").lowercased()
    if language.hasPrefix("zh") { return labels[["hant", "tw", "hk", "mo"].contains(where: language.contains) ? "en" : "zh-Hans"]! }
    return labels[String(language.split(separator: "-").first ?? "en")] ?? labels["en"]!
  }
  static func status(supported: Bool, releaseEnabled: Bool, configured: Bool,
                     managerEnabled: Bool, error: String? = nil) -> [String: Any] {
    let enabled = supported && configured && managerEnabled && error == nil
    let reason: String?
    if let error { reason = error }
    else if !supported { reason = "encrypted-dns-release-gated" }
    else if !configured { reason = nil }
    else if !managerEnabled { reason = "ios-dns-settings-enable-required" }
    else if !releaseEnabled { reason = "encrypted-dns-device-unverified" }
    else { reason = "ios-dns-health-unverified" }
    return [
      "supported": supported, "releaseEnabled": releaseEnabled, "configured": configured,
      "enabled": enabled, "healthy": NSNull(), "reason": reason.map { $0 as Any } ?? NSNull(),
      "provider": "cloudflare-families", "requiresSettings": configured && !enabled
    ]
  }
}

#if os(iOS) && canImport(NetworkExtension)
@available(iOS 14.0, *)
@MainActor
private final class FreedEncryptedDnsController {
  static let shared = FreedEncryptedDnsController()
  private let savedKey = "freed.encryptedDns.cloudflareFamilies.configured"
  private let url = URL(string: FreedAdultDNSProfile.url)!
  private let servers = FreedAdultDNSProfile.servers
  private var changingConfiguration = false
  // This singleton owns the shared NEDNSSettingsManager. Caller deadlines must
  // never release its lane: Apple's preference requests are not cancellable.
  // A bounded queue keeps an explicit stronger repair behind real settlement.
  private var queuedOperation: (id: UUID, kind: String, generation: Int, task: Task<[String: Any], Never>)?
  private var queuedOperationCount = 0
  private static let maximumQueuedOperations = 8

  private var legacyQueued: [UUID: Task<[String: Any], Never>] = [:]
  private var legacyTail: (id: UUID, key: String, epoch: Int)?
  private var activeAuthority: FreedAdultProtectionLegacyGate.LegacyAuthority?
  private var activeNativeEpoch: Int?
  private var enrolledPrevious: [String: (NEDNSSettings?, [NEOnDemandRule]?, String?)] = [:]
  private var activeCallerObservers = 0
  private static let maximumCallerObservers = 16
  #if FREED_NATIVE_FIXTURES
  var retainedCallerObserverCount: Int { activeCallerObservers }
  #endif

  // Acquire the OUTER adult lane before entering the INNER manager queue.
  // A legacy item waiting for the outer lane must never occupy the inner queue.
  private func enqueue(kind: String, operation: @escaping @MainActor () async -> [String: Any]) async -> [String: Any] {
    let generation: Int, observedEpoch: Int
    do { (generation, observedEpoch) = try FreedProtectionConfigurationLock.withExclusiveAccess { (FreedProtectionConfigurationLock.generation($0), try FreedProtectionConfigurationLock.adultMutationEpoch($0)) } }
    catch { return ["operationAccepted": false, "removed": false, "error": "ios-dns-configuration-lock-unavailable"] }
    let key = kind + ":" + String(generation)
    if let tail = legacyTail, tail.key == key, tail.epoch == observedEpoch, let existing = legacyQueued[tail.id] { return await waitForCaller(existing) }
    guard legacyQueued.count < Self.maximumQueuedOperations else { return pendingResult(reason: "ios-dns-operation-queue-full") }
    let epoch: Int
    do { epoch = try FreedProtectionConfigurationLock.withExclusiveAccess { try FreedProtectionConfigurationLock.fenceAdultMutations($0) } }
    catch { return ["operationAccepted": false, "removed": false, "error": "ios-dns-configuration-lock-unavailable"] }
    let requestID = UUID()
    let task = FreedAdultProtectionLegacyGate.enqueueLegacy(key: "dns:" + requestID.uuidString + ":" + String(epoch)) { authority in
      await self.performAdmittedLegacy(kind: kind, generation: generation, epoch: epoch, authority: authority, operation: operation)
    }
    legacyQueued[requestID] = task; legacyTail = (requestID, key, epoch)
    // One cleanup observer per bounded distinct request, never per caller.
    Task {
      _ = await task.value; self.legacyQueued.removeValue(forKey: requestID)
      if self.legacyTail?.id == requestID { self.legacyTail = nil }
    }
    return await waitForCaller(task)
  }

  private func performAdmittedLegacy(kind: String, generation: Int, epoch: Int,
                                    authority: FreedAdultProtectionLegacyGate.LegacyAuthority,
                                    operation: @escaping @MainActor () async -> [String: Any]) async -> [String: Any] {
    do {
      let task = try enqueueSettled(kind: kind, identity: "legacy:" + kind + ":" + String(epoch), generation: generation, lease: authority.lease) {
        self.activeAuthority = authority; self.activeNativeEpoch = epoch
        // A queued explicit stronger repair remains device-scoped. Renew its
        // fence at dispatch if an intervening request/owner changed the epoch;
        // a callback never renews authority after dispatch.
        if kind == "configure-enabled" {
          do {
            self.activeNativeEpoch = try FreedProtectionConfigurationLock.withExclusiveAccess { defaults in
              let current = try FreedProtectionConfigurationLock.adultMutationEpoch(defaults)
              return current == epoch ? epoch : try FreedProtectionConfigurationLock.fenceAdultMutations(defaults)
            }
          } catch { self.activeAuthority = nil; self.activeNativeEpoch = nil; return ["operationAccepted": false, "error": "ios-dns-configuration-lock-unavailable"] }
        }
        defer { self.activeAuthority = nil; self.activeNativeEpoch = nil }
        return await operation()
      }
      return await task.value
    } catch { return ["operationAccepted": false, "removed": false, "error": "ios-dns-operation-admission-failed"] }
  }

  // Queue-owned task has no caller deadline. The explicit native lease is a
  // lane identity only: C2 must additionally supply exact mutation permits.
  private func enqueueSettled(kind: String, identity: String, generation: Int,
                              lease: FreedAdultProtectionLegacyGate.WriterLease,
                              operation: @escaping @MainActor () async -> [String: Any]) throws -> Task<[String: Any], Never> {
    try FreedAdultProtectionLegacyGate.requireCurrent(lease)
    if let existing = queuedOperation, existing.kind == identity, existing.generation == generation { return existing.task }
    guard queuedOperationCount < Self.maximumQueuedOperations else { throw FreedAdultLockIntegrationFailure.operationInProgress }
    let previous = queuedOperation?.task
    let id = UUID()
    queuedOperationCount += 1
    let task = Task { @MainActor in
      if let previous { _ = await previous.value }
      let result: [String: Any]
      do {
        try FreedAdultProtectionLegacyGate.requireCurrent(lease)
        if kind != "configure-enabled", !self.dnsRemovalGenerationIsCurrent(generation) {
          result = ["operationAccepted": false, "removed": false, "error": "ios-reset-dns-configuration-invalidated"]
        } else { result = await operation() }
      } catch { result = ["operationAccepted": false, "removed": false, "error": "ios-dns-operation-admission-failed"] }
      self.queuedOperationCount -= 1
      if self.queuedOperation?.id == id { self.queuedOperation = nil }
      return result
    }
    queuedOperation = (id, identity, generation, task)
    return task
  }

  // Fresh, read-only observation serialized with all real preference writes.
  // The caller owns the adult lane before entering this queue; no markers are
  // changed and release flags do not substitute for actual absent preferences.
  func observeSettled(lease: FreedAdultProtectionLegacyGate.WriterLease) async throws -> FreedLoadedDnsObservation {
    let generation = try FreedProtectionConfigurationLock.withExclusiveAccess { FreedProtectionConfigurationLock.generation($0) }
    let task = try enqueueSettled(kind: "observe", identity: "observe:" + UUID().uuidString, generation: generation, lease: lease) {
      guard !self.changingConfiguration else { return [:] }
      self.changingConfiguration = true; defer { self.changingConfiguration = false }
      let manager = NEDNSSettingsManager.shared()
      guard await self.resetPreferenceOperation({ manager.loadFromPreferences(completionHandler: $0) }) == nil else { return [:] }
      do { return ["loaded": try self.loadedObservation(manager)] }
      catch { return ["failure": error] }
    }
    guard let value = await task.value["loaded"] as? FreedLoadedDnsObservation else { throw FreedAdultLockIntegrationFailure.invalidReadback }
    return value
  }

  func removeSettled(permit: FreedAdultLayerPermit, lease: FreedAdultProtectionLegacyGate.WriterLease) async throws -> FreedLoadedDnsObservation {
    guard lease === permit.lease, permit.step.layer == .dns, !permit.step.compensation else { throw FreedAdultLockIntegrationFailure.authorizationRequired }
    let task = try enqueueSettled(kind: "enrolled-remove", identity: permit.identity,
      generation: permit.step.nativeScope.generation, lease: lease) {
      guard !self.changingConfiguration else { return [:] }
      self.changingConfiguration = true
      defer { self.changingConfiguration = false }
      do {
        let manager = NEDNSSettingsManager.shared()
        try await self.settledPreferenceOperation { manager.loadFromPreferences(completionHandler: $0) }
        let before = try self.loadedObservation(manager)
        let beforeBytes = try freedAdultDNSData(before)
        try FreedProtectionConfigurationLock.withExclusiveAccess { defaults in
          try permit.beginDispatch(defaults, layer: .dns, observed: beforeBytes)
        }
        self.enrolledPrevious[permit.step.operationID] = (manager.dnsSettings, manager.onDemandRules, manager.localizedDescription)
        // A standalone DNS Off must install/read back the OS adult filter
        // BEFORE taking away the hosted layer. Compound authorized adult Off
        // intentionally removes adult protection and retains its own exact permit.
        if permit.before.hostedRecoveryDns != nil, permit.desired.continuous {
          try FreedProtectionConfigurationLock.withExclusiveAccess { defaults in
            try permit.validate(defaults, layer: .dns, observed: beforeBytes)
            try FreedRecoveryDnsNativeFilter.installAuto()
          }
        }
        if before.hasSettings {
          try await self.settledPreferenceOperation(generation: permit.step.nativeScope.generation, mutating: true, permit: permit) { manager.removeFromPreferences(completionHandler: $0) }
        }
        try await self.settledPreferenceOperation { manager.loadFromPreferences(completionHandler: $0) }
        let after = try self.loadedObservation(manager)
        guard !after.hasSettings, !after.enabled else { throw FreedAdultLockIntegrationFailure.invalidReadback }
        try FreedProtectionConfigurationLock.withExclusiveAccess { defaults in
          try permit.publish(defaults, layer: .dns, observed: beforeBytes)
          defaults.set(false, forKey: self.savedKey)
        }
        return ["loaded": after]
      } catch { return ["failure": error] }
    }
    let result = await task.value
    if let error = result["failure"] as? Error { throw error }
    guard let value = result["loaded"] as? FreedLoadedDnsObservation else { throw FreedAdultLockIntegrationFailure.invalidReadback }
    return value
  }

  func discardEnrolledHistory(_ id: String) { enrolledPrevious.removeValue(forKey: id) }
  func replaceSettled(permit: FreedAdultLayerPermit, lease: FreedAdultProtectionLegacyGate.WriterLease) async throws -> FreedLoadedDnsObservation {
    guard #available(iOS 16.0, *), lease === permit.lease, permit.request == .dnsReplace,
      permit.step.layer == .dns, !permit.step.compensation, let candidate = permit.dnsCandidate else {
      throw FreedAdultLockIntegrationFailure.authorizationRequired
    }
    let task = try enqueueSettled(kind: "enrolled-replace", identity: permit.identity,
      generation: permit.step.nativeScope.generation, lease: lease) {
      guard !self.changingConfiguration else { return [:] }
      self.changingConfiguration = true; defer { self.changingConfiguration = false }
      do {
        let credential = try FreedRecoveryDnsPilot.credential(candidate)
        let manager = NEDNSSettingsManager.shared()
        try await self.settledPreferenceOperation { manager.loadFromPreferences(completionHandler: $0) }
        let before = try self.loadedObservation(manager)
        let beforeBytes = try freedAdultDNSData(before)
        try FreedProtectionConfigurationLock.withExclusiveAccess { defaults in
          try permit.beginDispatch(defaults, layer: .dns, observed: beforeBytes)
        }
        self.enrolledPrevious[permit.step.operationID] = (manager.dnsSettings, manager.onDemandRules, manager.localizedDescription)
        if permit.before.hostedRecoveryDns != nil {
          // Even an exact same-profile save can change OS enablement. Restore
          // and observe the stronger layer before the daemon write; only a
          // fresh mode-activation permit may remove it again afterward.
          try FreedProtectionConfigurationLock.withExclusiveAccess { defaults in
            try permit.validate(defaults, layer: .dns, observed: beforeBytes)
            try FreedRecoveryDnsNativeFilter.installAuto()
          }
        }
        let settings = NEDNSOverHTTPSSettings(servers: candidate.bootstrapServers)
        settings.serverURL = credential.serverURL
        settings.matchDomains = [""]; settings.matchDomainsNoSearch = true
        if #available(iOS 26.0, *) { settings.allowFailover = false }
        manager.dnsSettings = settings; manager.onDemandRules = nil
        manager.localizedDescription = "FREED · Recovery DNS internal pilot"
        // Existing profile is replaced in one OS save, never removed first.
        try await self.settledPreferenceOperation(generation: candidate.nativeScope.generation,
          mutating: true, permit: permit, observedBeforeMutation: beforeBytes) { manager.saveToPreferences(completionHandler: $0) }
        try await self.settledPreferenceOperation { manager.loadFromPreferences(completionHandler: $0) }
        let after = try self.loadedObservation(manager)
        guard after.recognized, after.hasSettings, after.pilot == candidate.identity else { throw FreedAdultLockIntegrationFailure.invalidReadback }
        try FreedProtectionConfigurationLock.withExclusiveAccess { defaults in
          try permit.publish(defaults, layer: .dns, observed: beforeBytes)
          defaults.set(true, forKey: self.savedKey)
        }
        // hasSettings and enabled remain distinct OS observations.
        return ["loaded": after]
      } catch { return ["failure": error] }
    }
    let result = await task.value
    if let error = result["failure"] as? Error { throw error }
    guard let value = result["loaded"] as? FreedLoadedDnsObservation else { throw FreedAdultLockIntegrationFailure.invalidReadback }
    return value
  }
  func restoreSettled(permit: FreedAdultLayerPermit) async throws {
    guard permit.step.compensation, permit.step.layer == .dns,
      let previous = enrolledPrevious[permit.step.operationID] else { throw FreedAdultLockIntegrationFailure.interruptedOperation }
    let task = try enqueueSettled(kind: "enrolled-restore", identity: permit.identity,
      generation: permit.step.nativeScope.generation, lease: permit.lease) {
      guard !self.changingConfiguration else { return [:] }
      self.changingConfiguration = true; defer { self.changingConfiguration = false }
      do {
        let manager = NEDNSSettingsManager.shared()
        try await self.settledPreferenceOperation { manager.loadFromPreferences(completionHandler: $0) }
        let beforeBytes = try freedAdultDNSData(self.loadedObservation(manager))
        try FreedProtectionConfigurationLock.withExclusiveAccess { defaults in
          try permit.beginDispatch(defaults, layer: .dns, observed: beforeBytes)
        }
        // The permit's observed baseline is checked before replacing the in-memory
        // manager; registration validates that original baseline explicitly below.
        manager.dnsSettings = previous.0; manager.onDemandRules = previous.1; manager.localizedDescription = previous.2
        if previous.0 != nil {
          try await self.settledPreferenceOperation(generation: permit.step.nativeScope.generation,
            mutating: true, permit: permit, observedBeforeMutation: beforeBytes) { manager.saveToPreferences(completionHandler: $0) }
        }
        try await self.settledPreferenceOperation { manager.loadFromPreferences(completionHandler: $0) }
        let after = try self.loadedObservation(manager)
        guard after.recognized, after.hasSettings == (previous.0 != nil) else { throw FreedAdultLockIntegrationFailure.invalidReadback }
        try FreedProtectionConfigurationLock.withExclusiveAccess { defaults in
          try permit.publish(defaults, layer: .dns, observed: beforeBytes)
          defaults.set(permit.desired.encryptedDNS, forKey: self.savedKey)
        }
        // A saved profile is not proof that iOS selected it. The whole operation
        // retains accepted=false and actual enabled state in its repair result.
        return ["restored": true]
      } catch { return ["failure": error] }
    }
    let result = await task.value
    if let error = result["failure"] as? Error { throw error }
    guard result["restored"] as? Bool == true else { throw FreedAdultLockIntegrationFailure.invalidReadback }
  }

  private func loadedObservation(_ manager: NEDNSSettingsManager) throws -> FreedLoadedDnsObservation {
    let settings = manager.dnsSettings
    let https = settings as? NEDNSOverHTTPSSettings
    var failoverSupported = false
    var failoverMatches: Bool?
    var pilot: FreedRecoveryDnsProfileIdentity?
    if #available(iOS 16.0, *) { pilot = try FreedRecoveryDnsPilot.matchingCredential(settings)?.candidate.identity }
    if #available(iOS 26.0, *) { failoverSupported = true; failoverMatches = settings.map { !$0.allowFailover } }
    return FreedLoadedDnsObservation(hasSettings: settings != nil, enabled: manager.isEnabled,
      protocolMatches: https != nil, serverURLMatches: pilot != nil || https?.serverURL == url,
      serversMatch: pilot != nil || (settings.map { Set($0.servers) == Set(servers) && $0.servers.count == servers.count } ?? false),
      matchDomainsMatch: settings?.matchDomains == [""], noSearchMatch: settings?.matchDomainsNoSearch == true,
      onDemandRulesMatch: manager.onDemandRules?.isEmpty ?? true,
      failoverSupported: failoverSupported, failoverMatches: failoverMatches, pilot: pilot)
  }

  private func pendingResult(reason: String = "ios-dns-operation-settling") -> [String: Any] {
    var result = payload(configured: saved, error: reason)
    result["operationPending"] = true
    result["removed"] = false
    result["error"] = reason
    return result
  }

  // Only the caller's wait expires. The unstructured operation task retains
  // ownership, publishes its observed result, then admits the queued operation.
  // Caller cancellation likewise does not cancel a daemon request.
  private func waitForCaller(_ task: Task<[String: Any], Never>) async -> [String: Any] {
    let pending = pendingResult()
    guard activeCallerObservers < Self.maximumCallerObservers else { return pending }
    activeCallerObservers += 1
    return await withCheckedContinuation { continuation in
      let lock = NSLock()
      var finished = false
      let complete: ([String: Any]) -> Void = { result in
        lock.lock()
        let shouldResume = !finished
        finished = true
        lock.unlock()
        if shouldResume { continuation.resume(returning: result) }
      }
      DispatchQueue.global().asyncAfter(deadline: .now() + 8) { complete(pending) }
      Task { let result = await task.value; self.activeCallerObservers -= 1; complete(result) }
    }
  }
  private func requireLegacyUnenrolled() throws {
    guard let authority = activeAuthority else { throw FreedAdultLockIntegrationFailure.operationInProgress }
    try authority.requireUnenrolled()
  }
  private func nativeEpochIsCurrent(_ defaults: UserDefaults) -> Bool {
    guard let activeNativeEpoch else { return true } // read-only manager observation
    return (try? FreedProtectionConfigurationLock.adultMutationEpoch(defaults)) == activeNativeEpoch
  }
  private var saved: Bool { FreedProtectionConfigurationLock.sharedDefaults().bool(forKey: savedKey) }
  private func setSaved(_ value: Bool?, generation: Int? = nil, updateRetainedIntent: Bool = false) throws {
    try FreedProtectionConfigurationLock.withExclusiveAccess { defaults in
      guard nativeEpochIsCurrent(defaults) else { throw FreedProtectionConfigurationLock.AccessError.unavailable }
      // Check before touching retained intent, including false/nil publication.
      // A stale daemon completion is observation, not a new owner's intent.
      if let generation, FreedProtectionConfigurationLock.generation(defaults) != generation {
        throw FreedProtectionConfigurationLock.AccessError.unavailable
      }
      if updateRetainedIntent {
        if value != true { try requireLegacyUnenrolled() }
        let initial = value == true ? try FreedRetainedAdultProtection.initialBaselineForStrengthening(defaults) {
          try FreedAdultProtectionNativeObservation.capture(defaults)
        } : nil
        try FreedRetainedAdultProtection.update(defaults, observedInitialBaseline: initial) { $0.encryptedDNS = value == true }
      }
      if value == true, let generation, !FreedProtectionConfigurationLock.permitsPublication(defaults, capturedGeneration: generation) { throw FreedProtectionConfigurationLock.AccessError.unavailable }
      if let value { defaults.set(value, forKey: savedKey) } else { defaults.removeObject(forKey: savedKey) }
    }
  }
  private var releaseEnabled: Bool {
    Bundle.main.object(forInfoDictionaryKey: "FreedEncryptedDnsReleaseEnabled") as? Bool == true
  }
  private var supported: Bool {
    #if targetEnvironment(simulator)
    return false
    #else
    #if DEBUG
    return releaseEnabled || Bundle.main.object(forInfoDictionaryKey: "FreedEncryptedDnsDevPreview") as? Bool == true
    #else
    return releaseEnabled
    #endif
    #endif
  }
  private var unavailableReason: String {
    #if targetEnvironment(simulator)
    return "ios-dns-simulator-unavailable"
    #else
    return "encrypted-dns-release-gated"
    #endif
  }

  func status() async -> [String: Any] {
    let operationId = UUID().uuidString
    let retainsHosted = (try? FreedProtectionConfigurationLock.withExclusiveAccess(readOnly: true) { try FreedRetainedAdultProtection.read($0).hostedRecoveryDns != nil }) == true
    guard supported || FreedRecoveryDnsPilotGate.allowed || retainsHosted else { return payload(configured: saved, error: unavailableReason) }
    let lease: FreedAdultProtectionLegacyGate.WriterLease
    do { lease = try FreedAdultProtectionLegacyGate.acquireWriter() }
    catch { return pendingResult() }
    defer { FreedAdultProtectionLegacyGate.releaseWriter(lease) }
    guard queuedOperation == nil else { return pendingResult() }
    guard !changingConfiguration else { return payload(configured: saved, error: "ios-dns-configuration-in-progress") }
    changingConfiguration = true
    defer { changingConfiguration = false }
    // loadFromPreferences is essential after returning from Settings. An app
    // preference or a successful save does not establish system enablement.
    do {
      let manager = NEDNSSettingsManager.shared()
      try await settledPreferenceOperation { manager.loadFromPreferences(completionHandler: $0) }
      let observation = try loadedObservation(manager)
      try FreedRecoveryDnsNativeFilter.reconcileReadback(observation)
      return snapshot(manager, operationId: operationId)
    } catch {
      try? FreedRecoveryDnsNativeFilter.reconcileUnavailableSettings()
      return payload(configured: false, error: "ios-dns-preferences-load-failed", nativeError: error, operationId: operationId, stage: "dns-load")
    }
  }

  func configure(enabled: Bool) async -> [String: Any] {
    await enqueue(kind: enabled ? "configure-enabled" : "configure-disabled") {
      await self.performConfiguration(enabled: enabled)
    }
  }

  private func performConfiguration(enabled: Bool) async -> [String: Any] {
    let operationId = UUID().uuidString
    if !enabled {
      do { try requireLegacyUnenrolled() }
      catch { return configurationResult(enabled: enabled, operationId: operationId, result: payload(configured: saved, error: "adult-lock-authorization-required")) }
    }
    guard !changingConfiguration else { return configurationResult(enabled: enabled, operationId: operationId, result: payload(configured: saved, error: "ios-dns-configuration-in-progress")) }
    if enabled && !supported { return payload(configured: saved, error: unavailableReason) }
    if !enabled && !supported && !saved { return configurationResult(enabled: enabled, operationId: operationId, result: payload(configured: false, error: unavailableReason)) }
    let configurationGeneration: Int?
    if enabled {
      do {
      configurationGeneration = try FreedProtectionConfigurationLock.withExclusiveAccess { defaults in
        guard FreedProtectionConfigurationLock.permitsPublication(defaults) else {
          throw FreedProtectionConfigurationLock.AccessError.unavailable
        }
        return FreedProtectionConfigurationLock.generation(defaults)
      }
      } catch {
        var result = payload(configured: saved, error: "ios-dns-configuration-lock-unavailable")
        if let access = error as? FreedProtectionConfigurationLock.AccessError {
          result["operationLockStage"] = access.stage
          if let code = access.posixCode {
            result["operationErrorDomain"] = NSPOSIXErrorDomain
            result["operationErrorCode"] = code
          }
        }
        return configurationResult(enabled: enabled, operationId: operationId, result: result)
      }
      guard configurationGeneration != nil else {
        return configurationResult(enabled: enabled, operationId: operationId, result: payload(configured: saved, error: "ios-reset-dns-configuration-invalidated"))
      }
    } else {
      do { configurationGeneration = try FreedProtectionConfigurationLock.withExclusiveAccess { FreedProtectionConfigurationLock.generation($0) } }
      catch { return configurationResult(enabled: enabled, operationId: operationId, result: payload(configured: saved, error: "ios-dns-configuration-lock-unavailable")) }
    }
    changingConfiguration = true
    defer { changingConfiguration = false }
    let manager = NEDNSSettingsManager.shared()
    do {
      try await settledPreferenceOperation { manager.loadFromPreferences(completionHandler: $0) }
    } catch {
      return configurationResult(enabled: enabled, operationId: operationId, result: payload(configured: saved, error: "ios-dns-preferences-load-failed", nativeError: error))
    }
    let previousSettings = manager.dnsSettings
    let previousDescription = manager.localizedDescription
    let previousRules = manager.onDemandRules
    var replacingPilot = false
    do {
      if enabled {
        guard dnsConfigurationGenerationIsCurrent(configurationGeneration) else {
          return configurationResult(enabled: enabled, operationId: operationId, result: payload(configured: saved, error: "ios-reset-dns-configuration-invalidated"))
        }
        let observed = try loadedObservation(manager)
        if observed.hasSettings, observed.pilot != nil {
          // Explicit known-Families rollback is stronger only after .auto has
          // actually been installed. A generic enabled=true is not permission
          // to replace an unknown/provider profile.
          try FreedProtectionConfigurationLock.withExclusiveAccess { defaults in
            guard try FreedRetainedAdultProtection.read(defaults).continuous else { throw FreedAdultLockIntegrationFailure.authorizationRequired }
            try FreedRecoveryDnsNativeFilter.installAuto()
          }
          replacingPilot = true
        } else if observed.hasSettings, !observed.recognized {
          throw FreedAdultLockIntegrationFailure.authorizationRequired
        }
        let settings = NEDNSOverHTTPSSettings(servers: servers)
        settings.serverURL = url
        settings.matchDomains = [""]
        settings.matchDomainsNoSearch = true
        if #available(iOS 26.0, *) { settings.allowFailover = false }
        manager.dnsSettings = settings
        let presentation = UserDefaults(suiteName: FreedProtectionConfigurationLock.appGroupIdentifier)?.dictionary(forKey: "freed.presentation.v1") as? [String: String]
        manager.localizedDescription = FreedEncryptedDnsPolicy.configurationLabel(selected: presentation?["language"], preferred: Locale.preferredLanguages.first ?? "en")
        manager.onDemandRules = nil
        // isEnabled is read-only. iOS requires the person to select this DNS
        // configuration in Settings; never infer it from a successful save.
        try await settledPreferenceOperation(generation: configurationGeneration, requiresActive: true, mutating: true) { manager.saveToPreferences(completionHandler: $0) }
        if !dnsConfigurationGenerationIsCurrent(configurationGeneration) {
          // Dated retention correction: a newer account/repair generation does
          // not authorize this old save callback to remove device adult DNS.
          // Keep the stronger OS layer and report the stale operation.
          try await settledPreferenceOperation { manager.loadFromPreferences(completionHandler: $0) }
          return configurationResult(enabled: enabled, operationId: operationId, result: payload(configured: manager.dnsSettings != nil, error: "ios-reset-dns-configuration-invalidated"))
        }
        if !replacingPilot { try setSaved(true, generation: configurationGeneration, updateRetainedIntent: true) }
      } else {
        // The manager addresses this app's own configuration only.
        guard try loadedObservation(manager).pilot == nil else { throw FreedAdultLockIntegrationFailure.authorizationRequired }
        try requireLegacyUnenrolled()
        guard dnsRemovalGenerationIsCurrent(configurationGeneration) else {
          return configurationResult(enabled: enabled, operationId: operationId, result: payload(configured: saved, error: "ios-reset-dns-configuration-invalidated"))
        }
        if manager.dnsSettings != nil { try await settledPreferenceOperation(generation: configurationGeneration, mutating: true) { manager.removeFromPreferences(completionHandler: $0) } }
        try setSaved(false, generation: configurationGeneration, updateRetainedIntent: true)
      }
    } catch {
      if error is FreedProtectionConfigurationLock.AccessError,
        dnsConfigurationGenerationIsCurrent(configurationGeneration),
        (try? FreedAdultProtectionLegacyGate.requireUnenrolled()) != nil {
        // State publication failed after the OS save: restore the app-owned
        // previous configuration, unless reset has revoked this generation.
        do {
          manager.dnsSettings = previousSettings; manager.localizedDescription = previousDescription; manager.onDemandRules = previousRules
          if previousSettings != nil { try await settledPreferenceOperation(generation: configurationGeneration, requiresActive: true, mutating: true) { manager.saveToPreferences(completionHandler: $0) } } else { try await settledPreferenceOperation(generation: configurationGeneration, mutating: true) { manager.removeFromPreferences(completionHandler: $0) } }
          try await settledPreferenceOperation { manager.loadFromPreferences(completionHandler: $0) }
        } catch {
          return configurationResult(enabled: enabled, operationId: operationId, result: payload(configured: manager.dnsSettings != nil, error: "ios-dns-rollback-not-confirmed", nativeError: error))
        }
      }
      return configurationResult(enabled: enabled, operationId: operationId, result: payload(configured: saved, error: error is FreedProtectionConfigurationLock.AccessError ? "ios-dns-state-persistence-failed" : enabled ? "ios-dns-preferences-save-failed" : "ios-dns-preferences-remove-failed", nativeError: error))
    }
    do {
      try await settledPreferenceOperation { manager.loadFromPreferences(completionHandler: $0) }
      // Read-only snapshot construction must not remove the mutation's final
      // epoch/generation check. A late readback cannot acknowledge a revoked job.
      guard enabled ? dnsConfigurationGenerationIsCurrent(configurationGeneration) : dnsRemovalGenerationIsCurrent(configurationGeneration) else {
        return configurationResult(enabled: enabled, operationId: operationId, result: payload(configured: saved, error: "ios-reset-dns-configuration-invalidated"))
      }
      if replacingPilot {
        let actual = try loadedObservation(manager)
        guard actual.recognized, actual.hasSettings, actual.pilot == nil else { throw FreedAdultLockIntegrationFailure.invalidReadback }
        try FreedProtectionConfigurationLock.withExclusiveAccess { defaults in
          guard self.nativeEpochIsCurrent(defaults), FreedProtectionConfigurationLock.generation(defaults) == configurationGeneration else { throw FreedAdultLockIntegrationFailure.staleConfiguration }
          try FreedRecoveryDnsNativeFilter.installAuto()
          try FreedRetainedAdultProtection.update(defaults) { $0.hostedRecoveryDns = nil; $0.encryptedDNS = true }
          defaults.set(true, forKey: self.savedKey)
        }
      }
      return configurationResult(enabled: enabled, operationId: operationId, result: snapshot(manager, operationId: operationId, generation: configurationGeneration, stage: enabled ? "dns-save-readback" : "dns-remove-readback"), generation: configurationGeneration)
    } catch {
      return configurationResult(enabled: enabled, operationId: operationId, result: payload(configured: saved, error: "ios-dns-preferences-load-failed", nativeError: error))
    }
  }


  private func configurationResult(enabled: Bool, operationId: String = UUID().uuidString, result: [String: Any], generation: Int? = nil) -> [String: Any] {
    var receipt = result
    if var readback = receipt["configurationReadback"] as? [String: Any] { readback["operationId"] = operationId; if let generation { readback["configurationGeneration"] = generation }; receipt["configurationReadback"] = readback }
    let reason = result["reason"] as? String
    let saveReasons = ["ios-dns-settings-enable-required", "ios-dns-health-unverified", "encrypted-dns-device-unverified"]
    let accepted = result["configured"] as? Bool == enabled
      && (reason == nil || enabled && reason.map { saveReasons.contains($0) } == true)
    #if canImport(UIKit)
    receipt["operationProtectedDataAvailable"] = UIApplication.shared.isProtectedDataAvailable
    #endif
    receipt["operationAppGroupContainerAvailable"] = FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: FreedProtectionConfigurationLock.appGroupIdentifier) != nil
    receipt["operationConfigurationGeneration"] = generation.map { $0 as Any } ?? NSNull()
    receipt["operationAccepted"] = accepted
    receipt["operationReason"] = accepted ? NSNull() : (reason.map { $0 as Any } ?? "ios-dns-operation-not-confirmed")
    if receipt["operationDiagnostics"] == nil {
      receipt["operationDiagnostics"] = ["stage": accepted ? "dns-readback" : "dns-operation", "reason": receipt["operationReason"]!,
        "configurationGeneration": generation.map { $0 as Any } ?? NSNull(), "errorCode": receipt["operationErrorCode"] ?? NSNull(), "errorDomain": receipt["operationErrorDomain"] ?? NSNull()]
    }
    return receipt
  }

  private func dnsConfigurationGenerationIsCurrent(_ capturedGeneration: Int?) -> Bool {
    (try? FreedProtectionConfigurationLock.withExclusiveAccess { defaults in
      self.nativeEpochIsCurrent(defaults) && FreedProtectionConfigurationLock.permitsPublication(defaults, capturedGeneration: capturedGeneration)
    }) == true
  }

  // A mixed reset intentionally has its reset marker set. Its removal may
  // continue only in that captured generation, unlike stronger publication.
  private func dnsRemovalGenerationIsCurrent(_ capturedGeneration: Int?) -> Bool {
    guard let capturedGeneration else { return false }
    return (try? FreedProtectionConfigurationLock.withExclusiveAccess {
      self.nativeEpochIsCurrent($0) && FreedProtectionConfigurationLock.generation($0) == capturedGeneration
    }) == true
  }

  // Cleanup bypasses release gating: a previously saved FREED configuration
  // still has to be removed after an entitlement or release-flag change.
  func resetConfiguration() async -> [String: Any] {
    await enqueue(kind: "reset") { await self.performResetConfiguration() }
  }

  func resetConfigurationSettled(authority: FreedAdultProtectionLegacyGate.LegacyAuthority, generation: Int, epoch: Int) async -> [String: Any] {
    await performAdmittedLegacy(kind: "reset", generation: generation, epoch: epoch, authority: authority) {
      await self.performResetConfiguration()
    }
  }

  private func performResetConfiguration() async -> [String: Any] {
    do { try requireLegacyUnenrolled() }
    catch { return ["removed": false, "error": "adult-lock-authorization-required"] }
    guard !changingConfiguration else {
      return ["removed": false, "error": "ios-reset-dns-configuration-in-progress"]
    }
    let resetGeneration: Int
    do { resetGeneration = try FreedProtectionConfigurationLock.withExclusiveAccess { FreedProtectionConfigurationLock.generation($0) } }
    catch { return ["removed": false, "error": "ios-dns-configuration-lock-unavailable"] }
    changingConfiguration = true
    defer { changingConfiguration = false }
    let manager = NEDNSSettingsManager.shared()
    guard await resetPreferenceOperation({ manager.loadFromPreferences(completionHandler: $0) }) == nil else {
      return ["removed": false, "error": "ios-reset-dns-preferences-load-failed"]
    }
    guard dnsRemovalGenerationIsCurrent(resetGeneration) else {
      return ["removed": false, "error": "ios-reset-dns-configuration-invalidated"]
    }
    do {
      guard try loadedObservation(manager).pilot == nil else { return ["removed": false, "error": "recovery-dns-exact-removal-operation-required"] }
    } catch { return ["removed": false, "error": "recovery-dns-protected-storage-unavailable"] }
    if manager.dnsSettings != nil || manager.isEnabled {
      // This singleton addresses the calling app's preferences, never another
      // app's DNS configuration or a user's independently installed profile.
      do { try requireLegacyUnenrolled() }
      catch { return ["removed": false, "error": "adult-lock-authorization-required"] }
      guard await resetPreferenceOperation(generation: resetGeneration, mutating: true, { manager.removeFromPreferences(completionHandler: $0) }) == nil else {
        return ["removed": false, "error": "ios-reset-dns-preferences-remove-failed"]
      }
    }
    guard await resetPreferenceOperation({ manager.loadFromPreferences(completionHandler: $0) }) == nil else {
      return ["removed": false, "error": "ios-reset-dns-readback-failed"]
    }
    guard manager.dnsSettings == nil && !manager.isEnabled else {
      return ["removed": false, "error": "ios-reset-dns-remove-not-confirmed",
        "configured": manager.dnsSettings != nil, "enabled": manager.isEnabled]
    }
    guard dnsRemovalGenerationIsCurrent(resetGeneration) else {
      return ["removed": false, "error": "ios-reset-dns-configuration-invalidated"]
    }
    do { try setSaved(nil, generation: resetGeneration, updateRetainedIntent: true) }
    catch { return ["removed": false, "error": "ios-reset-dns-marker-remove-not-confirmed", "diagnostics": FreedProtectionConfigurationLock.diagnostics(error)] }
    return ["removed": true, "configured": false, "enabled": false]
  }

  // Await actual callback settlement, not a clock deadline. A duplicate callback
  // is ignored. A callback that never arrives deliberately retains the lane;
  // waitForCaller bounds the UI wait without admitting a racing preference write.
  private func resetPreferenceOperation(generation: Int? = nil, mutating: Bool = false,
                                        _ run: (@escaping (Error?) -> Void) -> Void) async -> String? {
    do { try await settledPreferenceOperation(generation: generation, mutating: mutating, run); return nil }
    catch { return "preferences-operation-failed" }
  }

  // Dispatch registration and epoch validation are one synchronous transaction;
  // callback settlement is awaited only after it releases exclusion. A boundary
  // error after registration is an uncertain OS effect: keep both owners until
  // the real callback arrives, then report failure. Inline/duplicate callbacks
  // cannot resume a continuation before registration's result is known.
  private func settledPreferenceOperation(generation: Int? = nil, requiresActive: Bool = false,
                                          mutating: Bool = false, permit: FreedAdultLayerPermit? = nil, observedBeforeMutation: Data? = nil,
                                          _ run: (@escaping (Error?) -> Void) -> Void) async throws {
    try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<Void, Error>) in
      let lock = NSLock()
      var registered = false, registrationFinished = false, callbackReceived = false, resumed = false
      var registrationError: Error?, callbackError: Error?
      func resolveIfSettled() {
        lock.lock()
        guard !resumed, registrationFinished, !registered || callbackReceived else { lock.unlock(); return }
        resumed = true
        let error = registrationError ?? callbackError
        lock.unlock()
        if let error { continuation.resume(throwing: error) } else { continuation.resume() }
      }
      let complete: (Error?) -> Void = { error in
        lock.lock()
        guard !callbackReceived else { lock.unlock(); return }
        callbackReceived = true; callbackError = error; lock.unlock()
        resolveIfSettled()
      }
      func register() {
        lock.lock(); registered = true; lock.unlock()
        run(complete)
      }
      do {
        if mutating {
          try FreedProtectionConfigurationLock.withExclusiveAccess { defaults in
            guard let generation, FreedProtectionConfigurationLock.generation(defaults) == generation,
              self.nativeEpochIsCurrent(defaults),
              !requiresActive || FreedProtectionConfigurationLock.permitsPublication(defaults, capturedGeneration: generation) else {
              throw FreedProtectionConfigurationLock.AccessError.unavailable
            }
            guard permit != nil || self.activeNativeEpoch != nil else { throw FreedAdultLockIntegrationFailure.authorizationRequired }
            if let permit {
              try permit.validate(defaults, layer: .dns, observed: observedBeforeMutation ?? freedAdultDNSData(self.loadedObservation(NEDNSSettingsManager.shared())))
            }
            register()
          }
        } else { register() }
      } catch { registrationError = error }
      lock.lock(); registrationFinished = true; lock.unlock()
      resolveIfSettled()
    }
  }

  private func snapshot(_ manager: NEDNSSettingsManager, operationId: String = UUID().uuidString, generation: Int? = nil, stage: String = "dns-status-readback") -> [String: Any] {
    if let observed = try? loadedObservation(manager), let pilot = observed.pilot, observed.recognized {
      let hosted = (try? FreedProtectionConfigurationLock.withReadOnlyAccess {
        try FreedRetainedAdultProtection.read($0).hostedRecoveryDns == pilot
      }) == true
      var modeActive = false
      if #available(iOS 26.0, *) {
        modeActive = hosted && observed.enabled && observed.failoverSupported && observed.failoverMatches == true
          && ManagedSettingsStore().webContent.blockedByFilter == nil
      }
      return ["supported": FreedRecoveryDnsPilotGate.allowed, "releaseEnabled": false, "configured": true,
        "enabled": observed.enabled, "healthy": NSNull(), "provider": "freed-recovery-pilot", "requiresSettings": !observed.enabled,
        "hostedModeRetained": hosted, "modeActive": modeActive,
        "reason": observed.enabled ? "recovery-dns-browser-evidence-required" : "ios-dns-settings-enable-required",
        "configurationReadback": ["version": 1, "operationId": operationId, "stage": stage,
          "freshPreferencesLoaded": true, "managerHasSettings": observed.hasSettings, "managerIsEnabled": observed.enabled,
          "configurationValid": true, "configurationGeneration": pilot.nativeConfigurationGeneration],
        "browserRecoveryVerified": false]
    }
    let settings = manager.dnsSettings as? NEDNSOverHTTPSSettings
    let hasSettings = manager.dnsSettings != nil, protocolMatches = settings != nil
    let urlMatches = settings?.serverURL == url
    let serversMatch = settings?.servers.sorted() == servers.sorted()
    let domainsMatch = settings?.matchDomains == [""]
    let noSearchMatch = settings?.matchDomainsNoSearch == true
    let rulesMatch = manager.onDemandRules == nil
    var failoverSupported = false, failoverMatch: Bool?
    if #available(iOS 26.0, *) { failoverSupported = true; failoverMatch = settings.map { !$0.allowFailover } }
    let configured = hasSettings && protocolMatches && urlMatches && serversMatch && domainsMatch && noSearchMatch && rulesMatch && (!failoverSupported || failoverMatch == true)
    let observedGeneration = generation ?? (try? FreedProtectionConfigurationLock.withExclusiveAccess { FreedProtectionConfigurationLock.generation($0) })
    // Snapshot construction is read-only. Only explicit mutation workflows may
    // acknowledge marker/retained intent; status can outlive an owner/epoch fence.
    var result = FreedEncryptedDnsPolicy.status(supported: supported, releaseEnabled: releaseEnabled,
      configured: configured, managerEnabled: manager.isEnabled,
      error: hasSettings && !configured ? "ios-dns-configuration-mismatch" : nil)
    result["configurationReadback"] = ["version": 1, "operationId": operationId, "stage": stage,
      "configurationGeneration": observedGeneration.map { $0 as Any } ?? NSNull(), "freshPreferencesLoaded": true,
      "managerHasSettings": hasSettings, "managerIsEnabled": manager.isEnabled, "protocolMatches": protocolMatches,
      "serverURLMatches": urlMatches, "serversMatch": serversMatch, "matchDomainsMatch": domainsMatch,
      "matchDomainsNoSearchMatch": noSearchMatch, "onDemandRulesMatch": rulesMatch,
      "allowFailoverSupported": failoverSupported, "allowFailoverMatch": failoverMatch.map { $0 as Any } ?? NSNull(), "configurationValid": configured]
    if configured, let label = manager.localizedDescription, !label.isEmpty { result["configurationLabel"] = label }
    return result
  }

  private func payload(configured: Bool, error: String, nativeError: Error? = nil, operationId: String = UUID().uuidString, stage: String = "dns-request") -> [String: Any] {
    var result = FreedEncryptedDnsPolicy.status(supported: supported, releaseEnabled: releaseEnabled,
      configured: configured, managerEnabled: false, error: error)
    result["operationAccepted"] = false
    result["operationReason"] = error
    var failoverSupported = false
    if #available(iOS 26.0, *) { failoverSupported = true }
    result["configurationReadback"] = ["version": 1, "operationId": operationId, "stage": stage,
      "configurationGeneration": NSNull(), "freshPreferencesLoaded": false, "managerHasSettings": NSNull(),
      "managerIsEnabled": NSNull(), "protocolMatches": NSNull(), "serverURLMatches": NSNull(), "serversMatch": NSNull(),
      "matchDomainsMatch": NSNull(), "matchDomainsNoSearchMatch": NSNull(), "onDemandRulesMatch": NSNull(),
      "allowFailoverSupported": failoverSupported, "allowFailoverMatch": NSNull(), "configurationValid": false]
    #if canImport(UIKit)
    result["operationProtectedDataAvailable"] = UIApplication.shared.isProtectedDataAvailable
    #endif
    result["operationAppGroupContainerAvailable"] = FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: FreedProtectionConfigurationLock.appGroupIdentifier) != nil
    if let nativeError {
      let identity = nativeError as NSError
      // Stable OS error identity only; localized descriptions can contain data.
      if let access = nativeError as? FreedProtectionConfigurationLock.AccessError {
        result["operationLockStage"] = access.stage
        result["operationErrorDomain"] = access.posixCode == nil ? "FreedProtection" : NSPOSIXErrorDomain
        result["operationErrorCode"] = access.posixCode.map { $0 as Any } ?? NSNull()
      } else {
        result["operationErrorDomain"] = identity.domain
        result["operationErrorCode"] = identity.code
      }
    }
    result["operationDiagnostics"] = ["stage": result["operationLockStage"] ?? (error.contains("load") ? "dns-load":error.contains("save") ? "dns-save":error.contains("remove") ? "dns-remove":"dns-request"),
      "reason": error, "errorCode": result["operationErrorCode"] ?? NSNull(), "errorDomain": result["operationErrorDomain"] ?? NSNull()]
    return result
  }
}

@available(iOS 15.1, *)
@MainActor
enum FreedAdultDNSProvider {
  static func observe(lease: FreedAdultProtectionLegacyGate.WriterLease) async throws -> FreedLoadedDnsObservation {
    try await FreedEncryptedDnsController.shared.observeSettled(lease: lease)
  }
  static func remove(permit: FreedAdultLayerPermit, lease: FreedAdultProtectionLegacyGate.WriterLease) async throws -> FreedLoadedDnsObservation {
    try await FreedEncryptedDnsController.shared.removeSettled(permit: permit, lease: lease)
  }
  static func replace(permit: FreedAdultLayerPermit, lease: FreedAdultProtectionLegacyGate.WriterLease) async throws -> FreedLoadedDnsObservation {
    try await FreedEncryptedDnsController.shared.replaceSettled(permit: permit, lease: lease)
  }
  static func compensate(permit: FreedAdultLayerPermit) async throws { try await FreedEncryptedDnsController.shared.restoreSettled(permit: permit) }
  static func discard(_ id: String) { FreedEncryptedDnsController.shared.discardEnrolledHistory(id) }

}
#endif

// MARK: - Protection configuration reset policy

// Only FREED-owned keys are cleared. The app group's identity and Screen Time
// authorization belong to the OS and are deliberately outside this operation.
struct FreedProtectionResetPolicy {
  static let resetMarkerKey = "freed.protectionConfiguration.reset"
  // A single documented ignore-previous-rules action has no preceding actions
  // in this FREED rule list and cannot override another extension's rules.
  static let inertSafariRulesJSON = #"[{"trigger":{"url-filter":".*"},"action":{"type":"ignore-previous-rules"}}]"#
  static let disabledKeys = ["freed.adultFilterActive", "freed.riskWindowActive",
    "freed.riskWindow.currentlyActive", "freed.appLimit.active"]
  static let zeroCountKeys = ["freed.selection.appCount", "freed.selection.categoryCount",
    "freed.selection.webDomainCount", "freed.safariContentBlocker.ruleCount"]
  static let removedKeys = ["freed.riskWindow.expected.v1", "freed.familyActivitySelection", "freed.appLimit.dailyMinutes",
    "freed.appLimit.reachedDate", "freed.appGuard.mode", "freed.appGuard.schedules.v1", "freed.pendingIntervention.record",
    "freed.pendingIntervention.consumedIds.v1", "freed.pendingIntervention.unlockScope",
    "freed.earnedUnlock.expiresAt", "freed.earnedUnlock.source", "freed.earnedUnlock.scope",
    "freed.earnedUnlock.interventionId", "freed.safariContentBlocker.version",
    "freed.safariContentBlocker.checksum", "freed.safariContentBlocker.generatedAt",
    "freed.safariContentBlocker.lastReloadError", "freed.safariContentBlocker.stateKnown",
    "freed.safariContentBlocker.enabled", "freed.safariContentBlocker.stateCheckedAt",
    "freed.safariContentBlocker.stateError"]

  static func persistEmptyConfiguration(in defaults: UserDefaults, domain: String) -> Bool {
    do {
      try FreedAdultProtectionLegacyGate.requireUnenrolled()
      if domain == FreedProtectionConfigurationLock.appGroupIdentifier {
        try FreedRetainedAdultProtection.update(defaults) { policy in
          // DNS intent is cleared only by its confirmed lower removal/readback.
          policy.continuous = false; policy.safari = false
          policy.riskEnabled = false; policy.riskStartMinute = nil; policy.riskEndMinute = nil
        }
      }
    } catch { return false }
    defaults.set(true, forKey: resetMarkerKey)
    for key in disabledKeys { defaults.set(false, forKey: key) }
    for key in zeroCountKeys { defaults.set(0, forKey: key) }
    for key in removedKeys { defaults.removeObject(forKey: key) }
    guard FreedProtectionConfigurationLock.persist(defaults) else { return false }
    // Read the explicit persistent domain, rather than inherited registration
    // defaults or the fallback getter that can conceal unavailable App Groups.
    return isEmptyConfiguration(defaults.persistentDomain(forName: domain))
  }

  static func isEmptyConfiguration(_ values: [String: Any]?) -> Bool {
    guard let values else { return false }
    return values[resetMarkerKey] as? Bool == true
      && disabledKeys.allSatisfy { values[$0] as? Bool == false }
      && zeroCountKeys.allSatisfy { values[$0] as? Int == 0 }
      && removedKeys.allSatisfy { values[$0] == nil }
  }

  static func receipt(errors: [String], safariContentBlockerEnabled: Bool?,
                      safariFocusShieldEnabled: Bool?) -> [String: Any] {
    var payload: [String: Any] = [
      "protectionConfigurationResetAccepted": errors.isEmpty,
      "protectionConfigurationResetRuntimeVersion": "ios-reset-v1",
      "safariContentBlockerEnabled": safariContentBlockerEnabled.map { $0 as Any } ?? NSNull(),
      "safariFocusShieldEnabled": safariFocusShieldEnabled.map { $0 as Any } ?? NSNull(),
      "safariFocusShieldStateKnown": safariFocusShieldEnabled != nil,
      "safariExistingTabsReloadRequired": safariFocusShieldEnabled != false,
      "protectionConfigurationResetRequiresSettings": errors.contains("ios-reset-safari-reload-failed")
    ]
    if let error = errors.first {
      payload["protectionConfigurationResetError"] = error
      payload["protectionConfigurationResetErrors"] = errors
      payload["protectionConfigurationResetRetryable"] = true
    }
    if safariFocusShieldEnabled != false {
      payload["safariResidualState"] = "ios-reset-safari-existing-tabs-reload-required"
    }
    return payload
  }
}

// MARK: - Existing protection layers

#if canImport(Vision)
import Vision
#endif

#if canImport(UIKit)
import UIKit
#endif

#if canImport(SwiftUI)
import SwiftUI
#endif

#if canImport(FamilyControls)
import FamilyControls
#endif

#if canImport(DeviceActivity)
import DeviceActivity
#endif

#if canImport(ManagedSettings)
import ManagedSettings
#endif

#if canImport(SafariServices)
import SafariServices
#endif

#if os(iOS) && canImport(UIKit)
@available(iOSApplicationExtension, unavailable)
enum FreedProtectionAppExecution {
  static func install() {
    if Thread.isMainThread { MainActor.assumeIsolated { installOnMain() } }
    else { DispatchQueue.main.sync { installOnMain() } }
  }
  @MainActor private static func installOnMain() {
    let application = UIApplication.shared
    FreedProtectionConfigurationLock.installAppExecutionProvider {
      let lease = FreedProtectionConfigurationLock.ExecutionLease()
      // These two UIApplication methods are thread-safe. Capture the app on
      // main during initialization; never synchronously hop to main under flock.
      let identifier = application.beginBackgroundTask(withName: "FREED protection transaction") { lease.expire() }
      guard identifier != .invalid else { throw FreedProtectionConfigurationLock.AccessError.executionUnavailable }
      lease.onFinish { application.endBackgroundTask(identifier) }
      return lease
    }
  }
}
#endif

public class FreedProtectionModule: Module {
  @available(iOS 15.1, *)
  @MainActor private func deviceAdultBridge(_ command: String, _ request: [String: Any]) async -> [String: Any] {
    do { return await (try FreedAdultProtectionRuntime.shared()).deviceAdultBridge(command, request) }
    catch { return FreedAdultProtectionRuntime.deviceAdultError(error) }
  }

  private let accountModuleLease = UUID()
  @MainActor private var accountCleanupTasks: Set<String> = []
  @MainActor private var cleanupObservers: [NSObjectProtocol] = []
  @MainActor private var earnedPhotoBindingID: String?
  @MainActor private var pendingFamilyPickerBindingID: String?
  private func legacyPrivateAvailable() -> Bool {
    (try? FreedProtectionConfigurationLock.withExclusiveAccess { FreedAccountProtectionCleanup.legacyPrivateAllowed($0) }) == true
  }

  private struct InterventionScope: Codable {
    let kind: String
    let tokenType: String?
    let token: String?
    let domain: String?
    var websiteProbeRevision: Int? = nil
    var websiteProbeOwner: String? = nil
    var groupId: String? = nil
    var groupRevision: Int? = nil
    var configurationGeneration: Int? = nil
    var scopeEpoch: Int? = nil
    var bootIdentity: String? = nil
    var issuedAt: Double? = nil
    var issuedUptime: Double? = nil
  }

  private struct PendingInterventionRecord: Codable {
    let id: String
    let host: String
    let sourcePackage: String
    let reason: String
    let matchedRule: String
    let detectedAt: String
    let scope: InterventionScope?
  }

  private struct PendingEarnedUnlockEnvelope: Codable {
    let interventionId: String
    let scope: InterventionScope
  }

  // A rollback receipt captured from native readback under the shared lock.
  // Persisted history alone can never construct this authority.
  private struct EarnedUnlockMonitoringSnapshot {
    let expiresAt: String
    let schedule: Any
  }

  #if canImport(ManagedSettings)
  private let store = ManagedSettingsStore()
  #endif
  private let adultFilterActiveKey = "freed.adultFilterActive"
  private let riskWindowActiveKey = "freed.riskWindowActive"
  private let riskWindowCurrentlyActiveKey = "freed.riskWindow.currentlyActive"
  private let riskWindowActivityName = "freed.nightGuard"
  private let appGuardModeKey = "freed.appGuard.mode"
  private let appLimitMonitoringActiveKey = "freed.appLimit.active"
  private let appLimitDailyMinutesKey = "freed.appLimit.dailyMinutes"
  private let appLimitActivityName = "freed.selectedAppDailyLimit"
  private let appLimitEventName = "freed.selectedAppDailyLimitReached"
  private let appLimitReachedDateKey = "freed.appLimit.reachedDate"
  private let appGroupIdentifier = "group.app.freed.recovery"
  private let photoPipeline = FreedChallengePhotoPipeline()
  @MainActor private lazy var challengeCamera = FreedChallengeNativeCamera()
  @MainActor private var earnedPhotoOperationId:String?
  @MainActor private var earnedPhotoOwnerScope:String?
  @MainActor private var earnedPhotoEvidenceSessionId:String?
  private let maxEarnedUnlockMinutes = 120
  private let familyActivitySelectionKey = "freed.familyActivitySelection"
  private let selectionAppCountKey = "freed.selection.appCount"
  private let selectionCategoryCountKey = "freed.selection.categoryCount"
  private let selectionWebDomainCountKey = "freed.selection.webDomainCount"
  private let pendingInterventionRecordKey = "freed.pendingIntervention.record"
  private let pendingInterventionConsumedIdsKey = "freed.pendingIntervention.consumedIds.v1"
  private let maxPendingInterventionConsumedIds = 32
  private let pendingEarnedUnlockScopeKey = "freed.pendingIntervention.unlockScope"
  private let pendingInterventionMaxAgeSeconds: TimeInterval = 10 * 60
  private let pendingInterventionFutureSkewSeconds: TimeInterval = 60
  private let screenTimeShieldHost = "screen-time-shield.freed.local"
  private let screenTimeShieldSource = "ios-screen-time"
  private let earnedUnlockExpiresAtKey = "freed.earnedUnlock.expiresAt"
  private let earnedUnlockSourceKey = "freed.earnedUnlock.source"
  private let earnedUnlockScopeKey = "freed.earnedUnlock.scope"
  private let earnedUnlockInterventionIdKey = "freed.earnedUnlock.interventionId"
  private let earnedUnlockActivityName = "freed.earnedUnlockWindow"
  private let safariContentBlockerIdentifier = "app.freed.recovery.safari-content-blocker"
  private let safariFocusShieldIdentifier = "app.freed.recovery.safari-focus-shield"
  private let safariContentBlockerRulesFileName = "safari-content-blocker-rules.json"
  private let safariContentBlockerResetRulesFileName = "safari-content-blocker-reset-rules.json"
  private let safariContentBlockerVersionKey = "freed.safariContentBlocker.version"
  private let safariContentBlockerChecksumKey = "freed.safariContentBlocker.checksum"
  private let safariContentBlockerGeneratedAtKey = "freed.safariContentBlocker.generatedAt"
  private let safariContentBlockerRuleCountKey = "freed.safariContentBlocker.ruleCount"
  private let safariContentBlockerLastReloadErrorKey = "freed.safariContentBlocker.lastReloadError"
  private let pendingInterventionClaimLock = NSLock()
  private let safariContentBlockerStateKnownKey = "freed.safariContentBlocker.stateKnown"
  private let safariContentBlockerEnabledKey = "freed.safariContentBlocker.enabled"
  private let safariContentBlockerStateCheckedAtKey = "freed.safariContentBlocker.stateCheckedAt"
  private let safariContentBlockerStateErrorKey = "freed.safariContentBlocker.stateError"
  private var resettingProtectionConfiguration = false
  private var lastNightGuardDiagnostics: [String: Any]?
  @MainActor private var pendingFamilyPickerReset: (() -> Void)?

  @MainActor private func cancelEarnedChallengeCapture(evidenceSessionId:String?=nil,scope:String?=nil) {
    guard evidenceSessionId==nil || evidenceSessionId==earnedPhotoEvidenceSessionId,scope==nil || scope==earnedPhotoOwnerScope else{return}
    challengeCamera.cancel()
    if let operation=earnedPhotoOperationId {_=photoPipeline.cancel(operation)}
    earnedPhotoOperationId=nil;earnedPhotoEvidenceSessionId=nil;earnedPhotoOwnerScope=nil;earnedPhotoBindingID=nil
  }
  @MainActor private func captureEarnedChallengePhoto(_ request:[String:Any],_ scope:String)async->[String:Any] {
    guard #available(iOS 16.0,*) else{return FreedChallengeEvidenceReceipt.photo(reason:"challenge-evidence-unavailable")}
    let admitted=FreedAppGroupsRuntime.shared.prepareEarnedChallengePhotoCapture(request,scope)
    guard admitted["accepted"] as? Bool==true,let operation=request["captureOperationId"] as? String,let target=request["targetId"] as? String,earnedPhotoOperationId==nil else{return admitted["accepted"] as? Bool==true ? FreedChallengeEvidenceReceipt.photo(reason:"photo-operation-busy"):admitted}
    earnedPhotoBindingID=FreedAppGroupsRuntime.shared.currentBindingIdentity
    earnedPhotoOperationId=operation;earnedPhotoOwnerScope=scope;earnedPhotoEvidenceSessionId=request["evidenceSessionId"] as? String
    defer{if earnedPhotoOperationId==operation {earnedPhotoOperationId=nil;earnedPhotoOwnerScope=nil;earnedPhotoEvidenceSessionId=nil}}
    do {
      let capture=try await challengeCamera.capture(operationId:operation)
      guard earnedPhotoOperationId==operation,earnedPhotoBindingID==FreedAppGroupsRuntime.shared.currentBindingIdentity,UIApplication.shared.applicationState == .active,!Task.isCancelled else{let cleaned=FreedChallengeOwnedCaptureFiles.remove(capture);return FreedChallengeEvidenceReceipt.photo(reason:cleaned ? "photo-capture-cancelled":"photo-capture-cleanup-failed",result:"cancelled")}
      let classification:[String:Any]=await withCheckedContinuation{continuation in photoPipeline.classifyNativeCapture(capture,targetId:target,completion:{continuation.resume(returning:$0)})}
      // Cleanup precedes proof publication. A failed deletion cannot earn access.
      guard FreedChallengeOwnedCaptureFiles.remove(capture) else{return FreedChallengeEvidenceReceipt.photo(reason:"photo-capture-cleanup-failed")}
      guard earnedPhotoOperationId==operation,earnedPhotoBindingID==FreedAppGroupsRuntime.shared.currentBindingIdentity,UIApplication.shared.applicationState == .active,!Task.isCancelled else{return FreedChallengeEvidenceReceipt.photo(reason:"photo-capture-cancelled",result:"cancelled")}
      return FreedAppGroupsRuntime.shared.completeEarnedChallengePhoto(request,scope,capture:capture,classification:classification)
    }catch {return FreedChallengeEvidenceReceipt.photo(reason:error as? FreedChallengeNativeCamera.Failure == .cancelled ? "photo-capture-cancelled":"photo-capture-unavailable",result:error as? FreedChallengeNativeCamera.Failure == .cancelled ? "cancelled":"unavailable")}
  }

  @MainActor private func cancelAccountSessionResources(binding expected: String, evidenceSessionID: String?, captureOperationID: String? = nil) -> [String: Any] {
    guard UUID(uuidString: expected) != nil, evidenceSessionID == nil || UUID(uuidString: evidenceSessionID!) != nil,
      captureOperationID == nil || FreedEarnedAppTimePolicy.identifier(captureOperationID!) else {
      return ["version": 2, "bindingHandle": expected, "state": "unavailable", "osDismissalConfirmed": false]
    }
    var requested = false, unavailable = false
    var observation = "notApplicable"
    if #available(iOS 16.0, *) {
      observation = FreedAppGroupsRuntime.shared.cancelOwnedChallengeObservation(binding: expected, evidenceSessionID: evidenceSessionID)
    }
    // Exact individual evidence cancellation never touches a newer same-binding resource.
    if earnedPhotoBindingID == expected,
      evidenceSessionID == nil || (evidenceSessionID == earnedPhotoEvidenceSessionId && captureOperationID != nil && captureOperationID == earnedPhotoOperationId) {
      cancelEarnedChallengeCapture(evidenceSessionId: evidenceSessionID); requested = true
    }
    if evidenceSessionID == nil {
      if pendingFamilyPickerBindingID == expected {
        if let cancel = pendingFamilyPickerReset { cancel(); requested = true } else { unavailable = true }
      }
      if #available(iOS 16.0, *) {
        let group = FreedAppGroupPicker.cancel(bindingID: expected)
        let website = FreedWebsiteProbePicker.cancel(bindingID: expected)
        requested = requested || group.requested || website.requested || group.pending || website.pending
        unavailable = unavailable || group.unavailable || website.unavailable
      }
    }
    let state = unavailable ? "unavailable" : requested || observation == "pending" ? "pending" : observation == "cancelled" ? "cancelled" : "notApplicable"
    return ["version": 2, "bindingHandle": expected, "state": state,
      "observationState": observation, "osDismissalConfirmed": false]
  }

  @MainActor private func appGroupReceiptWithAvailability(_ receipt:[String:Any])->[String:Any] {
    var result=receipt,diagnostics=receipt["diagnostics"] as? [String:Any] ?? [:]
    #if canImport(UIKit)
    diagnostics["protectedDataAvailable"]=UIApplication.shared.isProtectedDataAvailable
    #else
    diagnostics["protectedDataAvailable"]=NSNull()
    #endif
    diagnostics["containerAvailable"]=FileManager.default.containerURL(forSecurityApplicationGroupIdentifier:FreedProtectionConfigurationLock.appGroupIdentifier) != nil
    result["diagnostics"]=diagnostics
    return result
  }

  public func definition() -> ModuleDefinition {
    Name("FreedProtection")
    OnCreate {
      // Native factory lifecycle issuance is synchronous; never enqueue this lease claim.
      if self.appContext?._runtime != nil { FreedAccountBindingLifecycle.created(module: self.accountModuleLease) }
      Task { @MainActor in
        self.reconcileAccountProtectionCleanup()
        #if os(iOS) && canImport(NetworkExtension)
        if #available(iOS 14.0, *) { _ = await FreedEncryptedDnsController.shared.status() }
        #endif
        for name in [UIApplication.protectedDataDidBecomeAvailableNotification, UIApplication.willEnterForegroundNotification] {
          self.cleanupObservers.append(NotificationCenter.default.addObserver(forName: name, object: nil, queue: .main) { [weak self] _ in
            Task { @MainActor in
              self?.reconcileAccountProtectionCleanup()
              #if os(iOS) && canImport(NetworkExtension)
              if #available(iOS 14.0, *) { _ = await FreedEncryptedDnsController.shared.status() }
              #endif
            }
          })
        }
      }
      #if os(iOS) && canImport(UIKit)
      FreedProtectionAppExecution.install()
      #endif
      _=FreedChallengeOwnedCaptureFiles.cleanupAbandoned()
    }

    Class(FreedAccountBindingSession.self) {
      Constructor { () throws -> FreedAccountBindingSession in
        guard let context = self.appContext,
          context.moduleRegistry.get(moduleWithName: "FreedProtection") === self else { throw FreedAccountProtectionCleanup.Failure.staleBinding }
        return try FreedAccountBindingSession(module: self.accountModuleLease)
      }
    }
    AsyncFunction("prepareAccountBindingV2") { (session: FreedAccountBindingSession, scope: String, transition: String, sequence: Int) async throws -> [String: Any] in
      try await MainActor.run {
        guard #available(iOS 16.0, *) else { throw FreedAccountProtectionCleanup.Failure.staleBinding }
        guard session.state.current else { throw FreedAccountProtectionCleanup.Failure.staleBinding }
        try FreedAppGroupsRuntime.shared.installBindingSession(session.state)
        return try FreedAppGroupsRuntime.shared.prepareBinding(scope: scope, session: session.state.id, transition: transition, sequence: sequence)
      }
    }
    AsyncFunction("commitAccountBindingV2") { (session: FreedAccountBindingSession, ticket: String) async throws -> [String: Any] in
      try await MainActor.run {
        guard #available(iOS 16.0, *) else { throw FreedAccountProtectionCleanup.Failure.staleBinding }
        guard session.state.current else { throw FreedAccountProtectionCleanup.Failure.staleBinding }
        return try FreedAppGroupsRuntime.shared.commitBinding(ticket: ticket, session: session.state.id)
      }
    }
    AsyncFunction("cancelAccountSessionResources") { (binding: String, evidenceSessionID: String, captureOperationID: String) async -> [String: Any] in
      await MainActor.run { self.cancelAccountSessionResources(binding: binding, evidenceSessionID: evidenceSessionID.isEmpty ? nil : evidenceSessionID, captureOperationID: captureOperationID.isEmpty ? nil : captureOperationID) }
    }
    AsyncFunction("prepareAccountProtectionCleanup") { (scope: String, handle: String) async throws -> [String: Any] in
      try await MainActor.run { try self.prepareAccountProtectionCleanup(scope: scope, handle: handle) }
    }
    AsyncFunction("executeAccountProtectionCleanup") { (operationID: String) async -> [String: Any] in
      await MainActor.run { self.executeAccountProtectionCleanup(operationID: operationID) }
    }
    AsyncFunction("getAccountProtectionCleanup") { (operationID: String) throws -> [String: Any] in
      try FreedProtectionConfigurationLock.withExclusiveAccess { try FreedAccountProtectionCleanup.required(operationID, $0).receipt(replayed: true) }
    }
    Events("onVpnConsentResult")
    AsyncFunction("getAppGroups") { (scope: String) async -> [String: Any] in
      return await MainActor.run {
      if #available(iOS 16.0, *) { return FreedAppGroupsRuntime.shared.snapshot(scope) }
      return FreedAppGroupsBridgeUnavailable.snapshot
      }
    }
    AsyncFunction("setAppGroupActionScope") { (scope: String) async -> [String: Any] in
      return await MainActor.run {
      if #available(iOS 16.0, *) { let oldBinding=FreedAppGroupsRuntime.shared.currentBindingIdentity;let result=FreedAppGroupsRuntime.shared.setScope(scope);if result["bindingCurrent"] as? Bool==true,let oldBinding {FreedAppGroupPicker.cancel(bindingID:oldBinding)};if result["bindingCurrent"] as? Bool==true,self.earnedPhotoOwnerScope != scope {self.cancelEarnedChallengeCapture()};return result }
      return FreedProtectionConfigurationLock.bindingFailure(reason: "app-groups-ios-unavailable", stage: "unavailable", supported: false)
      }
    }
    AsyncFunction("suspendAppGroupOperations") { () async -> Bool in
      return await MainActor.run {
      if #available(iOS 16.0, *),self.legacyPrivateAvailable(),FreedAppGroupsRuntime.shared.suspend() { self.cancelEarnedChallengeCapture(); FreedAppGroupPicker.cancelCurrent(); return true }
      return false
      }
    }
    AsyncFunction("createAppGroup") { (request: [String: Any], scope: String) async -> [String: Any] in
      return await MainActor.run {
      if #available(iOS 16.0, *) { return self.appGroupReceiptWithAvailability(FreedAppGroupsRuntime.shared.create(request, scope) )}
      return self.appGroupReceiptWithAvailability(FreedAppGroupsBridgeUnavailable.receipt)
      }
    }
    AsyncFunction("updateAppGroup") { (request: [String: Any], scope: String) async -> [String: Any] in
      return await MainActor.run {
      if #available(iOS 16.0, *) { return self.appGroupReceiptWithAvailability(FreedAppGroupsRuntime.shared.update(request, scope) )}
      return self.appGroupReceiptWithAvailability(FreedAppGroupsBridgeUnavailable.receipt)
      }
    }
    AsyncFunction("updateAppGroupWithEarnedTime") { (request: [String: Any], scope: String) async -> [String: Any] in
      return await MainActor.run {
      if #available(iOS 16.0, *) { return self.appGroupReceiptWithAvailability(FreedAppGroupsRuntime.shared.updateAppGroupWithEarnedTime(request, scope) )}
      return self.appGroupReceiptWithAvailability(FreedAppGroupsBridgeUnavailable.receipt)
      }
    }
    AsyncFunction("prepareEarnedAppTimeOffer") { (request: [String: Any], scope: String) async -> [String: Any] in
      if #available(iOS 16.0, *) { return await FreedAppGroupsRuntime.shared.prepareEarnedAppTimeOfferWithClockRepair(request, scope) }
      return ["version":2,"policyVersion":2,"supported":false,"accepted":false,"reason":"earned-time-unavailable","offer":NSNull(),"budget":NSNull()]
    }
    AsyncFunction("grantEarnedAppTimeBreak") { (request: [String: Any], scope: String) async -> [String: Any] in
      return await MainActor.run {
      if #available(iOS 16.0, *) { return FreedAppGroupsRuntime.shared.grantEarnedAppTimeBreak(request, scope) }
      return ["version":2,"policyVersion":2,"supported":false,"accepted":false,"reason":"earned-time-unavailable","offerId":NSNull(),"completionSessionId":NSNull(),"groupId":NSNull(),"nativeInterventionId":NSNull(),"seconds":NSNull(),"expiresAt":NSNull(),"effective":false,"remainingRestrictionCount":NSNull(),"replayed":false,"budget":NSNull()]
      }
    }
    AsyncFunction("getEarnedAppTimeGrant") { (request: [String: Any], scope: String) async -> [String: Any] in
      return await MainActor.run {
      if #available(iOS 16.0, *) { return FreedAppGroupsRuntime.shared.getEarnedAppTimeGrant(request, scope) }
      return ["version":2,"policyVersion":2,"supported":false,"accepted":false,"reason":"earned-time-unavailable","offerId":NSNull(),"completionSessionId":NSNull(),"groupId":NSNull(),"nativeInterventionId":NSNull(),"seconds":NSNull(),"expiresAt":NSNull(),"effective":false,"remainingRestrictionCount":NSNull(),"replayed":false,"budget":NSNull()]
      }
    }
    AsyncFunction("beginEarnedChallengeEvidence") { (request:[String:Any],scope:String) async -> [String:Any] in
      return await MainActor.run {if #available(iOS 16.0,*) {return FreedAppGroupsRuntime.shared.beginEarnedChallengeEvidence(request,scope)};return FreedChallengeEvidenceReceipt.make(reason:"challenge-evidence-unavailable",supported:false)}
    }
    AsyncFunction("setEarnedChallengeEvidencePhase") { (request:[String:Any],scope:String) async -> [String:Any] in
      return await MainActor.run {if #available(iOS 16.0,*) {let result=FreedAppGroupsRuntime.shared.setEarnedChallengeEvidencePhase(request,scope);if result["accepted"] as? Bool==true,request["phase"] as? String != "active" {self.cancelEarnedChallengeCapture(evidenceSessionId:request["evidenceSessionId"] as? String,scope:scope)};return result};return FreedChallengeEvidenceReceipt.make(reason:"challenge-evidence-unavailable",supported:false)}
    }
    AsyncFunction("getEarnedChallengeEvidence") { (request:[String:Any],scope:String) async -> [String:Any] in
      return await MainActor.run {if #available(iOS 16.0,*) {return FreedAppGroupsRuntime.shared.getEarnedChallengeEvidence(request,scope)};return FreedChallengeEvidenceReceipt.make(reason:"challenge-evidence-unavailable",supported:false)}
    }
    AsyncFunction("finishEarnedChallengeEvidence") { (request:[String:Any],scope:String) async -> [String:Any] in
      return await MainActor.run {if #available(iOS 16.0,*) {return FreedAppGroupsRuntime.shared.finishEarnedChallengeEvidence(request,scope)};return FreedChallengeEvidenceReceipt.make(reason:"challenge-evidence-unavailable",supported:false)}
    }
    AsyncFunction("verifyEarnedChallengePhoto") { (request:[String:Any],scope:String) async -> [String:Any] in
      return await MainActor.run {if #available(iOS 16.0,*) {return FreedAppGroupsRuntime.shared.verifyEarnedChallengePhoto(request,scope)};return FreedChallengeEvidenceReceipt.photo(reason:"challenge-evidence-unavailable")}
    }
    AsyncFunction("captureEarnedChallengePhoto") { (request:[String:Any],scope:String) async -> [String:Any] in
      return await self.captureEarnedChallengePhoto(request,scope)
    }
    AsyncFunction("removeAppGroup") { (request: [String: Any], scope: String) async -> [String: Any] in
      return await MainActor.run {
      if #available(iOS 16.0, *) { return self.appGroupReceiptWithAvailability(FreedAppGroupsRuntime.shared.remove(request, scope) )}
      return self.appGroupReceiptWithAvailability(FreedAppGroupsBridgeUnavailable.receipt)
      }
    }
    AsyncFunction("discardPendingAppGroupSelection") { (request: [String: Any], scope: String) async -> [String: Any] in
      return await MainActor.run {
      if #available(iOS 16.0, *) { return self.appGroupReceiptWithAvailability(FreedAppGroupsRuntime.shared.discardPendingSelection(request, scope) )}
      return self.appGroupReceiptWithAvailability(FreedAppGroupsBridgeUnavailable.receipt.merging(["operation":"discard-pending-selection","targetId":request["id"] ?? NSNull(),"pendingSelectionDiscarded":false]) { _, value in value })
      }
    }
    AsyncFunction("presentAppGroupPicker") { (request: [String: Any], scope: String, header: String, footer: String) async -> [String: Any] in
      if #available(iOS 16.0, *) { let receipt=await FreedAppGroupPicker.present(request: request, scope: scope, header: header, footer: footer);return await MainActor.run {self.appGroupReceiptWithAvailability(receipt)} }
      return await MainActor.run {self.appGroupReceiptWithAvailability(FreedAppGroupsBridgeUnavailable.receipt)}
    }
    View(FreedAppGroupTokenView.self) {
      Events("onContentSizeChange")
      Prop("groupId") { (view, value: String) in view.groupId = value }
      Prop("draft") { (view, value: Bool) in view.draft = value }
      Prop("unavailableLabel") { (view, value: String) in view.unavailableLabel = value }
      Prop("dark") { (view, value: Bool) in view.dark = value }
      Prop("layout") { (view, value: String) in view.layout = value == "rows" ? "rows" : "preview" }
      Prop("configurationGeneration") { (view, value: Int) in view.configurationGeneration = value }
      Prop("scopeEpoch") { (view, value: Int) in view.scopeEpoch = value }
      Prop("storeRevision") { (view, value: Int) in view.storeRevision = value }
      Prop("groupRevision") { (view, value: Int) in view.groupRevision = value }
      OnViewDidUpdateProps { (view: FreedAppGroupTokenView) in view.reload() }
    }


    AsyncFunction("resetProtectionConfiguration") { () async -> [String: Any] in
      guard self.legacyPrivateAvailable() else { return ["protectionConfigurationResetAccepted": false, "reason": "binding-v2-transport-required"] }
      return await self.resetProtectionConfiguration()
    }

    AsyncFunction("activateProtectionConfiguration") { () -> [String: Any] in
      guard self.legacyPrivateAvailable() else { return ["accepted": false, "reason": "binding-v2-transport-required"] }
      var payload = self.withProtectionConfigurationAccess(privateAdmission: true) {
        let defaults = self.sharedDefaults()
        defaults.set(false, forKey: FreedProtectionResetPolicy.resetMarkerKey)
        guard FreedProtectionConfigurationLock.persist(defaults), !defaults.bool(forKey: FreedProtectionResetPolicy.resetMarkerKey) else {
          return ["protectionConfigurationActivationAccepted": false]
        }
        var status = self.statusPayload(authorized: self.isAuthorized(),
          active: self.isAuthorized() && self.isAdultFilterActive(), scheduled: self.isRiskWindowMonitoringActive(),
          message: self.isAuthorized()
            ? "Screen Time authorization is available. Apply the adult-content web filter to activate protection."
            : "Screen Time authorization has not been granted.")
        status["protectionConfigurationActivationAccepted"] = true
        return status
      }
      if payload["protectionConfigurationActivationAccepted"] as? Bool != true {
        payload["protectionConfigurationActivationAccepted"] = false
      }
      return payload
    }

    // Presentation only: no browsing data or enforcement permissions are changed.
    Function("setPresentationPreferences") { (configuration: [String: String]) -> Bool in
      let languages = ["en", "hi", "ko", "es", "pt", "fr", "de", "ar", "ja", "zh-Hans"]
      guard let language = configuration["language"], languages.contains(language),
            let theme = configuration["themeMode"], ["system", "light", "dark"].contains(theme),
            let defaults = UserDefaults(suiteName: self.appGroupIdentifier) else { return false }
      let selection = configuration["languagePreference"] ?? language
      guard selection == "system" || languages.contains(selection) else { return false }
      let presentation = ["language": selection, "themeMode": theme]
      defaults.set(presentation, forKey: "freed.presentation.v1")
      return (defaults.dictionary(forKey: "freed.presentation.v1") as? [String: String]) == presentation
    }

    AsyncFunction("deviceAdultBridge") { (command: String, request: [String: Any]) async -> [String: Any] in
      if #available(iOS 15.1, *) {
        return await self.deviceAdultBridge(command, request)
      }
      return ["schema": 1, "kind": "error", "code": "unavailable"]
    }

    AsyncFunction("getCapabilities") { () -> [String: Any] in
      return [
        "platform": "ios",
        "screenTime": self.hasFamilyControls(),
        "managedSettings": self.hasManagedSettings(),
        "appGuardModes": self.hasAppGuardModes(),
        "appSchedules": self.hasAppGuardModes(),
        "appGroups": self.hasAppGuardModes(),
        "appGroupTokenLabels": self.hasAppGuardModes(),
        "installedApps": false,
        "accessibility": false,
        "dnsFiltering": false,
        "safariContentBlocker": self.hasSafariContentBlocker(),
        "safariExtensionSettings": self.supportsSafariExtensionSettings(),
        "localVpnFallback": false,
        "notes": [
          "Uses Apple FamilyControls authorization when entitlement is granted.",
          "Uses ManagedSettings web content policy for adult filtering.",
          "Uses Safari extensions with explicit host access for adult-domain and short-form web protection.",
          "Shield and DeviceActivity extensions must be added as app targets before App Store release."
        ]
      ]
    }

    AsyncFunction("getEncryptedDnsStatus") { () async -> [String: Any] in
      #if os(iOS) && canImport(NetworkExtension)
      if #available(iOS 14.0, *) {
        return await FreedEncryptedDnsController.shared.status()
      }
      #endif
      return FreedEncryptedDnsPolicy.status(supported: false, releaseEnabled: false,
        configured: false, managerEnabled: false, error: "ios-dns-api-unavailable")
    }

    AsyncFunction("getRecoveryDnsPilotStatus") { (actionScope: String) async -> [String: Any] in
      #if os(iOS)
      if #available(iOS 16.0, *) { return await FreedRecoveryDnsPilot.status(actionScope: actionScope) }
      #endif
      return FreedRecoveryDnsPilotFailure.receipt(FreedRecoveryDnsPilotFailure.releaseGated)
    }
    AsyncFunction("stageRecoveryDnsPilot") { (input: [String: Any]) async -> [String: Any] in
      #if os(iOS)
      if #available(iOS 16.0, *) { return await FreedRecoveryDnsPilot.stage(input) }
      #endif
      return FreedRecoveryDnsPilotFailure.receipt(FreedRecoveryDnsPilotFailure.releaseGated)
    }
    AsyncFunction("prepareRecoveryDnsReplacement") { (reference: String, actionScope: String) async -> [String: Any] in
      #if os(iOS)
      if #available(iOS 16.0, *) { return await FreedRecoveryDnsPilot.prepareReplacement(reference, actionScope: actionScope) }
      #endif
      return FreedRecoveryDnsPilotFailure.receipt(FreedRecoveryDnsPilotFailure.releaseGated)
    }
    AsyncFunction("checkRecoveryDnsPilot") { (reference: String, actionScope: String) async -> [String: Any] in
      #if os(iOS)
      if #available(iOS 16.0, *) { return await FreedRecoveryDnsPilot.check(reference, actionScope: actionScope) }
      #endif
      return FreedRecoveryDnsPilotFailure.receipt(FreedRecoveryDnsPilotFailure.releaseGated)
    }
    AsyncFunction("prepareRecoveryDnsModeActivation") { (reference: String, actionScope: String) async -> [String: Any] in
      #if os(iOS)
      if #available(iOS 16.0, *) { return await FreedRecoveryDnsPilot.prepareModeActivation(reference, actionScope: actionScope) }
      #endif
      return FreedRecoveryDnsPilotFailure.receipt(FreedRecoveryDnsPilotFailure.releaseGated)
    }

    AsyncFunction("configureEncryptedDns") { (configuration: [String: Any]) async -> [String: Any] in
      guard let enabled = configuration["enabled"] as? Bool,
        configuration["provider"] as? String == "cloudflare-families" else {
        return FreedEncryptedDnsPolicy.status(supported: false, releaseEnabled: false,
          configured: false, managerEnabled: false, error: "encrypted-dns-configuration-invalid")
      }
      #if os(iOS) && canImport(NetworkExtension)
      if #available(iOS 14.0, *) {
        return await FreedEncryptedDnsController.shared.configure(enabled: enabled)
      }
      #endif
      return FreedEncryptedDnsPolicy.status(supported: false, releaseEnabled: false,
        configured: false, managerEnabled: false, error: "ios-dns-api-unavailable")
    }

    AsyncFunction("getStatus") { () async -> [String: Any] in
      guard self.legacyPrivateAvailable() else { return ["accepted": false, "reason": "binding-v2-transport-required"] }
      _ = try? FreedProtectionConfigurationLock.withExclusiveAccess { defaults in
        guard FreedAccountProtectionCleanup.legacyPrivateAllowed(defaults) else { return }
        self.refreshEarnedUnlockWindow()
      }
      await self.refreshSafariContentBlockerStateIfAvailable()
      guard self.legacyPrivateAvailable() else { return ["accepted": false, "reason": "binding-v2-transport-required"] }
      let authorized = self.isAuthorized()
      let filterActive = authorized && self.isAdultFilterActive()
      let riskWindowActive = authorized && self.isRiskWindowMonitoringActive()
      return self.statusPayload(
        authorized: authorized,
        active: filterActive,
        scheduled: riskWindowActive,
        message: filterActive
          ? "Screen Time adult-content web filter is active."
          : riskWindowActive
          ? "Night Guard is scheduled. FREED will apply Screen Time filtering during the risk window."
          : authorized
          ? "Screen Time authorization is available. Apply the adult-content web filter to activate protection."
          : "Screen Time authorization has not been granted."
      )
    }

    AsyncFunction("getStatusV2") { (session: FreedAccountBindingSession, actionScope: String) async -> [String: Any] in
      await self.readStatusV2(session, actionScope)
    }

    AsyncFunction("getDevicePublicStatus") { () async -> [String: Any] in
      await self.readDevicePublicStatus()
    }

    AsyncFunction("configureSafariContentBlockerRules") { (rulesJson: String, version: String, checksum: String, generatedAt: String) async -> [String: Any] in
      do {
        let epoch = try FreedProtectionConfigurationLock.withExclusiveAccess { try FreedProtectionConfigurationLock.fenceAdultMutations($0) }
        let task = FreedAdultProtectionLegacyGate.enqueueLegacy(key: "safari:" + String(epoch)) { authority in
          await self.performLegacySafariConfiguration(rulesJson: rulesJson, version: version, checksum: checksum, generatedAt: generatedAt, authority: authority, epoch: epoch)
        }
        return await FreedAdultProtectionLegacyGate.waitForLegacy(task, pending: ["nativeConfigurationOperationAccepted": false, "operationPending": true, "nativeConfigurationError": "adult-writer-settling"])
      } catch { return FreedAdultProtectionLegacyGate.rejection(error) }
    }

    AsyncFunction("requestAuthorization") { () async -> [String: Any] in
      #if canImport(FamilyControls)
      if #available(iOS 16.0, *) {
        do {
          try await AuthorizationCenter.shared.requestAuthorization(for: .individual)
          let authorized = self.isAuthorized()
          return self.authorizationOutcomePayload(await self.readDevicePublicStatus(), outcome: authorized ? "granted" : "denied")
        } catch {
          let outcome: String
          if let familyError = error as? FamilyControlsError, case .authorizationCanceled = familyError { outcome = "cancelled" }
          else if error is CancellationError { outcome = "cancelled" }
          else { outcome = "error" }
          return self.authorizationOutcomePayload(await self.readDevicePublicStatus(), outcome: outcome, error: error)
        }
      }
      #endif

      return self.authorizationOutcomePayload(await self.readDevicePublicStatus(), outcome: "unsupported")
    }

    AsyncFunction("applyAdultContentFilter") { () async -> [String: Any] in
      #if canImport(UIKit)
      let protectedDataAvailable = await MainActor.run { UIApplication.shared.isProtectedDataAvailable }
      return self.applyAdultContentPolicy(protectedDataAvailable: protectedDataAvailable)
      #else
      return self.applyAdultContentPolicy()
      #endif
    }

    AsyncFunction("grantResetAppGroupBreak") { (request: [String: Any], scope: String) -> [String: Any] in
      if #available(iOS 16.0, *) { return FreedAppGroupsRuntime.shared.grantResetReward(request, scope) }
      return ["version":1,"policyVersion":1,"supported":false,"accepted":false,"reason":"reset-reward-unavailable","effective":false,"replayed":false]
    }

    AsyncFunction("applyEarnedUnlockWindow") { (expiresAt: String, sourceAttemptHost: String?, expectedInterventionId: String?) -> [String: Any] in
      guard self.legacyPrivateAvailable() else { return ["accepted": false, "reason": "binding-v2-transport-required"] }
      if #available(iOS 16.0, *), let id = self.sanitizedPendingInterventionId(expectedInterventionId), FreedAppGroupsRuntime.shared.hasAuthority(id) {
        var payload = self.statusPayload(authorized: self.isAuthorized(), active: self.isAuthorized() && self.isAdultFilterActive(), scheduled: self.isRiskWindowMonitoringActive(), message: "App group recovery break checked.")
        guard self.sanitizedPendingHost(sourceAttemptHost) == self.screenTimeShieldHost,
          let expiry = self.parseIsoDate(expiresAt), let grant = FreedAppGroupsRuntime.shared.grant(id: id, expiry: expiry.timeIntervalSince1970) else { payload["nativeUnlockGrantAccepted"] = false; return payload }
        for (key, value) in grant { payload[key] = value }
        if grant["appGroupBreakEffective"] as? Bool != true { payload.removeValue(forKey: "activeUnlockExpiresAt"); payload.removeValue(forKey: "activeUnlockInterventionId") }
        return payload
      }
      return self.withProtectionConfigurationAccess(privateAdmission: true) {
        let now = Date()
        guard let expiry = self.parseIsoDate(expiresAt), expiry > now else {
          var payload = self.statusPayload(
            authorized: self.isAuthorized(),
            active: self.isAuthorized() && self.isAdultFilterActive(),
            scheduled: self.isRiskWindowMonitoringActive(),
            message: "Earned unlock request is expired or invalid. Existing Screen Time protection remains in effect."
          )
          payload["nativeUnlockGrantAccepted"] = false
          return payload
        }

        if #available(iOS 16.0, *), FreedAppGroupsRuntime.shared.hasActiveEarnedTimeBreak(self.sharedDefaults()) {
          var payload = self.statusPayload(authorized: self.isAuthorized(), active: self.isAuthorized() && self.isAdultFilterActive(), scheduled: self.isRiskWindowMonitoringActive(), message: "An app break is already active.")
          payload["nativeUnlockGrantAccepted"] = false
          return payload
        }

        guard
          self.isScreenTimeUnlockSource(sourceAttemptHost),
          !self.isIndependentAppGuardActive(),
          let sanitizedExpectedInterventionId = self.sanitizedPendingInterventionId(expectedInterventionId),
          let pendingEnvelope = self.pendingEarnedUnlockEnvelope(),
          pendingEnvelope.interventionId == sanitizedExpectedInterventionId,
          self.isSelectedScreenTimeScope(pendingEnvelope.scope)
        else {
          var payload = self.statusPayload(
            authorized: self.isAuthorized(),
            active: self.isAuthorized() && self.isAdultFilterActive(),
            scheduled: self.isRiskWindowMonitoringActive(),
            message: "Screen Time unlock identity does not match the claimed intervention. Existing Screen Time protection remains in effect."
          )
          payload["nativeUnlockGrantAccepted"] = false
          return payload
        }

        let unlockScope = pendingEnvelope.scope
        let previousMonitoringSnapshot = self.captureEarnedUnlockMonitoringSnapshot()
        let boundedExpiresAt = self.formatIsoDate(self.boundedEarnedUnlockExpiry(expiry, from: now))
        guard let boundedExpiry = self.parseIsoDate(boundedExpiresAt), boundedExpiry > now,
          let scopeData = try? JSONEncoder().encode(unlockScope),
          self.scheduleEarnedUnlockMonitoring(expiresAt: boundedExpiry) else {
          var payload = self.statusPayload(authorized: self.isAuthorized(), active: self.isAuthorized() && self.isAdultFilterActive(),
            scheduled: self.isRiskWindowMonitoringActive(), message: "A native expiry relock could not be installed. Existing protection remains in effect.")
          payload["nativeUnlockGrantAccepted"] = false
          return payload
        }
        let defaults = self.sharedDefaults()
        let leaseKeys = [self.earnedUnlockExpiresAtKey, self.earnedUnlockSourceKey,
          self.earnedUnlockInterventionIdKey, self.earnedUnlockScopeKey]
        var previousLease = [String: Any]()
        for key in leaseKeys { previousLease[key] = defaults.object(forKey: key) }
        let previousEnvelope = defaults.data(forKey: self.pendingEarnedUnlockScopeKey)
        guard self.consumePendingEarnedUnlockEnvelope(sanitizedExpectedInterventionId) != nil else {
          self.restoreEarnedUnlockMonitoring(previousLease, snapshot: previousMonitoringSnapshot)
          var payload = self.statusPayload(authorized: self.isAuthorized(), active: self.isAuthorized() && self.isAdultFilterActive(),
            scheduled: self.isRiskWindowMonitoringActive(), message: "The challenged application authority is no longer available.")
          payload["nativeUnlockGrantAccepted"] = false
          return payload
        }
        defaults.set(boundedExpiresAt, forKey: self.earnedUnlockExpiresAtKey)
        defaults.set(self.screenTimeShieldHost, forKey: self.earnedUnlockSourceKey)
        defaults.set(sanitizedExpectedInterventionId, forKey: self.earnedUnlockInterventionIdKey)
        defaults.set(scopeData, forKey: self.earnedUnlockScopeKey)
        guard FreedProtectionConfigurationLock.persist(defaults), defaults.string(forKey: self.earnedUnlockExpiresAtKey) == boundedExpiresAt,
          defaults.data(forKey: self.earnedUnlockScopeKey) == scopeData else {
          for key in leaseKeys {
            if let previous = previousLease[key] { defaults.set(previous, forKey: key) }
            else { defaults.removeObject(forKey: key) }
          }
          if let previousEnvelope { defaults.set(previousEnvelope, forKey: self.pendingEarnedUnlockScopeKey) }
          self.restoreEarnedUnlockMonitoring(previousLease, snapshot: previousMonitoringSnapshot)
          self.applySelectedShieldsForCurrentState()
          var payload = self.statusPayload(authorized: self.isAuthorized(), active: self.isAuthorized() && self.isAdultFilterActive(),
            scheduled: self.isRiskWindowMonitoringActive(), message: "The native application break could not be persisted. Previous protection was retained.")
          payload["nativeUnlockGrantAccepted"] = false
          return payload
        }
        self.applySelectedShieldsForCurrentState()
        self.scheduleEarnedUnlockRelock(expiresAt: boundedExpiry)

        var payload = self.statusPayload(
          authorized: self.isAuthorized(),
          active: self.isAuthorized() && self.isAdultFilterActive(),
          scheduled: self.isRiskWindowMonitoringActive(),
          message: self.earnedUnlockMessage(for: unlockScope)
        )
        // This is acknowledgment of the existing ID-authorized native grant,
        // not a health getter or a new authority derived from recovery history.
        let storedScope = self.activeEarnedUnlockScope()
        payload["nativeUnlockGrantAccepted"] = self.isAuthorized()
          && !self.isIndependentAppGuardActive()
          && self.isEarnedUnlockMonitoringReady(expiresAt: boundedExpiry)
          && self.activeEarnedUnlockExpiresAt() == boundedExpiresAt
          && storedScope?.kind == unlockScope.kind
          && storedScope?.tokenType == unlockScope.tokenType
          && storedScope?.token == unlockScope.token
        payload["nativeUnlockGrantInterventionId"] = sanitizedExpectedInterventionId
        return payload
      }
    }

    AsyncFunction("clearEarnedUnlockWindow") { () -> [String: Any] in
      guard self.legacyPrivateAvailable() else { return ["accepted": false, "reason": "binding-v2-transport-required"] }
      return self.withProtectionConfigurationAccess(privateAdmission: true) {
        self.clearEarnedUnlockState()
        guard FreedProtectionConfigurationLock.persist(self.sharedDefaults()) else { return ["nativeConfigurationOperationAccepted":false,"nativeUnlockGrantAccepted":false] }
        self.stopEarnedUnlockMonitoring()
        self.applySelectedShieldsForCurrentState()

        return self.statusPayload(
          authorized: self.isAuthorized(),
          active: self.isAuthorized() && self.isAdultFilterActive(),
          scheduled: self.isRiskWindowMonitoringActive(),
          message: "Earned unlock cleared. FREED shields are active again."
        )
      }
    }

    AsyncFunction("stopAdultContentFilter") { () -> [String: Any] in
      return self.withAdultProtectionConfigurationAccess {
        do { try FreedAdultProtectionLegacyGate.requireUnenrolled() }
        catch { return FreedAdultProtectionLegacyGate.rejection(error) }
        #if canImport(ManagedSettings)
        if #available(iOS 15.0, *) {
          do { try self.setAdultFilterActive(false) }
          catch { return FreedRetainedAdultProtection.failureReceipt(error) }
          guard FreedProtectionConfigurationLock.persist(self.sharedDefaults()) else { return ["nativeConfigurationOperationAccepted":false] }
          self.applyWebContentFilterForCurrentState()
          self.applySelectedShieldsForCurrentState()
          return self.statusPayload(
            authorized: self.isAuthorized(),
            active: false,
            scheduled: self.isRiskWindowMonitoringActive(),
            message: "ManagedSettings adult-content web filter paused."
          )
        }
        #endif

        return self.statusPayload(
          authorized: false,
          active: false,
          scheduled: false,
          message: "ManagedSettings web filtering is unavailable in this build."
        )
      }
    }

    AsyncFunction("startRiskWindowMonitoring") { (startHour: Int, endHour: Int, startMinute: Int, endMinute: Int) -> [String: Any] in
      let authorized=self.isAuthorized()
      let accepted=authorized && self.installAcknowledgedNightGuard(startHour:startHour,endHour:endHour,startMinute:startMinute,endMinute:endMinute)
      var payload=self.statusPayload(authorized:authorized,active:authorized && self.isAdultFilterActive(),scheduled:self.isRiskWindowMonitoringActive(),message:accepted ? "Night Guard scheduled from \(self.timeLabel(startHour,startMinute)) to \(self.timeLabel(endHour,endMinute)).":"Night Guard could not be updated. Retry saving its time window.")
      payload["nightGuardOperationAccepted"]=accepted
      payload["nativeConfigurationDiagnostics"]=authorized ? self.lastNightGuardDiagnostics ?? ["stage":"native-operation","reason":"night-guard-not-confirmed"] : ["stage":"authorization","reason":"screen-time-authorization-required"]
      return payload
    }

    AsyncFunction("stopRiskWindowMonitoring") { () -> [String: Any] in
      return self.withAdultProtectionConfigurationAccess {
        do { try FreedAdultProtectionLegacyGate.requireUnenrolled() }
        catch { return FreedAdultProtectionLegacyGate.rejection(error) }
        do { try self.setRiskWindowMonitoringActive(false) }
        catch { return FreedRetainedAdultProtection.failureReceipt(error) }
        self.sharedDefaults().removeObject(forKey: FreedNightGuardIntent.key)
        self.sharedDefaults().set(false, forKey: self.riskWindowCurrentlyActiveKey)
        guard FreedProtectionConfigurationLock.persist(self.sharedDefaults()) else { return ["nativeConfigurationOperationAccepted":false] }
        #if canImport(DeviceActivity)
        if #available(iOS 15.0, *) {
          DeviceActivityCenter().stopMonitoring([DeviceActivityName(self.riskWindowActivityName)])
        }
        #endif

        self.applyWebContentFilterForCurrentState()
        self.applySelectedShieldsForCurrentState()
        return self.statusPayload(
          authorized: self.isAuthorized(),
          active: self.isAuthorized() && self.isAdultFilterActive(),
          scheduled: false,
          message: "Night Guard schedule stopped."
        )
      }
    }

    AsyncFunction("configureAppGuardMode") { (mode: String) -> [String: Any] in
      guard self.legacyPrivateAvailable() else { return ["accepted": false, "reason": "binding-v2-transport-required"] }
      return self.withProtectionConfigurationAccess(privateAdmission: true) { self.configureAppGuardMode(mode) }
    }

    AsyncFunction("configureAppSchedules") { (configuration: [String: Any]) -> [String: Any] in
      guard self.legacyPrivateAvailable() else { return ["accepted": false, "reason": "binding-v2-transport-required"] }
      return self.withProtectionConfigurationAccess(privateAdmission: true) { self.configureAppSchedules(configuration) }
    }

    AsyncFunction("configureBlockedAppPackages") { (_packages: [String], dailyLimitMinutes: Int?, _shortFormInterruptionSeconds: Int?) -> [String: Any] in
      guard self.legacyPrivateAvailable() else { return ["accepted": false, "reason": "binding-v2-transport-required"] }
      return self.withProtectionConfigurationAccess(privateAdmission: true) {
        guard !self.sharedDefaults().bool(forKey: FreedProtectionResetPolicy.resetMarkerKey) else {
          return self.statusPayload(authorized: self.isAuthorized(), active: false, scheduled: false,
            message: "FREED protection was reset. Activate protection before syncing blocking rules.")
        }
        // This passive write changes a limit, not the installed guard mode or
        // opaque selection. Android package names never identify iOS tokens.
        let limitMinutes = self.sanitizeDailyLimitMinutes(dailyLimitMinutes)
        self.sharedDefaults().set(limitMinutes, forKey: self.appLimitDailyMinutesKey)
        do { try self.installConfiguredAppGuard() } catch {
          return self.statusPayload(authorized: self.isAuthorized(), active: self.isAuthorized() && self.isAdultFilterActive(),
            scheduled: self.isRiskWindowMonitoringActive(), message: "Selected app guard needs attention: \(error.localizedDescription)")
        }
        return self.statusPayload(authorized: self.isAuthorized(), active: self.isAuthorized() && self.isAdultFilterActive(),
          scheduled: self.isRiskWindowMonitoringActive(), message: "Selected app guard settings saved. Review native readiness before relying on protection.")
      }
    }

    AsyncFunction("getWebsiteRecoveryProbe") { () async -> [String: Any] in
      guard self.legacyPrivateAvailable() else { return ["accepted": false, "reason": "binding-v2-transport-required"] }
      return await MainActor.run {
        guard self.legacyPrivateAvailable() else { return ["accepted": false, "reason": "binding-v2-transport-required"] }
      if #available(iOS 16.0, *) {
        guard FreedAppGroupsRuntime.shared.ownerVerified else { return ["supported": FreedWebsiteRecoveryProbe.allowed, "accepted": false, "reason": "verified-owner-required"] }
        return FreedWebsiteRecoveryProbe.snapshot()
      }
      return ["supported": false, "accepted": false, "reason": "ios16-required"]
      }
    }
    AsyncFunction("getShieldRuntimeDiagnostics") { () async -> [String: Any] in
      return await MainActor.run {
        guard self.legacyPrivateAvailable() else { return ["accepted": false, "reason": "binding-v2-transport-required"] }
        guard #available(iOS 16.0, *) else { return ["enabled": false, "status": "unknown", "records": []] }
        return FreedShieldRuntimeDiagnostics.readCommitted { committedDefaults in
          FreedAppGroupsRuntime.shared.diagnosticOwnerVerified(committedDefaults)
        }
      }
    }
    AsyncFunction("mutateWebsiteRecoveryProbe") { (operation: String, revision: Int, generation: Int, epoch: Int) async -> [String: Any] in
      guard self.legacyPrivateAvailable() else { return ["accepted": false, "reason": "binding-v2-transport-required"] }
      return await MainActor.run {
        guard self.legacyPrivateAvailable() else { return ["accepted": false, "reason": "binding-v2-transport-required"] }
      if #available(iOS 16.0, *), FreedAppGroupsRuntime.shared.ownerVerified {
        return FreedWebsiteRecoveryProbe.mutate(operation: operation, revision: revision, generation: generation, epoch: epoch)
      }
      return ["accepted": false, "reason": "verified-owner-required"]
      }
    }
    AsyncFunction("presentWebsiteRecoveryProbePicker") { (revision: Int) async -> [String: Any] in
      guard self.legacyPrivateAvailable() else { return ["accepted": false, "reason": "binding-v2-transport-required"] }
      if #available(iOS 16.0, *) { return await FreedWebsiteProbePicker.present(revision: revision) }
      return ["accepted": false, "reason": "ios16-required"]
    }
    AsyncFunction("probeRawWebsiteTokenAvailability") { () async -> [String: Any] in
      guard self.legacyPrivateAvailable() else { return ["accepted": false, "reason": "binding-v2-transport-required"] }
      return await MainActor.run {
        guard self.legacyPrivateAvailable() else { return ["accepted": false, "reason": "binding-v2-transport-required"] }
      if #available(iOS 16.0, *), FreedWebsiteRecoveryProbe.allowed, FreedAppGroupsRuntime.shared.ownerVerified,
        AuthorizationCenter.shared.authorizationStatus == .approved {
        // Fixed harmless fixture only. Never return a domain or token payload.
        return ["supported": true, "tokenAvailable": FreedWebsiteProbeTransaction.rawTokenAvailable(WebDomain(domain: "ordinaryallowedexample.com").token)]
      }
      return ["supported": false]
      }
    }

    AsyncFunction("presentFamilyActivityPicker") { () async -> [String: Any] in
      guard self.legacyPrivateAvailable() else { return ["accepted": false, "reason": "binding-v2-transport-required"] }
      guard let requestGeneration = try? FreedProtectionConfigurationLock.withExclusiveAccess({ defaults in
        guard !self.resettingProtectionConfiguration else { throw FreedProtectionConfigurationLock.AccessError.unavailable }
        return FreedProtectionConfigurationLock.generation(defaults)
      }) else {
        return ["nativeConfigurationOperationAccepted": false, "nativeConfigurationError": "ios-reset-configuration-in-progress"]
      }
      let authorized = self.isAuthorized()
      if !authorized {
        return self.statusPayload(
          authorized: false,
          active: false,
          scheduled: self.isRiskWindowMonitoringActive(),
          message: "Approve Screen Time authorization before choosing protected apps."
        )
      }

      #if canImport(FamilyControls) && canImport(SwiftUI) && canImport(UIKit)
      if #available(iOS 16.0, *) {
        return await withCheckedContinuation { continuation in
          Task { @MainActor in
            guard let presenter = self.appContext?.utilities?.currentViewController() else {
              continuation.resume(returning: self.statusPayload(
                authorized: true,
                active: self.isAdultFilterActive(),
                scheduled: self.isRiskWindowMonitoringActive(),
                message: "Screen Time picker could not open. Return to FREED setup and try choosing protected apps again."
              ))
              return
            }

            guard let pickerGeneration = try? FreedProtectionConfigurationLock.withExclusiveAccess({ defaults in
              guard !self.resettingProtectionConfiguration,
                FreedProtectionConfigurationLock.generation(defaults) == requestGeneration else {
                throw FreedProtectionConfigurationLock.AccessError.unavailable
              }
              return FreedProtectionConfigurationLock.generation(defaults)
            }) else {
              continuation.resume(returning: ["nativeConfigurationOperationAccepted": false,
                "nativeConfigurationError": "ios-reset-configuration-in-progress"])
              return
            }
            var didResume = false
            var pickerController: UIViewController?

            @MainActor
            func finishPicker(message: String) {
              guard !didResume else { return }
              didResume = true
              self.pendingFamilyPickerReset = nil
              self.pendingFamilyPickerBindingID = nil
              let payload = self.statusPayload(
                authorized: true,
                active: self.isAdultFilterActive(),
                scheduled: self.isRiskWindowMonitoringActive(),
                message: message
              )
              if let controller = pickerController {
                pickerController = nil
                controller.dismiss(animated: true) {
                  continuation.resume(returning: payload)
                }
              } else {
                continuation.resume(returning: payload)
              }
            }

            self.pendingFamilyPickerBindingID = FreedAppGroupsRuntime.shared.currentBindingIdentity
            self.pendingFamilyPickerReset = {
              finishPicker(message: "Screen Time picker closed. Choose at least one app, category, or web domain before activation can finish.")
            }
            let picker = FreedFamilyActivityPickerView(
              initialSelection: self.loadFamilyActivitySelection(),
              onCancel: {
                finishPicker(message: "Screen Time picker closed. Choose at least one app, category, or web domain before activation can finish.")
              },
              onDone: { selection in
                guard !didResume else { return }
                var saved = false
                _ = try? FreedProtectionConfigurationLock.withExclusiveAccess { defaults in
                  guard FreedAccountProtectionCleanup.legacyPrivateAllowed(defaults), !self.resettingProtectionConfiguration,
                    !defaults.bool(forKey: FreedProtectionResetPolicy.resetMarkerKey),
                    FreedProtectionConfigurationLock.generation(defaults) == pickerGeneration else { return }
                  guard self.saveFamilyActivitySelection(selection) else { return }
                  saved = true

                  let selectedTargetCount = selection.applicationTokens.count + selection.categoryTokens.count + selection.webDomainTokens.count
                  var installationSucceeded = false
                  do {
                    try self.installConfiguredAppGuard()
                    installationSucceeded = self.isAppGuardReady()
                  } catch { installationSucceeded = false }
                  self.applySelectedShieldsForCurrentState()
                  if selectedTargetCount > 0 && installationSucceeded {
                    finishPicker(message: "Screen Time targets saved and the selected app guard installed.")
                  } else if selectedTargetCount > 0 {
                    finishPicker(message: "Screen Time targets saved. Native app guard readiness needs attention before activation.")
                  } else {
                    finishPicker(message: "No Screen Time targets were selected. Choose at least one app before activation can finish.")
                  }
                }
                if !saved {
                  finishPicker(message: "Screen Time picker closed. Choose at least one app, category, or web domain before activation can finish.")
                }
              }
            )
            let controller = UIHostingController(rootView: picker)
            pickerController = controller
            controller.modalPresentationStyle = .formSheet
            // Cancel and Done both resolve the continuation. Prevent an
            // unhandled swipe dismissal from leaving setup waiting forever.
            controller.isModalInPresentation = true
            presenter.present(controller, animated: true)
          }
        }
      }
      #endif

      return self.statusPayload(
        authorized: authorized,
        active: authorized && self.isAdultFilterActive(),
        scheduled: self.isRiskWindowMonitoringActive(),
        message: "FamilyActivityPicker requires iOS 16+ and the FamilyControls framework."
      )
    }

    AsyncFunction("getSafariRecoveryObservation") { () async -> [String: Any] in
      let observation = FreedSafariRecoveryObservation.shared
      do {
        let expected = try observation.readExpectedPackage()
        try observation.startHostSession()
        let before = try observation.read(expected: expected)
        let enabled = await self.safariFocusShieldEnabledFact()
        return try observation.read(expected: expected, enabled: enabled, captured: before.binding).payload
      } catch {
        let reason = (error as? FreedSafariRecoveryObservation.Failure)?.reason ?? "storage-unavailable"
        return FreedSafariRecoveryObservation.unavailable(reason)
      }
    }

    AsyncFunction("openSafariExtensionSettings") { (requestedTarget: String) async -> [String: Any] in
      let target = requestedTarget == "focus-shield" ? "focus-shield" : "content-blocker"
      if target == "focus-shield" {
        do { try FreedSafariRecoveryObservation.shared.invalidateForSettings() }
        catch {
          var failed = self.statusPayload(authorized: self.isAuthorized(), active: self.isAdultFilterActive(), message: "Safari configuration storage is unavailable. Unlock your iPhone and retry.")
          failed["safariExtensionSettingsOpened"] = false; failed["safariExtensionSettingsRoute"] = "none"
          failed["safariExtensionSettingsTarget"] = target; failed["safariExtensionSettingsError"] = "observation-invalidation-failed"
          return failed
        }
      }
      let extensionName = target == "focus-shield" ? "FREED Focus Shield" : "FREED Safari Blocker"
      let route = await self.openSafariExtensionSettingsRoute(target: target)
      await self.refreshSafariContentBlockerStateIfAvailable()
      let authorized = self.isAuthorized()
      var payload = self.statusPayload(
        authorized: authorized,
        active: authorized && self.isAdultFilterActive(),
        scheduled: authorized && self.isRiskWindowMonitoringActive(),
        message: route.opened
          ? route.route == "extension"
            ? "Safari extension settings opened. Enable \(extensionName), then return to continue setup."
            : "FREED app settings opened. Find Safari > Extensions in Settings, enable \(extensionName), then return to continue setup."
          : "Safari settings could not open. Return to FREED and try again."
      )
      payload["safariExtensionSettingsAvailable"] = route.directSettingsAvailable
      payload["safariExtensionSettingsOpened"] = route.opened
      payload["safariExtensionSettingsRoute"] = route.route
      payload["safariExtensionSettingsTarget"] = target
      if let error = route.error { payload["safariExtensionSettingsError"] = error }
      return payload
    }

    AsyncFunction("openProtectionSettings") { () async -> [String: Any] in
      #if canImport(UIKit)
      let opened = await Task { @MainActor in
        guard let settingsURL = URL(string: UIApplication.openSettingsURLString) else { return false }
        return await UIApplication.shared.open(settingsURL)
      }.value
      #else
      let opened = false
      #endif
      await self.refreshSafariContentBlockerStateIfAvailable()

      let authorized = self.isAuthorized()
      let filterActive = authorized && self.isAdultFilterActive()
      var result = self.statusPayload(
        authorized: authorized,
        active: filterActive,
        scheduled: authorized && self.isRiskWindowMonitoringActive(),
        message: opened ? "iOS opened FREED app settings. Return to check configuration." : "iOS did not open FREED app settings."
      )
      result["settingsHandoff"] = ["version": 1, "operationId": UUID().uuidString, "kind": "settings", "opened": opened]
      return result
    }

    AsyncFunction("openVpnSettings") { () async -> [String: Any] in
      #if canImport(UIKit)
      Task { @MainActor in
        if let settingsURL = URL(string: UIApplication.openSettingsURLString) {
          UIApplication.shared.open(settingsURL)
        }
      }
      #endif
      let authorized = self.isAuthorized()
      let filterActive = authorized && self.isAdultFilterActive()
      return self.statusPayload(
        authorized: authorized,
        active: filterActive,
        scheduled: authorized && self.isRiskWindowMonitoringActive(),
        message: "Opening iOS Settings."
      )
    }

    AsyncFunction("runActivationDiagnostics") { (adultHost: String, normalHost: String, requireReviewedAdultFeed: Bool) async -> [String: Any] in
      await self.refreshSafariContentBlockerStateIfAvailable()
      return self.activationDiagnosticsPayload(
        adultHostInput: adultHost,
        normalHostInput: normalHost,
        requireReviewedAdultFeed: requireReviewedAdultFeed
      )
    }

    AsyncFunction("getPendingInterventionV2") { (actionScope: String) -> [String: Any]? in
      guard #available(iOS 16.0, *) else { return nil }
      return (try? FreedAppGroupsRuntime.shared.withAcknowledgedPrivateScope(actionScope) { defaults -> [String: Any]? in
        guard let record = self.pendingInterventionRecord(defaults: defaults), let scope = record.scope else { return nil }
        if scope.websiteProbeRevision != nil {
          guard self.validWebsiteProbeScope(scope, defaults) else { return nil }
        } else if scope.groupId != nil {
          guard record.sourcePackage == self.screenTimeShieldSource,
            let data = try? JSONEncoder().encode(scope),
            let fields = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any],
            FreedAppGroupsRuntime.shared.validIssuedScope(fields, defaults) else { return nil }
        } else { return nil }
        guard let interventionId = self.sanitizedPendingInterventionId(record.id),
          !self.isPendingInterventionConsumed(interventionId, defaults: defaults) else { return nil }
        guard self.isFreshPendingIntervention(record.detectedAt) else {
          _ = self.claimPendingIntervention(interventionId, stageEarnedUnlockScope: false, defaults: defaults)
          return nil
        }
        let host = self.sanitizedPendingHost(record.host)
        var payload: [String: Any] = ["interventionId": interventionId, "url": "https://\(host)", "host": host,
          "sourcePackage": self.sanitizedPendingSourcePackage(record.sourcePackage), "reason": record.reason,
          "matchedRule": record.matchedRule, "detectedAt": record.detectedAt]
        if let scopePayload = self.scopePayload(record.scope) { payload["scope"] = scopePayload }
        return payload
      }) ?? nil
    }
    AsyncFunction("clearPendingInterventionV2") { (expectedInterventionId: String, actionScope: String) -> Bool in
      guard #available(iOS 16.0, *), let id = self.sanitizedPendingInterventionId(expectedInterventionId) else { return false }
      return (try? FreedAppGroupsRuntime.shared.withAcknowledgedPrivateScope(actionScope) { defaults in
        guard let record = self.pendingInterventionRecord(defaults: defaults), let scope = record.scope, self.isFreshPendingIntervention(record.detectedAt) else { return false }
        if scope.websiteProbeRevision != nil {
          guard self.validWebsiteProbeScope(scope, defaults) else { return false }
        } else if scope.groupId == nil { return false }
        // Website recovery consumes a safe event and never stages an app unlock.
        return self.claimPendingIntervention(id, stageEarnedUnlockScope: scope.groupId != nil, defaults: defaults)
      }) ?? false
    }

    AsyncFunction("getPendingIntervention") { () -> [String: Any]? in
      return (try? FreedProtectionConfigurationLock.withExclusiveAccess { defaults -> [String: Any]? in
      guard FreedAccountProtectionCleanup.legacyPrivateAllowed(defaults) else { return nil }
      guard let record = self.pendingInterventionRecord() else {
        return nil
      }
      if let scope = record.scope, scope.websiteProbeRevision != nil {
        guard #available(iOS 16.0, *), FreedAppGroupsRuntime.shared.ownerVerified,
          self.validWebsiteProbeScope(scope, self.sharedDefaults()) else { return nil }
      }
      if let scope = record.scope, scope.groupId != nil {
        if #available(iOS 16.0, *) {
          guard FreedAppGroupsRuntime.shared.ownerVerified else { return nil }
          guard let data = try? JSONEncoder().encode(scope), let fields = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any], FreedAppGroupsRuntime.shared.validIssuedScope(fields, self.sharedDefaults()) else { return nil }
        } else { return nil }
      }
      guard let interventionId = self.sanitizedPendingInterventionId(record.id) else {
        return nil
      }
      guard !self.isPendingInterventionConsumed(interventionId) else {
        return nil
      }

      guard self.isFreshPendingIntervention(record.detectedAt) else {
        _ = self.claimPendingIntervention(interventionId, stageEarnedUnlockScope: false)
        return nil
      }

      let host = self.sanitizedPendingHost(record.host)
      var payload: [String: Any] = [
        "interventionId": interventionId,
        "url": "https://\(host)",
        "host": host,
        "sourcePackage": self.sanitizedPendingSourcePackage(record.sourcePackage),
        "reason": record.reason,
        "matchedRule": record.matchedRule,
        "detectedAt": record.detectedAt
      ]
      if let scopePayload = self.scopePayload(record.scope) {
        payload["scope"] = scopePayload
      }
      return payload
      }) ?? nil
    }

    AsyncFunction("clearPendingIntervention") { (expectedInterventionId: String) -> Bool in
      guard let sanitizedInterventionId = self.sanitizedPendingInterventionId(expectedInterventionId) else {
        return false
      }
      return (try? FreedProtectionConfigurationLock.withExclusiveAccess { defaults in
        guard FreedAccountProtectionCleanup.legacyPrivateAllowed(defaults), FreedProtectionConfigurationLock.permitsPublication(defaults) else { return false }
        return self.claimPendingIntervention(sanitizedInterventionId, stageEarnedUnlockScope: true)
      }) ?? false
    }

    OnDestroy {
      FreedAccountBindingLifecycle.destroyed(module: self.accountModuleLease)
      self.photoPipeline.destroy()
      Task { @MainActor in
        self.cancelEarnedChallengeCapture(); self.challengeCamera.destroy()
        for observer in self.cleanupObservers { NotificationCenter.default.removeObserver(observer) }; self.cleanupObservers = []
      }
    }
    OnAppContextDestroys { FreedAccountBindingLifecycle.destroyed(module: self.accountModuleLease) }
    AsyncFunction("getChallengePhotoCapabilities") { () -> [String: Any] in
      #if canImport(UIKit)
      return self.photoPipeline.capabilities(cameraAvailable: UIImagePickerController.isSourceTypeAvailable(.camera))
      #else
      return self.photoPipeline.capabilities(cameraAvailable: false)
      #endif
    }.runOnQueue(.main)
    AsyncFunction("classifyChallengePhoto") { (uri: String, expectedLabels: [String], operationId: String, promise: Promise) in
      guard self.legacyPrivateAvailable() else { promise.reject("binding-v2-transport-required", "Native binding transport is required."); return }
      self.photoPipeline.classify(uri: uri, expectedLabels: expectedLabels, operationId: operationId, promise: promise)
    }
    AsyncFunction("cancelChallengePhoto") { (operationId: String) -> Bool in
      guard self.legacyPrivateAvailable() else { return false }
      return self.photoPipeline.cancel(operationId)
    }

  }

  private func hasFamilyControls() -> Bool {
    #if targetEnvironment(simulator)
    return false
    #else
    #if canImport(FamilyControls)
    if #available(iOS 16.0, *) { return true }
    #endif
    return false
    #endif
  }

  private func hasManagedSettings() -> Bool {
    #if targetEnvironment(simulator)
    return false
    #else
    #if canImport(ManagedSettings)
    if #available(iOS 15.0, *) { return true }
    #endif
    return false
    #endif
  }

  private func hasSafariContentBlocker() -> Bool {
    #if canImport(SafariServices)
    return true
    #else
    return false
    #endif
  }

  private func supportsSafariExtensionSettings() -> Bool {
    #if canImport(SafariServices) && canImport(UIKit)
    if #available(iOS 26.2, *) { return true }
    #endif
    return false
  }

  @MainActor
  private func openSafariExtensionSettingsRoute(target: String) async -> FreedSafariSettingsRouteResult {
    #if canImport(UIKit)
    let identifier = target == "focus-shield" ? safariFocusShieldIdentifier : safariContentBlockerIdentifier
    return await FreedSafariSettingsRouter.open(
      directSettingsAvailable: supportsSafariExtensionSettings(),
      isForeground: UIApplication.shared.applicationState == .active,
      openExtensionSettings: {
        #if canImport(SafariServices)
        if #available(iOS 26.2, *) {
          try await SFSafariSettings.openExtensionsSettings(forIdentifiers: [identifier])
          return
        }
        #endif
        throw self.makeFreedError("Direct Safari extension settings are unavailable on this iOS version.")
      },
      openAppSettings: {
        guard UIApplication.shared.applicationState == .active,
              let settingsURL = URL(string: UIApplication.openSettingsURLString) else { return false }
        return await UIApplication.shared.open(settingsURL)
      }
    )
    #else
    return FreedSafariSettingsRouteResult(
      opened: false, route: "none", directSettingsAvailable: false,
      error: "iOS settings are unavailable in this build."
    )
    #endif
  }

  private func isAuthorized() -> Bool {
    #if canImport(FamilyControls)
    if #available(iOS 16.0, *) {
      return AuthorizationCenter.shared.authorizationStatus == .approved
    }
    #endif
    return false
  }

  private func sharedDefaults() -> UserDefaults {
    FreedProtectionConfigurationLock.sharedDefaults()
  }

  @MainActor
  private func resetProtectionConfiguration() async -> [String: Any] {
    do {
      let captured = try FreedProtectionConfigurationLock.withExclusiveAccess { defaults in
        (FreedProtectionConfigurationLock.generation(defaults), try FreedProtectionConfigurationLock.fenceAdultMutations(defaults))
      }
      let task = FreedAdultProtectionLegacyGate.enqueueLegacy(key: "mixed-reset:" + String(captured.0) + ":" + String(captured.1)) { authority in
        await self.performLegacyProtectionReset(authority: authority, epoch: captured.1)
      }
      return await FreedAdultProtectionLegacyGate.waitForLegacy(task, pending: ["protectionConfigurationResetAccepted": false, "operationPending": true, "protectionConfigurationResetError": "adult-writer-settling"])
    } catch { return FreedAdultProtectionLegacyGate.rejection(error) }
  }

  @MainActor
  private func performLegacyProtectionReset(authority: FreedAdultProtectionLegacyGate.LegacyAuthority, epoch: Int) async -> [String: Any] {
    var ownsReset = false
    defer {
      if ownsReset {
        _ = try? FreedProtectionConfigurationLock.withExclusiveAccess { _ in resettingProtectionConfiguration = false }
      }
    }
    let synchronousState: [String: Any]
    do {
      synchronousState = try FreedAdultProtectionLegacyGate.withAuthority(authority) {
        try FreedProtectionConfigurationLock.withExclusiveAccess { defaults in
        guard try FreedProtectionConfigurationLock.adultMutationEpoch(defaults) == epoch else { throw FreedAdultLockIntegrationFailure.staleConfiguration }
        guard !resettingProtectionConfiguration else { throw FreedProtectionConfigurationLock.AccessError.unavailable }
        try FreedAdultProtectionLegacyGate.requireUnenrolled()
        _ = try FreedRetainedAdultProtection.migrate(defaults)
        resettingProtectionConfiguration = true
        ownsReset = true
        FreedProtectionConfigurationLock.invalidateForReset(defaults)
        removePendingShieldInterventionNotifications(before: FreedProtectionConfigurationLock.generation(defaults))
        return performSynchronousProtectionReset()
        }
      }
    } catch {
      return ["protectionConfigurationResetAccepted": false,
        "protectionConfigurationResetError": "ios-reset-configuration-lock-unavailable",
        "protectionConfigurationResetRetryable": true]
    }
    pendingFamilyPickerReset?()
    pendingFamilyPickerReset = nil
    if #available(iOS 16.0, *) { FreedAppGroupPicker.cancelCurrent(); FreedWebsiteProbePicker.cancelCurrent() }
    var errors = synchronousState["errors"] as? [String] ?? []
    var preferencesCleared = synchronousState["nativePreferencesCleared"] as? Bool == true
    let monitorsStopped = synchronousState["monitorsStopped"] as? Bool == true
    let shieldsCleared = synchronousState["shieldsCleared"] as? Bool == true
    var safariRulesRemoved = synchronousState["safariRulesRemoved"] as? Bool == true
    let safariResetRulesConfirmed = synchronousState["safariResetRulesConfirmed"] as? Bool == true
    let safariReloadConfirmed = await reloadSafariContentBlockerForReset(capturedEpoch: epoch)
    // Enablement remains an OS permission. The owned blocker behavior is inert
    // only after Safari reloads the marker-selected no-op payload (or disables
    // the extension). Focus native publication rejects every old cached script.
    let blockerEnabled = await safariContentBlockerEnabledForReset()
    let focusEnabled = await safariFocusShieldEnabledForReset()
    if !safariResetRulesConfirmed || (!safariReloadConfirmed && blockerEnabled != false) {
      errors.append("ios-reset-safari-reload-failed")
    }

    var dnsResult: [String: Any] = ["removed": true]
    #if os(iOS) && canImport(NetworkExtension)
    if #available(iOS 14.0, *) { dnsResult = await FreedEncryptedDnsController.shared.resetConfigurationSettled(authority: authority, generation: FreedProtectionConfigurationLock.generation(sharedDefaults()), epoch: epoch) }
    #else
    if sharedDefaults().object(forKey: "freed.encryptedDns.cloudflareFamilies.configured") != nil {
      dnsResult = ["removed": false, "error": "ios-reset-dns-api-unavailable"]
    }
    #endif
    if dnsResult["removed"] as? Bool != true {
      errors.append(dnsResult["error"] as? String ?? "ios-reset-dns-remove-not-confirmed")
    }

    do {
      return try FreedProtectionConfigurationLock.withExclusiveAccess { _ in
        if (try? FreedProtectionConfigurationLock.adultMutationEpoch(sharedDefaults())) != epoch { errors.append("ios-reset-native-epoch-invalidated") }
        // Re-check after suspension for stale extension writes or concurrent setup.
        if !FreedProtectionResetPolicy.isEmptyConfiguration(sharedDefaults().persistentDomain(forName: appGroupIdentifier)) {
          errors.append("ios-reset-preferences-changed-during-cleanup")
          preferencesCleared = false
        }
        if let rulesURL = safariContentBlockerRulesURL() {
          let resetRulesURL = rulesURL.deletingLastPathComponent().appendingPathComponent(safariContentBlockerResetRulesFileName)
          if FileManager.default.fileExists(atPath: rulesURL.path)
              || (try? Data(contentsOf: resetRulesURL)) != Data(FreedProtectionResetPolicy.inertSafariRulesJSON.utf8) {
            errors.append("ios-reset-safari-rules-changed-during-cleanup")
            safariRulesRemoved = false
          }
        }
        var payload = FreedProtectionResetPolicy.receipt(errors: errors,
          safariContentBlockerEnabled: blockerEnabled, safariFocusShieldEnabled: focusEnabled)
        payload["authorized"] = isAuthorized()
        payload["nativePreferencesCleared"] = preferencesCleared
        payload["monitorsStopped"] = monitorsStopped
        payload["shieldsCleared"] = shieldsCleared
        payload["safariRulesRemoved"] = safariRulesRemoved
        payload["safariResetRulesConfirmed"] = safariResetRulesConfirmed
        payload["safariReloadConfirmed"] = safariReloadConfirmed
        payload["encryptedDnsConfigurationRemoved"] = dnsResult["removed"] as? Bool == true
        return payload
      }
    } catch {
      return ["protectionConfigurationResetAccepted": false,
        "protectionConfigurationResetError": "ios-reset-readback-lock-unavailable",
        "protectionConfigurationResetRetryable": true]
    }
  }

  @MainActor private func prepareAccountProtectionCleanup(scope: String, handle: String) throws -> [String: Any] {
    guard #available(iOS 16.0, *) else { throw FreedAccountProtectionCleanup.Failure.staleBinding }
    let root = FreedChallengeOwnedCaptureFiles.nativeDirectory
    let captures = FileManager.default.fileExists(atPath: root.path) ? try FileManager.default.contentsOfDirectory(atPath: root.path) : []
    guard captures.count <= 8, captures.allSatisfy({ $0.range(of: #"^[a-f0-9-]{36}\.jpg$"#, options: .regularExpression) != nil }) else { throw FreedAccountProtectionCleanup.Failure.capacity }
    return try FreedAppGroupsRuntime.shared.prepareCleanup(scope: scope, handle: handle, captures: captures).receipt()
  }

  @MainActor private func executeAccountProtectionCleanup(operationID: String, requestExecution: Bool = true) -> [String: Any] {
    var failureStage = "native-cleanup-execution-intent"
    do {
      var record = try FreedProtectionConfigurationLock.withExclusiveAccess { defaults in
        if requestExecution { return try FreedAccountProtectionCleanup.arm(operationID, defaults) }
        return try FreedAccountProtectionCleanup.required(operationID, defaults)
      }
      if record.terminal { return record.receipt(replayed: true) }
      guard record.executionAdmitted else { return record.receipt(replayed: true) }
      failureStage = "native-cleanup-storage-or-admission"
      var processScrub = record.processScrubState ?? .pending
      if #available(iOS 16.0, *), !record.processScrubResolved {
        processScrub = FreedAppGroupsRuntime.shared.suspendCleanup(record) {
          if self.earnedPhotoBindingID == record.bindingID { self.cancelEarnedChallengeCapture() }
          FreedAppGroupPicker.cancel(bindingID: record.bindingID)
          FreedWebsiteProbePicker.cancel(bindingID: record.bindingID)
          if self.pendingFamilyPickerBindingID == record.bindingID { self.pendingFamilyPickerReset?() }
          return self.earnedPhotoBindingID != record.bindingID && self.pendingFamilyPickerBindingID != record.bindingID
        }
      }
      // Completed transactions, never one rollback body around OS/core side effects.
      record = try FreedProtectionConfigurationLock.withExclusiveAccess { try FreedAccountProtectionCleanup.fence(operationID, $0) }
      record = try FreedProtectionConfigurationLock.withExclusiveAccess { try FreedAccountProtectionCleanup.erase(operationID, $0) }
      if record.privateStoreErased {
        record = try FreedProtectionConfigurationLock.withExclusiveAccess { defaults in
          var value = try FreedAccountProtectionCleanup.required(operationID, defaults)
          value.processScrubState = processScrub
          guard try FreedAccountProtectionCleanup.ownsRevokedNamespace(value, defaults) else {
            value.phase = .supersededRuntime; try FreedAccountProtectionCleanup.replace(value, defaults); return value
          }
          try FreedAccountProtectionCleanup.scrubLegacy(&value, defaults)
          var scrubbed = false
          if #available(iOS 16.0, *) { scrubbed = try FreedAppGroupsRuntime.shared.scrubCleanup(value, defaults) }
          clearSelectedShields() // only shield fields; the installed adult filter is untouched
          #if canImport(ManagedSettings)
          if #available(iOS 15.0, *) { scrubbed = scrubbed && store.shield.applications == nil && store.shield.applicationCategories == nil && store.shield.webDomains == nil && store.shield.webDomainCategories == nil }
          #endif
          for name in value.resources.captures {
            let file = FreedChallengeOwnedCaptureFiles.nativeDirectory.appendingPathComponent(name)
            guard file.standardizedFileURL.deletingLastPathComponent() == FreedChallengeOwnedCaptureFiles.nativeDirectory.standardizedFileURL else { throw FreedAccountProtectionCleanup.Failure.corrupt }
            if FileManager.default.fileExists(atPath: file.path) { do { try FileManager.default.removeItem(at: file) } catch { scrubbed = false } }
          }
          scrubbed = scrubbed && value.legacyPrivateStoreErased
          value.localRuntimeScrubComplete = scrubbed && value.processScrubResolved
          value.runtimeScrubComplete = value.localRuntimeScrubComplete && !value.resources.notificationsUnverified
          value.phase = value.runtimeScrubComplete && !value.coreInvalidationPending ? .completed : .runtimePending
          if value.terminal { value.resources = .init(notificationsUnverified: false) }
          try FreedAccountProtectionCleanup.replace(value, defaults); return value
        }
        continueAccountCleanup(record)
      }
      return record.receipt()
    } catch {
      var receipt = (try? FreedProtectionConfigurationLock.withExclusiveAccess { try FreedAccountProtectionCleanup.required(operationID, $0).receipt(replayed: true) }) ?? ["privateCleanupAccepted": false]
      receipt["retryable"] = true; receipt["failureStage"] = failureStage
      return receipt
    }
  }

  @MainActor private func reconcileAccountProtectionCleanup() {
    guard let records = try? FreedProtectionConfigurationLock.withExclusiveAccess({ try FreedAccountProtectionCleanup.read($0).records }) else { return }
    for record in records where !record.terminal && record.executionAdmitted {
      _ = executeAccountProtectionCleanup(operationID: record.operationID, requestExecution: false)
    }
  }

  @MainActor private func continueAccountCleanup(_ record: FreedAccountProtectionCleanup.Record) {
    let id = record.operationID
    guard record.executionAdmitted, !accountCleanupTasks.contains(id) else { return }
    accountCleanupTasks.insert(id)
    // Independent background bookkeeping: caller receipt never waits for DNS,
    // Keychain, the adult writer lane, or notification-query settlement.
    Task { @MainActor in
      defer { self.accountCleanupTasks.remove(id) }
      do {
        guard record.coreInvalidationPending else { return }
        let runtime = try FreedAdultProtectionRuntime.shared()
        var acknowledged = false
        switch try await runtime.friendLockStatusForCleanup() {
        case .notEnrolled: acknowledged = true
        case .enrolled: acknowledged = try await runtime.coordinator.invalidateForPrivateCleanup(operationID: id) == .acknowledged
        case .missingEnrolled, .corrupt, .unavailable: break
        }
        if acknowledged { try FreedProtectionConfigurationLock.withExclusiveAccess { try FreedAccountProtectionCleanup.acknowledgeCore(id, $0) } }
      } catch { /* Persisted pending state remains retryable; private erasure stands. */ }
    }
    #if canImport(UserNotifications)
    let center = UNUserNotificationCenter.current()
    center.getPendingNotificationRequests { pending in
      UNUserNotificationCenter.current().getDeliveredNotifications { delivered in
        let requests = pending + delivered.map(\.request)
        Task { @MainActor in
          _ = try? FreedProtectionConfigurationLock.withExclusiveAccess { defaults in
            var current = try FreedAccountProtectionCleanup.required(id, defaults)
            guard !current.terminal, try FreedAccountProtectionCleanup.ownsRevokedNamespace(current, defaults) else { return }
            let privateNotices = requests.filter { $0.content.userInfo["kind"] as? String == "freed-pending-intervention" }
            let known = privateNotices.filter { $0.content.userInfo["shieldGeneration"] as? Int == current.original.generation }
            let unknown = privateNotices.contains { $0.content.userInfo["shieldGeneration"] as? Int == nil }
            let ids = Array(Set(known.map(\.identifier)))
            guard ids.count <= 32 else { throw FreedAccountProtectionCleanup.Failure.capacity }
            current.resources.notifications = ids; current.resources.notificationsUnverified = unknown || !ids.isEmpty
            current.runtimeScrubComplete = current.localRuntimeScrubComplete && current.processScrubResolved && !current.resources.notificationsUnverified
            if current.runtimeScrubComplete && !current.coreInvalidationPending { current.phase = .completed; current.resources = .init(notificationsUnverified: false) }
            try FreedAccountProtectionCleanup.replace(current, defaults)
            UNUserNotificationCenter.current().removePendingNotificationRequests(withIdentifiers: ids)
            UNUserNotificationCenter.current().removeDeliveredNotifications(withIdentifiers: ids)
            if !ids.isEmpty {
              UNUserNotificationCenter.current().getPendingNotificationRequests { remaining in
                UNUserNotificationCenter.current().getDeliveredNotifications { remainingDelivered in
                  let observed = remaining + remainingDelivered.map(\.request)
                  Task { @MainActor in
                    _ = try? FreedProtectionConfigurationLock.withExclusiveAccess { d in
                      var final = try FreedAccountProtectionCleanup.required(id, d)
                      guard !final.terminal, try FreedAccountProtectionCleanup.ownsRevokedNamespace(final, d) else { return }
                      let residual = observed.contains { request in
                        request.content.userInfo["kind"] as? String == "freed-pending-intervention"
                          && ((request.content.userInfo["shieldGeneration"] as? Int) == nil || request.content.userInfo["shieldGeneration"] as? Int == final.original.generation)
                      }
                      final.resources.notificationsUnverified = unknown || residual
                      final.runtimeScrubComplete = final.localRuntimeScrubComplete && final.processScrubResolved && !final.resources.notificationsUnverified
                      if final.runtimeScrubComplete && !final.coreInvalidationPending { final.phase = .completed; final.resources = .init(notificationsUnverified: false) }
                      try FreedAccountProtectionCleanup.replace(final, d)
                    }
                  }
                }
              }
            }
          }
          // Unknown legacy notices remain an explicit residual until a later reconciliation.
        }
      }
    }
    #endif
  }

  private func performSynchronousProtectionReset() -> [String: Any] {
    guard FreedAccountProtectionCleanup.legacyPrivateAllowed(sharedDefaults()) else { return ["errors": ["binding-v2-transport-required"], "nativePreferencesCleared": false] }
    do { try FreedAdultProtectionLegacyGate.requireUnenrolled() }
    catch { return ["errors": ["adult-lock-authorization-required"], "nativePreferencesCleared": false] }
    var errors = [String]()
    var preferencesCleared = false
    if FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: appGroupIdentifier) != nil {
      let defaults = sharedDefaults()
      // Commit disabled flags and empty targets before stopping monitors. An
      // already queued callback must see disabled native configuration.
      preferencesCleared = persistResetConfiguration(defaults)
    } else {
      errors.append("ios-reset-app-group-unavailable")
    }
    // Scrub legacy fallback storage as well, without clearing unrelated domains.
    if let standardDomain = Bundle.main.bundleIdentifier {
      preferencesCleared = FreedProtectionResetPolicy.persistEmptyConfiguration(in: .standard, domain: standardDomain) && preferencesCleared
    } else {
      preferencesCleared = false
    }
    if !preferencesCleared { errors.append("ios-reset-preferences-not-confirmed") }

    if #available(iOS 16.0, *) { FreedAppGroupsRuntime.reset(sharedDefaults()) }
    var monitorsStopped = false
    #if canImport(DeviceActivity)
    if #available(iOS 15.0, *) {
      let center = DeviceActivityCenter()
      let ownedNames = [riskWindowActivityName, appLimitActivityName, earnedUnlockActivityName].map { DeviceActivityName($0) }
        + center.activities.filter { $0.rawValue.hasPrefix(FreedAppGuardSchedulePolicy.activityPrefix) }
      center.stopMonitoring(ownedNames)
      monitorsStopped = !center.activities.contains { ownedNames.contains($0) }
    }
    #else
    monitorsStopped = true
    #endif
    if !monitorsStopped { errors.append("ios-reset-monitors-still-active") }

    var shieldsCleared = false
    #if canImport(ManagedSettings)
    if #available(iOS 15.0, *) {
      // The default store is scoped to this app and its extensions. Do not
      // clear other applications' stores or revoke FamilyControls permission.
      clearSelectedShields()
      store.webContent.blockedByFilter = nil
      shieldsCleared = store.shield.applications == nil && store.shield.applicationCategories == nil
        && store.shield.webDomains == nil && store.shield.webDomainCategories == nil
        && store.webContent.blockedByFilter == nil
    }
    #else
    shieldsCleared = true
    #endif
    if !shieldsCleared { errors.append("ios-reset-shields-not-confirmed") }

    var safariRulesRemoved = false
    var safariResetRulesConfirmed = false
    if let rulesURL = safariContentBlockerRulesURL() {
      do {
        if FileManager.default.fileExists(atPath: rulesURL.path) { try FileManager.default.removeItem(at: rulesURL) }
        safariRulesRemoved = !FileManager.default.fileExists(atPath: rulesURL.path)
        let resetRulesURL = rulesURL.deletingLastPathComponent().appendingPathComponent(safariContentBlockerResetRulesFileName)
        let inertData = Data(FreedProtectionResetPolicy.inertSafariRulesJSON.utf8)
        try inertData.write(to: resetRulesURL, options: .atomic)
        safariResetRulesConfirmed = try Data(contentsOf: resetRulesURL) == inertData
      } catch { errors.append("ios-reset-safari-rules-remove-failed") }
    }
    if !safariRulesRemoved && !errors.contains("ios-reset-safari-rules-remove-failed") {
      errors.append("ios-reset-safari-rules-remove-not-confirmed")
    }
    return ["errors": errors, "nativePreferencesCleared": preferencesCleared,
      "monitorsStopped": monitorsStopped, "shieldsCleared": shieldsCleared,
      "safariRulesRemoved": safariRulesRemoved, "safariResetRulesConfirmed": safariResetRulesConfirmed]
  }

  private func withProtectionConfigurationAccess(privateAdmission: Bool = false, _ body: () -> [String: Any]) -> [String: Any] {
    var generation: Int?
    do {
      var result = try FreedProtectionConfigurationLock.withExclusiveAccess { defaults in
        generation = FreedProtectionConfigurationLock.generation(defaults)
        if privateAdmission && !FreedAccountProtectionCleanup.legacyPrivateAllowed(defaults) { return ["accepted": false, "nativeConfigurationOperationAccepted": false, "nativeUnlockGrantAccepted": false, "reason": "binding-v2-transport-required"] }
        guard !resettingProtectionConfiguration else {
          return ["nativeConfigurationOperationAccepted": false, "nativeUnlockGrantAccepted": false,
            "nativeConfigurationError": "ios-reset-configuration-in-progress"]
        }
        return body()
      }
      if result["nativeConfigurationDiagnostics"] == nil { result["nativeConfigurationDiagnostics"] = FreedProtectionConfigurationLock.diagnostics(generation: generation) }
      return result
    } catch {
      let access = error as? FreedProtectionConfigurationLock.AccessError
      return ["nativeConfigurationOperationAccepted": false, "nativeUnlockGrantAccepted": false,
        "nativeConfigurationError": access.map { "ios-" + $0.reason } ?? "ios-native-configuration-operation-failed",
        "nativeConfigurationDiagnostics": FreedProtectionConfigurationLock.diagnostics(error, generation: generation)]
    }
  }

  private func withAdultProtectionConfigurationAccess(_ body: () -> [String: Any]) -> [String: Any] {
    do {
      return try FreedAdultProtectionLegacyGate.withWriter {
        self.withProtectionConfigurationAccess {
          do { try FreedProtectionConfigurationLock.fenceAdultMutations(self.sharedDefaults()) }
          catch { return FreedAdultProtectionLegacyGate.rejection(error) }
          return body()
        }
      }
    } catch { return FreedAdultProtectionLegacyGate.rejection(error) }
  }

  private func persistResetConfiguration(_ defaults: UserDefaults) -> Bool {
    guard FreedAccountProtectionCleanup.legacyPrivateAllowed(defaults) else { return false }
    do { try FreedAdultProtectionLegacyGate.requireUnenrolled() }
    catch { return false }
    pendingInterventionClaimLock.lock()
    defer { pendingInterventionClaimLock.unlock() }
    return FreedProtectionResetPolicy.persistEmptyConfiguration(in: defaults, domain: appGroupIdentifier)
  }

  private func removePendingShieldInterventionNotifications(before generation: Int) {
    #if canImport(UserNotifications)
    let center = UNUserNotificationCenter.current()
    center.getPendingNotificationRequests { requests in
      let obsoleteIDs = requests.filter { request in
        let info = request.content.userInfo
        guard info["kind"] as? String == "freed-pending-intervention" else { return false }
        // Legacy shield notices have no generation. Newer activation notices
        // must survive a delayed reset query from an older configuration.
        return (info["shieldGeneration"] as? Int).map { $0 < generation } ?? true
      }.map(\.identifier)
      center.removePendingNotificationRequests(withIdentifiers: obsoleteIDs)
      center.removeDeliveredNotifications(withIdentifiers: obsoleteIDs)
    }
    #endif
  }

  private func reloadSafariContentBlockerForReset(capturedEpoch: Int) async -> Bool {
    #if canImport(SafariServices)
    let outcome = await safariCallSettled { (done: @escaping (SafariReloadOutcome) -> Void) in
      do {
        try FreedProtectionConfigurationLock.withExclusiveAccess { defaults in
          guard try FreedProtectionConfigurationLock.adultMutationEpoch(defaults) == capturedEpoch else { throw FreedAdultLockIntegrationFailure.staleConfiguration }
          SFContentBlockerManager.reloadContentBlocker(withIdentifier: self.safariContentBlockerIdentifier) { error in done(.completed(error: error)) }
        }
      } catch { done(.completed(error: error)) }
    }
    if case .completed(let error) = outcome { return error == nil }
    return false
    #else
    return true
    #endif
  }

  private func safariContentBlockerEnabledForReset() async -> Bool? {
    #if canImport(SafariServices)
    let outcome = await safariCallWithTimeout(timeoutSeconds: Self.safariCallbackTimeoutSeconds) { (done: @escaping (SafariStateOutcome) -> Void) in
      SFContentBlockerManager.getStateOfContentBlocker(withIdentifier: self.safariContentBlockerIdentifier) { state, error in
        done(.completed(state: state, error: error))
      }
    }
    if case .completed(let state, let error) = outcome, error == nil, let state = state as? SFContentBlockerState {
      return state.isEnabled
    }
    #else
    return false
    #endif
    return nil
  }

  private func safariFocusShieldEnabledFact() async -> [String: Any] {
    #if os(iOS) && canImport(SafariServices)
    if #available(iOS 26.2, *) {
      let outcome = await safariCallWithTimeout(timeoutSeconds: Self.safariCallbackTimeoutSeconds) { (done: @escaping (SafariStateOutcome) -> Void) in
        SFSafariExtensionManager.getStateOfExtension(withIdentifier: self.safariFocusShieldIdentifier) { state, error in
          done(.completed(state: state, error: error))
        }
      }
      let checked = FreedSafariRecoveryObservation.iso(Date().timeIntervalSince1970 * 1000)
      if case .completed(let state, let error) = outcome {
        if error == nil, let state = state as? SFSafariExtensionState { return ["value": state.isEnabled, "checkedAt": checked, "reason": "observed"] }
        return ["value": NSNull(), "checkedAt": checked, "reason": "api-error"]
      }
      return ["value": NSNull(), "checkedAt": checked, "reason": "timeout"]
    }
    return ["value": NSNull(), "checkedAt": NSNull(), "reason": "unsupported-os"]
    #else
    return FreedSafariRecoveryObservation.unknownEnabled
    #endif
  }

  private func safariFocusShieldEnabledForReset() async -> Bool? {
    #if os(iOS) && canImport(SafariServices)
    if #available(iOS 26.2, *) {
      let outcome = await safariCallWithTimeout(timeoutSeconds: Self.safariCallbackTimeoutSeconds) { (done: @escaping (SafariStateOutcome) -> Void) in
        SFSafariExtensionManager.getStateOfExtension(withIdentifier: self.safariFocusShieldIdentifier) { state, error in
          done(.completed(state: state, error: error))
        }
      }
      if case .completed(let state, let error) = outcome, error == nil, let state = state as? SFSafariExtensionState {
        return state.isEnabled
      }
    }
    #endif
    return nil
  }

  // Requested intent drives publication; it is never an OS readback.
  private func isAdultFilterRequested() -> Bool {
    !sharedDefaults().bool(forKey: FreedProtectionResetPolicy.resetMarkerKey)
      && sharedDefaults().bool(forKey: adultFilterActiveKey)
  }

  private func isAdultWebPolicyConfigured() -> Bool {
    // Observe the OS even if intent storage is unavailable or reset cleanup
    // failed; requested/active remain separately fenced by durable state.
    #if canImport(ManagedSettings)
    if #available(iOS 15.0, *) {
      return store.webContent.blockedByFilter == .auto(Set<WebDomain>(), except: Set<WebDomain>())
    }
    #endif
    return false
  }

  private func isAdultFilterActive() -> Bool {
    isAdultFilterRequested() && isAdultWebPolicyConfigured()
  }

  private func isHostedRecoveryModeRetained() -> Bool {
    (try? FreedRetainedAdultProtection.read(sharedDefaults()).hostedRecoveryDns != nil) == true
  }

  private func applyAdultContentPolicy(protectedDataAvailable: Bool? = nil) -> [String: Any] {
    func admitted() -> [String: Any] {
    var reason: String?
    var accepted = false
    var stage = "lock"
    var generation: Int?
    var posixCode: Int32?
    var capturedNativeEpoch: Int?
    do {
      capturedNativeEpoch = try FreedProtectionConfigurationLock.withExclusiveAccess { try FreedProtectionConfigurationLock.fenceAdultMutations($0) }
      try FreedProtectionConfigurationLock.withExclusiveAccess { defaults in
        guard try FreedProtectionConfigurationLock.adultMutationEpoch(defaults) == capturedNativeEpoch else { throw FreedAdultLockIntegrationFailure.staleConfiguration }
        generation = FreedProtectionConfigurationLock.generation(defaults)
        guard !resettingProtectionConfiguration else {
          reason = "ios-reset-configuration-in-progress"
          return
        }
        #if canImport(ManagedSettings)
        if #available(iOS 15.0, *) {
          guard isAuthorized() else {
            reason = "ios-adult-policy-authorization-required"
            return
          }
          stage = "persist-intent"
          stage = "retained-policy-readback"
          try setAdultFilterActive(true)
          guard FreedProtectionConfigurationLock.persist(defaults), isAdultFilterRequested() else {
            reason = "ios-adult-policy-persistence-failed"
            return
          }
          stage = "publish-policy"
          applyWebContentFilterForCurrentState()
          applySelectedShieldsForCurrentState()
          stage = "read-policy"
          accepted = isAdultFilterActive()
          if !accepted { reason = "ios-adult-policy-not-observed" }
          return
        }
        #endif
        reason = "ios-adult-policy-unavailable"
      }
    } catch let error as FreedRetainedAdultProtection.Failure {
      accepted = false
      stage = error == .persistence ? "retained-policy-commit" : "retained-policy-read"
      reason = "ios-retained-adult-policy-not-acknowledged"
    } catch let error as FreedProtectionConfigurationLock.AccessError {
      accepted = false
      stage = error.stage
      posixCode = error.posixCode
      switch error {
      case .persistenceFailed, .stateWriteFailed, .stateReplaceFailed: reason = "ios-adult-policy-persistence-failed"
      case .stateUnreadable, .stateVersionUnsupported, .stateReadFailed: reason = "ios-" + error.reason
      case .containerUnavailable: reason = "ios-native-app-group-container-unavailable"
      case .timedOut: reason = "ios-native-configuration-lock-timeout"
      default: reason = "ios-native-configuration-lock-unavailable"
      }
    } catch {
      accepted = false
      reason = "ios-native-configuration-lock-unavailable"
    }
    // A reset or authorization change after publication cannot yield a
    // successful receipt paired with a missing policy observation.
    if accepted && (!isAuthorized() || !isAdultFilterActive()) {
      accepted = false
      reason = "ios-adult-policy-not-observed"
    }
    // Configuration observation is separate from actual browser enforcement.
    var payload = statusPayload(authorized: isAuthorized(), active: isAuthorized() && isAdultFilterActive(),
      scheduled: isRiskWindowMonitoringActive(), message: accepted
        ? "ManagedSettings automatic adult-content policy observed. Check actual browsing before relying on protection."
        : "The adult-content policy request was not accepted. Retry the indicated setup step.")
    payload["adultFilterRequested"] = isAdultFilterRequested()
    payload["adultWebPolicyConfigured"] = isAdultWebPolicyConfigured()
    payload["adultWebPolicyOperationAccepted"] = accepted
    payload["nativeConfigurationOperationAccepted"] = accepted
    payload["adultWebPolicyReason"] = reason.map { $0 as Any } ?? NSNull()
    payload["adultWebPolicyDiagnostics"] = ["stage": stage,
      "appGroupContainerAvailable": FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: appGroupIdentifier) != nil,
      "configurationGeneration": generation.map { $0 as Any } ?? NSNull(),
      "protectedDataAvailable": protectedDataAvailable.map { $0 as Any } ?? NSNull(),
      "posixErrorCode": posixCode.map { $0 as Any } ?? NSNull()]
    return payload
  
    }
    do { return try FreedAdultProtectionLegacyGate.withWriter { admitted() } }
    catch { return FreedAdultProtectionLegacyGate.rejection(error) }
  }

  private func setAdultFilterActive(_ active: Bool) throws {
    if !active { try FreedAdultProtectionLegacyGate.requireUnenrolled() }
    let defaults = sharedDefaults()
    let initial = active ? try FreedRetainedAdultProtection.initialBaselineForStrengthening(defaults) {
      try FreedAdultProtectionNativeObservation.capture(defaults)
    } : nil
    try FreedRetainedAdultProtection.update(defaults, observedInitialBaseline: initial) { $0.continuous = active }
    if active { defaults.set(false, forKey: FreedProtectionResetPolicy.resetMarkerKey) }
    defaults.set(active, forKey: adultFilterActiveKey)
    try FreedRetainedAdultProtection.acknowledged(defaults, expected: FreedRetainedAdultProtection.read(defaults))
  }

  private func isRiskWindowMonitoringActive() -> Bool {
    !sharedDefaults().bool(forKey: FreedProtectionResetPolicy.resetMarkerKey)
      && sharedDefaults().bool(forKey: riskWindowActiveKey)
  }

  private func setRiskWindowMonitoringActive(_ active: Bool) throws {
    if !active { try FreedAdultProtectionLegacyGate.requireUnenrolled() }
    let defaults = sharedDefaults()
    try FreedRetainedAdultProtection.update(defaults) { policy in
      policy.riskEnabled = active
      if !active { policy.riskStartMinute = nil; policy.riskEndMinute = nil }
    }
    defaults.set(active, forKey: riskWindowActiveKey)
    try FreedRetainedAdultProtection.acknowledged(defaults, expected: FreedRetainedAdultProtection.read(defaults))
  }

  private func installAcknowledgedNightGuard(startHour:Int,endHour:Int,startMinute:Int,endMinute:Int)->Bool {
    func admitted() -> Bool {
    lastNightGuardDiagnostics=["stage":"request-validation","reason":"night-guard-time-invalid"]
    guard (0...23).contains(startHour),(0...23).contains(endHour),(0...59).contains(startMinute),(0...59).contains(endMinute),startHour != endHour || startMinute != endMinute else{return false}
    #if canImport(DeviceActivity)
    if #available(iOS 16.0,*) {
      let center=DeviceActivityCenter(),activity=DeviceActivityName(riskWindowActivityName)
      let desired=DeviceActivitySchedule(intervalStart:DateComponents(hour:startHour,minute:startMinute),intervalEnd:DateComponents(hour:endHour,minute:endMinute),repeats:true)
      var previousSchedule:DeviceActivitySchedule?,previousEvents=[DeviceActivityEvent.Name:DeviceActivityEvent](),previousData:Data?,previousActive=false,capturedGeneration:Int?,attempted=false,ownedSchedule:DeviceActivitySchedule?,ownedData:Data?,ownedActive=false
      var stage="lock-acquire"
      var capturedNativeEpoch: Int?
      do {
        capturedNativeEpoch = try FreedProtectionConfigurationLock.withExclusiveAccess { try FreedProtectionConfigurationLock.fenceAdultMutations($0) }
        try FreedProtectionConfigurationLock.withExclusiveAccess { defaults in
        guard try FreedProtectionConfigurationLock.adultMutationEpoch(defaults) == capturedNativeEpoch else { throw FreedAdultLockIntegrationFailure.staleConfiguration }
          guard FreedProtectionConfigurationLock.permitsPublication(defaults) else {throw NSError(domain:"FreedNightGuard",code:1)}
          let initial = try FreedRetainedAdultProtection.initialBaselineForStrengthening(defaults) {
            try FreedAdultProtectionNativeObservation.capture(defaults)
          }
          let retained = try FreedRetainedAdultProtection.migrate(defaults, observedInitialBaseline: initial)
          let desiredStart = startHour * 60 + startMinute, desiredEnd = endHour * 60 + endMinute
          // Changed adult schedules are conservatively weakening until native
          // interval-superset classification is reviewed. Exact repair is allowed.
          if (retained.riskEnabled || center.schedule(for: activity) != nil) && (retained.riskStartMinute != desiredStart || retained.riskEndMinute != desiredEnd || center.schedule(for: activity) != desired) {
            try FreedAdultProtectionLegacyGate.requireUnenrolled()
          }
          capturedGeneration=FreedProtectionConfigurationLock.generation(defaults)
          previousSchedule=center.schedule(for:activity);previousEvents=center.events(for:activity);previousData=defaults.data(forKey:FreedNightGuardIntent.key);previousActive=defaults.bool(forKey:riskWindowActiveKey)
          attempted=true
          defer{ownedSchedule=center.schedule(for:activity);ownedData=defaults.data(forKey:FreedNightGuardIntent.key);ownedActive=defaults.bool(forKey:riskWindowActiveKey)}
          stage="monitor-registration"
          try center.startMonitoring(activity,during:desired)
          stage="monitor-readback"
          guard center.activities.contains(activity),center.schedule(for:activity)==desired,center.events(for:activity).isEmpty,FreedProtectionConfigurationLock.permitsPublication(defaults,capturedGeneration:capturedGeneration) else{throw NSError(domain:"FreedNightGuard",code:2)}
          let intent=FreedNightGuardIntent(version:1,generation:capturedGeneration!,startMinute:startHour*60+startMinute,endMinute:endHour*60+endMinute,repeats:true,operationID:UUID().uuidString.lowercased())
          let data=try JSONEncoder().encode(intent)
          stage="state-commit"
          try FreedRetainedAdultProtection.update(defaults) { policy in
            policy.riskEnabled = true; policy.riskStartMinute = intent.startMinute; policy.riskEndMinute = intent.endMinute
          }
          defaults.set(data,forKey:FreedNightGuardIntent.key);defaults.set(true,forKey:riskWindowActiveKey)
          guard FreedProtectionConfigurationLock.persist(defaults),defaults.data(forKey:FreedNightGuardIntent.key)==data,defaults.bool(forKey:riskWindowActiveKey) else{throw NSError(domain:"FreedNightGuard",code:3)}
        }
        lastNightGuardDiagnostics=FreedProtectionConfigurationLock.diagnostics(generation:capturedGeneration)
        return true
      } catch {
        lastNightGuardDiagnostics=FreedProtectionConfigurationLock.diagnostics(error,generation:capturedGeneration)
        if !(error is FreedProtectionConfigurationLock.AccessError) {lastNightGuardDiagnostics?["stage"]=stage;lastNightGuardDiagnostics?["reason"]="night-guard-operation-failed"}
        if attempted {
          _=try? FreedProtectionConfigurationLock.withExclusiveAccess { defaults in
            guard (try? FreedProtectionConfigurationLock.adultMutationEpoch(defaults)) == capturedNativeEpoch, FreedProtectionConfigurationLock.permitsPublication(defaults,capturedGeneration:capturedGeneration),defaults.data(forKey:FreedNightGuardIntent.key)==ownedData,defaults.bool(forKey:riskWindowActiveKey)==ownedActive,center.schedule(for:activity)==ownedSchedule else{return}
            try FreedAdultProtectionLegacyGate.requireUnenrolled()
            if let previousSchedule {try? center.startMonitoring(activity,during:previousSchedule,events:previousEvents)} else{center.stopMonitoring([activity])}
            defaults.set(previousData,forKey:FreedNightGuardIntent.key);defaults.set(previousActive,forKey:riskWindowActiveKey)
          }
        }
        return false
      }
    }
    #endif
    return false
  
    }
    do { return try FreedAdultProtectionLegacyGate.withWriter { admitted() } }
    catch { lastNightGuardDiagnostics = ["stage": "adult-writer-admission", "reason": "adult-writer-busy"]; return false }
  }

  private func hasAppGuardModes() -> Bool {
    #if canImport(DeviceActivity)
    if #available(iOS 16.0, *) {
      return hasFamilyControls() && hasManagedSettings()
        && Bundle.main.builtInPlugInsURL.map { FileManager.default.fileExists(atPath: $0.appendingPathComponent("FREEDDeviceActivityMonitor.appex").path) } == true
    }
    #endif
    return false
  }

  private func configuredAppGuardMode() -> FreedAppGuardMode {
    guard let value = sharedDefaults().string(forKey: appGuardModeKey) else { return .dailyLimit }
    // Corrupt persisted values never silently disable an installed guard.
    return FreedAppGuardMode(rawValue: value) ?? .beforeUse
  }

  private func configureAppGuardMode(_ rawMode: String) -> [String: Any] {
    let defaults = sharedDefaults()
    guard let mode = FreedAppGuardMode(rawValue: rawMode),
      !defaults.bool(forKey: FreedProtectionResetPolicy.resetMarkerKey) else {
      var payload = statusPayload(authorized: isAuthorized(), active: isAuthorized() && isAdultFilterActive(),
        scheduled: isRiskWindowMonitoringActive(), message: "App guard update was not accepted. Existing native protection remains installed.")
      payload["appGuardModeConfigurationAccepted"] = false
      payload["nativeConfigurationDiagnostics"] = ["stage":"request-validation","reason":"app-guard-mode-invalid-or-reset","errorCode":NSNull(),"errorDomain":NSNull()]
      return payload
    }
    let previous = defaults.object(forKey: appGuardModeKey)
    defaults.set(mode.rawValue, forKey: appGuardModeKey)
    do {
      try installConfiguredAppGuard()
      guard FreedProtectionConfigurationLock.persist(defaults), defaults.string(forKey: appGuardModeKey) == mode.rawValue else {
        throw makeFreedError("App guard mode persistence could not be confirmed.")
      }
    } catch {
      if let previous { defaults.set(previous, forKey: appGuardModeKey) }
      else { defaults.removeObject(forKey: appGuardModeKey) }
      _ = try? installConfiguredAppGuard()
      var payload = statusPayload(authorized: isAuthorized(), active: isAuthorized() && isAdultFilterActive(),
        scheduled: isRiskWindowMonitoringActive(), message: "App guard update failed. The previous configuration has been retained.")
      payload["appGuardModeConfigurationAccepted"] = false
      payload["nativeConfigurationDiagnostics"] = FreedProtectionConfigurationLock.diagnostics(error)
      return payload
    }
    var payload = statusPayload(authorized: isAuthorized(), active: isAuthorized() && isAdultFilterActive(),
      scheduled: isRiskWindowMonitoringActive(), message: "App guard configuration saved. Native readiness is reported separately.")
    payload["appGuardModeConfigurationAccepted"] = true
    return payload
  }

  private func installConfiguredAppGuard() throws {
    guard !sharedDefaults().bool(forKey: FreedProtectionResetPolicy.resetMarkerKey) else { return }
    #if canImport(FamilyControls) && canImport(DeviceActivity)
    if #available(iOS 16.0, *) {
      guard isAuthorized() else { return }
      let selection = loadFamilyActivitySelection()
      // Replace independent windows first. Failure must not stop a previously
      // installed daily rule while the caller is changing the base mode.
      if let configuration = configuredAppSchedules() {
        try installAppScheduleRegistrations(configuration)
      }
      switch configuredAppGuardMode() {
      case .dailyLimit:
        try scheduleSelectedAppLimitMonitoring(selection: selection, limitMinutes: configuredDailyLimitMinutes())
      case .beforeUse, .scheduled:
        stopSelectedAppLimitMonitoring()
      }
      applySelectedShieldsForCurrentState()
    }
    #endif
  }

  private func isIndependentAppGuardActive() -> Bool {
    (isRiskWindowMonitoringActive() && sharedDefaults().bool(forKey: riskWindowCurrentlyActiveKey))
      || isStrictAppGuardConfiguredForSelection() || !activeAppScheduleIDs().isEmpty
  }

  private func isStrictAppGuardConfiguredForSelection() -> Bool {
    guard !sharedDefaults().bool(forKey: FreedProtectionResetPolicy.resetMarkerKey), isAuthorized(),
      configuredAppSchedules()?.strictGuard == true else { return false }
    #if canImport(FamilyControls)
    if #available(iOS 16.0, *) { return !loadFamilyActivitySelection().applicationTokens.isEmpty }
    #endif
    return false
  }

  private func isStrictAppGuardActive() -> Bool {
    guard isStrictAppGuardConfiguredForSelection(), hasAppGuardModes() else { return false }
    #if canImport(ManagedSettings) && canImport(FamilyControls)
    if #available(iOS 16.0, *) {
      return (store.shield.applications ?? []) == loadFamilyActivitySelection().applicationTokens
    }
    #endif
    return false
  }

  private func shouldShieldLegacyTargets() -> Bool {
    (isRiskWindowMonitoringActive() && sharedDefaults().bool(forKey: riskWindowCurrentlyActiveKey))
      || (configuredAppGuardMode() == .dailyLimit && isAppLimitMonitoringActive() && isAppLimitReachedToday())
  }

  private func isAppGuardReady(readOnly: Bool = false) -> Bool {
    guard !sharedDefaults().bool(forKey: FreedProtectionResetPolicy.resetMarkerKey),
      isAuthorized(), hasAppGuardModes() else { return false }
    #if canImport(ManagedSettings) && canImport(FamilyControls) && canImport(DeviceActivity)
    if #available(iOS 16.0, *) {
      let selection = loadFamilyActivitySelection()
      guard !selection.applicationTokens.isEmpty else { return false }
      switch configuredAppGuardMode() {
      case .beforeUse:
        var expectedApplications = selection.applicationTokens
        if !isIndependentAppGuardActive(), activeEarnedUnlockExpiresAt(readOnly: readOnly) != nil,
          let scope = activeEarnedUnlockScope(), isSelectedScreenTimeScope(scope),
          let data = decodedScopeTokenData(scope), let token = try? JSONDecoder().decode(ApplicationToken.self, from: data) {
          expectedApplications.remove(token)
        }
        return (store.shield.applications ?? []) == expectedApplications
      case .dailyLimit:
        let center = DeviceActivityCenter()
        return isAppLimitMonitoringActive() && center.activities.contains(DeviceActivityName(appLimitActivityName))
          && center.events(for: DeviceActivityName(appLimitActivityName))[DeviceActivityEvent.Name(appLimitEventName)]
            == makeSelectedAppLimitEvent(selection: selection, limitMinutes: configuredDailyLimitMinutes())
      case .scheduled:
        return areAppScheduleRegistrationsReady()
          && (activeAppScheduleIDs().isEmpty || (store.shield.applications ?? []) == selection.applicationTokens)
      }
    }
    #endif
    return false
  }

  private func configuredAppSchedules() -> FreedAppGuardScheduleConfiguration? {
    FreedAppGuardSchedulePolicy.decode(sharedDefaults().data(forKey: FreedAppGuardSchedulePolicy.configurationKey))
  }

  private func configureAppSchedules(_ input: [String: Any]) -> [String: Any] {
    let defaults = sharedDefaults()
    guard !defaults.bool(forKey: FreedProtectionResetPolicy.resetMarkerKey),
      let requested = FreedAppGuardSchedulePolicy.decode(input) else {
      var payload = statusPayload(authorized: isAuthorized(), active: isAuthorized() && isAdultFilterActive(),
        scheduled: isRiskWindowMonitoringActive(), message: "Selected-app schedule update was rejected. The existing configuration remains installed.")
      payload["appSchedulesConfigurationAccepted"] = false
      payload["nativeConfigurationDiagnostics"] = ["stage":"request-validation","reason":"app-schedules-invalid-or-reset","errorCode":NSNull(),"errorDomain":NSNull()]
      return payload
    }
    let previousData = defaults.data(forKey: FreedAppGuardSchedulePolicy.configurationKey)
    let previous = FreedAppGuardSchedulePolicy.decode(previousData)
    let configuration = FreedAppGuardScheduleConfiguration(version: requested.version, targetScope: requested.targetScope,
      schedules: requested.schedules, strictGuard: requested.strictGuard ?? previous?.strictGuard ?? false)
    guard let data = try? JSONEncoder().encode(configuration) else {
      var payload = statusPayload(authorized: isAuthorized(), active: isAuthorized() && isAdultFilterActive(),
        scheduled: isRiskWindowMonitoringActive(), message: "Selected-app schedule configuration could not be encoded.")
      payload["appSchedulesConfigurationAccepted"] = false
      payload["nativeConfigurationDiagnostics"] = ["stage":"state-encode","reason":"app-schedules-encoding-failed","errorCode":NSNull(),"errorDomain":NSNull()]
      return payload
    }
    do {
      try installAppScheduleRegistrations(configuration)
      defaults.set(data, forKey: FreedAppGuardSchedulePolicy.configurationKey)
      guard FreedProtectionConfigurationLock.persist(defaults), defaults.data(forKey: FreedAppGuardSchedulePolicy.configurationKey) == data else {
        throw makeFreedError("Selected-app schedule persistence could not be confirmed.")
      }
      applySelectedShieldsForCurrentState()
    } catch {
      if let previousData { defaults.set(previousData, forKey: FreedAppGuardSchedulePolicy.configurationKey) }
      else { defaults.removeObject(forKey: FreedAppGuardSchedulePolicy.configurationKey) }
      _ = try? installAppScheduleRegistrations(FreedAppGuardSchedulePolicy.decode(previousData) ?? .init(version: 1, targetScope: "selected-applications", schedules: []))
      applySelectedShieldsForCurrentState()
      var payload = statusPayload(authorized: isAuthorized(), active: isAuthorized() && isAdultFilterActive(),
        scheduled: isRiskWindowMonitoringActive(), message: "Selected-app schedules could not be installed. The previous configuration has been retained.")
      payload["appSchedulesConfigurationAccepted"] = false
      payload["nativeConfigurationDiagnostics"] = FreedProtectionConfigurationLock.diagnostics(error)
      return payload
    }
    var payload = statusPayload(authorized: isAuthorized(), active: isAuthorized() && isAdultFilterActive(),
      scheduled: isRiskWindowMonitoringActive(), message: "Selected-app schedule configuration saved. Native registrations determine readiness.")
    payload["appSchedulesConfigurationAccepted"] = true
    return payload
  }

  private func installAppScheduleRegistrations(_ configuration: FreedAppGuardScheduleConfiguration) throws {
    guard !sharedDefaults().bool(forKey: FreedProtectionResetPolicy.resetMarkerKey) else {
      throw makeFreedError("Activate protection before installing selected-app schedules.")
    }
    #if canImport(DeviceActivity) && canImport(FamilyControls)
    if #available(iOS 16.0, *) {
      guard isAuthorized() else { return }
      let center = DeviceActivityCenter()
      let plans = loadFamilyActivitySelection().applicationTokens.isEmpty ? [] : FreedAppGuardSchedulePolicy.registrations(configuration)
      let owned = center.activities.filter { $0.rawValue.hasPrefix(FreedAppGuardSchedulePolicy.activityPrefix) }
      let requested = plans.map { DeviceActivityName($0.name) }
      guard Set(center.activities.filter { !owned.contains($0) } + requested).count <= FreedAppGuardSchedulePolicy.maximumActivities else {
        throw makeFreedError("The iOS DeviceActivity activity limit would be exceeded.")
      }
      let previous = owned.compactMap { name -> (DeviceActivityName, DeviceActivitySchedule)? in
        center.schedule(for: name).map { (name, $0) }
      }
      do {
        // Only this API's obsolete schedules are stopped. Shields remain in
        // place while registrations are replaced under the shared native lock.
        center.stopMonitoring(owned.filter { !requested.contains($0) })
        for plan in plans {
          let schedule = DeviceActivitySchedule(intervalStart: plan.intervalStart, intervalEnd: plan.intervalEnd, repeats: true)
          let name = DeviceActivityName(plan.name)
          if center.schedule(for: name) != schedule { try center.startMonitoring(name, during: schedule) }
          guard center.activities.contains(name), center.schedule(for: name) == schedule else {
            throw makeFreedError("DeviceActivity registration readback did not match the requested window.")
          }
        }
      } catch {
        let currentOwned = center.activities.filter { $0.rawValue.hasPrefix(FreedAppGuardSchedulePolicy.activityPrefix) }
        center.stopMonitoring(currentOwned)
        for (name, schedule) in previous { try? center.startMonitoring(name, during: schedule) }
        throw error
      }
      return
    }
    #endif
    throw makeFreedError("Selected-app DeviceActivity scheduling is unavailable in this build.")
  }

  private func areAppScheduleRegistrationsReady() -> Bool {
    guard !sharedDefaults().bool(forKey: FreedProtectionResetPolicy.resetMarkerKey), isAuthorized(), hasAppGuardModes(),
      let configuration = configuredAppSchedules() else { return false }
    #if canImport(DeviceActivity) && canImport(FamilyControls)
    if #available(iOS 16.0, *) {
      guard !loadFamilyActivitySelection().applicationTokens.isEmpty else { return false }
      let plans = FreedAppGuardSchedulePolicy.registrations(configuration)
      guard !plans.isEmpty else { return false }
      let center = DeviceActivityCenter()
      return plans.allSatisfy { plan in
        let name = DeviceActivityName(plan.name)
        return center.activities.contains(name)
          && center.schedule(for: name) == DeviceActivitySchedule(intervalStart: plan.intervalStart, intervalEnd: plan.intervalEnd, repeats: true)
      }
    }
    #endif
    return false
  }

  private func activeAppScheduleIDs() -> [String] {
    guard !sharedDefaults().bool(forKey: FreedProtectionResetPolicy.resetMarkerKey), isAuthorized(), hasAppGuardModes(),
      let configuration = configuredAppSchedules() else { return [] }
    #if canImport(DeviceActivity) && canImport(FamilyControls)
    if #available(iOS 16.0, *) {
      guard !loadFamilyActivitySelection().applicationTokens.isEmpty else { return [] }
      let center = DeviceActivityCenter()
      // A missing registration makes overall readiness false but cannot release
      // an unrelated window whose own native registrations remain installed.
      return FreedAppGuardSchedulePolicy.activeIDs(configuration).filter { id in
        let window = FreedAppGuardScheduleConfiguration(version: 1, targetScope: "selected-applications",
          schedules: configuration.schedules.filter { $0.id == id })
        let plans = FreedAppGuardSchedulePolicy.registrations(window)
        return !plans.isEmpty && plans.allSatisfy { plan in
          let name = DeviceActivityName(plan.name)
          return center.activities.contains(name)
            && center.schedule(for: name) == DeviceActivitySchedule(intervalStart: plan.intervalStart, intervalEnd: plan.intervalEnd, repeats: true)
        }
      }
    }
    #endif
    return []
  }

  private func isAppLimitMonitoringActive() -> Bool {
    !sharedDefaults().bool(forKey: FreedProtectionResetPolicy.resetMarkerKey)
      && sharedDefaults().bool(forKey: appLimitMonitoringActiveKey)
  }

  private func setAppLimitMonitoringActive(_ active: Bool) {
    sharedDefaults().set(active, forKey: appLimitMonitoringActiveKey)
  }

  private func sanitizeDailyLimitMinutes(_ value: Int?) -> Int {
    min(240, max(5, value ?? 20))
  }

  private func configuredDailyLimitMinutes() -> Int {
    let stored = sharedDefaults().integer(forKey: appLimitDailyMinutesKey)
    return sanitizeDailyLimitMinutes(stored > 0 ? stored : nil)
  }

  private func stopSelectedAppLimitMonitoring() {
    #if canImport(DeviceActivity)
    if #available(iOS 15.0, *) {
      DeviceActivityCenter().stopMonitoring([DeviceActivityName(appLimitActivityName)])
    }
    #endif
    setAppLimitMonitoringActive(false)
  }

  #if canImport(DeviceActivity) && canImport(FamilyControls)
  @available(iOS 15.0, *)
  private func makeSelectedAppLimitEvent(selection: FamilyActivitySelection, limitMinutes: Int) -> DeviceActivityEvent {
    let threshold = DateComponents(minute: sanitizeDailyLimitMinutes(limitMinutes))
    if #available(iOS 17.4, *) {
      return DeviceActivityEvent(
        applications: selection.applicationTokens,
        categories: selection.categoryTokens,
        webDomains: selection.webDomainTokens,
        threshold: threshold,
        includesPastActivity: true
      )
    }

    return DeviceActivityEvent(
      applications: selection.applicationTokens,
      categories: selection.categoryTokens,
      webDomains: selection.webDomainTokens,
      threshold: threshold
    )
  }

  @available(iOS 15.0, *)
  private func scheduleSelectedAppLimitMonitoring(selection: FamilyActivitySelection, limitMinutes: Int) throws {
    let selectedTargetCount = selection.applicationTokens.count + selection.categoryTokens.count + selection.webDomainTokens.count
    guard selectedTargetCount > 0 else {
      stopSelectedAppLimitMonitoring()
      return
    }

    let schedule = DeviceActivitySchedule(
      intervalStart: DateComponents(hour: 0, minute: 0),
      intervalEnd: DateComponents(hour: 23, minute: 59),
      repeats: true
    )
    let center = DeviceActivityCenter(), name = DeviceActivityName(appLimitActivityName)
    let eventName = DeviceActivityEvent.Name(appLimitEventName)
    let event = makeSelectedAppLimitEvent(selection: selection, limitMinutes: limitMinutes)
    let previous = center.schedule(for: name), previousEvents = center.events(for: name)
    do {
      if previous != schedule || previousEvents[eventName] != event {
        try center.startMonitoring(name, during: schedule, events: [eventName: event])
      }
      guard center.activities.contains(name), center.schedule(for: name) == schedule,
        center.events(for: name)[eventName] == event else {
        throw makeFreedError("Daily-limit registration readback did not match selected targets and threshold.")
      }
    } catch {
      center.stopMonitoring([name])
      if let previous { try? center.startMonitoring(name, during: previous, events: previousEvents) }
      setAppLimitMonitoringActive(previous != nil && center.schedule(for: name) == previous)
      throw error
    }
    setAppLimitMonitoringActive(true)
  }
  #endif

  private func clearEarnedUnlockState() {
    clearActiveEarnedUnlockState()
    pendingInterventionClaimLock.lock()
    sharedDefaults().removeObject(forKey: pendingEarnedUnlockScopeKey)
    pendingInterventionClaimLock.unlock()
  }

  private func clearActiveEarnedUnlockState() {
    let defaults = sharedDefaults()
    defaults.removeObject(forKey: earnedUnlockExpiresAtKey)
    defaults.removeObject(forKey: earnedUnlockSourceKey)
    defaults.removeObject(forKey: earnedUnlockScopeKey)
    defaults.removeObject(forKey: earnedUnlockInterventionIdKey)
  }

  private func invalidateActiveEarnedUnlockLease() {
    // Leave any newer staged intervention and every independent guard intact.
    _ = try? FreedProtectionConfigurationLock.withExclusiveAccess { _ in
      clearActiveEarnedUnlockState()
      stopEarnedUnlockMonitoring()
      // Revocation cannot consult the same expired persisted lease again.
      // A failed cleanup write still denies access and conservatively re-shields.
      applySelectedShieldsForCurrentState(allowEarnedUnlock: false)
    }
  }

  private func activeEarnedUnlockExpiresAt(readOnly: Bool = false) -> String? {
    return (try? FreedProtectionConfigurationLock.withExclusiveAccess(readOnly: readOnly) { _ -> String? in
      guard !sharedDefaults().bool(forKey: FreedProtectionResetPolicy.resetMarkerKey) else { return nil }
      let defaults = sharedDefaults()
      let storedSource = defaults.string(forKey: earnedUnlockSourceKey)
      let storedExpiresAt = defaults.string(forKey: earnedUnlockExpiresAtKey)
      guard storedSource != nil || storedExpiresAt != nil else { return nil }
      guard isScreenTimeUnlockSource(storedSource),
        sanitizedPendingInterventionId(defaults.string(forKey: earnedUnlockInterventionIdKey)) != nil,
        let scope = activeEarnedUnlockScope(), isSelectedScreenTimeScope(scope),
        let expiresAt = storedExpiresAt, let expiry = parseIsoDate(expiresAt), expiry > Date(),
        expiry == boundedEarnedUnlockExpiry(expiry), isEarnedUnlockMonitoringReady(expiresAt: expiry) else {
        if !readOnly { invalidateActiveEarnedUnlockLease() }
        return nil
      }
      return expiresAt
    }) ?? nil
  }

  private func isEarnedUnlockActive() -> Bool { activeEarnedUnlockExpiresAt() != nil }

  private func refreshEarnedUnlockWindow() {
    // The authoritative reader revokes and re-shields invalid leases. A getter
    // may reconcile current shields, but cannot install authority from history.
    guard isEarnedUnlockActive() else { return }
    applySelectedShieldsForCurrentState()
  }

  private func scheduleEarnedUnlockRelock(expiresAt: Date) {
    let delay = max(0, expiresAt.timeIntervalSinceNow)
    DispatchQueue.main.asyncAfter(deadline: .now() + delay) { [weak self] in
      guard let self else { return }
      _ = try? FreedProtectionConfigurationLock.withExclusiveAccess { _ in self.refreshEarnedUnlockWindow() }
    }
  }

  private func captureEarnedUnlockMonitoringSnapshot() -> EarnedUnlockMonitoringSnapshot? {
    guard let expiresAt = activeEarnedUnlockExpiresAt() else { return nil }
    #if canImport(DeviceActivity)
    if #available(iOS 15.0, *),
      let schedule = DeviceActivityCenter().schedule(for: DeviceActivityName(earnedUnlockActivityName)) {
      return EarnedUnlockMonitoringSnapshot(expiresAt: expiresAt, schedule: schedule)
    }
    #endif
    return nil
  }

  @discardableResult
  private func restoreEarnedUnlockMonitoring(_ previousLease: [String: Any], snapshot: EarnedUnlockMonitoringSnapshot?) -> Bool {
    guard let expiresAt = previousLease[earnedUnlockExpiresAtKey] as? String,
      let expiry = parseIsoDate(expiresAt), expiry > Date(),
      let snapshot, snapshot.expiresAt == expiresAt else {
      invalidateActiveEarnedUnlockLease()
      return false
    }
    #if canImport(DeviceActivity)
    if #available(iOS 15.0, *), let schedule = snapshot.schedule as? DeviceActivitySchedule {
      let center = DeviceActivityCenter(), name = DeviceActivityName(earnedUnlockActivityName)
      do {
        if center.schedule(for: name) != schedule { try center.startMonitoring(name, during: schedule) }
        guard isEarnedUnlockMonitoringReady(expiresAt: expiry) else { throw makeFreedError("Previous native relock restoration could not be confirmed.") }
        return true
      } catch {
        invalidateActiveEarnedUnlockLease()
        return false
      }
    }
    #endif
    invalidateActiveEarnedUnlockLease()
    return false
  }

  #if canImport(DeviceActivity)
  @available(iOS 15.0, *)
  private func earnedUnlockRelockSchedule(expiresAt: Date) -> DeviceActivitySchedule {
    // DeviceActivity's minimum interval is independent of the length of a
    // break. The owned relock activity STARTS at expiry and runs 16 minutes;
    // intervalDidStart restores protection without a short interval or an
    // early-warning timer. Full date components reject a next-day fallback.
    let plan = FreedAppGuardSchedulePolicy.relockRegistration(expiresAt: expiresAt)
    return DeviceActivitySchedule(intervalStart: plan.intervalStart, intervalEnd: plan.intervalEnd, repeats: false)
  }
  #endif

  private func isEarnedUnlockMonitoringReady(expiresAt: Date) -> Bool {
    #if canImport(DeviceActivity)
    if #available(iOS 15.0, *) {
      let center = DeviceActivityCenter(), name = DeviceActivityName(earnedUnlockActivityName)
      let expected = earnedUnlockRelockSchedule(expiresAt: expiresAt)
      guard center.activities.contains(name), center.schedule(for: name) == expected,
        let start = center.schedule(for: name)?.nextInterval?.start else { return false }
      return start == expiresAt
    }
    #endif
    return false
  }

  private func scheduleEarnedUnlockMonitoring(expiresAt: Date) -> Bool {
    guard !sharedDefaults().bool(forKey: FreedProtectionResetPolicy.resetMarkerKey), expiresAt > Date() else { return false }
    #if canImport(DeviceActivity)
    if #available(iOS 15.0, *) {
      let center = DeviceActivityCenter(), name = DeviceActivityName(earnedUnlockActivityName)
      let previous = center.schedule(for: name)
      do {
        let schedule = earnedUnlockRelockSchedule(expiresAt: expiresAt)
        if previous != schedule { try center.startMonitoring(name, during: schedule) }
        guard isEarnedUnlockMonitoringReady(expiresAt: expiresAt) else { throw makeFreedError("Native expiry relock readback did not match.") }
        return true
      } catch {
        center.stopMonitoring([name])
        if let previous { try? center.startMonitoring(name, during: previous) }
        return false
      }
    }
    #endif
    return false
  }

  private func stopEarnedUnlockMonitoring() {
    #if canImport(DeviceActivity)
    if #available(iOS 15.0, *) {
      DeviceActivityCenter().stopMonitoring([DeviceActivityName(earnedUnlockActivityName)])
    }
    #endif
  }

  private func boundedEarnedUnlockExpiry(_ expiry: Date, from now: Date = Date()) -> Date {
    let maxExpiry = now.addingTimeInterval(TimeInterval(maxEarnedUnlockMinutes * 60))
    return expiry > maxExpiry ? maxExpiry : expiry
  }

  private func isAppLimitReachedToday() -> Bool {
    appLimitReachedDate() == localDateKey()
  }

  private func appLimitReachedDate() -> String? {
    guard let reachedDate = sharedDefaults().string(forKey: appLimitReachedDateKey), !reachedDate.isEmpty else {
      return nil
    }

    return reachedDate
  }

  private func localDateKey() -> String {
    let formatter = DateFormatter()
    formatter.calendar = Calendar(identifier: .gregorian)
    formatter.locale = Locale(identifier: "en_US_POSIX")
    formatter.timeZone = TimeZone.current
    formatter.dateFormat = "yyyy-MM-dd"
    return formatter.string(from: Date())
  }

  private func formatIsoDate(_ date: Date) -> String {
    ISO8601DateFormatter().string(from: date)
  }

  private func parseIsoDate(_ value: String) -> Date? {
    let fractional = ISO8601DateFormatter()
    fractional.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
    if let date = fractional.date(from: value) {
      return date
    }

    return ISO8601DateFormatter().date(from: value)
  }

  private func isFreshPendingIntervention(_ detectedAt: String) -> Bool {
    guard let detectedDate = parseIsoDate(detectedAt) else {
      return false
    }

    let now = Date()
    return detectedDate.timeIntervalSince(now) <= pendingInterventionFutureSkewSeconds &&
      now.timeIntervalSince(detectedDate) <= pendingInterventionMaxAgeSeconds
  }

  @available(iOS 16.0, *)
  private func validWebsiteProbeScope(_ scope: InterventionScope, _ defaults: UserDefaults) -> Bool {
    guard scope.kind == "ios-token", scope.tokenType == "domain", scope.groupId == nil,
      let token = scope.token.flatMap({ Data(base64Encoded: $0) }) else { return false }
    return FreedWebsiteRecoveryProbe.validCallback(token: token, revision: scope.websiteProbeRevision,
      owner: scope.websiteProbeOwner, generation: scope.configurationGeneration, epoch: scope.scopeEpoch, defaults: defaults)
  }

  private func pendingInterventionRecord(defaults suppliedDefaults: UserDefaults? = nil) -> PendingInterventionRecord? {
    let defaults = suppliedDefaults ?? sharedDefaults()
    guard !defaults.bool(forKey: FreedProtectionResetPolicy.resetMarkerKey) else { return nil }
    guard let data = defaults.data(forKey: pendingInterventionRecordKey) else {
      return nil
    }
    return try? JSONDecoder().decode(PendingInterventionRecord.self, from: data)
  }

  private func claimPendingIntervention(_ expectedInterventionId: String, stageEarnedUnlockScope: Bool, defaults suppliedDefaults: UserDefaults? = nil) -> Bool {
    let defaults = suppliedDefaults ?? sharedDefaults()
    if suppliedDefaults != nil {
      guard pendingInterventionClaimLock.try() else { return false }
    } else { pendingInterventionClaimLock.lock() }
    defer { pendingInterventionClaimLock.unlock() }

    guard
      let record = pendingInterventionRecord(defaults: defaults),
      let currentInterventionId = sanitizedPendingInterventionId(record.id),
      currentInterventionId == expectedInterventionId,
      (!stageEarnedUnlockScope || isFreshPendingIntervention(record.detectedAt)),
      !isPendingInterventionConsumed(expectedInterventionId, defaults: defaults)
    else {
      return false
    }

    if let scope = record.scope, scope.websiteProbeRevision != nil {
      guard #available(iOS 16.0, *), FreedAppGroupsRuntime.shared.ownerVerified,
        validWebsiteProbeScope(scope, defaults) else { return false }
    }
    if let scope = record.scope, scope.groupId != nil, stageEarnedUnlockScope {
      guard #available(iOS 16.0, *), record.sourcePackage == screenTimeShieldSource,
        let data = try? JSONEncoder().encode(scope), let fields = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any],
        FreedAppGroupsRuntime.shared.stageClaim(id: expectedInterventionId, scope: fields, defaults) else { return false }
      markPendingInterventionConsumed(expectedInterventionId, defaults: defaults)
      defaults.removeObject(forKey: pendingEarnedUnlockScopeKey)
      return true
    }
    markPendingInterventionConsumed(expectedInterventionId, defaults: defaults)
    guard stageEarnedUnlockScope else { return true }

    if
      record.sourcePackage == screenTimeShieldSource,
      let scope = record.scope,
      isSelectedScreenTimeScope(scope)
    {
      let envelope = PendingEarnedUnlockEnvelope(interventionId: expectedInterventionId, scope: scope)
      if let encodedEnvelope = try? JSONEncoder().encode(envelope) {
        defaults.set(encodedEnvelope, forKey: pendingEarnedUnlockScopeKey)
      } else {
        defaults.removeObject(forKey: pendingEarnedUnlockScopeKey)
      }
    } else {
      defaults.removeObject(forKey: pendingEarnedUnlockScopeKey)
    }
    return true
  }

  private func markPendingInterventionConsumed(_ interventionId: String, defaults suppliedDefaults: UserDefaults? = nil) {
    let defaults = suppliedDefaults ?? sharedDefaults()
    let consumedIds = pendingInterventionConsumedIds(defaults: defaults)
      .filter { $0 != interventionId } + [interventionId]
    defaults.set(Array(consumedIds.suffix(maxPendingInterventionConsumedIds)), forKey: pendingInterventionConsumedIdsKey)
  }

  private func isPendingInterventionConsumed(_ interventionId: String, defaults suppliedDefaults: UserDefaults? = nil) -> Bool {
    let defaults = suppliedDefaults ?? sharedDefaults()
    return pendingInterventionConsumedIds(defaults: defaults).contains(interventionId)
  }

  private func pendingInterventionConsumedIds(defaults suppliedDefaults: UserDefaults? = nil) -> [String] {
    let defaults = suppliedDefaults ?? sharedDefaults()
    let storedIds = defaults.stringArray(forKey: pendingInterventionConsumedIdsKey) ?? []
    return storedIds.compactMap(sanitizedPendingInterventionId).suffix(maxPendingInterventionConsumedIds).map { $0 }
  }

  private func sanitizedPendingInterventionId(_ value: String?) -> String? {
    guard let normalized = value?.trimmingCharacters(in: .whitespacesAndNewlines).lowercased(), UUID(uuidString: normalized) != nil else {
      return nil
    }
    return normalized
  }

  private func scopePayload(_ scope: InterventionScope?) -> [String: Any]? {
    guard let scope else { return nil }
    if let groupId = scope.groupId {
      guard scope.kind == "ios-token", scope.tokenType == "application", let revision = scope.groupRevision,
        let generation = scope.configurationGeneration, let epoch = scope.scopeEpoch, revision > 0, generation >= 0, epoch >= 0 else { return nil }
      return ["kind": "ios-app-group", "tokenType": "application", "groupId": groupId, "groupRevision": revision, "configurationGeneration": generation, "scopeEpoch": epoch]
    }
    if
      scope.kind == "ios-token",
      let tokenType = scope.tokenType,
      ["application", "category", "domain"].contains(tokenType),
      let token = scope.token,
      token.count <= 8_192,
      Data(base64Encoded: token) != nil
    {
      return ["kind": "ios-screen-time", "tokenType": tokenType]
    }
    if
      scope.kind == "browser-domain",
      let domain = sanitizeHostForStorage(scope.domain)
    {
      return ["kind": "browser-domain", "domain": domain]
    }
    return nil
  }

  private func sanitizedPendingHost(_ values: String?...) -> String {
    for value in values {
      if let host = sanitizeHostForStorage(value) {
        return host
      }
    }

    return screenTimeShieldHost
  }

  private func isScreenTimeUnlockSource(_ sourceAttemptHost: String?) -> Bool {
    guard
      let trimmed = sourceAttemptHost?.trimmingCharacters(in: .whitespacesAndNewlines).lowercased(),
      !trimmed.isEmpty
    else {
      return false
    }

    if trimmed == screenTimeShieldSource {
      return true
    }

    return sanitizeHostForStorage(trimmed) == screenTimeShieldHost
  }

  private func sanitizeHostForStorage(_ value: String?) -> String? {
    guard var candidate = value?.trimmingCharacters(in: .whitespacesAndNewlines).lowercased(), !candidate.isEmpty else {
      return nil
    }

    if let schemeRange = candidate.range(of: "://") {
      candidate = String(candidate[schemeRange.upperBound...])
    }
    if let atIndex = candidate.lastIndex(of: "@") {
      candidate = String(candidate[candidate.index(after: atIndex)...])
    }
    if let cutIndex = candidate.firstIndex(where: { $0 == "/" || $0 == "?" || $0 == "#" }) {
      candidate = String(candidate[..<cutIndex])
    }
    if candidate.hasPrefix("[") {
      return nil
    }
    if let colonIndex = candidate.lastIndex(of: ":") {
      let suffix = candidate[candidate.index(after: colonIndex)...]
      guard !suffix.isEmpty, suffix.allSatisfy({ $0.wholeNumberValue != nil }) else {
        return nil
      }
      candidate = String(candidate[..<colonIndex])
    }
    while candidate.hasPrefix(".") {
      candidate.removeFirst()
    }
    while candidate.hasSuffix(".") {
      candidate.removeLast()
    }
    if candidate.hasPrefix("www.") {
      candidate.removeFirst(4)
    }

    guard !candidate.isEmpty, candidate.count <= 120, candidate.contains(".") else {
      return nil
    }

    let allowedCharacters = CharacterSet(charactersIn: "abcdefghijklmnopqrstuvwxyz0123456789.-")
    guard candidate.unicodeScalars.allSatisfy({ allowedCharacters.contains($0) }) else {
      return nil
    }

    let labels = candidate.split(separator: ".", omittingEmptySubsequences: false)
    guard labels.count >= 2, labels.allSatisfy(isValidHostLabel), (labels.last?.count ?? 0) >= 2 else {
      return nil
    }

    return candidate
  }

  private func isValidHostLabel(_ label: Substring) -> Bool {
    guard !label.isEmpty, label.count <= 63 else {
      return false
    }

    return label.first.map(String.init) != "-" && label.last.map(String.init) != "-"
  }

  private func sanitizedPendingSourcePackage(_ value: String?) -> String {
    guard let trimmed = value?.trimmingCharacters(in: .whitespacesAndNewlines).lowercased(), !trimmed.isEmpty else {
      return screenTimeShieldSource
    }

    let allowedCharacters = CharacterSet(charactersIn: "abcdefghijklmnopqrstuvwxyz0123456789._:-")
    guard trimmed.count <= 80, trimmed.unicodeScalars.allSatisfy({ allowedCharacters.contains($0) }) else {
      return screenTimeShieldSource
    }

    return trimmed
  }

  private func clearPendingInterventionDefaults() {
    sharedDefaults().removeObject(forKey: pendingInterventionRecordKey)
  }

  private func selectedApplicationCount() -> Int {
    sharedDefaults().bool(forKey: FreedProtectionResetPolicy.resetMarkerKey) ? 0 : sharedDefaults().integer(forKey: selectionAppCountKey)
  }

  private func selectedCategoryCount() -> Int {
    sharedDefaults().bool(forKey: FreedProtectionResetPolicy.resetMarkerKey) ? 0 : sharedDefaults().integer(forKey: selectionCategoryCountKey)
  }

  private func selectedWebDomainCount() -> Int {
    sharedDefaults().bool(forKey: FreedProtectionResetPolicy.resetMarkerKey) ? 0 : sharedDefaults().integer(forKey: selectionWebDomainCountKey)
  }

  #if canImport(FamilyControls)
  @available(iOS 15.0, *)
  private func loadFamilyActivitySelection() -> FamilyActivitySelection {
    guard
      let data = sharedDefaults().data(forKey: familyActivitySelectionKey),
      let selection = try? JSONDecoder().decode(FamilyActivitySelection.self, from: data)
    else {
      return FamilyActivitySelection()
    }

    return selection
  }

  @available(iOS 15.0, *)
  private func saveFamilyActivitySelection(_ selection: FamilyActivitySelection) -> Bool {
    let defaults = sharedDefaults()
    guard !defaults.bool(forKey: FreedProtectionResetPolicy.resetMarkerKey),
      let data = try? JSONEncoder().encode(selection) else { return false }
    let keys = [familyActivitySelectionKey, selectionAppCountKey, selectionCategoryCountKey, selectionWebDomainCountKey]
    var previous = [String: Any]()
    for key in keys { previous[key] = defaults.object(forKey: key) }
    defaults.set(data, forKey: familyActivitySelectionKey)
    defaults.set(selection.applicationTokens.count, forKey: selectionAppCountKey)
    defaults.set(selection.categoryTokens.count, forKey: selectionCategoryCountKey)
    defaults.set(selection.webDomainTokens.count, forKey: selectionWebDomainCountKey)
    guard FreedProtectionConfigurationLock.persist(defaults), defaults.data(forKey: familyActivitySelectionKey) == data,
      defaults.integer(forKey: selectionAppCountKey) == selection.applicationTokens.count,
      defaults.integer(forKey: selectionCategoryCountKey) == selection.categoryTokens.count,
      defaults.integer(forKey: selectionWebDomainCountKey) == selection.webDomainTokens.count else {
      for key in keys {
        if let value = previous[key] { defaults.set(value, forKey: key) }
        else { defaults.removeObject(forKey: key) }
      }
      _ = FreedProtectionConfigurationLock.persist(defaults)
      return false
    }
    return true
  }
  #endif

  @discardableResult
  private func applyWebContentFilterForCurrentState() -> Bool {
    #if canImport(ManagedSettings)
    if #available(iOS 15.0, *) {
      guard let policy = try? FreedRetainedAdultProtection.read(sharedDefaults()) else { return false }
      // Only the exact native mode operation can clear .auto. Background/startup
      // reconciliation preserves a stronger filter installed by a repair.
      if policy.hostedRecoveryDns != nil { return true }
      guard let requested = try? FreedRetainedAdultProtection.filterDecision(sharedDefaults()) else { return false }
      if requested {
        store.webContent.blockedByFilter = .auto(Set<WebDomain>(), except: Set<WebDomain>())
      } else {
        store.webContent.blockedByFilter = nil
      }
      return store.webContent.blockedByFilter == (requested ? .auto(Set<WebDomain>(), except: Set<WebDomain>()) : nil)
    }
    #endif
    return false
  }

  private func applySelectedShieldsForCurrentState(allowEarnedUnlock: Bool = true) {
    guard !sharedDefaults().bool(forKey: FreedProtectionResetPolicy.resetMarkerKey) else {
      clearSelectedShields()
      return
    }
    if isIndependentAppGuardActive() {
      applySelectedShieldsIfAvailable()
      return
    }
    let shouldShield = configuredAppGuardMode() == .beforeUse
      || (configuredAppGuardMode() == .dailyLimit && isAppLimitMonitoringActive() && isAppLimitReachedToday())
    guard shouldShield else { clearSelectedShields(); return }
    if allowEarnedUnlock, isEarnedUnlockActive(), let scope = activeEarnedUnlockScope() {
      applySelectedShieldsExcludingEarnedUnlockScope(scope)
      return
    }
    applySelectedShieldsIfAvailable()
  }

  private func applySelectedShieldsIfAvailable() {
    #if canImport(ManagedSettings) && canImport(FamilyControls)
    if #available(iOS 15.0, *) {
      let selection = loadFamilyActivitySelection()
      let adopted = { if #available(iOS 16.0, *) { return FreedAppGroupsRuntime.legacyAppsAdopted(self.sharedDefaults()) }; return false }()
      store.shield.applications = selection.applicationTokens.isEmpty || adopted && !isIndependentAppGuardActive() ? nil : selection.applicationTokens
      let legacyTargets = shouldShieldLegacyTargets()
      store.shield.applicationCategories = !legacyTargets || selection.categoryTokens.isEmpty ? nil : .specific(selection.categoryTokens)
      store.shield.webDomains = !legacyTargets || selection.webDomainTokens.isEmpty ? nil : selection.webDomainTokens
      store.shield.webDomainCategories = !legacyTargets || selection.categoryTokens.isEmpty ? nil : .specific(selection.categoryTokens)
    }
    #endif
  }

  private func consumePendingEarnedUnlockEnvelope(_ expectedInterventionId: String) -> PendingEarnedUnlockEnvelope? {
    pendingInterventionClaimLock.lock()
    defer { pendingInterventionClaimLock.unlock() }
    guard !sharedDefaults().bool(forKey: FreedProtectionResetPolicy.resetMarkerKey) else { return nil }

    guard
      let envelope = pendingEarnedUnlockEnvelope(),
      envelope.interventionId == expectedInterventionId,
      isSelectedScreenTimeScope(envelope.scope)
    else {
      return nil
    }

    sharedDefaults().removeObject(forKey: pendingEarnedUnlockScopeKey)
    return envelope
  }

  private func pendingEarnedUnlockEnvelope() -> PendingEarnedUnlockEnvelope? {
    guard
      let data = sharedDefaults().data(forKey: pendingEarnedUnlockScopeKey),
      let envelope = try? JSONDecoder().decode(PendingEarnedUnlockEnvelope.self, from: data),
      let interventionId = sanitizedPendingInterventionId(envelope.interventionId),
      interventionId == envelope.interventionId
    else {
      return nil
    }
    return envelope
  }

  private func activeEarnedUnlockScope() -> InterventionScope? {
    scopeStored(forKey: earnedUnlockScopeKey)
  }

  private func scopeStored(forKey key: String) -> InterventionScope? {
    guard let data = sharedDefaults().data(forKey: key) else { return nil }
    return try? JSONDecoder().decode(InterventionScope.self, from: data)
  }

  private func earnedUnlockMessage(for scope: InterventionScope) -> String {
    "Only the challenged Screen Time app is unlocked. Unrelated guards and adult web filtering stay active."
  }

  private func isSelectedScreenTimeScope(_ scope: InterventionScope) -> Bool {
    #if canImport(FamilyControls)
    if #available(iOS 15.0, *) {
      guard scope.kind == "ios-token", scope.tokenType == "application", scope.domain == nil,
        let token = decodedScopeTokenData(scope) else { return false }
      let selection = loadFamilyActivitySelection()
      return (try? JSONDecoder().decode(ApplicationToken.self, from: token)).map(selection.applicationTokens.contains) ?? false
    }
    #endif
    return false
  }

  private func decodedScopeTokenData(_ scope: InterventionScope) -> Data? {
    guard let encoded = scope.token, encoded.count <= 8_192 else { return nil }
    return Data(base64Encoded: encoded)
  }

  private func applySelectedShieldsExcludingEarnedUnlockScope(_ scope: InterventionScope) {
    #if canImport(ManagedSettings) && canImport(FamilyControls)
    if #available(iOS 15.0, *) {
      guard !sharedDefaults().bool(forKey: FreedProtectionResetPolicy.resetMarkerKey) else { clearSelectedShields(); return }
      guard !isIndependentAppGuardActive(), isSelectedScreenTimeScope(scope),
        let tokenData = decodedScopeTokenData(scope),
        let token = try? JSONDecoder().decode(ApplicationToken.self, from: tokenData) else {
        applySelectedShieldsIfAvailable()
        return
      }
      let selection = loadFamilyActivitySelection()
      let remainingApplications = selection.applicationTokens.subtracting([token])
      store.shield.applications = remainingApplications.isEmpty ? nil : remainingApplications
      // The only legacy category exception is this validated application token;
      // every other category member and every domain guard stays protected.
      let legacyTargets = shouldShieldLegacyTargets()
      store.shield.applicationCategories = !legacyTargets || selection.categoryTokens.isEmpty
        ? nil : .specific(selection.categoryTokens, except: Set<ApplicationToken>([token]))
      store.shield.webDomains = !legacyTargets || selection.webDomainTokens.isEmpty ? nil : selection.webDomainTokens
      store.shield.webDomainCategories = !legacyTargets || selection.categoryTokens.isEmpty ? nil : .specific(selection.categoryTokens)
    }
    #endif
  }

  private func clearSelectedShields() {
    #if canImport(ManagedSettings)
    if #available(iOS 15.0, *) {
      store.shield.applications = nil
      store.shield.applicationCategories = nil
      store.shield.webDomains = nil
      store.shield.webDomainCategories = nil
    }
    #endif
  }

  private func timeLabel(_ hour: Int, _ minute: Int) -> String {
    String(format: "%02d:%02d", hour, minute)
  }

  private func safariContentBlockerRulesURL() -> URL? {
    guard let container = FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: appGroupIdentifier) else {
      return nil
    }

    return container.appendingPathComponent(safariContentBlockerRulesFileName)
  }

  private func performLegacySafariConfiguration(rulesJson: String, version: String, checksum: String, generatedAt: String,
                                                authority: FreedAdultProtectionLegacyGate.LegacyAuthority, epoch: Int) async -> [String: Any] {
      if self.sharedDefaults().bool(forKey: FreedProtectionResetPolicy.resetMarkerKey) {
        return self.statusPayload(authorized: self.isAuthorized(), active: false, scheduled: false,
          message: "FREED protection was reset. Activate protection before syncing blocking rules.")
      }
      do {
        let ruleCount = try FreedAdultProtectionLegacyGate.withAuthority(authority) {
          try FreedProtectionConfigurationLock.withExclusiveAccess { defaults in
          guard try FreedProtectionConfigurationLock.adultMutationEpoch(defaults) == epoch else { throw FreedAdultLockIntegrationFailure.staleConfiguration }
          return try self.configureSafariContentBlockerRulesFile(
          rulesJson: rulesJson,
          version: version,
          checksum: checksum,
          generatedAt: generatedAt
        )
        }
        }
        guard await self.reloadSafariContentBlocker(capturedEpoch: epoch) else { throw FreedAdultLockIntegrationFailure.invalidReadback }
        await self.refreshSafariContentBlockerStateIfAvailable(authority: authority, capturedEpoch: epoch)
        guard try FreedProtectionConfigurationLock.withExclusiveAccess({ try FreedProtectionConfigurationLock.adultMutationEpoch($0) }) == epoch else { throw FreedAdultLockIntegrationFailure.staleConfiguration }
        return self.statusPayload(
          authorized: self.isAuthorized(),
          active: self.isAuthorized() && self.isAdultFilterActive(),
          scheduled: self.isRiskWindowMonitoringActive(),
          message: "Safari adult-domain blocker synced with \(ruleCount) entries. Short-form web paths are handled by Safari Focus Shield."
        )
      } catch {
        _ = try? FreedProtectionConfigurationLock.withExclusiveAccess { defaults in
          guard (try? FreedProtectionConfigurationLock.adultMutationEpoch(defaults)) == epoch, !defaults.bool(forKey: FreedProtectionResetPolicy.resetMarkerKey) else { return }
          defaults.set(error.localizedDescription, forKey: self.safariContentBlockerLastReloadErrorKey)
        }
        return self.statusPayload(
          authorized: self.isAuthorized(),
          active: self.isAuthorized() && self.isAdultFilterActive(),
          scheduled: self.isRiskWindowMonitoringActive(),
          message: "Safari Content Blocker rules could not be synced: \(error.localizedDescription)"
        )
      }
  }

  private func configureSafariContentBlockerRulesFile(
    rulesJson: String,
    version: String,
    checksum: String,
    generatedAt: String
  ) throws -> Int {
    // Validate bounded inputs before mutating either half of the publication.
    guard !version.isEmpty, version.utf8.count <= 256,
      !checksum.isEmpty, checksum.utf8.count <= 128,
      !generatedAt.isEmpty, generatedAt.utf8.count <= 128,
      rulesJson.utf8.count <= 16 * 1024 * 1024 else {
      throw makeFreedError("Safari Content Blocker metadata or payload exceeds its safety bounds.")
    }
    guard !sharedDefaults().bool(forKey: FreedProtectionResetPolicy.resetMarkerKey) else {
      // Feed synchronization is a background operation, not new protection
      // consent. Keep the deletion marker and inert extension payload intact.
      throw makeFreedError("FREED protection was reset. Activate protection before syncing blocking rules.")
    }
    let trimmed = rulesJson.trimmingCharacters(in: .whitespacesAndNewlines)
    guard !trimmed.isEmpty, let data = trimmed.data(using: .utf8) else {
      throw makeFreedError("Safari Content Blocker rules payload is empty.")
    }

    let parsed = try JSONSerialization.jsonObject(with: data)
    guard let rules = parsed as? [Any] else {
      throw makeFreedError("Safari Content Blocker rules payload must be a JSON array.")
    }
    guard !rules.isEmpty else {
      throw makeFreedError("Safari Content Blocker rules payload cannot be empty.")
    }
    guard rules.count <= 50_000 else {
      throw makeFreedError("Safari Content Blocker rules payload exceeds the 50,000 rule safety limit.")
    }
    try validateSafariContentBlockerRules(rules)
    let adultBlockingRules = rules.filter { !isSafariFocusShieldRule($0) }
    guard !adultBlockingRules.isEmpty else {
      throw makeFreedError("Safari Content Blocker requires at least one adult-domain rule.")
    }
    let adultRuleData = try JSONSerialization.data(withJSONObject: adultBlockingRules)
    guard adultRuleData.count <= 16 * 1024 * 1024 else {
      throw makeFreedError("Safari Content Blocker encoded rules exceed the publication limit.")
    }
    guard let rulesURL = safariContentBlockerRulesURL() else {
      throw makeFreedError("Shared app-group storage is unavailable for Safari Content Blocker rules.")
    }

    let initial = try FreedRetainedAdultProtection.initialBaselineForStrengthening(sharedDefaults()) {
      try FreedAdultProtectionNativeObservation.capture(sharedDefaults())
    }
    let retained = try FreedRetainedAdultProtection.migrate(sharedDefaults(), observedInitialBaseline: initial)
    if retained.safari || FileManager.default.fileExists(atPath: rulesURL.path) {
      // Exact rule-set superset is tightening; trigger changes/unknown previous
      // bytes are conservatively weakening. Caller checksum/version grants nothing.
      func identities(_ data: Data) throws -> Set<Data> {
        guard let items = try JSONSerialization.jsonObject(with: data) as? [Any] else { throw FreedRetainedAdultProtection.Failure.unreadable }
        return try Set(items.map { try JSONSerialization.data(withJSONObject: $0, options: [.sortedKeys]) })
      }
      let previous = try? Data(contentsOf: rulesURL)
      let before = previous.flatMap { try? identities($0) }
      let desired = try identities(adultRuleData)
      if before == nil || !before!.isSubset(of: desired) { try FreedAdultProtectionLegacyGate.requireUnenrolled() }
    }
    try FreedRetainedAdultProtection.update(sharedDefaults()) { $0.safari = true }

    try FileManager.default.createDirectory(at: rulesURL.deletingLastPathComponent(), withIntermediateDirectories: true)
    guard !sharedDefaults().bool(forKey: FreedProtectionResetPolicy.resetMarkerKey) else {
      throw makeFreedError("FREED protection was reset while blocking rules were being prepared.")
    }

    let defaults = sharedDefaults()
    defaults.set(version, forKey: safariContentBlockerVersionKey)
    defaults.set(checksum, forKey: safariContentBlockerChecksumKey)
    defaults.set(generatedAt, forKey: safariContentBlockerGeneratedAtKey)
    defaults.set(adultBlockingRules.count, forKey: safariContentBlockerRuleCountKey)
    defaults.removeObject(forKey: safariContentBlockerLastReloadErrorKey)

    if defaults.bool(forKey: FreedProtectionResetPolicy.resetMarkerKey) {
      // A background feed parse can finish after reset began. Remove only the
      // rules/metadata this operation wrote; never restore authority on failure.
      for key in [safariContentBlockerVersionKey, safariContentBlockerChecksumKey,
                  safariContentBlockerGeneratedAtKey, safariContentBlockerLastReloadErrorKey] {
        defaults.removeObject(forKey: key)
      }
      defaults.set(0, forKey: safariContentBlockerRuleCountKey)
      throw makeFreedError("FREED protection was reset while blocking rules were being saved.")
    }

    // The writer and reader use the same exclusion. Metadata rejection cannot
    // replace extension-readable bytes; file replacement failure lets the outer
    // transaction restore the exact previous metadata while atomic write keeps
    // the previous JSON. No fallible state mutation follows rule publication.
    guard FreedProtectionConfigurationLock.persist(defaults) else {
      throw FreedProtectionConfigurationLock.AccessError.persistenceFailed
    }
    #if os(iOS)
    let publicationOptions: Data.WritingOptions = [.atomic, .completeFileProtection]
    #else
    let publicationOptions: Data.WritingOptions = .atomic
    #endif
    try adultRuleData.write(to: rulesURL, options: publicationOptions)
    return adultBlockingRules.count
  }

  private func isSafariFocusShieldRule(_ item: Any) -> Bool {
    guard
      let rule = item as? [String: Any],
      let trigger = rule["trigger"] as? [String: Any],
      let filter = trigger["url-filter"] as? String
    else {
      return false
    }
    return filter.contains("youtube\\.com/shorts") ||
      filter.contains("youtube\\.com/feed/shorts") ||
      filter.contains("instagram\\.com/reel") ||
      filter.contains("tiktok\\.com/foryou")
  }

  private func validateSafariContentBlockerRules(_ rules: [Any]) throws {
    for (index, item) in rules.enumerated() {
      guard let rule = item as? [String: Any] else {
        throw makeFreedError("Safari Content Blocker rule \(index + 1) must be an object.")
      }
      guard
        let trigger = rule["trigger"] as? [String: Any],
        let urlFilter = trigger["url-filter"] as? String,
        !urlFilter.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
      else {
        throw makeFreedError("Safari Content Blocker rule \(index + 1) is missing a url-filter.")
      }
      guard
        let action = rule["action"] as? [String: Any],
        let actionType = action["type"] as? String,
        actionType == "block"
      else {
        throw makeFreedError("Safari Content Blocker rule \(index + 1) must use a block action.")
      }
    }
  }

  // Races a SafariServices callback against a deadline so an Apple API that never
  // invokes its completion cannot wedge getStatus()/apply calls forever.
  // Serialize API entry on MainActor: concurrent startup/status callers can
  // otherwise race SafariServices' shared XPC connection initialization.
  @MainActor
  private func safariCallWithTimeout<T>(
    timeoutSeconds: Double,
    _ run: (@escaping (T) -> Void) -> Void
  ) async -> T? {
    await withCheckedContinuation { (continuation: CheckedContinuation<T?, Never>) in
      let lock = NSLock()
      var finished = false
      let complete: (T?) -> Void = { value in
        lock.lock()
        let shouldResume = !finished
        finished = true
        lock.unlock()
        if shouldResume {
          continuation.resume(returning: value)
        }
      }
      DispatchQueue.global().asyncAfter(deadline: .now() + timeoutSeconds) {
        complete(nil)
      }
      run { value in
        complete(value)
      }
    }
  }

  @MainActor
  private func safariCallSettled<T>(_ run: (@escaping (T) -> Void) -> Void) async -> T {
    await withCheckedContinuation { continuation in
      let lock = NSLock(); var finished = false
      run { value in
        lock.lock(); let resume = !finished; finished = true; lock.unlock()
        if resume { continuation.resume(returning: value) }
      }
    }
  }

  private enum SafariReloadOutcome {
    case completed(error: Error?)
    case timedOut
  }

  private enum SafariStateOutcome {
    case completed(state: Any?, error: Error?)
    case timedOut
  }

  private static let safariCallbackTimeoutSeconds: Double = 8.0

  private func reloadSafariContentBlocker(capturedEpoch: Int) async -> Bool {
    #if canImport(SafariServices)
    let outcome = await safariCallSettled { (done: @escaping (SafariReloadOutcome) -> Void) in
      do {
        try FreedProtectionConfigurationLock.withExclusiveAccess { defaults in
          guard try FreedProtectionConfigurationLock.adultMutationEpoch(defaults) == capturedEpoch else { throw FreedAdultLockIntegrationFailure.staleConfiguration }
          SFContentBlockerManager.reloadContentBlocker(withIdentifier: self.safariContentBlockerIdentifier) { error in done(.completed(error: error)) }
        }
      } catch { done(.completed(error: error)) }
    }
    let acknowledged = (try? FreedProtectionConfigurationLock.withExclusiveAccess { defaults in
      guard (try? FreedProtectionConfigurationLock.adultMutationEpoch(defaults)) == capturedEpoch, !defaults.bool(forKey: FreedProtectionResetPolicy.resetMarkerKey) else { return false }
      switch outcome {
      case .completed(let error):
        if let error = error {
          defaults.set(error.localizedDescription, forKey: self.safariContentBlockerLastReloadErrorKey)
        } else {
          defaults.removeObject(forKey: self.safariContentBlockerLastReloadErrorKey)
        }
      case .timedOut:
        defaults.set("Safari Content Blocker reload timed out.", forKey: self.safariContentBlockerLastReloadErrorKey)
      }
      return true
    }) == true
    guard acknowledged else { return false }
    if case .completed(let error) = outcome { return error == nil }
    #endif
    return false
  }

  private func refreshSafariContentBlockerStateIfAvailable(authority: FreedAdultProtectionLegacyGate.LegacyAuthority? = nil, capturedEpoch: Int? = nil) async {
    let acquired: FreedAdultProtectionLegacyGate.WriterLease?
    do {
      if let authority { try FreedAdultProtectionLegacyGate.requireCurrent(authority.lease); acquired = nil }
      else { acquired = try FreedAdultProtectionLegacyGate.acquireWriter() }
    } catch { return }
    defer { if let acquired { FreedAdultProtectionLegacyGate.releaseWriter(acquired) } }
    // Configuration-owned refresh must carry its original epoch. A standalone
    // read captures its own generation/epoch before suspension. Neither a lease
    // nor a successful OS callback overrides a newer owner's metadata.
    guard authority == nil || capturedEpoch != nil else { return }
    let observed: (generation: Int, epoch: Int)
    do {
      observed = try FreedProtectionConfigurationLock.withExclusiveAccess { defaults in
        let epoch = try FreedProtectionConfigurationLock.adultMutationEpoch(defaults)
        guard capturedEpoch == nil || capturedEpoch == epoch else { throw FreedAdultLockIntegrationFailure.staleConfiguration }
        return (FreedProtectionConfigurationLock.generation(defaults), epoch)
      }
    } catch { return }
    func publish(_ body: (UserDefaults) -> Void) {
      _ = try? FreedProtectionConfigurationLock.withExclusiveAccess { defaults in
        guard FreedProtectionConfigurationLock.generation(defaults) == observed.generation,
          (try? FreedProtectionConfigurationLock.adultMutationEpoch(defaults)) == observed.epoch,
          !defaults.bool(forKey: FreedProtectionResetPolicy.resetMarkerKey) else { return }
        body(defaults)
      }
    }
    #if canImport(SafariServices)
    guard #available(iOS 10.0, *) else {
      publish { defaults in
        defaults.set(false, forKey: safariContentBlockerStateKnownKey)
        defaults.set("Safari Content Blocker state requires iOS 10+.", forKey: safariContentBlockerStateErrorKey)
      }
      return
    }

    let outcome = await safariCallWithTimeout(timeoutSeconds: Self.safariCallbackTimeoutSeconds) { (done: @escaping (SafariStateOutcome) -> Void) in
      SFContentBlockerManager.getStateOfContentBlocker(withIdentifier: self.safariContentBlockerIdentifier) { state, error in
        done(.completed(state: state, error: error))
      }
    } ?? .timedOut
    publish { defaults in
      defaults.set(self.formatIsoDate(Date()), forKey: self.safariContentBlockerStateCheckedAtKey)
      switch outcome {
      case .completed(let state, let error):
        if let error = error {
          defaults.set(false, forKey: self.safariContentBlockerStateKnownKey)
          defaults.set(false, forKey: self.safariContentBlockerEnabledKey)
          defaults.set(error.localizedDescription, forKey: self.safariContentBlockerStateErrorKey)
        } else if let state = state as? SFContentBlockerState {
          defaults.set(true, forKey: self.safariContentBlockerStateKnownKey)
          defaults.set(state.isEnabled, forKey: self.safariContentBlockerEnabledKey)
          defaults.removeObject(forKey: self.safariContentBlockerStateErrorKey)
        } else {
          defaults.set(false, forKey: self.safariContentBlockerStateKnownKey)
          defaults.set(false, forKey: self.safariContentBlockerEnabledKey)
          defaults.set("Safari Content Blocker state was unavailable.", forKey: self.safariContentBlockerStateErrorKey)
        }
      case .timedOut:
        defaults.set(false, forKey: self.safariContentBlockerStateKnownKey)
        defaults.set(false, forKey: self.safariContentBlockerEnabledKey)
        defaults.set("Safari Content Blocker state check timed out.", forKey: self.safariContentBlockerStateErrorKey)
      }
    }
    #else
    publish { defaults in
      defaults.set(false, forKey: safariContentBlockerStateKnownKey)
      defaults.set(false, forKey: safariContentBlockerEnabledKey)
      defaults.set("SafariServices is unavailable in this build.", forKey: safariContentBlockerStateErrorKey)
    }
    #endif
  }

  private func makeFreedError(_ message: String) -> NSError {
    NSError(domain: "FreedProtection", code: 1, userInfo: [NSLocalizedDescriptionKey: message])
  }

  private func activationDiagnosticsPayload(
    adultHostInput: String,
    normalHostInput: String,
    requireReviewedAdultFeed: Bool
  ) -> [String: Any] {
    let adultHost = sanitizedActivationHost(adultHostInput, fallback: "pornhub.com")
    let normalHost = sanitizedActivationHost(normalHostInput, fallback: "www.khanacademy.org")
    let authorized = isAuthorized()
    let activeFilter = authorized && isAdultFilterActive()
    let selectedTargetCount = selectedApplicationCount() + selectedCategoryCount() + selectedWebDomainCount()
    let appLimitScheduled = isAppLimitMonitoringActive()
    let safariRuleCount = sharedDefaults().bool(forKey: FreedProtectionResetPolicy.resetMarkerKey)
      ? 0 : sharedDefaults().integer(forKey: safariContentBlockerRuleCountKey)
    let safariVersion = sharedDefaults().string(forKey: safariContentBlockerVersionKey) ?? ""
    let safariStateKnown = sharedDefaults().bool(forKey: safariContentBlockerStateKnownKey)
    let safariEnabled = safariStateKnown && sharedDefaults().bool(forKey: safariContentBlockerEnabledKey)
    let safariStateError = sharedDefaults().string(forKey: safariContentBlockerStateErrorKey) ?? ""
    let adultBlocked = safariContentBlockerRulesMatch(host: adultHost)
    let normalAllowed = !safariContentBlockerRulesMatch(host: normalHost)
    var issues: [String] = []
    var issueCodes: [String] = []

    if !authorized {
      issues.append("Screen Time authorization is not approved.")
      issueCodes.append("ios-screen-time-authorization-missing")
    }
    if !activeFilter {
      issues.append("ManagedSettings adult web filter is not active.")
      issueCodes.append("ios-adult-filter-inactive")
    }
    if selectedTargetCount <= 0 {
      issues.append("No Screen Time app, category, or web-domain targets are selected.")
      issueCodes.append("ios-screen-time-targets-missing")
    }
    if !appLimitScheduled {
      issues.append("Selected app daily-limit DeviceActivity monitor is not scheduled.")
      issueCodes.append("ios-device-activity-monitor-missing")
    }
    if safariRuleCount <= 0 {
      issues.append("Safari Content Blocker rules are not synced.")
      issueCodes.append("ios-safari-rules-missing")
    }
    if !safariEnabled {
      issues.append(safariStateError.isEmpty ? "FREED Safari Content Blocker is not enabled in Safari settings." : "Safari Content Blocker state needs attention: \(safariStateError)")
      issueCodes.append("ios-safari-extension-disabled")
    }
    if requireReviewedAdultFeed && !isReviewedFeedVersion(safariVersion) {
      issues.append("Safari Content Blocker rules are still embedded fallback, not reviewed remote provenance.")
      issueCodes.append("ios-safari-feed-not-reviewed")
    }
    if !adultBlocked {
      issues.append("Safari adult-domain smoke host did not match a block rule.")
      issueCodes.append("ios-adult-smoke-not-blocked")
    }
    if !normalAllowed {
      issues.append("Safari normal-site smoke host matched a block rule.")
      issueCodes.append("ios-normal-smoke-blocked")
    }

    let passed = issues.isEmpty
    return [
      "platform": "ios",
      "checkedNativeLayer": true,
      "nativeChecksPassed": passed,
      "adultBlocked": adultBlocked,
      "normalAllowed": normalAllowed,
      "message": passed
        ? "iOS native activation diagnostics passed for Screen Time, ManagedSettings, DeviceActivity, selected targets, and Safari domain rules."
        : "iOS native activation diagnostics need attention.",
      "issues": issues,
      "issueCodes": issueCodes,
      "adultMatchedRule": adultBlocked ? "safari-content-blocker" : "safari-content-blocker-miss",
      "normalMatchedRule": normalAllowed ? "safari-content-blocker-allow" : "safari-content-blocker-overblock",
      "appInterventionAuthorized": authorized,
      "blockedApplications": selectedTargetCount,
      "safariContentBlockerVersion": safariVersion,
      "safariContentBlockerRuleCount": safariRuleCount,
      "safariContentBlockerEnabled": safariEnabled,
      "safariContentBlockerStateError": safariStateError
    ]
  }

  private func safariContentBlockerRulesMatch(host: String) -> Bool {
    guard
      let rulesURL = safariContentBlockerRulesURL(),
      let data = try? Data(contentsOf: rulesURL),
      let rules = try? JSONSerialization.jsonObject(with: data) as? [[String: Any]]
    else {
      return false
    }

    let smokeURL = "https://\(host)/"
    let range = NSRange(location: 0, length: (smokeURL as NSString).length)
    for rule in rules {
      guard
        let trigger = rule["trigger"] as? [String: Any],
        let urlFilter = trigger["url-filter"] as? String,
        let action = rule["action"] as? [String: Any],
        let actionType = action["type"] as? String,
        actionType == "block",
        let regex = try? NSRegularExpression(pattern: urlFilter)
      else {
        continue
      }
      if regex.firstMatch(in: smokeURL, range: range) != nil {
        return true
      }
    }

    return false
  }

  private func sanitizedActivationHost(_ input: String, fallback: String) -> String {
    let trimmed = input.trimmingCharacters(in: .whitespacesAndNewlines)
    let withScheme = trimmed.range(of: "^[a-z][a-z0-9+.-]*://", options: [.regularExpression, .caseInsensitive]) == nil
      ? "https://\(trimmed)"
      : trimmed
    let parsedHost = URL(string: withScheme)?.host ?? trimmed
    let host = parsedHost
      .lowercased()
      .replacingOccurrences(of: #"^www\."#, with: "", options: .regularExpression)
      .components(separatedBy: CharacterSet(charactersIn: "/?#@:"))
      .first?
      .trimmingCharacters(in: CharacterSet(charactersIn: "."))
      .prefix(120)
    let normalized = String(host ?? "")
      .filter { character in
        character.isLetter || character.isNumber || character == "." || character == "-"
      }
    return isAllowedActivationHost(normalized) ? normalized : fallback
  }

  private func isAllowedActivationHost(_ host: String) -> Bool {
    guard host.contains("."), host.count <= 253 else {
      return false
    }
    guard host.range(of: #"^[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?$"#, options: .regularExpression) != nil else {
      return false
    }
    return host.split(separator: ".").allSatisfy { label in
      !label.isEmpty && label.count <= 63 && !label.hasPrefix("-") && !label.hasSuffix("-")
    }
  }

  private func isReviewedFeedVersion(_ version: String?) -> Bool {
    let value = version?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
    return !value.isEmpty && !value.hasPrefix("freed-embedded-")
  }

  private func statusReadFailure(_ reason: String) -> [String: Any] {
    ["statusReadAccepted": false, "statusReadError": reason]
  }

  private func readStatusV2(_ session: FreedAccountBindingSession, _ actionScope: String) async -> [String: Any] {
    guard #available(iOS 16.0, *) else { return statusReadFailure("native-status-v2-unavailable") }
    do {
      let captured = try FreedAppGroupsRuntime.shared.withStatusScope(session.state, actionScope) { _, binding in binding }
      // The OS callback owns no AppGroup/lifecycle lock and writes no metadata.
      let safari = await readSafariStatusFields()
      return try FreedAppGroupsRuntime.shared.withStatusScope(session.state, actionScope) { _, binding in
        guard NSDictionary(dictionary: captured).isEqual(to: binding) else { throw FreedAccountProtectionCleanup.Failure.staleBinding }
        let authorized = self.isAuthorized()
        var payload = self.statusPayload(authorized: authorized, active: authorized && self.isAdultFilterActive(),
          scheduled: authorized && self.isRiskWindowMonitoringActive(), message: "Screen Time protection status observed.", readOnly: true)
        // Cached Safari facts may belong to an older configuration. Publish only
        // this operation's OS observation, without persisting a read's result.
        for key in ["safariContentBlockerEnabled", "safariContentBlockerStateCheckedAt", "safariContentBlockerStateError"] { payload.removeValue(forKey: key) }
        payload.merge(safari) { _, current in current }
        payload["statusVersion"] = 2; payload["statusReadAccepted"] = true
        payload["statusVisibility"] = "account"; payload["statusBinding"] = binding
        return payload
      }
    } catch {
      return statusReadFailure(error is FreedProtectionConfigurationLock.AccessError ? "native-status-unavailable" : "native-status-binding-stale")
    }
  }

  private func readDevicePublicStatus() async -> [String: Any] {
    let safari = await readSafariStatusFields()
    do {
      return try FreedProtectionConfigurationLock.withReadOnlyAccess { _ in self.publicStatusPayload(safari) }
    } catch { return statusReadFailure("native-status-unavailable") }
  }

  // Device protection is retained across sign-out. This explicit projection must
  // never call the private status builder or publish app selections/leases.
  private func publicStatusPayload(_ safari: [String: Any]) -> [String: Any] {
    let authorized = isAuthorized(), configured = isAdultWebPolicyConfigured(), requested = isAdultFilterRequested()
    let hosted = isHostedRecoveryModeRetained()
    var payload: [String: Any] = ["statusVersion": 2, "statusReadAccepted": true, "statusVisibility": "device",
      "authorized": authorized, "active": authorized && requested && configured,
      "adultFilterActive": authorized && requested && configured, "adultFilterRequested": requested,
      "adultWebPolicyConfigured": configured,
      "hostedModeRetained": hosted, "adultProtectionMode": hosted ? "hosted-recovery-dns" : "apple-auto",
      "adultWebPolicyReason": requested && !configured ? (hosted ? "ios-hosted-recovery-mode-retained" : "ios-adult-policy-not-observed") as Any : NSNull(),
      "safariExtensionSettingsAvailable": supportsSafariExtensionSettings(), "mode": "screen-time",
      "message": "Device website protection status observed."]
    payload.merge(safari) { _, current in current }
    return payload
  }

  private func readSafariStatusFields() async -> [String: Any] {
    #if canImport(SafariServices)
    if #available(iOS 10.0, *) {
      let outcome = await safariCallWithTimeout(timeoutSeconds: Self.safariCallbackTimeoutSeconds) { (done: @escaping (SafariStateOutcome) -> Void) in
        SFContentBlockerManager.getStateOfContentBlocker(withIdentifier: self.safariContentBlockerIdentifier) { state, error in
          done(.completed(state: state, error: error))
        }
      } ?? .timedOut
      var fields: [String: Any] = ["safariContentBlockerStateCheckedAt": formatIsoDate(Date())]
      switch outcome {
      case .completed(let state, let error):
        if error == nil, let state = state as? SFContentBlockerState { fields["safariContentBlockerEnabled"] = state.isEnabled }
        else { fields["safariContentBlockerStateError"] = "Safari Content Blocker state was unavailable." }
      case .timedOut: fields["safariContentBlockerStateError"] = "Safari Content Blocker state check timed out."
      }
      return fields
    }
    #endif
    return ["safariContentBlockerStateError": "SafariServices is unavailable in this build."]
  }

  private func authorizationOutcomePayload(_ status: [String: Any], outcome: String, error: Error? = nil) -> [String: Any] {
    var payload = status
    payload["authorized"] = isAuthorized()
    payload["authorizationOutcome"] = outcome
    payload["message"] = "Screen Time authorization request completed."
    if let native = error as NSError? {
      let allowed = native.domain == "FamilyControls.FamilyControlsError" && (0...8).contains(native.code)
        || native.domain == NSCocoaErrorDomain && native.code == NSUserCancelledError
        || native.domain == NSOSStatusErrorDomain && native.code == -128
      if allowed { payload["authorizationErrorDomain"] = native.domain; payload["authorizationErrorCode"] = native.code }
    }
    return payload
  }

  private func statusPayload(authorized: Bool, active: Bool, scheduled: Bool = false, message: String, readOnly: Bool = false) -> [String: Any] {
    let hosted = isHostedRecoveryModeRetained()
    let selectedApplicationCountValue = selectedApplicationCount()
    let selectedCategoryCountValue = selectedCategoryCount()
    let selectedWebDomainCountValue = selectedWebDomainCount()
    let selectedScreenTimeTokenCount = selectedApplicationCountValue + selectedCategoryCountValue + selectedWebDomainCountValue
    let activeUnlockExpiresAt = activeEarnedUnlockExpiresAt(readOnly: readOnly)
    let appLimitReachedDateValue = appLimitReachedDate()
    var payload: [String: Any] = [
      "authorized": authorized,
      "protectionConfigurationResetDisabled": sharedDefaults().bool(forKey: FreedProtectionResetPolicy.resetMarkerKey),
      "active": active,
      "scheduled": scheduled,
      "selectedApplications": selectedApplicationCountValue,
      "selectedCategories": selectedCategoryCountValue,
      "selectedWebDomains": selectedWebDomainCountValue,
      "selectedScreenTimeTokenCount": selectedScreenTimeTokenCount,
      "adultFilterActive": active,
      "adultFilterRequested": isAdultFilterRequested(),
      "adultWebPolicyConfigured": isAdultWebPolicyConfigured(),
      "hostedModeRetained": hosted,
      "adultProtectionMode": hosted ? "hosted-recovery-dns" : "apple-auto",
      "adultWebPolicyReason": isAdultFilterRequested() && !isAdultWebPolicyConfigured()
        ? (hosted ? "ios-hosted-recovery-mode-retained" : "ios-adult-policy-not-observed") as Any : NSNull(),
      "adultFilterStaysActiveDuringEarnedUnlock": activeUnlockExpiresAt != nil && active,
      "appInterventionAuthorized": authorized,
      "appGuardMode": configuredAppGuardMode().rawValue,
      "appGuardReady": isAppGuardReady(readOnly: readOnly),
      "appSchedulesSupported": hasAppGuardModes(),
      "appSchedulesConfigured": configuredAppSchedules()?.schedules.contains(where: \.enabled) == true || configuredAppSchedules()?.strictGuard == true,
      "appSchedulesServiceConnected": areAppScheduleRegistrationsReady() || isStrictAppGuardActive(),
      "strictAppGuardEnabled": configuredAppSchedules()?.strictGuard == true,
      "strictAppGuardActive": isStrictAppGuardActive(),
      "activeAppScheduleIds": activeAppScheduleIDs(),
      "activeAppSchedulePackageCount": activeAppScheduleIDs().isEmpty ? 0 : selectedApplicationCountValue,
      "appLimitScheduled": isAppLimitMonitoringActive(),
      "appLimitActivityName": appLimitActivityName,
      "appLimitEventName": appLimitEventName,
      "earnedUnlockActivityName": earnedUnlockActivityName,
      "appLimitReachedToday": appLimitReachedDateValue == localDateKey(),
      "dailyLimitMinutes": configuredDailyLimitMinutes(),
      "safariExtensionSettingsAvailable": supportsSafariExtensionSettings(),
      "mode": "screen-time",
      "message": message
    ]
    if let configuration = configuredAppSchedules(), areAppScheduleRegistrationsReady(),
      let boundary = FreedAppGuardSchedulePolicy.nextBoundary(configuration) {
      payload["nextAppScheduleBoundaryAt"] = formatIsoDate(boundary)
    }
    if let appLimitReachedDateValue = appLimitReachedDateValue {
      payload["appLimitReachedDate"] = appLimitReachedDateValue
    }
    if let activeUnlockExpiresAt = activeUnlockExpiresAt {
      let effectiveBreak = !isIndependentAppGuardActive() && activeEarnedUnlockScope() != nil
      payload["selectedShieldsPausedForEarnedUnlock"] = effectiveBreak
      // Keep the bounded lease private while an independent guard suppresses
      // it. Presentation must never promise access to a currently shielded app.
      if effectiveBreak {
        payload["activeUnlockExpiresAt"] = activeUnlockExpiresAt
        if authorized, let interventionId = sanitizedPendingInterventionId(sharedDefaults().string(forKey: earnedUnlockInterventionIdKey)) {
          payload["activeUnlockInterventionId"] = interventionId
        }
      }
    }
    if #available(iOS 16.0, *), let groupBreak = FreedAppGroupsRuntime.shared.effectiveStatus(readOnly: readOnly) {
      if groupBreak["appGroupBreakEffective"] as? Bool != true { payload.removeValue(forKey: "activeUnlockExpiresAt"); payload.removeValue(forKey: "activeUnlockInterventionId") }
      for (key, value) in groupBreak { payload[key] = value }
    }
    if let version = sharedDefaults().string(forKey: safariContentBlockerVersionKey) {
      payload["safariContentBlockerVersion"] = version
    }
    if let checksum = sharedDefaults().string(forKey: safariContentBlockerChecksumKey) {
      payload["safariContentBlockerChecksum"] = checksum
    }
    let safariRuleCount = sharedDefaults().bool(forKey: FreedProtectionResetPolicy.resetMarkerKey)
      ? 0 : sharedDefaults().integer(forKey: safariContentBlockerRuleCountKey)
    if safariRuleCount > 0 {
      payload["safariContentBlockerRuleCount"] = safariRuleCount
    }
    if sharedDefaults().bool(forKey: safariContentBlockerStateKnownKey) {
      payload["safariContentBlockerEnabled"] = sharedDefaults().bool(forKey: safariContentBlockerEnabledKey)
    }
    if let stateCheckedAt = sharedDefaults().string(forKey: safariContentBlockerStateCheckedAtKey) {
      payload["safariContentBlockerStateCheckedAt"] = stateCheckedAt
    }
    if let stateError = sharedDefaults().string(forKey: safariContentBlockerStateErrorKey) {
      payload["safariContentBlockerStateError"] = stateError
    }
    if let reloadError = sharedDefaults().string(forKey: safariContentBlockerLastReloadErrorKey) {
      payload["safariContentBlockerLastReloadError"] = reloadError
    }
    return payload
  }


}

// MARK: - Safari settings routing

private struct FreedSafariSettingsRouteResult: Sendable {
  let opened: Bool
  let route: String
  let directSettingsAvailable: Bool
  let error: String?
}

private enum FreedSafariSettingsRouter {
  @MainActor
  static func open(
    directSettingsAvailable: Bool,
    isForeground: Bool,
    openExtensionSettings: () async throws -> Void,
    openAppSettings: () async -> Bool
  ) async -> FreedSafariSettingsRouteResult {
    guard isForeground else {
      return FreedSafariSettingsRouteResult(
        opened: false, route: "none", directSettingsAvailable: directSettingsAvailable,
        error: "Return to FREED before opening Safari settings."
      )
    }
    var directError: String?
    if directSettingsAvailable {
      do {
        try await openExtensionSettings()
        return FreedSafariSettingsRouteResult(
          opened: true, route: "extension", directSettingsAvailable: true, error: nil
        )
      } catch {
        directError = error.localizedDescription
      }
    }
    let fallbackOpened = await openAppSettings()
    return FreedSafariSettingsRouteResult(
      opened: fallbackOpened, route: fallbackOpened ? "app-settings" : "none",
      directSettingsAvailable: directSettingsAvailable,
      error: fallbackOpened ? directError : directError ?? "FREED app settings could not open."
    )
  }
}

// MARK: - Family activity picker

#if canImport(FamilyControls) && canImport(SwiftUI)
@available(iOS 16.0, *)
private struct FreedFamilyActivityPickerView: View {
  @State private var selection: FamilyActivitySelection
  let onCancel: () -> Void
  let onDone: (FamilyActivitySelection) -> Void

  init(
    initialSelection: FamilyActivitySelection,
    onCancel: @escaping () -> Void,
    onDone: @escaping (FamilyActivitySelection) -> Void
  ) {
    self._selection = State(initialValue: initialSelection)
    self.onCancel = onCancel
    self.onDone = onDone
  }

  var body: some View {
    NavigationStack {
      FamilyActivityPicker(
        headerText: "Choose apps, categories, or web domains FREED should protect during high-risk moments.",
        footerText: "Normal browsing stays available. FREED uses this selection only for Screen Time protection.",
        selection: $selection
      )
      .navigationTitle("FREED Protection")
      .toolbar {
        ToolbarItem(placement: .cancellationAction) {
          Button("Cancel", action: onCancel)
        }
        ToolbarItem(placement: .confirmationAction) {
          Button("Done") {
            onDone(selection)
          }
        }
      }
    }
  }
}
#endif
