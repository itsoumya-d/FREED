// PRODUCTION_POLICY
let receipt = Receipt()
func status(configured: Bool, enabled: Bool = false, error: String? = nil) -> [String:Any] {
  FreedEncryptedDnsPolicy.status(supported: true, releaseEnabled: true, configured: configured, managerEnabled: enabled, error: error)
}
let saved = receipt.configurationResult(enabled: true, result: status(configured: true))
precondition(saved["operationAccepted"] as? Bool == true)
precondition(saved["enabled"] as? Bool == false)
precondition(saved["healthy"] is NSNull)
for reason in ["ios-dns-preferences-save-failed", "ios-dns-preferences-load-failed", "ios-reset-dns-configuration-invalidated", "ios-dns-configuration-in-progress", "ios-dns-simulator-unavailable", "encrypted-dns-release-gated", "ios-dns-configuration-mismatch"] {
  let failure = receipt.configurationResult(enabled: true, result: status(configured: true, error: reason))
  precondition(failure["operationAccepted"] as? Bool == false)
  precondition(failure["operationReason"] as? String == reason)
}
precondition(receipt.configurationResult(enabled: true, result: status(configured: false))["operationAccepted"] as? Bool == false)
precondition(receipt.configurationResult(enabled: false, result: status(configured: false))["operationAccepted"] as? Bool == true)
precondition(receipt.configurationResult(enabled: false, result: status(configured: false, error: "ios-dns-preferences-remove-failed"))["operationAccepted"] as? Bool == false)
print("Native DNS receipt accepts a save independently of enablement and rejects preferences, unsupported, reset, mismatch, and missing-configuration results")
for language in ["en", "hi", "es", "pt", "fr", "de", "ar", "ja", "ko", "zh-Hans"] {
  let label = FreedEncryptedDnsPolicy.configurationLabel(selected: language, preferred: "en")
  precondition(label.hasPrefix("FREED · "))
  precondition(language == "en" || label != FreedEncryptedDnsPolicy.configurationLabel(selected: "en", preferred: "en"))
}
precondition(FreedEncryptedDnsPolicy.configurationLabel(selected: "system", preferred: "es-MX") == FreedEncryptedDnsPolicy.configurationLabel(selected: "es", preferred: "en"))
print("Actual native DNS configuration label follows all ten presentation locales")
