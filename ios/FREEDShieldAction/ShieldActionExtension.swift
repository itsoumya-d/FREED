import Foundation
import ManagedSettings

final class ShieldActionExtension: ShieldActionDelegate {
  private let appGroupIdentifier = "group.app.freed.recovery"
  private let pendingInterventionUrlKey = "freed.pendingIntervention.url"
  private let pendingInterventionHostKey = "freed.pendingIntervention.host"
  private let pendingInterventionSourceKey = "freed.pendingIntervention.source"
  private let pendingInterventionReasonKey = "freed.pendingIntervention.reason"
  private let pendingInterventionRuleKey = "freed.pendingIntervention.rule"
  private let pendingInterventionDetectedAtKey = "freed.pendingIntervention.detectedAt"
  private let screenTimeShieldUrl = "https://screen-time-shield.freed.local"
  private let screenTimeShieldHost = "screen-time-shield.freed.local"

  override func handle(
    action: ShieldAction,
    for application: ApplicationToken,
    completionHandler: @escaping (ShieldActionResponse) -> Void
  ) {
    completionHandler(response(for: action, context: "application"))
  }

  override func handle(
    action: ShieldAction,
    for webDomain: WebDomainToken,
    completionHandler: @escaping (ShieldActionResponse) -> Void
  ) {
    completionHandler(response(for: action, context: "web domain"))
  }

  override func handle(
    action: ShieldAction,
    for category: ActivityCategoryToken,
    completionHandler: @escaping (ShieldActionResponse) -> Void
  ) {
    completionHandler(response(for: action, context: "category"))
  }

  private func response(for action: ShieldAction, context: String) -> ShieldActionResponse {
    switch action {
    case .primaryButtonPressed:
      recordPendingIntervention(context: context)
      return .defer
    case .secondaryButtonPressed:
      return .close
    @unknown default:
      return .none
    }
  }

  private func recordPendingIntervention(context: String) {
    let defaults = UserDefaults(suiteName: appGroupIdentifier) ?? UserDefaults.standard
    defaults.set(screenTimeShieldUrl, forKey: pendingInterventionUrlKey)
    defaults.set(screenTimeShieldHost, forKey: pendingInterventionHostKey)
    defaults.set("ios-screen-time", forKey: pendingInterventionSourceKey)
    defaults.set(
      "Screen Time \(context) shield requested a recovery intervention.",
      forKey: pendingInterventionReasonKey
    )
    defaults.set("ios-screen-time-shield", forKey: pendingInterventionRuleKey)
    defaults.set(ISO8601DateFormatter().string(from: Date()), forKey: pendingInterventionDetectedAtKey)
  }
}
