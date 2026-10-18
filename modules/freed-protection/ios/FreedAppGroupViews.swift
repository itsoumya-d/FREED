import ExpoModulesCore
import SwiftUI
import UIKit
import FamilyControls
import ManagedSettings

enum FreedAppGroupsBridgeUnavailable {
 static let snapshot: [String: Any] = ["version":1,"supported":false,"platform":"ios","revision":0,"configurationGeneration":0,"scopeEpoch":0,"groups":[],"permissions":["authorized":false,"usageAccess":false,"runtimeConnected":false],"monitorBudget":["used":0,"limit":20],"maxGroups":6,"legacyCompatibility":["retained":false,"applicationCount":0,"categoryCount":0,"webDomainCount":0],"reason":"native-app-groups-unavailable"]
 static let receipt: [String: Any] = ["accepted":false,"reason":"native-app-groups-unavailable","snapshot":snapshot]
}

private struct FreedAppGroupContentSizeKey: PreferenceKey {
 static var defaultValue: CGSize = .zero
 static func reduce(value: inout CGSize, nextValue: () -> CGSize) { value = nextValue() }
}

private struct FreedAppGroupLabelStyle: LabelStyle {
 func makeBody(configuration: Configuration) -> some View {
  HStack(alignment: .center, spacing: 12) {
   configuration.icon.aspectRatio(contentMode: .fit).frame(width: 32, height: 32).layoutPriority(2)
   configuration.title.font(.body).lineLimit(nil).fixedSize(horizontal: false, vertical: true)
    .frame(maxWidth: .infinity, alignment: .leading).layoutPriority(1)
  }.accessibilityElement(children: .combine)
 }
}

// Both surfaces use actual-width rows. Preview is bounded to three opaque tokens;
// the editor's rows surface keeps the complete selection, including Dynamic Type.
@available(iOS 16.0, *)
private struct FreedAppGroupTokenRows: View {
 let tokens: [ApplicationToken]
 var body: some View {
  VStack(alignment: .leading, spacing: 0) {
   ForEach(tokens, id: \.self) { token in
    Label(token).labelStyle(FreedAppGroupLabelStyle())
     .frame(maxWidth: .infinity, minHeight: 44, alignment: .leading).padding(.vertical, 10)
    if token != tokens.last { Divider() }
   }
  }.frame(maxWidth: .infinity, alignment: .leading).fixedSize(horizontal: false, vertical: true)
 }
}

