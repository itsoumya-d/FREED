import Foundation

// Extension-safe identity only. No credential, endpoint URL, owner, question or
// proof is shared. This receipt cannot mint a native mutation permit.
struct FreedRecoveryDnsProfileIdentity: Codable, Equatable {
  let reference: String
  let credentialHash: String
  let profileHash: String
  let nativeConfigurationGeneration: Int
  var valid: Bool {
    func hex(_ value: String, _ count: Int) -> Bool {
      value.utf8.count == count && value.utf8.allSatisfy { (48...57).contains($0) || (97...102).contains($0) }
    }
    return hex(reference, 32) && hex(credentialHash, 64) && hex(profileHash, 64)
      && nativeConfigurationGeneration >= 0 && nativeConfigurationGeneration < 9_007_199_254_740_991
  }
}

// Device-scoped, non-secret intent. This is not an OS enforcement or lock receipt.
// Extensions never read the host Keychain or any credential material.
enum FreedRetainedAdultProtection {
  static let key = "freed.deviceAdult.policy.v1"
  enum Failure: Error, Equatable { case unreadable, persistence, ownerMismatch, baselineUnknown }
  struct Policy: Codable, Equatable {
    var version = 1
    var revision = 1
    var continuous: Bool
    var encryptedDNS: Bool
    var safari: Bool
    var riskEnabled: Bool
    var riskStartMinute: Int?
    var riskEndMinute: Int?
    var hostedRecoveryDns: FreedRecoveryDnsProfileIdentity? = nil
    var valid: Bool {
      version == 1 && revision > 0 && revision < 9_007_199_254_740_991
        && (riskStartMinute.map { (0..<1440).contains($0) } ?? true)
        && (riskEndMinute.map { (0..<1440).contains($0) } ?? true)
        && ((riskStartMinute == nil) == (riskEndMinute == nil))
        && (hostedRecoveryDns.map { $0.valid && continuous && encryptedDNS } ?? true)
    }
  }
  static func read(_ defaults: UserDefaults) throws -> Policy {
    guard !defaults.bool(forKey: "freed.deviceAdult.storageUnavailable") else { throw Failure.unreadable }
    if let value = defaults.object(forKey: key) {
      guard let data = value as? Data, data.count <= 4096,
        let policy = try? JSONDecoder().decode(Policy.self, from: data), policy.valid else { throw Failure.unreadable }
      return policy
    }
    let reset = defaults.bool(forKey: FreedProtectionConfigurationLock.resetMarkerKey)
    let risk = defaults.data(forKey: "freed.riskWindow.expected.v1")
      .flatMap { try? JSONSerialization.jsonObject(with: $0) as? [String: Any] }
    let start = risk?["startMinute"] as? Int, end = risk?["endMinute"] as? Int
    let bounded = start.map { (0..<1440).contains($0) } == true && end.map { (0..<1440).contains($0) } == true
    // Absence is not an acknowledged empty policy. Only usable positive legacy
    // filtering intent can migrate itself; a first-install/empty baseline must
    // be supplied explicitly from native observation by the strengthening path.
    let adultIntent = defaults.object(forKey: "freed.adultFilterActive") as? Bool
    let riskIntent = defaults.object(forKey: "freed.riskWindowActive") as? Bool
    guard !reset, adultIntent == true || (adultIntent == false && riskIntent == true && bounded) else { throw Failure.baselineUnknown }
    return Policy(continuous: !reset && defaults.bool(forKey: "freed.adultFilterActive"),
      encryptedDNS: defaults.bool(forKey: "freed.encryptedDns.cloudflareFamilies.configured"),
      safari: !reset && defaults.integer(forKey: "freed.safariContentBlocker.ruleCount") > 0,
      riskEnabled: !reset && defaults.bool(forKey: "freed.riskWindowActive"),
      riskStartMinute: bounded ? start : nil, riskEndMinute: bounded ? end : nil)
  }
  // Call inside the existing cross-process configuration transaction. Its atomic
  // file publication and rollback protect both migration and subsequent updates.
  @discardableResult static func migrate(_ defaults: UserDefaults, observedInitialBaseline: Policy? = nil) throws -> Policy {
    let policy: Policy
    do { policy = try read(defaults) }
    catch Failure.baselineUnknown {
      guard let baseline = observedInitialBaseline, baseline.valid else { throw Failure.baselineUnknown }
      policy = baseline
    }
    if defaults.object(forKey: key) == nil { try stage(policy, defaults) }
    return policy
  }
  static func stage(_ policy: Policy, _ defaults: UserDefaults) throws {
    guard policy.valid else { throw Failure.unreadable }
    let encoder = JSONEncoder(); encoder.outputFormatting = [.sortedKeys]
    let data = try encoder.encode(policy)
    defaults.set(data, forKey: key)
    guard defaults.data(forKey: key) == data else { throw Failure.persistence }
  }
  static func update(_ defaults: UserDefaults, observedInitialBaseline: Policy? = nil, _ body: (inout Policy) -> Void) throws {
    var policy = try migrate(defaults, observedInitialBaseline: observedInitialBaseline); let old = policy
    body(&policy)
    if policy != old { policy.revision += 1; try stage(policy, defaults) }
  }
  static func initialBaselineForStrengthening(_ defaults: UserDefaults, observe: () throws -> Policy) throws -> Policy? {
    do { _ = try read(defaults); return nil }
    catch Failure.baselineUnknown { return try observe() }
  }
  static func failureReceipt(_ error: Error) -> [String: Any] {
    let failure = error as? Failure
    let stage = failure == .persistence ? "retained-policy-commit" : "retained-policy-read"
    let reason = failure == .baselineUnknown ? "retained-adult-baseline-unknown" : "retained-adult-policy-not-acknowledged"
    return ["nativeConfigurationOperationAccepted": false, "adultWebPolicyOperationAccepted": false,
      "nightGuardOperationAccepted": false, "nativeConfigurationError": reason,
      "nativeConfigurationDiagnostics": ["stage": stage, "reason": reason]]
  }
  static func acknowledged(_ defaults: UserDefaults, expected: Policy) throws {
    guard FreedProtectionConfigurationLock.persist(defaults), try read(defaults) == expected else { throw Failure.persistence }
  }
  static func shouldFilter(_ defaults: UserDefaults, at date: Date = Date(), calendar: Calendar = .current) -> Bool {
    // An unreadable retained projection cannot authorize removal of an installed filter.
    (try? filterDecision(defaults, at: date, calendar: calendar)) ?? true
  }
  // Unknown preserves the currently installed OS value; consumers must not
  // translate a missing baseline into either clearing or a new installation.
  static func filterDecision(_ defaults: UserDefaults, at date: Date = Date(), calendar: Calendar = .current) throws -> Bool {
    let policy = try read(defaults)
    if policy.hostedRecoveryDns != nil { return false }
    if policy.continuous { return true }
    guard policy.riskEnabled else { return false }
    guard let start = policy.riskStartMinute, let end = policy.riskEndMinute, start != end else { return true }
    let minute = calendar.component(.hour, from: date) * 60 + calendar.component(.minute, from: date)
    return start < end ? (start..<end).contains(minute) : minute >= start || minute < end
  }
  static func retainsSafari(_ defaults: UserDefaults) -> Bool {
    (try? read(defaults).safari) ?? true
  }
  struct OwnerFence: Codable, Equatable {
    let ownerDigest: String
    let generation: Int
    let scopeEpoch: Int
  }
  static func privateNamespace(_ key: String) -> Bool {
    ["freed.appGroups.", "freed.appGuard.", "freed.appLimit.", "freed.earnedUnlock.",
     "freed.pendingIntervention.", "freed.selection."].contains(where: key.hasPrefix)
      || key == "freed.familyActivitySelection"
  }
  static func erasePrivateNamespaces(_ defaults: UserDefaults) {
    for key in FreedProtectionConfigurationLock.configurationKeys(defaults) where privateNamespace(key) { defaults.removeObject(forKey: key) }
  }
  static func privateNamespacesAbsent(_ defaults: UserDefaults) -> Bool {
    !FreedProtectionConfigurationLock.configurationKeys(defaults).contains(where: privateNamespace)
  }
  // A delayed erasure cannot clear the new owner's app authority. The native
  // caller supplies this fence from its acknowledged bound app-group state.
  static func stagePrivateCleanup(_ defaults: UserDefaults, expected: OwnerFence, domain: String = FreedProtectionConfigurationLock.appGroupIdentifier) throws -> Policy {
    guard let data = defaults.data(forKey: "freed.appGroups.v1"),
      let state = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any],
      state["ownerDigest"] as? String == expected.ownerDigest, !expected.ownerDigest.isEmpty,
      state["generation"] as? Int == expected.generation,
      state["scopeEpoch"] as? Int == expected.scopeEpoch,
      FreedProtectionConfigurationLock.generation(defaults) == expected.generation else { throw Failure.ownerMismatch }
    let retained = try migrate(defaults)
    let values = defaults.persistentDomain(forName: domain) ?? [:]
    for key in values.keys where ["freed.appGroups.", "freed.appGuard.", "freed.appLimit.",
      "freed.earnedUnlock.", "freed.pendingIntervention.", "freed.selection."].contains(where: key.hasPrefix)
      || key == "freed.familyActivitySelection" { defaults.removeObject(forKey: key) }
    defaults.set(expected.generation + 1, forKey: FreedProtectionConfigurationLock.generationKey)
    // Fence old app/short-form publications, while retained adult consumers are independent.
    defaults.set(true, forKey: FreedProtectionConfigurationLock.resetMarkerKey)
    try acknowledged(defaults, expected: retained)
    return retained
  }
}

