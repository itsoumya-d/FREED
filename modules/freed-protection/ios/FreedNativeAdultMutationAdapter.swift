import Foundation
import CryptoKit
import CoreFoundation

struct FreedLoadedDnsObservation: Codable, Equatable {
  let hasSettings: Bool
  let enabled: Bool
  let protocolMatches: Bool
  let serverURLMatches: Bool
  let serversMatch: Bool
  let matchDomainsMatch: Bool
  let noSearchMatch: Bool
  let onDemandRulesMatch: Bool
  let failoverSupported: Bool
  let failoverMatches: Bool?
  var pilot: FreedRecoveryDnsProfileIdentity? = nil
  var recognized: Bool {
    !hasSettings ? !enabled : protocolMatches && serverURLMatches && serversMatch
      && matchDomainsMatch && noSearchMatch && onDemandRulesMatch
      && (!failoverSupported || failoverMatches == true) && (pilot?.valid ?? true)
  }
}



struct FreedAdultNativeScope: Codable, Equatable {
  let generation: Int
  let nativeEpoch: Int
  let appScopeEpoch: Int
  var valid: Bool { [generation, nativeEpoch, appScopeEpoch].allSatisfy { (0...9_007_199_254_740_990).contains($0) } }
  static func capture(_ defaults: UserDefaults) throws -> Self {
    struct AppScope: Decodable { let scopeEpoch: Int }
    guard let data = defaults.data(forKey: "freed.appGroups.v1"),
      let scope = try? JSONDecoder().decode(AppScope.self, from: data) else { throw FreedAdultLockIntegrationFailure.invalidReadback }
    let generation = FreedProtectionConfigurationLock.generation(defaults)
    if let raw = defaults.object(forKey: FreedProtectionConfigurationLock.generationKey) {
      guard let number = raw as? NSNumber, CFGetTypeID(number) != CFBooleanGetTypeID(),
        number.doubleValue.rounded() == number.doubleValue, number.intValue == generation else { throw FreedAdultLockIntegrationFailure.invalidReadback }
    }
    let value = Self(generation: generation, nativeEpoch: try FreedProtectionConfigurationLock.adultMutationEpoch(defaults), appScopeEpoch: scope.scopeEpoch)
    guard value.valid else { throw FreedAdultLockIntegrationFailure.invalidReadback }
    return value
  }
}
struct FreedAdultCanonicalReadback: Codable, Equatable {
  var version = 1
  let scope: FreedAdultNativeScope
  let layers: [String: Data]
  static func decode(_ snapshot: FreedNativeAdultSnapshot) throws -> Self {
    let value = try JSONDecoder().decode(Self.self, from: snapshot.nativeReadback)
    guard value.version == 1, value.scope.valid, Set(value.layers.keys) == Set(FreedAdultLayer.allCases.map(\.rawValue)),
      value.layers.values.allSatisfy({ !$0.isEmpty && $0.count <= 8192 }) else { throw FreedAdultLockIntegrationFailure.invalidReadback }
    return value
  }
}
func freedAdultEncode<T: Encodable>(_ value: T) throws -> Data {
  let encoder = JSONEncoder(); encoder.outputFormatting = [.sortedKeys]; return try encoder.encode(value)
}
func freedAdultHash(_ data: Data, crypto: any FriendLockCrypto) throws -> String {
  try crypto.digest(data).map { String(format: "%02x", $0) }.joined()
}