final class FreedAppGroupTokenView: ExpoView {
 let onContentSizeChange = EventDispatcher()
 var groupId = ""
 var draft = false
 var unavailableLabel = ""
 var dark = false
 var layout = "rows"
 var configurationGeneration = -1
 var scopeEpoch = -1
 var storeRevision = -1
 var groupRevision = -1
 private var host: UIHostingController<AnyView>?
 private var ownerObserver: NSObjectProtocol?
 private var renderRevision = 0
 private var lastMeasurement: CGSize = .zero
 required init(appContext: AppContext? = nil) {
  super.init(appContext: appContext)
  clipsToBounds = true
  if #available(iOS 16.0, *) {
   ownerObserver = NotificationCenter.default.addObserver(forName: FreedAppGroupsRuntime.presentationChanged, object: nil, queue: .main) { [weak self] _ in self?.reload() }
  }
 }
 deinit { if let ownerObserver { NotificationCenter.default.removeObserver(ownerObserver) } }
 private func presentationIsCurrent() -> Bool {
  guard configurationGeneration >= 0, scopeEpoch >= 0, storeRevision >= 0, groupRevision >= 0 else { return false }
  return (try? FreedProtectionConfigurationLock.withExclusiveAccess { defaults in
   guard let state = FreedAppGroupsPolicy.decode(defaults.data(forKey: FreedAppGroupsPolicy.key)),
    state.generation == self.configurationGeneration, state.scopeEpoch == self.scopeEpoch,
    state.revision == self.storeRevision, state.groups.contains(where: { $0.id == self.groupId && $0.revision == self.groupRevision }) else { return false }
   return true
  }) == true
 }
 private func publishSize(_ size: CGSize, revision: Int) {
  guard revision == renderRevision, size.width.isFinite, size.height.isFinite, size.width > 0, size.height > 0,
   abs(size.width - bounds.width) < 1, #available(iOS 16.0, *),
   FreedAppGroupsRuntime.shared.ownerVerified, presentationIsCurrent() else { return }
  let measured = CGSize(width: size.width, height: ceil(size.height))
  guard measured != lastMeasurement else { return }
  lastMeasurement = measured
  // Geometry and opaque group authority metadata only. Apple names and tokens stay in this view.
  onContentSizeChange(["groupId": groupId, "draft": draft, "layout": layout,
   "configurationGeneration": configurationGeneration, "scopeEpoch": scopeEpoch,
   "storeRevision": storeRevision, "groupRevision": groupRevision,
   "width": measured.width, "height": measured.height, "measurementRevision": revision])
 }
 func reload() {
  renderRevision += 1
  lastMeasurement = .zero
  let revision = renderRevision
  let content: AnyView
  if #available(iOS 16.0, *), presentationIsCurrent(),
   let selection = FreedAppGroupsRuntime.shared.privateSelection(groupId: groupId, draft: draft), !selection.applicationTokens.isEmpty {
   // Sort opaque token bytes in native memory so a Set's enumeration cannot reorder the rows.
   let tokens = selection.applicationTokens.map { token in (token: token, order: (try? JSONEncoder().encode(token)) ?? Data()) }
    .sorted { $0.order.lexicographicallyPrecedes($1.order) }.map(\.token)
   let visibleTokens = layout == "rows" ? tokens : Array(tokens.prefix(3))
   content = AnyView(FreedAppGroupTokenRows(tokens: visibleTokens)
    .background(GeometryReader { proxy in Color.clear.preference(key: FreedAppGroupContentSizeKey.self, value: proxy.size) })
    .onPreferenceChange(FreedAppGroupContentSizeKey.self) { [weak self] size in self?.publishSize(size, revision: revision) })
  } else if #available(iOS 16.0, *), !FreedAppGroupsRuntime.shared.ownerVerified || !presentationIsCurrent() { content = AnyView(EmptyView()) }
  else {
   content = AnyView(Text(unavailableLabel).font(.body).foregroundStyle(.secondary).frame(maxWidth: .infinity, alignment: .leading).fixedSize(horizontal: false, vertical: true)
    .background(GeometryReader { proxy in Color.clear.preference(key: FreedAppGroupContentSizeKey.self, value: proxy.size) })
    .onPreferenceChange(FreedAppGroupContentSizeKey.self) { [weak self] size in self?.publishSize(size, revision: revision) })
  }
  let root = AnyView(content.ignoresSafeArea().environment(\.colorScheme, dark ? .dark : .light)
   .environment(\.layoutDirection, FreedAppGroupPickerCopy.isRTL ? .rightToLeft : .leftToRight))
  if let host { host.rootView = root } else {
   let controller = UIHostingController(rootView: root)
   controller.view.backgroundColor = .clear
   if #available(iOS 16.0, *) { controller.sizingOptions = .intrinsicContentSize }
   if #available(iOS 16.4, *) { controller.safeAreaRegions = [] }
   host = controller
   addSubview(controller.view)
   attachHost()
  }
  host?.overrideUserInterfaceStyle = dark ? .dark : .light
  setNeedsLayout()
 }
 private func attachHost() {
  guard window != nil, let host, host.parent == nil else { return }
  var responder: UIResponder? = self
  while let next = responder?.next {
   if let parent = next as? UIViewController { parent.addChild(host); host.didMove(toParent: parent); return }
   responder = next
  }
 }
 override func didMoveToWindow() {
  super.didMoveToWindow()
  if window != nil { attachHost() }
  else { host?.willMove(toParent: nil); host?.removeFromParent() }
 }
 override func traitCollectionDidChange(_ previousTraitCollection: UITraitCollection?) {
  super.traitCollectionDidChange(previousTraitCollection)
  if previousTraitCollection?.preferredContentSizeCategory != traitCollection.preferredContentSizeCategory { reload() }
 }
 override func layoutSubviews() {
  super.layoutSubviews()
  guard let host, bounds.width > 0 else { return }
  attachHost()
  // Ask SwiftUI for its ideal height at the actual available width. A Geometry
  // preference alone depends on the frame React has not measured yet; measuring
  // independently breaks that bootstrap cycle, including after width changes.
  if #available(iOS 16.0, *) {
   let ideal = host.sizeThatFits(in: CGSize(width: bounds.width, height: .greatestFiniteMagnitude))
   let height = ideal.height.isFinite && ideal.height > 0 ? ceil(ideal.height) : bounds.height
   host.view.frame = CGRect(x: 0, y: 0, width: bounds.width, height: height)
   publishSize(CGSize(width: bounds.width, height: height), revision: renderRevision)
  } else { host.view.frame = bounds }
 }
}