extension FreedRetainedAdultProtection {
  // Independent of app reset: the adult extension may consume this publication
  // before reload completes. Missing/corrupt metadata never selects inert bytes.
  struct SafariPublication: Codable, Equatable {
    static let key = "freed.deviceAdult.safariPublication.v1"
    static let fileName = "safari-content-blocker-adult-disabled.json"
    static let inert = Data(#"[{"trigger":{"url-filter":".*"},"action":{"type":"ignore-previous-rules"}}]"#.utf8)
    var version = 1
    let generation: Int
    let nativeEpoch: Int
    let payloadHash: String
    var reloadAcknowledged: Bool
    static func read(_ defaults: UserDefaults) throws -> Self? {
      guard let raw = defaults.object(forKey: key) else { return nil }
      guard let data = raw as? Data, data.count <= 2048,
        let value = try? JSONDecoder().decode(Self.self, from: data), value.version == 1,
        value.generation > 0, value.generation < 9_007_199_254_740_991,
        value.nativeEpoch >= 0, value.payloadHash.count == 64 else { throw Failure.unreadable }
      return value
    }
    func stage(_ defaults: UserDefaults) throws {
      let encoder = JSONEncoder(); encoder.outputFormatting = [.sortedKeys]
      let data = try encoder.encode(self); defaults.set(data, forKey: Self.key)
      guard try Self.read(defaults) == self else { throw Failure.persistence }
    }
  }
}
