  let appGuardModeKey = "freed.appGuard.mode"
  let familyActivitySelectionKey = "freed.familyActivitySelection", selectionAppCountKey = "freed.selection.appCount"
  let selectionCategoryCountKey = "freed.selection.categoryCount", selectionWebDomainCountKey = "freed.selection.webDomainCount"
  let appLimitEventName = "freed.selectedAppDailyLimitReached"
  let appLimitActivityName = "freed.selectedAppDailyLimit"
  let domain = guardTestDomain
  let store = GuardStore()
  var selection = FamilyActivitySelection()
  var authorized = true, supported = true, independent = false, limitActive = false, reached = false
  var lease: InterventionScope?
  func sharedDefaults() -> UserDefaults { UserDefaults(suiteName: domain)! }
  deinit { sharedDefaults().removePersistentDomain(forName: domain) }
  func isAuthorized() -> Bool { authorized }
  func hasAppGuardModes() -> Bool { supported }
  func isAdultFilterActive() -> Bool { true }
  let riskWindowCurrentlyActiveKey = "freed.riskWindow.currentlyActive"
  func isRiskWindowMonitoringActive() -> Bool { independent }
  func isAppLimitMonitoringActive() -> Bool { limitActive }
  func isAppLimitReachedToday() -> Bool { reached }
  func isEarnedUnlockActive() -> Bool { lease != nil }
  // Same observation as this framework stand-in's existing lease predicate.
  func activeEarnedUnlockExpiresAt(readOnly: Bool = false) -> String? { lease == nil ? nil : "observed-native-fixture" }
  func activeEarnedUnlockScope() -> InterventionScope? { lease }
  func loadFamilyActivitySelection() -> FamilyActivitySelection { selection }
  func decodedScopeTokenData(_ scope: InterventionScope) -> Data? {
    guard let encoded = scope.token, encoded.count <= 8_192 else { return nil }
    return Data(base64Encoded: encoded)
  }
  func clearSelectedShields() {
    store.shield.applications = nil; store.shield.applicationCategories = nil
    store.shield.webDomains = nil; store.shield.webDomainCategories = nil
  }
  func applySelectedShieldsIfAvailable() {
    store.shield.applications = selection.applicationTokens.isEmpty ? nil : selection.applicationTokens
    let legacy = shouldShieldLegacyTargets()
    store.shield.applicationCategories = !legacy || selection.categoryTokens.isEmpty ? nil : .specific(selection.categoryTokens)
    store.shield.webDomains = !legacy || selection.webDomainTokens.isEmpty ? nil : selection.webDomainTokens
    store.shield.webDomainCategories = !legacy || selection.categoryTokens.isEmpty ? nil : .specific(selection.categoryTokens)
  }
  func setAppLimitMonitoringActive(_ value: Bool) { limitActive = value }
  func configuredDailyLimitMinutes() -> Int { 20 }
  func sanitizeDailyLimitMinutes(_ value: Int?) -> Int { min(240, max(5, value ?? 20)) }
  func makeFreedError(_ message: String) -> Error { NSError(domain: "isolated.guard", code: 1) }
  func statusPayload(authorized: Bool, active: Bool, scheduled: Bool, message: String) -> [String: Any] {
    ["appGuardMode": configuredAppGuardMode().rawValue, "appGuardReady": isAppGuardReady(),
     "appSchedulesServiceConnected": areAppScheduleRegistrationsReady(), "activeAppScheduleIds": activeAppScheduleIDs()]
  }
