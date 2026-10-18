import Foundation
import ManagedSettings
import FamilyControls
import UserNotifications

// BEGIN GENERATED SHIELD ACTION COPY
private enum FreedShieldActionCopy {
  static let strings: [String: [String: String]] = [
    "en": ["title": "FREED recovery ready", "body": "Open FREED to begin a local recovery challenge."],
    "hi": ["title": "FREED पुनर्प्राप्ति तैयार", "body": "स्थानीय पुनर्प्राप्ति चुनौती शुरू करने के लिए FREED खोलें।"],
    "es": ["title": "Recuperación FREED lista", "body": "Abra FREED para comenzar un desafío de recuperación local."],
    "pt": ["title": "Recuperação FREED pronta", "body": "Abra o FREED para iniciar um desafio de recuperação local."],
    "fr": ["title": "Récupération FREED prête", "body": "Ouvrez FREED pour lancer un défi de récupération locale."],
    "de": ["title": "FREED-Wiederherstellung bereit", "body": "Öffnen Sie FREED, um eine lokale Wiederherstellungsherausforderung zu starten."],
    "ar": ["title": "استرداد FREED جاهز", "body": "افتح FREED لبدء تحدي الاسترداد المحلي."],
    "ja": ["title": "FREED リカバリ準備完了", "body": "FREED を開いて、ローカル リカバリ チャレンジを開始します。"],
    "ko": ["title": "FREED 복구 준비 완료", "body": "FREED를 열어 로컬 복구 챌린지를 시작하세요."],
    "zh-Hans": ["title": "FREED 恢复就绪", "body": "打开 FREED 开始本地恢复挑战。"]
  ]
  static func language(selected: String?, preferred: String) -> String {
    if let selected, strings[selected] != nil { return selected }
    let normalized = preferred.replacingOccurrences(of: "_", with: "-").lowercased()
    if normalized.hasPrefix("zh") {
      return ["hant", "tw", "hk", "mo"].contains(where: normalized.contains) ? "en" : "zh-Hans"
    }
    let base = String(normalized.split(separator: "-").first ?? "en")
    return strings[base] != nil ? base : "en"
  }
}
// END GENERATED SHIELD ACTION COPY

@objc(ShieldActionExtension)
final class ShieldActionExtension: ShieldActionDelegate {
  private struct PublishedIntervention {
    let id: String
    let generation: Int
    let encodedRecord: Data
  }

  private struct ShieldDecision {
    let response: ShieldActionResponse
    let notification: UNNotificationRequest?
  }

  private struct InterventionScope: Codable {
    let kind: String
    let tokenType: String
    let token: String
    var websiteProbeRevision: Int? = nil
    var websiteProbeOwner: String? = nil
    var groupId: String? = nil
    var groupRevision: Int? = nil
    var configurationGeneration: Int? = nil
    var scopeEpoch: Int? = nil
    var bootIdentity: String? = nil
    var issuedAt: Double? = nil
    var issuedUptime: Double? = nil
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
  private let resetMarkerKey = "freed.protectionConfiguration.reset"

  override func handle(
    action: ShieldAction,
    for application: ApplicationToken,
    completionHandler: @escaping (ShieldActionResponse) -> Void
  ) {
    let diagnostic = FreedShieldRuntimeDiagnostics.begin(role: .action, callback: .app, action: diagnosticAction(action))
    let result = response(for: action, context: "application", scope: scopeForApplication(application), application: application)
    FreedShieldRuntimeDiagnostics.finish(diagnostic, outcome: diagnosticOutcome(result))
    completionHandler(result)
  }

  override func handle(
    action: ShieldAction,
    for webDomain: WebDomainToken,
    completionHandler: @escaping (ShieldActionResponse) -> Void
  ) {
    let diagnostic = FreedShieldRuntimeDiagnostics.begin(role: .action, callback: .site, action: diagnosticAction(action))
    let result = response(for: action, context: "web domain", scope: scopeForWebDomain(webDomain), webDomain: webDomain)
    FreedShieldRuntimeDiagnostics.finish(diagnostic, outcome: diagnosticOutcome(result))
    completionHandler(result)
  }

