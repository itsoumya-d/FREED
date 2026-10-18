import Foundation
import CryptoKit

// BEGIN GENERATED CONTENT BLOCKER COPY
private enum FreedContentBlockerCopy {
  static let strings: [String: [String: String]] = [
    "en": ["missing": "FREED content-blocker rules were not found.", "load": "FREED could not load content-blocker rules."],
    "hi": ["missing": "FREED सामग्री-अवरोधक नियम नहीं मिले।", "load": "FREED सामग्री-अवरोधक नियम लोड नहीं कर सका।"],
    "es": ["missing": "No se encontraron reglas de bloqueo de contenido FREED.", "load": "FREED no pudo cargar reglas de bloqueo de contenido."],
    "pt": ["missing": "As regras de bloqueio de conteúdo FREED não foram encontradas.", "load": "FREED não pôde carregar regras de bloqueio de conteúdo."],
    "fr": ["missing": "Les règles de blocage de contenu FREED sont introuvables.", "load": "FREED n'a pas pu charger les règles de blocage de contenu."],
    "de": ["missing": "FREED-Inhaltsblockerregeln wurden nicht gefunden.", "load": "FREED konnte die Content-Blocker-Regeln nicht laden."],
    "ar": ["missing": "لم يتم العثور على قواعد حظر المحتوى FREED.", "load": "تعذر على FREED تحميل قواعد حظر المحتوى."],
    "ja": ["missing": "FREED コンテンツ ブロッカー ルールが見つかりませんでした。", "load": "FREED はコンテンツ ブロッカー ルールをロードできませんでした。"],
    "ko": ["missing": "FREED 콘텐츠 차단 규칙을 찾을 수 없습니다.", "load": "FREED는 콘텐츠 차단 규칙을 로드할 수 없습니다."],
    "zh-Hans": ["missing": "未找到 FREED 内容拦截器规则。", "load": "FREED 无法加载内容拦截器规则。"]
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
// END GENERATED CONTENT BLOCKER COPY

@objc(ContentBlockerRequestHandler)
final class ContentBlockerRequestHandler: NSObject, NSExtensionRequestHandling {
  private let appGroupIdentifier = "group.app.freed.recovery"
  private let sharedRulesFileName = "safari-content-blocker-rules.json"
  private let resetRulesFileName = "safari-content-blocker-reset-rules.json"
  private let resetMarkerKey = "freed.protectionConfiguration.reset"
  private let inertRulesJSON = #"[{"trigger":{"url-filter":".*"},"action":{"type":"ignore-previous-rules"}}]"#

  func beginRequest(with context: NSExtensionContext) {
    do {
      try FreedProtectionConfigurationLock.withExclusiveAccess { _ in
        let defaults = FreedProtectionConfigurationLock.sharedDefaults()
        let retained = try FreedRetainedAdultProtection.read(defaults)
        let publication = try FreedRetainedAdultProtection.SafariPublication.read(defaults)
        let adultDisabled = !retained.safari && publication != nil
        let reset = defaults.bool(forKey: resetMarkerKey) && !retained.safari
        // When reset, missing or invalid no-op storage fails reload. It must never
        // fall back to the bundled blocklist and silently restore deleted rules.
        let selectedURL = adultDisabled ? validatedAdultDisabledURL(publication!) : reset ? validatedResetRulesURL()
          : retained.safari ? validatedSharedRulesURL()
          : validatedSharedRulesURL() ?? Bundle.main.url(forResource: "blockerList", withExtension: "json")
        guard let rulesURL = selectedURL else {
          context.cancelRequest(withError: NSError(
              domain: "FreedSafariContentBlocker",
              code: 1,
              userInfo: [NSLocalizedDescriptionKey: localizedError("missing")]
          ))
          return
        }

        // Pin bytes while the same lock protects metadata and publication.
        // An item provider may be consumed after this request releases exclusion;
        // a mutable URL could then deliver a different rule version.
        guard let rulesData = try? Data(contentsOf: rulesURL), rulesData.count <= 16 * 1024 * 1024 else {
          context.cancelRequest(withError: NSError(
              domain: "FreedSafariContentBlocker",
              code: 2,
              userInfo: [NSLocalizedDescriptionKey: localizedError("load")]
          ))
          return
        }

        let provider = NSItemProvider(item: rulesData as NSData, typeIdentifier: "public.json")
        let item = NSExtensionItem()
        item.attachments = [provider]
        context.completeRequest(returningItems: [item])
      }
    } catch {
      context.cancelRequest(withError: NSError(domain: "FreedSafariContentBlocker", code: 3))
    }
  }

  private func validatedAdultDisabledURL(_ publication: FreedRetainedAdultProtection.SafariPublication) -> URL? {
    guard let container = FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: appGroupIdentifier) else { return nil }
    let url = container.appendingPathComponent(FreedRetainedAdultProtection.SafariPublication.fileName)
    guard let bytes = try? Data(contentsOf: url), bytes == FreedRetainedAdultProtection.SafariPublication.inert,
      SHA256.hash(data: bytes).map({ String(format: "%02x", $0) }).joined() == publication.payloadHash else { return nil }
    return url
  }

  private func validatedResetRulesURL() -> URL? {
    guard let container = FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: appGroupIdentifier) else { return nil }
    let url = container.appendingPathComponent(resetRulesFileName)
    guard (try? Data(contentsOf: url)) == Data(inertRulesJSON.utf8) else { return nil }
    return url
  }

  private func localizedError(_ key: String) -> String {
    let presentation = UserDefaults(suiteName: appGroupIdentifier)?.dictionary(forKey: "freed.presentation.v1") as? [String: String] ?? [:]
    let language = FreedContentBlockerCopy.language(selected: presentation["language"], preferred: Locale.preferredLanguages.first ?? "en")
    return FreedContentBlockerCopy.strings[language]?[key] ?? FreedContentBlockerCopy.strings["en"]![key]!
  }

  private func validatedSharedRulesURL() -> URL? {
    guard let container = FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: appGroupIdentifier) else {
      return nil
    }

    let url = container.appendingPathComponent(sharedRulesFileName)
    guard FileManager.default.fileExists(atPath: url.path), isValidRulesFile(url) else {
      return nil
    }

    return url
  }

  private func isValidRulesFile(_ url: URL) -> Bool {
    guard
      let data = try? Data(contentsOf: url),
      let parsed = try? JSONSerialization.jsonObject(with: data),
      let rules = parsed as? [Any],
      !rules.isEmpty,
      rules.count <= 50_000
    else {
      return false
    }

    return rules.allSatisfy(isValidBlockingRule)
  }

  private func isValidBlockingRule(_ item: Any) -> Bool {
    guard
      let rule = item as? [String: Any],
      let trigger = rule["trigger"] as? [String: Any],
      let urlFilter = trigger["url-filter"] as? String,
      !urlFilter.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty,
      let action = rule["action"] as? [String: Any],
      let actionType = action["type"] as? String
    else {
      return false
    }

    return actionType == "block"
  }
}
