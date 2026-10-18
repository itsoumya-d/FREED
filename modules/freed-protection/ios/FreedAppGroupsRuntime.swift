import Foundation
import CryptoKit
import os
#if canImport(FamilyControls) && canImport(DeviceActivity) && canImport(ManagedSettings)
import FamilyControls
import DeviceActivity
import ManagedSettings

@available(iOS 16.0, *)
final class FreedAppGroupsRuntime {
 static let shared=FreedAppGroupsRuntime()
 private let clock: FreedAppGroupsClock
 private let challengeSteps:any FreedChallengeStepObserving
 private var challengeProcessId=UUID().uuidString.lowercased()
 private var challengeObservationIdentity:(sessionId:String,segmentId:String,processId:String)?
 private func stopChallengeObservation(invalidateProcess:Bool=false) {
  _ = try? withBindingState {challengeSteps.stop();challengeObservationIdentity=nil;if invalidateProcess{challengeProcessId=UUID().uuidString.lowercased()}
  }
 }
 init(clock: FreedAppGroupsClock = FreedAppGroupsClock(),challengeSteps:any FreedChallengeStepObserving = FreedChallengeStepObserver()) { self.clock = clock; self.challengeSteps=challengeSteps }
 private var actionScope: String?
 private var privateOwner=false
 private var boundHost: Int?
 private var boundEpoch: Int?
 private var bindingID: String?
 private var bindingRevision = 0
 private struct BindingTicket {
  let id: String; let session: String; let transition: String; let sequence: Int
  let scope: String; let revision: Int; let bindingID: String
  var receipt: [String: Any]?
 }
 private var bindingSession: String?
 private var nativeBindingSession: FreedAccountBindingSessionState?
 private var bindingTransitionSequence = -1
 private var bindingTickets: [String: BindingTicket] = [:]
 // Every binding/session/presentation reference is selected and used under
 // this instance gate, including unisolated status and lower-owner readers.
 // Never wait from configuration exclusion; a contended operation may retry.
 private let bindingStateLock = NSRecursiveLock()
 private func withBindingState<T>(_ body: () throws -> T) throws -> T {
  guard bindingStateLock.try() else { throw Failure.reason("binding-state-busy") }
  defer { bindingStateLock.unlock() }
  return try body()
 }
 // No await under this gate. Native OnCreate/release/retirement serializes after
 // the complete host transaction and its successful process publication.
 // Extension policy callbacks deliberately use configuration exclusion directly.
 private func withPrivateConfigurationAccess<T>(afterSuccessfulPersistence: ((T) -> Void)? = nil, readOnly: Bool = false,
  _ body: (UserDefaults) throws -> T) throws -> T {
  return try withBindingState {
  if let session = nativeBindingSession {
   return try session.withCurrent {
    try FreedProtectionConfigurationLock.withExclusiveAccess(afterSuccessfulPersistence: afterSuccessfulPersistence, readOnly: readOnly, body)
   }
  }
  return try FreedProtectionConfigurationLock.withExclusiveAccess(afterSuccessfulPersistence: afterSuccessfulPersistence, readOnly: readOnly, body)
  }
 }
 // v2 pending reads/claims hold instance, native lifecycle and configuration
 // admission through the actual mutation and successful commit. No await or
 // blocking reverse acquisition is introduced; all helpers use these defaults.
 func withAcknowledgedPrivateScope<T>(_ scope: String, readOnly: Bool = false, _ body: (UserDefaults) throws -> T) throws -> T {
  try withPrivateConfigurationAccess(readOnly: readOnly) { defaults in
   guard nativeBindingSession != nil, bindingID != nil, actionScope == scope,
    ownerCurrent(read(defaults), defaults), FreedProtectionConfigurationLock.permitsPublication(defaults) else {
    throw Failure.reason("owner-scope-unbound-or-stale")
   }
   return try body(defaults)
  }
 }
 // Read-only transport also requires the exact host carrier. A different live
 // carrier cannot borrow this runtime's acknowledged action scope.
 func withStatusScope<T>(_ session: FreedAccountBindingSessionState, _ scope: String,
  _ body: (UserDefaults, [String: Any]) throws -> T) throws -> T {
  try withBindingState {
   guard nativeBindingSession === session else { throw Failure.reason("owner-scope-unbound-or-stale") }
   return try withAcknowledgedPrivateScope(scope, readOnly: true) { defaults in
    guard let state = FreedAppGroupsPolicy.decode(defaults.data(forKey: FreedAppGroupsPolicy.key)),
      let bindingID else { throw Failure.reason("group-state-unreadable") }
    return try body(defaults, ["bindingHandle": bindingID, "actionScope": scope,
      "generation": state.generation, "scopeEpoch": state.scopeEpoch, "admissionRevision": bindingRevision])
   }
  }
 }
 // Cancellation-only process path remains available after native admission is
 // retired. It cannot read/write policy or proof and cannot select a new owner.
 func cancelOwnedChallengeObservation(binding expected: String, evidenceSessionID: String?) -> String {
  do { return try withBindingState {
   guard bindingID == expected else { return "notApplicable" }
   guard let observed = challengeObservationIdentity,
    evidenceSessionID == nil || evidenceSessionID == observed.sessionId else { return "notApplicable" }
   stopChallengeObservation(invalidateProcess: true); return "cancelled"
  } } catch { return "pending" }
 }
 var currentBindingIdentity: String? { (try? withBindingState { privateOwner ? bindingID : nil }) ?? nil }
 // Called only by native lifecycle ownership, never by an async JS registration.
 func installBindingSession(_ state: FreedAccountBindingSessionState) throws {
  return try withBindingState {
  try state.withCurrent {
   let session = state.id
   nativeBindingSession = state
   if bindingSession == session { return }
   bindingSession = session; bindingTransitionSequence = -1; bindingTickets = [:]
   suspend()
  }
  }
 }
 func prepareBinding(scope: String, session: String, transition: String, sequence: Int) throws -> [String: Any] {
  return try withBindingState {
  guard nativeBindingSession?.current == true, bindingSession == session, UUID(uuidString: transition) != nil, sequence >= 0,
   sequence >= bindingTransitionSequence else { throw Failure.reason("binding-session-stale") }
  _ = try scopeOwner(scope)
  guard (try JSONSerialization.jsonObject(with: Data(scope.utf8)) as? [Any])?.count == 2 else { throw Failure.reason("raw-scope-required") }
  return try withPrivateConfigurationAccess { d in
   let journal = try FreedAccountProtectionCleanup.read(d)
   if let prior = bindingTickets.values.first(where: { $0.session == session && $0.transition == transition }) {
    guard prior.scope == scope, prior.sequence == sequence, prior.revision == journal.admissionRevision else { throw Failure.reason("binding-ticket-stale") }
    return ["ticket": prior.id, "admissionRevision": prior.revision]
   }
   guard sequence > bindingTransitionSequence, bindingTickets.count < 32 else { throw Failure.reason("binding-transition-stale-or-capacity") }
   let id = UUID().uuidString.lowercased()
   bindingTickets[id] = BindingTicket(id: id, session: session, transition: transition, sequence: sequence,
    scope: scope, revision: journal.admissionRevision, bindingID: UUID().uuidString.lowercased())
   bindingTransitionSequence = sequence
   return ["ticket": id, "admissionRevision": journal.admissionRevision]
  }
  }
 }
 func commitBinding(ticket id: String, session: String) throws -> [String: Any] {
  return try withBindingState {
  guard var ticket = bindingTickets[id], ticket.session == session, bindingSession == session, nativeBindingSession?.current == true,
   ticket.sequence == bindingTransitionSequence else { throw Failure.reason("binding-ticket-stale") }
  if let receipt = ticket.receipt {
   guard bindingID == ticket.bindingID, ownerVerified else { throw Failure.reason("binding-ticket-revoked") }
   return receipt
  }
  var parts = try JSONSerialization.jsonObject(with: Data(ticket.scope.utf8)) as! [Any]
  guard parts.count == 2 else { throw Failure.reason("binding-scope-invalid") }
  parts.append(ticket.bindingID)
  let scoped = String(data: try JSONSerialization.data(withJSONObject: parts), encoding: .utf8)!
  var epoch = 0
  let result = try withPrivateConfigurationAccess(afterSuccessfulPersistence: { (_: Int) in
   self.stopChallengeObservation(invalidateProcess: true)
   self.actionScope = scoped; self.boundHost = (parts[1] as! NSNumber).intValue; self.boundEpoch = epoch
   self.bindingID = ticket.bindingID; self.bindingRevision = ticket.revision; self.privateOwner = !(parts[0] is NSNull)
  }) { d -> Int in
   var journal = try FreedAccountProtectionCleanup.read(d)
   guard nativeBindingSession?.current == true, journal.admissionRevision == ticket.revision,
    !journal.records.contains(where: { $0.phase != .prepared && $0.coreInvalidationPending }) else { throw Failure.reason("binding-ticket-revoked") }
   if d.object(forKey: FreedAppGroupsPolicy.key) != nil && FreedAppGroupsPolicy.decode(d.data(forKey: FreedAppGroupsPolicy.key)) == nil { throw Failure.reason("group-state-unreadable") }
   var state = read(d)
   let initializingEmptyNamespace = state.ownerDigest == nil && state.groups.isEmpty
   try bind(scoped, &state, d, versioned: true)
   // Explicit v2 commit establishes a fresh empty namespace; old callbacks
   // remain fenced by generation, binding revision and the retired session.
   if initializingEmptyNamespace { d.set(false, forKey: FreedProtectionConfigurationLock.resetMarkerKey) }
   journal.currentBindingID = ticket.bindingID
   journal.versionedBinding = true
   try FreedAccountProtectionCleanup.stage(journal, d)
   epoch = state.scopeEpoch
   return FreedProtectionConfigurationLock.generation(d)
  }
  let receipt: [String: Any] = ["version": 2, "accepted": true, "bindingHandle": ticket.bindingID,
   "actionScope": scoped, "generation": result, "scopeEpoch": epoch, "admissionRevision": ticket.revision]
  ticket.receipt = receipt; bindingTickets[id] = ticket; refreshPrivateViews(); return receipt
  }
 }
 func prepareCleanup(scope: String, handle: String, captures: [String] = []) throws -> FreedAccountProtectionCleanup.Record {
  try withPrivateConfigurationAccess { d in
   let state = read(d)
   guard actionScope == scope, bindingID == handle, ownerCurrent(state, d), let owner = state.ownerDigest else { throw Failure.reason("cleanup-owner-stale") }
   var resources = FreedAccountProtectionCleanup.Resources(captures: captures)
   // Both banks belong to this binding until another binding claims the slot.
   resources.stores = Array(Set(state.groups.flatMap { g in (0..<2).map { "freed.app-group.slot\(g.slot).bank\($0)" } })).sorted()
   resources.monitors = centre.activities.map(\.rawValue).filter {
    $0.hasPrefix(FreedAppGroupsPolicy.prefix) || $0.hasPrefix("freed.appGuard.") || $0 == "freed.selectedAppDailyLimit" || $0 == "freed.earnedUnlockWindow"
   }.sorted()
   return try FreedAccountProtectionCleanup.prepare(original: .init(ownerDigest: owner, generation: state.generation, scopeEpoch: state.scopeEpoch),
    bindingID: handle, resources: resources, defaults: d)
  }
 }
 func suspendCleanup(_ record: FreedAccountProtectionCleanup.Record, scrub: () -> Bool) -> FreedAccountProtectionCleanup.ProcessScrubState {
  return (try? withBindingState {
   let matching = bindingID == record.bindingID
   if matching {
    nativeBindingSession?.retire()
    guard suspend() else { return FreedAccountProtectionCleanup.ProcessScrubState.pending }
   }
   // Exact-ID Module cancellation/absence checks stay inside instance admission.
   // Different ownership never authorizes broad cancellation of its resources.
   guard scrub() else { return FreedAccountProtectionCleanup.ProcessScrubState.pending }
   return matching ? .suspended : .notApplicable
  }) ?? .busy
 }
 func scrubCleanup(_ record: FreedAccountProtectionCleanup.Record, _ d: UserDefaults) throws -> Bool {
  guard try FreedAccountProtectionCleanup.ownsRevokedNamespace(record, d), record.privateStoreErased else { return false }
  for name in record.resources.stores { ManagedSettingsStore(named: .init(name)).clearAllSettings() }
  centre.stopMonitoring(record.resources.monitors.map { DeviceActivityName($0) })
  return !centre.activities.contains { record.resources.monitors.contains($0.rawValue) }
 }

 var ownerVerified: Bool {
  return (try? withBindingState {
   guard privateOwner else{return false}
   return (try? withPrivateConfigurationAccess{d in self.ownerCurrent(self.read(d),d)}) == true
  }) == true
 }
 // Diagnostic-only observer: caller supplies an immutable committed snapshot
 // on MainActor. Reuse the owner fence without acquiring/migrating authority.
 func diagnosticOwnerVerified(_ committedDefaults: UserDefaults) -> Bool {
  return ownerCurrent(read(committedDefaults), committedDefaults)
 }
 static let presentationChanged=Notification.Name("freed.appGroups.privatePresentationChanged")
 private func refreshPrivateViews(){DispatchQueue.main.async{NotificationCenter.default.post(name:Self.presentationChanged,object:nil)}}
 @discardableResult func suspend() -> Bool {
  return (try? withBindingState {
   stopChallengeObservation(invalidateProcess:true);privateOwner=false;refreshPrivateViews();return true
  }) == true
 }
 private let saltKey="freed.appGroups.ownerSalt.v1"
 private let selectionKey="freed.familyActivitySelection"
 private let centre=DeviceActivityCenter()
 enum Failure: Error {case reason(String);case native(reason:String,stage:String,underlying:Error)}

