import Foundation

@main struct EncryptedDnsCases {
  static func main() {
    func status(supported: Bool = true, release: Bool = false, configured: Bool = false,
                enabled: Bool = false, error: String? = nil) -> [String: Any] {
      FreedEncryptedDnsPolicy.status(supported: supported, releaseEnabled: release,
        configured: configured, managerEnabled: enabled, error: error)
    }
    precondition(status()["enabled"] as? Bool == false)
    let saved = status(configured: true)
    precondition(saved["configured"] as? Bool == true)
    precondition(saved["enabled"] as? Bool == false)
    precondition(saved["requiresSettings"] as? Bool == true)
    precondition(saved["reason"] as? String == "ios-dns-settings-enable-required")
    let enabled = status(configured: true, enabled: true)
    precondition(enabled["enabled"] as? Bool == true)
    precondition(enabled["healthy"] is NSNull)
    precondition(enabled["reason"] as? String == "encrypted-dns-device-unverified")
    precondition(status(release: true, configured: true, enabled: true)["healthy"] is NSNull)
    precondition(status(supported: false, configured: true, enabled: true)["enabled"] as? Bool == false)
    let failed = status(configured: true, enabled: true, error: "ios-dns-preferences-load-failed")
    precondition(failed["enabled"] as? Bool == false)
    precondition(failed["configured"] as? Bool == true)
    precondition(failed["healthy"] is NSNull)
    precondition(failed["requiresSettings"] as? Bool == true)
    precondition(status(configured: false, enabled: true)["enabled"] as? Bool == false)
    print("Encrypted DNS iOS configuration, enablement, and unknown-health cases passed")
  }
}
