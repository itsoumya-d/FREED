import Foundation
import CryptoKit

// No secret, URL or DNS question is represented by an operation/readback DTO.
struct FreedRecoveryDnsActivationProof: Codable, Equatable {
  let receiptID: String
  let profile: FreedRecoveryDnsProfileIdentity
  let networkEpoch: Int
  let processID: String
  var valid: Bool { FriendLockReceipt.hex(receiptID, 32) && profile.valid && networkEpoch >= 0 && UUID(uuidString: processID) != nil }
}

// This descriptor is host-only. The system profile URL is reconstructed ONLY
// from the separately protected credential, never serialized into operation bytes.
struct FreedRecoveryDnsCandidate: Codable, Equatable {
  static let endpointHost = "freedrecovery.web.app"
  let reference: String
  let credentialHash: String
  let audience: String
  let ownerGeneration: String
  let installationId: String
  let ownerDigest: String
  let bindingID: String
  let nativeScope: FreedAdultNativeScope
  let bootstrapServers: [String]
  var profileHash: String {
    let descriptor = [Self.endpointHost, credentialHash, audience, ownerGeneration, installationId,
      String(nativeScope.generation), bootstrapServers.sorted().joined(separator: ","),
      "matchDomains=empty-domain|noSearch=true|onDemand=empty|allowFailover=false-when-supported"].joined(separator: "|")
    return SHA256.hash(data: Data(descriptor.utf8)).map { String(format: "%02x", $0) }.joined()
  }
  var identity: FreedRecoveryDnsProfileIdentity {
    FreedRecoveryDnsProfileIdentity(reference: reference, credentialHash: credentialHash,
      profileHash: profileHash, nativeConfigurationGeneration: nativeScope.generation)
  }
  var valid: Bool {
    identity.valid && FriendLockReceipt.hex(audience, 32) && Self.canonicalGeneration(ownerGeneration)
      && installationId.range(of: "^[cdef][A-Za-z0-9_-]{21}$", options: .regularExpression) != nil
      && FriendLockReceipt.hex(ownerDigest, 64) && UUID(uuidString: bindingID) != nil && nativeScope.valid
      && !bootstrapServers.isEmpty && bootstrapServers.count <= 2 && Set(bootstrapServers).count == bootstrapServers.count
      && bootstrapServers.allSatisfy { $0.utf8.count <= 45 && $0.range(of: "^[0-9a-fA-F:.]+$", options: .regularExpression) != nil }
  }
  static func canonicalGeneration(_ value: String) -> Bool {
    UUID(uuidString: value)?.uuidString.lowercased() == value
  }
}

enum FreedRecoveryDnsPilotGate {
  #if FREED_NATIVE_FIXTURES
  static var fixtureAllowed: Bool?
  #endif
  static func allowed(info: [String: Any], debug: Bool) -> Bool {
    guard info["FREEDRecoveryDnsPilotEnabled"] as? Bool == true else { return false }
    let channel = info["FREEDRecoveryDnsPilotChannel"] as? String
    return channel == "internal-testflight" && info["FREEDRecoveryDnsPilotInternalTestflight"] as? Bool == true
      || channel == "development" && debug
  }
  static var allowed: Bool {
    #if FREED_NATIVE_FIXTURES
    if let fixtureAllowed { return fixtureAllowed }
    #endif
    #if DEBUG
    let debug = true
    #else
    let debug = false
    #endif
    return allowed(info: Bundle.main.infoDictionary ?? [:], debug: debug)
  }
  static func requireAllowed() throws {
    guard allowed else { throw FreedRecoveryDnsPilotFailure.releaseGated }
  }
  static var modeActivationSupported: Bool {
    #if os(iOS)
    if #available(iOS 26.0, *) { return allowed }
    #endif
    return false
  }
}

