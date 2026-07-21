import Foundation
import SafariServices

final class SafariWebExtensionHandler: NSObject, NSExtensionRequestHandling {
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

  private struct NativeMessage: Decodable {
    let type: String
    let source: String
    let rule: String
    let host: String
  }

  private let appGroupIdentifier = "group.app.freed.recovery"
  private let pendingInterventionRecordKey = "freed.pendingIntervention.record"
  private let approvedRules = [
    "short-form:youtube-shorts": "youtube.com",
    "short-form:instagram-reels": "instagram.com",
    "short-form:tiktok-feed": "tiktok.com"
  ]

  func beginRequest(with context: NSExtensionContext) {
    let response = NSExtensionItem()
    response.userInfo = [SFExtensionMessageKey: ["accepted": recordMessage(from: context)]]
    context.completeRequest(returningItems: [response])
  }

  private func recordMessage(from context: NSExtensionContext) -> Bool {
    guard
      let item = context.inputItems.first as? NSExtensionItem,
      let rawMessage = item.userInfo?[SFExtensionMessageKey],
      JSONSerialization.isValidJSONObject(rawMessage),
      let data = try? JSONSerialization.data(withJSONObject: rawMessage),
      let message = try? JSONDecoder().decode(NativeMessage.self, from: data),
      message.type == "record-pending-intervention",
      message.source == "ios-safari-short-form",
      approvedRules[message.rule] == message.host
    else {
      return false
    }

    let record = PendingInterventionRecord(
      id: UUID().uuidString,
      host: message.host,
      sourcePackage: message.source,
      reason: "Safari Focus Shield requested a local recovery challenge.",
      matchedRule: message.rule,
      detectedAt: ISO8601DateFormatter().string(from: Date()),
      scope: InterventionScope(kind: "browser-domain", tokenType: nil, token: nil, domain: message.host)
    )
    guard let encodedRecord = try? JSONEncoder().encode(record) else { return false }
    let defaults = UserDefaults(suiteName: appGroupIdentifier) ?? UserDefaults.standard
    defaults.set(encodedRecord, forKey: pendingInterventionRecordKey)
    return true
  }
}
