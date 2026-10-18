@MainActor
private final class SafariRoutingProbe {
  var events: [String] = []
  var openContinuation: CheckedContinuation<Void, Never>?
}

@main
private struct SafariRoutingTests {
  @MainActor
  static func main() async {
    let probe = SafariRoutingProbe()
    let pending = Task { @MainActor in
      await FreedSafariSettingsRouter.open(
        directSettingsAvailable: true,
        isForeground: true,
        openExtensionSettings: {
          probe.events.append("extension-start")
          await withCheckedContinuation { probe.openContinuation = $0 }
          probe.events.append("extension-complete")
        },
        openAppSettings: { probe.events.append("fallback"); return true }
      )
    }
    while probe.openContinuation == nil { await Task.yield() }
    precondition(probe.events == ["extension-start"], "opening must await the real system callback")
    probe.openContinuation?.resume()
    let direct = await pending.value
    precondition(direct.opened && direct.route == "extension" && direct.directSettingsAvailable)
    precondition(probe.events == ["extension-start", "extension-complete"])

    let older = await FreedSafariSettingsRouter.open(
      directSettingsAvailable: false, isForeground: true,
      openExtensionSettings: { preconditionFailure("older iOS must not call the unavailable API") },
      openAppSettings: { true }
    )
    precondition(older.opened && older.route == "app-settings" && !older.directSettingsAvailable)

    let error = NSError(domain: "fixture", code: 1, userInfo: [NSLocalizedDescriptionKey: "direct route unavailable"])
    let fallback = await FreedSafariSettingsRouter.open(
      directSettingsAvailable: true, isForeground: true,
      openExtensionSettings: { throw error }, openAppSettings: { true }
    )
    precondition(fallback.opened && fallback.route == "app-settings" && fallback.error != nil)

    let background = await FreedSafariSettingsRouter.open(
      directSettingsAvailable: true, isForeground: false,
      openExtensionSettings: { preconditionFailure("background extension launch") },
      openAppSettings: { preconditionFailure("background fallback launch") }
    )
    precondition(!background.opened && background.route == "none" && background.error != nil)

    let failed = await FreedSafariSettingsRouter.open(
      directSettingsAvailable: false, isForeground: true,
      openExtensionSettings: {}, openAppSettings: { false }
    )
    precondition(!failed.opened && failed.route == "none" && failed.error != nil)
    print("Safari routing cases passed")
  }
}
