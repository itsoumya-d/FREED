import SwiftUI
import UIKit
import FamilyControls

@available(iOS 16.0, *)
@MainActor
enum FreedWebsiteProbePicker {
  private static var cancel: (() -> Void)?
  private static var bindingID: String?
  private static var presentationID: UUID?
 private enum DismissalState { case pending, unavailable, settled }
 private struct DismissalResidual { let binding: String; var state: DismissalState }
 private static let dismissalCapacity = 32
 private static var dismissals: [UUID: DismissalResidual] = [:]
 private static var cancellationTargets: [String: UUID] = [:]
 // Never prune an unresolved presentation or a target belonging to live fields.
 private static func pruneDismissalHistory(currentBinding: String? = nil) {
  for (identity, residual) in dismissals where residual.state == .settled && bindingID != residual.binding && (cancellationTargets[residual.binding] != identity || currentBinding != nil && currentBinding != residual.binding) {
   if cancellationTargets[residual.binding] == identity { cancellationTargets.removeValue(forKey: residual.binding) }
   dismissals.removeValue(forKey: identity)
  }
 }
 private static func retainDismissal(binding: String, presentation: UUID) -> Bool {
  if let old = dismissals[presentation] { return old.binding == binding && old.state != .settled }
  pruneDismissalHistory()
  guard dismissals.count < dismissalCapacity else { return false }
  dismissals[presentation] = DismissalResidual(binding: binding, state: .pending); return true
 }
 private static func observeDismissal(binding: String, presentation: UUID, confirmed: Bool) {
  guard var residual = dismissals[presentation], residual.binding == binding, residual.state != .settled else { return }
  residual.state = confirmed ? .settled : .unavailable; dismissals[presentation] = residual
 }
 private static func dismissalResult(binding: String, presentation: UUID, requested: Bool = false) -> (matched: Bool, requested: Bool, pending: Bool, unavailable: Bool) {
  guard let residual = dismissals[presentation], residual.binding == binding else { return (true, requested, false, true) }
  return (true, requested, residual.state == .pending, residual.state == .unavailable)
 }
 @discardableResult static func cancel(bindingID expected: String) -> (matched: Bool, requested: Bool, pending: Bool, unavailable: Bool) {
  // A replay keeps its first original presentation even if live fields now name a newer one.
  if let original = cancellationTargets[expected] { return dismissalResult(binding: expected, presentation: original) }
  if let original = dismissals.first(where: { $0.value.binding == expected && $0.value.state != .settled })?.key {
   guard cancellationTargets.count < dismissalCapacity else { return (true, false, false, true) }
   cancellationTargets[expected] = original; return dismissalResult(binding: expected, presentation: original)
  }
  guard bindingID == expected else { return (false, false, false, false) }
  guard cancel != nil, let identity = presentationID, retainDismissal(binding: expected, presentation: identity), cancellationTargets.count < dismissalCapacity else { return (true, false, false, true) }
  cancellationTargets[expected] = identity
  cancelCurrent(); return dismissalResult(binding: expected, presentation: identity, requested: true)
 }
 static func cancelCurrent() {
  guard let action = cancel, let owner = bindingID, let identity = presentationID,
    retainDismissal(binding: owner, presentation: identity) else { return }
  action()
  if presentationID == identity && bindingID == owner { cancel = nil; bindingID = nil; presentationID = nil }
 }
  static func present(revision: Int) async -> [String: Any] {
    pruneDismissalHistory()
    guard (try? FreedProtectionConfigurationLock.withExclusiveAccess({ FreedAccountProtectionCleanup.legacyPrivateAllowed($0) })) == true, FreedWebsiteRecoveryProbe.allowed, FreedAppGroupsRuntime.shared.ownerVerified,
      AuthorizationCenter.shared.authorizationStatus == .approved, cancel == nil,
      dismissals.values.allSatisfy({ $0.state == .settled }) else {
      return ["accepted": false, "reason": "picker-unavailable"]
    }
    let captured = try? FreedProtectionConfigurationLock.withExclusiveAccess { defaults -> FreedWebsiteProbeState? in
      guard let state = FreedWebsiteRecoveryProbe.state(defaults), state.optedIn, state.revision == revision,
        state.identity == FreedWebsiteRecoveryProbe.identity(defaults) else { return nil }; return state
    }
    guard let state = captured ?? nil else { return ["accepted": false, "reason": "picker-stale"] }
    let scene = UIApplication.shared.connectedScenes.compactMap { $0 as? UIWindowScene }.first { $0.activationState == .foregroundActive }
    var presenter = scene?.windows.first { $0.isKeyWindow }?.rootViewController
    while let next = presenter?.presentedViewController { presenter = next }
    guard let presenter else { return ["accepted": false, "reason": "picker-no-presenter"] }
    // New selection; global mixed selection and native application authority are never reused.
    guard let owner = FreedAppGroupsRuntime.shared.currentBindingIdentity else { return ["accepted": false, "reason": "picker-owner-stale"] }
  pruneDismissalHistory(currentBinding: owner)
  guard dismissals.count < dismissalCapacity, cancellationTargets.count < dismissalCapacity, cancellationTargets[owner] == nil else { return ["accepted": false, "reason": "picker-unavailable"] }
    let identity = UUID(); bindingID = owner; presentationID = identity
    return await withCheckedContinuation { continuation in
      var finished = false
      var ownerObserver: NSObjectProtocol?
      var host: UIHostingController<AnyView>?
      let finish: ([String: Any]) -> Void = { receipt in
        guard !finished, retainDismissal(binding: owner, presentation: identity) else { return }; finished = true; if presentationID == identity && bindingID == owner { cancel = nil; bindingID = nil; presentationID = nil }
        if let observer = ownerObserver { NotificationCenter.default.removeObserver(observer) }
        ownerObserver = nil
        // Break host -> rootView.onDone -> finish -> host before resuming.
        let dismissingHost = host
        host = nil
        if let dismissingHost {
          dismissingHost.dismiss(animated: true) {
            let absent = dismissingHost.presentingViewController == nil && !dismissingHost.isBeingPresented && !dismissingHost.isBeingDismissed && dismissingHost.viewIfLoaded?.window == nil
            observeDismissal(binding: owner, presentation: identity, confirmed: absent)
          }
        } else { observeDismissal(binding: owner, presentation: identity, confirmed: false) }
        continuation.resume(returning: receipt)
      }
      cancel = { finish(["accepted": false, "cancelled": true, "reason": "picker-cancelled-pending-retained"]) }
      ownerObserver = NotificationCenter.default.addObserver(forName: FreedAppGroupsRuntime.presentationChanged, object: nil, queue: .main) { _ in
        Task { @MainActor in
        let identityCurrent = (try? FreedProtectionConfigurationLock.withExclusiveAccess { defaults in
          FreedWebsiteRecoveryProbe.identity(defaults) == state.identity
        }) == true
        if presentationID == identity && (!FreedAppGroupsRuntime.shared.ownerVerified || !identityCurrent || FreedAppGroupsRuntime.shared.currentBindingIdentity != owner) { cancelCurrent() }
        }
      }
      let preferences = UserDefaults(suiteName: FreedProtectionConfigurationLock.appGroupIdentifier)?.dictionary(forKey: "freed.presentation.v1") as? [String: String] ?? [:]
      let language = preferences["language"] ?? "en"
      let content = FreedWebsiteProbePickerContent(copy: FreedWebsiteProbeCopy.row(language), onCancel: { if presentationID == identity { cancelCurrent() } }, onDone: { selection in
        let current = try? FreedProtectionConfigurationLock.withExclusiveAccess { defaults in
          FreedWebsiteRecoveryProbe.identity(defaults) == state.identity && FreedWebsiteRecoveryProbe.state(defaults)?.revision == revision
        }
        guard current == true, presentationID == identity, FreedAppGroupsRuntime.shared.currentBindingIdentity == owner, FreedAppGroupsRuntime.shared.ownerVerified else { finish(["accepted": false, "reason": "picker-owner-or-revision-changed"]); return }
        finish(FreedWebsiteRecoveryProbe.mutate(operation: "select", revision: revision, selection: selection))
      })
      host = UIHostingController(rootView: AnyView(content.environment(\.layoutDirection, language == "ar" ? .rightToLeft : .leftToRight)))
      host?.isModalInPresentation = true; host?.modalPresentationStyle = .pageSheet
      host?.overrideUserInterfaceStyle = preferences["themeMode"] == "dark" ? .dark : preferences["themeMode"] == "light" ? .light : .unspecified
      if let host { presenter.present(host, animated: true) }
    }
  }
}
@available(iOS 16.0, *)
private struct FreedWebsiteProbePickerContent: View {
  @State private var selection = FamilyActivitySelection()
  let copy: [String]
  let onCancel: () -> Void
  let onDone: (FamilyActivitySelection) -> Void
  var body: some View {
    NavigationStack {
      VStack { Text(copy[2]).font(.footnote).padding(); FamilyActivityPicker(selection: $selection) }
        .toolbar {
          ToolbarItem(placement: .cancellationAction) { Button(copy[3], action: onCancel) }
          ToolbarItem(placement: .confirmationAction) { Button(copy[4]) { onDone(selection) }
            .disabled(!selection.applicationTokens.isEmpty || !selection.categoryTokens.isEmpty || !(1...50).contains(selection.webDomainTokens.count)) }
        }
    }
  }
}