@available(iOS 16.0,*)
@MainActor
enum FreedAppGroupPicker {
 private static var cancel:(()->Void)?
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
 private static func presenter()->UIViewController? {
  let scene=UIApplication.shared.connectedScenes.compactMap{$0 as? UIWindowScene}.first{$0.activationState == .foregroundActive}
  var top=scene?.windows.first{$0.isKeyWindow}?.rootViewController
  while let presented=top?.presentedViewController{top=presented}
  return top
 }
 static func present(request:[String:Any],scope:String,header:String,footer:String) async->[String:Any] {
  pruneDismissalHistory()
  let runtime=FreedAppGroupsRuntime.shared,snapshot=runtime.snapshot(scope)
  guard snapshot["supported"] as? Bool == true,runtime.ownerVerified,
   request["version"] as? Int == 1,request["expectedStoreRevision"] as? Int == snapshot["revision"] as? Int,
   let id=request["id"] as? String,let revision=request["expectedRevision"] as? Int,
   let groups=snapshot["groups"] as? [[String:Any]],groups.contains(where:{$0["id"] as? String==id && $0["revision"] as? Int==revision}),
   AuthorizationCenter.shared.authorizationStatus == .approved,
   let selected=runtime.privateSelection(groupId:id,draft:true),let presenter=presenter(),cancel==nil,
   dismissals.values.allSatisfy({ $0.state == .settled }) else {
    return["accepted":false,"reason":"picker-unavailable-or-stale","snapshot":snapshot]
  }
  guard let owner = runtime.currentBindingIdentity else { return ["accepted": false, "reason": "picker-owner-stale"] }
  pruneDismissalHistory(currentBinding: owner)
  guard dismissals.count < dismissalCapacity, cancellationTargets.count < dismissalCapacity, cancellationTargets[owner] == nil else { return ["accepted": false, "reason": "picker-unavailable"] }
  let identity = UUID(); bindingID = owner; presentationID = identity
  return await withCheckedContinuation{continuation in
   var finished=false
   var host:UIHostingController<FreedAppGroupPickerContent>?
   let finish:([String:Any])->Void={receipt in
    guard !finished, retainDismissal(binding: owner, presentation: identity) else { return };finished=true
    if presentationID==identity && bindingID==owner {cancel=nil;bindingID=nil;presentationID=nil}
    let dismissingHost=host;host=nil
    if let dismissingHost {
     dismissingHost.dismiss(animated:true) {
      let absent=dismissingHost.presentingViewController == nil && !dismissingHost.isBeingPresented && !dismissingHost.isBeingDismissed && dismissingHost.viewIfLoaded?.window == nil
      observeDismissal(binding:owner,presentation:identity,confirmed:absent)
     }
    } else { observeDismissal(binding:owner,presentation:identity,confirmed:false) }
    continuation.resume(returning:receipt)
   }
   cancel={finish(["accepted":false,"cancelled":true,"reason":"picker-cancelled","snapshot":runtime.snapshot(scope)])}
   let content=FreedAppGroupPickerContent(selection:selected,header:header,footer:footer,onCancel:{if presentationID==identity{cancelCurrent()}},onDone:{selection in
    guard presentationID==identity,runtime.currentBindingIdentity==owner else {finish(["accepted":false,"reason":"picker-owner-stale"]);return}
    guard let data=try? JSONEncoder().encode(selection) else{finish(["accepted":false,"reason":"individual-apps-only","snapshot":runtime.snapshot(scope)]);return}
    finish(runtime.update(request,scope,selectionData:data))
   })
   host=UIHostingController(rootView:content);host?.isModalInPresentation=true;host?.modalPresentationStyle = .pageSheet
   host?.overrideUserInterfaceStyle = FreedAppGroupPickerCopy.interfaceStyle;host?.view.backgroundColor = .systemBackground
   if let host{presenter.present(host,animated:true)}
  }
 }
}
@available(iOS 16.0,*)
private struct FreedAppGroupPickerContent:View {
 @State var selection:FamilyActivitySelection
 let header:String;let footer:String;let onCancel:()->Void;let onDone:(FamilyActivitySelection)->Void
 var body:some View {NavigationStack{VStack(spacing:12){Text(header).font(.headline).padding(.horizontal);FamilyActivityPicker(selection:$selection);Text(footer).font(.footnote).foregroundStyle(.secondary).padding(.horizontal)}.toolbar{ToolbarItem(placement:.cancellationAction){Button(FreedAppGroupPickerCopy.action(cancel:true),action:onCancel)};ToolbarItem(placement:.confirmationAction){Button(FreedAppGroupPickerCopy.action(cancel:false)){onDone(selection)}.disabled(!selection.categoryTokens.isEmpty || !selection.webDomainTokens.isEmpty)}}}.preferredColorScheme(FreedAppGroupPickerCopy.colorScheme).environment(\.layoutDirection,FreedAppGroupPickerCopy.isRTL ? .rightToLeft:.leftToRight)}
}