enum FreedAdultDNSProfile {
  static let url = "https://family.cloudflare-dns.com/dns-query"
  static let servers = ["1.1.1.3", "1.0.0.3", "2606:4700:4700::1113", "2606:4700:4700::1003"]
  static var digest: String {
    // The same constants configure and recognize the only supported provider.
    let canonical = url + "|" + servers.sorted().joined(separator: ",") + "|matchDomains=empty-domain|noSearch=true|onDemand=empty|allowFailover=false-when-supported"
    return SHA256.hash(data: Data(canonical.utf8)).map { String(format: "%02x", $0) }.joined()
  }
}
func freedAdultDNSData(_ observation: FreedLoadedDnsObservation) throws -> Data {
  // Unknown profiles are not collapsed into a false-flags baseline.
  guard observation.recognized else { throw FreedAdultLockIntegrationFailure.invalidReadback }
  struct DNS: Encodable {
    let provider: String
    let configurationDigest: String
    let loaded: FreedLoadedDnsObservation
  }
  return try freedAdultEncode(DNS(provider: observation.pilot == nil ? "cloudflare-families-doh-v1" : "freed-hosted-recovery-doh-pilot-v1",
    configurationDigest: observation.pilot?.profileHash ?? FreedAdultDNSProfile.digest, loaded: observation))
}

@MainActor
protocol FreedAdultNativeProviders: AnyObject {
  func localLayers(_ defaults: UserDefaults) throws -> [String: Data]
  func observeDNS(lease: FreedAdultProtectionLegacyGate.WriterLease) async throws -> FreedLoadedDnsObservation
  func observeSafariSettled(lease: FreedAdultProtectionLegacyGate.WriterLease) async throws -> Bool
  func perform(_ layer: FreedAdultLayer, permit: FreedAdultLayerPermit) async throws
  func compensate(_ layer: FreedAdultLayer, permit: FreedAdultLayerPermit) async throws
  func discard(_ operationID: String)
}
@MainActor
final class FreedProductionAdultMutationAdapter: FreedNativeAdultMutationAdapter {
  private let providers: any FreedAdultNativeProviders
  init(providers: any FreedAdultNativeProviders) { self.providers = providers }
  func fenceNativeAuthority() async throws -> Int {
    try FreedAdultConfigurationAccess.withExclusiveAccess { try FreedProtectionConfigurationLock.fenceAdultMutations($0) }
  }
  func snapshot(lease: FreedAdultProtectionLegacyGate.WriterLease) async throws -> FreedNativeAdultSnapshot {
    try FreedAdultProtectionLegacyGate.requireCurrent(lease)
    for _ in 0..<2 {
      let before = try captureLocal()
      let dns = try await providers.observeDNS(lease: lease)
      let enabled = try await providers.observeSafariSettled(lease: lease)
      let after = try captureLocal()
      try FreedAdultProtectionLegacyGate.requireCurrent(lease)
      guard before == after else { continue }
      var layers = before.layers
      layers["dns"] = try freedAdultDNSData(dns)
      // Enabled state is a distinct observation, never a reload acknowledgement.
      layers["safari"] = try freedAdultEncode(SafariObservation(local: layers["safari"]!, enabled: enabled))
      let bytes = try freedAdultEncode(FreedAdultCanonicalReadback(scope: before.scope, layers: layers))
      let configuration = try FriendLockConfiguration(revision: String(before.policy.revision),
        mutationGeneration: "g\(before.scope.generation).n\(before.scope.nativeEpoch).a\(before.scope.appScopeEpoch)")
      let result = FreedNativeAdultSnapshot(configuration: configuration, policy: before.policy, nativeReadback: bytes)
      guard result.valid else { throw FreedAdultLockIntegrationFailure.invalidReadback }
      return result
    }
    throw FreedAdultLockIntegrationFailure.staleConfiguration
  }
  struct SafariObservation: Codable, Equatable { let local: Data; let enabled: Bool }
  private struct Local: Equatable { let scope: FreedAdultNativeScope; let policy: FreedRetainedAdultProtection.Policy; let layers: [String: Data] }
  private func captureLocal() throws -> Local {
    try FreedAdultConfigurationAccess.withExclusiveAccess { defaults in
      guard defaults.data(forKey: FreedRetainedAdultProtection.key) != nil else { throw FreedAdultLockIntegrationFailure.invalidReadback }
      return try Local(scope: FreedAdultNativeScope.capture(defaults), policy: FreedRetainedAdultProtection.read(defaults), layers: providers.localLayers(defaults))
    }
  }
  func perform(operation: FreedAdultOperation, context: FreedAdultMutationExecutionContext) async throws -> FreedNativeAdultMutationResult {
    var layers = FreedAdultLayerStages()
    defer { providers.discard(operation.id) }
    for layer in operation.request.orderedLayers {
      let permit = try await context.reserve(layer)
      do {
        try await providers.perform(layer, permit: permit)
        _ = try await context.record(permit, state: .applied)
        layers.set(layer, .observedApplied)
      } catch {
        // An unavailable/stale readback leaves the durable reservation unresolved.
        var observed = try await context.record(permit, state: .failed)
        layers.set(layer, .failed)
        for affected in operation.request.orderedLayers.prefix(through: permit.step.index).reversed() {
          let repair = try await context.reserveCompensation(affected)
          do {
            try await providers.compensate(affected, permit: repair)
            observed = try await context.record(repair, state: .applied)
          } catch {
            observed = try await context.record(repair, state: .failed)
            break
          }
        }
        return FreedNativeAdultMutationResult(accepted: false, stage: .partial, resultingSnapshot: observed, layers: layers)
      }
    }
    return FreedNativeAdultMutationResult(accepted: true, stage: .readback,
      resultingSnapshot: try await snapshot(lease: context.lease), layers: layers)
  }
}
extension FreedAdultLayerStages {
  mutating func set(_ layer: FreedAdultLayer, _ state: FreedAdultLayerStage) {
    switch layer { case .dns: dns = state; case .safari: safari = state; case .risk: risk = state; case .continuous: continuous = state }
  }
}