  override func handle(
    action: ShieldAction,
    for category: ActivityCategoryToken,
    completionHandler: @escaping (ShieldActionResponse) -> Void
  ) {
    let diagnostic = FreedShieldRuntimeDiagnostics.begin(role: .action, callback: .category, action: diagnosticAction(action))
    let result = response(for: action, context: "category-wide", scope: scopeForCategory(category))
    FreedShieldRuntimeDiagnostics.finish(diagnostic, outcome: diagnosticOutcome(result))
    completionHandler(result)
  }

  private func diagnosticAction(_ action: ShieldAction) -> FreedShieldRuntimeDiagnostics.Action {
    switch action {
    case .primaryButtonPressed: return .primary
    case .secondaryButtonPressed: return .secondary
    default: return .unknown
    }
  }
  private func diagnosticOutcome(_ response: ShieldActionResponse) -> FreedShieldRuntimeDiagnostics.Outcome {
    if #available(iOS 26.5, *), response == .openParentalControlsApp { return .openParent }
    switch response {
    case .close: return .close
    case .defer: return .deferred
    default: return .close
    }
  }

  private func response(
    for action: ShieldAction,
    context: String,
    scope: InterventionScope?,
    application: ApplicationToken? = nil,
    webDomain: WebDomainToken? = nil
  ) -> ShieldActionResponse {
    let publication: PublishedIntervention?
    do {
      publication = try FreedProtectionConfigurationLock.withExclusiveAccess { defaults in
        guard FreedProtectionConfigurationLock.permitsPublication(defaults) else { return nil }
        switch action {
        case .primaryButtonPressed:
          var currentScope = scope
          if #available(iOS 16.0, *), let webDomain {
            // Probe membership must be observed in its distinct native store.
            // If this token is unrelated, retain the existing legacy website path.
            if let state = FreedWebsiteRecoveryProbe.state(defaults),
              let encoded = try? JSONEncoder().encode(webDomain), state.active.contains(encoded) {
              guard let fields = FreedWebsiteRecoveryProbe.callbackFields(token: webDomain, defaults: defaults) else { return nil }
              currentScope?.websiteProbeRevision = fields["websiteProbeRevision"] as? Int
              currentScope?.websiteProbeOwner = fields["websiteProbeOwner"] as? String
              currentScope?.configurationGeneration = fields["configurationGeneration"] as? Int
              currentScope?.scopeEpoch = fields["scopeEpoch"] as? Int
            } else {
              // An unregistered domain callback cannot inherit probe authority.
              let data = defaults.data(forKey: "freed.familyActivitySelection")
              let selection = data.flatMap { try? JSONDecoder().decode(FamilyActivitySelection.self, from: $0) }
              guard selection?.webDomainTokens.contains(webDomain) == true || !(selection?.categoryTokens.isEmpty ?? true) else { return nil }
            }
          }
          if #available(iOS 16.0, *), let application,
            let group = FreedAppGroupsRuntime.shared.issueScope(for: application, defaults),
            let data = try? JSONSerialization.data(withJSONObject: group),
            let scoped = try? JSONDecoder().decode(InterventionScope.self, from: data) { currentScope = scoped }
          return recordPendingIntervention(context: context, scope: currentScope, defaults: defaults)
        default:
          return nil
        }
      }
    } catch {
      return .close
    }
    // The outer lock also confirms its final preferences flush. Neither the
    // system app-open response nor the fallback notification may precede it.
    guard let publication else { return .close }
    do {
      let decision: ShieldDecision = try FreedProtectionConfigurationLock.withExclusiveAccess(afterSuccessfulPersistence: { (decision: ShieldDecision) in
        if let request = decision.notification {
          self.submitPendingInterventionNotification(request, publication: publication)
        }
      }) { defaults in
        guard isCurrentPublication(publication, defaults: defaults) else {
          return ShieldDecision(response: .close, notification: nil)
        }
        if #available(iOS 26.5, *) {
          return ShieldDecision(response: .openParentalControlsApp, notification: nil)
        }
        return ShieldDecision(response: .close, notification: pendingInterventionNotification(publication, defaults: defaults))
      }
      return decision.response
    } catch {
      return .close
    }
  }

  private func isCurrentPublication(_ publication: PublishedIntervention, defaults: UserDefaults) -> Bool {
    guard FreedProtectionConfigurationLock.permitsPublication(defaults, capturedGeneration: publication.generation),
      defaults.data(forKey: pendingInterventionRecordKey) == publication.encodedRecord else { return false }
    if let record = try? JSONDecoder().decode(PendingInterventionRecord.self, from: publication.encodedRecord),
      let scope = record.scope, scope.websiteProbeRevision != nil {
      guard #available(iOS 16.0, *), let token = Data(base64Encoded: scope.token) else { return false }
      return FreedWebsiteRecoveryProbe.validCallback(token: token, revision: scope.websiteProbeRevision,
        owner: scope.websiteProbeOwner, generation: scope.configurationGeneration, epoch: scope.scopeEpoch, defaults: defaults)
    }
    return true
  }

  private func recordPendingIntervention(context: String, scope: InterventionScope?, defaults: UserDefaults) -> PublishedIntervention? {
    let generation = FreedProtectionConfigurationLock.generation(defaults)
    guard let scope, FreedProtectionConfigurationLock.permitsPublication(defaults, capturedGeneration: generation) else { return nil }
    let record = PendingInterventionRecord(
      id: UUID().uuidString,
      host: screenTimeShieldHost,
      sourcePackage: "ios-screen-time",
      reason: "Screen Time \(context) shield requested a recovery intervention.",
      matchedRule: scope.groupId.map { "app-group:\($0):\(scope.groupRevision ?? 0)" } ?? "ios-screen-time-shield",
      detectedAt: ISO8601DateFormatter().string(from: Date()),
      scope: scope
    )

    guard let encodedRecord = try? JSONEncoder().encode(record) else { return nil }
    // A single App Group value makes publication atomic for the containing app.
    defaults.set(encodedRecord, forKey: pendingInterventionRecordKey)
    guard FreedProtectionConfigurationLock.persist(defaults),
      FreedProtectionConfigurationLock.permitsPublication(defaults, capturedGeneration: generation),
      defaults.data(forKey: pendingInterventionRecordKey) == encodedRecord
    else {
      // Remove only this callback's publication, preserving another writer's
      // record if reset or a generation change invalidated this one.
      if defaults.data(forKey: pendingInterventionRecordKey) == encodedRecord {
        defaults.removeObject(forKey: pendingInterventionRecordKey)
        _ = FreedProtectionConfigurationLock.persist(defaults)
      }
      return nil
    }
    return PublishedIntervention(id: record.id, generation: generation, encodedRecord: encodedRecord)
  }

  private func pendingInterventionNotification(_ publication: PublishedIntervention, defaults: UserDefaults) -> UNNotificationRequest {
    let content = UNMutableNotificationContent()
    let presentation = defaults.dictionary(forKey: "freed.presentation.v1") as? [String: String] ?? [:]
    let language = FreedShieldActionCopy.language(selected: presentation["language"], preferred: Locale.preferredLanguages.first ?? "en")
    let copy = FreedShieldActionCopy.strings[language] ?? FreedShieldActionCopy.strings["en"]!
    content.title = copy["title"]!
    content.body = copy["body"]!
    content.userInfo = ["kind": "freed-pending-intervention"]
    content.userInfo["shieldGeneration"] = publication.generation

    let trigger = UNTimeIntervalNotificationTrigger(timeInterval: 1, repeats: false)
    return UNNotificationRequest(identifier: publication.id, content: content, trigger: trigger)
  }

  private func submitPendingInterventionNotification(_ request: UNNotificationRequest, publication: PublishedIntervention) {
    let center = UNUserNotificationCenter.current()
    center.add(request) { [weak self] error in
      let current = error == nil && ((try? FreedProtectionConfigurationLock.withExclusiveAccess { defaults in
        self?.isCurrentPublication(publication, defaults: defaults) ?? false
      }) == true)
      if !current {
        center.removePendingNotificationRequests(withIdentifiers: [publication.id])
        center.removeDeliveredNotifications(withIdentifiers: [publication.id])
      }
    }
  }

  private func scopeForApplication(_ application: ApplicationToken) -> InterventionScope? {
    return tokenScope(application, tokenType: "application")
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
