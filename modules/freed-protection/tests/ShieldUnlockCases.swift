import Foundation

enum FreedProtectionResetPolicy { static let resetMarkerKey = "freed.protectionConfiguration.reset" }
enum ShieldRuntime { static var canOpenApp = true }
enum ShieldAction { case primaryButtonPressed, secondaryButtonPressed }
enum ShieldActionResponse { case close, openParentalControlsApp }
struct ApplicationToken: Codable {}
struct WebDomainToken: Codable {}
struct ActivityCategoryToken: Codable {}
class ShieldActionDelegate {
  func handle(action: ShieldAction, for application: ApplicationToken, completionHandler: @escaping (ShieldActionResponse) -> Void) {}
  func handle(action: ShieldAction, for webDomain: WebDomainToken, completionHandler: @escaping (ShieldActionResponse) -> Void) {}
  func handle(action: ShieldAction, for category: ActivityCategoryToken, completionHandler: @escaping (ShieldActionResponse) -> Void) {}
}
// Failure injection only at persistence/framework boundaries. No production
// code is modified, app group opened, owner configuration reset or device used.
final class ShieldDefaults {
  static let standard = ShieldDefaults(suiteName: "isolated")!
  static var values: [String: Any] = [:]
  static var failSync = false
  static var failSet = false
  static var resetAfterSet = false
  static var generationAfterSet = false
  static var replaceAfterSet = false
  init?(suiteName: String) {}
  func bool(forKey key: String) -> Bool { Self.values[key] as? Bool ?? false }
  func integer(forKey key: String) -> Int { Self.values[key] as? Int ?? 0 }
  func dictionary(forKey key: String) -> [String: Any]? { Self.values[key] as? [String: Any] }
  func data(forKey key: String) -> Data? { Self.values[key] as? Data }
  func set(_ value: Any?, forKey key: String) {
    if !Self.failSet { Self.values[key] = value }
    if Self.resetAfterSet { Self.values[FreedProtectionResetPolicy.resetMarkerKey] = true }
    if Self.generationAfterSet { Self.values["generation"] = 1 }
    if Self.replaceAfterSet { Self.values[key] = Data("another-writer".utf8) }
  }
  func removeObject(forKey key: String) { Self.values.removeValue(forKey: key) }
  func synchronize() -> Bool { !Self.failSync }
}
struct ShieldEncoder {
  static var fail = false
  static var count = 0
  static var failAt = 0
  func encode<T: Encodable>(_ value: T) throws -> Data {
    Self.count += 1
    if Self.fail || Self.count == Self.failAt { throw NSError(domain: "isolated-encoder", code: 1) }
    return try JSONEncoder().encode(value)
  }
}
enum FreedProtectionConfigurationLock {
  enum AccessError: Error { case unavailable;var reason:String{"configuration-lock-unavailable"} }
  static func persist(_ defaults:ShieldDefaults)->Bool{defaults.synchronize()}
  static func persist(_ defaults:UserDefaults)->Bool{!ShieldDefaults.failSync}
  static func diagnostics(_ error:Error?=nil,generation:Int?=nil)->[String:Any]{["stage":"isolated-lock"]}
  static var failFinalSync = false
  static var deny = false
  static var calls = 0
  static var afterFirstFlush: (() -> Void)?
  static func withExclusiveAccess<T>(afterSuccessfulPersistence: ((T) -> Void)? = nil,
                                    readOnly: Bool = false, _ body: (ShieldDefaults) throws -> T) throws -> T {
    calls += 1
    if deny { throw NSError(domain: "isolated-lock", code: 1) }
    if !ShieldDefaults.standard.synchronize() { throw NSError(domain: "isolated-lock", code: 3) }
    let result = try body(ShieldDefaults.standard)
    if failFinalSync { throw NSError(domain: "isolated-lock", code: 2) }
    if !ShieldDefaults.standard.synchronize() { throw NSError(domain: "isolated-lock", code: 3) }
    afterSuccessfulPersistence?(result)
    if calls == 1 { afterFirstFlush?() }
    return result
  }
  static func generation(_ defaults: ShieldDefaults) -> Int { defaults.integer(forKey: "generation") }
  static func permitsPublication(_ defaults: ShieldDefaults, capturedGeneration: Int? = nil) -> Bool {
    !defaults.bool(forKey: FreedProtectionResetPolicy.resetMarkerKey)
      && (capturedGeneration == nil || capturedGeneration == generation(defaults))
  }
}
final class UNMutableNotificationContent {
  var title = "", body = ""
  var userInfo: [String: Any] = [:]
}
struct UNTimeIntervalNotificationTrigger { init(timeInterval: Double, repeats: Bool) {} }
struct UNNotificationRequest {
  let identifier: String
  let content: UNMutableNotificationContent
  init(identifier: String, content: UNMutableNotificationContent, trigger: UNTimeIntervalNotificationTrigger) {
    self.identifier = identifier; self.content = content
  }
}
final class UNUserNotificationCenter {
  static var count = 0
  static var pending: [String: UNNotificationRequest] = [:]
  static var completions: [() -> Void] = []
  static var delayCompletion = false
  static var delayQuery = false
  static var query: (() -> Void)?
  static func current() -> UNUserNotificationCenter { UNUserNotificationCenter() }
  func add(_ request: UNNotificationRequest, withCompletionHandler completion: ((Error?) -> Void)? = nil) {
    Self.count += 1
    let finish = { Self.pending[request.identifier] = request; completion?(nil) }
    if Self.delayCompletion { Self.completions.append(finish) } else { finish() }
  }
  func removePendingNotificationRequests(withIdentifiers ids: [String]) {
    for id in ids { Self.pending.removeValue(forKey: id) }
  }
  func removeDeliveredNotifications(withIdentifiers ids: [String]) {}
  func getPendingNotificationRequests(completionHandler: @escaping ([UNNotificationRequest]) -> Void) {
    let finish = { completionHandler(Array(Self.pending.values)) }
    if Self.delayQuery { Self.query = finish } else { finish() }
  }
  static func finishAdds() {
    let callbacks = completions; completions = []
    callbacks.forEach { $0() }
  }
}

