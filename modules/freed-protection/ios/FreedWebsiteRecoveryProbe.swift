import Foundation

// Private, nonportable state. Uses the existing atomic selection namespace.
struct FreedWebsiteProbeIdentity: Codable, Equatable {
  let owner: String
  let generation: Int
  let epoch: Int
}
struct FreedWebsiteProbeState: Codable, Equatable {
  var version = 1
  var identity: FreedWebsiteProbeIdentity
  var revision: Int
  var optedIn: Bool
  var pending: [Data]?
  var active: [Data]
}
protocol FreedWebsiteProbeStore {
  func read() throws -> [Data]
  func write(_ tokens: [Data]) throws
}
enum FreedWebsiteProbeError: Error { case refused, stale, selection, persistence, readback, rollback }

// This is the production adapter transaction, also exercised by isolated fixtures.
// Caller holds the configuration lock for load/mutation/readback/persistence.
enum FreedWebsiteProbeTransaction {
  static func selection(apps: Int, categories: Int, websites: [Data]) throws -> [Data] {
    guard apps == 0, categories == 0, (1...50).contains(websites.count),
      Set(websites).count == websites.count, websites.allSatisfy({ !$0.isEmpty }) else { throw FreedWebsiteProbeError.selection }
    return websites
  }
  static func mutate(state: FreedWebsiteProbeState?, identity: FreedWebsiteProbeIdentity,
    expectedRevision: Int, operation: String, selection: [Data]? = nil,
    allowed: Bool, authorized: Bool, store: any FreedWebsiteProbeStore,
    save: (FreedWebsiteProbeState) throws -> Void) throws -> FreedWebsiteProbeState {
    guard allowed, authorized else { throw FreedWebsiteProbeError.refused }
    let current = state ?? FreedWebsiteProbeState(identity: identity, revision: 0, optedIn: false, pending: nil, active: [])
    guard current.version == 1, (current.identity == identity || operation == "remove"), current.revision == expectedRevision,
      current.revision < 9_007_199_254_740_991 else { throw FreedWebsiteProbeError.stale }
    var next = current
    next.revision += 1
    switch operation {
    case "opt-in": next.optedIn = true
    case "select":
      guard current.optedIn, let selection else { throw FreedWebsiteProbeError.refused }
      next.pending = try self.selection(apps: 0, categories: 0, websites: selection)
    case "discard": next.pending = nil
    case "activate":
      guard current.optedIn, let pending = current.pending else { throw FreedWebsiteProbeError.refused }
      next.active = try self.selection(apps: 0, categories: 0, websites: pending); next.pending = nil
    case "remove": next.identity = identity; next.active = []; next.pending = nil; next.optedIn = false
    default: throw FreedWebsiteProbeError.refused
    }
    let old = try store.read()
    let changesStore = operation == "activate" || operation == "remove"
    do {
      if changesStore { try store.write(next.active); guard try Set(store.read()) == Set(next.active) else { throw FreedWebsiteProbeError.readback } }
      try save(next)
      return next
    } catch {
      if changesStore {
        do { try store.write(old); guard try Set(store.read()) == Set(old) else { throw FreedWebsiteProbeError.rollback } }
        catch { throw FreedWebsiteProbeError.rollback }
      }
      throw error
    }
  }
  static func validCallback(state: FreedWebsiteProbeState?, identity: FreedWebsiteProbeIdentity?,
    revision: Int?, token: Data, installed: [Data], allowed: Bool, authorized: Bool) -> Bool {
    guard allowed, authorized, let state, let identity, state.version == 1,
      state.identity == identity, state.optedIn, revision == state.revision,
      state.active.contains(token), (1...50).contains(state.active.count),
      Set(installed) == Set(state.active) else { return false }
    return true
  }
  static func finalReceipt(snapshot: [String: Any], expectedRevision: Int, operation: String) -> [String: Any] {
    var result = snapshot
    guard snapshot["accepted"] as? Bool == true,
      snapshot["readbackAvailable"] as? Bool == true,
      snapshot["revision"] as? Int == expectedRevision,
      operation != "activate" || snapshot["installed"] as? Bool == true else {
      result["accepted"] = false
      if snapshot["accepted"] as? Bool == true { result["reason"] = "probe-final-readback-unconfirmed" }
      return result
    }
    return result
  }
  static func rawTokenAvailable<T>(_ token: T?) -> Bool { token != nil }
  static func buildAllowed(flag: Bool, channel: String?, internalTestflight: Bool, debug: Bool) -> Bool {
    flag && (channel == "internal-testflight" && internalTestflight || debug && channel == "development")
  }
}

