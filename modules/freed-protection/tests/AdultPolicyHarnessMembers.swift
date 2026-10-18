import Foundation
struct WebDomain: Hashable {}
struct FreedProtectionResetPolicy { static let resetMarkerKey = "reset" }
enum FreedProtectionConfigurationLock {
  static var isInsideExclusiveAccess = false
  static func adultMutationEpoch(_ d:UserDefaults)throws->Int{d.integer(forKey:"freed.deviceAdult.mutationEpoch.v1")}
  @discardableResult static func fenceAdultMutations(_ d:UserDefaults)throws->Int{let n=try adultMutationEpoch(d)+1;d.set(n,forKey:"freed.deviceAdult.mutationEpoch.v1");return n}

  enum AccessError: Error {
    case unavailable, containerUnavailable, timedOut, persistenceFailed, stateUnreadable, stateVersionUnsupported
    case stateWriteFailed(Int32),stateReplaceFailed(Int32),stateReadFailed(Int32)
    var reason:String { "enforcement-state-unreadable" }
    var stage: String { "test-lock" }; var posixCode: Int32? { nil }
  }
  static func persist(_ defaults:UserDefaults)->Bool{failure == nil}
  static func diagnostics(_ error:Error?=nil,generation:Int?=nil)->[String:Any]{["stage":"test-lock"]}
  static let appGroupIdentifier = "test-domain", resetMarkerKey = "reset", generationKey = "generation"
  static var failure: AccessError?
  static var defaults: UserDefaults!
  static func generation(_ defaults: UserDefaults) -> Int { 1 }
  static func withExclusiveAccess<T>(_ body: (UserDefaults) throws -> T) throws -> T {
    if let failure { throw failure }; return try body(defaults)
  }
}
final class WebContentSettings {
  enum FilterPolicy: Equatable { case auto(Set<WebDomain>, except: Set<WebDomain>) }
  var observed: FilterPolicy?
  var acceptWrite = true
  var blockedByFilter: FilterPolicy? { get { observed } set { if acceptWrite { observed = newValue } } }
}
final class ManagedSettingsStore { let webContent = WebContentSettings() }
final class Harness {
  let store = ManagedSettingsStore()
  let defaults: UserDefaults
  let adultFilterActiveKey = "freed.adultFilterActive"
  let appGroupIdentifier = "test-domain"
  let riskWindowCurrentlyActiveKey = "night"
  var resettingProtectionConfiguration = false
  var authorized = true
  init(_ defaults: UserDefaults) { self.defaults = defaults }
  func sharedDefaults() -> UserDefaults { defaults }
  func isAuthorized() -> Bool { authorized }
  func isRiskWindowMonitoringActive() -> Bool { false }
  func applySelectedShieldsForCurrentState() {}
  func statusPayload(authorized: Bool, active: Bool, scheduled: Bool = false, message: String) -> [String:Any] {
    ["authorized":authorized,"active":active,"adultFilterActive":active,"message":message]
  }
  // PRODUCTION_METHODS
  func check() {
    defaults.set(true,forKey:adultFilterActiveKey)
    precondition(!isAdultFilterActive(), "Saved intent is not observed ManagedSettings policy")
    let result = applyAdultContentPolicy()
    precondition(result["adultWebPolicyOperationAccepted"] as? Bool == true)
    precondition(result["adultWebPolicyConfigured"] as? Bool == true)
    precondition(isAdultFilterActive())
    store.webContent.observed = nil
    store.webContent.acceptWrite = false
    let mismatch = applyAdultContentPolicy()
    precondition(mismatch["adultWebPolicyOperationAccepted"] as? Bool == false)
    precondition(mismatch["adultWebPolicyReason"] as? String == "ios-adult-policy-not-observed")
    precondition(!isAdultFilterActive())
    store.webContent.acceptWrite = true
    authorized = false
    let denied = applyAdultContentPolicy()
    precondition(denied["adultWebPolicyOperationAccepted"] as? Bool == false)
    precondition(denied["adultWebPolicyReason"] as? String == "ios-adult-policy-authorization-required")
    authorized = true
    FreedProtectionConfigurationLock.failure = .persistenceFailed
    let failed = applyAdultContentPolicy()
    precondition(failed["adultWebPolicyOperationAccepted"] as? Bool == false)
    precondition(failed["adultWebPolicyReason"] as? String == "ios-adult-policy-persistence-failed")
    FreedProtectionConfigurationLock.failure = nil
    resettingProtectionConfiguration = true
    let reset = applyAdultContentPolicy()
    precondition(reset["adultWebPolicyOperationAccepted"] as? Bool == false)
    resettingProtectionConfiguration = false
    _ = applyAdultContentPolicy()
    defaults.set(true,forKey:FreedProtectionResetPolicy.resetMarkerKey)
    applyWebContentFilterForCurrentState()
    precondition(store.webContent.blockedByFilter != nil, "13 October: app reset marker cannot remove retained adult policy")
    precondition(!isAdultFilterActive())
  }
}
let domain = "app.freed.tests.adult-policy.\(UUID().uuidString)"
let defaults = UserDefaults(suiteName:domain)!
defer { defaults.removePersistentDomain(forName:domain) }
FreedProtectionConfigurationLock.defaults = defaults
Harness(defaults).check()
print("Adult policy observed-state, acknowledgement, persistence, authorization and reset cases passed")
