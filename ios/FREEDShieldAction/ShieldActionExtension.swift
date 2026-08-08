import Foundation
import ManagedSettings
import UserNotifications

final class ShieldActionExtension: ShieldActionDelegate {
  private struct InterventionScope: Codable {
    let kind: String
    let tokenType: String
    let token: String
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

  private let appGroupIdentifier = "group.app.freed.recovery"
  private let pendingInterventionRecordKey = "freed.pendingIntervention.record"
  private let screenTimeShieldHost = "screen-time-shield.freed.local"

  override func handle(
    action: ShieldAction,
    for application: ApplicationToken,
    completionHandler: @escaping (ShieldActionResponse) -> Void
  ) {
    completionHandler(response(for: action, context: "application", scope: scopeForApplication(application)))
  }

  override func handle(
    action: ShieldAction,
    for webDomain: WebDomainToken,
    completionHandler: @escaping (ShieldActionResponse) -> Void
  ) {
    completionHandler(response(for: action, context: "web domain", scope: scopeForWebDomain(webDomain)))
  }

  override func handle(
    action: ShieldAction,
    for category: ActivityCategoryToken,
    completionHandler: @escaping (ShieldActionResponse) -> Void
  ) {
    completionHandler(response(for: action, context: "category-wide", scope: scopeForCategory(category)))
  }

  private func response(
    for action: ShieldAction,
    context: String,
    scope: InterventionScope?
  ) -> ShieldActionResponse {
    switch action {
    case .primaryButtonPressed:
      let recordID = recordPendingIntervention(context: context, scope: scope)
      schedulePendingInterventionNotification(recordID: recordID)
      return .close
    case .secondaryButtonPressed:
      return .close
    default:
      return .close
    }
  }

  private func recordPendingIntervention(context: String, scope: InterventionScope?) -> String {
    let record = PendingInterventionRecord(
      id: UUID().uuidString,
      host: screenTimeShieldHost,
      sourcePackage: "ios-screen-time",
      reason: "Screen Time \(context) shield requested a recovery intervention.",
      matchedRule: "ios-screen-time-shield",
      detectedAt: ISO8601DateFormatter().string(from: Date()),
      scope: scope
    )

    if let encodedRecord = try? JSONEncoder().encode(record) {
      let defaults = UserDefaults(suiteName: appGroupIdentifier) ?? UserDefaults.standard
      // A single App Group value makes publication atomic for the containing app.
      defaults.set(encodedRecord, forKey: pendingInterventionRecordKey)
    }
    return record.id
  }

  private func schedulePendingInterventionNotification(recordID: String) {
    let content = UNMutableNotificationContent()
    content.title = "FREED recovery ready"
    content.body = "Open FREED to begin a local recovery challenge."
    content.userInfo = ["kind": "freed-pending-intervention"]

    let trigger = UNTimeIntervalNotificationTrigger(timeInterval: 1, repeats: false)
    let request = UNNotificationRequest(identifier: recordID, content: content, trigger: trigger)
    UNUserNotificationCenter.current().add(request)
  }

  private func scopeForApplication(_ application: ApplicationToken) -> InterventionScope? {
    tokenScope(application, tokenType: "application")
  }

  private func scopeForWebDomain(_ webDomain: WebDomainToken) -> InterventionScope? {
    tokenScope(webDomain, tokenType: "domain")
  }

  private func scopeForCategory(_ category: ActivityCategoryToken) -> InterventionScope? {
    tokenScope(category, tokenType: "category")
  }

  private func tokenScope<Token: Encodable>(_ token: Token, tokenType: String) -> InterventionScope? {
    guard let data = try? JSONEncoder().encode(token) else {
      return nil
    }
    return InterventionScope(kind: "ios-token", tokenType: tokenType, token: data.base64EncodedString())
  }
}
