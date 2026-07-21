import ExpoModulesCore
import Foundation

#if canImport(Vision)
import Vision
#endif

#if canImport(UIKit)
import UIKit
#endif

#if canImport(SwiftUI)
import SwiftUI
#endif

#if canImport(FamilyControls)
import FamilyControls
#endif

#if canImport(DeviceActivity)
import DeviceActivity
#endif

#if canImport(ManagedSettings)
import ManagedSettings
#endif

#if canImport(SafariServices)
import SafariServices
#endif

public class FreedProtectionModule: Module {
  private struct InterventionScope: Codable {
    let kind: String
    let tokenType: String?
    let token: String?
    let domain: String?
  }

  private struct PendingInterventionRecord: Codable {
    let id: String
    let host: String
    let sourcePackage: String
    let reason: String
    let matchedRule: String
    let detectedAt: String
    let scope: InterventionScope?
  }

  #if canImport(ManagedSettings)
  private let store = ManagedSettingsStore()
  #endif
  private let adultFilterActiveKey = "freed.adultFilterActive"
  private let riskWindowActiveKey = "freed.riskWindowActive"
  private let riskWindowCurrentlyActiveKey = "freed.riskWindow.currentlyActive"
  private let riskWindowActivityName = "freed.nightGuard"
  private let appLimitMonitoringActiveKey = "freed.appLimit.active"
  private let appLimitDailyMinutesKey = "freed.appLimit.dailyMinutes"
  private let appLimitActivityName = "freed.selectedAppDailyLimit"
  private let appLimitEventName = "freed.selectedAppDailyLimitReached"
  private let appLimitReachedDateKey = "freed.appLimit.reachedDate"
  private let appGroupIdentifier = "group.app.freed.recovery"
  private let photoMatchMinConfidence = 0.45
  private let maxEarnedUnlockMinutes = 120
  private let familyActivitySelectionKey = "freed.familyActivitySelection"
  private let selectionAppCountKey = "freed.selection.appCount"
  private let selectionCategoryCountKey = "freed.selection.categoryCount"
  private let selectionWebDomainCountKey = "freed.selection.webDomainCount"
  private let pendingInterventionRecordKey = "freed.pendingIntervention.record"
  private let pendingEarnedUnlockScopeKey = "freed.pendingIntervention.unlockScope"
  private let pendingInterventionMaxAgeSeconds: TimeInterval = 10 * 60
  private let pendingInterventionFutureSkewSeconds: TimeInterval = 60
  private let screenTimeShieldHost = "screen-time-shield.freed.local"
  private let screenTimeShieldSource = "ios-screen-time"
  private let earnedUnlockExpiresAtKey = "freed.earnedUnlock.expiresAt"
  private let earnedUnlockSourceKey = "freed.earnedUnlock.source"
  private let earnedUnlockScopeKey = "freed.earnedUnlock.scope"
  private let earnedUnlockActivityName = "freed.earnedUnlockWindow"
  private let safariContentBlockerIdentifier = "app.freed.recovery.safari-content-blocker"
  private let safariContentBlockerRulesFileName = "safari-content-blocker-rules.json"
  private let safariContentBlockerVersionKey = "freed.safariContentBlocker.version"
  private let safariContentBlockerChecksumKey = "freed.safariContentBlocker.checksum"
  private let safariContentBlockerGeneratedAtKey = "freed.safariContentBlocker.generatedAt"
  private let safariContentBlockerRuleCountKey = "freed.safariContentBlocker.ruleCount"
  private let safariContentBlockerLastReloadErrorKey = "freed.safariContentBlocker.lastReloadError"
  private let safariContentBlockerStateKnownKey = "freed.safariContentBlocker.stateKnown"
  private let safariContentBlockerEnabledKey = "freed.safariContentBlocker.enabled"
  private let safariContentBlockerStateCheckedAtKey = "freed.safariContentBlocker.stateCheckedAt"
  private let safariContentBlockerStateErrorKey = "freed.safariContentBlocker.stateError"

  public func definition() -> ModuleDefinition {
    Name("FreedProtection")

    AsyncFunction("getCapabilities") { () -> [String: Any] in
      return [
        "platform": "ios",
        "screenTime": self.hasFamilyControls(),
        "managedSettings": self.hasManagedSettings(),
        "accessibility": false,
        "dnsFiltering": false,
        "safariContentBlocker": self.hasSafariContentBlocker(),
        "localVpnFallback": false,
        "notes": [
          "Uses Apple FamilyControls authorization when entitlement is granted.",
          "Uses ManagedSettings web content policy for adult filtering.",
          "Uses Safari extensions with explicit host access for adult-domain and short-form web protection.",
          "Shield and DeviceActivity extensions must be added as app targets before App Store release."
        ]
      ]
    }

    AsyncFunction("getStatus") { () async -> [String: Any] in
      self.refreshEarnedUnlockWindow()
      await self.refreshSafariContentBlockerStateIfAvailable()
      let authorized = self.isAuthorized()
      let filterActive = authorized && self.isAdultFilterActive()
      let riskWindowActive = authorized && self.isRiskWindowMonitoringActive()
      return self.statusPayload(
        authorized: authorized,
        active: filterActive,
        scheduled: riskWindowActive,
        message: filterActive
          ? "Screen Time adult-content web filter is active."
          : riskWindowActive
          ? "Night Guard is scheduled. FREED will apply Screen Time filtering during the risk window."
          : authorized
          ? "Screen Time authorization is available. Apply the adult-content web filter to activate protection."
          : "Screen Time authorization has not been granted."
      )
    }

    AsyncFunction("configureSafariContentBlockerRules") { (rulesJson: String, version: String, checksum: String, generatedAt: String) async -> [String: Any] in
      do {
        let ruleCount = try self.configureSafariContentBlockerRulesFile(
          rulesJson: rulesJson,
          version: version,
          checksum: checksum,
          generatedAt: generatedAt
        )
        await self.reloadSafariContentBlocker()
        await self.refreshSafariContentBlockerStateIfAvailable()
        return self.statusPayload(
          authorized: self.isAuthorized(),
          active: self.isAuthorized() && self.isAdultFilterActive(),
          scheduled: self.isRiskWindowMonitoringActive(),
          message: "Safari adult-domain blocker synced with \(ruleCount) entries. Short-form web paths are handled by Safari Focus Shield."
        )
      } catch {
        self.sharedDefaults().set(error.localizedDescription, forKey: self.safariContentBlockerLastReloadErrorKey)
        return self.statusPayload(
          authorized: self.isAuthorized(),
          active: self.isAuthorized() && self.isAdultFilterActive(),
          scheduled: self.isRiskWindowMonitoringActive(),
          message: "Safari Content Blocker rules could not be synced: \(error.localizedDescription)"
        )
      }
    }

    AsyncFunction("requestAuthorization") { () async throws -> [String: Any] in
      #if canImport(FamilyControls)
      if #available(iOS 16.0, *) {
        try await AuthorizationCenter.shared.requestAuthorization(for: .individual)
        let authorized = self.isAuthorized()
        return self.statusPayload(
          authorized: authorized,
          active: authorized && self.isAdultFilterActive(),
          scheduled: authorized && self.isRiskWindowMonitoringActive(),
          message: "Screen Time authorization request completed."
        )
      }
      #endif

      return self.statusPayload(
        authorized: false,
        active: false,
        scheduled: false,
        message: "FamilyControls requires iOS 16+ and the Apple entitlement."
      )
    }

    AsyncFunction("applyAdultContentFilter") { () -> [String: Any] in
      #if canImport(ManagedSettings)
      if #available(iOS 15.0, *) {
        if !self.isAuthorized() {
          return self.statusPayload(
            authorized: false,
            active: false,
            scheduled: self.isRiskWindowMonitoringActive(),
            message: "Approve Screen Time authorization before applying the web filter."
          )
        }
        self.setAdultFilterActive(true)
        self.applyWebContentFilterForCurrentState()
        self.applySelectedShieldsForCurrentState()
        return self.statusPayload(
          authorized: self.isAuthorized(),
          active: true,
          scheduled: self.isRiskWindowMonitoringActive(),
          message: "ManagedSettings automatic adult-content web filter requested."
        )
      }
      #endif

