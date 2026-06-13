import DeviceActivity
import FamilyControls
import Foundation
import ManagedSettings

final class DeviceActivityMonitorExtension: DeviceActivityMonitor {
  private let store = ManagedSettingsStore()
  private let appGroupIdentifier = "group.app.freed.recovery"
  private let familyActivitySelectionKey = "freed.familyActivitySelection"
  private let earnedUnlockExpiresAtKey = "freed.earnedUnlock.expiresAt"
  private let earnedUnlockSourceKey = "freed.earnedUnlock.source"
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
      clearSelectedShields()
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

    guard isScreenTimeUnlockSource(storedSource) else {
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
