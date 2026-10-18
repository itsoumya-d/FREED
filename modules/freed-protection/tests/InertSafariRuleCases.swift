import Foundation
import WebKit

@main struct InertSafariRuleCases {
  @MainActor static func main() async throws {
    let directory = FileManager.default.temporaryDirectory.appendingPathComponent("freed-inert-safari-\(UUID().uuidString)")
    try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
    defer { try? FileManager.default.removeItem(at: directory) }
    let store = WKContentRuleListStore(url: directory)!
    let rules = try JSONSerialization.jsonObject(with: Data(FreedProtectionResetPolicy.inertSafariRulesJSON.utf8)) as! [[String: Any]]
    precondition(rules.count == 1)
    precondition((rules[0]["action"] as? [String: String])?["type"] == "ignore-previous-rules")
    let compiled = try await store.compileContentRuleList(forIdentifier: "freed-test-inert",
      encodedContentRuleList: FreedProtectionResetPolicy.inertSafariRulesJSON)
    precondition(compiled != nil)
    print("WebKit compiled FREED's documented isolated no-op content-blocker payload")
  }
}