      return self.statusPayload(
        authorized: false,
        active: false,
        scheduled: false,
        message: "ManagedSettings web filtering is unavailable in this build."
      )
    }

    AsyncFunction("applyEarnedUnlockWindow") { (expiresAt: String, sourceAttemptHost: String?) -> [String: Any] in
      let now = Date()
      guard let expiry = self.parseIsoDate(expiresAt), expiry > now else {
        self.clearEarnedUnlockState()
        self.stopEarnedUnlockMonitoring()
        self.applySelectedShieldsForCurrentState()
        return self.statusPayload(
          authorized: self.isAuthorized(),
          active: self.isAuthorized() && self.isAdultFilterActive(),
          scheduled: self.isRiskWindowMonitoringActive(),
          message: "Earned unlock expired. FREED shields are active again."
        )
      }

      guard self.isScreenTimeUnlockSource(sourceAttemptHost) else {
        self.clearEarnedUnlockState()
        self.stopEarnedUnlockMonitoring()
        self.applySelectedShieldsForCurrentState()
        return self.statusPayload(
          authorized: self.isAuthorized(),
          active: self.isAuthorized() && self.isAdultFilterActive(),
          scheduled: self.isRiskWindowMonitoringActive(),
          message: "Earned unlock source is not an iOS Screen Time shield. FREED shields remain active."
        )
      }

      guard let unlockScope = self.pendingEarnedUnlockScope(), self.isSelectedScreenTimeScope(unlockScope) else {
        self.clearEarnedUnlockState()
        self.stopEarnedUnlockMonitoring()
        self.applySelectedShieldsForCurrentState()
        return self.statusPayload(
          authorized: self.isAuthorized(),
          active: self.isAuthorized() && self.isAdultFilterActive(),
          scheduled: self.isRiskWindowMonitoringActive(),
          message: "Screen Time unlock scope is unavailable. FREED shields remain active."
        )
      }

      let boundedExpiry = self.boundedEarnedUnlockExpiry(expiry, from: now)
      let boundedExpiresAt = self.formatIsoDate(boundedExpiry)
      self.sharedDefaults().set(boundedExpiresAt, forKey: self.earnedUnlockExpiresAtKey)
      self.sharedDefaults().set(self.screenTimeShieldHost, forKey: self.earnedUnlockSourceKey)
      if let encodedScope = try? JSONEncoder().encode(unlockScope) {
        self.sharedDefaults().set(encodedScope, forKey: self.earnedUnlockScopeKey)
      }
      self.sharedDefaults().removeObject(forKey: self.pendingEarnedUnlockScopeKey)
      self.applySelectedShieldsExcludingEarnedUnlockScope(unlockScope)
      self.scheduleEarnedUnlockRelock(expiresAt: boundedExpiry)
      self.scheduleEarnedUnlockMonitoring(expiresAt: boundedExpiry)

      return self.statusPayload(
        authorized: self.isAuthorized(),
        active: self.isAuthorized() && self.isAdultFilterActive(),
        scheduled: self.isRiskWindowMonitoringActive(),
        message: self.earnedUnlockMessage(for: unlockScope)
      )
    }

    AsyncFunction("clearEarnedUnlockWindow") { () -> [String: Any] in
      self.clearEarnedUnlockState()
      self.stopEarnedUnlockMonitoring()
      self.applySelectedShieldsForCurrentState()

      return self.statusPayload(
        authorized: self.isAuthorized(),
        active: self.isAuthorized() && self.isAdultFilterActive(),
        scheduled: self.isRiskWindowMonitoringActive(),
        message: "Earned unlock cleared. FREED shields are active again."
      )
    }

    AsyncFunction("stopAdultContentFilter") { () -> [String: Any] in
      #if canImport(ManagedSettings)
      if #available(iOS 15.0, *) {
        self.setAdultFilterActive(false)
        self.applyWebContentFilterForCurrentState()
        self.applySelectedShieldsForCurrentState()
        return self.statusPayload(
          authorized: self.isAuthorized(),
          active: false,
          scheduled: self.isRiskWindowMonitoringActive(),
          message: "ManagedSettings adult-content web filter paused."
        )
      }
      #endif

      return self.statusPayload(
        authorized: false,
        active: false,
        scheduled: false,
        message: "ManagedSettings web filtering is unavailable in this build."
      )
    }

    AsyncFunction("startRiskWindowMonitoring") { (startHour: Int, endHour: Int, startMinute: Int, endMinute: Int) -> [String: Any] in
      let authorized = self.isAuthorized()
      if !authorized {
        return self.statusPayload(
          authorized: false,
          active: false,
          scheduled: false,
          message: "Approve Screen Time authorization before scheduling Night Guard."
        )
      }

      guard
        (0...23).contains(startHour),
        (0...23).contains(endHour),
        (0...59).contains(startMinute),
        (0...59).contains(endMinute),
        startHour != endHour || startMinute != endMinute
      else {
        return self.statusPayload(
          authorized: authorized,
          active: authorized && self.isAdultFilterActive(),
          scheduled: self.isRiskWindowMonitoringActive(),
          message: "Choose a valid Night Guard start and end time."
        )
      }

      #if canImport(DeviceActivity)
      if #available(iOS 15.0, *) {
        let schedule = DeviceActivitySchedule(
          intervalStart: DateComponents(hour: startHour, minute: startMinute),
          intervalEnd: DateComponents(hour: endHour, minute: endMinute),
          repeats: true
        )

        do {
          try DeviceActivityCenter().startMonitoring(DeviceActivityName(self.riskWindowActivityName), during: schedule)
          self.setRiskWindowMonitoringActive(true)
          return self.statusPayload(
            authorized: authorized,
            active: authorized && self.isAdultFilterActive(),
            scheduled: true,
            message: "Night Guard scheduled from \(self.timeLabel(startHour, startMinute)) to \(self.timeLabel(endHour, endMinute))."
          )
        } catch {
          return self.statusPayload(
            authorized: authorized,
            active: authorized && self.isAdultFilterActive(),
            scheduled: self.isRiskWindowMonitoringActive(),
            message: "Night Guard could not be scheduled: \(error.localizedDescription)"
          )
        }
      }
      #endif

      return self.statusPayload(
        authorized: authorized,
        active: authorized && self.isAdultFilterActive(),
        scheduled: self.isRiskWindowMonitoringActive(),
        message: "DeviceActivity scheduling is unavailable in this build."
      )
    }

    AsyncFunction("stopRiskWindowMonitoring") { () -> [String: Any] in
      #if canImport(DeviceActivity)
      if #available(iOS 15.0, *) {
        DeviceActivityCenter().stopMonitoring([DeviceActivityName(self.riskWindowActivityName)])
      }
      #endif

      self.setRiskWindowMonitoringActive(false)
      self.sharedDefaults().set(false, forKey: self.riskWindowCurrentlyActiveKey)
      self.applyWebContentFilterForCurrentState()
      self.applySelectedShieldsForCurrentState()
      return self.statusPayload(
        authorized: self.isAuthorized(),
        active: self.isAuthorized() && self.isAdultFilterActive(),
        scheduled: false,
        message: "Night Guard schedule stopped."
      )
    }

    AsyncFunction("configureBlockedAppPackages") { (_packages: [String], dailyLimitMinutes: Int?, _shortFormInterruptionSeconds: Int?) -> [String: Any] in
      let authorized = self.isAuthorized()
      if !authorized {
        return self.statusPayload(
          authorized: false,
          active: false,
          scheduled: self.isRiskWindowMonitoringActive(),
          message: "Approve Screen Time authorization before scheduling selected app limits."
        )
      }

      let selection = self.loadFamilyActivitySelection()
      let selectedTargetCount = selection.applicationTokens.count + selection.categoryTokens.count + selection.webDomainTokens.count
      guard selectedTargetCount > 0 else {
        self.stopSelectedAppLimitMonitoring()
        return self.statusPayload(
          authorized: authorized,
          active: authorized && self.isAdultFilterActive(),
          scheduled: self.isRiskWindowMonitoringActive(),
          message: "Choose Screen Time apps, categories, or domains before scheduling selected app limits."
        )
      }

      let limitMinutes = self.sanitizeDailyLimitMinutes(dailyLimitMinutes)
      self.sharedDefaults().set(limitMinutes, forKey: self.appLimitDailyMinutesKey)

      #if canImport(DeviceActivity)
      if #available(iOS 15.0, *) {
        let schedule = DeviceActivitySchedule(
          intervalStart: DateComponents(hour: 0, minute: 0),
          intervalEnd: DateComponents(hour: 23, minute: 59),
          repeats: true
        )
        let eventName = DeviceActivityEvent.Name(self.appLimitEventName)
        let event = self.makeSelectedAppLimitEvent(selection: selection, limitMinutes: limitMinutes)

        do {
          try DeviceActivityCenter().startMonitoring(
            DeviceActivityName(self.appLimitActivityName),
            during: schedule,
            events: [eventName: event]
          )
          self.setAppLimitMonitoringActive(true)
          return self.statusPayload(
            authorized: authorized,
            active: authorized && self.isAdultFilterActive(),
            scheduled: self.isRiskWindowMonitoringActive(),
            message: "Selected app limits scheduled after \(limitMinutes) minutes of Screen Time activity."
          )
        } catch {
          self.setAppLimitMonitoringActive(false)
          return self.statusPayload(
            authorized: authorized,
            active: authorized && self.isAdultFilterActive(),
            scheduled: self.isRiskWindowMonitoringActive(),
            message: "Selected app limits could not be scheduled: \(error.localizedDescription)"
          )
        }
      }
      #endif

      self.setAppLimitMonitoringActive(false)
      return self.statusPayload(
        authorized: authorized,
        active: authorized && self.isAdultFilterActive(),
        scheduled: self.isRiskWindowMonitoringActive(),
        message: "DeviceActivity selected app limits are unavailable in this build."
      )
    }

    AsyncFunction("presentFamilyActivityPicker") { () async -> [String: Any] in
      let authorized = self.isAuthorized()
      if !authorized {
        return self.statusPayload(
          authorized: false,
          active: false,
          scheduled: self.isRiskWindowMonitoringActive(),
          message: "Approve Screen Time authorization before choosing protected apps."
        )
      }

      #if canImport(FamilyControls) && canImport(SwiftUI) && canImport(UIKit)
      if #available(iOS 16.0, *) {
        return await withCheckedContinuation { continuation in
          Task { @MainActor in
            guard let presenter = self.appContext?.utilities?.currentViewController() else {
              continuation.resume(returning: self.statusPayload(
                authorized: true,
                active: self.isAdultFilterActive(),
                scheduled: self.isRiskWindowMonitoringActive(),
                message: "Screen Time picker could not open. Return to FREED setup and try choosing protected apps again."
              ))
              return
            }

            var didResume = false
            var pickerController: UIViewController?

            func finishPicker(message: String) {
              guard !didResume else { return }
              didResume = true
              let payload = self.statusPayload(
                authorized: true,
                active: self.isAdultFilterActive(),
                scheduled: self.isRiskWindowMonitoringActive(),
                message: message
              )
              if let pickerController {
                pickerController.dismiss(animated: true) {
                  continuation.resume(returning: payload)
                }
              } else {
                continuation.resume(returning: payload)
              }
            }

            let picker = FreedFamilyActivityPickerView(
              initialSelection: self.loadFamilyActivitySelection(),
              onCancel: {
                finishPicker(message: "Screen Time picker closed. Choose at least one app, category, or web domain before activation can finish.")
              },
              onDone: { selection in
                self.saveFamilyActivitySelection(selection)
                let selectedTargetCount = selection.applicationTokens.count + selection.categoryTokens.count + selection.webDomainTokens.count
                var schedulingSucceeded = false
                #if canImport(DeviceActivity)
                if #available(iOS 15.0, *) {
                  do {
                    try self.scheduleSelectedAppLimitMonitoring(
                      selection: selection,
                      limitMinutes: self.configuredDailyLimitMinutes()
                    )
                    schedulingSucceeded = true
                  } catch {
                    self.setAppLimitMonitoringActive(false)
                  }
                }
                #endif
                self.applySelectedShieldsForCurrentState()
                if selectedTargetCount > 0 && schedulingSucceeded {
                  finishPicker(message: "Screen Time targets saved and selected app limits scheduled.")
                } else if selectedTargetCount > 0 {
                  finishPicker(message: "Screen Time targets saved. DeviceActivity scheduling needs device verification before activation.")
                } else {
                  finishPicker(message: "No Screen Time targets were selected. Choose at least one app, category, or web domain before activation can finish.")
                }
              }
            )
            let controller = UIHostingController(rootView: picker)
            pickerController = controller
            controller.modalPresentationStyle = .formSheet
            presenter.present(controller, animated: true)
          }
        }
      }
      #endif

      return self.statusPayload(
        authorized: authorized,
        active: authorized && self.isAdultFilterActive(),
        scheduled: self.isRiskWindowMonitoringActive(),
        message: "FamilyActivityPicker requires iOS 16+ and the FamilyControls framework."
      )
    }

    AsyncFunction("openProtectionSettings") { () async -> [String: Any] in
      #if canImport(UIKit)
      Task { @MainActor in
        if let settingsURL = URL(string: UIApplication.openSettingsURLString) {
          UIApplication.shared.open(settingsURL)
        }
      }
      #endif
      await self.refreshSafariContentBlockerStateIfAvailable()

      let authorized = self.isAuthorized()
      let filterActive = authorized && self.isAdultFilterActive()
      return self.statusPayload(
        authorized: authorized,
        active: filterActive,
        scheduled: authorized && self.isRiskWindowMonitoringActive(),
        message: "Opening iOS Settings so you can review FREED permissions. If Safari blocking is still needed, enable FREED Safari Blocker in Settings > Safari > Extensions, then return to FREED."
      )
    }

    AsyncFunction("runActivationDiagnostics") { (adultHost: String, normalHost: String, requireReviewedAdultFeed: Bool) async -> [String: Any] in
      await self.refreshSafariContentBlockerStateIfAvailable()
      return self.activationDiagnosticsPayload(
        adultHostInput: adultHost,
        normalHostInput: normalHost,
        requireReviewedAdultFeed: requireReviewedAdultFeed
      )
    }

    AsyncFunction("getPendingIntervention") { () -> [String: Any]? in
      guard let record = self.pendingInterventionRecord() else {
        return nil
      }

      guard self.isFreshPendingIntervention(record.detectedAt) else {
        self.clearPendingInterventionDefaults()
        return nil
      }

      let host = self.sanitizedPendingHost(record.host)
      var payload: [String: Any] = [
        "url": "https://\(host)",
        "host": host,
        "sourcePackage": self.sanitizedPendingSourcePackage(record.sourcePackage),
        "reason": record.reason,
        "matchedRule": record.matchedRule,
        "detectedAt": record.detectedAt
      ]
      if let scopePayload = self.scopePayload(record.scope) {
        payload["scope"] = scopePayload
      }
      return payload
    }

    AsyncFunction("clearPendingIntervention") { () -> Bool in
      if
        let record = self.pendingInterventionRecord(),
        record.sourcePackage == self.screenTimeShieldSource,
        let scope = record.scope,
        scope.kind == "ios-token",
        let encodedScope = try? JSONEncoder().encode(scope)
      {
        self.sharedDefaults().set(encodedScope, forKey: self.pendingEarnedUnlockScopeKey)
      } else {
        self.sharedDefaults().removeObject(forKey: self.pendingEarnedUnlockScopeKey)
      }
      self.clearPendingInterventionDefaults()

      return true
    }

    AsyncFunction("classifyChallengePhoto") { (uri: String, expectedLabels: [String]) -> [String: Any] in
      return self.classifyChallengePhoto(uri: uri, expectedLabels: expectedLabels)
    }
  }

  private func hasFamilyControls() -> Bool {
    #if canImport(FamilyControls)
    if #available(iOS 16.0, *) { return true }
    #endif
    return false
  }

  private func hasManagedSettings() -> Bool {
    #if canImport(ManagedSettings)
    if #available(iOS 15.0, *) { return true }
    #endif
    return false
  }

  private func hasSafariContentBlocker() -> Bool {
    #if canImport(SafariServices)
    return true
    #else
    return false
    #endif
  }

  private func isAuthorized() -> Bool {
    #if canImport(FamilyControls)
    if #available(iOS 16.0, *) {
      return AuthorizationCenter.shared.authorizationStatus == .approved
    }
    #endif
    return false
  }

  private func sharedDefaults() -> UserDefaults {
    UserDefaults(suiteName: appGroupIdentifier) ?? UserDefaults.standard
  }

  private func isAdultFilterActive() -> Bool {
    sharedDefaults().bool(forKey: adultFilterActiveKey)
  }

  private func setAdultFilterActive(_ active: Bool) {
    sharedDefaults().set(active, forKey: adultFilterActiveKey)
  }

  private func isRiskWindowMonitoringActive() -> Bool {
    sharedDefaults().bool(forKey: riskWindowActiveKey)
  }

  private func setRiskWindowMonitoringActive(_ active: Bool) {
    sharedDefaults().set(active, forKey: riskWindowActiveKey)
  }

  private func isAppLimitMonitoringActive() -> Bool {
    sharedDefaults().bool(forKey: appLimitMonitoringActiveKey)
  }

  private func setAppLimitMonitoringActive(_ active: Bool) {
    sharedDefaults().set(active, forKey: appLimitMonitoringActiveKey)
  }

  private func sanitizeDailyLimitMinutes(_ value: Int?) -> Int {
    min(240, max(5, value ?? 20))
  }

  private func configuredDailyLimitMinutes() -> Int {
    let stored = sharedDefaults().integer(forKey: appLimitDailyMinutesKey)
    return sanitizeDailyLimitMinutes(stored > 0 ? stored : nil)
  }

  private func stopSelectedAppLimitMonitoring() {
    #if canImport(DeviceActivity)
    if #available(iOS 15.0, *) {
      DeviceActivityCenter().stopMonitoring([DeviceActivityName(appLimitActivityName)])
    }
    #endif
    setAppLimitMonitoringActive(false)
  }

  #if canImport(DeviceActivity) && canImport(FamilyControls)
  @available(iOS 15.0, *)
  private func makeSelectedAppLimitEvent(selection: FamilyActivitySelection, limitMinutes: Int) -> DeviceActivityEvent {
    let threshold = DateComponents(minute: sanitizeDailyLimitMinutes(limitMinutes))
    if #available(iOS 17.4, *) {
      return DeviceActivityEvent(
        applications: selection.applicationTokens,
        categories: selection.categoryTokens,
        webDomains: selection.webDomainTokens,
        threshold: threshold,
        includesPastActivity: true
      )
    }

    return DeviceActivityEvent(
      applications: selection.applicationTokens,
      categories: selection.categoryTokens,
      webDomains: selection.webDomainTokens,
      threshold: threshold
    )
  }

  @available(iOS 15.0, *)
  private func scheduleSelectedAppLimitMonitoring(selection: FamilyActivitySelection, limitMinutes: Int) throws {
    let selectedTargetCount = selection.applicationTokens.count + selection.categoryTokens.count + selection.webDomainTokens.count
    guard selectedTargetCount > 0 else {
      stopSelectedAppLimitMonitoring()
      return
    }

    let schedule = DeviceActivitySchedule(
      intervalStart: DateComponents(hour: 0, minute: 0),
      intervalEnd: DateComponents(hour: 23, minute: 59),
      repeats: true
    )
    try DeviceActivityCenter().startMonitoring(
      DeviceActivityName(appLimitActivityName),
      during: schedule,
      events: [
        DeviceActivityEvent.Name(appLimitEventName): makeSelectedAppLimitEvent(
          selection: selection,
          limitMinutes: limitMinutes
        )
      ]
    )
    setAppLimitMonitoringActive(true)
  }
  #endif

  private func clearEarnedUnlockState() {
    let defaults = sharedDefaults()
    defaults.removeObject(forKey: earnedUnlockExpiresAtKey)
    defaults.removeObject(forKey: earnedUnlockSourceKey)
    defaults.removeObject(forKey: earnedUnlockScopeKey)
    defaults.removeObject(forKey: pendingEarnedUnlockScopeKey)
  }

  private func activeEarnedUnlockExpiresAt() -> String? {
    let defaults = sharedDefaults()
    let storedSource = defaults.string(forKey: earnedUnlockSourceKey)
    let storedExpiresAt = defaults.string(forKey: earnedUnlockExpiresAtKey)

    guard storedSource != nil || storedExpiresAt != nil else {
      return nil
    }

    guard isScreenTimeUnlockSource(storedSource), let scope = activeEarnedUnlockScope(), isSelectedScreenTimeScope(scope) else {
      clearEarnedUnlockState()
      return nil
    }

    guard
      let expiresAt = storedExpiresAt,
      let expiry = parseIsoDate(expiresAt),
      expiry > Date()
    else {
      clearEarnedUnlockState()
      return nil
    }

    let boundedExpiry = boundedEarnedUnlockExpiry(expiry)
    if expiry > boundedExpiry {
      let boundedExpiresAt = formatIsoDate(boundedExpiry)
      defaults.set(boundedExpiresAt, forKey: earnedUnlockExpiresAtKey)
      return boundedExpiresAt
    }

    return expiresAt
  }

  private func isEarnedUnlockActive() -> Bool {
    activeEarnedUnlockExpiresAt() != nil
  }

  private func refreshEarnedUnlockWindow() {
    let defaults = sharedDefaults()
    guard
      defaults.string(forKey: earnedUnlockExpiresAtKey) != nil ||
        defaults.string(forKey: earnedUnlockSourceKey) != nil
    else {
      return
    }

    if isEarnedUnlockActive() {
      if let scope = activeEarnedUnlockScope() {
        applySelectedShieldsExcludingEarnedUnlockScope(scope)
      }
      if let expiresAt = activeEarnedUnlockExpiresAt(), let expiry = parseIsoDate(expiresAt) {
        scheduleEarnedUnlockMonitoring(expiresAt: expiry)
      }
      return
    }

    clearEarnedUnlockState()
    stopEarnedUnlockMonitoring()
    applySelectedShieldsForCurrentState()
  }

  private func scheduleEarnedUnlockRelock(expiresAt: Date) {
    let delay = max(0, expiresAt.timeIntervalSinceNow)
    DispatchQueue.main.asyncAfter(deadline: .now() + delay) { [weak self] in
      self?.refreshEarnedUnlockWindow()
    }
  }

  private func scheduleEarnedUnlockMonitoring(expiresAt: Date) {
    #if canImport(DeviceActivity)
    if #available(iOS 15.0, *) {
      let now = Date()
      let safeExpiry = max(expiresAt, now.addingTimeInterval(60))
      let calendar = Calendar.current
      let schedule = DeviceActivitySchedule(
        intervalStart: calendar.dateComponents([.hour, .minute, .second], from: now),
        intervalEnd: calendar.dateComponents([.hour, .minute, .second], from: safeExpiry),
        repeats: false
      )

      do {
        try DeviceActivityCenter().startMonitoring(DeviceActivityName(earnedUnlockActivityName), during: schedule)
      } catch {
        // The in-process fallback still relocks while FREED is foregrounded; extension relock is best effort.
      }
    }
    #endif
  }

  private func stopEarnedUnlockMonitoring() {
    #if canImport(DeviceActivity)
    if #available(iOS 15.0, *) {
      DeviceActivityCenter().stopMonitoring([DeviceActivityName(earnedUnlockActivityName)])
    }
    #endif
  }

  private func boundedEarnedUnlockExpiry(_ expiry: Date, from now: Date = Date()) -> Date {
    let maxExpiry = now.addingTimeInterval(TimeInterval(maxEarnedUnlockMinutes * 60))
    return expiry > maxExpiry ? maxExpiry : expiry
  }

  private func isAppLimitReachedToday() -> Bool {
    appLimitReachedDate() == localDateKey()
  }

  private func appLimitReachedDate() -> String? {
    guard let reachedDate = sharedDefaults().string(forKey: appLimitReachedDateKey), !reachedDate.isEmpty else {
      return nil
    }

    return reachedDate
  }

  private func localDateKey() -> String {
    let formatter = DateFormatter()
    formatter.calendar = Calendar(identifier: .gregorian)
    formatter.locale = Locale(identifier: "en_US_POSIX")
    formatter.timeZone = TimeZone.current
    formatter.dateFormat = "yyyy-MM-dd"
    return formatter.string(from: Date())
  }

  private func formatIsoDate(_ date: Date) -> String {
    ISO8601DateFormatter().string(from: date)
  }

  private func parseIsoDate(_ value: String) -> Date? {
    let fractional = ISO8601DateFormatter()
    fractional.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
    if let date = fractional.date(from: value) {
      return date
    }

    return ISO8601DateFormatter().date(from: value)
  }

  private func isFreshPendingIntervention(_ detectedAt: String) -> Bool {
    guard let detectedDate = parseIsoDate(detectedAt) else {
      return false
    }

    let now = Date()
    return detectedDate.timeIntervalSince(now) <= pendingInterventionFutureSkewSeconds &&
      now.timeIntervalSince(detectedDate) <= pendingInterventionMaxAgeSeconds
  }

  private func pendingInterventionRecord() -> PendingInterventionRecord? {
    guard let data = sharedDefaults().data(forKey: pendingInterventionRecordKey) else {
      return nil
    }
    return try? JSONDecoder().decode(PendingInterventionRecord.self, from: data)
  }

  private func scopePayload(_ scope: InterventionScope?) -> [String: Any]? {
    guard let scope else { return nil }
    if
      scope.kind == "ios-token",
      let tokenType = scope.tokenType,
      ["application", "category", "domain"].contains(tokenType),
      let token = scope.token,
      token.count <= 8_192,
      Data(base64Encoded: token) != nil
    {
      return ["kind": "ios-token", "tokenType": tokenType, "token": token]
    }
    if
      scope.kind == "browser-domain",
      let domain = sanitizeHostForStorage(scope.domain)
    {
      return ["kind": "browser-domain", "domain": domain]
    }
    return nil
  }

  private func sanitizedPendingHost(_ values: String?...) -> String {
    for value in values {
      if let host = sanitizeHostForStorage(value) {
        return host
      }
    }

    return screenTimeShieldHost
  }

  private func isScreenTimeUnlockSource(_ sourceAttemptHost: String?) -> Bool {
    guard
      let trimmed = sourceAttemptHost?.trimmingCharacters(in: .whitespacesAndNewlines).lowercased(),
      !trimmed.isEmpty
    else {
      return false
    }

    if trimmed == screenTimeShieldSource {
      return true
    }

    return sanitizeHostForStorage(trimmed) == screenTimeShieldHost
  }

  private func sanitizeHostForStorage(_ value: String?) -> String? {
    guard var candidate = value?.trimmingCharacters(in: .whitespacesAndNewlines).lowercased(), !candidate.isEmpty else {
      return nil
    }

    if let schemeRange = candidate.range(of: "://") {
      candidate = String(candidate[schemeRange.upperBound...])
    }
    if let atIndex = candidate.lastIndex(of: "@") {
      candidate = String(candidate[candidate.index(after: atIndex)...])
    }
    if let cutIndex = candidate.firstIndex(where: { $0 == "/" || $0 == "?" || $0 == "#" }) {
      candidate = String(candidate[..<cutIndex])
    }
    if candidate.hasPrefix("[") {
      return nil
    }
    if let colonIndex = candidate.lastIndex(of: ":") {
      let suffix = candidate[candidate.index(after: colonIndex)...]
      guard !suffix.isEmpty, suffix.allSatisfy({ $0.wholeNumberValue != nil }) else {
        return nil
      }
      candidate = String(candidate[..<colonIndex])
    }
    while candidate.hasPrefix(".") {
      candidate.removeFirst()
    }
    while candidate.hasSuffix(".") {
      candidate.removeLast()
    }
    if candidate.hasPrefix("www.") {
      candidate.removeFirst(4)
    }

    guard !candidate.isEmpty, candidate.count <= 120, candidate.contains(".") else {
      return nil
    }

    let allowedCharacters = CharacterSet(charactersIn: "abcdefghijklmnopqrstuvwxyz0123456789.-")
    guard candidate.unicodeScalars.allSatisfy({ allowedCharacters.contains($0) }) else {
      return nil
    }

    let labels = candidate.split(separator: ".", omittingEmptySubsequences: false)
    guard labels.count >= 2, labels.allSatisfy(isValidHostLabel), (labels.last?.count ?? 0) >= 2 else {
      return nil
    }

    return candidate
  }

  private func isValidHostLabel(_ label: Substring) -> Bool {
    guard !label.isEmpty, label.count <= 63 else {
      return false
    }

    return label.first.map(String.init) != "-" && label.last.map(String.init) != "-"
  }

  private func sanitizedPendingSourcePackage(_ value: String?) -> String {
    guard let trimmed = value?.trimmingCharacters(in: .whitespacesAndNewlines).lowercased(), !trimmed.isEmpty else {
      return screenTimeShieldSource
    }

    let allowedCharacters = CharacterSet(charactersIn: "abcdefghijklmnopqrstuvwxyz0123456789._:-")
    guard trimmed.count <= 80, trimmed.unicodeScalars.allSatisfy({ allowedCharacters.contains($0) }) else {
      return screenTimeShieldSource
    }

    return trimmed
  }

  private func clearPendingInterventionDefaults() {
    sharedDefaults().removeObject(forKey: pendingInterventionRecordKey)
  }

  private func selectedApplicationCount() -> Int {
    sharedDefaults().integer(forKey: selectionAppCountKey)
  }

  private func selectedCategoryCount() -> Int {
    sharedDefaults().integer(forKey: selectionCategoryCountKey)
  }

  private func selectedWebDomainCount() -> Int {
    sharedDefaults().integer(forKey: selectionWebDomainCountKey)
  }

  #if canImport(FamilyControls)
  @available(iOS 15.0, *)
  private func loadFamilyActivitySelection() -> FamilyActivitySelection {
    guard
      let data = sharedDefaults().data(forKey: familyActivitySelectionKey),
      let selection = try? JSONDecoder().decode(FamilyActivitySelection.self, from: data)
    else {
      return FamilyActivitySelection()
    }

    return selection
  }

  @available(iOS 15.0, *)
  private func saveFamilyActivitySelection(_ selection: FamilyActivitySelection) {
    let defaults = sharedDefaults()
    if let data = try? JSONEncoder().encode(selection) {
      defaults.set(data, forKey: familyActivitySelectionKey)
    }

    defaults.set(selection.applicationTokens.count, forKey: selectionAppCountKey)
    defaults.set(selection.categoryTokens.count, forKey: selectionCategoryCountKey)
    defaults.set(selection.webDomainTokens.count, forKey: selectionWebDomainCountKey)

    applySelectedShieldsForCurrentState()

    #if canImport(DeviceActivity)
    if #available(iOS 15.0, *) {
      do {
        try scheduleSelectedAppLimitMonitoring(selection: selection, limitMinutes: configuredDailyLimitMinutes())
      } catch {
        setAppLimitMonitoringActive(false)
      }
    }
    #endif
  }
  #endif

  private func applyWebContentFilterForCurrentState() {
    #if canImport(ManagedSettings)
    if #available(iOS 15.0, *) {
      if isAdultFilterActive() || sharedDefaults().bool(forKey: riskWindowCurrentlyActiveKey) {
        store.webContent.blockedByFilter = .auto(Set<WebDomain>(), except: Set<WebDomain>())
      } else {
        store.webContent.blockedByFilter = nil
      }
    }
    #endif
  }

  private func applySelectedShieldsForCurrentState() {
    if isEarnedUnlockActive() {
      if let scope = activeEarnedUnlockScope() {
        applySelectedShieldsExcludingEarnedUnlockScope(scope)
      }
      return
    }

    guard sharedDefaults().bool(forKey: riskWindowCurrentlyActiveKey) || isAppLimitReachedToday() else {
      clearSelectedShields()
      return
    }

    applySelectedShieldsIfAvailable()
  }

  private func applySelectedShieldsIfAvailable() {
    #if canImport(ManagedSettings) && canImport(FamilyControls)
    if #available(iOS 15.0, *) {
      if isEarnedUnlockActive() {
        if let scope = activeEarnedUnlockScope() {
          applySelectedShieldsExcludingEarnedUnlockScope(scope)
        }
        return
      }

      let selection = loadFamilyActivitySelection()
      store.shield.applications = selection.applicationTokens.isEmpty ? nil : selection.applicationTokens
      store.shield.applicationCategories = selection.categoryTokens.isEmpty ? nil : .specific(selection.categoryTokens)
      store.shield.webDomains = selection.webDomainTokens.isEmpty ? nil : selection.webDomainTokens
      store.shield.webDomainCategories = selection.categoryTokens.isEmpty ? nil : .specific(selection.categoryTokens)
    }
    #endif
  }

  private func pendingEarnedUnlockScope() -> InterventionScope? {
    scopeStored(forKey: pendingEarnedUnlockScopeKey)
  }

  private func activeEarnedUnlockScope() -> InterventionScope? {
    scopeStored(forKey: earnedUnlockScopeKey)
  }

  private func scopeStored(forKey key: String) -> InterventionScope? {
    guard let data = sharedDefaults().data(forKey: key) else { return nil }
    return try? JSONDecoder().decode(InterventionScope.self, from: data)
  }

  private func earnedUnlockMessage(for scope: InterventionScope) -> String {
    switch scope.tokenType {
    case "application":
      return "Only the challenged Screen Time app is unlocked. Unrelated shields and adult web filtering stay active."
    case "domain":
      return "Only the challenged Screen Time web domain is unlocked. Unrelated shields and adult web filtering stay active."
    case "category":
      return "Category-wide recovery is active for the challenged category. Other categories, targets, and adult web filtering stay active."
    default:
      return "The challenged Screen Time target is unlocked. Unrelated shields and adult web filtering stay active."
    }
  }

  private func isSelectedScreenTimeScope(_ scope: InterventionScope) -> Bool {
    #if canImport(FamilyControls)
    if #available(iOS 15.0, *) {
      guard scope.kind == "ios-token", let tokenType = scope.tokenType, let token = decodedScopeTokenData(scope) else {
        return false
      }
      let selection = loadFamilyActivitySelection()
      switch tokenType {
      case "application":
        return (try? JSONDecoder().decode(ApplicationToken.self, from: token)).map(selection.applicationTokens.contains) ?? false
      case "domain":
        return (try? JSONDecoder().decode(WebDomainToken.self, from: token)).map(selection.webDomainTokens.contains) ?? false
      case "category":
        return (try? JSONDecoder().decode(ActivityCategoryToken.self, from: token)).map(selection.categoryTokens.contains) ?? false
      default:
        return false
      }
    }
    #endif
    return false
  }

  private func decodedScopeTokenData(_ scope: InterventionScope) -> Data? {
    guard let encoded = scope.token, encoded.count <= 8_192 else { return nil }
    return Data(base64Encoded: encoded)
  }

  private func applySelectedShieldsExcludingEarnedUnlockScope(_ scope: InterventionScope) {
    #if canImport(ManagedSettings) && canImport(FamilyControls)
    if #available(iOS 15.0, *) {
      let selection = loadFamilyActivitySelection()
      guard let tokenType = scope.tokenType, let tokenData = decodedScopeTokenData(scope) else {
        applySelectedShieldsIfAvailable()
        return
      }

      var remainingApplications = selection.applicationTokens
      var remainingCategories = selection.categoryTokens
      var remainingWebDomains = selection.webDomainTokens
      var excludedApplications = Set<ApplicationToken>()
      var excludedWebDomains = Set<WebDomainToken>()

      switch tokenType {
      case "application":
        guard let token = try? JSONDecoder().decode(ApplicationToken.self, from: tokenData) else { return }
        remainingApplications = selection.applicationTokens.subtracting([token])
        excludedApplications.insert(token)
      case "domain":
        guard let token = try? JSONDecoder().decode(WebDomainToken.self, from: tokenData) else { return }
        remainingWebDomains = selection.webDomainTokens.subtracting([token])
        excludedWebDomains.insert(token)
      case "category":
        guard let token = try? JSONDecoder().decode(ActivityCategoryToken.self, from: tokenData) else { return }
        remainingCategories = selection.categoryTokens.subtracting([token])
      default:
        return
      }

      store.shield.applications = remainingApplications.isEmpty ? nil : remainingApplications
      store.shield.applicationCategories = remainingCategories.isEmpty
        ? nil
        : .specific(remainingCategories, except: excludedApplications)
      store.shield.webDomains = remainingWebDomains.isEmpty ? nil : remainingWebDomains
      store.shield.webDomainCategories = remainingCategories.isEmpty
        ? nil
        : .specific(remainingCategories, except: excludedWebDomains)
    }
    #endif
  }

  private func clearSelectedShields() {
    #if canImport(ManagedSettings)
    if #available(iOS 15.0, *) {
      store.shield.applications = nil
      store.shield.applicationCategories = nil
      store.shield.webDomains = nil
      store.shield.webDomainCategories = nil
    }
    #endif
  }

  private func timeLabel(_ hour: Int, _ minute: Int) -> String {
    String(format: "%02d:%02d", hour, minute)
  }

  private func safariContentBlockerRulesURL() -> URL? {
    guard let container = FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: appGroupIdentifier) else {
      return nil
    }

    return container.appendingPathComponent(safariContentBlockerRulesFileName)
  }

  private func configureSafariContentBlockerRulesFile(
    rulesJson: String,
    version: String,
    checksum: String,
    generatedAt: String
  ) throws -> Int {
    let trimmed = rulesJson.trimmingCharacters(in: .whitespacesAndNewlines)
    guard !trimmed.isEmpty, let data = trimmed.data(using: .utf8) else {
      throw makeFreedError("Safari Content Blocker rules payload is empty.")
    }

    let parsed = try JSONSerialization.jsonObject(with: data)
    guard let rules = parsed as? [Any] else {
      throw makeFreedError("Safari Content Blocker rules payload must be a JSON array.")
    }
    guard !rules.isEmpty else {
      throw makeFreedError("Safari Content Blocker rules payload cannot be empty.")
    }
    guard rules.count <= 50_000 else {
      throw makeFreedError("Safari Content Blocker rules payload exceeds the 50,000 rule safety limit.")
    }
    try validateSafariContentBlockerRules(rules)
    let adultBlockingRules = rules.filter { !isSafariFocusShieldRule($0) }
    guard !adultBlockingRules.isEmpty else {
      throw makeFreedError("Safari Content Blocker requires at least one adult-domain rule.")
    }
    let adultRuleData = try JSONSerialization.data(withJSONObject: adultBlockingRules)
    guard let rulesURL = safariContentBlockerRulesURL() else {
      throw makeFreedError("Shared app-group storage is unavailable for Safari Content Blocker rules.")
    }

    try FileManager.default.createDirectory(at: rulesURL.deletingLastPathComponent(), withIntermediateDirectories: true)
    try adultRuleData.write(to: rulesURL, options: .atomic)

    let defaults = sharedDefaults()
    defaults.set(version, forKey: safariContentBlockerVersionKey)
    defaults.set(checksum, forKey: safariContentBlockerChecksumKey)
    defaults.set(generatedAt, forKey: safariContentBlockerGeneratedAtKey)
    defaults.set(adultBlockingRules.count, forKey: safariContentBlockerRuleCountKey)
    defaults.removeObject(forKey: safariContentBlockerLastReloadErrorKey)

    return adultBlockingRules.count
  }

  private func isSafariFocusShieldRule(_ item: Any) -> Bool {
    guard
      let rule = item as? [String: Any],
      let trigger = rule["trigger"] as? [String: Any],
      let filter = trigger["url-filter"] as? String
    else {
      return false
    }
    return filter.contains("youtube\\.com/shorts") ||
      filter.contains("youtube\\.com/feed/shorts") ||
      filter.contains("instagram\\.com/reel") ||
      filter.contains("tiktok\\.com/foryou")
  }

  private func validateSafariContentBlockerRules(_ rules: [Any]) throws {
    for (index, item) in rules.enumerated() {
      guard let rule = item as? [String: Any] else {
        throw makeFreedError("Safari Content Blocker rule \(index + 1) must be an object.")
      }
      guard
        let trigger = rule["trigger"] as? [String: Any],
        let urlFilter = trigger["url-filter"] as? String,
        !urlFilter.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
      else {
        throw makeFreedError("Safari Content Blocker rule \(index + 1) is missing a url-filter.")
      }
      guard
        let action = rule["action"] as? [String: Any],
        let actionType = action["type"] as? String,
        actionType == "block"
      else {
        throw makeFreedError("Safari Content Blocker rule \(index + 1) must use a block action.")
      }
    }
  }

  private func reloadSafariContentBlocker() async {
    #if canImport(SafariServices)
    await withCheckedContinuation { continuation in
      SFContentBlockerManager.reloadContentBlocker(withIdentifier: safariContentBlockerIdentifier) { error in
        let defaults = self.sharedDefaults()
        if let error = error {
          defaults.set(error.localizedDescription, forKey: self.safariContentBlockerLastReloadErrorKey)
        } else {
          defaults.removeObject(forKey: self.safariContentBlockerLastReloadErrorKey)
        }
        continuation.resume()
      }
    }
    #endif
  }

  private func refreshSafariContentBlockerStateIfAvailable() async {
    #if canImport(SafariServices)
    guard #available(iOS 10.0, *) else {
      sharedDefaults().set(false, forKey: safariContentBlockerStateKnownKey)
      sharedDefaults().set("Safari Content Blocker state requires iOS 10+.", forKey: safariContentBlockerStateErrorKey)
      return
    }

    await withCheckedContinuation { continuation in
      SFContentBlockerManager.getStateOfContentBlocker(withIdentifier: safariContentBlockerIdentifier) { state, error in
        let defaults = self.sharedDefaults()
        defaults.set(self.formatIsoDate(Date()), forKey: self.safariContentBlockerStateCheckedAtKey)
        if let error = error {
          defaults.set(false, forKey: self.safariContentBlockerStateKnownKey)
          defaults.set(false, forKey: self.safariContentBlockerEnabledKey)
          defaults.set(error.localizedDescription, forKey: self.safariContentBlockerStateErrorKey)
        } else if let state = state {
          defaults.set(true, forKey: self.safariContentBlockerStateKnownKey)
          defaults.set(state.isEnabled, forKey: self.safariContentBlockerEnabledKey)
          defaults.removeObject(forKey: self.safariContentBlockerStateErrorKey)
        } else {
          defaults.set(false, forKey: self.safariContentBlockerStateKnownKey)
          defaults.set(false, forKey: self.safariContentBlockerEnabledKey)
          defaults.set("Safari Content Blocker state was unavailable.", forKey: self.safariContentBlockerStateErrorKey)
        }
        continuation.resume()
      }
    }
    #else
    sharedDefaults().set(false, forKey: safariContentBlockerStateKnownKey)
    sharedDefaults().set(false, forKey: safariContentBlockerEnabledKey)
    sharedDefaults().set("SafariServices is unavailable in this build.", forKey: safariContentBlockerStateErrorKey)
    #endif
  }

  private func makeFreedError(_ message: String) -> NSError {
    NSError(domain: "FreedProtection", code: 1, userInfo: [NSLocalizedDescriptionKey: message])
  }

  private func activationDiagnosticsPayload(
    adultHostInput: String,
    normalHostInput: String,
    requireReviewedAdultFeed: Bool
  ) -> [String: Any] {
    let adultHost = sanitizedActivationHost(adultHostInput, fallback: "pornhub.com")
    let normalHost = sanitizedActivationHost(normalHostInput, fallback: "www.khanacademy.org")
    let authorized = isAuthorized()
    let activeFilter = authorized && isAdultFilterActive()
    let selectedTargetCount = selectedApplicationCount() + selectedCategoryCount() + selectedWebDomainCount()
    let appLimitScheduled = isAppLimitMonitoringActive()
    let safariRuleCount = sharedDefaults().integer(forKey: safariContentBlockerRuleCountKey)
    let safariVersion = sharedDefaults().string(forKey: safariContentBlockerVersionKey) ?? ""
    let safariStateKnown = sharedDefaults().bool(forKey: safariContentBlockerStateKnownKey)
    let safariEnabled = safariStateKnown && sharedDefaults().bool(forKey: safariContentBlockerEnabledKey)
    let safariStateError = sharedDefaults().string(forKey: safariContentBlockerStateErrorKey) ?? ""
    let adultBlocked = safariContentBlockerRulesMatch(host: adultHost)
    let normalAllowed = !safariContentBlockerRulesMatch(host: normalHost)
    var issues: [String] = []
    var issueCodes: [String] = []

    if !authorized {
      issues.append("Screen Time authorization is not approved.")
      issueCodes.append("ios-screen-time-authorization-missing")
    }
    if !activeFilter {
      issues.append("ManagedSettings adult web filter is not active.")
      issueCodes.append("ios-adult-filter-inactive")
    }
    if selectedTargetCount <= 0 {
      issues.append("No Screen Time app, category, or web-domain targets are selected.")
      issueCodes.append("ios-screen-time-targets-missing")
    }
    if !appLimitScheduled {
      issues.append("Selected app daily-limit DeviceActivity monitor is not scheduled.")
      issueCodes.append("ios-device-activity-monitor-missing")
    }
    if safariRuleCount <= 0 {
      issues.append("Safari Content Blocker rules are not synced.")
      issueCodes.append("ios-safari-rules-missing")
    }
    if !safariEnabled {
      issues.append(safariStateError.isEmpty ? "FREED Safari Content Blocker is not enabled in Safari settings." : "Safari Content Blocker state needs attention: \(safariStateError)")
      issueCodes.append("ios-safari-extension-disabled")
    }
    if requireReviewedAdultFeed && !isReviewedFeedVersion(safariVersion) {
      issues.append("Safari Content Blocker rules are still embedded fallback, not reviewed remote provenance.")
      issueCodes.append("ios-safari-feed-not-reviewed")
    }
    if !adultBlocked {
      issues.append("Safari adult-domain smoke host did not match a block rule.")
      issueCodes.append("ios-adult-smoke-not-blocked")
    }
    if !normalAllowed {
      issues.append("Safari normal-site smoke host matched a block rule.")
      issueCodes.append("ios-normal-smoke-blocked")
    }

    let passed = issues.isEmpty
    return [
      "platform": "ios",
      "checkedNativeLayer": true,
      "nativeChecksPassed": passed,
      "adultBlocked": adultBlocked,
      "normalAllowed": normalAllowed,
      "message": passed
        ? "iOS native activation diagnostics passed for Screen Time, ManagedSettings, DeviceActivity, selected targets, and Safari domain rules."
        : "iOS native activation diagnostics need attention.",
      "issues": issues,
      "issueCodes": issueCodes,
      "adultMatchedRule": adultBlocked ? "safari-content-blocker" : "safari-content-blocker-miss",
      "normalMatchedRule": normalAllowed ? "safari-content-blocker-allow" : "safari-content-blocker-overblock",
      "appInterventionAuthorized": authorized,
      "blockedApplications": selectedTargetCount,
      "safariContentBlockerVersion": safariVersion,
      "safariContentBlockerRuleCount": safariRuleCount,
      "safariContentBlockerEnabled": safariEnabled,
      "safariContentBlockerStateError": safariStateError
    ]
  }

  private func safariContentBlockerRulesMatch(host: String) -> Bool {
    guard
      let rulesURL = safariContentBlockerRulesURL(),
      let data = try? Data(contentsOf: rulesURL),
      let rules = try? JSONSerialization.jsonObject(with: data) as? [[String: Any]]
    else {
      return false
    }

    let smokeURL = "https://\(host)/"
    let range = NSRange(location: 0, length: (smokeURL as NSString).length)
    for rule in rules {
      guard
        let trigger = rule["trigger"] as? [String: Any],
        let urlFilter = trigger["url-filter"] as? String,
        let action = rule["action"] as? [String: Any],
        let actionType = action["type"] as? String,
        actionType == "block",
        let regex = try? NSRegularExpression(pattern: urlFilter)
      else {
        continue
      }
      if regex.firstMatch(in: smokeURL, range: range) != nil {
        return true
      }
    }

    return false
  }

  private func sanitizedActivationHost(_ input: String, fallback: String) -> String {
    let trimmed = input.trimmingCharacters(in: .whitespacesAndNewlines)
    let withScheme = trimmed.range(of: "^[a-z][a-z0-9+.-]*://", options: [.regularExpression, .caseInsensitive]) == nil
      ? "https://\(trimmed)"
      : trimmed
    let parsedHost = URL(string: withScheme)?.host ?? trimmed
    let host = parsedHost
      .lowercased()
      .replacingOccurrences(of: #"^www\."#, with: "", options: .regularExpression)
      .components(separatedBy: CharacterSet(charactersIn: "/?#@:"))
      .first?
      .trimmingCharacters(in: CharacterSet(charactersIn: "."))
      .prefix(120)
    let normalized = String(host ?? "")
      .filter { character in
        character.isLetter || character.isNumber || character == "." || character == "-"
      }
    return isAllowedActivationHost(normalized) ? normalized : fallback
  }

  private func isAllowedActivationHost(_ host: String) -> Bool {
    guard host.contains("."), host.count <= 253 else {
      return false
    }
    guard host.range(of: #"^[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?$"#, options: .regularExpression) != nil else {
      return false
    }
    return host.split(separator: ".").allSatisfy { label in
      !label.isEmpty && label.count <= 63 && !label.hasPrefix("-") && !label.hasSuffix("-")
    }
  }

  private func isReviewedFeedVersion(_ version: String?) -> Bool {
    let value = version?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
    return !value.isEmpty && !value.hasPrefix("freed-embedded-")
  }

  private func statusPayload(authorized: Bool, active: Bool, scheduled: Bool = false, message: String) -> [String: Any] {
    let selectedApplicationCountValue = selectedApplicationCount()
    let selectedCategoryCountValue = selectedCategoryCount()
    let selectedWebDomainCountValue = selectedWebDomainCount()
    let selectedScreenTimeTokenCount = selectedApplicationCountValue + selectedCategoryCountValue + selectedWebDomainCountValue
    let activeUnlockExpiresAt = activeEarnedUnlockExpiresAt()
    let appLimitReachedDateValue = appLimitReachedDate()
    var payload: [String: Any] = [
      "authorized": authorized,
      "active": active,
      "scheduled": scheduled,
      "selectedApplications": selectedApplicationCountValue,
      "selectedCategories": selectedCategoryCountValue,
      "selectedWebDomains": selectedWebDomainCountValue,
      "selectedScreenTimeTokenCount": selectedScreenTimeTokenCount,
      "adultFilterActive": active,
      "adultFilterStaysActiveDuringEarnedUnlock": activeUnlockExpiresAt != nil && active,
      "appInterventionAuthorized": authorized,
      "appLimitScheduled": isAppLimitMonitoringActive(),
      "appLimitActivityName": appLimitActivityName,
      "appLimitEventName": appLimitEventName,
      "earnedUnlockActivityName": earnedUnlockActivityName,
      "appLimitReachedToday": appLimitReachedDateValue == localDateKey(),
      "dailyLimitMinutes": configuredDailyLimitMinutes(),
      "mode": "screen-time",
      "message": message
    ]
    if let appLimitReachedDateValue = appLimitReachedDateValue {
      payload["appLimitReachedDate"] = appLimitReachedDateValue
    }
    if let activeUnlockExpiresAt = activeUnlockExpiresAt {
      payload["activeUnlockExpiresAt"] = activeUnlockExpiresAt
      payload["selectedShieldsPausedForEarnedUnlock"] = activeEarnedUnlockScope() != nil
    }
    if let version = sharedDefaults().string(forKey: safariContentBlockerVersionKey) {
      payload["safariContentBlockerVersion"] = version
    }
    if let checksum = sharedDefaults().string(forKey: safariContentBlockerChecksumKey) {
      payload["safariContentBlockerChecksum"] = checksum
    }
    let safariRuleCount = sharedDefaults().integer(forKey: safariContentBlockerRuleCountKey)
    if safariRuleCount > 0 {
      payload["safariContentBlockerRuleCount"] = safariRuleCount
    }
    if sharedDefaults().bool(forKey: safariContentBlockerStateKnownKey) {
      payload["safariContentBlockerEnabled"] = sharedDefaults().bool(forKey: safariContentBlockerEnabledKey)
    }
    if let stateCheckedAt = sharedDefaults().string(forKey: safariContentBlockerStateCheckedAtKey) {
      payload["safariContentBlockerStateCheckedAt"] = stateCheckedAt
    }
    if let stateError = sharedDefaults().string(forKey: safariContentBlockerStateErrorKey) {
      payload["safariContentBlockerStateError"] = stateError
    }
    if let reloadError = sharedDefaults().string(forKey: safariContentBlockerLastReloadErrorKey) {
      payload["safariContentBlockerLastReloadError"] = reloadError
    }
    return payload
  }

  private func classifyChallengePhoto(uri: String, expectedLabels: [String]) -> [String: Any] {
    let expected = expectedLabels.map(normalizePhotoLabel).filter { !$0.isEmpty }
    guard !expected.isEmpty else {
      return photoClassificationPayload(
        available: false,
        matched: false,
        labels: [],
        matchedLabels: [],
        confidence: nil,
        message: "This photo challenge has no verifiable target labels."
      )
    }

    #if canImport(Vision)
    guard let url = fileURL(from: uri) else {
      return photoClassificationPayload(
        available: true,
        matched: false,
        labels: [],
        matchedLabels: [],
        confidence: nil,
        message: "FREED could not read that camera image."
      )
    }

    do {
      let request = VNClassifyImageRequest()
      let handler = VNImageRequestHandler(url: url, options: [:])
      try handler.perform([request])
      let observations = (request.results ?? []).prefix(12)
      let labels = observations.map { $0.identifier }
      var matchedLabels: [String] = []
      var bestConfidence: Double?

      observations.forEach { observation in
        let normalizedIdentifiers = observation.identifier
          .split(separator: ",")
          .map { normalizePhotoLabel(String($0)) }
          .filter { !$0.isEmpty }

        let matched = normalizedIdentifiers.first { observed in
          expected.contains { target in photoLabelMatches(observed: observed, expected: target) }
        }

        if let matched {
          let confidence = Double(observation.confidence)
          bestConfidence = max(bestConfidence ?? 0, confidence)
          if confidence >= photoMatchMinConfidence {
            matchedLabels.append(matched)
          }
        }
      }

      let uniqueMatches = Array(Set(matchedLabels)).sorted()
      let confidentMatch = (bestConfidence ?? 0) >= photoMatchMinConfidence
      return photoClassificationPayload(
        available: true,
        matched: !uniqueMatches.isEmpty && confidentMatch,
        labels: labels,
        matchedLabels: uniqueMatches,
        confidence: bestConfidence,
        message: bestConfidence == nil
          ? "No matching on-device image labels were found. Take a clearer photo of the target."
          : !confidentMatch
            ? "The target label was too uncertain. Take a clearer photo with the target centered."
          : "Photo target verified on device."
      )
    } catch {
      return photoClassificationPayload(
        available: true,
        matched: false,
        labels: [],
        matchedLabels: [],
        confidence: nil,
        message: "FREED could not classify that image: \(error.localizedDescription)"
      )
    }
    #else
    return photoClassificationPayload(
      available: false,
      matched: false,
      labels: [],
      matchedLabels: [],
      confidence: nil,
      message: "Vision image classification is unavailable in this build."
    )
    #endif
  }

  private func fileURL(from uri: String) -> URL? {
    if let url = URL(string: uri), url.isFileURL {
      return url
    }
    return URL(fileURLWithPath: uri)
  }

  private func normalizePhotoLabel(_ value: String) -> String {
    value
      .lowercased()
      .components(separatedBy: CharacterSet.alphanumerics.inverted)
      .filter { !$0.isEmpty }
      .joined(separator: " ")
  }

  private func photoLabelMatches(observed: String, expected: String) -> Bool {
    if observed.contains(expected) || expected.contains(observed) {
      return true
    }
    let observedTokens = Set(observed.split(separator: " ").map(String.init))
    let expectedTokens = Set(expected.split(separator: " ").map(String.init))
    return !observedTokens.isDisjoint(with: expectedTokens)
  }

  private func photoClassificationPayload(
    available: Bool,
    matched: Bool,
    labels: [String],
    matchedLabels: [String],
    confidence: Double?,
    message: String
  ) -> [String: Any] {
    var payload: [String: Any] = [
      "available": available,
      "matched": matched,
      "labels": labels,
      "matchedLabels": matchedLabels,
      "message": message
    ]
    if let confidence {
      payload["confidence"] = confidence
    }
    return payload
  }
}

#if canImport(FamilyControls) && canImport(SwiftUI)
@available(iOS 16.0, *)
private struct FreedFamilyActivityPickerView: View {
  @State private var selection: FamilyActivitySelection
  let onCancel: () -> Void
  let onDone: (FamilyActivitySelection) -> Void

  init(
    initialSelection: FamilyActivitySelection,
    onCancel: @escaping () -> Void,
    onDone: @escaping (FamilyActivitySelection) -> Void
  ) {
    self._selection = State(initialValue: initialSelection)
    self.onCancel = onCancel
    self.onDone = onDone
  }

  var body: some View {
    NavigationStack {
      FamilyActivityPicker(
        headerText: "Choose apps, categories, or web domains FREED should protect during high-risk moments.",
        footerText: "Normal browsing stays available. FREED uses this selection only for Screen Time protection.",
        selection: $selection
      )
      .navigationTitle("FREED Protection")
      .toolbar {
        ToolbarItem(placement: .cancellationAction) {
          Button("Cancel", action: onCancel)
        }
        ToolbarItem(placement: .confirmationAction) {
          Button("Done") {
            onDone(selection)
          }
        }
      }
    }
  }
}
#endif
