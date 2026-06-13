import Foundation

final class ContentBlockerRequestHandler: NSObject, NSExtensionRequestHandling {
  private let appGroupIdentifier = "group.app.freed.recovery"
  private let sharedRulesFileName = "safari-content-blocker-rules.json"

  func beginRequest(with context: NSExtensionContext) {
    guard let rulesURL = validatedSharedRulesURL() ?? Bundle.main.url(forResource: "blockerList", withExtension: "json") else {
      context.cancelRequest(withError: NSError(
        domain: "FreedSafariContentBlocker",
        code: 1,
        userInfo: [NSLocalizedDescriptionKey: "FREED content-blocker rules were not found."]
      ))
      return
    }

    guard let provider = NSItemProvider(contentsOf: rulesURL) else {
      context.cancelRequest(withError: NSError(
        domain: "FreedSafariContentBlocker",
        code: 2,
        userInfo: [NSLocalizedDescriptionKey: "FREED could not load content-blocker rules."]
      ))
      return
    }

    let item = NSExtensionItem()
    item.attachments = [provider]
    context.completeRequest(returningItems: [item])
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
