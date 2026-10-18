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
  private let resetMarkerKey = "freed.protectionConfiguration.reset"
  private let APPROVED_RULE_HOSTS = [
    "short-form:youtube-shorts": "youtube.com",
    "short-form:instagram-reels": "instagram.com",
    "short-form:tiktok-feed": "tiktok.com"
  ]

  func beginRequest(with context: NSExtensionContext) {
    let response = NSExtensionItem()
    if let raw = (context.inputItems.first as? NSExtensionItem)?.userInfo?[SFExtensionMessageKey] as? [String: Any],
       let type = raw["type"] as? String, ["begin-safari-recovery-observation", "commit-safari-recovery-observation"].contains(type) {
      response.userInfo = [SFExtensionMessageKey: processObservationMessage(raw)]
      context.completeRequest(returningItems: [response]); return
    }
    let completed = (try? FreedProtectionConfigurationLock.withExclusiveAccess { _ -> Bool in
      let rawMessage = (context.inputItems.first as? NSExtensionItem)?.userInfo?[SFExtensionMessageKey] as? [String: Any]
      if rawMessage?["type"] as? String == "get-protection-configuration" {
        response.userInfo = [SFExtensionMessageKey: ["protectionConfigurationActive": !isConfigurationReset()]]
      } else {
        let accepted = recordMessage(from: context)
        response.userInfo = [SFExtensionMessageKey: ["accepted": accepted,
            "protectionConfigurationActive": !isConfigurationReset()]]
      }
      return true
    }) ?? false
    if !completed {
      response.userInfo = [SFExtensionMessageKey: ["accepted": false, "protectionConfigurationActive": false]]
    }
    context.completeRequest(returningItems: [response])
  }

  // Fixed observation route. No caller can supply a bundle path or expected identity.
  func processObservationMessage(_ message: [String: Any], observation: FreedSafariRecoveryObservation = .shared) -> [String: Any] {
    let begin = message["type"] as? String == "begin-safari-recovery-observation"
    do {
      guard message.count <= 13, message.keys.allSatisfy({ $0.utf8.count <= 64 }),
        message.values.allSatisfy({ value in
          if let text = value as? String { return text.utf8.count <= 128 }
          return value is NSNumber || value is NSNull
        }), JSONSerialization.isValidJSONObject(message), try JSONSerialization.data(withJSONObject: message).count <= 4096 else { throw FreedSafariRecoveryObservation.Failure(reason: "malformed") }
      let expected = try observation.readExpectedPackage() // Immutable resources: outside exclusion.
      if begin {
        guard Set(message.keys) == ["version", "type"], let version = message["version"] as? NSNumber,
          CFGetTypeID(version) != CFBooleanGetTypeID(), version.doubleValue == 1 else { throw FreedSafariRecoveryObservation.Failure(reason: "malformed") }
        return try observation.begin(expected: expected)
      }
      return try observation.commit(message, expected: expected)
    } catch {
      let reason = (error as? FreedSafariRecoveryObservation.Failure)?.reason ?? "storage-unavailable"
      try? observation.recordDiagnostic(reason)
      return begin ? ["version": 1, "issued": false, "reason": reason]
        : ["version": 1, "persisted": false, "reason": reason, "receipt": NSNull()]
    }
  }

  private func isConfigurationReset() -> Bool {
    let defaults = FreedProtectionConfigurationLock.sharedDefaults()
    return defaults.bool(forKey: resetMarkerKey)
  }

  private func recordMessage(from context: NSExtensionContext) -> Bool {
    // This protects native authority even when Safari still runs an older
    // cached content script that never learned to query reset configuration.
    guard !isConfigurationReset() else { return false }
    guard
      let item = context.inputItems.first as? NSExtensionItem,
      let rawMessage = item.userInfo?[SFExtensionMessageKey],
      JSONSerialization.isValidJSONObject(rawMessage),
      let data = try? JSONSerialization.data(withJSONObject: rawMessage),
      let message = try? JSONDecoder().decode(NativeMessage.self, from: data),
      message.type == "record-pending-intervention",
      message.source == "ios-safari-short-form",
      APPROVED_RULE_HOSTS[message.rule] == message.host
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
    let defaults = FreedProtectionConfigurationLock.sharedDefaults()
    defaults.set(encodedRecord, forKey: pendingInterventionRecordKey)
    if isConfigurationReset() {
      if defaults.data(forKey: pendingInterventionRecordKey) == encodedRecord {
        defaults.removeObject(forKey: pendingInterventionRecordKey)
      }
      return false
    }
    return true
  }
}