private enum FreedAppGroupPickerCopy {
 private static var presentation: [String: String] { UserDefaults(suiteName: FreedProtectionConfigurationLock.appGroupIdentifier)?.dictionary(forKey: "freed.presentation.v1") as? [String: String] ?? [:] }
 static var colorScheme: ColorScheme? { presentation["themeMode"] == "dark" ? .dark : presentation["themeMode"] == "light" ? .light : nil }
 static var interfaceStyle: UIUserInterfaceStyle { presentation["themeMode"] == "dark" ? .dark : presentation["themeMode"] == "light" ? .light : .unspecified }
 static var isRTL: Bool { presentation["language"] == "ar" }
 static func action(cancel:Bool)->String {
  let rows=["en":["Cancel","Done"],"hi":["रद्द करें","हो गया"],"es":["Cancelar","Listo"],"pt":["Cancelar","Concluído"],"fr":["Annuler","Terminé"],"de":["Abbrechen","Fertig"],"ar":["إلغاء","تم"],"ja":["キャンセル","完了"],"ko":["취소","완료"],"zh-Hans":["取消","完成"]]
  let selected=(UserDefaults(suiteName:FreedProtectionConfigurationLock.appGroupIdentifier)?.dictionary(forKey:"freed.presentation.v1") as? [String:String])?["language"]
  let preferred=Locale.preferredLanguages.first ?? "en",base=String(preferred.split(separator:"-").first ?? "en")
  let language=selected.flatMap{rows[$0] != nil ? $0:nil} ?? (base=="zh" ? "zh-Hans":base)
  return (rows[language] ?? rows["en"]!)[cancel ? 0:1]
 }
}