@main struct ShieldUnlockCases {
  static func main() {
    let mode = ProcessInfo.processInfo.environment["FREED_NATIVE_CASE"]
    if mode != "unlock" { shieldCases() }
    if mode != "shield" { unlockCases() }
  }
  static func shieldCases() {
    let handler = ShieldActionExtension()
    func reset() {
      ShieldDefaults.values = [:]; ShieldDefaults.failSync = false; ShieldDefaults.failSet = false
      ShieldDefaults.resetAfterSet = false; ShieldEncoder.fail = false
      ShieldDefaults.generationAfterSet = false; ShieldDefaults.replaceAfterSet = false
      ShieldEncoder.count = 0; ShieldEncoder.failAt = 0
      FreedProtectionConfigurationLock.failFinalSync = false; FreedProtectionConfigurationLock.deny = false
      FreedProtectionConfigurationLock.calls = 0; FreedProtectionConfigurationLock.afterFirstFlush = nil
      UNUserNotificationCenter.count = 0
      UNUserNotificationCenter.pending = [:]; UNUserNotificationCenter.completions = []
      UNUserNotificationCenter.delayCompletion = false; UNUserNotificationCenter.delayQuery = false
      UNUserNotificationCenter.query = nil
    }
    func action() -> ShieldActionResponse {
      var result: ShieldActionResponse = .close
      handler.handle(action: .primaryButtonPressed, for: ApplicationToken()) { result = $0 }
      return result
    }
    reset(); ShieldRuntime.canOpenApp = true
    precondition(action() == .openParentalControlsApp, "durable primary intervention must open app on iOS26.5")
    precondition(ShieldDefaults.values["freed.pendingIntervention.record"] != nil)
    precondition(UNUserNotificationCenter.count == 0)
    reset(); ShieldRuntime.canOpenApp = false
    precondition(action() == .close && UNUserNotificationCenter.count == 1, "older OS close + notification fallback")
    precondition(UNUserNotificationCenter.pending.count == 1, "inline OS completion must wait for final decision flush")
    for osCanOpen in [false, true] {
      ShieldRuntime.canOpenApp = osCanOpen
      for failure in 0..<9 {
        reset()
        switch failure {
        case 0: ShieldEncoder.fail = true
        case 1: ShieldDefaults.failSync = true
        case 2: ShieldDefaults.failSet = true
        case 3: ShieldDefaults.resetAfterSet = true
        case 4: FreedProtectionConfigurationLock.failFinalSync = true
        case 5: FreedProtectionConfigurationLock.deny = true
        case 6: ShieldEncoder.failAt = 2 // token succeeds, record encoding fails
        case 7: ShieldDefaults.generationAfterSet = true
        default: ShieldDefaults.replaceAfterSet = true
        }
        precondition(action() == .close, "failed publication must not open")
        precondition(UNUserNotificationCenter.count == 0, "failed publication must not notify")
        if failure == 8 {
          precondition(ShieldDefaults.values["freed.pendingIntervention.record"] as? Data == Data("another-writer".utf8), "failed readback must preserve another writer's record")
        }
      }
    }
    reset(); ShieldDefaults.values[FreedProtectionResetPolicy.resetMarkerKey] = true
    precondition(action() == .close && ShieldDefaults.values["freed.pendingIntervention.record"] == nil)
    reset()
    ShieldRuntime.canOpenApp = false
    UNUserNotificationCenter.delayCompletion = true
    precondition(action() == .close && UNUserNotificationCenter.count == 1)
    ShieldDefaults.values["generation"] = 1
    ShieldDefaults.values[FreedProtectionResetPolicy.resetMarkerKey] = false
    ShieldDefaults.values.removeValue(forKey: "freed.pendingIntervention.record")
    UNUserNotificationCenter.finishAdds()
    precondition(UNUserNotificationCenter.pending.isEmpty, "notification completing after reset and activation must be removed")
    reset(); UNUserNotificationCenter.delayCompletion = true
    FreedProtectionConfigurationLock.afterFirstFlush = { FreedProtectionConfigurationLock.failFinalSync = true }
    precondition(action() == .close)
    precondition(UNUserNotificationCenter.count == 0, "failed decision flush must never submit a notification")
    UNUserNotificationCenter.finishAdds()
    precondition(UNUserNotificationCenter.pending.isEmpty, "failed final decision flush must remove delayed addition")
    reset(); UNUserNotificationCenter.delayCompletion = true
    precondition(action() == .close)
    ShieldDefaults.values["generation"] = 1
    ShieldDefaults.values.removeValue(forKey: "freed.pendingIntervention.record")
    precondition(action() == .close)
    let newRecord = try! JSONSerialization.jsonObject(with: ShieldDefaults.standard.data(forKey: "freed.pendingIntervention.record")!) as! [String: Any]
    UNUserNotificationCenter.finishAdds()
    precondition(Set(UNUserNotificationCenter.pending.keys) == [newRecord["id"] as! String], "obsolete completion must not remove reactivated generation's notice")
    reset()
    for osCanOpen in [false, true] {
      ShieldRuntime.canOpenApp = osCanOpen
      for interleaving in 0..<4 {
        reset()
        FreedProtectionConfigurationLock.afterFirstFlush = {
          switch interleaving {
          case 0: // reset then activation clears Bool but must not resurrect receipt
            ShieldDefaults.values["generation"] = 1
            ShieldDefaults.values[FreedProtectionResetPolicy.resetMarkerKey] = false
            ShieldDefaults.values.removeValue(forKey: "freed.pendingIntervention.record")
          case 1: ShieldDefaults.values["freed.pendingIntervention.record"] = Data("new-record".utf8)
          case 2: ShieldDefaults.failSync = true
          default: // same bytes restored cannot defeat generation fencing
            ShieldDefaults.values["generation"] = 1
          }
        }
        precondition(action() == .close && UNUserNotificationCenter.count == 0, "post-flush reset/reactivation, replacement and sync failure must not trigger side effect")
      }
    }
    reset()
    print("Production shield action: durable open, older OS fallback, nine publication failures, post-flush interleavings, delayed callback fencing passed")
  }
  static func unlockCases() {
    let h = UnlockHarness()
    let defaults = h.sharedDefaults()
    let id = UUID().uuidString.lowercased()
    let nextID = UUID().uuidString.lowercased()
    let scope = UnlockHarness.InterventionScope(kind: "ios-token", tokenType: "application", token: "c2VsZWN0ZWQ=", domain: nil)
    func stage(_ claimID: String = id, _ token: UnlockHarness.InterventionScope? = nil) {
      defaults.set(try! JSONEncoder().encode(UnlockHarness.PendingEarnedUnlockEnvelope(interventionId: claimID, scope: token ?? scope)), forKey: h.pendingEarnedUnlockScopeKey)
    }
    let expiry = h.formatIsoDate(Date().addingTimeInterval(180))
    func record(_ recordID:String, _ date:Date) {
      let record = UnlockHarness.PendingInterventionRecord(id:recordID, host:"screen-time-shield.freed.local",
        sourcePackage:"ios-screen-time", reason:"screen-time-shield", matchedRule:"native-selected-application",
        detectedAt:h.formatIsoDate(date), scope:scope)
      defaults.set(try! JSONEncoder().encode(record), forKey:h.pendingInterventionRecordKey)
    }
    let staleID = UUID().uuidString.lowercased(); record(staleID, Date().addingTimeInterval(-601))
    precondition(!h.claimPendingIntervention(staleID, stageEarnedUnlockScope:true)
      && h.pendingEarnedUnlockEnvelope() == nil && !h.isPendingInterventionConsumed(staleID), "Stale native records cannot be claimed through the direct entry point")
    precondition(h.claimPendingIntervention(staleID, stageEarnedUnlockScope:false), "Stale support records can still be consumed without unlock authority")
    let freshID = UUID().uuidString.lowercased(); record(freshID, Date())
    precondition(h.claimPendingIntervention(freshID, stageEarnedUnlockScope:true)
      && h.pendingEarnedUnlockEnvelope()?.interventionId == freshID)
    precondition(!h.claimPendingIntervention(freshID, stageEarnedUnlockScope:true), "Fresh claim is still single use")
    stage()
    FreedAppGroupsRuntime.shared.v2Active = true
    precondition(h.apply(expiry, "ios-screen-time", id)["nativeUnlockGrantAccepted"] as? Bool == false)
    precondition(h.pendingEarnedUnlockEnvelope()?.interventionId == id && h.scheduled == nil, "An active v2 window denies a fresh legacy grant without consuming its pending authority")
    FreedAppGroupsRuntime.shared.v2Active = false
    precondition(h.apply(expiry, "ios-screen-time", id)["nativeUnlockGrantAccepted"] as? Bool == true)
    precondition(h.activeEarnedUnlockExpiresAt() == expiry && h.scheduled == h.parseIsoDate(expiry), "accepted lease retains its exact expiry")
    let lease = defaults.dictionaryRepresentation().filter { $0.key.hasPrefix("freed.earnedUnlock.") }
    let monitor = h.scheduled
    func preserved(_ result: [String: Any]) {
      precondition(result["nativeUnlockGrantAccepted"] as? Bool != true)
      precondition(NSDictionary(dictionary: lease).isEqual(to: defaults.dictionaryRepresentation().filter { $0.key.hasPrefix("freed.earnedUnlock.") }), "invalid attempt must preserve existing native lease")
      precondition(h.stops == 0 && h.scheduled == monitor, "invalid attempt must preserve monitor")
    }
    preserved(h.apply(expiry, "browser.example", id))
    preserved(h.apply(expiry, "ios-screen-time", "malformed"))
    preserved(h.apply(h.formatIsoDate(Date().addingTimeInterval(600)), "ios-screen-time", id)) // replay cannot extend consumed ID
    stage(nextID); preserved(h.apply("invalid-date", "ios-screen-time", nextID))
    precondition(h.pendingEarnedUnlockEnvelope()?.interventionId == nextID, "malformed expiry must not consume staged authority")
    stage(nextID); preserved(h.apply(h.formatIsoDate(Date().addingTimeInterval(-60)), "ios-screen-time", nextID))
    precondition(h.pendingEarnedUnlockEnvelope()?.interventionId == nextID, "expired request must not consume staged authority")
    stage(nextID); preserved(h.apply(expiry, "ios-screen-time", UUID().uuidString.lowercased()))
    stage(nextID, UnlockHarness.InterventionScope(kind: "ios-token", tokenType: "application", token: "dW5zZWxlY3RlZA==", domain: nil))
    preserved(h.apply(expiry, "ios-screen-time", nextID))
    defaults.set(true, forKey: FreedProtectionResetPolicy.resetMarkerKey)
    stage(nextID)
    preserved(h.apply(expiry, "ios-screen-time", nextID))
    precondition(h.pendingEarnedUnlockEnvelope()?.interventionId == nextID, "actual consume method denies persisted reset without consuming authority")
    defaults.set(false, forKey: FreedProtectionResetPolicy.resetMarkerKey)
    h.independent = true; stage(nextID); preserved(h.apply(expiry, "ios-screen-time", nextID))
    precondition(h.pendingEarnedUnlockEnvelope()?.interventionId == nextID)
    h.independent = false; h.relockAvailable = false
    preserved(h.apply(expiry, "ios-screen-time", nextID))
    precondition(h.pendingEarnedUnlockEnvelope()?.interventionId == nextID, "Missing native expiry registration cannot consume authority or grant access")
    h.relockAvailable = true
    h.resettingProtectionConfiguration = true
    preserved(h.apply(expiry, "ios-screen-time", nextID))
    h.resettingProtectionConfiguration = false
    // The real expiry reader and refresh still clear and re-shield the expired lease.
    let shieldsBeforeExpiry = h.shieldApplications
    defaults.set(h.formatIsoDate(Date().addingTimeInterval(-1)), forKey: h.earnedUnlockExpiresAtKey)
    h.refreshEarnedUnlockWindow()
    precondition(h.activeEarnedUnlockExpiresAt() == nil && h.stops == 1 && h.shieldApplications == shieldsBeforeExpiry + 1)
    // Execute production reset notification cleanup with a delayed OS query.
    let center = UNUserNotificationCenter.current()
    func notification(_ id: String, _ generation: Int?, _ kind: String = "freed-pending-intervention") {
      let content = UNMutableNotificationContent(); content.userInfo = ["kind": kind]
      if let generation { content.userInfo["shieldGeneration"] = generation }
      center.add(UNNotificationRequest(identifier: id, content: content, trigger: UNTimeIntervalNotificationTrigger(timeInterval: 1, repeats: false)))
    }
    notification("old-shield", 0); notification("legacy-shield", nil)
    notification("unrelated", nil, "other-notice")
    UNUserNotificationCenter.delayQuery = true
    h.removePendingShieldInterventionNotifications(before: 1)
    notification("new-activation", 1)
    UNUserNotificationCenter.query?()
    precondition(Set(UNUserNotificationCenter.pending.keys) == ["unrelated", "new-activation"], "delayed reset cleanup preserves newer activation and unrelated notifications")
    print("Production native grant/refresh/wrapper: invalid grants preserve lease, actual consume reset denial, in-process reset denial, expired lease revocation; generation-scoped notification reset cleanup passed")
  }
}
