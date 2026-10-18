import DeviceActivity
import FamilyControls
import Foundation
import ManagedSettings

@objc(DeviceActivityMonitorExtension)
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
  private let earnedUnlockInterventionIdKey = "freed.earnedUnlock.interventionId"
  private let screenTimeShieldHost = "screen-time-shield.freed.local"
  private let screenTimeShieldSource = "ios-screen-time"
  private let nightGuardActivityName = DeviceActivityName("freed.nightGuard")
  private let appLimitActivityName = DeviceActivityName("freed.selectedAppDailyLimit")
  private let earnedUnlockActivityName = DeviceActivityName("freed.earnedUnlockWindow")
  private let appLimitEventName = DeviceActivityEvent.Name("freed.selectedAppDailyLimitReached")
  private let adultFilterActiveKey = "freed.adultFilterActive"
  private let riskWindowCurrentlyActiveKey = "freed.riskWindow.currentlyActive"
  private let appLimitReachedDateKey = "freed.appLimit.reachedDate"
  private let resetMarkerKey = "freed.protectionConfiguration.reset"
  private let riskWindowActiveKey = "freed.riskWindowActive"
  private let appLimitMonitoringActiveKey = "freed.appLimit.active"
  private let appGuardModeKey = "freed.appGuard.mode"

  override func intervalDidStart(for activity: DeviceActivityName) {
    super.intervalDidStart(for: activity)
    if #available(iOS 16.0, *), activity.rawValue.hasPrefix(FreedAppGroupsPolicy.prefix) { FreedAppGroupsRuntime.shared.callback(activity: activity.rawValue); return }
    _ = try? FreedProtectionConfigurationLock.withExclusiveAccess(afterSuccessfulPersistence: { (publishPolicy: Bool) in
      guard publishPolicy else { return }
      self.applyWebContentFilterForCurrentState()
      // The commit callback must be read-only with respect to intent. An expiry
      // crossing here fails closed without dirtying state after its commit.
      self.applySelectedShieldsForCurrentState(allowLeaseInvalidation: false)
    }) { _ -> Bool in
      guard !isConfigurationReset() else { return true }

      if activity.rawValue.hasPrefix(FreedAppGuardSchedulePolicy.activityPrefix) {
        _ = isEarnedUnlockActive()
        return true
      }

      if activity == nightGuardActivityName {
        guard sharedDefaults().bool(forKey: riskWindowActiveKey) else { return false }
        sharedDefaults().set(true, forKey: riskWindowCurrentlyActiveKey)
        _ = isEarnedUnlockActive()
        return true
      }

      if activity == appLimitActivityName {
        guard configuredAppGuardMode() == "daily-limit", sharedDefaults().bool(forKey: appLimitMonitoringActiveKey) else { return false }
        if !isAppLimitReachedToday() {
          sharedDefaults().removeObject(forKey: appLimitReachedDateKey)
        }
        _ = isEarnedUnlockActive()
        return true
      }

      if activity == earnedUnlockActivityName {
        _ = isEarnedUnlockActive()
        return true
      }
      return false
    }
  }

  override func intervalDidEnd(for activity: DeviceActivityName) {
    super.intervalDidEnd(for: activity)
    if #available(iOS 16.0, *), activity.rawValue.hasPrefix(FreedAppGroupsPolicy.prefix) { FreedAppGroupsRuntime.shared.callback(activity: activity.rawValue); return }
    _ = try? FreedProtectionConfigurationLock.withExclusiveAccess(afterSuccessfulPersistence: { (publishPolicy: Bool) in
      guard publishPolicy else { return }
      self.applyWebContentFilterForCurrentState()
      // The commit callback must be read-only with respect to intent. An expiry
      // crossing here fails closed without dirtying state after its commit.
      self.applySelectedShieldsForCurrentState(allowLeaseInvalidation: false)
    }) { _ -> Bool in
      guard !isConfigurationReset() else { return true }

      if activity.rawValue.hasPrefix(FreedAppGuardSchedulePolicy.activityPrefix) {
        _ = isEarnedUnlockActive()
        return true
      }

      if activity == nightGuardActivityName {
        guard sharedDefaults().bool(forKey: riskWindowActiveKey) else { return false }
        sharedDefaults().set(false, forKey: riskWindowCurrentlyActiveKey)
        _ = isEarnedUnlockActive()
        return true
      }

      if activity == appLimitActivityName {
        guard configuredAppGuardMode() == "daily-limit", sharedDefaults().bool(forKey: appLimitMonitoringActiveKey) else { return false }
        sharedDefaults().removeObject(forKey: appLimitReachedDateKey)
        _ = isEarnedUnlockActive()
        return true
      }

      if activity == earnedUnlockActivityName {
        // A delayed old callback cannot clear a newer validated lease. The
        // persisted expiry reader owns revocation, rather than callback age.
        _ = isEarnedUnlockActive()
        return true
      }
      return false
    }
  }

  override func eventDidReachThreshold(_ event: DeviceActivityEvent.Name, activity: DeviceActivityName) {
    super.eventDidReachThreshold(event, activity: activity)
    if #available(iOS 16.0, *), activity.rawValue.hasPrefix(FreedAppGroupsPolicy.prefix) { FreedAppGroupsRuntime.shared.callback(activity: activity.rawValue, event: event.rawValue); return }
    _ = try? FreedProtectionConfigurationLock.withExclusiveAccess(afterSuccessfulPersistence: { (publishPolicy: Bool) in
      guard publishPolicy else { return }
      self.applyWebContentFilterForCurrentState()
      self.applySelectedShieldsForCurrentState(allowLeaseInvalidation: false)
    }) { _ -> Bool in
      guard !isConfigurationReset() else { return true }

      guard activity == appLimitActivityName, event == appLimitEventName else {
        return false
      }
      guard configuredAppGuardMode() == "daily-limit", sharedDefaults().bool(forKey: appLimitMonitoringActiveKey) else { return false }

      sharedDefaults().set(localDateKey(), forKey: appLimitReachedDateKey)
      _ = isEarnedUnlockActive()
      return true
    }
  }

  private func sharedDefaults() -> UserDefaults {
    FreedProtectionConfigurationLock.sharedDefaults()
  }

  private func isConfigurationReset() -> Bool {
    sharedDefaults().bool(forKey: resetMarkerKey)
  }

  private func clearOwnedProtection() {
    clearSelectedShields()
    applyWebContentFilterForCurrentState()
  }

  private func configuredAppGuardMode() -> String {
    guard let value = sharedDefaults().string(forKey: appGuardModeKey) else { return "daily-limit" }
    return ["before-use", "daily-limit", "scheduled"].contains(value) ? value : "before-use"
  }

  private func isIndependentAppGuardActive() -> Bool {
    isRiskWindowCurrentlyActive() || isStrictAppGuardConfiguredForSelection() || !activeAppScheduleIDs().isEmpty
  }

  private func isStrictAppGuardConfiguredForSelection() -> Bool {
    guard !isConfigurationReset() else { return false }
    if #available(iOS 16.0, *) {
      guard AuthorizationCenter.shared.authorizationStatus == .approved,
        FreedAppGuardSchedulePolicy.decode(sharedDefaults().data(forKey: FreedAppGuardSchedulePolicy.configurationKey))?.strictGuard == true,
        let data = sharedDefaults().data(forKey: familyActivitySelectionKey),
        let selection = try? JSONDecoder().decode(FamilyActivitySelection.self, from: data) else { return false }
      return !selection.applicationTokens.isEmpty
    }
    return false
  }

  private func activeAppScheduleIDs() -> [String] {
    guard !isConfigurationReset() else { return [] }
    if #available(iOS 16.0, *) {
      guard AuthorizationCenter.shared.authorizationStatus == .approved,
        let configuration = FreedAppGuardSchedulePolicy.decode(sharedDefaults().data(forKey: FreedAppGuardSchedulePolicy.configurationKey)),
        let data = sharedDefaults().data(forKey: familyActivitySelectionKey),
        let selection = try? JSONDecoder().decode(FamilyActivitySelection.self, from: data),
        !selection.applicationTokens.isEmpty else { return [] }
      let center = DeviceActivityCenter()
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
    return []
  }

  private func shouldShieldLegacyTargets() -> Bool {
    isRiskWindowCurrentlyActive() || (configuredAppGuardMode() == "daily-limit" && isAppLimitReachedToday())
  }

  private func applySelectedShieldsForCurrentState(allowLeaseInvalidation: Bool = true) {
    guard !isConfigurationReset() else { clearOwnedProtection(); return }
    if isIndependentAppGuardActive() { applySelectedShieldsIfAvailable(); return }
    let shouldShield = configuredAppGuardMode() == "before-use"
      || (configuredAppGuardMode() == "daily-limit" && isAppLimitReachedToday())
    guard shouldShield else { clearSelectedShields(); return }
    if isEarnedUnlockActive(allowInvalidation: allowLeaseInvalidation), let scope = activeEarnedUnlockScope() {
      applySelectedShieldsExcludingEarnedUnlockScope(scope)
      return
    }
    applySelectedShieldsIfAvailable()
  }

  @discardableResult
  private func applyWebContentFilterForCurrentState() -> Bool {
    guard let policy = try? FreedRetainedAdultProtection.read(sharedDefaults()) else { return false }
    // Hosted DNS was activated by an exact native permit. An extension cannot
    // inspect host DNS Keychain/settings or recreate that authority. Preserve
    // both its current nil state and any stronger .auto installed by repair.
    if policy.hostedRecoveryDns != nil { return true }
    guard let requested = try? FreedRetainedAdultProtection.filterDecision(sharedDefaults()) else { return false }
    if requested {
      store.webContent.blockedByFilter = .auto(Set<WebDomain>(), except: Set<WebDomain>())
    } else {
      store.webContent.blockedByFilter = nil
    }
    return store.webContent.blockedByFilter == (requested ? .auto(Set<WebDomain>(), except: Set<WebDomain>()) : nil)
  }

  private func applySelectedShieldsIfAvailable() {
    guard !isConfigurationReset() else { clearOwnedProtection(); return }
    guard
      let data = sharedDefaults().data(forKey: familyActivitySelectionKey),
      let selection = try? JSONDecoder().decode(FamilyActivitySelection.self, from: data)
    else {
      clearSelectedShields()
      return
    }

    let adopted = { if #available(iOS 16.0, *) { return FreedAppGroupsRuntime.legacyAppsAdopted(self.sharedDefaults()) }; return false }()
    store.shield.applications = selection.applicationTokens.isEmpty || adopted && !isIndependentAppGuardActive() ? nil : selection.applicationTokens
    let legacyTargets = shouldShieldLegacyTargets()
    store.shield.applicationCategories = !legacyTargets || selection.categoryTokens.isEmpty ? nil : .specific(selection.categoryTokens)
    store.shield.webDomains = !legacyTargets || selection.webDomainTokens.isEmpty ? nil : selection.webDomainTokens
    store.shield.webDomainCategories = !legacyTargets || selection.categoryTokens.isEmpty ? nil : .specific(selection.categoryTokens)
  }

  private func applySelectedShieldsExcludingEarnedUnlockScope(_ scope: InterventionScope) {
    guard !isConfigurationReset() else { clearOwnedProtection(); return }
    guard !isIndependentAppGuardActive(), isSelectedScreenTimeScope(scope),
      let data = sharedDefaults().data(forKey: familyActivitySelectionKey),
      let selection = try? JSONDecoder().decode(FamilyActivitySelection.self, from: data),
      let encodedToken = scope.token, let tokenData = Data(base64Encoded: encodedToken),
      let token = try? JSONDecoder().decode(ApplicationToken.self, from: tokenData) else {
      applySelectedShieldsIfAvailable()
      return
    }
    let remainingApplications = selection.applicationTokens.subtracting([token])
    store.shield.applications = remainingApplications.isEmpty ? nil : remainingApplications
    let legacyTargets = shouldShieldLegacyTargets()
    store.shield.applicationCategories = !legacyTargets || selection.categoryTokens.isEmpty
      ? nil : .specific(selection.categoryTokens, except: Set<ApplicationToken>([token]))
    store.shield.webDomains = !legacyTargets || selection.webDomainTokens.isEmpty ? nil : selection.webDomainTokens
    store.shield.webDomainCategories = !legacyTargets || selection.categoryTokens.isEmpty ? nil : .specific(selection.categoryTokens)
  }

  private func isRiskWindowCurrentlyActive() -> Bool {
    !isConfigurationReset() && sharedDefaults().bool(forKey: riskWindowActiveKey)
      && sharedDefaults().bool(forKey: riskWindowCurrentlyActiveKey)
  }

  private func isAdultFilterActive() -> Bool {
    !isConfigurationReset() && sharedDefaults().bool(forKey: adultFilterActiveKey)
  }

  private func isAppLimitReachedToday() -> Bool {
    !isConfigurationReset() && sharedDefaults().bool(forKey: appLimitMonitoringActiveKey)
      && sharedDefaults().string(forKey: appLimitReachedDateKey) == localDateKey()
  }

  private func localDateKey() -> String {
    let formatter = DateFormatter()
    formatter.calendar = Calendar(identifier: .gregorian)
    formatter.locale = Locale(identifier: "en_US_POSIX")
    formatter.timeZone = TimeZone.current
    formatter.dateFormat = "yyyy-MM-dd"
    return formatter.string(from: Date())
  }

  private func isEarnedUnlockActive(allowInvalidation: Bool = true) -> Bool {
    guard !isConfigurationReset() else { return false }
    let defaults = sharedDefaults()
    let storedSource = defaults.string(forKey: earnedUnlockSourceKey)
    let storedExpiresAt = defaults.string(forKey: earnedUnlockExpiresAtKey)

    guard storedSource != nil || storedExpiresAt != nil else {
      return false
    }

    guard isScreenTimeUnlockSource(storedSource),
      let interventionID = defaults.string(forKey: earnedUnlockInterventionIdKey), UUID(uuidString: interventionID) != nil,
      let scope = activeEarnedUnlockScope(), isSelectedScreenTimeScope(scope) else {
      if allowInvalidation { clearEarnedUnlockState() }
      return false
    }

    guard
      let expiresAt = storedExpiresAt,
      let expiry = parseIsoDate(expiresAt)
    else {
      if allowInvalidation { clearEarnedUnlockState() }
      return false
    }

    if expiry > Date() {
      guard hasNativeEarnedUnlockRelock(expiresAt: expiry) else {
        if allowInvalidation { clearEarnedUnlockState() }
        return false
      }
      return true
    }

    if allowInvalidation { clearEarnedUnlockState() }
    return false
  }

  private func hasNativeEarnedUnlockRelock(expiresAt: Date) -> Bool {
    let center = DeviceActivityCenter()
    let plan = FreedAppGuardSchedulePolicy.relockRegistration(expiresAt: expiresAt)
    let expected = DeviceActivitySchedule(intervalStart: plan.intervalStart, intervalEnd: plan.intervalEnd, repeats: false)
    guard center.activities.contains(earnedUnlockActivityName), center.schedule(for: earnedUnlockActivityName) == expected,
      let start = center.schedule(for: earnedUnlockActivityName)?.nextInterval?.start else { return false }
    return start == expiresAt
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
    defaults.removeObject(forKey: earnedUnlockInterventionIdKey)
  }

  private func activeEarnedUnlockScope() -> InterventionScope? {
    guard let data = sharedDefaults().data(forKey: earnedUnlockScopeKey) else { return nil }
    return try? JSONDecoder().decode(InterventionScope.self, from: data)
  }

  private func isSelectedScreenTimeScope(_ scope: InterventionScope) -> Bool {
    guard scope.kind == "ios-token", scope.tokenType == "application", scope.domain == nil,
      let selectionData = sharedDefaults().data(forKey: familyActivitySelectionKey),
      let selection = try? JSONDecoder().decode(FamilyActivitySelection.self, from: selectionData),
      let encodedToken = scope.token, encodedToken.count <= 8_192,
      let tokenData = Data(base64Encoded: encodedToken) else { return false }
    return (try? JSONDecoder().decode(ApplicationToken.self, from: tokenData)).map(selection.applicationTokens.contains) ?? false
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
