  let domain = "app.freed.tests.authority.\(UUID().uuidString)"
  let store = GuardStore()
  let pendingInterventionClaimLock = NSLock()
  let earnedUnlockExpiresAtKey = "freed.earnedUnlock.expiresAt"
  let earnedUnlockSourceKey = "freed.earnedUnlock.source"
  let earnedUnlockScopeKey = "freed.earnedUnlock.scope"
  let earnedUnlockInterventionIdKey = "freed.earnedUnlock.interventionId"
  let earnedUnlockActivityName = "freed.earnedUnlockWindow"
  let pendingEarnedUnlockScopeKey = "freed.pendingIntervention.unlockScope"
  let appGuardModeKey = "freed.appGuard.mode"
  let screenTimeShieldHost = "screen-time-shield.freed.local"
  let screenTimeShieldSource = "ios-screen-time"
  let maxEarnedUnlockMinutes = 120
  var selection = FamilyActivitySelection()
  var independent = false
  var limitReached = false
  func sharedDefaults() -> UserDefaults { UserDefaults(suiteName: domain)! }
  deinit { sharedDefaults().removePersistentDomain(forName: domain) }
  func loadFamilyActivitySelection() -> FamilyActivitySelection { selection }
  func isIndependentAppGuardActive() -> Bool { independent }
  func isAppLimitMonitoringActive() -> Bool { true }
  func isAppLimitReachedToday() -> Bool { limitReached }
  func shouldShieldLegacyTargets() -> Bool { independent || (configuredAppGuardMode() == .dailyLimit && limitReached) }
  func makeFreedError(_ message: String) -> Error { NSError(domain:"isolated.authority", code:1) }