#if os(iOS) && canImport(FamilyControls) && canImport(ManagedSettings)
import FamilyControls
import ManagedSettings

@available(iOS 16.0, *)
enum FreedWebsiteRecoveryProbe {
  static let key = "freed.selection.websiteRecoveryProbe.v1"
  static let storeName = "freed.website-recovery-probe.v1"
  static var allowed: Bool {
    #if DEBUG
    let debug = true
    #else
    let debug = false
    #endif
    return FreedWebsiteProbeTransaction.buildAllowed(flag: Bundle.main.object(forInfoDictionaryKey: "FREEDWebsiteRecoveryProbeEnabled") as? Bool == true,
      channel: Bundle.main.object(forInfoDictionaryKey: "FREEDWebsiteRecoveryProbeChannel") as? String,
      internalTestflight: Bundle.main.object(forInfoDictionaryKey: "FREEDWebsiteRecoveryProbeInternalTestflight") as? Bool == true, debug: debug)
  }
  struct Store: FreedWebsiteProbeStore {
    private let store = ManagedSettingsStore(named: ManagedSettingsStore.Name(storeName))
    func read() throws -> [Data] { try (store.shield.webDomains ?? []).map { try JSONEncoder().encode($0) } }
    func write(_ tokens: [Data]) throws {
      let decoded = try tokens.map { try JSONDecoder().decode(WebDomainToken.self, from: $0) }
      store.shield.webDomains = decoded.isEmpty ? nil : Set(decoded)
    }
  }
  private struct OwnerSnapshot: Decodable {
    let version: Int
    let ownerDigest: String?
    let generation: Int
    let scopeEpoch: Int
  }
  static func identity(_ defaults: UserDefaults) -> FreedWebsiteProbeIdentity? {
    guard FreedProtectionConfigurationLock.permitsPublication(defaults),
      let data = defaults.data(forKey: "freed.appGroups.v1"),
      let state = try? JSONDecoder().decode(OwnerSnapshot.self, from: data), state.version == 1,
      let owner = state.ownerDigest, !owner.isEmpty,
      state.generation == FreedProtectionConfigurationLock.generation(defaults), state.scopeEpoch >= 0 else { return nil }
    return FreedWebsiteProbeIdentity(owner: owner, generation: state.generation, epoch: state.scopeEpoch)
  }
  static func state(_ defaults: UserDefaults) -> FreedWebsiteProbeState? {
    defaults.data(forKey: key).flatMap { try? JSONDecoder().decode(FreedWebsiteProbeState.self, from: $0) }
  }
  static func snapshot() -> [String: Any] {
    guard allowed else { return ["supported": false, "accepted": false, "reason": "internal-probe-disabled"] }
    return (try? FreedProtectionConfigurationLock.withExclusiveAccess { defaults in
      let current = state(defaults), owner = identity(defaults)
      let readableState = defaults.data(forKey: key) == nil || current != nil
      let visible = owner != nil && readableState && (current == nil || current?.identity == owner)
      let readback = try? Store().read()
      let installed = readback ?? []
      return ["supported": true, "accepted": visible && readback != nil, "readbackAvailable": readback != nil, "revision": current?.revision ?? 0, "generation": owner?.generation ?? -1, "epoch": owner?.epoch ?? -1,
        "optedIn": visible && current?.optedIn == true,
        "pendingCount": visible ? current?.pending?.count ?? 0 : 0,
        "activeCount": visible ? current?.active.count ?? 0 : 0,
        "installed": visible && current?.optedIn == true && !(current?.active.isEmpty ?? true) && Set(installed) == Set(current?.active ?? []),
        "openParentSupported": { if #available(iOS 26.5, *) { return true }; return false }(),
        "reason": !readableState ? "probe-state-unreadable" : readback == nil ? "probe-native-readback-unavailable" : visible ? "internal-selected-website-probe" : "owner-unavailable-or-changed"] as [String: Any]
    }) ?? ["supported": true, "accepted": false, "reason": "state-unavailable"]
  }
  static func mutate(operation: String, revision: Int, generation: Int? = nil, epoch: Int? = nil, selection: FamilyActivitySelection? = nil) -> [String: Any] {
    var rollback: (state: FreedWebsiteProbeState?, identity: FreedWebsiteProbeIdentity, before: [Data], after: [Data])?
    do {
      try FreedProtectionConfigurationLock.withExclusiveAccess { defaults in
        guard let owner = identity(defaults), generation == nil || generation == owner.generation, epoch == nil || epoch == owner.epoch else { throw FreedWebsiteProbeError.refused }
        let data: [Data]?
        if let selection {
          data = try FreedWebsiteProbeTransaction.selection(apps: selection.applicationTokens.count, categories: selection.categoryTokens.count,
            websites: selection.webDomainTokens.map { try JSONEncoder().encode($0) })
        } else { data = nil }
        if defaults.data(forKey: key) != nil && state(defaults) == nil { throw FreedWebsiteProbeError.persistence }
        let previous = state(defaults)
        let before = try Store().read()
        let intended = operation == "activate" ? previous?.pending ?? [] : operation == "remove" ? [] : before
        rollback = (previous, owner, before, intended)
        _ = try FreedWebsiteProbeTransaction.mutate(state: previous, identity: owner, expectedRevision: revision,
          operation: operation, selection: data, allowed: allowed,
          authorized: AuthorizationCenter.shared.authorizationStatus == .approved, store: Store()) { next in
            let encoded = try JSONEncoder().encode(next)
            defaults.set(encoded, forKey: key)
            guard FreedProtectionConfigurationLock.persist(defaults), defaults.data(forKey: key) == encoded else { throw FreedWebsiteProbeError.persistence }
          }
      }
      return FreedWebsiteProbeTransaction.finalReceipt(snapshot: snapshot(), expectedRevision: revision + 1, operation: operation)
    } catch {
      // The outer atomic-file boundary can fail after body persistence (for
      // example execution expiry). Reacquire and restore only this unchanged
      // transaction's store; never overwrite a later owner's/revision's work.
      var rollbackConfirmed = true
      if let rollback, operation == "activate" || operation == "remove" {
        rollbackConfirmed = (try? FreedProtectionConfigurationLock.withExclusiveAccess { defaults in
          guard identity(defaults) == rollback.identity, state(defaults) == rollback.state else { return false }
          let store = Store(), installed = try store.read()
          if Set(installed) == Set(rollback.before) { return true }
          guard Set(installed) == Set(rollback.after) else { return false }
          try store.write(rollback.before)
          return try Set(store.read()) == Set(rollback.before)
        }) == true
      }
      var result = snapshot(); result["accepted"] = false
      result["reason"] = rollbackConfirmed ? "probe-\(error)" : "probe-rollback-unconfirmed"
      return result
    }
  }
  // Captures native authority only. The exported domain DTO never contains these fields.
  static func callbackFields(token: WebDomainToken, defaults: UserDefaults) -> [String: Any]? {
    guard let encoded = try? JSONEncoder().encode(token), let current = state(defaults),
      validCallback(token: encoded, revision: current.revision, owner: current.identity.owner,
        generation: current.identity.generation, epoch: current.identity.epoch, defaults: defaults) else { return nil }
    return ["websiteProbeRevision": current.revision, "websiteProbeOwner": current.identity.owner,
      "configurationGeneration": current.identity.generation, "scopeEpoch": current.identity.epoch]
  }
  static func validCallback(token: Data, revision: Int?, owner: String?, generation: Int?, epoch: Int?, defaults: UserDefaults) -> Bool {
    guard let current = state(defaults), current.identity.owner == owner,
      current.identity.generation == generation, current.identity.epoch == epoch,
      let installed = try? Store().read() else { return false }
    return FreedWebsiteProbeTransaction.validCallback(state: current, identity: identity(defaults), revision: revision,
      token: token, installed: installed, allowed: allowed, authorized: AuthorizationCenter.shared.authorizationStatus == .approved)
  }
}
#endif
