import Foundation

@main struct ProtectionResetCases {
  static func main() {
    let domain = "app.freed.tests.protection-reset.\(UUID().uuidString)"
    let defaults = UserDefaults(suiteName: domain)!
    defer { defaults.removePersistentDomain(forName: domain) }

    for key in FreedProtectionResetPolicy.removedKeys { defaults.set("private-value", forKey: key) }
    for key in FreedProtectionResetPolicy.disabledKeys { defaults.set(true, forKey: key) }
    for key in FreedProtectionResetPolicy.zeroCountKeys { defaults.set(3, forKey: key) }
    defaults.set("preserved", forKey: "another-app.preference")
    defaults.set(["language": "hi", "themeMode": "dark"], forKey: "freed.presentation.v1")
    precondition(FreedProtectionResetPolicy.persistEmptyConfiguration(in: defaults, domain: domain))
    let reloaded = UserDefaults(suiteName: domain)!
    precondition(FreedProtectionResetPolicy.isEmptyConfiguration(reloaded.persistentDomain(forName: domain)))
    precondition(reloaded.string(forKey: "another-app.preference") == "preserved")
    precondition(reloaded.dictionary(forKey: "freed.presentation.v1") as? [String: String] == ["language": "hi", "themeMode": "dark"])
    precondition(reloaded.object(forKey: "freed.familyActivitySelection") == nil)
    precondition(reloaded.object(forKey: "freed.pendingIntervention.unlockScope") == nil)
    precondition(reloaded.object(forKey: "freed.earnedUnlock.interventionId") == nil)
    precondition(reloaded.bool(forKey: FreedProtectionResetPolicy.resetMarkerKey))
    precondition(!FreedProtectionResetPolicy.isEmptyConfiguration(nil))
    reloaded.set("stale-intervention", forKey: "freed.pendingIntervention.record")
    precondition(!FreedProtectionResetPolicy.isEmptyConfiguration(reloaded.persistentDomain(forName: domain)))
    precondition(FreedProtectionResetPolicy.persistEmptyConfiguration(in: reloaded, domain: domain))

    func receipt(errors: [String] = [], blocker: Bool? = false, focus: Bool? = false) -> [String: Any] {
      FreedProtectionResetPolicy.receipt(errors: errors, safariContentBlockerEnabled: blocker,
        safariFocusShieldEnabled: focus)
    }
    let accepted = receipt()
    precondition(accepted["protectionConfigurationResetAccepted"] as? Bool == true)
    precondition(accepted["protectionConfigurationResetError"] == nil)
    for error in ["ios-reset-preferences-not-confirmed", "ios-reset-monitors-still-active",
                  "ios-reset-shields-not-confirmed", "ios-reset-dns-remove-not-confirmed",
                  "ios-reset-safari-rules-remove-failed", "ios-reset-safari-reload-failed"] {
      let failed = receipt(errors: [error])
      precondition(failed["protectionConfigurationResetAccepted"] as? Bool == false)
      precondition(failed["protectionConfigurationResetError"] as? String == error)
      precondition(failed["protectionConfigurationResetRetryable"] as? Bool == true)
    }
    let enabledBlocker = receipt(blocker: true)
    precondition(enabledBlocker["protectionConfigurationResetAccepted"] as? Bool == true)
    precondition(enabledBlocker["safariContentBlockerEnabled"] as? Bool == true)
    let unknownFocus = receipt(focus: nil)
    precondition(unknownFocus["protectionConfigurationResetAccepted"] as? Bool == true)
    precondition(unknownFocus["safariFocusShieldEnabled"] is NSNull)
    precondition(unknownFocus["safariResidualState"] as? String == "ios-reset-safari-existing-tabs-reload-required")
    let enabledFocus = receipt(focus: true)
    precondition(enabledFocus["protectionConfigurationResetAccepted"] as? Bool == true)
    precondition(enabledFocus["safariExistingTabsReloadRequired"] as? Bool == true)
    precondition(receipt(blocker: nil)["protectionConfigurationResetAccepted"] as? Bool == true)
    print("iOS protection reset persistence, private-state removal, unrelated preference preservation, and strict residual-state receipts passed")
  }
}
