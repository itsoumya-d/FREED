import Foundation

let guardTestDomain = "app.freed.tests.guard.\(UUID().uuidString)"
enum FreedProtectionResetPolicy { static let resetMarkerKey = "freed.protectionConfiguration.reset" }
struct ApplicationToken: Codable, Hashable { let id: String }
struct WebDomainToken: Codable, Hashable { let id: String }
struct ActivityCategoryToken: Codable, Hashable { let id: String }
struct WebDomain: Hashable {}
struct FamilyActivitySelection: Codable {
  var applicationTokens = Set<ApplicationToken>()
  var categoryTokens = Set<ActivityCategoryToken>()
  var webDomainTokens = Set<WebDomainToken>()
}
enum GuardCategoryPolicy: Equatable { case specific(Set<ActivityCategoryToken>, except: Set<ApplicationToken> = []) }
final class GuardShield {
  var applications: Set<ApplicationToken>?
  var applicationCategories: GuardCategoryPolicy?
  var webDomains: Set<WebDomainToken>?
  var webDomainCategories: GuardCategoryPolicy?
}
enum GuardWebFilter { case auto(Set<WebDomain>, except: Set<WebDomain>) }
final class GuardWebContent { var blockedByFilter: GuardWebFilter? }
final class GuardStore { let shield = GuardShield(); let webContent = GuardWebContent() }
typealias ManagedSettingsStore = GuardStore
struct DeviceActivityName: Hashable { let rawValue: String; init(_ name: String) { rawValue = name } }
struct DeviceActivitySchedule: Equatable {
  let intervalStart: DateComponents, intervalEnd: DateComponents, repeats: Bool
  static var shiftNextIntervalOnce = false
  var nextInterval: DateInterval? {
    guard var start = Calendar.current.date(from: intervalStart), let end = Calendar.current.date(from: intervalEnd) else { return nil }
    if Self.shiftNextIntervalOnce { Self.shiftNextIntervalOnce = false; start = start.addingTimeInterval(86400) }
    return DateInterval(start:start, end:max(start.addingTimeInterval(960),end))
  }
}
struct DeviceActivityEvent: Equatable {
  struct Name: Hashable { let rawValue: String; init(_ name: String) { rawValue = name } }
  let applications: Set<ApplicationToken>, categories: Set<ActivityCategoryToken>, webDomains: Set<WebDomainToken>
  let threshold: DateComponents
  init(applications: Set<ApplicationToken>, categories: Set<ActivityCategoryToken>, webDomains: Set<WebDomainToken>,
       threshold: DateComponents, includesPastActivity: Bool = false) {
    self.applications = applications; self.categories = categories; self.webDomains = webDomains; self.threshold = threshold
  }
}
struct DeviceActivityCenter {
  static var registered: [DeviceActivityName: DeviceActivitySchedule] = [:]
  static var registeredEvents: [DeviceActivityName: [DeviceActivityEvent.Name: DeviceActivityEvent]] = [:]
  static var failNext = false
  static var startCalls = 0
  var activities: [DeviceActivityName] { Array(Self.registered.keys) }
  func schedule(for name: DeviceActivityName) -> DeviceActivitySchedule? { Self.registered[name] }
  func events(for name: DeviceActivityName) -> [DeviceActivityEvent.Name: DeviceActivityEvent] { Self.registeredEvents[name] ?? [:] }
  func startMonitoring(_ name: DeviceActivityName, during schedule: DeviceActivitySchedule, events: [DeviceActivityEvent.Name: DeviceActivityEvent] = [:]) throws {
    Self.startCalls += 1
    if Self.failNext { Self.failNext = false; throw NSError(domain: "isolated.registration", code: 1) }
    Self.registered[name] = schedule; Self.registeredEvents[name] = events
  }
  func stopMonitoring(_ names: [DeviceActivityName]) {
    for name in names { Self.registered.removeValue(forKey: name); Self.registeredEvents.removeValue(forKey: name) }
  }
}
class DeviceActivityMonitor {
  func intervalDidStart(for activity: DeviceActivityName) {}
  func intervalDidEnd(for activity: DeviceActivityName) {}
  func eventDidReachThreshold(_ event: DeviceActivityEvent.Name, activity: DeviceActivityName) {}
}
enum MockAuthorization { case approved, denied }
final class AuthorizationCenter {
  static let shared = AuthorizationCenter()
  var authorizationStatus: MockAuthorization = .approved
}
enum FreedProtectionConfigurationLock {
  static let appGroupIdentifier = guardTestDomain, resetMarkerKey = FreedProtectionResetPolicy.resetMarkerKey, generationKey = "generation"
  static func configurationKeys(_ defaults: UserDefaults) -> [String] { Array(defaults.dictionaryRepresentation().keys) }
  static func generation(_ defaults:UserDefaults)->Int{0}
  static func persist(_ defaults:UserDefaults)->Bool{true}
  static func diagnostics(_ error:Error?=nil,generation:Int?=nil)->[String:Any]{["stage":"guard-boundary"]}
  static func sharedDefaults()->UserDefaults{UserDefaults(suiteName:guardTestDomain)!}
  static func withExclusiveAccess<T>(afterSuccessfulPersistence: ((T) -> Void)? = nil, readOnly: Bool = false, _ body: (UserDefaults) throws -> T) throws -> T {
    let defaults = UserDefaults(suiteName: guardTestDomain)!
    let result = try body(defaults); afterSuccessfulPersistence?(result); return result
  }
}