 private func read(_ defaults:UserDefaults)->FreedAppGroupsState {
  if let data=defaults.data(forKey:FreedAppGroupsPolicy.key),let state=FreedAppGroupsPolicy.decode(data){return state}
  var empty=FreedAppGroupsState();empty.generation=FreedProtectionConfigurationLock.generation(defaults);return empty
 }
 private func selectionsValid(_ state:FreedAppGroupsState)->Bool {
  state.groups.allSatisfy{g in [g.selection,g.pendingSelection].allSatisfy{data in data==nil || data.flatMap{try? JSONDecoder().decode(FamilyActivitySelection.self,from:$0)} != nil}}
 }
 private func persist(_ state:FreedAppGroupsState,_ defaults:UserDefaults)throws {
  guard FreedAppGroupsPolicy.validateGroups(state.groups),selectionsValid(state),let data=try? JSONEncoder().encode(state) else{throw Failure.reason("invalid-group-state")}
  defaults.set(data,forKey:FreedAppGroupsPolicy.key)
  guard FreedProtectionConfigurationLock.persist(defaults),defaults.data(forKey:FreedAppGroupsPolicy.key)==data else{throw Failure.reason("group-persistence-failed")}
 }
 private func scopeOwner(_ scope:String)throws->String? {
  guard scope.utf8.count<=4096,let data=scope.data(using:.utf8),let parts=(try? JSONSerialization.jsonObject(with:data)) as? [Any],(parts.count==2 || parts.count==3),let host=parts[1] as? NSNumber,CFGetTypeID(host) != CFBooleanGetTypeID(),host.doubleValue>=0,host.doubleValue.rounded()==host.doubleValue,host.doubleValue<=9_007_199_254_740_991 else{throw Failure.reason("invalid-action-scope")}
  if parts[0] is NSNull{return nil}
  guard let owner=parts[0] as? String,!owner.isEmpty,owner.utf8.count<=256 else{throw Failure.reason("invalid-owner-scope")};return owner
 }
 private func revokeInvalidBootAuthority(_ state:inout FreedAppGroupsState,_ defaults:UserDefaults)throws {
  let boot=clock.bootIdentity(),old=state.leases,oldClaim=state.claim
  state.leases=state.leases.filter{_,lease in boot != nil && lease.bootIdentity==boot && lease.claim.bootIdentity==boot}
  if state.claim?.bootIdentity != boot || boot==nil {state.claim=nil}
  if old != state.leases || oldClaim != state.claim {try persist(state,defaults);reconcile(state,defaults);for lease in old.values where state.leases[lease.claim.groupId]==nil {centre.stopMonitoring([breakName(lease.claim.groupId,lease.claim.groupRevision,lease.claim.generation,lease.claim.scopeEpoch,lease.claim.interventionId)])}}
 }
 private func bind(_ scope:String,_ state:inout FreedAppGroupsState,_ defaults:UserDefaults,versioned:Bool=false)throws {
  return try withBindingState {
  let journal = try FreedAccountProtectionCleanup.read(defaults)
  if !versioned && (journal.admissionRevision > 0 || journal.versionedBinding) { throw Failure.reason("binding-upgrade-required") }

  let owner=try scopeOwner(scope)
  try revokeInvalidBootAuthority(&state,defaults)
  let parts=(try JSONSerialization.jsonObject(with:Data(scope.utf8))) as! [Any]
  let host=(parts[1] as! NSNumber).intValue
  if !versioned, let boundHost,host<boundHost || host==boundHost && actionScope != nil && actionScope != scope && owner != nil {throw Failure.reason("stale-action-scope")}
  let salt=defaults.string(forKey:saltKey) ?? UUID().uuidString
  defaults.set(salt,forKey:saltKey)
  let digest=owner.map{SHA256.hash(data:Data((salt+"\0"+$0).utf8)).map{String(format:"%02x",$0)}.joined()}
  // Runtime admission identity is independent of persistent app-policy identity.
  // A same-owner reopen retains active windows and their original native deadline.
  let changed=state.ownerDigest != digest || (!versioned && (actionScope != nil && actionScope != scope || actionScope==nil && digest==nil))
  if versioned && !changed { _ = try FreedProtectionConfigurationLock.fenceAdultMutations(defaults) }
  if changed {
   try FreedProtectionConfigurationLock.fenceAdultMutations(defaults)
   let oldLeases=state.leases;state.scopeEpoch += 1;state.leases=[:];state.claim=nil
   if let data=defaults.data(forKey:"freed.pendingIntervention.record"),let record=(try? JSONSerialization.jsonObject(with:data)) as? [String:Any],let eventScope=record["scope"] as? [String:Any],eventScope["groupId"] != nil {defaults.removeObject(forKey:"freed.pendingIntervention.record");defaults.removeObject(forKey:"freed.pendingIntervention.unlockScope")}
   state.ownerDigest=digest;try persist(state,defaults);reconcile(state,defaults)
   for lease in oldLeases.values {centre.stopMonitoring([breakName(lease.claim.groupId,lease.claim.groupRevision,lease.claim.generation,lease.claim.scopeEpoch,lease.claim.interventionId)])}
  }

  }
 }
 func setScope(_ scope:String)->[String:Any] {
  let operationId=UUID().uuidString
  // Rejected stale calls must not suspend a later owner's private presentation.

  var generation:Int?,epoch:Int?
  var acknowledgedBindingID: String?
  var acknowledgedRevision = 0
  do {
   let owner=try scopeOwner(scope)
   let host=(try JSONSerialization.jsonObject(with:Data(scope.utf8)) as! [Any])[1] as! NSNumber
   _ = try withPrivateConfigurationAccess(afterSuccessfulPersistence:{(_ :Int) in
    self.stopChallengeObservation(invalidateProcess:true)
    self.actionScope=scope;self.boundHost=host.intValue;self.boundEpoch=epoch;self.privateOwner=owner != nil
    self.bindingID=acknowledgedBindingID;self.bindingRevision=acknowledgedRevision;self.nativeBindingSession=nil
   }){d -> Int in
    if d.data(forKey:FreedAppGroupsPolicy.key) != nil && FreedAppGroupsPolicy.decode(d.data(forKey:FreedAppGroupsPolicy.key))==nil {throw Failure.reason("group-state-unreadable")}
    guard (try JSONSerialization.jsonObject(with: Data(scope.utf8)) as? [Any])?.count == 2 else { throw Failure.reason("binding-ticket-required") }
    var state=read(d);let originalEpoch=state.scopeEpoch;let originalOwner=state.ownerDigest
    try bind(scope,&state,d)
    var journal = try FreedAccountProtectionCleanup.read(d)
    acknowledgedBindingID = state.scopeEpoch == originalEpoch && state.ownerDigest == originalOwner ? journal.currentBindingID ?? UUID().uuidString.lowercased() : UUID().uuidString.lowercased()
    journal.currentBindingID = acknowledgedBindingID
    acknowledgedRevision = journal.admissionRevision
    try FreedAccountProtectionCleanup.stage(journal, d)
    generation=FreedProtectionConfigurationLock.generation(d);epoch=state.scopeEpoch
    return state.scopeEpoch
   }
   refreshPrivateViews()
   if owner==nil {var receipt=FreedProtectionConfigurationLock.bindingFailure(reason:"sign-in-required",stage:"complete",operationId:operationId,generation:generation,scopeEpoch:epoch);receipt["bindingCurrent"]=true;return receipt}
   return ["version":1,"bindingHandle":acknowledgedBindingID ?? "","operationId":operationId,"supported":true,"accepted":true,"bindingCurrent":true,"ownerVerified":true,"stage":"complete","reason":NSNull(),"generation":generation.map{$0 as Any} ?? NSNull(),"scopeEpoch":epoch.map{$0 as Any} ?? NSNull(),"errorCode":NSNull(),"errorDomain":NSNull()]
  }catch {
   let access=error as? FreedProtectionConfigurationLock.AccessError
   let stage=access.map{["state-read","state-commit"].contains($0.stage) ? $0.stage:"lock-acquire"} ?? (reason(error).hasPrefix("invalid-") ? "scope-validation":reason(error).contains("unreadable") ? "state-read":"owner-binding")
   return FreedProtectionConfigurationLock.bindingFailure(reason:reason(error),stage:stage,operationId:operationId,generation:generation,scopeEpoch:epoch,errorCode:access?.posixCode)
  }
 }
 private func ownerCurrent(_ state:FreedAppGroupsState,_ defaults:UserDefaults)->Bool {
  return (try? withBindingState {
  guard let journal = try? FreedAccountProtectionCleanup.read(defaults),
   journal.admissionRevision == bindingRevision, journal.currentBindingID == bindingID,
   (!journal.versionedBinding || nativeBindingSession?.current == true),
   privateOwner,let scope=actionScope,boundEpoch==state.scopeEpoch,let owner=try? scopeOwner(scope),let salt=defaults.string(forKey:saltKey) else{return false}
  let digest=SHA256.hash(data:Data((salt+"\0"+owner).utf8)).map{String(format:"%02x",$0)}.joined()
  return state.ownerDigest==digest && state.generation==FreedProtectionConfigurationLock.generation(defaults)
  }) == true
 }
 private func authorized()->Bool{AuthorizationCenter.shared.authorizationStatus == .approved}
 private func legacySelection(_ d:UserDefaults)->FamilyActivitySelection {
  d.data(forKey:selectionKey).flatMap{try? JSONDecoder().decode(FamilyActivitySelection.self,from:$0)} ?? FamilyActivitySelection()
 }
 func selection(_ group:FreedAppGroupDefinition,_ d:UserDefaults)->FamilyActivitySelection {
  group.rule.kind=="legacy" ? legacySelection(d) : group.selection.flatMap{try? JSONDecoder().decode(FamilyActivitySelection.self,from:$0)} ?? FamilyActivitySelection()
 }
 func privateSelection(groupId:String,draft:Bool=false)->FamilyActivitySelection? {
  return (try? withBindingState { () -> FamilyActivitySelection? in
   guard privateOwner else{return nil}
   return try? withPrivateConfigurationAccess{d in guard ownerCurrent(read(d),d),let g=read(d).groups.first(where:{$0.id==groupId}) else{throw Failure.reason("group-missing")};return draft ? g.pendingSelection.flatMap{try? JSONDecoder().decode(FamilyActivitySelection.self,from:$0)} ?? selection(g,d):selection(g,d)}
  }) ?? nil
 }
 private func legacyIndependentIntent(_ d:UserDefaults)->Bool {
  if d.bool(forKey:"freed.riskWindowActive"){return true}
  guard let data=d.data(forKey:"freed.appGuard.schedules.v1"),let object=(try? JSONSerialization.jsonObject(with:data)) as? [String:Any] else{return false}
  return object["strictGuard"] as? Bool==true || (object["schedules"] as? [[String:Any]] ?? []).contains{r in r["enabled"] as? Bool==true && !(r["days"] as? [Int] ?? []).isEmpty}
 }
 private func legacyEnabledIntent(_ d:UserDefaults)->Bool {
  d.bool(forKey:"freed.appLimit.active") || d.string(forKey:"freed.appGuard.mode")=="before-use" || legacyIndependentIntent(d)
 }
 private func migrate(_ state:inout FreedAppGroupsState,_ d:UserDefaults)throws {
  if state.legacyMigrated {
   if let index=state.groups.firstIndex(where:{$0.id==FreedAppGroupsPolicy.legacyId && $0.rule.kind=="legacy"}),state.groups[index].enabled != legacyEnabledIntent(d) {
    state.groups[index].enabled=legacyEnabledIntent(d);state.revision += 1;try persist(state,d)
   }
   return
  }
  let s=legacySelection(d)
  if !s.applicationTokens.isEmpty || !s.categoryTokens.isEmpty || !s.webDomainTokens.isEmpty {
   var g=FreedAppGroupsPolicy.draft(id:FreedAppGroupsPolicy.legacyId,name:"",slot:0)
   g.legacy=true;g.rule=FreedAppGroupRule(kind:"legacy");g.selection=try JSONEncoder().encode(s)
   g.enabled=legacyEnabledIntent(d)
   state.groups.append(g)
  }
  state.legacyMigrated=true;state.revision += 1;try persist(state,d)
 }
 private func legacyHard(_ d:UserDefaults)->Bool {
  if d.bool(forKey:"freed.riskWindow.currentlyActive"){return true}
  if let data=d.data(forKey:"freed.appGuard.schedules.v1"),let object=(try? JSONSerialization.jsonObject(with:data)) as? [String:Any] {
   if object["strictGuard"] as? Bool == true{return true}
   let day=Calendar.current.component(.weekday,from:clock.now())-1,minute=Calendar.current.component(.hour,from:clock.now())*60+Calendar.current.component(.minute,from:clock.now())
   for r in object["schedules"] as? [[String:Any]] ?? [] where r["enabled"] as? Bool == true {
    let rule=FreedAppGroupRule(kind:"scheduled",startMinute:r["startMinute"] as? Int,endMinute:r["endMinute"] as? Int,days:r["days"] as? [Int])
    if r["allDay"] as? Bool == true && (r["days"] as? [Int] ?? []).contains(day) || FreedAppGroupsPolicy.windowActive(rule,day:day,minute:minute){return true}
   }
  };return false
 }
 static func legacyAppsAdopted(_ d:UserDefaults)->Bool{FreedAppGroupsPolicy.decode(d.data(forKey:FreedAppGroupsPolicy.key))?.legacyAppsAdopted == true}
 private func store(_ g:FreedAppGroupDefinition)->ManagedSettingsStore{ManagedSettingsStore(named:.init("freed.app-group.slot\(g.slot).bank\(g.bank)"))}
 private func otherBank(_ g:FreedAppGroupDefinition)->ManagedSettingsStore{ManagedSettingsStore(named:.init("freed.app-group.slot\(g.slot).bank\(1-g.bank)"))}
 private func name(_ g:FreedAppGroupDefinition,_ generation:Int)->DeviceActivityName{.init("freed.group.\(g.id).g\(generation).r\(g.revision).\(g.rule.kind=="daily-limit" ? "daily" : "window")")}
 private func breakName(_ id:String,_ revision:Int,_ generation:Int,_ epoch:Int,_ interventionId:String)->DeviceActivityName{.init("freed.group.\(id).g\(generation).r\(revision).e\(epoch).i\(interventionId).break")}
 private func eventName(_ g:FreedAppGroupDefinition)->DeviceActivityEvent.Name{.init("freed.group.\(g.id).r\(g.revision).threshold")}
 private func dateKey()->String{let f=DateFormatter();f.calendar=Calendar(identifier:.gregorian);f.locale=Locale(identifier:"en_US_POSIX");f.dateFormat="yyyy-MM-dd";return f.string(from:clock.now())}
 private func active(_ g:FreedAppGroupDefinition,_ state:FreedAppGroupsState,_ d:UserDefaults)->Bool {
  guard g.enabled,authorized(),!d.bool(forKey:FreedProtectionConfigurationLock.resetMarkerKey) else{return false}
  switch g.rule.kind {
  case "before-use":return true
  case "daily-limit":return state.thresholds[g.id]==dateKey()
  case "scheduled":let c=Calendar.current;return FreedAppGroupsPolicy.windowActive(g.rule,day:c.component(.weekday,from:clock.now())-1,minute:c.component(.hour,from:clock.now())*60+c.component(.minute,from:clock.now()))
  case "legacy":return legacyHard(d) || d.string(forKey:"freed.appGuard.mode")=="before-use" || d.string(forKey:"freed.appLimit.reachedDate")==dateKey()
  default:return false
  }
 }
 private func leaseTarget(_ g:FreedAppGroupDefinition,_ s:FreedAppGroupsState)->ApplicationToken? {
  guard let l=s.leases[g.id],FreedAppGroupsPolicy.leaseActive(l,group:g,generation:s.generation,scopeEpoch:s.scopeEpoch,now:clock.now().timeIntervalSince1970,uptime:clock.uptime(),bootIdentity:clock.bootIdentity()),expiryReady(l),let data=Data(base64Encoded:l.claim.target) else{return nil}
  return try? JSONDecoder().decode(ApplicationToken.self,from:data)
 }
 private func desired(_ g:FreedAppGroupDefinition,_ s:FreedAppGroupsState,_ d:UserDefaults)->Set<ApplicationToken> {
  guard active(g,s,d),g.rule.kind != "legacy" else{return []}
  var result=selection(g,d).applicationTokens
  if let token=leaseTarget(g,s) ?? earnedLeaseTarget(g,s,d){result.remove(token)};return result
 }
 private func writeShields(_ g:FreedAppGroupDefinition,_ s:FreedAppGroupsState,_ d:UserDefaults) {
  guard g.rule.kind != "legacy" else{return};let apps=desired(g,s,d),settings=store(g)
  settings.shield.applications=apps.isEmpty ? nil:apps
  settings.shield.applicationCategories=nil;settings.shield.webDomains=nil;settings.shield.webDomainCategories=nil
 }
 private func shieldsReady(_ g:FreedAppGroupDefinition,_ s:FreedAppGroupsState,_ d:UserDefaults)->Bool {
  if g.rule.kind=="legacy" {
   let legacyStore=ManagedSettingsStore(),selected=selection(g,d)
   if !active(g,s,d){return legacyStore.shield.applications?.isEmpty != false}
   if !selected.applicationTokens.isEmpty{return (legacyStore.shield.applications ?? []).isSuperset(of:selected.applicationTokens)}
   return (!selected.categoryTokens.isEmpty && legacyStore.shield.applicationCategories != nil) || (!selected.webDomainTokens.isEmpty && legacyStore.shield.webDomains?.isEmpty == false)
  }
  return (store(g).shield.applications ?? [])==desired(g,s,d)
 }
 private func schedule(_ g:FreedAppGroupDefinition)->DeviceActivitySchedule {
  if g.rule.kind=="scheduled" {let a=g.rule.startMinute ?? 0,b=g.rule.endMinute ?? 0;return .init(intervalStart:DateComponents(hour:a/60,minute:a%60),intervalEnd:DateComponents(hour:b/60,minute:b%60),repeats:true)}
  return .init(intervalStart:DateComponents(hour:0,minute:0),intervalEnd:DateComponents(hour:23,minute:59),repeats:true)
 }
 private func events(_ g:FreedAppGroupDefinition,_ d:UserDefaults)throws->[DeviceActivityEvent.Name:DeviceActivityEvent] {
  guard g.rule.kind=="daily-limit" else{return[:]}
  guard clock.dailyPastUsageAvailable(),#available(iOS 17.4,*) else{throw Failure.reason("daily-past-usage-unavailable")}
  return[eventName(g):DeviceActivityEvent(applications:selection(g,d).applicationTokens,threshold:DateComponents(minute:g.rule.limitMinutes ?? 30),includesPastActivity:true)]
 }
 private func registrationReady(_ g:FreedAppGroupDefinition,_ s:FreedAppGroupsState,_ d:UserDefaults)->Bool {
  guard g.enabled else{return true}
  if g.rule.kind=="before-use"{return true}
  if g.rule.kind=="legacy" {
   var configured=d.string(forKey:"freed.appGuard.mode")=="before-use"
   func observed(_ name:String,_ expected:DeviceActivitySchedule?=nil)->Bool {
    let activity=DeviceActivityName(name)
    guard centre.activities.contains(activity),let actual=centre.schedule(for:activity) else{return false}
    return expected.map{actual==$0} ?? actual.repeats
   }
   if d.bool(forKey:"freed.appLimit.active") {
    configured=true
    guard observed("freed.selectedAppDailyLimit",.init(intervalStart:DateComponents(hour:0,minute:0),intervalEnd:DateComponents(hour:23,minute:59),repeats:true)) else{return false}
   }
   if d.bool(forKey:"freed.riskWindowActive") {
    configured=true
    guard let intent=FreedNightGuardIntent.decode(d.data(forKey:FreedNightGuardIntent.key),generation:FreedProtectionConfigurationLock.generation(d)),observed("freed.nightGuard",.init(intervalStart:DateComponents(hour:intent.startMinute/60,minute:intent.startMinute%60),intervalEnd:DateComponents(hour:intent.endMinute/60,minute:intent.endMinute%60),repeats:intent.repeats)) else{return false}
   }
   if let data=d.data(forKey:"freed.appGuard.schedules.v1"),let object=(try? JSONSerialization.jsonObject(with:data)) as? [String:Any] {
    if object["strictGuard"] as? Bool==true{configured=true}
    for row in object["schedules"] as? [[String:Any]] ?? [] where row["enabled"] as? Bool==true {
     configured=true
     guard let id=row["id"] as? String,!id.isEmpty,let days=row["days"] as? [Int],!days.isEmpty,Set(days).count==days.count,days.allSatisfy({(0...6).contains($0)}),let start=row["startMinute"] as? Int,let end=row["endMinute"] as? Int,(0..<1440).contains(start),(0..<1440).contains(end) else{return false}
     let allDay=row["allDay"] as? Bool==true
     if days.count==7 && !allDay {
      guard observed("freed.appGuard.schedule.\(id).daily",.init(intervalStart:DateComponents(hour:start/60,minute:start%60),intervalEnd:DateComponents(hour:end/60,minute:end%60),repeats:true)) else{return false}
     } else {
      for day in days {
       let a=allDay ? 0:start,b=allDay ? 0:end,next=allDay || b<a ? (day+1)%7:day
       guard observed("freed.appGuard.schedule.\(id).day\(day)",.init(intervalStart:DateComponents(hour:a/60,minute:a%60,weekday:day+1),intervalEnd:DateComponents(hour:b/60,minute:b%60,weekday:next+1),repeats:true)) else{return false}
      }
     }
    }
   };return configured
  }
  let activity=name(g,s.generation)
  return centre.activities.contains(activity) && centre.schedule(for:activity)==schedule(g) && (try? events(g,d)).map{centre.events(for:activity)==$0}==true
 }
 private func restoreRegistration(_ g:FreedAppGroupDefinition,_ state:FreedAppGroupsState,_ d:UserDefaults)throws {
  let activity=name(g,state.generation),previous=centre.schedule(for:activity),previousEvents=centre.events(for:activity)
  guard FreedAppGroupsPolicy.canStage(existingActivities:centre.activities.count,newActivities:centre.activities.contains(activity) ? 0:1) else{throw Failure.reason("monitor-capacity")}
  // Reinstall this committed rule in place. No revision, bank, threshold, claim,
  // budget or lease changes are needed to repair an OS registration loss.
  let expectedEvents=try events(g,d)
  do {
   do{try centre.startMonitoring(activity,during:schedule(g),events:expectedEvents)}catch{throw Failure.native(reason:"monitor-registration-failed",stage:"monitor-registration",underlying:error)}
   guard registrationReady(g,state,d) else{throw Failure.reason("monitor-readback-failed")}
  }catch {
   if let previous {try? centre.startMonitoring(activity,during:previous,events:previousEvents)}
   else {centre.stopMonitoring([activity])}
   throw error
  }
 }
 @discardableResult private func reconcile(_ state:FreedAppGroupsState,_ d:UserDefaults)->String? {
  guard FreedProtectionConfigurationLock.permitsPublication(d,capturedGeneration:state.generation),selectionsValid(state) else{return "protection-reset"}
  var failure:String?
  for g in state.groups where g.rule.kind != "legacy" {
   if g.enabled,authorized(),["daily-limit","scheduled"].contains(g.rule.kind),!registrationReady(g,state,d) {
    do{try restoreRegistration(g,state,d)}catch{if failure==nil{failure=reason(error)};continue}
   }
   if registrationReady(g,state,d){writeShields(g,state,d)}
  }
  if state.legacyAppsAdopted && !legacyHard(d){ManagedSettingsStore().shield.applications=nil}
  return failure
 }
 private func transaction(_ old:FreedAppGroupsState,_ candidate:FreedAppGroupsState,_ d:UserDefaults)throws {
  var started=[DeviceActivityName](),staged=[FreedAppGroupDefinition]()
  let changed=candidate.groups.filter{g in old.groups.first(where:{$0.id==g.id}).map{$0.revision != g.revision || $0.bank != g.bank} ?? true}
  let newNames=changed.filter{$0.enabled && ["daily-limit","scheduled"].contains($0.rule.kind)}.map{name($0,candidate.generation)}
  guard FreedAppGroupsPolicy.canStage(existingActivities:centre.activities.count,newActivities:newNames.filter{!centre.activities.contains($0)}.count) else{throw Failure.reason("monitor-capacity")}
  do {
   for g in changed where g.rule.kind != "legacy" {
    if g.enabled && ["daily-limit","scheduled"].contains(g.rule.kind) {
     let activity=name(g,candidate.generation);if !registrationReady(g,candidate,d){do{try centre.startMonitoring(activity,during:schedule(g),events:events(g,d))}catch let failure as Failure{throw failure}catch{throw Failure.native(reason:"monitor-registration-failed",stage:"monitor-registration",underlying:error)};started.append(activity)}
     guard registrationReady(g,candidate,d) else{throw Failure.reason("monitor-readback-failed")}
    }
    staged.append(g);writeShields(g,candidate,d)
    guard shieldsReady(g,candidate,d) else{throw Failure.reason("group-shield-readback-failed")}
   }
   try persist(candidate,d)
  }catch {
   centre.stopMonitoring(started);for g in staged {store(g).clearAllSettings()};try? persist(old,d);throw error
  }
 }
 func snapshot(_ scope:String)->[String:Any] {
  do{return try withPrivateConfigurationAccess{d in
   if d.data(forKey:FreedAppGroupsPolicy.key) != nil && FreedAppGroupsPolicy.decode(d.data(forKey:FreedAppGroupsPolicy.key))==nil {throw Failure.reason("group-state-unreadable")}
   var s=read(d);try revokeInvalidBootAuthority(&s,d);guard selectionsValid(s) else{throw Failure.reason("group-selection-unreadable")};guard actionScope != nil,actionScope==scope,(!privateOwner || ownerCurrent(s,d)) else{throw Failure.reason("owner-scope-unbound-or-stale")}
   var reconciliationFailure:String?
   if !d.bool(forKey:FreedProtectionConfigurationLock.resetMarkerKey){
    try migrate(&s,d)
    if privateOwner {do{try refreshEarnedBudgets(s,d)}catch{reconciliationFailure=reason(error)}}
    reconciliationFailure=reconcile(s,d) ?? reconciliationFailure
   }
   var result=payload(s,d)
   if let reconciliationFailure,privateOwner {result["reason"]=reconciliationFailure;result["diagnostics"]=operationDiagnostics(Failure.reason(reconciliationFailure))}
   return result
  }}catch{var result=unavailable(reason(error));result["diagnostics"]=operationDiagnostics(error);return result}
 }
 private func mutate(_ scope:String,operation:String="update",input:[String:Any]=[:],_ body:(inout FreedAppGroupsState,UserDefaults)throws->Void)->[String:Any] {
  var previous:FreedAppGroupsState?,next:FreedAppGroupsState?
  let operationId=UUID().uuidString.lowercased()
  func diagnostics(_ error:Error?=nil)->[String:Any] {
   var result=error.map{operationDiagnostics($0)} ?? FreedProtectionConfigurationLock.diagnostics()
   if error==nil && operation=="update-earned" {result.merge(clock.readBoot().diagnostics,uniquingKeysWith:{$1})}
   result["version"]=1;result["operation"]=operation;result["operationId"]=operationId
   result["configurationGeneration"]=previous.map{$0.generation as Any} ?? NSNull()
   result["storeRevision"]=previous.map{$0.revision as Any} ?? NSNull()
   let revision=(input["id"] as? String).flatMap{id in previous?.groups.first{$0.id==id}?.revision}
   result["groupRevision"]=revision.map{$0 as Any} ?? NSNull()
   return result
  }
  do {
   let result=try withPrivateConfigurationAccess(afterSuccessfulPersistence:{(_:Int) in
    guard let old=previous,let current=next else{return}
    for g in old.groups where current.groups.first(where:{$0.id==g.id}).map({$0.revision != g.revision || $0.bank != g.bank}) ?? true {if g.rule.kind != "legacy" {self.store(g).clearAllSettings()};self.centre.stopMonitoring(self.centre.activities.filter{activity in activity.rawValue.hasPrefix("freed.group.\(g.id).") && !current.groups.contains(where:{$0.id==g.id && self.name($0,current.generation)==activity}) && !current.leases.values.contains(where:{self.breakName($0.claim.groupId,$0.claim.groupRevision,$0.claim.generation,$0.claim.scopeEpoch,$0.claim.interventionId)==activity})})}
   }){d -> Int in
    guard FreedProtectionConfigurationLock.permitsPublication(d) else{throw Failure.reason("protection-reset")}
    if d.data(forKey:FreedAppGroupsPolicy.key) != nil && FreedAppGroupsPolicy.decode(d.data(forKey:FreedAppGroupsPolicy.key))==nil {throw Failure.reason("group-state-unreadable")}
    var s=read(d);try self.revokeInvalidBootAuthority(&s,d);guard self.selectionsValid(s) else{throw Failure.reason("group-selection-unreadable")};guard actionScope != nil,actionScope==scope,(!privateOwner || ownerCurrent(s,d)) else{throw Failure.reason("owner-scope-unbound-or-stale")};guard privateOwner else{throw Failure.reason("sign-in-required")};try migrate(&s,d)
    previous=s;try body(&s,d);s.revision += 1;next=s;try transaction(previous!,s,d);return s.revision
   }
   _=result
   let current=snapshot(scope);return["accepted":true,"reason":NSNull(),"snapshot":current,"diagnostics":diagnostics()]
  }catch {
   if let old=previous,let staged=next {
    for g in staged.groups where old.groups.first(where:{$0.id==g.id}).map({$0.revision != g.revision || $0.bank != g.bank}) ?? true {if g.rule.kind != "legacy" {store(g).clearAllSettings()};if old.groups.first(where:{$0.id==g.id}).map({$0.revision != g.revision}) ?? true {centre.stopMonitoring([name(g,staged.generation)])}}
    _=try? withPrivateConfigurationAccess{d in if read(d).revision==staged.revision{try persist(old,d);reconcile(old,d)}}
   }
   return["accepted":false,"reason":reason(error),"snapshot":snapshot(scope),"diagnostics":diagnostics(error)]
  }
 }
 private func operationDiagnostics(_ error:Error)->[String:Any] {
  let underlying:Error;if let failure=error as? FreedAppGroupsClock.ValidationFailure{underlying=failure.underlying}else if case Failure.native(_,_,let source)=error{underlying=source}else{underlying=error}
  var diagnostics=FreedProtectionConfigurationLock.diagnostics(underlying)
  if let failure=error as? FreedAppGroupsClock.ValidationFailure {diagnostics.merge(failure.diagnostics,uniquingKeysWith:{$1})}
  let code=reason(error);diagnostics["reason"]=code
  if case Failure.native(_,let stage,_)=error{diagnostics["stage"]=stage;return diagnostics}
  if !(error is FreedProtectionConfigurationLock.AccessError) {
   diagnostics["stage"]=code.contains("persistence") ? "state-commit":code.contains("unreadable") ? "state-read":code.contains("clock") ? "clock-validation":code.contains("monitor-readback") ? "monitor-readback":code.contains("monitor") || code.contains("expiry") || code.contains("past-usage") ? "monitor-registration":code.contains("shield") ? "policy-readback":code.contains("scope") || code.contains("sign-in") ? "owner-binding":"request-validation"
  }
  return diagnostics
 }
 private func reason(_ error:Error)->String {
  if let failure=error as? FreedAppGroupsClock.ValidationFailure{return reason(failure.underlying)}
  if case Failure.reason(let code)=error{return code};if case Failure.native(let code,_,_)=error{return code};if let access=error as? FreedProtectionConfigurationLock.AccessError{return access.reason}
  if let failure=error as? FreedEarnedAppTimePolicy.Failure {switch failure {case .clockUnavailable:return "earned-time-clock-unverified";case .capacity:return "earned-time-ledger-capacity";case .invalidBudget:return "earned-time-budget-invalid"}}
  return "group-native-operation-failed"
 }
 private func number(_ input:[String:Any],_ key:String)->Int? {guard let n=input[key] as? NSNumber,CFGetTypeID(n) != CFBooleanGetTypeID(),n.doubleValue.rounded()==n.doubleValue,n.doubleValue>=0,n.doubleValue<=9_007_199_254_740_991 else{return nil};return n.intValue}
 func create(_ input:[String:Any],_ scope:String)->[String:Any] {
  mutate(scope,operation:"create",input:input){s,_ in guard self.number(input,"version")==1,self.number(input,"expectedStoreRevision")==s.revision,let name=input["name"] as? String,name.count<=80,s.groups.count<6,let slot=(0..<6).first(where:{slot in !s.groups.contains(where:{$0.slot==slot})}) else{throw Failure.reason("group-create-invalid-or-stale")};s.groups.append(FreedAppGroupsPolicy.draft(id:UUID().uuidString.lowercased(),name:name,slot:slot))}
 }
 func update(_ input:[String:Any],_ scope:String,selectionData:Data?=nil)->[String:Any] {
  mutate(scope,operation:selectionData==nil ? "update":"picker",input:input){s,d in
   guard self.number(input,"version")==1,self.number(input,"expectedStoreRevision")==s.revision,let id=input["id"] as? String,let i=s.groups.firstIndex(where:{$0.id==id}),self.number(input,"expectedRevision")==s.groups[i].revision else{throw Failure.reason("group-revision-stale")}
   var g=s.groups[i]
   if let selectionData {guard let selection=try? JSONDecoder().decode(FamilyActivitySelection.self,from:selectionData),selection.categoryTokens.isEmpty,selection.webDomainTokens.isEmpty,selection.applicationTokens.count<=200 else{throw Failure.reason("individual-apps-only")};g.pendingSelection=selectionData;s.groups[i]=g;return}
   else {
    guard let name=input["name"] as? String,name.count<=80,let enabledValue=input["enabled"] as? NSNumber,CFGetTypeID(enabledValue)==CFBooleanGetTypeID(),let enabled=input["enabled"] as? Bool,let raw=input["rule"] as? [String:Any],Set(raw.keys)==Set(raw["kind"] as? String=="daily-limit" ? ["kind","limitMinutes"]:raw["kind"] as? String=="scheduled" ? ["kind","startMinute","endMinute","days"]:["kind"]),let data=try? JSONSerialization.data(withJSONObject:raw),let rule=try? JSONDecoder().decode(FreedAppGroupRule.self,from:data),FreedAppGroupsPolicy.validateRule(rule,enabled:enabled),let packages=input["packages"] as? [String],packages.isEmpty else{throw Failure.reason("group-update-invalid")}
    if g.rule.kind=="legacy" {g.selection=try JSONEncoder().encode(self.legacySelection(d));s.legacyAppsAdopted=true}
    g.name=name;g.enabled=enabled;g.rule=rule
    if let pending=g.pendingSelection {g.selection=pending;g.pendingSelection=nil}
   }
   if g.enabled {guard self.authorized(),!self.selection(g,d).applicationTokens.isEmpty else{throw Failure.reason("authorization-or-app-selection-required")}}
   g.revision += 1;g.bank=1-g.bank;s.groups[i]=g;s.thresholds.removeValue(forKey:id);s.leases.removeValue(forKey:id);if s.claim?.groupId==id{s.claim=nil}
  }
 }
 func remove(_ input:[String:Any],_ scope:String)->[String:Any] {
  mutate(scope,operation:"remove",input:input){s,_ in guard self.number(input,"version")==1,self.number(input,"expectedStoreRevision")==s.revision,let id=input["id"] as? String,let g=s.groups.first(where:{$0.id==id}),self.number(input,"expectedRevision")==g.revision else{throw Failure.reason("group-revision-stale")};if g.legacy{s.legacyAppsAdopted=true};s.groups.removeAll{$0.id==id};s.leases.removeValue(forKey:id);s.thresholds.removeValue(forKey:id);if s.claim?.groupId==id{s.claim=nil}}
 }
 // Draft deletion has no activation transaction, authority cleanup or OS publication.
 // The group revision/bank belong to committed policy and exact-target leases.
 func discardPendingSelection(_ input:[String:Any],_ scope:String)->[String:Any] {
  let targetId=(input["id"] as? String).flatMap{FreedAppGroupsPolicy.validId($0) ? $0:nil}
  func receipt(_ accepted:Bool,_ reason:String?,_ snapshot:[String:Any],_ diagnostics:[String:Any])->[String:Any] {
   ["accepted":accepted,"reason":reason.map{$0 as Any} ?? NSNull(),"operation":"discard-pending-selection","targetId":targetId.map{$0 as Any} ?? NSNull(),"pendingSelectionDiscarded":accepted,"snapshot":snapshot,"diagnostics":diagnostics]
  }
  do {
   let current=try withPrivateConfigurationAccess{d -> [String:Any] in
    guard FreedProtectionConfigurationLock.permitsPublication(d) else{throw Failure.reason("protection-reset")}
    guard var s=FreedAppGroupsPolicy.decode(d.data(forKey:FreedAppGroupsPolicy.key)),selectionsValid(s) else{throw Failure.reason("group-state-unreadable")}
    guard privateOwner,actionScope==scope,ownerCurrent(s,d) else{throw Failure.reason("owner-scope-unbound-or-stale")}
    guard Set(input.keys)==Set(["version","expectedStoreRevision","id","expectedRevision"]),number(input,"version")==1,number(input,"expectedStoreRevision")==s.revision,let id=targetId,let i=s.groups.firstIndex(where:{$0.id==id}),number(input,"expectedRevision")==s.groups[i].revision else{throw Failure.reason("group-revision-stale")}
    if s.groups[i].pendingSelection != nil {
     guard s.revision<9_007_199_254_740_991 else{throw Failure.reason("group-revision-stale")}
     s.groups[i].pendingSelection=nil;s.revision += 1;try persist(s,d)
    }
    return payload(s,d)
   }
   refreshPrivateViews()
   return receipt(true,nil,current,FreedProtectionConfigurationLock.diagnostics())
  }catch {
   // snapshot(scope) also reconciles policy. A rejected discard must only read.
   let current=(try? withPrivateConfigurationAccess{d -> [String:Any] in
    guard let s=FreedAppGroupsPolicy.decode(d.data(forKey:FreedAppGroupsPolicy.key)),selectionsValid(s),privateOwner,actionScope==scope,ownerCurrent(s,d) else{return unavailable(reason(error))}
    return payload(s,d)
   }) ?? unavailable(reason(error))
   return receipt(false,reason(error),current,operationDiagnostics(error))
  }
 }
 private struct CallbackPublication {
  let state:FreedAppGroupsState
  let defaults:UserDefaults
  let groups:Set<String>
  let reconcileAll:Bool
  let stop:[DeviceActivityName]
 }
 @discardableResult func callback(activity:String,event:String?=nil)->Bool {
  let day=dateKey(),boot=clock.bootIdentity()
  var capturedState:FreedAppGroupsState?
  // One synchronous retry handles a transient lock/file failure while the
  // extension is alive. Persistent protected-storage failure is not success.
  for attempt in 0..<2 {
   do{return try callbackOnce(activity:activity,event:event,day:day,boot:boot,capturedState:&capturedState)}
   catch{if attempt==1 {let code=reason(error);Logger(subsystem:"app.freed.protection",category:"AppGroups").error("Native app-group callback failed after bounded retry: \(code,privacy:.public)");if self.reapplyVerifiedExpiredRestriction(activity:activity,event:event) {Logger(subsystem:"app.freed.protection",category:"AppGroups").error("Expired app restriction confirmed from committed state; callback persistence still failed")}}}
  }
  return false
 }
 private func reapplyVerifiedExpiredRestriction(activity:String,event:String?)->Bool {
  // This fallback cannot persist a new threshold. It only reinstates a target
  // whose existing native lease is irreversibly expired on this boot, or was
  // issued on an earlier boot, and whose current committed rule still wants it.
  guard event==nil else{return false}
  return (try? FreedProtectionConfigurationLock.withExclusiveAccess{d -> Bool in
   guard self.authorized(),FreedProtectionConfigurationLock.permitsPublication(d),let s=FreedAppGroupsPolicy.decode(d.data(forKey:FreedAppGroupsPolicy.key)),self.selectionsValid(s),s.generation==FreedProtectionConfigurationLock.generation(d),let boot=self.clock.bootIdentity(),!boot.isEmpty else{return false}
   let earned=try self.readEarned(d),uptime=self.clock.uptime()
   func permanentlyExpired(_ lease:FreedAppGroupLease,_ group:FreedAppGroupDefinition)->Bool {
    guard let issuedBoot=lease.bootIdentity,!issuedBoot.isEmpty,lease.claim.bootIdentity==issuedBoot,lease.claim.groupId==group.id,lease.claim.groupRevision==group.revision,lease.claim.generation==s.generation,lease.claim.scopeEpoch==s.scopeEpoch,lease.grantedAt.isFinite,lease.expiresAt.isFinite,lease.grantedUptime.isFinite,uptime.isFinite,uptime>=0,lease.expiresAt>lease.grantedAt,lease.expiresAt-lease.grantedAt<=7200,lease.grantedUptime>=0 else{return false}
    return issuedBoot != boot || uptime>=lease.grantedUptime && uptime-lease.grantedUptime>=lease.expiresAt-lease.grantedAt
   }
   var confirmed=false
   for g in s.groups where g.rule.kind != "legacy" && self.active(g,s,d) {
    var candidates=[FreedAppGroupLease]()
    if let lease=s.leases[g.id],activity==self.breakName(g.id,g.revision,s.generation,s.scopeEpoch,lease.claim.interventionId).rawValue {candidates.append(lease)}
    if let owner=s.ownerDigest,let lease=earned.leases[self.earnedKey(owner,g.id)],lease.ownerDigest==owner,activity==self.earnedName(lease).rawValue {candidates.append(lease.native)}
    for lease in candidates where permanentlyExpired(lease,g) {
     guard let data=Data(base64Encoded:lease.claim.target),let token=try? JSONDecoder().decode(ApplicationToken.self,from:data),self.selection(g,d).applicationTokens.contains(token),self.desired(g,s,d).contains(token) else{continue}
     let settings=self.store(g),existing=settings.shield.applications ?? []
     if !existing.contains(token){settings.shield.applications=existing.union([token])}
     confirmed = (settings.shield.applications ?? []).contains(token) || confirmed
    }
   }
   return confirmed
  }) == true
 }
 private func callbackOnce(activity:String,event:String?,day:String,boot:String?,capturedState:inout FreedAppGroupsState?)throws->Bool {
  let publication=try FreedProtectionConfigurationLock.withExclusiveAccess(afterSuccessfulPersistence:{(publication:CallbackPublication?) in
   guard let publication else{return}
   // These renderers only read the committed intent and current OS readback.
   // Keep exclusion through publication; rejected writes cannot alter shields
   // or stop the previous lease's relock monitor.
   if publication.reconcileAll {self.reconcile(publication.state,publication.defaults)}
   else {for g in publication.state.groups where publication.groups.contains(g.id) {self.writeShields(g,publication.state,publication.defaults)}}
   if !publication.stop.isEmpty {self.centre.stopMonitoring(publication.stop)}
  }){d -> CallbackPublication? in
   if d.data(forKey:FreedAppGroupsPolicy.key) != nil && FreedAppGroupsPolicy.decode(d.data(forKey:FreedAppGroupsPolicy.key))==nil{return nil}
   var s=read(d)
   guard selectionsValid(s),FreedProtectionConfigurationLock.permitsPublication(d),s.generation==FreedProtectionConfigurationLock.generation(d) else{return nil}
   guard dateKey()==day,clock.bootIdentity()==boot else{return nil}
   if let previous=capturedState {
    guard s.generation==previous.generation,s.scopeEpoch==previous.scopeEpoch,s.ownerDigest==previous.ownerDigest,s.groups==previous.groups else{return nil}
   }else{capturedState=s}
   let boot=clock.bootIdentity(),oldLeases=s.leases,oldClaim=s.claim
   s.leases=s.leases.filter{_,lease in boot != nil && lease.bootIdentity==boot && lease.claim.bootIdentity==boot}
   if s.claim?.bootIdentity != boot || boot==nil {s.claim=nil}
   let bootChanged=oldLeases != s.leases || oldClaim != s.claim
   var groups=Set<String>(),stopped=oldLeases.values.filter{s.leases[$0.claim.groupId]==nil}.map{breakName($0.claim.groupId,$0.claim.groupRevision,$0.claim.generation,$0.claim.scopeEpoch,$0.claim.interventionId)}
   var earned=try readEarned(d);let oldEarnedLeases=earned.leases
   for (key,lease) in earned.leases {
    let g=s.groups.first{$0.id==lease.native.claim.groupId}
    if lease.native.bootIdentity != boot || lease.ownerDigest != s.ownerDigest || lease.native.claim.scopeEpoch != s.scopeEpoch || lease.native.claim.generation != s.generation || g?.revision != lease.native.claim.groupRevision || activity==earnedName(lease).rawValue && !earnedLeaseActive(lease,g,s) {
     earned.leases.removeValue(forKey:key);groups.insert(lease.native.claim.groupId);stopped.append(earnedName(lease))
    }
   }
   for g in s.groups {
    if activity==name(g,s.generation).rawValue,registrationReady(g,s,d) {if let event,event==eventName(g).rawValue,g.rule.kind=="daily-limit"{s.thresholds[g.id]=dateKey()};groups.insert(g.id)}
    if let l=s.leases[g.id],activity==breakName(g.id,g.revision,s.generation,s.scopeEpoch,l.claim.interventionId).rawValue,!FreedAppGroupsPolicy.leaseActive(l,group:g,generation:s.generation,scopeEpoch:s.scopeEpoch,now:clock.now().timeIntervalSince1970,uptime:clock.uptime(),bootIdentity:clock.bootIdentity()){s.leases.removeValue(forKey:g.id);groups.insert(g.id);stopped.append(.init(activity))}
   }
   if oldEarnedLeases != earned.leases {try stageEarned(earned,d)}
   try persist(s,d)
   return CallbackPublication(state:s,defaults:d,groups:groups,reconcileAll:bootChanged || oldEarnedLeases != earned.leases,stop:stopped)
  }
  return publication != nil
 }
 func issueScope(for token:ApplicationToken,_ d:UserDefaults)->[String:Any]? {
  let s=read(d);guard let boot=clock.bootIdentity(),authorized(),FreedProtectionConfigurationLock.permitsPublication(d),s.generation==FreedProtectionConfigurationLock.generation(d),let data=try? JSONEncoder().encode(token) else{return nil}
  guard let g=s.groups.sorted(by:{$0.slot<$1.slot}).first(where:{$0.rule.kind != "legacy" && active($0,s,d) && registrationReady($0,s,d) && selection($0,d).applicationTokens.contains(token) && (store($0).shield.applications ?? []).contains(token)}) else{return nil}
  return["kind":"ios-token","tokenType":"application","token":data.base64EncodedString(),"groupId":g.id,"groupRevision":g.revision,"configurationGeneration":s.generation,"scopeEpoch":s.scopeEpoch,"bootIdentity":boot,"issuedAt":clock.now().timeIntervalSince1970,"issuedUptime":clock.uptime()]
 }
 func validIssuedScope(_ scope:[String:Any],_ d:UserDefaults)->Bool {
  return (try? withBindingState {
  let s=read(d)
  guard ownerCurrent(s,d),let issuedAt=scope["issuedAt"] as? Double,let issuedUptime=scope["issuedUptime"] as? Double,FreedAppGroupsPolicy.issuedClockValid(bootIdentity:scope["bootIdentity"] as? String,currentBootIdentity:clock.bootIdentity(),issuedAt:issuedAt,issuedUptime:issuedUptime,now:clock.now().timeIntervalSince1970,uptime:clock.uptime()),FreedProtectionConfigurationLock.permitsPublication(d),s.generation==FreedProtectionConfigurationLock.generation(d),let id=scope["groupId"] as? String,let revision=scope["groupRevision"] as? Int,let generation=scope["configurationGeneration"] as? Int,let epoch=scope["scopeEpoch"] as? Int,let encoded=scope["token"] as? String,let data=Data(base64Encoded:encoded),let token=try? JSONDecoder().decode(ApplicationToken.self,from:data),let g=s.groups.first(where:{$0.id==id && $0.revision==revision}),generation==s.generation,epoch==s.scopeEpoch,active(g,s,d),registrationReady(g,s,d),selection(g,d).applicationTokens.contains(token),(store(g).shield.applications ?? []).contains(token) else{return false}
  return true
  }) == true
 }
 func stageClaim(id:String,scope:[String:Any],_ d:UserDefaults)->Bool {
  return (try? withBindingState {
  var s=read(d)
  guard validIssuedScope(scope,d),UUID(uuidString:id) != nil,let groupId=scope["groupId"] as? String,let revision=scope["groupRevision"] as? Int,let generation=scope["configurationGeneration"] as? Int,let epoch=scope["scopeEpoch"] as? Int,let encoded=scope["token"] as? String,let data=Data(base64Encoded:encoded),let token=try? JSONDecoder().decode(ApplicationToken.self,from:data),let g=s.groups.first(where:{$0.id==groupId && $0.revision==revision}),generation==s.generation,epoch==s.scopeEpoch,active(g,s,d),registrationReady(g,s,d),selection(g,d).applicationTokens.contains(token),(store(g).shield.applications ?? []).contains(token) else{return false}
  s.claim=FreedAppGroupClaim(interventionId:id,groupId:groupId,groupRevision:revision,target:encoded,generation:generation,scopeEpoch:epoch,claimedAt:scope["issuedAt"] as! Double,claimedUptime:scope["issuedUptime"] as! Double,bootIdentity:scope["bootIdentity"] as? String)
  do{try persist(s,d);return true}catch{return false}
  }) == true
 }
 private func expirySchedule(_ expiry:Double)->DeviceActivitySchedule {
  let c=Calendar.current,parts:Set<Calendar.Component>=[.year,.month,.day,.hour,.minute,.second,.timeZone],date=Date(timeIntervalSince1970:ceil(expiry))
  return .init(intervalStart:c.dateComponents(parts,from:date),intervalEnd:c.dateComponents(parts,from:date.addingTimeInterval(960)),repeats:false)
 }
 private func expiryReady(_ l:FreedAppGroupLease)->Bool {let n=breakName(l.claim.groupId,l.claim.groupRevision,l.claim.generation,l.claim.scopeEpoch,l.claim.interventionId);return centre.activities.contains(n) && centre.schedule(for:n)==expirySchedule(l.expiresAt)}
 func hasAuthority(_ id:String)->Bool {
  return (try? withBindingState {
   guard privateOwner else{return false}
   return (try? withPrivateConfigurationAccess{d in let s=read(d);guard ownerCurrent(s,d) else{return false};return s.claim?.interventionId==id || s.leases.values.contains(where:{$0.claim.interventionId==id}) || (try? readEarned(d).leases.values.contains(where:{$0.ownerDigest==s.ownerDigest && $0.native.claim.interventionId==id}))==true}) == true
  }) == true
 }
 func effectiveStatus(readOnly:Bool=false)->[String:Any]? {
  return (try? withPrivateConfigurationAccess(readOnly:readOnly){d -> [String:Any]? in var s=read(d)
   if !readOnly { try revokeInvalidBootAuthority(&s,d) };guard ownerCurrent(s,d) else{return nil}
   if let lease=s.leases.values.sorted(by:{$0.grantedAt>$1.grantedAt}).first,let g=s.groups.first(where:{$0.id==lease.claim.groupId}),let token=leaseTarget(g,s) {return breakPayload(lease,g,s,d,token)}
   guard let earned=try? readEarned(d),let lease=earned.leases.values.first(where:{lease in self.earnedLeaseActive(lease,s.groups.first{$0.id==lease.native.claim.groupId},s)}),let g=s.groups.first(where:{$0.id==lease.native.claim.groupId}),let token=earnedLeaseTarget(g,s,d) else{return nil}
   return breakPayload(lease.native,g,s,d,token)
  }) ?? nil
 }
 /// Only an explicit versioned Use app request can create a group break.
 func grantResetReward(_ input:[String:Any],_ scope:String)->[String:Any] {
  func rejected(_ reason:String)->[String:Any] { ["version":1,"policyVersion":1,"supported":true,"accepted":false,"reason":reason,"effective":false,"replayed":false] }
  guard let request=FreedResetAppGroupRewardRequest.parse(input,platform:"ios") else{return rejected("reset-reward-request-invalid")}
  var installed:DeviceActivityName?,oldState:FreedAppGroupsState?,candidate:FreedAppGroupsState?
  do {
   let result=try withPrivateConfigurationAccess(afterSuccessfulPersistence:{(_: [String:Any]) in
    guard let old=oldState,let next=candidate else{return}
    for g in old.groups where next.groups.first(where:{$0.id==g.id}).map({$0.bank != g.bank}) == true {self.store(g).clearAllSettings()}
   }){d -> [String:Any] in
    guard FreedProtectionConfigurationLock.permitsPublication(d),let s=FreedAppGroupsPolicy.decode(d.data(forKey:FreedAppGroupsPolicy.key)),self.selectionsValid(s),self.privateOwner,self.actionScope==scope,self.ownerCurrent(s,d),self.authorized(),let owner=s.ownerDigest,let boot=self.clock.bootIdentity() else{throw Failure.reason("reset-reward-owner-or-state-unavailable")}
    guard request.configurationGeneration==s.generation,request.scopeEpoch==s.scopeEpoch,let g=s.groups.first(where:{$0.id==request.groupId && $0.revision==request.groupRevision && !$0.legacy}),self.active(g,s,d),self.registrationReady(g,s,d),var ledger=FreedResetAppGroupRewardLedger.decode(d.data(forKey:FreedResetAppGroupRewardLedger.key)) else{throw Failure.reason("reset-reward-authority-stale")}
    let key=SHA256.hash(data:Data((owner+"\0"+request.completionSessionId).utf8)).map{String(format:"%02x",$0)}.joined()
    let now=self.clock.now().timeIntervalSince1970,uptime=self.clock.uptime()
    var lease:FreedAppGroupLease;var replayed=false
    if let consumed=ledger.records[key] {
     guard consumed.request==request,consumed.ownerDigest==owner,consumed.bootIdentity==boot,let current=s.leases[g.id],current.claim.interventionId==request.nativeInterventionId,current.expiresAt==consumed.expiresAt,self.expiryReady(current),FreedAppGroupsPolicy.leaseActive(current,group:g,generation:s.generation,scopeEpoch:s.scopeEpoch,now:now,uptime:uptime,bootIdentity:boot) else{throw Failure.reason("reset-reward-already-consumed")}
     lease=current;replayed=true
    }else{
     guard !self.hasActiveEarnedLease(s,d),ledger.records.count<FreedResetAppGroupRewardLedger.maximumRecords,!ledger.records.values.contains(where:{$0.ownerDigest==owner && $0.request.nativeInterventionId==request.nativeInterventionId}),!s.leases.values.contains(where:{l in s.groups.first(where:{$0.id==l.claim.groupId}).map{FreedAppGroupsPolicy.leaseActive(l,group:$0,generation:s.generation,scopeEpoch:s.scopeEpoch,now:now,uptime:uptime,bootIdentity:boot)} == true}),let claim=s.claim,claim.interventionId==request.nativeInterventionId,claim.groupId==g.id,let data=Data(base64Encoded:claim.target),let token=try? JSONDecoder().decode(ApplicationToken.self,from:data),(self.store(g).shield.applications ?? []).contains(token) else{throw Failure.reason("reset-reward-consumed-or-active-window")}
     let expiry=now+Double(request.seconds)
     guard FreedAppGroupsPolicy.authorize(claim,groupId:g.id,revision:g.revision,targetMember:self.selection(g,d).applicationTokens.contains(token),generation:s.generation,scopeEpoch:s.scopeEpoch,now:now,uptime:uptime,requestedExpiry:expiry,bootIdentity:boot)==expiry,FreedAppGroupsPolicy.canStage(existingActivities:self.centre.activities.count,newActivities:1) else{throw Failure.reason("reset-reward-authority-or-capacity")}
     lease=FreedAppGroupLease(claim:claim,requestedExpiry:expiry,expiresAt:expiry,grantedAt:now,grantedUptime:uptime,bootIdentity:boot)
     let activity=self.breakName(g.id,g.revision,s.generation,s.scopeEpoch,claim.interventionId)
     try self.centre.startMonitoring(activity,during:self.expirySchedule(expiry));installed=activity
     guard self.expiryReady(lease) else{throw Failure.reason("reset-reward-expiry-readback-failed")}
     guard self.actionScope==scope,self.ownerCurrent(s,d),FreedProtectionConfigurationLock.permitsPublication(d,capturedGeneration:s.generation) else{throw Failure.reason("reset-reward-owner-changed")}
     var next=s;next.leases[g.id]=lease;next.claim=nil;next.groups[next.groups.firstIndex(where:{$0.id==g.id})!].bank=1-g.bank;next.revision += 1
     ledger.records[key]=FreedResetAppGroupRewardConsumption(request:request,ownerDigest:owner,bootIdentity:boot,grantedAt:now,grantedUptime:uptime,expiresAt:expiry)
     d.set(try JSONEncoder().encode(ledger),forKey:FreedResetAppGroupRewardLedger.key)
     oldState=s;candidate=next;try self.transaction(s,next,d)
    }
    let state=candidate ?? s
    guard self.actionScope==scope,self.ownerCurrent(state,d),FreedProtectionConfigurationLock.permitsPublication(d,capturedGeneration:state.generation) else{throw Failure.reason("reset-reward-owner-changed")}
    guard let current=state.groups.first(where:{$0.id==g.id}),let token=self.leaseTarget(current,state) else{throw Failure.reason("reset-reward-native-readback-failed")}
    let remaining=self.restrictions(for:token,state:state,defaults:d,excluding:g.id)
    return ["version":1,"policyVersion":1,"supported":true,"accepted":true,"reason":NSNull(),"completionSessionId":request.completionSessionId,"nativeInterventionId":request.nativeInterventionId,"category":request.category,"seconds":request.seconds,"groupId":g.id,"groupRevision":g.revision,"configurationGeneration":s.generation,"scopeEpoch":s.scopeEpoch,"expiresAt":ISO8601DateFormatter().string(from:Date(timeIntervalSince1970:lease.expiresAt)),"effective":remaining==0,"remainingRestrictionCount":remaining,"replayed":replayed]
   }
   return result
  }catch{
   if let installed{centre.stopMonitoring([installed])}
   // The atomic file boundary restores both lease and consumption ledger; repair
   // only our staged bank and reconcile the previous shield after failed commit.
   if let old=oldState,let next=candidate {
    for g in next.groups where old.groups.first(where:{$0.id==g.id}).map({$0.bank != g.bank}) == true {store(g).clearAllSettings()}
    _=try? withPrivateConfigurationAccess{d in self.reconcile(old,d)}
   }
   return rejected(reason(error))
  }
 }
 // Compatibility readback only. This API can never create a group lease.
 func grant(id:String,expiry:Double)->[String:Any]? {
  return (try? withBindingState { () -> [String:Any]? in
  guard privateOwner,let scope=actionScope else{return nil}
  return (try? withPrivateConfigurationAccess{d -> [String:Any]? in
   guard let s=FreedAppGroupsPolicy.decode(d.data(forKey:FreedAppGroupsPolicy.key)),self.actionScope==scope,self.ownerCurrent(s,d),self.authorized(),FreedProtectionConfigurationLock.permitsPublication(d),let g=s.groups.first(where:{s.leases[$0.id]?.claim.interventionId==id}),let lease=s.leases[g.id],lease.requestedExpiry==expiry,self.expiryReady(lease),FreedAppGroupsPolicy.leaseActive(lease,group:g,generation:s.generation,scopeEpoch:s.scopeEpoch,now:self.clock.now().timeIntervalSince1970,uptime:self.clock.uptime(),bootIdentity:self.clock.bootIdentity()),let token=self.leaseTarget(g,s) else{return nil}
   return self.breakPayload(lease,g,s,d,token)
  }) ?? nil
  }) ?? nil
 }
 private func restrictions(for token:ApplicationToken,state:FreedAppGroupsState,defaults:UserDefaults,excluding:String?=nil)->Int {
  var count=state.groups.filter{$0.id != excluding && $0.rule.kind != "legacy" && active($0,state,defaults) && (store($0).shield.applications ?? []).contains(token)}.count
  let legacy=ManagedSettingsStore();if (legacy.shield.applications ?? []).contains(token) || legacy.shield.applicationCategories != nil{count += 1};return count
 }
 private func earnedKey(_ owner:String,_ group:String)->String {FreedEarnedAppTimePolicy.recordKey(owner,group)}
 private func readEarned(_ d:UserDefaults)throws->FreedEarnedAppTimeState {
  guard let value=FreedEarnedAppTimeState.decode(d.data(forKey:FreedEarnedAppTimePolicy.key)) else{throw Failure.reason("earned-time-state-unreadable")};return value
 }
 private func stageEarned(_ value:FreedEarnedAppTimeState,_ d:UserDefaults)throws {
  let data=try JSONEncoder().encode(value)
  guard FreedEarnedAppTimeState.decode(data) != nil else{throw Failure.reason("earned-time-state-invalid")}
  d.set(data,forKey:FreedEarnedAppTimePolicy.key)
 }
 private func persistEarned(_ value:FreedEarnedAppTimeState,_ d:UserDefaults)throws {
  try stageEarned(value,d)
  guard FreedProtectionConfigurationLock.persist(d) else{throw Failure.reason("earned-time-persistence-failed")}
 }
 private func earnedBudget(_ earned:inout FreedEarnedAppTimeState,_ s:FreedAppGroupsState,_ g:FreedAppGroupDefinition)throws->FreedEarnedAppTimeBudget {
  guard let owner=s.ownerDigest else{throw Failure.reason("earned-time-owner-unavailable")}
  let key=earnedKey(owner,g.id)
  let bootstrap=earned.budgets[key]==nil
  let now=clock.now(),uptime=clock.uptime(),boot=clock.readBoot()
  do {
   if bootstrap {
    guard earned.budgets.count<FreedEarnedAppTimePolicy.maximumRecords else{throw Failure.reason("earned-time-ledger-capacity")}
    earned.budgets[key]=try .make(owner:owner,group:g.id,now:now,uptime:uptime,boot:boot.identity)
   }
   var budget=earned.budgets[key]!
   guard budget.ownerDigest==owner,budget.groupId==g.id,budget.valid else{throw Failure.reason("earned-time-budget-invalid")}
   _=try budget.advance(now:now,uptime:uptime,boot:boot.identity);earned.budgets[key]=budget
   return budget
  }catch FreedEarnedAppTimePolicy.Failure.clockUnavailable {
   var facts=boot.diagnostics
   facts["clockBudgetPhase"]=bootstrap ? "bootstrap":"rollover"
   let wallValid=now.timeIntervalSince1970.isFinite && now.timeIntervalSince1970>0
   facts["clockWallValid"]=wallValid;facts["clockUptimeValid"]=uptime.isFinite && uptime>=0
   var calendar=Calendar(identifier:.gregorian)
   if let budget=earned.budgets[key],let zone=TimeZone(identifier:budget.timeZoneIdentifier){calendar.timeZone=zone}
   let budgetDate=earned.budgets[key].map{Date(timeIntervalSince1970:$0.anchorWall+$0.trustedWallOffset+(uptime-$0.anchorUptime))} ?? now
   let validDate=budgetDate.timeIntervalSince1970.isFinite && budgetDate.timeIntervalSince1970>0
   let reset=validDate ? calendar.date(byAdding:.day,value:1,to:calendar.startOfDay(for:budgetDate)):nil
   facts["clockCalendarValid"]=reset.map{bootstrap || $0.timeIntervalSince1970>(earned.budgets[key]?.nextResetAt ?? .infinity)} ?? false
   throw FreedAppGroupsClock.ValidationFailure(underlying:FreedEarnedAppTimePolicy.Failure.clockUnavailable,diagnostics:facts)
  }
 }
 private func refreshEarnedBudgets(_ s:FreedAppGroupsState,_ d:UserDefaults)throws {
  var earned=try readEarned(d);let old=earned
  for g in s.groups where g.rule.kind != "legacy" {_=try earnedBudget(&earned,s,g)}
  if earned != old {try persistEarned(earned,d)}
 }
 private func earnedName(_ lease:FreedEarnedAppTimeLease)->DeviceActivityName {
  let c=lease.native.claim
  return .init("freed.group.\(c.groupId).g\(c.generation).r\(c.groupRevision).e\(c.scopeEpoch).o\(lease.offerId).earned-v2")
 }
 private func earnedExpiryReady(_ lease:FreedEarnedAppTimeLease)->Bool {let n=earnedName(lease);return centre.activities.contains(n) && centre.schedule(for:n)==expirySchedule(lease.native.expiresAt)}
 private func earnedLeaseActive(_ lease:FreedEarnedAppTimeLease,_ group:FreedAppGroupDefinition?,_ s:FreedAppGroupsState)->Bool {
  guard let group,lease.ownerDigest==s.ownerDigest,FreedAppGroupsPolicy.supportedBreakSeconds.contains(lease.seconds),lease.native.expiresAt-lease.native.grantedAt==Double(lease.seconds) else{return false}
  return FreedAppGroupsPolicy.leaseActive(lease.native,group:group,generation:s.generation,scopeEpoch:s.scopeEpoch,now:clock.now().timeIntervalSince1970,uptime:clock.uptime(),bootIdentity:clock.bootIdentity())
 }
 private func earnedLeaseTarget(_ g:FreedAppGroupDefinition,_ s:FreedAppGroupsState,_ d:UserDefaults)->ApplicationToken? {
  guard let owner=s.ownerDigest,let earned=try? readEarned(d),let lease=earned.leases[earnedKey(owner,g.id)],earnedLeaseActive(lease,g,s),earnedExpiryReady(lease),let data=Data(base64Encoded:lease.native.claim.target) else{return nil}
  return try? JSONDecoder().decode(ApplicationToken.self,from:data)
 }
 private func hasActiveEarnedLease(_ s:FreedAppGroupsState,_ d:UserDefaults)->Bool {
  guard let earned=try? readEarned(d) else{return true}
  return earned.leases.values.contains{lease in earnedLeaseActive(lease,s.groups.first{$0.id==lease.native.claim.groupId},s)}
 }
 func hasActiveEarnedTimeBreak(_ d:UserDefaults)->Bool {hasActiveEarnedLease(read(d),d)}
 private func legacyEarnedWindowPresent(_ d:UserDefaults)->Bool {
  guard let value=d.string(forKey:"freed.earnedUnlock.expiresAt") else{return false}
  let parser=ISO8601DateFormatter();parser.formatOptions=[.withInternetDateTime,.withFractionalSeconds]
  guard let expiry=parser.date(from:value) ?? ISO8601DateFormatter().date(from:value) else{return true}
  return expiry>clock.now()
 }
 private func earnedOwnerState(_ scope:String,_ d:UserDefaults)throws->FreedAppGroupsState {
  return try withBindingState {
  guard privateOwner,actionScope==scope,authorized(),FreedProtectionConfigurationLock.permitsPublication(d),let s=FreedAppGroupsPolicy.decode(d.data(forKey:FreedAppGroupsPolicy.key)),selectionsValid(s),ownerCurrent(s,d),clock.bootIdentity() != nil else{throw Failure.reason("earned-time-owner-or-state-unavailable")}
  return s
  }
 }
 private func earnedClaimValid(_ claim:FreedAppGroupClaim,_ g:FreedAppGroupDefinition,_ s:FreedAppGroupsState,_ d:UserDefaults)->Bool {
  let now=clock.now().timeIntervalSince1970,uptime=clock.uptime()
  guard let data=Data(base64Encoded:claim.target),let token=try? JSONDecoder().decode(ApplicationToken.self,from:data),selection(g,d).applicationTokens.contains(token),FreedAppGroupsPolicy.authorize(claim,groupId:g.id,revision:g.revision,targetMember:true,generation:s.generation,scopeEpoch:s.scopeEpoch,now:now,uptime:uptime,requestedExpiry:now+300,bootIdentity:clock.bootIdentity()) != nil,abs((now-claim.claimedAt)-(uptime-claim.claimedUptime))<=5 else{return false}
  return active(g,s,d) && registrationReady(g,s,d) && (store(g).shield.applications ?? []).contains(token)
 }
 func prepareEarnedAppTimeOffer(_ input:[String:Any],_ scope:String)->[String:Any] {
  var budgetPayload:[String:Any]?
  func rejected(_ code:String)->[String:Any] {["version":2,"policyVersion":2,"supported":true,"accepted":false,"reason":code,"offer":NSNull(),"budget":budgetPayload.map{$0 as Any} ?? NSNull()]}
  guard let request=FreedEarnedAppTimeOfferRequest.parse(input) else{return rejected("earned-time-offer-request-invalid")}
  do{return try withPrivateConfigurationAccess{d in
   let s=try earnedOwnerState(scope,d);var earned=try readEarned(d)
   guard let owner=s.ownerDigest,let g=s.groups.first(where:{$0.id==request.groupId && $0.revision==request.groupRevision && $0.rule.kind != "legacy"}),request.configurationGeneration==s.generation,request.scopeEpoch==s.scopeEpoch else{throw Failure.reason("earned-time-authority-stale")}
   let budget=try earnedBudget(&earned,s,g);budgetPayload=budget.payload(now:clock.now(),uptime:clock.uptime(),boot:clock.bootIdentity())
   guard budget.clockVerified(now:clock.now(),uptime:clock.uptime(),boot:clock.bootIdentity()) else{throw Failure.reason("earned-time-clock-unverified")}
   guard budget.remainingSeconds>=request.requestedSeconds else{throw Failure.reason("earned-time-cap-exhausted")}
   guard !legacyEarnedWindowPresent(d),!hasActiveEarnedLease(s,d),!s.leases.values.contains(where:{l in s.groups.first(where:{$0.id==l.claim.groupId}).map{FreedAppGroupsPolicy.leaseActive(l,group:$0,generation:s.generation,scopeEpoch:s.scopeEpoch,now:clock.now().timeIntervalSince1970,uptime:clock.uptime(),bootIdentity:clock.bootIdentity())} == true}),let claim=s.claim,claim.interventionId==request.nativeInterventionId,earnedClaimValid(claim,g,s,d),let data=Data(base64Encoded:claim.target),let token=try? JSONDecoder().decode(ApplicationToken.self,from:data) else{throw Failure.reason("earned-time-authority-stale-or-active-window")}
   guard restrictions(for:token,state:s,defaults:d,excluding:g.id)==0 else{throw Failure.reason("earned-time-overlapping-restriction")}
   let existing=earned.offers.values.first{!$0.superseded && $0.ownerDigest==owner && $0.request==request && $0.claim==claim && $0.budgetDay==budget.dayKey && $0.budgetRevision==budget.revision}
   let offer:FreedEarnedAppTimeOffer
   if let existing {offer=existing}
   else {
    guard earned.offers.count<FreedEarnedAppTimePolicy.maximumRecords else{throw Failure.reason("earned-time-ledger-capacity")}
    for (id,value) in earned.offers where value.ownerDigest==owner && value.claim.interventionId==claim.interventionId && !value.superseded {earned.offers[id]?.superseded=true}
    var methods=["timer"]
    if challengeSteps.available {methods.append("steps")}
    let targets=FreedChallengePhotoCatalog.nativeSupportedTargetIds
    let hasPhotos=request.requestedSeconds==300 ? !targets.isEmpty:targets.contains{a in targets.contains{b in a<b && FreedChallengePhotoCatalog.templateTargets("momentum-find-\(a)-\(b):earned-v2:\(request.requestedSeconds)",seconds:request.requestedSeconds) != nil}}
    if hasPhotos {methods.append("photo")}
    offer=FreedEarnedAppTimeOffer(id:UUID().uuidString.lowercased(),ownerDigest:owner,request:request,claim:claim,budgetDay:budget.dayKey,budgetRevision:budget.revision,validUntil:claim.claimedAt+1200,availableMethods:methods,supportedPhotoTargetIds:targets)
    earned.offers[offer.id]=offer
   }
   try persistEarned(earned,d)
   return["version":2,"policyVersion":2,"supported":true,"accepted":true,"reason":NSNull(),"offer":offer.payload,"budget":budgetPayload!]
  }}catch{return rejected(reason(error))}
 }
 private struct ChallengeContext {let state:FreedAppGroupsState,offer:FreedEarnedAppTimeOffer;var earned:FreedEarnedAppTimeState,session:FreedChallengeEvidenceSession}
 private func challengeOffer(_ id:String,_ scope:String,_ d:UserDefaults,_ earned:inout FreedEarnedAppTimeState)throws->(FreedAppGroupsState,FreedEarnedAppTimeOffer) {
  let s=try earnedOwnerState(scope,d)
  guard let offer=earned.offers[id],!offer.superseded,offer.ownerDigest==s.ownerDigest,offer.claim==s.claim,offer.request.configurationGeneration==s.generation,offer.request.scopeEpoch==s.scopeEpoch,clock.now().timeIntervalSince1970<offer.validUntil,let g=s.groups.first(where:{$0.id==offer.request.groupId && $0.revision==offer.request.groupRevision}),earnedClaimValid(offer.claim,g,s,d) else{throw Failure.reason("challenge-evidence-authority-stale")}
  let budget=try earnedBudget(&earned,s,g)
  guard budget.clockVerified(now:clock.now(),uptime:clock.uptime(),boot:clock.bootIdentity()),budget.dayKey==offer.budgetDay,budget.revision==offer.budgetRevision,budget.remainingSeconds>=offer.request.requestedSeconds else{throw Failure.reason("challenge-evidence-budget-stale")}
  return(s,offer)
 }
 private func challengeContext(_ id:String,_ scope:String,_ d:UserDefaults)throws->ChallengeContext {
  var earned=try readEarned(d)
  guard let session=earned.challengeSessions?[id] else{throw Failure.reason("challenge-evidence-session-missing")}
  let (s,offer)=try challengeOffer(session.request.offerId,scope,d,&earned)
  guard FreedChallengeEvidenceBinding.make(offer)==session.binding else{throw Failure.reason("challenge-evidence-authority-stale")}
  return ChallengeContext(state:s,offer:offer,earned:earned,session:session)
 }
 private func startChallengeObservation(_ session:FreedChallengeEvidenceSession,_ scope:String) {
  _ = try? withBindingState {
  guard session.request.method=="steps",session.phase=="active",let segment=session.segmentId,let start=session.segmentStartedAt else{stopChallengeObservation();return}
  let process=challengeProcessId
  challengeObservationIdentity=(session.id,segment,process)
  challengeSteps.start(from:Date(timeIntervalSince1970:start)){[weak self] sample,failure in
   // UI/module operations and OS observation publication share the main queue;
   // the protected-file transaction supplies cross-process exclusion.
   DispatchQueue.main.async{[weak self] in
    guard let self else{return}
    do{try withPrivateConfigurationAccess{d in
     var c=try self.challengeContext(session.id,scope,d)
     guard c.session.phase=="active",c.session.processId==process,c.session.segmentId==segment else{return}
     if let failure {guard let cancelled=c.earned.revokeChallengeEvidence(session.id,failureReason:failure) else{return};c.session=cancelled}
     else if let sample {let previous=c.session;guard c.session.observe(segmentId:segment,processId:process,count:sample.count,start:sample.start,end:sample.end,now:self.clock.now().timeIntervalSince1970) else{return};if previous==c.session{return}}
     else{return}
     c.earned.challengeSessions?[session.id]=c.session;try self.persistEarned(c.earned,d)
     if failure != nil {self.stopChallengeObservation()}
    }}catch {
     _ = try? self.withBindingState {
      if let current=self.challengeObservationIdentity,current.sessionId==session.id,current.segmentId==segment,current.processId==process {self.stopChallengeObservation(invalidateProcess:true)}
     }
    }
   }
  }
  }
 }
 func beginEarnedChallengeEvidence(_ input:[String:Any],_ scope:String)->[String:Any] {
  guard let request=FreedChallengeEvidenceBegin.parse(input) else{return FreedChallengeEvidenceReceipt.make(reason:"challenge-evidence-request-invalid")}
  var toObserve:FreedChallengeEvidenceSession?
  do{return try withPrivateConfigurationAccess(afterSuccessfulPersistence:{(_: [String:Any]) in if let toObserve{self.startChallengeObservation(toObserve,scope)}}){d in
   var earned=try readEarned(d);let (_,offer)=try challengeOffer(request.offerId,scope,d,&earned)
   guard offer.availableMethods.contains(request.method),let binding=FreedChallengeEvidenceBinding.make(offer) else{throw Failure.reason(request.method=="steps" ? "steps-verification-unavailable":"photo-verification-unavailable")}
   let targets:[String]
   if request.method=="steps" {guard challengeSteps.available,request.templateId=="momentum-move-steps:earned-v2:\(offer.request.requestedSeconds)" else{throw Failure.reason("steps-verification-unavailable")};targets=[]}
   else {guard let declared=FreedChallengePhotoCatalog.templateTargets(request.templateId,seconds:offer.request.requestedSeconds),declared.allSatisfy({FreedChallengePhotoCatalog.nativeSupportedTargetIds.contains($0) && offer.supportedPhotoTargetIds?.contains($0)==true}) else{throw Failure.reason("photo-verification-unavailable")};targets=declared}
   if let existing=(earned.challengeSessions ?? [:]).values.first(where:{$0.request==request && $0.binding==binding && $0.phase != "cancelled" && ($0.phase=="completed" || $0.processId==challengeProcessId)}) {return FreedChallengeEvidenceReceipt.make(existing,reason:existing.failureReason)}
   guard !(earned.challengeSessions ?? [:]).values.contains(where:{$0.binding.ownerDigest==binding.ownerDigest && $0.request.completionSessionId==request.completionSessionId && $0.phase != "cancelled" && $0.request != request}) else{throw Failure.reason("challenge-evidence-template-replacement-requires-cancel")}
   guard (earned.challengeSessions?.count ?? 0)<FreedEarnedAppTimePolicy.maximumRecords,!earned.consumptions.values.contains(where:{$0.lease.ownerDigest==binding.ownerDigest && $0.request.completionSessionId==request.completionSessionId}) else{throw Failure.reason("challenge-evidence-capacity-or-consumed")}
   // Replacement retains guided access but never transfers old sensor authority.
   for (id,old) in earned.challengeSessions ?? [:] where old.binding.ownerDigest==binding.ownerDigest && ["active","paused"].contains(old.phase) {guard earned.revokeChallengeEvidence(id) != nil else{throw Failure.reason("challenge-evidence-session-not-live")}}
   var session=FreedChallengeEvidenceSession.make(request,binding:binding,processId:challengeProcessId,now:clock.now().timeIntervalSince1970,supportedTargetIds:targets)
   if request.method=="steps" {session.startSegment(now:clock.now().timeIntervalSince1970)}
   if earned.challengeSessions==nil{earned.challengeSessions=[:]};earned.challengeSessions?[session.id]=session;try persistEarned(earned,d);toObserve=session
   return FreedChallengeEvidenceReceipt.make(session)
  }}catch{return FreedChallengeEvidenceReceipt.make(reason:reason(error))}
 }
 func setEarnedChallengeEvidencePhase(_ input:[String:Any],_ scope:String)->[String:Any] {
  guard let id=FreedChallengeEvidenceReceipt.sessionId(input,phase:true),let phase=input["phase"] as? String else{return FreedChallengeEvidenceReceipt.make(reason:"challenge-evidence-request-invalid")}
  var observe:FreedChallengeEvidenceSession?
  do{return try withPrivateConfigurationAccess(afterSuccessfulPersistence:{(_: [String:Any]) in if self.challengeObservationIdentity?.sessionId==id {self.stopChallengeObservation()};if let observe{self.startChallengeObservation(observe,scope)}}){d in
   // Revocation does not need live grant authority: the current verified same
   // owner can cancel an unconsumed stale/expired record to replace the activity.
   if phase=="cancelled" {
    let s=try earnedOwnerState(scope,d);var earned=try readEarned(d)
    guard earned.challengeSessions?[id]?.binding.ownerDigest==s.ownerDigest,let session=earned.revokeChallengeEvidence(id) else{throw Failure.reason("challenge-evidence-session-not-live")}
    try persistEarned(earned,d)
    return FreedChallengeEvidenceReceipt.make(session)
   }
   var c=try challengeContext(id,scope,d)
   guard c.session.processId==challengeProcessId,c.session.phase != "completed",c.session.phase != "cancelled" else{throw Failure.reason("challenge-evidence-session-not-live")}
   if c.session.phase != phase {c.session.phase=phase;c.session.stopSegment();if phase=="active" && c.session.request.method=="steps" {guard challengeSteps.available else{throw Failure.reason("steps-permission-denied")};c.session.startSegment(now:clock.now().timeIntervalSince1970)}}
   c.earned.challengeSessions?[id]=c.session;try persistEarned(c.earned,d)
   if phase=="active" {observe=c.session};return FreedChallengeEvidenceReceipt.make(c.session)
  }}catch{return FreedChallengeEvidenceReceipt.make(reason:reason(error))}
 }
 func getEarnedChallengeEvidence(_ input:[String:Any],_ scope:String)->[String:Any] {
  guard let id=FreedChallengeEvidenceReceipt.sessionId(input) else{return FreedChallengeEvidenceReceipt.make(reason:"challenge-evidence-request-invalid")}
  do{return try withPrivateConfigurationAccess{d in let c=try challengeContext(id,scope,d);guard c.session.phase=="completed" || c.session.processId==challengeProcessId else{throw Failure.reason("challenge-evidence-restart-required")};return FreedChallengeEvidenceReceipt.make(c.session,reason:c.session.failureReason)}}catch{return FreedChallengeEvidenceReceipt.make(reason:reason(error))}
 }
 func finishEarnedChallengeEvidence(_ input:[String:Any],_ scope:String)->[String:Any] {
  guard let id=FreedChallengeEvidenceReceipt.sessionId(input) else{return FreedChallengeEvidenceReceipt.make(reason:"challenge-evidence-request-invalid")}
  do{return try withPrivateConfigurationAccess(afterSuccessfulPersistence:{(_: [String:Any]) in if self.challengeObservationIdentity?.sessionId==id {self.stopChallengeObservation()}}){d in
   var c=try challengeContext(id,scope,d)
   if c.session.phase=="completed" {return FreedChallengeEvidenceReceipt.make(c.session)}
   guard c.session.phase=="active",c.session.processId==challengeProcessId else{throw Failure.reason("challenge-evidence-session-not-live")}
   if c.session.request.method=="steps" {
    guard c.session.observedSteps>=c.session.requiredSteps,(c.earned.challengeProofs?.count ?? 0)<FreedEarnedAppTimePolicy.maximumRecords else{throw Failure.reason("challenge-evidence-incomplete")}
    let proof=FreedChallengeEvidenceProof.steps(c.session,now:clock.now().timeIntervalSince1970)
    if c.earned.challengeProofs==nil{c.earned.challengeProofs=[:]};c.earned.challengeProofs?[proof.id]=proof;c.session.stepProofId=proof.id
   }else {guard c.session.matchedTargetIds.count==c.session.requiredPhotoTargets,c.session.photoProofIds.count==c.session.requiredPhotoTargets else{throw Failure.reason("challenge-evidence-incomplete")}}
   c.session.phase="completed";c.session.stopSegment();c.earned.challengeSessions?[id]=c.session;try persistEarned(c.earned,d);return FreedChallengeEvidenceReceipt.make(c.session)
  }}catch{return FreedChallengeEvidenceReceipt.make(reason:reason(error))}
 }
 func prepareEarnedChallengePhotoCapture(_ input:[String:Any],_ scope:String)->[String:Any] {
  guard Set(input.keys)==Set(["version","evidenceSessionId","targetId","captureOperationId"]),FreedEarnedAppTimePolicy.integer(input,"version")==1,let id=input["evidenceSessionId"] as? String,FreedEarnedAppTimePolicy.uuid(id),let target=input["targetId"] as? String,FreedChallengePhotoCatalog.targetIds.contains(target),let operation=input["captureOperationId"] as? String,FreedEarnedAppTimePolicy.identifier(operation) else{return FreedChallengeEvidenceReceipt.photo(reason:"challenge-evidence-request-invalid")}
  do{return try withPrivateConfigurationAccess{d in let c=try challengeContext(id,scope,d);guard c.session.request.method=="photo",c.session.phase=="active",c.session.processId==challengeProcessId,c.session.supportedTargetIds.contains(target),FreedChallengePhotoCatalog.nativeSupportedTargetIds.contains(target),!c.session.matchedTargetIds.contains(target) else{throw Failure.reason("photo-verification-unavailable")};return FreedChallengeEvidenceReceipt.photo(c.session,result:"unavailable",targetId:target)}}catch{return FreedChallengeEvidenceReceipt.photo(reason:reason(error))}
 }
 // Public URI input can clean a known owned temporary file, never attest that
 // the camera captured it. Only the internal native capture object can prove it.
 func verifyEarnedChallengePhoto(_ input:[String:Any],_ scope:String)->[String:Any] {
  if let uri=input["uri"] as? String,!FreedChallengeOwnedCaptureFiles.removeCompatibilityCapture(uri) {return FreedChallengeEvidenceReceipt.photo(reason:"photo-capture-cleanup-failed")}
  return FreedChallengeEvidenceReceipt.photo(reason:"native-capture-required")
 }
 func completeEarnedChallengePhoto(_ input:[String:Any],_ scope:String,capture:FreedNativeChallengePhoto,classification:[String:Any])->[String:Any] {
  guard let id=input["evidenceSessionId"] as? String,let target=input["targetId"] as? String,let operation=input["captureOperationId"] as? String else{return FreedChallengeEvidenceReceipt.photo(reason:"challenge-evidence-request-invalid")}
  do{return try withPrivateConfigurationAccess{d in
   var c=try challengeContext(id,scope,d)
   guard c.session.request.method=="photo",c.session.phase=="active",c.session.processId==challengeProcessId,c.session.supportedTargetIds.contains(target),capture.operationId==operation,capture.capturedAt>=c.session.startedAt,capture.capturedAt<=clock.now().timeIntervalSince1970+5 else{throw Failure.reason("photo-capture-stale")}
   guard let identity=classification["identity"] as? [String:Any],FreedChallengePhotoCatalog.reviewedTargetIds(identity:identity).contains(target) else{throw Failure.reason("photo-verification-unavailable")}
   guard classification["outcome"] as? String=="matched" else{return FreedChallengeEvidenceReceipt.photo(c.session,reason:"photo-target-uncertain",result:classification["outcome"] as? String=="cancelled" ? "cancelled":"uncertain",targetId:target)}
   let labels=classification["matchedLabels"] as? [String] ?? []
   guard labels.contains(where:{FreedChallengePhotoCatalog.labels[target]?.contains($0)==true}),!c.session.matchedTargetIds.contains(target),(c.earned.challengeProofs?.count ?? 0)<FreedEarnedAppTimePolicy.maximumRecords,!(c.earned.challengeProofs ?? [:]).values.contains(where:{$0.captureOperationId==operation || $0.captureDigest==capture.digest}) else{throw Failure.reason("photo-capture-duplicate-or-invalid")}
   let revision=["provider","classifierRevision","runtimeRevision","ruleRevision"].compactMap{identity[$0] as? String}.joined(separator:"|")
   let proof=FreedChallengeEvidenceProof.photo(c.session,targetId:target,operationId:operation,digest:capture.digest,providerRevision:revision,now:clock.now().timeIntervalSince1970)
   if c.earned.challengeProofs==nil{c.earned.challengeProofs=[:]};c.earned.challengeProofs?[proof.id]=proof;c.session.matchedTargetIds.append(target);c.session.photoProofIds.append(proof.id);c.earned.challengeSessions?[id]=c.session;try persistEarned(c.earned,d)
   return FreedChallengeEvidenceReceipt.photo(c.session,result:"matched",targetId:target,proofId:proof.id)
  }}catch{return FreedChallengeEvidenceReceipt.photo(reason:reason(error))}
 }

