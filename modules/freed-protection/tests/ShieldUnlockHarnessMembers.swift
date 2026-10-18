  let domain = "app.freed.tests.unlock.\(UUID().uuidString)"
  let pendingInterventionClaimLock = NSLock()
  let earnedUnlockExpiresAtKey = "freed.earnedUnlock.expiresAt"
  let earnedUnlockSourceKey = "freed.earnedUnlock.source"
  let earnedUnlockScopeKey = "freed.earnedUnlock.scope"
  let earnedUnlockInterventionIdKey = "freed.earnedUnlock.interventionId"
  let pendingEarnedUnlockScopeKey = "freed.pendingIntervention.unlockScope"
  let pendingInterventionRecordKey = "freed.pendingIntervention.record"
  let pendingInterventionConsumedIdsKey = "freed.pendingIntervention.consumedIds.v1"
  let maxPendingInterventionConsumedIds = 32
  let pendingInterventionMaxAgeSeconds: TimeInterval = 10*60
  let pendingInterventionFutureSkewSeconds: TimeInterval = 60
  let screenTimeShieldSource = "ios-screen-time"
  let screenTimeShieldHost = "screen-time-shield.freed.local"
  let maxEarnedUnlockMinutes = 15
  var stops = 0
  var shieldApplications = 0
  var exclusions = 0
  var scheduled: Date?
  var authorized = true
  var resettingProtectionConfiguration = false
  func sharedDefaults() -> UserDefaults { UserDefaults(suiteName: domain)! }
  deinit { sharedDefaults().removePersistentDomain(forName: domain) }
  func statusPayload(authorized: Bool, active: Bool, scheduled: Bool, message: String) -> [String: Any] {
    ["earnedUnlockExpiresAt": activeEarnedUnlockExpiresAt() as Any, "message": message]
  }
  func isAuthorized() -> Bool { authorized }
  func isAdultFilterActive() -> Bool { true }
  func isRiskWindowMonitoringActive() -> Bool { false }
  // FamilyControls and DeviceActivity don't run on macOS. These boundaries
  // model a selected opaque token and observe scheduling; authority validation,
  // persisted envelopes, expiry, rejection and refresh are production methods.
  func isSelectedScreenTimeScope(_ scope: InterventionScope) -> Bool {
    scope.kind == "ios-token" && scope.tokenType == "application" && scope.token == "c2VsZWN0ZWQ="
  }
  func stopEarnedUnlockMonitoring() { stops += 1; scheduled = nil }
  func applySelectedShieldsForCurrentState(allowEarnedUnlock: Bool = true) { shieldApplications += 1 }
  func applySelectedShieldsExcludingEarnedUnlockScope(_ scope: InterventionScope) { exclusions += 1 }
  func scheduleEarnedUnlockRelock(expiresAt: Date) {}
  var independent = false, relockAvailable = true
  func isIndependentAppGuardActive() -> Bool { independent }
  func scheduleEarnedUnlockMonitoring(expiresAt: Date) -> Bool {
    guard relockAvailable, !sharedDefaults().bool(forKey: FreedProtectionResetPolicy.resetMarkerKey) else { return false }
    scheduled = expiresAt; return true
  }
  func isEarnedUnlockMonitoringReady(expiresAt: Date) -> Bool { scheduled == expiresAt }
  func captureEarnedUnlockMonitoringSnapshot() -> EarnedUnlockMonitoringSnapshot? {
    guard let expiresAt = activeEarnedUnlockExpiresAt(), let scheduled else { return nil }
    return EarnedUnlockMonitoringSnapshot(expiresAt: expiresAt, schedule: scheduled)
  }
  @discardableResult
  func restoreEarnedUnlockMonitoring(_ previousLease: [String: Any], snapshot: EarnedUnlockMonitoringSnapshot?) -> Bool {
    guard let snapshot, let expiry = snapshot.schedule as? Date else { invalidateActiveEarnedUnlockLease(); return false }
    scheduled = expiry; return true
  }