@main struct AppGuardCases {
  static func main() {
    // Explicit known native fixture baseline: no adult filter installed;
    // this consumer test does not manufacture empty authority from missing state.
    try! FreedRetainedAdultProtection.stage(.init(continuous:false, encryptedDNS:false, safari:false, riskEnabled:false), UserDefaults(suiteName:guardTestDomain)!)
    if ProcessInfo.processInfo.environment["FREED_GUARD_CASE"] == "policy" { policyCases(); return }
    leaseAuthorityCases(); policyCases(); nativeCases(); relockCases()
  }
  static func leaseAuthorityCases() {
    let h = LeaseAuthorityHarness(), center = DeviceActivityCenter()
    let a = ApplicationToken(id:"authority-a"), b = ApplicationToken(id:"authority-b")
    h.selection.applicationTokens = [a,b]
    h.sharedDefaults().set("before-use", forKey:h.appGuardModeKey)
    let scope = LeaseAuthorityHarness.InterventionScope(kind:"ios-token", tokenType:"application",
      token:try! JSONEncoder().encode(a).base64EncodedString(), domain:nil)
    let expiry = h.formatIsoDate(Date().addingTimeInterval(120))
    func storeLease() {
      h.sharedDefaults().set(expiry, forKey:h.earnedUnlockExpiresAtKey)
      h.sharedDefaults().set("ios-screen-time", forKey:h.earnedUnlockSourceKey)
      h.sharedDefaults().set(UUID().uuidString.lowercased(), forKey:h.earnedUnlockInterventionIdKey)
      h.sharedDefaults().set(try! JSONEncoder().encode(scope), forKey:h.earnedUnlockScopeKey)
    }
    let pending = Data("a-new-fresh-claim".utf8)
    h.sharedDefaults().set(pending, forKey:h.pendingEarnedUnlockScopeKey)
    center.stopMonitoring([.init(h.earnedUnlockActivityName)])
    storeLease()
    h.store.shield.applications = [b]
    let readOnlyBytes = h.sharedDefaults().dictionaryRepresentation() as NSDictionary
    let readOnlyRegistrations = DeviceActivityCenter.registered
    precondition(h.activeEarnedUnlockExpiresAt(readOnly: true) == nil
      && readOnlyBytes.isEqual(to: h.sharedDefaults().dictionaryRepresentation())
      && h.store.shield.applications == [b] && DeviceActivityCenter.registered == readOnlyRegistrations,
      "Readonly status rejects unregistered lease without mutating its metadata, shields or monitors")
    precondition(h.activeEarnedUnlockExpiresAt() == nil, "Actual central reader must reject a missing native expiry registration")
    precondition(h.store.shield.applications == [a,b], "Reader invalidation must immediately restore base shields")
    precondition(h.sharedDefaults().data(forKey:h.pendingEarnedUnlockScopeKey) == pending, "Invalidating one lease cannot erase a newer pending claim")
    storeLease(); h.store.shield.applications = [b]
    let before = DeviceActivityCenter.registered
    h.refreshEarnedUnlockWindow()
    precondition(h.activeEarnedUnlockExpiresAt() == nil && DeviceActivityCenter.registered == before
      && h.store.shield.applications == [a,b], "Actual refresh must never recreate missing expiry authority from persisted history")
    let leaseExpiry = h.parseIsoDate(expiry)!
    precondition(h.scheduleEarnedUnlockMonitoring(expiresAt:leaseExpiry))
    storeLease(); h.applySelectedShieldsForCurrentState()
    precondition(h.activeEarnedUnlockExpiresAt() == expiry && h.isEarnedUnlockActive() && h.store.shield.applications == [b])
    let starts = DeviceActivityCenter.startCalls
    h.refreshEarnedUnlockWindow()
    precondition(DeviceActivityCenter.startCalls == starts && h.store.shield.applications == [b], "Valid refresh reads existing authority without re-registering it")
    let other = DeviceActivityName("freed.appGuard.schedule.unchanged")
    try! center.startMonitoring(other, during:.init(intervalStart:.init(hour:1), intervalEnd:.init(hour:2), repeats:true))
    let guardData = Data("preserve-independent-configuration".utf8)
    h.sharedDefaults().set(guardData, forKey:FreedAppGuardSchedulePolicy.configurationKey)
    let otherSchedule = center.schedule(for:other)
    // A structurally valid but wrong expiry monitor cannot release the stored app.
    try! center.startMonitoring(.init(h.earnedUnlockActivityName), during:h.earnedUnlockRelockSchedule(expiresAt:leaseExpiry.addingTimeInterval(60)))
    h.refreshEarnedUnlockWindow()
    precondition(h.activeEarnedUnlockExpiresAt() == nil && h.store.shield.applications == [a,b]
      && center.schedule(for:other) == otherSchedule && h.sharedDefaults().data(forKey:h.pendingEarnedUnlockScopeKey) == pending)
    precondition(h.sharedDefaults().data(forKey:FreedAppGuardSchedulePolicy.configurationKey) == guardData)
    // Actual rollback is allowed only for the previously captured native rule.
    precondition(h.scheduleEarnedUnlockMonitoring(expiresAt:leaseExpiry)); storeLease()
    let snapshot = h.captureEarnedUnlockMonitoringSnapshot()!
    let previousLease = h.sharedDefaults().dictionaryRepresentation().filter { $0.key.hasPrefix("freed.earnedUnlock.") }
    try! center.startMonitoring(.init(h.earnedUnlockActivityName), during:h.earnedUnlockRelockSchedule(expiresAt:leaseExpiry.addingTimeInterval(60)))
    precondition(h.restoreEarnedUnlockMonitoring(previousLease, snapshot:snapshot))
    precondition(h.activeEarnedUnlockExpiresAt() == expiry && center.schedule(for:other) == otherSchedule)
    try! center.startMonitoring(.init(h.earnedUnlockActivityName), during:h.earnedUnlockRelockSchedule(expiresAt:leaseExpiry.addingTimeInterval(60)))
    h.independent = true; h.store.shield.applications = [b]
    DeviceActivityCenter.failNext = true
    precondition(!h.restoreEarnedUnlockMonitoring(previousLease, snapshot:snapshot))
    precondition(!h.isEarnedUnlockActive() && h.store.shield.applications == [a,b]
      && h.sharedDefaults().data(forKey:h.pendingEarnedUnlockScopeKey) == pending
      && h.sharedDefaults().data(forKey:FreedAppGuardSchedulePolicy.configurationKey) == guardData
      && center.schedule(for:other) == otherSchedule, "Failed actual rollback must revoke only the affected lease and preserve independent configuration/claims")
    h.independent = false
    precondition(h.scheduleEarnedUnlockMonitoring(expiresAt:leaseExpiry)); storeLease()
    precondition(!h.restoreEarnedUnlockMonitoring(previousLease, snapshot:nil) && !h.isEarnedUnlockActive(), "A historical expiry without a verified snapshot cannot restore authority")
    precondition(h.scheduleEarnedUnlockMonitoring(expiresAt:leaseExpiry)); storeLease()
    DeviceActivitySchedule.shiftNextIntervalOnce = true
    precondition(!h.isEarnedUnlockActive() && h.store.shield.applications == [a,b], "Central reader rejects a next-day interval fallback")
    storeLease()
    let fractional = leaseExpiry.addingTimeInterval(0.5)
    let fractionalFormatter = ISO8601DateFormatter(); fractionalFormatter.formatOptions = [.withInternetDateTime,.withFractionalSeconds]
    h.sharedDefaults().set(fractionalFormatter.string(from:fractional), forKey:h.earnedUnlockExpiresAtKey)
    try! center.startMonitoring(.init(h.earnedUnlockActivityName), during:h.earnedUnlockRelockSchedule(expiresAt:fractional))
    precondition(!h.isEarnedUnlockActive() && h.store.shield.applications == [a,b], "A subsecond early native start is not exact expiry authority")
    center.stopMonitoring([other])
    print("Actual central reader/refresh/rollback: missing or mismatched expiry, no history regrant, verified snapshot restoration, failed restoration revocation and independent state preservation passed")
  }
  static func relockCases() {
    let h = RelockHarness(), center = DeviceActivityCenter()
    let expiry = Date(timeIntervalSince1970: floor(Date().addingTimeInterval(60).timeIntervalSince1970))
    precondition(h.scheduleEarnedUnlockMonitoring(expiresAt:expiry), "Sub-15-minute application break uses a full native relock activity")
    let name = DeviceActivityName(h.earnedUnlockActivityName)
    let registered = center.schedule(for:name)!
    precondition(registered.nextInterval?.start == expiry && registered.nextInterval?.duration == 16*60)
    precondition(!registered.repeats && registered.intervalStart.year != nil && registered.intervalStart.month != nil
      && registered.intervalStart.day != nil, "Full date registration must not fall back to tomorrow's clock time")
    let old = DeviceActivityCenter.registered
    DeviceActivityCenter.failNext = true
    precondition(!h.scheduleEarnedUnlockMonitoring(expiresAt:expiry.addingTimeInterval(60)))
    precondition(DeviceActivityCenter.registered == old, "Failed relock registration preserves prior owned monitor")
    DeviceActivitySchedule.shiftNextIntervalOnce = true
    precondition(!h.scheduleEarnedUnlockMonitoring(expiresAt:expiry.addingTimeInterval(60)), "An SDK next-day interval fallback cannot authorize a break")
    precondition(DeviceActivityCenter.registered == old)
    precondition(!h.scheduleEarnedUnlockMonitoring(expiresAt:Date().addingTimeInterval(-1)))
    precondition(DeviceActivityCenter.registered == old)
    center.stopMonitoring([name]); precondition(!h.isEarnedUnlockMonitoringReady(expiresAt:expiry))
    print("Production native relock: short break installs full-date expiry-start 16-minute activity, exact readback, failed registration rollback and past/missing rejection passed")
  }
  static func policyCases() {
    var calendar = Calendar(identifier: .gregorian); calendar.timeZone = TimeZone(identifier: "America/New_York")!
    func date(_ iso: String) -> Date { ISO8601DateFormatter().date(from: iso)! }
    let overnight = FreedAppGuardSchedule(id: "sleep", enabled: true, startMinute: 23*60, endMinute: 6*60,
      days: [5], packages: [], allDay: nil)
    let work = FreedAppGuardSchedule(id: "work", enabled: true, startMinute: 5*60, endMinute: 9*60,
      days: [6], packages: [], allDay: nil)
    let weekend = FreedAppGuardSchedule(id: "weekend", enabled: true, startMinute: 0, endMinute: 0,
      days: [0,6], packages: [], allDay: true)
    let cfg = FreedAppGuardScheduleConfiguration(version: 1, targetScope: "selected-applications", schedules: [overnight,work,weekend])
    precondition(FreedAppGuardSchedulePolicy.activeIDs(cfg, at: date("2026-10-03T09:59:00Z"), calendar: calendar) == ["sleep","weekend","work"], "Overlapping windows and Friday's overnight Saturday tail")
    precondition(FreedAppGuardSchedulePolicy.activeIDs(cfg, at: date("2026-10-03T10:00:00Z"), calendar: calendar) == ["weekend","work"], "End boundary is exclusive")
    precondition(FreedAppGuardSchedulePolicy.activeIDs(cfg, at: date("2026-10-05T04:00:00Z"), calendar: calendar).isEmpty, "Weekend ends at next local midnight")
    let registrations = FreedAppGuardSchedulePolicy.registrations(cfg)
    precondition(registrations.count == 4)
    let sleep = registrations.first { $0.name.contains("sleep") }!
    precondition(sleep.intervalStart.weekday == 6 && sleep.intervalEnd.weekday == 7, "Overnight registration belongs to its start day")
    let allDays = FreedAppGuardScheduleConfiguration(version: 1, targetScope: "selected-applications", schedules: [
      .init(id:"work", enabled:true, startMinute:60, endMinute:120, days:Array(0...6), packages:[], allDay:nil)])
    precondition(FreedAppGuardSchedulePolicy.registrations(allDays).count == 1)
    precondition(FreedAppGuardSchedulePolicy.nextBoundary(cfg, after: date("2026-10-03T09:59:00Z"), calendar: calendar) == date("2026-10-03T10:00:00Z"))
    // Sunday all-day is a calendar day across the 25-hour autumn DST change.
    precondition(FreedAppGuardSchedulePolicy.activeIDs(cfg, at: date("2026-11-02T04:59:00Z"), calendar: calendar) == ["weekend"])
    precondition(FreedAppGuardSchedulePolicy.activeIDs(cfg, at: date("2026-11-02T05:00:00Z"), calendar: calendar).isEmpty)
    var payload: [String: Any] = ["version":1, "targetScope":"selected-applications", "schedules":[]]
    precondition(FreedAppGuardSchedulePolicy.decode(payload) != nil)
    for key in ["domains", "schedule", "strictGaurd"] {
      var extra = payload; extra[key] = ["adult.example"]
      precondition(FreedAppGuardSchedulePolicy.decode(extra) == nil, "Unknown top-level fields must be rejected")
    }
    let validItem:[String:Any] = ["id":"work", "enabled":true, "startMinute":60, "endMinute":120, "days":[1], "packages":[]]
    for key in ["domains", "targetScopes", "startMinutes"] {
      var extra = validItem; extra[key] = ["adult.example"]
      var cfg = payload; cfg["schedules"] = [extra]
      precondition(FreedAppGuardSchedulePolicy.decode(cfg) == nil, "Unknown schedule fields must be rejected")
    }
    payload.removeValue(forKey:"targetScope"); precondition(FreedAppGuardSchedulePolicy.decode(payload) == nil)
    payload["targetScope"] = "selected-applications"; payload["strictGuard"] = "true"
    precondition(FreedAppGuardSchedulePolicy.decode(payload) == nil, "Strict values require actual booleans")
    payload["strictGuard"] = NSNull(); precondition(FreedAppGuardSchedulePolicy.decode(payload) == nil)
    payload["strictGuard"] = true; precondition(FreedAppGuardSchedulePolicy.decode(payload)?.strictGuard == true)
    payload["schedules"] = [["id":"work", "enabled":true, "startMinute":60, "endMinute":120, "days":[1], "packages":["com.instagram.android"]]]
    precondition(FreedAppGuardSchedulePolicy.decode(payload) == nil, "Android package input can never target iOS opaque selections")
    print("Production iOS schedule policy: validation, daily collapse, overnight/overlap, exclusive boundaries, DST calendar days and explicit native target scope passed")
  }
  static func nativeCases() {
    let h = AppGuardHarness(), a = ApplicationToken(id: "chosen"), b = ApplicationToken(id: "other")
    let category = ActivityCategoryToken(id: "category"), domain = WebDomainToken(id: "adult")
    h.selection.applicationTokens = [a, b]
    h.selection.categoryTokens = [category]; h.selection.webDomainTokens = [domain]
    precondition(h.saveFamilyActivitySelection(h.selection))
    precondition(h.sharedDefaults().integer(forKey:h.selectionAppCountKey) == 2
      && h.sharedDefaults().integer(forKey:h.selectionCategoryCountKey) == 1
      && h.sharedDefaults().integer(forKey:h.selectionWebDomainCountKey) == 1)
    let appScope = AppGuardHarness.InterventionScope(kind: "ios-token", tokenType: "application",
      token: try! JSONEncoder().encode(a).base64EncodedString(), domain: nil)
    precondition(h.configuredAppGuardMode() == .dailyLimit)
    h.applySelectedShieldsForCurrentState(); precondition(h.store.shield.applications == nil)
    precondition(h.configureAppGuardMode("before-use")["appGuardModeConfigurationAccepted"] as? Bool == true)
    precondition(h.store.shield.applications == [a,b] && h.isAppGuardReady())
    precondition(h.store.shield.applicationCategories == nil && h.store.shield.webDomains == nil, "New app-only modes cannot widen scope to categories/domains")
    h.store.shield.applications = nil; precondition(!h.isAppGuardReady())
    h.applySelectedShieldsForCurrentState()
    h.lease = appScope; h.applySelectedShieldsForCurrentState(); precondition(h.store.shield.applications == [b])
    for invalid in [AppGuardHarness.InterventionScope(kind:"ios-token", tokenType:"domain", token:try! JSONEncoder().encode(domain).base64EncodedString(), domain:nil),
      AppGuardHarness.InterventionScope(kind:"ios-token", tokenType:"category", token:try! JSONEncoder().encode(category).base64EncodedString(), domain:nil),
      AppGuardHarness.InterventionScope(kind:"browser-domain", tokenType:"application", token:appScope.token, domain:"adult.example")] {
      precondition(!h.isSelectedScreenTimeScope(invalid))
      h.applySelectedShieldsExcludingEarnedUnlockScope(invalid); precondition(h.store.shield.applications == [a,b])
    }
    h.independent = true; h.sharedDefaults().set(true, forKey:h.riskWindowCurrentlyActiveKey)
    h.applySelectedShieldsForCurrentState(); precondition(h.store.shield.applications == [a,b])
    h.independent = false; h.sharedDefaults().set(false, forKey:h.riskWindowCurrentlyActiveKey); h.lease = nil
    let registered = DeviceActivityCenter.registered
    precondition(h.configureAppGuardMode("invalid")["appGuardModeConfigurationAccepted"] as? Bool == false)
    precondition(registered == DeviceActivityCenter.registered && h.configuredAppGuardMode() == .beforeUse)
    h.sharedDefaults().set(true, forKey:FreedProtectionResetPolicy.resetMarkerKey)
    let priorSelection = h.sharedDefaults().data(forKey:h.familyActivitySelectionKey)
    precondition(!h.saveFamilyActivitySelection(FamilyActivitySelection()))
    precondition(h.sharedDefaults().data(forKey:h.familyActivitySelectionKey) == priorSelection, "Passive target write cannot release reset latch or alter opaque targets")
    precondition(h.configureAppGuardMode("daily-limit")["appGuardModeConfigurationAccepted"] as? Bool == false)
    h.applySelectedShieldsForCurrentState(); precondition(h.store.shield.applications == nil && !h.isAppGuardReady())
    h.sharedDefaults().set(false, forKey:FreedProtectionResetPolicy.resetMarkerKey)
    h.authorized = false
    precondition(h.configureAppGuardMode("daily-limit")["appGuardModeConfigurationAccepted"] as? Bool == true && !h.isAppGuardReady())
    h.authorized = true; _ = h.configureAppGuardMode("daily-limit"); precondition(h.isAppGuardReady())
    DeviceActivityCenter.registered = [:]; precondition(!h.isAppGuardReady())
    _ = h.configureAppGuardMode("before-use"); DeviceActivityCenter.failNext = true
    precondition(h.configureAppGuardMode("daily-limit")["appGuardModeConfigurationAccepted"] as? Bool == false)
    precondition(h.configuredAppGuardMode() == .beforeUse && h.store.shield.applications == [a,b])
    _ = h.configureAppGuardMode("daily-limit"); h.reached = true; h.applySelectedShieldsForCurrentState()
    h.lease = appScope; h.applySelectedShieldsForCurrentState()
    precondition(h.store.shield.applications == [b] && h.store.shield.webDomains == [domain]
      && h.store.shield.applicationCategories == .specific([category], except:[a]), "Only the chosen application is exempted from the legacy category shield; every category token and domain stays protected")
    h.independent = true; h.sharedDefaults().set(true, forKey:h.riskWindowCurrentlyActiveKey)
    h.applySelectedShieldsForCurrentState()
    precondition(h.store.shield.applications == [a,b] && h.store.shield.applicationCategories == .specific([category]), "Hard overlap removes the narrow category exception")
    h.independent = false; h.sharedDefaults().set(false, forKey:h.riskWindowCurrentlyActiveKey)
    h.lease = nil
    scheduleCases(h)
    h.selection = FamilyActivitySelection(); _ = h.configureAppGuardMode("before-use")
    precondition(h.store.shield.applications == nil && !h.isAppGuardReady())
    print("Production iOS app guard: legacy threshold, immediate shields, actual readiness, app-only break, independent guard overlap, invalid/reset rejection, registration rollback and empty targets passed")
  }
  static func scheduleCases(_ h: AppGuardHarness) {
    let defaults = h.sharedDefaults()
    let center = DeviceActivityCenter()
    func payload(_ minute:Int = 60, _ strict:Bool? = nil) -> [String:Any] {
      var value:[String:Any] = ["version":1, "targetScope":"selected-applications", "schedules":[
        ["id":"work", "enabled":true, "startMinute":minute, "endMinute":minute+60, "days":Array(0...6), "packages":[]] as [String:Any]]]
      if let strict { value["strictGuard"] = strict }
      return value
    }
    let other = DeviceActivityName("another.owner")
    try! center.startMonitoring(other, during:.init(intervalStart:.init(hour:1), intervalEnd:.init(hour:2), repeats:true))
    precondition(h.configureAppSchedules(payload())["appSchedulesConfigurationAccepted"] as? Bool == true)
    precondition(h.areAppScheduleRegistrationsReady() && center.activities.contains(other))
    _ = h.configureAppGuardMode("scheduled"); precondition(h.isAppGuardReady())
    let original = defaults.data(forKey:FreedAppGuardSchedulePolicy.configurationKey)
    let previous = DeviceActivityCenter.registered
    for key in ["domains", "schedule", "strictGaurd"] {
      var extra:[String:Any] = ["version":1, "targetScope":"selected-applications", "schedules":[]]
      extra[key] = ["adult.example"]
      precondition(h.configureAppSchedules(extra)["appSchedulesConfigurationAccepted"] as? Bool == false)
      precondition(defaults.data(forKey:FreedAppGuardSchedulePolicy.configurationKey) == original
        && DeviceActivityCenter.registered == previous, "Unknown top-level input must retain old schedules and monitors")
    }
    for key in ["domains", "targetScopes", "startMinutes"] {
      var extra = payload()
      var schedule = (extra["schedules"] as! [[String:Any]])[0]
      schedule[key] = ["adult.example"]
      extra["schedules"] = [schedule]
      precondition(h.configureAppSchedules(extra)["appSchedulesConfigurationAccepted"] as? Bool == false)
      precondition(defaults.data(forKey:FreedAppGuardSchedulePolicy.configurationKey) == original
        && DeviceActivityCenter.registered == previous, "Unknown per-schedule input must retain old schedules and monitors")
    }
    DeviceActivityCenter.failNext = true
    precondition(h.configureAppSchedules(payload(180))["appSchedulesConfigurationAccepted"] as? Bool == false)
    precondition(defaults.data(forKey:FreedAppGuardSchedulePolicy.configurationKey) == original && DeviceActivityCenter.registered == previous)
    var legacy = payload(); legacy.removeValue(forKey:"targetScope")
    precondition(h.configureAppSchedules(legacy)["appSchedulesConfigurationAccepted"] as? Bool == false)
    precondition(defaults.data(forKey:FreedAppGuardSchedulePolicy.configurationKey) == original)
    precondition(h.configureAppSchedules(payload(60,true))["appSchedulesConfigurationAccepted"] as? Bool == true)
    precondition(h.isStrictAppGuardConfiguredForSelection() && h.isIndependentAppGuardActive())
    _ = h.configureAppSchedules(payload(60)); precondition(h.configuredAppSchedules()?.strictGuard == true, "Omission preserves strict latch")
    _ = h.configureAppSchedules(payload(60,false)); precondition(h.configuredAppSchedules()?.strictGuard == false, "Only explicit false clears strict layer")
    precondition(h.areAppScheduleRegistrationsReady())
    // Never spend another owner's monitoring budget or clear it on failure.
    for i in 0..<20 { try! center.startMonitoring(DeviceActivityName("other.\(i)"), during:.init(intervalStart:.init(hour:1), intervalEnd:.init(hour:2), repeats:true)) }
    let all = DeviceActivityCenter.registered
    precondition(h.configureAppSchedules(payload(180))["appSchedulesConfigurationAccepted"] as? Bool == false)
    precondition(DeviceActivityCenter.registered == all)
    center.stopMonitoring(center.activities.filter { $0.rawValue.hasPrefix("other.") })
    let now = Calendar.current.component(.hour,from:Date())*60 + Calendar.current.component(.minute,from:Date())
    let overlapping:[String:Any] = ["version":1, "targetScope":"selected-applications", "strictGuard":false,
      "schedules":["sleep","work"].map { ["id":$0, "enabled":true, "startMinute":(now+1430)%1440,
        "endMinute":(now+60)%1440, "days":Array(0...6), "packages":[]] as [String:Any] }]
    precondition(h.configureAppSchedules(overlapping)["appSchedulesConfigurationAccepted"] as? Bool == true)
    precondition(h.activeAppScheduleIDs() == ["sleep","work"])
    center.stopMonitoring([.init(FreedAppGuardSchedulePolicy.activityPrefix+"sleep.daily")])
    precondition(!h.areAppScheduleRegistrationsReady() && h.activeAppScheduleIDs() == ["work"], "Missing one window cannot release another installed independent guard")
    h.applySelectedShieldsForCurrentState(); precondition(h.store.shield.applications == h.selection.applicationTokens)
    precondition(h.configureAppSchedules(["version":1, "targetScope":"selected-applications", "schedules":[]])["appSchedulesConfigurationAccepted"] as? Bool == true)
    // Execute actual extension callbacks after restart with the same private state.
    defaults.set(try! JSONEncoder().encode(h.selection), forKey:"freed.familyActivitySelection")
    defaults.set("before-use", forKey:"freed.appGuard.mode")
    let monitor = DeviceActivityMonitorExtension()
    monitor.intervalDidEnd(for:DeviceActivityName("freed.earnedUnlockWindow"))
    precondition(monitor.store.shield.applications == h.selection.applicationTokens)
    let challenged = h.selection.applicationTokens.first!
    let scope = DeviceActivityMonitorExtension.InterventionScope(kind:"ios-token", tokenType:"application",
      token:try! JSONEncoder().encode(challenged).base64EncodedString(), domain:nil)
    let future = ISO8601DateFormatter().string(from:Date().addingTimeInterval(120))
    defaults.set(future, forKey:"freed.earnedUnlock.expiresAt")
    defaults.set(UUID().uuidString.lowercased(), forKey:"freed.earnedUnlock.interventionId")
    defaults.set("ios-screen-time", forKey:"freed.earnedUnlock.source")
    defaults.set(try! JSONEncoder().encode(scope), forKey:"freed.earnedUnlock.scope")
    precondition(RelockHarness().scheduleEarnedUnlockMonitoring(expiresAt:ISO8601DateFormatter().date(from:future)!))
    monitor.intervalDidEnd(for:DeviceActivityName("freed.earnedUnlockWindow"))
    precondition(defaults.string(forKey:"freed.earnedUnlock.expiresAt") == future
      && monitor.store.shield.applications == h.selection.applicationTokens.subtracting([challenged]), "Old queued callback cannot revoke a newer valid app lease")
    defaults.set(ISO8601DateFormatter().string(from:Date().addingTimeInterval(-1)), forKey:"freed.earnedUnlock.expiresAt")
    monitor.intervalDidStart(for:DeviceActivityName("freed.earnedUnlockWindow"))
    precondition(defaults.string(forKey:"freed.earnedUnlock.expiresAt") == nil && monitor.store.shield.applications == h.selection.applicationTokens)
    defaults.set(future, forKey:"freed.earnedUnlock.expiresAt"); defaults.set("ios-screen-time", forKey:"freed.earnedUnlock.source")
    defaults.set(UUID().uuidString.lowercased(), forKey:"freed.earnedUnlock.interventionId")
    defaults.set(try! JSONEncoder().encode(scope), forKey:"freed.earnedUnlock.scope")
    center.stopMonitoring([.init("freed.earnedUnlockWindow")])
    monitor.intervalDidEnd(for:.init("freed.earnedUnlockWindow"))
    precondition(defaults.string(forKey:"freed.earnedUnlock.expiresAt") == nil
      && monitor.store.shield.applications == h.selection.applicationTokens, "Persisted history cannot resume an app break without an actual native expiry registration")
    defaults.set(true, forKey:FreedProtectionResetPolicy.resetMarkerKey)
    monitor.eventDidReachThreshold(.init("freed.selectedAppDailyLimitReached"), activity:.init("freed.selectedAppDailyLimit"))
    precondition(monitor.store.shield.applications == nil && monitor.store.webContent.blockedByFilter == nil)
    precondition(h.configureAppSchedules(payload())["appSchedulesConfigurationAccepted"] as? Bool == false)
    defaults.set(false, forKey:FreedProtectionResetPolicy.resetMarkerKey)
    print("Production iOS schedule installer: exact registration readback, selected-token scope, rollback, strict omission/clear, other-owner preservation, activity budget and extension reset/relock callbacks passed")
  }
}
