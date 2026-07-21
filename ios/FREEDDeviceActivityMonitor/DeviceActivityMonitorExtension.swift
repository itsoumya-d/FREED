import DeviceActivity
import FamilyControls
import Foundation
import ManagedSettings

final class DeviceActivityMonitorExtension: DeviceActivityMonitor {
  private struct InterventionScope: Codable {
    let kind: String
    let tokenType: String?
    let token: String?
    let domain: String?
  }

  private let store = ManagedSettingsStore()
  private let appGroupIdentifier = "group.app.freed.recovery"
  private let familyActivitySelectionKey = "freed.familyActivitySelection"
  private let earnedUnlockExpiresAtKey = "freed.earnedUnlock.expiresAt"
  private let earnedUnlockSourceKey = "freed.earnedUnlock.source"
  private let earnedUnlockScopeKey = "freed.earnedUnlock.scope"
  private let screenTimeShieldHost = "screen-time-shield.freed.local"
  private let screenTimeShieldSource = "ios-screen-time"
  private let nightGuardActivityName = DeviceActivityName("freed.nightGuard")
  private let appLimitActivityName = DeviceActivityName("freed.selectedAppDailyLimit")
  private let earnedUnlockActivityName = DeviceActivityName("freed.earnedUnlockWindow")
  private let appLimitEventName = DeviceActivityEvent.Name("freed.selectedAppDailyLimitReached")
  private let adultFilterActiveKey = "freed.adultFilterActive"
  private let riskWindowCurrentlyActiveKey = "freed.riskWindow.currentlyActive"
  private let appLimitReachedDateKey = "freed.appLimit.reachedDate"

  override func intervalDidStart(for activity: DeviceActivityName) {
    super.intervalDidStart(for: activity)

    if activity == nightGuardActivityName {
      sharedDefaults().set(true, forKey: riskWindowCurrentlyActiveKey)
      applyWebContentFilterForCurrentState()
      applySelectedShieldsForCurrentState()
      return
    }

    if activity == appLimitActivityName {
      if !isAppLimitReachedToday() {
        sharedDefaults().removeObject(forKey: appLimitReachedDateKey)
      }
      applySelectedShieldsForCurrentState()
      return
    }

    if activity == earnedUnlockActivityName {
      applySelectedShieldsForCurrentState()
    }
  }

  override func intervalDidEnd(for activity: DeviceActivityName) {
    super.intervalDidEnd(for: activity)

    if activity == nightGuardActivityName {
      sharedDefaults().set(false, forKey: riskWindowCurrentlyActiveKey)
      applyWebContentFilterForCurrentState()
      applySelectedShieldsForCurrentState()
      return
    }

    if activity == appLimitActivityName {
      sharedDefaults().removeObject(forKey: appLimitReachedDateKey)
      applySelectedShieldsForCurrentState()
      return
    }

    if activity == earnedUnlockActivityName {
      clearEarnedUnlockState()
      applySelectedShieldsForCurrentState()
    }
  }

  override func eventDidReachThreshold(_ event: DeviceActivityEvent.Name, activity: DeviceActivityName) {
    super.eventDidReachThreshold(event, activity: activity)

    guard activity == appLimitActivityName, event == appLimitEventName else {
      return
    }

    sharedDefaults().set(localDateKey(), forKey: appLimitReachedDateKey)
    applySelectedShieldsForCurrentState()
  }

  private func sharedDefaults() -> UserDefaults {
    UserDefaults(suiteName: appGroupIdentifier) ?? UserDefaults.standard
  }

  private func applySelectedShieldsForCurrentState() {
    if isEarnedUnlockActive() {
      if let scope = activeEarnedUnlockScope() {
        applySelectedShieldsExcludingEarnedUnlockScope(scope)
      }
      return
    }

    guard isRiskWindowCurrentlyActive() || isAppLimitReachedToday() else {
      clearSelectedShields()
      return
    }

    applySelectedShieldsIfAvailable()
  }

  private func applyWebContentFilterForCurrentState() {
    if isAdultFilterActive() || isRiskWindowCurrentlyActive() {
      store.webContent.blockedByFilter = .auto(Set<WebDomain>(), except: Set<WebDomain>())
    } else {
      store.webContent.blockedByFilter = nil
    }
  }

  private func applySelectedShieldsIfAvailable() {

    guard
      let data = sharedDefaults().data(forKey: familyActivitySelectionKey),
      let selection = try? JSONDecoder().decode(FamilyActivitySelection.self, from: data)
    else {
      clearSelectedShields()
      return
    }

    store.shield.applications = selection.applicationTokens.isEmpty ? nil : selection.applicationTokens
    store.shield.applicationCategories = selection.categoryTokens.isEmpty ? nil : .specific(selection.categoryTokens)
    store.shield.webDomains = selection.webDomainTokens.isEmpty ? nil : selection.webDomainTokens
    store.shield.webDomainCategories = selection.categoryTokens.isEmpty ? nil : .specific(selection.categoryTokens)
  }