// Explicit scratch-store injection is confined to executable native fixtures.
// Production always reaches the one existing configuration transaction.
enum FreedAdultConfigurationAccess {
  #if FREED_NATIVE_FIXTURES
  static var fixtureContainer: URL?
  static var fixtureDomain = "freed.adult.adapter.fixture"
  #endif
  static func withExclusiveAccess<T>(_ body: (UserDefaults) throws -> T) throws -> T {
    #if FREED_NATIVE_FIXTURES
    if let fixtureContainer {
      return try FreedProtectionConfigurationLock.withExclusiveAccess(containerOverride: fixtureContainer, domain: fixtureDomain, body)
    }
    #endif
    return try FreedProtectionConfigurationLock.withExclusiveAccess(body)
  }
}

enum FreedAdultExecutionObservation { case pending, completed(FreedNativeAdultMutationResult), failed(Error) }
// A bounded observer does not cancel the coordinator's queue-owned task, nor
// release its lease. Outstanding observers remain charged until real settlement.
enum FreedAdultExecutionObserver {
  private static let mutex = NSLock()
  private static var count = 0
  private static func admit() -> Bool { mutex.lock(); defer { mutex.unlock() }; guard count < 16 else { return false }; count += 1; return true }
  private static func release() { mutex.lock(); count -= 1; mutex.unlock() }
  static func run(_ operation: @escaping () async throws -> FreedNativeAdultMutationResult) async -> FreedAdultExecutionObservation {
    guard admit() else { return .pending }
    return await waitAdmitted(Task { try await operation() })
  }
  static func wait(_ task: Task<FreedNativeAdultMutationResult, Error>) async -> FreedAdultExecutionObservation {
    guard admit() else { return .pending }
    return await waitAdmitted(task)
  }
  private static func waitAdmitted(_ task: Task<FreedNativeAdultMutationResult, Error>) async -> FreedAdultExecutionObservation {
    return await withCheckedContinuation { continuation in
      let lock = NSLock(); var finished = false
      let complete: (FreedAdultExecutionObservation) -> Void = { value in
        lock.lock(); let resume = !finished; finished = true; lock.unlock()
        if resume { continuation.resume(returning: value) }
      }
      DispatchQueue.global().asyncAfter(deadline: .now() + 8) { complete(.pending) }
      Task {
        do { let value = try await task.value; release(); complete(.completed(value)) }
        catch { release(); complete(.failed(error)) }
      }
    }
  }
}