enum FreedRecoveryDnsPilotFailure: String, Error {
  case releaseGated = "recovery-dns-internal-build-required"
  case invalidInput = "recovery-dns-invalid-input"
  case storageUnavailable = "recovery-dns-protected-storage-unavailable"
  case staleOwner = "recovery-dns-owner-or-generation-stale"
  case candidateUnavailable = "recovery-dns-candidate-unavailable"
  case bootstrapUnavailable = "recovery-dns-bootstrap-unavailable"
  case profileUnavailable = "recovery-dns-system-profile-unavailable"
  case resolverUnverified = "recovery-dns-system-resolver-unverified"
  case modeUnsupported = "recovery-dns-mode-authority-evidence-required"
  static func receipt(_ error: Error) -> [String: Any] {
    ["schema": 1, "kind": "error", "supported": FreedRecoveryDnsPilotGate.allowed,
      "accepted": false, "code": (error as? Self)?.rawValue ?? "recovery-dns-native-operation-unavailable",
      "browserRecoveryVerified": false, "modeActivationSupported": FreedRecoveryDnsPilotGate.modeActivationSupported]
  }
}

// Called within the same cross-process exclusion as each exact dispatch/publish.
// It does not turn restored owner/history bytes into authority: the native bridge
// first requires its acknowledged live binding; these generations fence callbacks.
enum FreedRecoveryDnsPilotBoundary {
  static func requireSameOwner(_ candidate: FreedRecoveryDnsCandidate, _ defaults: UserDefaults) throws {
    try FreedRecoveryDnsPilotGate.requireAllowed()
    struct Owner: Decodable { let ownerDigest: String?; let generation: Int; let scopeEpoch: Int }
    guard candidate.valid, let data = defaults.data(forKey: "freed.appGroups.v1"),
      let owner = try? JSONDecoder().decode(Owner.self, from: data), owner.ownerDigest == candidate.ownerDigest,
      owner.generation == candidate.nativeScope.generation, owner.scopeEpoch == candidate.nativeScope.appScopeEpoch,
      FreedProtectionConfigurationLock.generation(defaults) == candidate.nativeScope.generation,
      FreedProtectionConfigurationLock.permitsPublication(defaults) else { throw FreedRecoveryDnsPilotFailure.staleOwner }
  }
  static func requireCurrent(_ candidate: FreedRecoveryDnsCandidate, _ defaults: UserDefaults) throws {
    try requireSameOwner(candidate, defaults)
    guard try FreedAdultNativeScope.capture(defaults) == candidate.nativeScope,
      try FreedAccountProtectionCleanup.read(defaults).currentBindingID == candidate.bindingID,
      FreedProtectionConfigurationLock.permitsPublication(defaults) else { throw FreedRecoveryDnsPilotFailure.staleOwner }
  }
}

#if os(iOS)
import Network
import NetworkExtension
import dnssd
import Darwin
import ManagedSettings

@MainActor
enum FreedRecoveryDnsNativeFilter {
  static func installAuto() throws {
    guard #available(iOS 15.0, *) else { throw FreedRecoveryDnsPilotFailure.profileUnavailable }
    let store = ManagedSettingsStore()
    store.webContent.blockedByFilter = .auto([], except: [])
    guard store.webContent.blockedByFilter == .auto([], except: []) else { throw FreedAdultLockIntegrationFailure.invalidReadback }
  }
  // A failed/unselected hosted profile triggers a stronger OS-filter repair,
  // never a default DNS write or removal of the retained profile/credential.
  static func reconcileReadback(_ observation: FreedLoadedDnsObservation) throws {
    try FreedProtectionConfigurationLock.withExclusiveAccess { defaults in
      let policy = try FreedRetainedAdultProtection.read(defaults)
      guard let hosted = policy.hostedRecoveryDns else { return }
      if !observation.recognized || !observation.enabled || observation.pilot != hosted { try installAuto() }
    }
  }
  static func reconcileUnavailableSettings() throws {
    try FreedProtectionConfigurationLock.withExclusiveAccess { defaults in
      if try FreedRetainedAdultProtection.read(defaults).hostedRecoveryDns != nil { try installAuto() }
    }
  }
}

// Path epoch changes on Network's callback queue before any main-actor work.
// A queued UI callback therefore cannot keep an old routing receipt alive.
private final class FreedRecoveryDnsNetworkState {
  private let lock = NSLock()
  private var epoch = 0
  private var available = false
  func update(_ path: Network.NWPath) { lock.lock(); epoch += 1; available = path.status == .satisfied; lock.unlock() }
  func snapshot() -> (Int, Bool) { lock.lock(); defer { lock.unlock() }; return (epoch, available) }
}