 private struct EarnedClockRepairContext {
  let owner:String,groupId:String,groupRevision:Int,generation:Int,scopeEpoch:Int,budget:FreedEarnedAppTimeBudget,claim:FreedAppGroupClaim
 }
 // The sync core stays network-free for native policy callers/tests. The app
 // bridge takes this bounded repair path when the saved clock needs evidence.
 @MainActor func prepareEarnedAppTimeOfferWithClockRepair(_ input:[String:Any],_ scope:String,transport:@escaping FreedEarnedAppTimeTrustedClock.Transport=FreedEarnedAppTimeTrustedClock.live)async->[String:Any] {
  let initial=prepareEarnedAppTimeOffer(input,scope)
  guard initial["reason"] as? String=="earned-time-clock-unverified",let request=FreedEarnedAppTimeOfferRequest.parse(input) else{return initial}
  func rejected(_ code:String)->[String:Any] {["version":2,"policyVersion":2,"supported":true,"accepted":false,"reason":code,"offer":NSNull(),"budget":NSNull()]}
  do {
   let captured=try withPrivateConfigurationAccess{d -> EarnedClockRepairContext in
    let s=try earnedOwnerState(scope,d),earned=try readEarned(d)
    guard let owner=s.ownerDigest,let g=s.groups.first(where:{$0.id==request.groupId && $0.revision==request.groupRevision}),g.rule.kind != "legacy",request.configurationGeneration==s.generation,request.scopeEpoch==s.scopeEpoch,let claim=s.claim,claim.interventionId==request.nativeInterventionId,earnedClaimValid(claim,g,s,d),let budget=earned.budgets[earnedKey(owner,g.id)] else{throw Failure.reason("earned-time-authority-stale")}
    return EarnedClockRepairContext(owner:owner,groupId:g.id,groupRevision:g.revision,generation:s.generation,scopeEpoch:s.scopeEpoch,budget:budget,claim:claim)
   }
   let proof=try await FreedEarnedAppTimeTrustedClock.fetch(clock:clock,transport:transport)
   try withPrivateConfigurationAccess{d in
    let s=try earnedOwnerState(scope,d);var earned=try readEarned(d)
    let key=earnedKey(captured.owner,captured.groupId)
    guard s.ownerDigest==captured.owner,s.generation==captured.generation,s.scopeEpoch==captured.scopeEpoch,s.claim==captured.claim,let g=s.groups.first(where:{$0.id==captured.groupId && $0.revision==captured.groupRevision}),earnedClaimValid(captured.claim,g,s,d),earned.budgets[key]==captured.budget else{throw Failure.reason("earned-time-clock-repair-stale")}
    var budget=captured.budget
    try budget.repairClock(proof,now:clock.now(),uptime:clock.uptime(),boot:clock.bootIdentity())
    earned.budgets[key]=budget;try persistEarned(earned,d)
   }
   return prepareEarnedAppTimeOffer(input,scope)
  }catch {
   if let failure=error as? FreedEarnedAppTimeTrustedClock.Failure {
    switch failure {case .clockDrift:return rejected("earned-time-device-clock-drift");case .timeout:return rejected("earned-time-clock-timeout");case .invalidResponse,.staleResponse:return rejected("earned-time-clock-response-invalid");case .unavailable:return rejected("earned-time-clock-unavailable")}
   }
   if error is URLError {return rejected("earned-time-clock-unavailable")}
   return rejected(reason(error))
  }
 }
 private func earnedGrantPayload(_ consumed:FreedEarnedAppTimeConsumption,_ g:FreedAppGroupDefinition,_ s:FreedAppGroupsState,_ d:UserDefaults,_ replayed:Bool)->[String:Any] {
  let lease=consumed.lease,token=Data(base64Encoded:lease.native.claim.target).flatMap{try? JSONDecoder().decode(ApplicationToken.self,from:$0)},remaining=token.map{restrictions(for:$0,state:s,defaults:d,excluding:g.id)}
  let effective=token.map{remaining==0 && !(store(g).shield.applications ?? []).contains($0)} ?? false
  return["version":2,"policyVersion":2,"supported":true,"accepted":true,"reason":NSNull(),"offerId":lease.offerId,"completionSessionId":consumed.request.completionSessionId,"groupId":g.id,"nativeInterventionId":lease.native.claim.interventionId,"seconds":lease.seconds,"expiresAt":FreedEarnedAppTimePolicy.iso(lease.native.expiresAt),"effective":effective,"remainingRestrictionCount":remaining.map{$0 as Any} ?? NSNull(),"replayed":replayed,"budget":consumed.budgetAtGrant.payload(now:Date(timeIntervalSince1970:lease.native.grantedAt),uptime:lease.native.grantedUptime,boot:lease.native.bootIdentity)]
 }
 func getEarnedAppTimeGrant(_ input:[String:Any],_ scope:String)->[String:Any] {grantEarnedAppTimeBreak(input,scope,replayOnly:true)}
 func grantEarnedAppTimeBreak(_ input:[String:Any],_ scope:String,replayOnly:Bool=false)->[String:Any] {
  var installed:DeviceActivityName?,oldState:FreedAppGroupsState?,candidate:FreedAppGroupsState?,budgetPayload:[String:Any]?
  func rejected(_ code:String)->[String:Any] {["version":2,"policyVersion":2,"supported":true,"accepted":false,"reason":code,"offerId":NSNull(),"completionSessionId":NSNull(),"groupId":NSNull(),"nativeInterventionId":NSNull(),"seconds":NSNull(),"expiresAt":NSNull(),"effective":false,"remainingRestrictionCount":NSNull(),"replayed":false,"budget":budgetPayload.map{$0 as Any} ?? NSNull()]}
  guard let request=FreedEarnedAppTimeGrantRequest.parse(input) else{return rejected("earned-time-grant-request-invalid")}
  guard (try? withBindingState { privateOwner && actionScope==scope }) == true else{return rejected("earned-time-owner-or-state-unavailable")}
  do{return try withPrivateConfigurationAccess(afterSuccessfulPersistence:{(_: [String:Any]) in
   guard let old=oldState,let next=candidate else{return}
   for g in old.groups where next.groups.first(where:{$0.id==g.id}).map({$0.bank != g.bank})==true {self.store(g).clearAllSettings()}
  }){d in
   let s=try earnedOwnerState(scope,d);var earned=try readEarned(d)
   guard let owner=s.ownerDigest,let boot=clock.bootIdentity() else{throw Failure.reason("earned-time-owner-or-state-unavailable")}
   let consumedKey=earnedKey(owner,request.completionSessionId)
   if let consumed=earned.consumptions[consumedKey] {
    let lease=consumed.lease
    if replayOnly {
     guard consumed.request==request else{throw Failure.reason("earned-time-grant-stale")}
     if clock.now().timeIntervalSince1970>=lease.native.expiresAt || lease.native.bootIdentity==clock.bootIdentity() && clock.uptime()-lease.native.grantedUptime>=Double(lease.seconds) {throw Failure.reason("earned-time-grant-expired")}
     guard lease.ownerDigest==owner,earned.leases[earnedKey(owner,lease.native.claim.groupId)]==lease,let g=s.groups.first(where:{$0.id==lease.native.claim.groupId}),earnedLeaseActive(lease,g,s),earnedExpiryReady(lease) else{throw Failure.reason("earned-time-grant-stale")}
     return earnedGrantPayload(consumed,g,s,d,true)
    }
    guard consumed.request==request,lease.ownerDigest==owner,earned.leases[earnedKey(owner,lease.native.claim.groupId)]==lease,let g=s.groups.first(where:{$0.id==lease.native.claim.groupId}),earnedLeaseActive(lease,g,s),earnedExpiryReady(lease) else{throw Failure.reason("earned-time-already-consumed")}
    return earnedGrantPayload(consumed,g,s,d,true)
   }
   if replayOnly {
    if let offer=earned.offers[request.offerId],offer.ownerDigest != owner {throw Failure.reason("earned-time-owner-or-state-unavailable")}
    if earned.consumptions.values.contains(where:{$0.lease.offerId==request.offerId}) {throw Failure.reason("earned-time-grant-stale")}
    throw Failure.reason("earned-time-grant-not-found")
   }
   guard let offer=earned.offers[request.offerId],!offer.superseded,offer.ownerDigest==owner,offer.request.configurationGeneration==s.generation,offer.request.scopeEpoch==s.scopeEpoch,offer.claim==s.claim,let g=s.groups.first(where:{$0.id==offer.request.groupId && $0.revision==offer.request.groupRevision && $0.rule.kind != "legacy"}),earnedClaimValid(offer.claim,g,s,d) else{throw Failure.reason("earned-time-offer-stale")}
   if let failure=request.evidenceFailure(seconds:offer.request.requestedSeconds){throw Failure.reason(failure)}
   if let failure=earned.challengeEvidenceFailure(request,offer:offer){throw Failure.reason(failure)}
   guard offer.availableMethods.contains(request.evidence.method) else{throw Failure.reason("earned-time-method-unavailable")}
   var budget=try earnedBudget(&earned,s,g);budgetPayload=budget.payload(now:clock.now(),uptime:clock.uptime(),boot:boot)
   guard budget.clockVerified(now:clock.now(),uptime:clock.uptime(),boot:boot) else{throw Failure.reason("earned-time-clock-unverified")}
   guard offer.budgetDay==budget.dayKey,offer.budgetRevision==budget.revision else{throw Failure.reason("earned-time-budget-stale")}
   guard budget.remainingSeconds>=offer.request.requestedSeconds else{throw Failure.reason("earned-time-cap-exhausted")}
   guard !legacyEarnedWindowPresent(d),earned.consumptions.count<FreedEarnedAppTimePolicy.maximumRecords,!earned.consumptions.values.contains(where:{$0.lease.offerId==offer.id || $0.lease.ownerDigest==owner && $0.lease.native.claim.interventionId==offer.claim.interventionId}),!hasActiveEarnedLease(s,d),!s.leases.values.contains(where:{l in s.groups.first(where:{$0.id==l.claim.groupId}).map{FreedAppGroupsPolicy.leaseActive(l,group:$0,generation:s.generation,scopeEpoch:s.scopeEpoch,now:clock.now().timeIntervalSince1970,uptime:clock.uptime(),bootIdentity:boot)} == true}) else{throw Failure.reason("earned-time-consumed-or-active-window")}
   guard let data=Data(base64Encoded:offer.claim.target),let token=try? JSONDecoder().decode(ApplicationToken.self,from:data),restrictions(for:token,state:s,defaults:d,excluding:g.id)==0 else{throw Failure.reason("earned-time-overlapping-restriction")}
   let now=clock.now().timeIntervalSince1970,uptime=clock.uptime(),seconds=offer.request.requestedSeconds
   guard now<offer.validUntil,FreedAppGroupsPolicy.canStage(existingActivities:centre.activities.count,newActivities:1) else{throw Failure.reason("earned-time-expired-or-monitor-capacity")}
   let lease=FreedEarnedAppTimeLease(offerId:offer.id,ownerDigest:owner,seconds:seconds,native:FreedAppGroupLease(claim:offer.claim,requestedExpiry:now+Double(seconds),expiresAt:now+Double(seconds),grantedAt:now,grantedUptime:uptime,bootIdentity:boot))
   let activity=earnedName(lease);try centre.startMonitoring(activity,during:expirySchedule(lease.native.expiresAt));installed=activity
   guard earnedExpiryReady(lease) else{throw Failure.reason("earned-time-expiry-readback-failed")}
   guard actionScope==scope,ownerCurrent(s,d),FreedProtectionConfigurationLock.permitsPublication(d,capturedGeneration:s.generation) else{throw Failure.reason("earned-time-owner-changed")}
   if let failure=earned.consumeChallengeEvidence(request,offer:offer){throw Failure.reason(failure)}
   budget.spentSeconds += seconds;budget.revision += 1
   let consumed=FreedEarnedAppTimeConsumption(request:request,lease:lease,budgetAtGrant:budget)
   earned.budgets[earnedKey(owner,g.id)]=budget;earned.leases[earnedKey(owner,g.id)]=lease;earned.consumptions[consumedKey]=consumed
   var next=s;next.claim=nil;next.revision += 1;next.groups[next.groups.firstIndex(where:{$0.id==g.id})!].bank=1-g.bank
   try stageEarned(earned,d);oldState=s;candidate=next;try transaction(s,next,d)
   guard actionScope==scope,ownerCurrent(next,d),FreedProtectionConfigurationLock.permitsPublication(d,capturedGeneration:next.generation),let current=next.groups.first(where:{$0.id==g.id}),earnedLeaseTarget(current,next,d)==token else{throw Failure.reason("earned-time-owner-or-readback-changed")}
   return earnedGrantPayload(consumed,current,next,d,false)
  }}catch {
   if let installed{centre.stopMonitoring([installed])}
   if let old=oldState,let next=candidate {
    for g in next.groups where old.groups.first(where:{$0.id==g.id}).map({$0.bank != g.bank})==true {store(g).clearAllSettings()}
    _=try? withPrivateConfigurationAccess{d in self.reconcile(old,d)}
   }
   return rejected(reason(error))
  }
 }
 func updateAppGroupWithEarnedTime(_ input:[String:Any],_ scope:String)->[String:Any] {
  mutate(scope,operation:"update-earned",input:input){s,d in
   guard (Set(input.keys)==Set(["version","expectedStoreRevision","id","expectedRevision","name","enabled","rule","packages","extraTimeCapMinutes"]) || Set(input.keys)==Set(["version","expectedStoreRevision","id","expectedRevision","name","enabled","rule","packages","extraTimeCapMinutes","preferredBreakSeconds"])),self.number(input,"version")==2,self.number(input,"expectedStoreRevision")==s.revision,let id=input["id"] as? String,let i=s.groups.firstIndex(where:{$0.id==id}),self.number(input,"expectedRevision")==s.groups[i].revision,let cap=self.number(input,"extraTimeCapMinutes"),FreedEarnedAppTimePolicy.caps.contains(cap),let name=input["name"] as? String,name.count<=80,let enabledValue=input["enabled"] as? NSNumber,CFGetTypeID(enabledValue)==CFBooleanGetTypeID(),let enabled=input["enabled"] as? Bool,let raw=input["rule"] as? [String:Any],Set(raw.keys)==Set(raw["kind"] as? String=="daily-limit" ? ["kind","limitMinutes"]:raw["kind"] as? String=="scheduled" ? ["kind","startMinute","endMinute","days"]:["kind"]),let data=try? JSONSerialization.data(withJSONObject:raw),let rule=try? JSONDecoder().decode(FreedAppGroupRule.self,from:data),FreedAppGroupsPolicy.validateRule(rule,enabled:enabled),let packages=input["packages"] as? [String],packages.isEmpty else{throw Failure.reason("earned-time-group-update-invalid")}
   var g=s.groups[i],earned=try self.readEarned(d)
   if input.keys.contains("preferredBreakSeconds") {
    guard let preferred=self.number(input,"preferredBreakSeconds"),FreedAppGroupsPolicy.supportedBreakSeconds.contains(preferred) else{throw Failure.reason("earned-time-preference-invalid")}
    g.preferredBreakSeconds=preferred
   }
   var budget=try self.earnedBudget(&earned,s,g);try budget.setCap(cap);earned.budgets[self.earnedKey(budget.ownerDigest,g.id)]=budget
   let capOnly=g.name==name && g.enabled==enabled && g.rule==rule && g.pendingSelection==nil && g.rule.kind != "legacy"
   if !capOnly {
    if g.rule.kind=="legacy" {g.selection=try JSONEncoder().encode(self.legacySelection(d));s.legacyAppsAdopted=true}
    g.name=name;g.enabled=enabled;g.rule=rule
    if let pending=g.pendingSelection{g.selection=pending;g.pendingSelection=nil}
    if g.enabled{guard self.authorized(),!self.selection(g,d).applicationTokens.isEmpty else{throw Failure.reason("authorization-or-app-selection-required")}}
    g.revision += 1;g.bank=1-g.bank;s.groups[i]=g;s.thresholds.removeValue(forKey:id);s.leases.removeValue(forKey:id);if s.claim?.groupId==id{s.claim=nil}
    earned.leases.removeValue(forKey:self.earnedKey(budget.ownerDigest,id))
   }else {
    // A saved default is presentation, not new native access authority.
    s.groups[i]=g
   }
   try self.stageEarned(earned,d)
  }
 }
 private func breakPayload(_ lease:FreedAppGroupLease,_ g:FreedAppGroupDefinition,_ s:FreedAppGroupsState,_ d:UserDefaults,_ token:ApplicationToken)->[String:Any] {
  let remaining=restrictions(for:token,state:s,defaults:d,excluding:g.id),effective=remaining==0 && !(store(g).shield.applications ?? []).contains(token)
  var result:[String:Any]=["nativeUnlockGrantAccepted":true,"nativeUnlockGrantInterventionId":lease.claim.interventionId,"appGroupBreakGroupId":g.id,"appGroupBreakRevision":g.revision,"appGroupBreakEffective":effective,"appGroupRemainingRestrictionCount":remaining,"selectedShieldsPausedForEarnedUnlock":effective]
  if effective {result["activeUnlockExpiresAt"]=ISO8601DateFormatter().string(from:Date(timeIntervalSince1970:lease.expiresAt));result["activeUnlockInterventionId"]=lease.claim.interventionId};return result
 }
 private func nextBoundary(_ g:FreedAppGroupDefinition)->String? {
  guard g.enabled,g.rule.kind=="scheduled",let start=g.rule.startMinute,let end=g.rule.endMinute,let days=g.rule.days else{return nil};let c=Calendar.current,now=clock.now(),today=c.startOfDay(for:now);var dates=[Date]()
  for offset in -1...8 {guard let day=c.date(byAdding:.day,value:offset,to:today),days.contains(c.component(.weekday,from:day)-1),let endDay=end<start ? c.date(byAdding:.day,value:1,to:day):day else{continue};for value in [c.date(bySettingHour:start/60,minute:start%60,second:0,of:day),c.date(bySettingHour:end/60,minute:end%60,second:0,of:endDay)] {if let value,value>now{dates.append(value)}}}
  return dates.min().map{ISO8601DateFormatter().string(from:$0)}
 }
 private func payload(_ s:FreedAppGroupsState,_ d:UserDefaults)->[String:Any] {
  return (try? withBindingState {
  let legacy=legacySelection(d)
  let items:[[String:Any]]=privateOwner ? s.groups.map{g in let selected=selection(g,d),ready=g.enabled && authorized() && registrationReady(g,s,d) && shieldsReady(g,s,d);var breakInfo:Any=NSNull()
   if let l=s.leases[g.id],let token=leaseTarget(g,s){let p=breakPayload(l,g,s,d,token);breakInfo=["interventionId":l.claim.interventionId,"expiresAt":ISO8601DateFormatter().string(from:Date(timeIntervalSince1970:l.expiresAt)),"effective":p["appGroupBreakEffective"]!,"remainingRestrictionCount":p["appGroupRemainingRestrictionCount"]!]}
   if breakInfo is NSNull,let owner=s.ownerDigest,let earned=try? readEarned(d),let lease=earned.leases[earnedKey(owner,g.id)],let token=earnedLeaseTarget(g,s,d) {
    let p=breakPayload(lease.native,g,s,d,token);breakInfo=["interventionId":lease.native.claim.interventionId,"expiresAt":FreedEarnedAppTimePolicy.iso(lease.native.expiresAt),"effective":p["appGroupBreakEffective"]!,"remainingRestrictionCount":p["appGroupRemainingRestrictionCount"]!]
   }
   let rule=(try? JSONSerialization.jsonObject(with:JSONEncoder().encode(g.rule))) ?? ["kind":g.rule.kind]
   var item:[String:Any]=["id":g.id,"revision":g.revision,"name":g.name,"enabled":g.enabled,"rule":rule,"packages":[],"applicationCount":selected.applicationTokens.count,"draftApplicationCount":g.pendingSelection.flatMap{try? JSONDecoder().decode(FamilyActivitySelection.self,from:$0)}.map{$0.applicationTokens.count as Any} ?? NSNull(),"categoryCount":selected.categoryTokens.count,"webDomainCount":selected.webDomainTokens.count,"legacy":g.legacy,"preferredBreakSeconds":g.preferredBreakSeconds ?? 300,"configured":true,"ready":ready,"active":ready && active(g,s,d),"thresholdReached":s.thresholds[g.id]==dateKey(),"unavailablePackages":[],"usageMinutes":NSNull(),"nextBoundaryAt":nextBoundary(g).map{$0 as Any} ?? NSNull(),"break":breakInfo]
   if let owner=s.ownerDigest,let earned=try? readEarned(d),let budget=earned.budgets[earnedKey(owner,g.id)] {item["extraTimeBudget"]=budget.payload(now:clock.now(),uptime:clock.uptime(),boot:clock.bootIdentity())}
   return item
  }:[]
  return["version":1,"supported":true,"supportedBreakSeconds":FreedAppGroupsPolicy.supportedBreakSeconds,"platform":"ios","revision":s.revision,"configurationGeneration":s.generation,"scopeEpoch":s.scopeEpoch,"groups":items,"configuredGroupCount":s.groups.count,"permissions":["authorized":authorized(),"usageAccess":true,"runtimeConnected":true],"monitorBudget":["used":centre.activities.count,"limit":20],"maxGroups":6,"legacyCompatibility":["retained":s.legacyMigrated && (!legacy.categoryTokens.isEmpty || !legacy.webDomainTokens.isEmpty || legacyIndependentIntent(d)),"applicationCount":legacyIndependentIntent(d) ? legacy.applicationTokens.count:0,"categoryCount":legacy.categoryTokens.count,"webDomainCount":legacy.webDomainTokens.count],"reason":privateOwner ? NSNull():"sign-in-required"]
  }) ?? unavailable("binding-state-busy")
 }
 private func unavailable(_ reason:String)->[String:Any]{["version":1,"supported":false,"supportedBreakSeconds":FreedAppGroupsPolicy.supportedBreakSeconds,"platform":"ios","revision":0,"configurationGeneration":0,"scopeEpoch":0,"groups":[],"configuredGroupCount":0,"permissions":["authorized":false,"usageAccess":false,"runtimeConnected":false],"monitorBudget":["used":0,"limit":20],"maxGroups":6,"legacyCompatibility":["retained":false,"applicationCount":0,"categoryCount":0,"webDomainCount":0],"reason":reason]}
 static func reset(_ defaults:UserDefaults) {
  for slot in 0..<6 {for bank in 0..<2 {ManagedSettingsStore(named:.init("freed.app-group.slot\(slot).bank\(bank)")).clearAllSettings()}}
  let c=DeviceActivityCenter();c.stopMonitoring(c.activities.filter{$0.rawValue.hasPrefix(FreedAppGroupsPolicy.prefix)})
  defaults.removeObject(forKey:FreedAppGroupsPolicy.key)
  defaults.removeObject(forKey:FreedResetAppGroupRewardLedger.key)
 }
}
#endif
