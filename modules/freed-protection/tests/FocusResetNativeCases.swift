import Foundation

// Test boundary replaces only Safari's context transport. Production handler
// validation and preference reads run against a fresh isolated suite.
let SFExtensionMessageKey = "message"
protocol NSExtensionRequestHandling {}
final class NSExtensionItem { var userInfo: [String: Any]? }
final class NSExtensionContext {
  let inputItems: [Any]
  var response: [String: Any]?
  init(_ message: [String: Any]) {
    let item = NSExtensionItem()
    item.userInfo = [SFExtensionMessageKey: message]
    inputItems = [item]
  }
  func completeRequest(returningItems: [NSExtensionItem]) {
    response = returningItems.first?.userInfo?[SFExtensionMessageKey] as? [String: Any]
  }
}

@main struct FocusResetNativeCases {
  static func main() {
    let defaults = UserDefaults(suiteName: freedFocusTestDomain)!
    defer { defaults.removePersistentDomain(forName: freedFocusTestDomain) }
    func update(_ body: (UserDefaults) -> Void) { try! FreedProtectionConfigurationLock.withExclusiveAccess(containerOverride:freedFocusTestContainer,domain:freedFocusTestDomain){d in body(d)} }
    func storedRecord() -> Data? { try! FreedProtectionConfigurationLock.withExclusiveAccess(containerOverride:freedFocusTestContainer,domain:freedFocusTestDomain){$0.data(forKey:"freed.pendingIntervention.record")} }
    let handler = SafariWebExtensionHandler()
    func request(_ message: [String: Any]) -> [String: Any] {
      let context = NSExtensionContext(message)
      handler.beginRequest(with: context)
      return context.response!
    }
    let trustedOldScriptMessage: [String: Any] = ["type": "record-pending-intervention",
      "source": "ios-safari-short-form", "rule": "short-form:youtube-shorts", "host": "youtube.com"]
    update{$0.set(true, forKey: "freed.protectionConfiguration.reset")}
    precondition(request(["type": "get-protection-configuration"])["protectionConfigurationActive"] as? Bool == false)
    precondition(request(trustedOldScriptMessage)["accepted"] as? Bool == false)
    precondition(storedRecord() == nil)
    update{$0.set(false, forKey: "freed.protectionConfiguration.reset")}
    precondition(request(["type": "get-protection-configuration"])["protectionConfigurationActive"] as? Bool == true)
    precondition(request(trustedOldScriptMessage)["accepted"] as? Bool == true)
    precondition(storedRecord() != nil)
    update{$0.removeObject(forKey: "freed.pendingIntervention.record")}
    update{$0.set(true, forKey: "freed.protectionConfiguration.reset")}
    for _ in 0..<3 { precondition(request(trustedOldScriptMessage)["accepted"] as? Bool == false) }
    precondition(storedRecord() == nil)
    print("iOS Focus native handler denies trusted cached-script intervention publication after reset")
  }
}