  private func applySelectedShieldsExcludingEarnedUnlockScope(_ scope: InterventionScope) {
    guard
      let data = sharedDefaults().data(forKey: familyActivitySelectionKey),
      let selection = try? JSONDecoder().decode(FamilyActivitySelection.self, from: data),
      let tokenType = scope.tokenType,
      let encodedToken = scope.token,
      encodedToken.count <= 8_192,
      let tokenData = Data(base64Encoded: encodedToken)
    else {
      applySelectedShieldsIfAvailable()
      return
    }

    var remainingApplications = selection.applicationTokens
    var remainingCategories = selection.categoryTokens
    var remainingWebDomains = selection.webDomainTokens

    switch tokenType {
    case "application":
      guard let token = try? JSONDecoder().decode(ApplicationToken.self, from: tokenData) else { return }
      remainingApplications = selection.applicationTokens.subtracting([token])
    case "domain":
      guard let token = try? JSONDecoder().decode(WebDomainToken.self, from: tokenData) else { return }
      remainingWebDomains = selection.webDomainTokens.subtracting([token])
    case "category":
      guard let token = try? JSONDecoder().decode(ActivityCategoryToken.self, from: tokenData) else { return }
      remainingCategories = selection.categoryTokens.subtracting([token])
    default:
      return
    }

    store.shield.applications = remainingApplications.isEmpty ? nil : remainingApplications
    store.shield.applicationCategories = remainingCategories.isEmpty ? nil : .specific(remainingCategories)
    store.shield.webDomains = remainingWebDomains.isEmpty ? nil : remainingWebDomains
    store.shield.webDomainCategories = remainingCategories.isEmpty ? nil : .specific(remainingCategories)
  }

  private func isRiskWindowCurrentlyActive() -> Bool {
    sharedDefaults().bool(forKey: riskWindowCurrentlyActiveKey)
  }

  private func isAdultFilterActive() -> Bool {
    sharedDefaults().bool(forKey: adultFilterActiveKey)
  }

  private func isAppLimitReachedToday() -> Bool {
    sharedDefaults().string(forKey: appLimitReachedDateKey) == localDateKey()
  }

  private func localDateKey() -> String {
    let formatter = DateFormatter()
    formatter.calendar = Calendar(identifier: .gregorian)
    formatter.locale = Locale(identifier: "en_US_POSIX")
    formatter.timeZone = TimeZone.current
    formatter.dateFormat = "yyyy-MM-dd"
    return formatter.string(from: Date())
  }

  private func isEarnedUnlockActive() -> Bool {
    let defaults = sharedDefaults()
    let storedSource = defaults.string(forKey: earnedUnlockSourceKey)
    let storedExpiresAt = defaults.string(forKey: earnedUnlockExpiresAtKey)

    guard storedSource != nil || storedExpiresAt != nil else {
      return false
    }

    guard isScreenTimeUnlockSource(storedSource), let scope = activeEarnedUnlockScope(), isSelectedScreenTimeScope(scope) else {
      clearEarnedUnlockState()
      return false
    }

    guard
      let expiresAt = storedExpiresAt,
      let expiry = parseIsoDate(expiresAt)
    else {
      clearEarnedUnlockState()
      return false
    }

    if expiry > Date() {
      return true
    }

    clearEarnedUnlockState()
    return false
  }

  private func isScreenTimeUnlockSource(_ source: String?) -> Bool {
    guard
      let trimmed = source?.trimmingCharacters(in: .whitespacesAndNewlines).lowercased(),
      !trimmed.isEmpty
    else {
      return false
    }

    return trimmed == screenTimeShieldHost || trimmed == screenTimeShieldSource
  }

  private func clearEarnedUnlockState() {
    let defaults = sharedDefaults()
    defaults.removeObject(forKey: earnedUnlockExpiresAtKey)
    defaults.removeObject(forKey: earnedUnlockSourceKey)
    defaults.removeObject(forKey: earnedUnlockScopeKey)
  }

  private func activeEarnedUnlockScope() -> InterventionScope? {
    guard let data = sharedDefaults().data(forKey: earnedUnlockScopeKey) else { return nil }
    return try? JSONDecoder().decode(InterventionScope.self, from: data)
  }

  private func isSelectedScreenTimeScope(_ scope: InterventionScope) -> Bool {
    guard
      scope.kind == "ios-token",
      let selectionData = sharedDefaults().data(forKey: familyActivitySelectionKey),
      let selection = try? JSONDecoder().decode(FamilyActivitySelection.self, from: selectionData),
      let tokenType = scope.tokenType,
      let encodedToken = scope.token,
      encodedToken.count <= 8_192,
      let tokenData = Data(base64Encoded: encodedToken)
    else {
      return false
    }

    switch tokenType {
    case "application":
      return (try? JSONDecoder().decode(ApplicationToken.self, from: tokenData)).map(selection.applicationTokens.contains) ?? false
    case "domain":
      return (try? JSONDecoder().decode(WebDomainToken.self, from: tokenData)).map(selection.webDomainTokens.contains) ?? false
    case "category":
      return (try? JSONDecoder().decode(ActivityCategoryToken.self, from: tokenData)).map(selection.categoryTokens.contains) ?? false
    default:
      return false
    }
  }

  private func parseIsoDate(_ value: String) -> Date? {
    let fractional = ISO8601DateFormatter()
    fractional.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
    if let date = fractional.date(from: value) {
      return date
    }

    return ISO8601DateFormatter().date(from: value)
  }

  private func clearSelectedShields() {
    store.shield.applications = nil
    store.shield.applicationCategories = nil
    store.shield.webDomains = nil
    store.shield.webDomainCategories = nil
  }
}