// Separate namespace, no kSecAttrAccessGroup, no sync, no portable backup.
// Reuses only the generic platform API; never the friend-lock namespace/access file.
final class FreedRecoveryDnsCredentialStore {
  struct Credential: Codable {
    let candidate: FreedRecoveryDnsCandidate
    private let rawSecret: String
    init(candidate: FreedRecoveryDnsCandidate, rawSecret: String) { self.candidate = candidate; self.rawSecret = rawSecret }
    var valid: Bool {
      candidate.valid && FriendLockReceipt.hex(rawSecret, 64)
        && SHA256.hash(data: Data(rawSecret.utf8)).map { String(format: "%02x", $0) }.joined() == candidate.credentialHash
    }
    var serverURL: URL { URL(string: "https://\(FreedRecoveryDnsCandidate.endpointHost)/dns/\(rawSecret)/dns-query")! }
    func rebinding(to candidate: FreedRecoveryDnsCandidate) -> Self { Self(candidate: candidate, rawSecret: rawSecret) }
  }
  private let api: any FriendLockKeychainAPI
  private let service = "app.freed.host.recovery-dns-pilot.v1"
  private let account = "device-credentials"
  private static let mutex = NSLock()
  init(api: any FriendLockKeychainAPI = FriendLockSystemKeychainAPI()) { self.api = api }
  private func readLocked() throws -> [Credential] {
    guard let item = try api.read(service: service, account: account) else { return [] }
    guard item.thisDeviceOnly, !item.synchronizable, item.data.count <= 32_768,
      let values = try? JSONDecoder().decode([Credential].self, from: item.data), values.count <= 4,
      Set(values.map { $0.candidate.reference }).count == values.count, values.allSatisfy(\.valid) else {
      throw FreedRecoveryDnsPilotFailure.storageUnavailable
    }
    return values
  }
  func all() throws -> [Credential] {
    Self.mutex.lock(); defer { Self.mutex.unlock() }
    do { return try readLocked() } catch { throw FreedRecoveryDnsPilotFailure.storageUnavailable }
  }
  func required(_ reference: String) throws -> Credential {
    guard FriendLockReceipt.hex(reference, 32), let value = try all().first(where: { $0.candidate.reference == reference }) else {
      throw FreedRecoveryDnsPilotFailure.candidateUnavailable
    }
    return value
  }
  func stage(_ credential: Credential) throws {
    Self.mutex.lock(); defer { Self.mutex.unlock() }
    guard credential.valid else { throw FreedRecoveryDnsPilotFailure.invalidInput }
    do {
      var values = try readLocked()
      if let index = values.firstIndex(where: { $0.candidate.reference == credential.candidate.reference }) {
        let old = values[index]
        guard old.candidate.identity == credential.candidate.identity,
          old.candidate.ownerDigest == credential.candidate.ownerDigest,
          old.candidate.nativeScope.appScopeEpoch == credential.candidate.nativeScope.appScopeEpoch,
          old.serverURL == credential.serverURL else { throw FreedRecoveryDnsPilotFailure.invalidInput }
        if old.candidate == credential.candidate { return }
        values[index] = credential
      } else {
        // Never evict the credential backing an installed/retained device profile.
        guard values.count < 4 else { throw FreedRecoveryDnsPilotFailure.storageUnavailable }
        values.append(credential)
      }
      let bytes = try freedAdultEncode(values)
      try api.write(service: service, account: account, data: bytes)
      guard let saved = try api.read(service: service, account: account), saved.thisDeviceOnly,
        !saved.synchronizable, saved.data == bytes else { throw FreedRecoveryDnsPilotFailure.storageUnavailable }
    } catch { throw FreedRecoveryDnsPilotFailure.storageUnavailable }
  }
}

// Public system-resolver API; no explicit DoH/HTTP fetch or chosen resolver.
// A fresh random question is never persisted or returned across the bridge.
private final class FreedRecoveryDnsSystemQuery {
  struct Answer { let error: DNSServiceErrorType; let bytes: Data; let ttl: UInt32; let cached: Bool }
  private let queue = DispatchQueue(label: "app.freed.recovery-dns.system-query")
  private var reference: DNSServiceRef?
  private var continuation: CheckedContinuation<Answer, Never>?
  static func query(_ name: String, type: UInt16) async -> Answer {
    await withCheckedContinuation { continuation in
      let query = FreedRecoveryDnsSystemQuery()
      query.queue.async { query.start(name, type: type, continuation: continuation) }
    }
  }
  private func finish(_ answer: Answer) {
    guard let continuation else { return }
    self.continuation = nil
    if let reference { DNSServiceRefDeallocate(reference); self.reference = nil }
    continuation.resume(returning: answer)
  }
  private func start(_ name: String, type: UInt16, continuation: CheckedContinuation<Answer, Never>) {
    self.continuation = continuation
    let error = DNSServiceQueryRecord(&reference, DNSServiceFlags(kDNSServiceFlagsTimeout), 0, name,
      type, UInt16(kDNSServiceClass_IN), { _, flags, _, error, _, _, _, length, bytes, ttl, context in
        guard let context else { return }
        let query = Unmanaged<FreedRecoveryDnsSystemQuery>.fromOpaque(context).takeUnretainedValue()
        // Error callbacks leave all other parameters undefined.
        let data = error == kDNSServiceErr_NoError && length > 0 && bytes != nil ? Data(bytes: bytes!, count: Int(length)) : Data()
        query.finish(Answer(error: error, bytes: data, ttl: error == kDNSServiceErr_NoError ? ttl : 0,
          cached: error == kDNSServiceErr_NoError && flags & DNSServiceFlags(kDNSServiceFlagAnsweredFromCache) != 0))
      }, Unmanaged.passUnretained(self).toOpaque())
    guard error == kDNSServiceErr_NoError, let reference else {
      finish(Answer(error: error, bytes: Data(), ttl: 0, cached: false)); return
    }
    let dispatchError = DNSServiceSetDispatchQueue(reference, queue)
    guard dispatchError == kDNSServiceErr_NoError else {
      finish(Answer(error: dispatchError, bytes: Data(), ttl: 0, cached: false)); return
    }
    // Retains the context until callback/deallocation settles, including inline
    // failure. A timeout is unverified, never interpreted as a denial receipt.
    queue.asyncAfter(deadline: .now() + 8) {
      self.finish(Answer(error: DNSServiceErrorType(kDNSServiceErr_Timeout), bytes: Data(), ttl: 0, cached: false))
    }
  }
  static func address(_ data: Data) -> String? {
    let family = data.count == 4 ? AF_INET : data.count == 16 ? AF_INET6 : 0
    guard family != 0 else { return nil }
    var output = [CChar](repeating: 0, count: Int(INET6_ADDRSTRLEN))
    return data.withUnsafeBytes { bytes in
      guard inet_ntop(family, bytes.baseAddress!, &output, socklen_t(output.count)) != nil else { return nil }
      return String(cString: output)
    }
  }
}

@available(iOS 16.0, *)
@MainActor
enum FreedRecoveryDnsPilot {
  private static let credentials = FreedRecoveryDnsCredentialStore()
  private static let pathMonitor = NWPathMonitor()
  private static let networkState = FreedRecoveryDnsNetworkState()
  private static var monitoring = false
  private static var networkEpoch: Int { networkState.snapshot().0 }
  private static var networkAvailable: Bool { networkState.snapshot().1 }
  private static var checking = false
  private static let processID = UUID().uuidString.lowercased()
  struct RoutingReceipt {
    let id: String
    let profile: FreedRecoveryDnsProfileIdentity
    let ownerDigest: String
    let bindingID: String
    let scope: FreedAdultNativeScope
    let networkEpoch: Int
    let issuedUptime: TimeInterval
  }
  private static var receipt: RoutingReceipt?
  static func requireActivationProof(_ proof: FreedRecoveryDnsActivationProof, candidate: FreedRecoveryDnsCandidate) throws {
    try FreedRecoveryDnsPilotGate.requireAllowed()
    guard proof.valid, proof.processID == processID, let receipt, proof.receiptID == receipt.id,
      proof.profile == candidate.identity, receipt.profile == candidate.identity,
      receipt.ownerDigest == candidate.ownerDigest, receipt.bindingID == candidate.bindingID,
      receipt.scope == candidate.nativeScope, proof.networkEpoch == receipt.networkEpoch,
      receipt.networkEpoch == networkEpoch, networkAvailable,
      (0..<30).contains(ProcessInfo.processInfo.systemUptime - receipt.issuedUptime) else { throw FreedRecoveryDnsPilotFailure.resolverUnverified }
  }
  private static func startMonitoring() {
    guard !monitoring else { return }; monitoring = true
    let state = networkState
    pathMonitor.pathUpdateHandler = { path in
      state.update(path)
      Task { @MainActor in
        receipt = nil
      }
    }
    pathMonitor.start(queue: DispatchQueue(label: "app.freed.recovery-dns.path"))
  }
  static func current(_ reference: String, actionScope: String, renewBinding: Bool = false) throws -> FreedRecoveryDnsCandidate {
    try FreedRecoveryDnsPilotGate.requireAllowed()
    let credential = try credentials.required(reference)
    return try FreedAppGroupsRuntime.shared.withAcknowledgedPrivateScope(actionScope, readOnly: true) { defaults in
      let candidate: FreedRecoveryDnsCandidate
      if renewBinding {
        // Explicit same-owner check/replacement may renew ephemeral admission.
        // Retained history and a new owner cannot select this protected secret.
        let old = credential.candidate
        try FreedRecoveryDnsPilotBoundary.requireSameOwner(old, defaults)
        guard let bindingID = FreedAppGroupsRuntime.shared.currentBindingIdentity else { throw FreedRecoveryDnsPilotFailure.staleOwner }
        candidate = FreedRecoveryDnsCandidate(reference: old.reference, credentialHash: old.credentialHash,
          audience: old.audience, ownerGeneration: old.ownerGeneration, installationId: old.installationId,
          ownerDigest: old.ownerDigest, bindingID: bindingID, nativeScope: try FreedAdultNativeScope.capture(defaults),
          bootstrapServers: old.bootstrapServers)
        try FreedRecoveryDnsPilotBoundary.requireCurrent(candidate, defaults)
        try credentials.stage(credential.rebinding(to: candidate))
        if candidate != old { receipt = nil }
      } else { candidate = credential.candidate }
      try FreedRecoveryDnsPilotBoundary.requireCurrent(candidate, defaults); return candidate
    }
  }
  static func credential(_ candidate: FreedRecoveryDnsCandidate) throws -> FreedRecoveryDnsCredentialStore.Credential {
    let value = try credentials.required(candidate.reference)
    guard value.candidate == candidate else { throw FreedRecoveryDnsPilotFailure.candidateUnavailable }
    return value
  }
  static func matchingCredential(_ settings: NEDNSSettings?) throws -> FreedRecoveryDnsCredentialStore.Credential? {
    guard let https = settings as? NEDNSOverHTTPSSettings else { return nil }
    // An unrelated Families profile does not need to unlock DNS Keychain.
    guard https.serverURL?.host == FreedRecoveryDnsCandidate.endpointHost else { return nil }
    return try credentials.all().first { $0.serverURL == https.serverURL && Set($0.candidate.bootstrapServers) == Set(https.servers)
      && $0.candidate.bootstrapServers.count == https.servers.count }
  }
  static func stage(_ input: [String: Any]) async -> [String: Any] {
    do {
      try FreedRecoveryDnsPilotGate.requireAllowed()
      guard Set(input.keys) == Set(["rawSecret", "credentialHash", "audience", "ownerGeneration", "installationId", "actionScope"]),
        let raw = input["rawSecret"] as? String, FriendLockReceipt.hex(raw, 64),
        let hash = input["credentialHash"] as? String, FriendLockReceipt.hex(hash, 64),
        hash == SHA256.hash(data: Data(raw.utf8)).map({ String(format: "%02x", $0) }).joined(),
        let audience = input["audience"] as? String, FriendLockReceipt.hex(audience, 32),
        let serverGeneration = input["ownerGeneration"] as? String, FreedRecoveryDnsCandidate.canonicalGeneration(serverGeneration),
        let installation = input["installationId"] as? String, installation.range(of: "^[cdef][A-Za-z0-9_-]{21}$", options: .regularExpression) != nil,
        let actionScope = input["actionScope"] as? String, actionScope.utf8.count <= 4096,
        let bindingID = FreedAppGroupsRuntime.shared.currentBindingIdentity else { throw FreedRecoveryDnsPilotFailure.invalidInput }
      let owner = try FreedAppGroupsRuntime.shared.withAcknowledgedPrivateScope(actionScope, readOnly: true) { defaults -> (String, FreedAdultNativeScope) in
        struct Owner: Decodable { let ownerDigest: String }
        guard let data = defaults.data(forKey: "freed.appGroups.v1"), let owner = try? JSONDecoder().decode(Owner.self, from: data) else { throw FreedRecoveryDnsPilotFailure.staleOwner }
        return (owner.ownerDigest, try FreedAdultNativeScope.capture(defaults))
      }
      // Explicit same-owner restaging rebinds host callbacks without changing
      // the installed identity. An old operation still carries the old native
      // epoch/binding and cannot execute after this renewal.
      if let existing = try credentials.all().first(where: {
        $0.candidate.credentialHash == hash && $0.candidate.audience == audience
          && $0.candidate.ownerGeneration == serverGeneration && $0.candidate.installationId == installation
          && $0.candidate.ownerDigest == owner.0 && $0.candidate.nativeScope.generation == owner.1.generation
          && $0.candidate.nativeScope.appScopeEpoch == owner.1.appScopeEpoch
      }) {
        let renewed = FreedRecoveryDnsCandidate(reference: existing.candidate.reference, credentialHash: hash,
          audience: audience, ownerGeneration: serverGeneration, installationId: installation, ownerDigest: owner.0,
          bindingID: bindingID, nativeScope: owner.1, bootstrapServers: existing.candidate.bootstrapServers)
        try FreedAppGroupsRuntime.shared.withAcknowledgedPrivateScope(actionScope, readOnly: true) { defaults in
          try FreedRecoveryDnsPilotBoundary.requireCurrent(renewed, defaults)
          try credentials.stage(.init(candidate: renewed, rawSecret: raw))
        }
        startMonitoring(); return candidateReceipt(renewed)
      }
      // Resolve the fixed Firebase host itself. Cloudflare Families IPs must
      // never be paired with a Firebase URL (hostname/TLS verification stays OS-owned).
      async let ipv4 = FreedRecoveryDnsSystemQuery.query(FreedRecoveryDnsCandidate.endpointHost, type: UInt16(kDNSServiceType_A))
      async let ipv6 = FreedRecoveryDnsSystemQuery.query(FreedRecoveryDnsCandidate.endpointHost, type: UInt16(kDNSServiceType_AAAA))
      let answers = await [ipv4, ipv6]
      let servers = answers.filter { $0.error == kDNSServiceErr_NoError }.compactMap { FreedRecoveryDnsSystemQuery.address($0.bytes) }.sorted()
      guard !servers.isEmpty, !Task.isCancelled else { throw FreedRecoveryDnsPilotFailure.bootstrapUnavailable }
      let candidate = FreedRecoveryDnsCandidate(reference: UUID().uuidString.replacingOccurrences(of: "-", with: "").lowercased(),
        credentialHash: hash, audience: audience, ownerGeneration: serverGeneration, installationId: installation,
        ownerDigest: owner.0, bindingID: bindingID, nativeScope: owner.1, bootstrapServers: servers)
      try FreedAppGroupsRuntime.shared.withAcknowledgedPrivateScope(actionScope, readOnly: true) { defaults in
        try FreedRecoveryDnsPilotBoundary.requireCurrent(candidate, defaults)
        try credentials.stage(.init(candidate: candidate, rawSecret: raw))
      }
      startMonitoring()
      return candidateReceipt(candidate)
    } catch { return FreedRecoveryDnsPilotFailure.receipt(error) }
  }
  private static func candidateReceipt(_ candidate: FreedRecoveryDnsCandidate) -> [String: Any] {
    ["schema": 1, "kind": "candidate", "supported": true, "staged": true, "reference": candidate.reference,
      "credentialHash": candidate.credentialHash, "audience": candidate.audience, "ownerGeneration": candidate.ownerGeneration,
      "nativeConfigurationGeneration": candidate.nativeScope.generation, "profileHash": candidate.profileHash,
      "protectionChanged": false, "browserRecoveryVerified": false, "modeActivationSupported": FreedRecoveryDnsPilotGate.modeActivationSupported]
  }
  private static func publicRoutingReceipt(_ value: RoutingReceipt, reference: String) -> [String: Any] {
    let checkedAt = Int(value.issuedUptime * 1_000)
    return ["id": value.id, "reference": reference,
      "nativeConfigurationGeneration": value.scope.generation, "networkEpoch": String(value.networkEpoch),
      "checkedAtElapsedMs": checkedAt, "expiresAtElapsedMs": checkedAt + 30_000,
      "routeVerified": true, "denyVerified": true]
  }
  static func status(actionScope: String) async -> [String: Any] {
    do {
      try FreedRecoveryDnsPilotGate.requireAllowed()
      // Recheck the live owner after the OS read. A profile retained for another
      // owner may stay installed, but none of its staged metadata is returned.
      let before = try FreedAppGroupsRuntime.shared.withAcknowledgedPrivateScope(actionScope, readOnly: true) {
        try FreedAdultNativeScope.capture($0)
      }
      let binding = FreedAppGroupsRuntime.shared.currentBindingIdentity
      startMonitoring()
      let lease = try FreedAdultProtectionLegacyGate.acquireWriter()
      defer { FreedAdultProtectionLegacyGate.releaseWriter(lease) }
      let observed = try await FreedAdultDNSProvider.observe(lease: lease)
      let candidates = try credentials.all().map(\.candidate)
      return try FreedAppGroupsRuntime.shared.withAcknowledgedPrivateScope(actionScope, readOnly: true) { defaults in
        guard !Task.isCancelled, try FreedAdultNativeScope.capture(defaults) == before,
          binding != nil, binding == FreedAppGroupsRuntime.shared.currentBindingIdentity else {
          throw FreedRecoveryDnsPilotFailure.staleOwner
        }
        // Same-owner metadata may survive a process admission rotation. It is
        // read-only here; only an explicit check/replacement renews the binding.
        let currentCandidates = candidates.filter { (try? FreedRecoveryDnsPilotBoundary.requireSameOwner($0, defaults)) != nil }
        let candidate = currentCandidates.first(where: { $0.identity == observed.pilot }) ?? currentCandidates.last
        let profileSaved = candidate.map { observed.hasSettings && observed.recognized && observed.pilot == $0.identity } ?? false
        let enabled = profileSaved && observed.enabled
        let retained = try FreedRetainedAdultProtection.read(defaults)
        let hosted = candidate.map { retained.hostedRecoveryDns == $0.identity } ?? false
        var currentReceipt: RoutingReceipt?
        if enabled, let candidate, let receipt {
          let proof = FreedRecoveryDnsActivationProof(receiptID: receipt.id, profile: candidate.identity,
            networkEpoch: receipt.networkEpoch, processID: processID)
          if (try? requireActivationProof(proof, candidate: candidate)) != nil { currentReceipt = receipt }
        }
        return ["schema": 1, "kind": "status", "supported": true,
          "modeActivationSupported": FreedRecoveryDnsPilotGate.modeActivationSupported,
          "staged": candidate != nil, "candidate": candidate.map(candidateReceipt) as Any? ?? NSNull(),
          "profileSaved": profileSaved, "systemEnabled": enabled, "hostedModeRetained": hosted,
          "modeActive": enabled && hosted && observed.failoverSupported && observed.failoverMatches == true
            && ManagedSettingsStore().webContent.blockedByFilter == nil,
          "routeVerified": currentReceipt != nil, "denyVerified": currentReceipt != nil,
          "receipt": currentReceipt.map { publicRoutingReceipt($0, reference: $0.profile.reference) } as Any? ?? NSNull(),
          "browserRecoveryVerified": false, "code": "recovery-dns-status"]
      }
    } catch { return FreedRecoveryDnsPilotFailure.receipt(error) }
  }
  static func check(_ reference: String, actionScope: String) async -> [String: Any] {
    do {
      let candidate = try current(reference, actionScope: actionScope, renewBinding: true)
      guard !checking else { throw FreedRecoveryDnsPilotFailure.resolverUnverified }
      checking = true; defer { checking = false }
      receipt = nil; startMonitoring()
      let epoch = networkEpoch
      guard networkAvailable else { throw FreedRecoveryDnsPilotFailure.resolverUnverified }
      let lease = try FreedAdultProtectionLegacyGate.acquireWriter()
      defer { FreedAdultProtectionLegacyGate.releaseWriter(lease) }
      let before = try await FreedAdultDNSProvider.observe(lease: lease)
      guard before.pilot == candidate.identity, before.recognized, before.enabled else { throw FreedRecoveryDnsPilotFailure.profileUnavailable }
      let nonce = try FriendLockNativeCrypto().random(16).map { String(format: "%02x", $0) }.joined()
      let root = nonce + ".probe." + FreedRecoveryDnsCandidate.endpointHost
      async let a = FreedRecoveryDnsSystemQuery.query("a." + root, type: UInt16(kDNSServiceType_A))
      async let aaaa = FreedRecoveryDnsSystemQuery.query("a." + root, type: UInt16(kDNSServiceType_AAAA))
      let positive = await [a, aaaa]
      let routed = positive[0].error == kDNSServiceErr_NoError && positive[0].bytes == Data([198, 51, 100, 42])
        && positive[1].error == kDNSServiceErr_NoError && positive[1].bytes == Data([0x20, 0x01, 0x0d, 0xb8, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0x42])
        && positive.allSatisfy { $0.ttl == 0 && !$0.cached }
      // NXDOMAIN, offline, timeout, or a generic error never prove REFUSED.
      let denied = routed ? await FreedRecoveryDnsSystemQuery.query("b." + root, type: UInt16(kDNSServiceType_A)).error == kDNSServiceErr_Refused : false
      let after = try await FreedAdultDNSProvider.observe(lease: lease)
      _ = try current(reference, actionScope: actionScope)
      guard !Task.isCancelled, epoch == networkEpoch, networkAvailable, after == before else { throw FreedRecoveryDnsPilotFailure.resolverUnverified }
      let verified = routed && denied
      let id = UUID().uuidString.replacingOccurrences(of: "-", with: "").lowercased()
      if verified {
        receipt = RoutingReceipt(id: id, profile: candidate.identity, ownerDigest: candidate.ownerDigest,
          bindingID: candidate.bindingID, scope: candidate.nativeScope, networkEpoch: epoch, issuedUptime: ProcessInfo.processInfo.systemUptime)
      }
      let publicReceipt: Any = receipt.map { publicRoutingReceipt($0, reference: reference) } as Any? ?? NSNull()
      return ["schema": 1, "kind": "routeCheck", "supported": true, "reference": reference,
        "profileHash": candidate.profileHash, "nativeConfigurationGeneration": candidate.nativeScope.generation,
        "profileSaved": true, "systemEnabled": true, "routeVerified": routed, "denyVerified": denied,
        "networkEpoch": String(epoch), "receipt": publicReceipt, "validForSeconds": verified ? 30 : 0,
        "accepted": verified, "code": verified ? "configuration-route-deny-verified" : FreedRecoveryDnsPilotFailure.resolverUnverified.rawValue,
        "reason": verified ? "recovery-dns-routing-check-only" : FreedRecoveryDnsPilotFailure.resolverUnverified.rawValue,
        "browserRecoveryVerified": false, "modeActivationSupported": FreedRecoveryDnsPilotGate.modeActivationSupported]
    } catch { return FreedRecoveryDnsPilotFailure.receipt(error) }
  }
  static func prepareReplacement(_ reference: String, actionScope: String) async -> [String: Any] {
    do {
      let candidate = try current(reference, actionScope: actionScope, renewBinding: true)
      let runtime = try FreedAdultProtectionRuntime.shared()
      try await runtime.initialize()
      let authorization = try await runtime.coordinator.prepare(request: .dnsReplace, dnsCandidate: candidate)
      return try await runtime.coordinator.deviceAdultOperation(authorization.operationID)
    } catch { return FreedRecoveryDnsPilotFailure.receipt(error) }
  }
  static func prepareModeActivation(_ reference: String, actionScope: String) async -> [String: Any] {
    do {
      guard #available(iOS 26.0, *) else { throw FreedRecoveryDnsPilotFailure.modeUnsupported }
      let candidate = try current(reference, actionScope: actionScope)
      guard let receipt else { throw FreedRecoveryDnsPilotFailure.resolverUnverified }
      let proof = FreedRecoveryDnsActivationProof(receiptID: receipt.id, profile: candidate.identity,
        networkEpoch: receipt.networkEpoch, processID: processID)
      try requireActivationProof(proof, candidate: candidate)
      let runtime = try FreedAdultProtectionRuntime.shared()
      try await runtime.initialize()
      let authorization = try await runtime.coordinator.prepare(request: .recoveryModeActivate, dnsCandidate: candidate, activationProof: proof)
      return try await runtime.coordinator.deviceAdultOperation(authorization.operationID)
    } catch { return FreedRecoveryDnsPilotFailure.receipt(error) }
  }
}
#endif
