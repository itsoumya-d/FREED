import Foundation

// Test-only controllable stop boundary used by the actual installer/suspension.
final class InstallBoundarySteps: FreedChallengeStepObserving {
 let processId=UUID().uuidString
 var available:Bool { false }
 var onStop:(()->Void)?
 func start(from:Date,receive:@escaping(FreedChallengeStepSample?,String?)->Void) {}
 func stop() { let callback=onStop;onStop=nil;callback?() }
}

// Keep the final fixture compilable against the frozen Void-returning preimage;
// that old interface cannot acknowledge a rejected suspension.
func suspensionWasDenied(_ result: Bool) -> Bool { !result }
func suspensionWasDenied(_ result: Void) -> Bool { false }

@main struct AccountProtectionCleanupCases {
 @MainActor static func main() async throws {
  let parent = FileManager.default.temporaryDirectory.appendingPathComponent("freed-account-cleanup-\(UUID().uuidString)")
  try FileManager.default.createDirectory(at: parent, withIntermediateDirectories: true)
  defer { try? FileManager.default.removeItem(at: parent) }
  var count=0
  func fresh() throws {
   count += 1;RuntimeLock.directory=parent.appendingPathComponent(String(count));RuntimeLock.domain="freed.cleanup.\(UUID().uuidString)"
   try FileManager.default.createDirectory(at: RuntimeLock.directory, withIntermediateDirectories:true)
   UNUserNotificationCenter.instance.hold=false;UNUserNotificationCenter.instance.pending=[];UNUserNotificationCenter.instance.delivered=[];UNUserNotificationCenter.instance.removed=[]
   FreedAdultProtectionRuntime.value.status = .notEnrolled
  }
  func require(_ value:Bool,_ text:String){precondition(value,text)}
  func rejected(_ work:()throws->Void){do{try work();preconditionFailure("Expected stale/corrupt rejection")}catch{}}
  func bind(_ runtime:FreedAppGroupsRuntime,_ raw:String)throws->(FreedAccountBindingSessionState,[String:Any]){
   let module=UUID();FreedAccountBindingLifecycle.created(module:module)
   let session=try FreedAccountBindingLifecycle.issue(module:module);try runtime.installBindingSession(session)
   let ticket=try runtime.prepareBinding(scope:raw,session:session.id,transition:UUID().uuidString,sequence:0)
   return (session,try runtime.commitBinding(ticket:ticket["ticket"] as! String,session:session.id))
  }
  func seeded(_ runtime:FreedAppGroupsRuntime)throws->(String,String){
   let (_,receipt)=try bind(runtime,"[\"same-owner\",0]")
   let scope=receipt["actionScope"] as! String,handle=receipt["bindingHandle"] as! String
   try RuntimeLock.withExclusiveAccess { d in
    for key in ["freed.appGuard.private","freed.appLimit.private","freed.earnedUnlock.private","freed.pendingIntervention.private","freed.selection.private","freed.familyActivitySelection"]{d.set(Data("private".utf8),forKey:key)}
    d.set(Data("dns-owned".utf8),forKey:"freed.encryptedDns.test");d.set(Data("safari-owned".utf8),forKey:"freed.safariContentBlocker.test")
   }
   return(scope,handle)
  }
  try fresh()
  let runtime=FreedAppGroupsRuntime.shared,module=CleanupModuleHarness()
  let (scope,handle)=try seeded(runtime)
  let legacy=UserDefaults(suiteName:RuntimeLock.domain)!
  let legacyOwner=try RuntimeLock.withExclusiveAccess { $0.data(forKey:FreedAppGroupsPolicy.key)! }
  legacy.set(legacyOwner,forKey:FreedAppGroupsPolicy.key)
  legacy.set(Data("legacy-private".utf8),forKey:"freed.selection.legacy");legacy.set("adult-legacy-retained",forKey:"freed.adultFilterActiveLegacyFixture")
  let wrong=UUID().uuidString
  rejected{_ = try runtime.prepareCleanup(scope:scope,handle:wrong)}
  let first=try runtime.prepareCleanup(scope:scope,handle:handle)
  let repeatPrepare=try runtime.prepareCleanup(scope:scope,handle:handle)
  require(first.operationID==repeatPrepare.operationID,"Exact original binding joins cleanup")
  FreedAdultProtectionRuntime.value.status = .unavailable
  UNUserNotificationCenter.instance.hold=true
  let erased=module.executeAccountProtectionCleanup(operationID:first.operationID)
  require(erased["nativeAuthorityRevoked"] as? Bool==true && erased["privateStoreErased"] as? Bool==true,"Private erase completes while friend store and notification/DNS observation unavailable")
  try RuntimeLock.withExclusiveAccess { d in
   require(FreedRetainedAdultProtection.privateNamespacesAbsent(d),"All private prefixes erased")
   require(d.data(forKey:"freed.encryptedDns.test")==Data("dns-owned".utf8),"DNS bytes retained")
   require(d.data(forKey:"freed.safariContentBlocker.test")==Data("safari-owned".utf8),"Safari bytes retained")
   require(d.object(forKey:FreedRetainedAdultProtection.key)==nil,"Missing retained policy remains missing")
   require(FreedProtectionConfigurationLock.generation(d)==first.original.generation+1,"One allocated generation")
  }
  require(legacy.object(forKey:"freed.selection.legacy")==nil && legacy.string(forKey:"freed.adultFilterActiveLegacyFixture")=="adult-legacy-retained","Actual legacy app-group private copy erased independently; adult legacy bytes retained")
  require(runtime.setScope("[\"same-owner\",0]")["accepted"] as? Bool==false,"Revoked raw v1 cannot recreate erased owner")
  let replay=CleanupModuleHarness().executeAccountProtectionCleanup(operationID:first.operationID)
  require(replay["privateStoreErased"] as? Bool==true,"Recreated Module retry after owner bytes erased")
  try RuntimeLock.withExclusiveAccess { d in require(FreedProtectionConfigurationLock.generation(d)==first.original.generation+1,"Retry does not refence") }
  require(ManagedSettingsStore.adultProtected,"Default adult filter remains installed")
  // Positively acknowledge independent core/notice work, then fresh same-owner v2.
  try RuntimeLock.withExclusiveAccess { d in
   var value=try FreedAccountProtectionCleanup.required(first.operationID,d);value.legacyPrivateStoreErased=true;value.resources.notificationsUnverified=false;value.localRuntimeScrubComplete=true;value.runtimeScrubComplete=true
   value.processScrubState = .suspended // FIX2_PROCESS_ACK
   try FreedAccountProtectionCleanup.replace(value,d);try FreedAccountProtectionCleanup.acknowledgeCore(first.operationID,d)
  }
  let (_,newBinding)=try bind(runtime,"[\"same-owner\",0]")
  let newScope=newBinding["actionScope"] as! String
  require(newScope != scope && runtime.ownerVerified,"Fresh same-owner raw scope obtains distinct native admission")
  let freshSnapshot=runtime.snapshot(newScope)
  require(runtime.create(["version":1,"expectedStoreRevision":freshSnapshot["revision"]!,"name":"Fresh rule"],newScope)["accepted"] as? Bool==true,"Fresh v2 same-owner binding can create new disabled private rules")
  let before=try Data(contentsOf:RuntimeLock.directory.appendingPathComponent(FreedProtectionConfigurationLock.stateFileName))
  let done=module.executeAccountProtectionCleanup(operationID:first.operationID)
  let after=try Data(contentsOf:RuntimeLock.directory.appendingPathComponent(FreedProtectionConfigurationLock.stateFileName))
  require(done["replayed"] as? Bool==true && before==after,"Completed replay after B has zero durable writes")
  require(runtime.snapshot(scope)["supported"] as? Bool==false,"Old admitted action scope cannot adopt fresh same-owner binding")
  // Session replacement cannot be undone by an old queued installer.
  let moduleA=UUID();FreedAccountBindingLifecycle.created(module:moduleA);let sessionA=try FreedAccountBindingLifecycle.issue(module:moduleA)
  let moduleB=UUID();FreedAccountBindingLifecycle.created(module:moduleB);let sessionB=try FreedAccountBindingLifecycle.issue(module:moduleB)
  rejected{try runtime.installBindingSession(sessionA)}
  FreedAccountBindingLifecycle.destroyed(module:moduleA)
  require(sessionB.current,"Delayed A destruction cannot retire B")
  sessionB.retire();require(!sessionB.current,"Explicit SharedObject release retires exact session")
  // Native module replacement must serialize after final private commit/publication.
  try fresh();let (raceScope,_)=try seeded(runtime)
  let raceSnapshot=runtime.snapshot(raceScope)
  let replacementStarted=DispatchSemaphore(value:0),replacementFinished=DispatchSemaphore(value:0)
  let replacementModule=UUID()
  RuntimeLock.beforeNextCommit = {
   DispatchQueue.global().async {
    replacementStarted.signal()
    FreedAccountBindingLifecycle.created(module:replacementModule)
    replacementFinished.signal()
   }
   require(replacementStarted.wait(timeout:.now()+2) == .success,"Replacement contender reached the lifecycle gate")
   require(replacementFinished.wait(timeout:.now()+0.1) == .timedOut,"Native replacement cannot retire admission between final check and commit")
  }
  let raceMutation=runtime.create(["version":1,"expectedStoreRevision":raceSnapshot["revision"]!,"name":"Admitted before replacement"],raceScope)
  require(raceMutation["accepted"] as? Bool==true,"Admitted mutation finishes atomically before replacement")
  func replacementDidFinish()->Bool { replacementFinished.wait(timeout:.now()+2) == .success }
  require(replacementDidFinish(),"Replacement proceeds after commit and process publication")
  let retiredBytes=try Data(contentsOf:RuntimeLock.directory.appendingPathComponent(FreedProtectionConfigurationLock.stateFileName))
  require(runtime.create(["version":1,"expectedStoreRevision":(raceSnapshot["revision"] as! Int)+1,"name":"Retired mutation"],raceScope)["accepted"] as? Bool==false,"Retired session denies subsequent private mutation")
  require(try Data(contentsOf:RuntimeLock.directory.appendingPathComponent(FreedProtectionConfigurationLock.stateFileName))==retiredBytes,"Retired private admission has zero durable mutation")
  // Reachable unisolated status read: configuration -> lifecycle versus private
  // transaction: lifecycle -> configuration. Contended admission must not wait.
  try fresh();let (lockSession,lockBinding)=try bind(runtime,"[\"lock-owner\",0]")
  let lockScope=lockBinding["actionScope"] as! String
  let configurationOwned=DispatchSemaphore(value:0),lifecycleOwned=DispatchSemaphore(value:0)
  let statusFinished=DispatchSemaphore(value:0),privateFinished=DispatchSemaphore(value:0)
  DispatchQueue.global().async {
   do {
    try RuntimeLock.withExclusiveAccess { _ in
     configurationOwned.signal()
     precondition(lifecycleOwned.wait(timeout:.now()+2) == .success,"Private contender acquired lifecycle")
     _=runtime.effectiveStatus()
     statusFinished.signal()
    }
   } catch { preconditionFailure("Status fixture configuration failed: \(error)") }
  }
  DispatchQueue.global().async {
   precondition(configurationOwned.wait(timeout:.now()+2) == .success,"Status contender acquired configuration")
   do {
    try lockSession.withCurrent {
     lifecycleOwned.signal()
     _=runtime.snapshot(lockScope)
    }
   } catch { preconditionFailure("Private fixture admission failed: \(error)") }
   privateFinished.signal()
  }
  func lockOrderCompleted()->Bool {
   statusFinished.wait(timeout:.now()+0.5) == .success && privateFinished.wait(timeout:.now()+2) == .success
  }
  require(lockOrderCompleted(),"Configuration-held status must fail closed without waiting on lifecycle")
  // T82-R1: production scheduling is an unisolated native-queue status
  // reader versus MainActor session installation, with no assumed actor fence.
  try fresh()
  let firstRuntime=FreedAppGroupsRuntime(),firstRaw="[\"first-session-owner\",0]"
  let firstBinding=firstRuntime.setScope(firstRaw)
  require(firstBinding["accepted"] as? Bool==true,"First-session fixture has actual legacy owner admission")
  let firstIdentity=firstRuntime.currentBindingIdentity
  let firstModule=UUID();FreedAccountBindingLifecycle.created(module:firstModule)
  let firstSession=try FreedAccountBindingLifecycle.issue(module:firstModule)
  let statusAdmitted=DispatchSemaphore(value:0),resumeStatus=DispatchSemaphore(value:0),statusCompleted=DispatchSemaphore(value:0)
  RuntimeLock.beforeNextCommit = {
   statusAdmitted.signal()
   precondition(resumeStatus.wait(timeout:.now()+2) == .success,"MainActor installer releases admitted native status")
  }
  DispatchQueue.global().async { _=firstRuntime.effectiveStatus();statusCompleted.signal() }
  func statusHasAdmission()->Bool {statusAdmitted.wait(timeout:.now()+2) == .success}
  require(statusHasAdmission(),"Actual unisolated effectiveStatus reached atomic commit boundary")
  var firstInstallDenied=false
  do {try firstRuntime.installBindingSession(firstSession)} catch {firstInstallDenied=true}
  require(firstInstallDenied,"Admitted unisolated status excludes first session reference installation")
  require(suspensionWasDenied(firstRuntime.suspend()),"Contended public suspension reports false instead of claiming presentation was cleared")
  resumeStatus.signal()
  func statusDidComplete()->Bool {statusCompleted.wait(timeout:.now()+2) == .success}
  require(statusDidComplete(),"Native status completes without instance/configuration lock cycle")
  require(firstRuntime.currentBindingIdentity==firstIdentity,"Status retained coherent legacy binding through publication")
  try firstRuntime.installBindingSession(firstSession)
  require(firstRuntime.currentBindingIdentity==nil,"First installer may suspend presentation after reader exits")
  // Opposite scheduling: MainActor installer has replaced the reference, but
  // native-queue lower/status readers arrive before its suspension completes.
  try fresh()
  let installSteps=InstallBoundarySteps(),installRuntime=FreedAppGroupsRuntime(challengeSteps:installSteps)
  let installRaw="[\"replacement-owner\",0]"
  require(installRuntime.setScope(installRaw)["accepted"] as? Bool==true,"Lower-reader fixture has actual owner")
  let committedView=try RuntimeLock.withExclusiveAccess { $0 }
  let replacementOwner=UUID();FreedAccountBindingLifecycle.created(module:replacementOwner)
  let replacementSession=try FreedAccountBindingLifecycle.issue(module:replacementOwner)
  let lowerReadersFinished=DispatchSemaphore(value:0)
  installSteps.onStop = {
   DispatchQueue.global().async {
    precondition(installRuntime.currentBindingIdentity==nil,"Presentation reader never fetches partially installed binding identity")
    precondition(!installRuntime.diagnosticOwnerVerified(committedView),"Lower owner reader denies partially installed session and binding state")
    precondition(installRuntime.effectiveStatus()==nil,"Unisolated status fails closed during instance installation")
    lowerReadersFinished.signal()
   }
   precondition(lowerReadersFinished.wait(timeout:.now()+2) == .success,"Guarded native readers return while MainActor installer owns instance state")
  }
  try installRuntime.installBindingSession(replacementSession)
  let replacementTicket=try installRuntime.prepareBinding(scope:installRaw,session:replacementSession.id,transition:UUID().uuidString,sequence:0)
  let replacementBinding=try installRuntime.commitBinding(ticket:replacementTicket["ticket"] as! String,session:replacementSession.id)
  require(installRuntime.ownerVerified && installRuntime.currentBindingIdentity==replacementBinding["bindingHandle"] as? String,"Same-owner replacement publishes coherent fresh authority after installation")
  print("Task82 fix1 actual native-queue status/lower/presentation readers vs MainActor first/replacement installation: PASS")
  // Prepared A may be superseded before its fence, with no B mutation.
  try fresh();let (a,h)=try seeded(runtime);let old=try runtime.prepareCleanup(scope:a,handle:h)
  _=try bind(runtime,"[\"owner-B\",0]")
  let b=try Data(contentsOf:RuntimeLock.directory.appendingPathComponent(FreedProtectionConfigurationLock.stateFileName))
  _=module.executeAccountProtectionCleanup(operationID:old.operationID)
  require(try Data(contentsOf:RuntimeLock.directory.appendingPathComponent(FreedProtectionConfigurationLock.stateFileName))==b,"B between prepare and fence remains untouched")
  // Corrupt retained policy does not prevent positively owned private erase.
  try fresh();let (c,ch)=try seeded(runtime)
  try RuntimeLock.withExclusiveAccess { $0.set(Data([255]),forKey:FreedRetainedAdultProtection.key) }
  let corrupt=try runtime.prepareCleanup(scope:c,handle:ch);let corruptResult=module.executeAccountProtectionCleanup(operationID:corrupt.operationID)
  require(corruptResult["privateStoreErased"] as? Bool==true && corruptResult["retainedPolicyState"] as? String=="unverified","Corrupt retained policy has independent privacy result")
  try RuntimeLock.withExclusiveAccess { require($0.data(forKey:FreedRetainedAdultProtection.key)==Data([255]),"Corrupt adult bytes preserved") }
  // Entire unreadable envelope cannot be replaced by an empty policy.
  let path=RuntimeLock.directory.appendingPathComponent(FreedProtectionConfigurationLock.stateFileName)
  try Data([255]).write(to:path)
  let unavailable=module.executeAccountProtectionCleanup(operationID:corrupt.operationID)
  require(unavailable["privateCleanupAccepted"] as? Bool==false,"Corrupt envelope remains pending")
  require(try Data(contentsOf:path)==Data([255]),"Corrupt envelope is never overwritten")
  // Durable phase rollback and capacity bounds use actual atomic file transactions.
  try fresh();let (d,dh)=try seeded(runtime);let pending=try runtime.prepareCleanup(scope:d,handle:dh)
  _=try RuntimeLock.withExclusiveAccess { try FreedAccountProtectionCleanup.arm(pending.operationID,$0) } // PREPARED_EXECUTION_ACK
  rejected { try RuntimeLock.withExclusiveAccess { defaults in _=try FreedAccountProtectionCleanup.fence(pending.operationID,defaults);throw TestFailure.failed } }
  try RuntimeLock.withExclusiveAccess { defaults in require(try FreedAccountProtectionCleanup.required(pending.operationID,defaults).phase == .prepared,"Throw after fence restores only pre-fence transaction") }
  _=try RuntimeLock.withExclusiveAccess { try FreedAccountProtectionCleanup.fence(pending.operationID,$0) }
  rejected { try RuntimeLock.withExclusiveAccess { defaults in _=try FreedAccountProtectionCleanup.erase(pending.operationID,defaults);throw TestFailure.failed } }
  try RuntimeLock.withExclusiveAccess { require(try FreedAccountProtectionCleanup.required(pending.operationID,$0).phase == .fenced,"Erase failure never rolls back separately committed fence") }
  _=try RuntimeLock.withExclusiveAccess { try FreedAccountProtectionCleanup.erase(pending.operationID,$0) }
  rejected { try RuntimeLock.withExclusiveAccess { _ in throw TestFailure.failed } }
  try RuntimeLock.withExclusiveAccess { require(FreedRetainedAdultProtection.privateNamespacesAbsent($0),"Later failure cannot restore erased authority") }
  var tooMany=FreedAccountProtectionCleanup.Resources();tooMany.monitors=(0..<21).map{"freed.group.\($0)"};require(!tooMany.valid,"Inventory limit rejects before mutation")
  // B's new private state and reused stores survive a delayed post-erasure scrub.
  try fresh();let (e,eh)=try seeded(runtime);let delayed=try runtime.prepareCleanup(scope:e,handle:eh)
  _=try RuntimeLock.withExclusiveAccess { try FreedAccountProtectionCleanup.arm(delayed.operationID,$0) } // PREPARED_EXECUTION_ACK
  _=try RuntimeLock.withExclusiveAccess { try FreedAccountProtectionCleanup.fence(delayed.operationID,$0) }
  _=try RuntimeLock.withExclusiveAccess { try FreedAccountProtectionCleanup.erase(delayed.operationID,$0) }
  try RuntimeLock.withExclusiveAccess { try FreedAccountProtectionCleanup.acknowledgeCore(delayed.operationID,$0) }
  let (_,bReceipt)=try bind(runtime,"[\"owner-B\",0]")
  let bHandle=bReceipt["bindingHandle"] as! String
  let bank=ManagedSettingsStore(named:.init("freed.app-group.slot0.bank0"));bank.shield.applications=[TestToken(value:"B")]
  module.earnedPhotoBindingID=bHandle;FreedAppGroupPicker.bindingID=bHandle;FreedWebsiteProbePicker.bindingID=bHandle
  try RuntimeLock.withExclusiveAccess { $0.set(Data("B".utf8),forKey:"freed.familyActivitySelection") }
  let photoCount=module.cancelledPhotos
  _=module.executeAccountProtectionCleanup(operationID:delayed.operationID)
  require(module.cancelledPhotos==photoCount && FreedAppGroupPicker.bindingID==bHandle && FreedWebsiteProbePicker.bindingID==bHandle,"Old cleanup cannot cancel B photo or either picker")
  require(bank.shield.applications==[TestToken(value:"B")],"Old cleanup cannot clear B reused store")
  try RuntimeLock.withExclusiveAccess { require($0.data(forKey:"freed.familyActivitySelection")==Data("B".utf8),"Old erasure retry cannot erase B private bytes") }
  // Legacy provenance is captured once; later owner/value reuse is never erased.
  try fresh();let (ls,lh)=try seeded(runtime)
  let rawLegacy=UserDefaults(suiteName:RuntimeLock.domain)!
  let originalLegacy=try RuntimeLock.withExclusiveAccess { $0.data(forKey:FreedAppGroupsPolicy.key)! }
  rawLegacy.set(originalLegacy,forKey:FreedAppGroupsPolicy.key);rawLegacy.set("original-A",forKey:"freed.selection.legacy")
  let legacyCleanup=try runtime.prepareCleanup(scope:ls,handle:lh)
  rawLegacy.set(try JSONSerialization.data(withJSONObject:["ownerDigest":String(repeating:"b",count:64)]),forKey:FreedAppGroupsPolicy.key)
  rawLegacy.set("new-B",forKey:"freed.selection.legacy")
  let legacyResult=module.executeAccountProtectionCleanup(operationID:legacyCleanup.operationID)
  require(legacyResult["privateProjectionErased"] as? Bool==true && legacyResult["privateStoreErased"] as? Bool==false,"Legacy uncertainty never blocks separate authoritative erasure or claims full privacy success")
  require(rawLegacy.string(forKey:"freed.selection.legacy")=="new-B","A cleanup preserves a changed legacy owner/value")
  _=CleanupModuleHarness().executeAccountProtectionCleanup(operationID:legacyCleanup.operationID)
  require(rawLegacy.string(forKey:"freed.selection.legacy")=="new-B","Lost caller reply cannot authorize a later legacy-owner scrub")
  // Outstanding pre-cleanup tickets and sessions cannot mint a fresh admission.
  try fresh();let (f,fh)=try seeded(runtime);let revoked=try runtime.prepareCleanup(scope:f,handle:fh)
  let oldModule=UUID();FreedAccountBindingLifecycle.created(module:oldModule);let oldSession=try FreedAccountBindingLifecycle.issue(module:oldModule)
  try runtime.installBindingSession(oldSession)
  let oldTicket=try runtime.prepareBinding(scope:"[\"same-owner\",0]",session:oldSession.id,transition:UUID().uuidString,sequence:0)
  _=try RuntimeLock.withExclusiveAccess { try FreedAccountProtectionCleanup.arm(revoked.operationID,$0) } // PREPARED_EXECUTION_ACK
  _=try RuntimeLock.withExclusiveAccess { try FreedAccountProtectionCleanup.fence(revoked.operationID,$0) }
  rejected{_ = try runtime.commitBinding(ticket:oldTicket["ticket"] as! String,session:oldSession.id)}
  // Complete actual Module preparation, exact capture inventory, and notification readback.
  try fresh();let (noticeScope,noticeHandle)=try seeded(runtime)
  let captureRoot=FreedChallengeOwnedCaptureFiles.nativeDirectory
  try FileManager.default.createDirectory(at:captureRoot,withIntermediateDirectories:true)
  let captureFile=captureRoot.appendingPathComponent(UUID().uuidString.lowercased()+".jpg")
  try Data("capture-fixture".utf8).write(to:captureFile)
  let prepared=try module.prepareAccountProtectionCleanup(scope:noticeScope,handle:noticeHandle)
  let noticeID=prepared["operationID"] as! String
  let noticeGeneration=try RuntimeLock.withExclusiveAccess { try FreedAccountProtectionCleanup.required(noticeID,$0).original.generation }
  let notice=Notice(identifier:"owned-notice",content:NoticeContent(userInfo:["kind":"freed-pending-intervention","shieldGeneration":noticeGeneration]))
  UNUserNotificationCenter.instance.pending=[notice];UNUserNotificationCenter.instance.delivered=[DeliveredNotice(request:notice)]
  _=module.executeAccountProtectionCleanup(operationID:noticeID)
  for _ in 0..<30 {await Task.yield()}
  require(!FileManager.default.fileExists(atPath:captureFile.path),"Actual Module removes captured original-owned file")
  require(UNUserNotificationCenter.instance.pending.isEmpty && UNUserNotificationCenter.instance.delivered.isEmpty,"Both pending and delivered owned notifications scrubbed")
  try RuntimeLock.withExclusiveAccess { require(try FreedAccountProtectionCleanup.required(noticeID,$0).terminal,"Module completes only after separate positive core and notification observations") }
  // Delayed notification enumeration cannot remove B notices or reuse A cleanup for B.
  try fresh();let (ns,nh)=try seeded(runtime);let nr=try runtime.prepareCleanup(scope:ns,handle:nh)
  UNUserNotificationCenter.instance.hold=true
  _=module.executeAccountProtectionCleanup(operationID:nr.operationID)
  for _ in 0..<20 {await Task.yield()}
  _=try bind(runtime,"[\"new-owner\",0]")
  let newNotice=Notice(identifier:"reused-notice",content:NoticeContent(userInfo:["kind":"freed-pending-intervention","shieldGeneration":nr.original.generation]))
  UNUserNotificationCenter.instance.pending=[newNotice]
  let delayedQuery=UNUserNotificationCenter.instance.callback;UNUserNotificationCenter.instance.callback=nil;UNUserNotificationCenter.instance.hold=false
  delayedQuery?([newNotice]);for _ in 0..<20 {await Task.yield()}
  require(UNUserNotificationCenter.instance.pending.count==1 && UNUserNotificationCenter.instance.removed.isEmpty,"Final original-owner gate rejects stale notification enumeration after B binds")
  // Capacity never evicts unresolved cleanup; only terminal IDs can be pruned.
  try fresh();let (g,gh)=try seeded(runtime)
  try RuntimeLock.withExclusiveAccess { defaults in
   var journal=try FreedAccountProtectionCleanup.read(defaults)
   for index in 0..<32 {
    journal.records.append(.init(operationID:UUID().uuidString.lowercased(),original:.init(ownerDigest:String(repeating:"c",count:64),generation:0,scopeEpoch:100+index),bindingID:UUID().uuidString.lowercased(),admissionRevision:0,resources:.init(),retainedPolicyDigest:nil,retainedPolicyState:"unverified"))
   }
   try FreedAccountProtectionCleanup.stage(journal,defaults)
  }
  rejected{_ = try runtime.prepareCleanup(scope:g,handle:gh)}
  var pruned=""
  try RuntimeLock.withExclusiveAccess { defaults in
   var journal=try FreedAccountProtectionCleanup.read(defaults);pruned=journal.records[0].operationID
   journal.records[0].resultingGeneration=1;journal.records[0].nativeEpoch=1;journal.records[0].privateStoreErased=true;journal.records[0].legacyPrivateStoreErased=true
   journal.records[0].localRuntimeScrubComplete=true;journal.records[0].runtimeScrubComplete=true;journal.records[0].coreInvalidationPending=false
   journal.records[0].executionRequested = true // PREPARED_EXECUTION_ACK
   journal.records[0].processScrubState = .suspended // FIX2_PROCESS_ACK
   journal.records[0].resources.notificationsUnverified=false;journal.records[0].phase = .completed
   try FreedAccountProtectionCleanup.stage(journal,defaults)
  }
  _=try runtime.prepareCleanup(scope:g,handle:gh)
  rejected{_ = try RuntimeLock.withExclusiveAccess { try FreedAccountProtectionCleanup.required(pruned,$0) }}
  try RuntimeLock.withExclusiveAccess { require(try FreedAccountProtectionCleanup.read($0).records.count==32,"Terminal-only pruning preserves bounded unresolved inventory") }
  // A torn tombstone is not an absent journal and cannot be silently initialized.
  try RuntimeLock.withExclusiveAccess { $0.set(Data([255]),forKey:FreedAccountProtectionCleanup.key) }
  let tornBefore=try Data(contentsOf:RuntimeLock.directory.appendingPathComponent(FreedProtectionConfigurationLock.stateFileName))
  rejected{_ = try runtime.prepareCleanup(scope:g,handle:gh)}
  require(try Data(contentsOf:RuntimeLock.directory.appendingPathComponent(FreedProtectionConfigurationLock.stateFileName))==tornBefore,"Corrupt tombstone fails closed without erasing or replacing bytes")
  // T82-F1-R1: an actual native-queue reader owns the matching runtime,
  // but has released configuration, so durable erase can proceed independently.
  func holdMatchingRuntime() -> () -> Void {
   let held=DispatchSemaphore(value:0),release=DispatchSemaphore(value:0),done=DispatchSemaphore(value:0)
   RuntimeLock.afterBackgroundTransaction = {
    held.signal()
    precondition(release.wait(timeout:.now()+5) == .success,"Cleanup fixture releases admitted status reader")
   }
   DispatchQueue.global().async {_=runtime.effectiveStatus();done.signal()}
   precondition(held.wait(timeout:.now()+2) == .success,"Actual unisolated reader owns matching instance after configuration returns")
   return {
    release.signal()
    precondition(done.wait(timeout:.now()+2) == .success,"Native reader releases instance/lifecycle admission")
    RuntimeLock.afterBackgroundTransaction=nil
   }
  }
  try fresh();let (busyScope,busyHandle)=try seeded(runtime)
  let busyRecord=try runtime.prepareCleanup(scope:busyScope,handle:busyHandle)
  module.earnedPhotoBindingID=busyHandle;FreedAppGroupPicker.bindingID=busyHandle;FreedWebsiteProbePicker.bindingID=busyHandle
  module.pendingFamilyPickerBindingID=busyHandle
  var busyFamilyCancelled=0
  module.pendingFamilyPickerReset={busyFamilyCancelled += 1;module.pendingFamilyPickerBindingID=nil;module.pendingFamilyPickerReset=nil}
  let busyPhotosBefore=module.cancelledPhotos
  let releaseBusyReader=holdMatchingRuntime()
  _=module.executeAccountProtectionCleanup(operationID:busyRecord.operationID) // caller loses this reply
  for _ in 0..<40 {await Task.yield()}
  let busyStatus=try RuntimeLock.withExclusiveAccess {try FreedAccountProtectionCleanup.required(busyRecord.operationID,$0).receipt()}
  require(busyStatus["privateStoreErased"] as? Bool==true && busyStatus["coreInvalidationPending"] as? Bool==false,"Busy process admission never delays independent durable erasure/Core acknowledgement")
  require(busyStatus["processScrubPending"] as? Bool==true && busyStatus["runtimeScrubComplete"] as? Bool==false && busyStatus["phase"] as? String != "completed","Busy matching process cleanup remains durably pending after Core and notification settlement")
  require(module.cancelledPhotos==busyPhotosBefore && busyFamilyCancelled==0 && FreedAppGroupPicker.bindingID==busyHandle && FreedWebsiteProbePicker.bindingID==busyHandle,"Busy admission cannot bypass exact process gate to cancel camera or pickers")
  // Missing process status in an unresolved prior-schema record remains pending.
  try RuntimeLock.withExclusiveAccess { d in
   var legacy=(try JSONSerialization.jsonObject(with:d.data(forKey:FreedAccountProtectionCleanup.key)!)) as! [String:Any]
   var records=legacy["records"] as! [[String:Any]]
   let index=records.firstIndex{$0["operationID"] as? String==busyRecord.operationID}!
   records[index].removeValue(forKey:"processScrubState");legacy["records"]=records
   d.set(try JSONSerialization.data(withJSONObject:legacy),forKey:FreedAccountProtectionCleanup.key)
   try FreedAccountProtectionCleanup.acknowledgeCore(busyRecord.operationID,d)
   let unresolved=try FreedAccountProtectionCleanup.required(busyRecord.operationID,d)
   require(!unresolved.terminal && unresolved.receipt()["processScrubPending"] as? Bool==true,"Missing unresolved process status cannot be promoted by Core acknowledgement")
  }
  releaseBusyReader()
  _=module.executeAccountProtectionCleanup(operationID:busyRecord.operationID) // exact retry; reply lost again
  for _ in 0..<40 {await Task.yield()}
  try RuntimeLock.withExclusiveAccess { d in
   let finished=try FreedAccountProtectionCleanup.required(busyRecord.operationID,d)
   require(finished.terminal && finished.receipt()["processScrubPending"] as? Bool==false,"Exact retry terminalizes only after owned process cancellation")
  }
  require(module.cancelledPhotos==busyPhotosBefore+1 && busyFamilyCancelled==1 && FreedAppGroupPicker.cancelled.filter{$0==busyHandle}.count==1 && FreedWebsiteProbePicker.cancelled.filter{$0==busyHandle}.count==1,"Original camera/classifier, both pickers and family closure cancel exactly once after contention")
  // Existing immutable completed receipts decode without the additive field;
  // this preserves their recorded result and explicitly labels it historical.
  try RuntimeLock.withExclusiveAccess { d in
   var legacy=(try JSONSerialization.jsonObject(with:d.data(forKey:FreedAccountProtectionCleanup.key)!)) as! [String:Any]
   var records=legacy["records"] as! [[String:Any]]
   let index=records.firstIndex{$0["operationID"] as? String==busyRecord.operationID}!
   records[index].removeValue(forKey:"processScrubState");legacy["records"]=records
   d.set(try JSONSerialization.data(withJSONObject:legacy),forKey:FreedAccountProtectionCleanup.key)
   let historical=try FreedAccountProtectionCleanup.required(busyRecord.operationID,d)
   require(historical.terminal && historical.receipt()["processScrubState"] as? String=="legacyCompleted","Legacy completed receipt stays immutable without inventing a new process observation")
  }
  let (_,terminalB)=try bind(runtime,"[\"terminal-B\",0]")
  let terminalBHandle=terminalB["bindingHandle"] as! String
  module.earnedPhotoBindingID=terminalBHandle;FreedAppGroupPicker.bindingID=terminalBHandle;FreedWebsiteProbePicker.bindingID=terminalBHandle
  module.pendingFamilyPickerBindingID=terminalBHandle;var terminalBFamilyCancelled=0
  module.pendingFamilyPickerReset={terminalBFamilyCancelled += 1}
  let terminalBytes=try Data(contentsOf:RuntimeLock.directory.appendingPathComponent(FreedProtectionConfigurationLock.stateFileName))
  let terminalReplay=module.executeAccountProtectionCleanup(operationID:busyRecord.operationID)
  require(terminalReplay["replayed"] as? Bool==true && module.cancelledPhotos==busyPhotosBefore+1 && terminalBFamilyCancelled==0,"Lost terminal reply replays without cancelling later B process work")
  require(try Data(contentsOf:RuntimeLock.directory.appendingPathComponent(FreedProtectionConfigurationLock.stateFileName))==terminalBytes && FreedAppGroupPicker.bindingID==terminalBHandle && FreedWebsiteProbePicker.bindingID==terminalBHandle,"Terminal replay after B has zero durable and picker effects")
  // B can also replace a still-pending A before its process retry.
  try fresh();let (pendingScope,pendingHandle)=try seeded(runtime)
  let pendingProcess=try runtime.prepareCleanup(scope:pendingScope,handle:pendingHandle)
  let releasePendingReader=holdMatchingRuntime()
  _=module.executeAccountProtectionCleanup(operationID:pendingProcess.operationID)
  for _ in 0..<40 {await Task.yield()}
  releasePendingReader()
  let (_,pendingB)=try bind(runtime,"[\"pending-B\",0]")
  let pendingBHandle=pendingB["bindingHandle"] as! String
  module.earnedPhotoBindingID=pendingBHandle;FreedAppGroupPicker.bindingID=pendingBHandle;FreedWebsiteProbePicker.bindingID=pendingBHandle
  module.pendingFamilyPickerBindingID=pendingBHandle;var pendingBFamilyCancelled=0
  module.pendingFamilyPickerReset={pendingBFamilyCancelled += 1}
  let pendingPhotosBefore=module.cancelledPhotos
  _=module.executeAccountProtectionCleanup(operationID:pendingProcess.operationID)
  for _ in 0..<20 {await Task.yield()}
  require(module.cancelledPhotos==pendingPhotosBefore && pendingBFamilyCancelled==0 && FreedAppGroupPicker.bindingID==pendingBHandle && FreedWebsiteProbePicker.bindingID==pendingBHandle,"Pending A retry preserves B camera, both pickers and family resources")
  try RuntimeLock.withExclusiveAccess { d in
   let superseded=try FreedAccountProtectionCleanup.required(pendingProcess.operationID,d)
   require(superseded.receipt()["processScrubState"] as? String=="notApplicable" && !superseded.runtimeScrubComplete,"Positive B process inapplicability does not authorize scrubbing B durable resources")
  }
  print("Task82 fix2 actual Module busy process scrub / independent erase / exact retry / lost reply / B preservation: PASS")
  // Prepared IDs are reservations before provider/cloud confirmation. Only
  // actual native reconciliation is exercised; these cloud labels are stand-ins.
  try fresh();let (reservedScope,reservedHandle)=try seeded(runtime)
  module.earnedPhotoBindingID=reservedHandle;FreedAppGroupPicker.bindingID=reservedHandle;FreedWebsiteProbePicker.bindingID=reservedHandle
  module.pendingFamilyPickerBindingID=reservedHandle;var reservedFamilyCancelled=0
  module.pendingFamilyPickerReset={reservedFamilyCancelled += 1;module.pendingFamilyPickerBindingID=nil;module.pendingFamilyPickerReset=nil}
  let reserveRoot=FreedChallengeOwnedCaptureFiles.nativeDirectory
  try FileManager.default.createDirectory(at:reserveRoot,withIntermediateDirectories:true)
  let reserveFile=reserveRoot.appendingPathComponent(UUID().uuidString.lowercased()+".jpg")
  try Data("reservation-capture".utf8).write(to:reserveFile)
  let reservation=try module.prepareAccountProtectionCleanup(scope:reservedScope,handle:reservedHandle)
  let reservationID=reservation["operationID"] as! String
  let reservedFile=RuntimeLock.directory.appendingPathComponent(FreedProtectionConfigurationLock.stateFileName)
  let reservedInitialGeneration=try RuntimeLock.withExclusiveAccess {FreedProtectionConfigurationLock.generation($0)}
  let reservedBytes=try Data(contentsOf:reservedFile),reservedPhotoCount=module.cancelledPhotos
  let reservedNoticeReads=UNUserNotificationCenter.instance.reads,reservedCoreReads=FreedAdultProtectionRuntime.value.cleanupStatusReads
  for _ in ["unknown","processing","cancelled"] {
   _=try module.statusCleanup(operationID:reservationID)
   module.reconcileAccountProtectionCleanup()
   CleanupModuleHarness().reconcileAccountProtectionCleanup() // recreated Module, same process
   require(try Data(contentsOf:reservedFile)==reservedBytes && runtime.ownerVerified && module.cancelledPhotos==reservedPhotoCount && reservedFamilyCancelled==0,"Prepared reservation stays inert across automatic lifecycle reconciliation")
  }
  require(FreedAppGroupPicker.bindingID==reservedHandle && FreedWebsiteProbePicker.bindingID==reservedHandle && FileManager.default.fileExists(atPath:reserveFile.path),"Unarmed reservation preserves both pickers and owned capture bytes")
  require(UNUserNotificationCenter.instance.reads==reservedNoticeReads && FreedAdultProtectionRuntime.value.cleanupStatusReads==reservedCoreReads,"Unarmed reconciliation performs no notification or Core work")
  let reservedStatus=try module.statusCleanup(operationID:reservationID)
  require(reservedStatus["executionRequested"] as? Bool==false && reservedStatus["executionAdmitted"] as? Bool==false && reservedStatus["executionState"] as? String=="reserved","Status-only read truthfully leaves execution unarmed")
  _=module.executeAccountProtectionCleanup(operationID:reservationID)
  for _ in 0..<40 {await Task.yield()}
  require(module.cancelledPhotos==reservedPhotoCount+1 && reservedFamilyCancelled==1 && !FileManager.default.fileExists(atPath:reserveFile.path),"Explicit execution arms before completing original-owned process/file scrub")
  try RuntimeLock.withExclusiveAccess { d in require(try FreedAccountProtectionCleanup.required(reservationID,d).terminal && FreedProtectionConfigurationLock.generation(d)==reservedInitialGeneration+1,"Explicit cleanup retains its original ID and one fence") }
  // Durable execute acceptance can survive a lost reply before any fence/effect.
  try fresh();let (armedScope,armedHandle)=try seeded(runtime)
  let armedModule=CleanupModuleHarness(),armedReservation=try armedModule.prepareAccountProtectionCleanup(scope:armedScope,handle:armedHandle)
  let armedID=armedReservation["operationID"] as! String
  let armedInitialGeneration=try RuntimeLock.withExclusiveAccess {FreedProtectionConfigurationLock.generation($0)}
  RuntimeLock.stopAfterNextArmingCommit=true
  _=armedModule.executeAccountProtectionCleanup(operationID:armedID) // committed arming, injected lost acknowledgement
  let armedStatus=try armedModule.statusCleanup(operationID:armedID)
  require(armedStatus["executionRequested"] as? Bool==true && armedStatus["executionState"] as? String=="armed" && armedStatus["nativeAuthorityRevoked"] as? Bool==false,"Committed execution intent survives failure before process suspension and native fence")
  require(armedModule.cancelledPhotos==0 && runtime.ownerVerified && UNUserNotificationCenter.instance.pending.isEmpty,"Armed-before-fence interruption has no process/notice side effects")
  FreedAccountBindingLifecycle.created(module:UUID()) // fresh native Module lifecycle; no old raw-owner rebind
  let coldModule=CleanupModuleHarness();coldModule.cleanupRuntime=FreedAppGroupsRuntime()
  require(coldModule.cleanupRuntime.currentBindingIdentity==nil,"Cold fixture runtime has never bound an account")
  coldModule.reconcileAccountProtectionCleanup()
  for _ in 0..<40 {await Task.yield()}
  try RuntimeLock.withExclusiveAccess { d in require(try FreedAccountProtectionCleanup.required(armedID,d).terminal && FreedProtectionConfigurationLock.generation(d)==armedInitialGeneration+1,"Cold automatic resume consumes durable arming by original ID and fences once") }
  let armedReplayBytes=try Data(contentsOf:RuntimeLock.directory.appendingPathComponent(FreedProtectionConfigurationLock.stateFileName))
  _=coldModule.executeAccountProtectionCleanup(operationID:armedID)
  require(try Data(contentsOf:RuntimeLock.directory.appendingPathComponent(FreedProtectionConfigurationLock.stateFileName))==armedReplayBytes,"Lost execute reply exact retry never reallocates or refences")
  // Actual filesystem commit failure: preparation has persisted; the directory
  // permits read/lock but denies the arming temporary-file creation.
  try fresh();let (failArmScope,failArmHandle)=try seeded(runtime)
  let failArm=try module.prepareAccountProtectionCleanup(scope:failArmScope,handle:failArmHandle),failArmID=failArm["operationID"] as! String
  module.earnedPhotoBindingID=failArmHandle;FreedAppGroupPicker.bindingID=failArmHandle;FreedWebsiteProbePicker.bindingID=failArmHandle
  module.pendingFamilyPickerBindingID=failArmHandle;var failedArmFamily=0
  module.pendingFamilyPickerReset={failedArmFamily += 1;module.pendingFamilyPickerBindingID=nil;module.pendingFamilyPickerReset=nil}
  let failArmBytes=try Data(contentsOf:RuntimeLock.directory.appendingPathComponent(FreedProtectionConfigurationLock.stateFileName)),failArmPhotos=module.cancelledPhotos
  let failArmNotices=UNUserNotificationCenter.instance.reads,failArmCore=FreedAdultProtectionRuntime.value.cleanupStatusReads
  RuntimeLock.lastAccessFailure=nil
  try FileManager.default.setAttributes([.posixPermissions:0o500],ofItemAtPath:RuntimeLock.directory.path)
  let armFailure=module.executeAccountProtectionCleanup(operationID:failArmID)
  try FileManager.default.setAttributes([.posixPermissions:0o700],ofItemAtPath:RuntimeLock.directory.path)
  require(try Data(contentsOf:RuntimeLock.directory.appendingPathComponent(FreedProtectionConfigurationLock.stateFileName))==failArmBytes && runtime.ownerVerified,"Arming commit failure preserves exact native bytes and current authority")
  require(module.cancelledPhotos==failArmPhotos && failedArmFamily==0 && FreedAppGroupPicker.bindingID==failArmHandle && FreedWebsiteProbePicker.bindingID==failArmHandle,"Arming commit failure cancels no original-owned process resource")
  require(UNUserNotificationCenter.instance.reads==failArmNotices && FreedAdultProtectionRuntime.value.cleanupStatusReads==failArmCore,"Arming commit failure starts no notice or Core work")
  require(try module.statusCleanup(operationID:failArmID)["executionAdmitted"] as? Bool==false,"Failed arming never reports durable execution acceptance")
  require(armFailure["failureStage"] as? String=="native-cleanup-execution-intent" && RuntimeLock.lastAccessFailure?["stage"] as? String=="state-commit","Arming failure is the actual atomic commit failure before process work")
  print("NATIVE_ARM_COMMIT_FAILURE="+String(data:try JSONSerialization.data(withJSONObject:RuntimeLock.lastAccessFailure!),encoding:.utf8)!)
  _=module.executeAccountProtectionCleanup(operationID:failArmID)
  for _ in 0..<40 {await Task.yield()}
  // A reservation and even its later explicit execution cannot take B's scope.
  try fresh();let (reservedA,reservedAH)=try seeded(runtime)
  let reservedOld=try runtime.prepareCleanup(scope:reservedA,handle:reservedAH)
  let (_,reservedB)=try bind(runtime,"[\"reservation-B\",0]")
  let reservedBH=reservedB["bindingHandle"] as! String
  module.earnedPhotoBindingID=reservedBH;FreedAppGroupPicker.bindingID=reservedBH;FreedWebsiteProbePicker.bindingID=reservedBH
  module.pendingFamilyPickerBindingID=reservedBH;var reservedBCancelled=0;module.pendingFamilyPickerReset={reservedBCancelled += 1}
  let reservedBPrivate=try RuntimeLock.withExclusiveAccess {$0.data(forKey:FreedAppGroupsPolicy.key)!}
  let reservedBPhotos=module.cancelledPhotos
  module.reconcileAccountProtectionCleanup()
  _=module.executeAccountProtectionCleanup(operationID:reservedOld.operationID)
  require(try RuntimeLock.withExclusiveAccess {$0.data(forKey:FreedAppGroupsPolicy.key)!}==reservedBPrivate && runtime.ownerVerified,"Stale A execution cannot erase or refence B's private binding")
  require(module.cancelledPhotos==reservedBPhotos && reservedBCancelled==0 && FreedAppGroupPicker.bindingID==reservedBH && FreedWebsiteProbePicker.bindingID==reservedBH,"Prepared/retried A preserves B photo, both pickers and family work")
  // Additive marker compatibility: old merely prepared work stays inert;
  // positive legacy fences resume without inventing historical JS confirmation.
  func setExecutionMarker(_ id:String,_ marker:Any?) throws {
   try RuntimeLock.withExclusiveAccess { d in
    var journal=(try JSONSerialization.jsonObject(with:d.data(forKey:FreedAccountProtectionCleanup.key)!)) as! [String:Any]
    var records=journal["records"] as! [[String:Any]]
    let index=records.firstIndex{$0["operationID"] as? String==id}!
    if let marker {records[index]["executionRequested"]=marker}else{records[index].removeValue(forKey:"executionRequested")}
    journal["records"]=records;d.set(try JSONSerialization.data(withJSONObject:journal),forKey:FreedAccountProtectionCleanup.key)
   }
  }
  try fresh();let (legacyReservedScope,legacyReservedHandle)=try seeded(runtime)
  let compatibilityModule=CleanupModuleHarness()
  let legacyReservation=try compatibilityModule.prepareAccountProtectionCleanup(scope:legacyReservedScope,handle:legacyReservedHandle),legacyReservationID=legacyReservation["operationID"] as! String
  try setExecutionMarker(legacyReservationID,nil)
  let legacyReservedBytes=try Data(contentsOf:RuntimeLock.directory.appendingPathComponent(FreedProtectionConfigurationLock.stateFileName))
  compatibilityModule.reconcileAccountProtectionCleanup();CleanupModuleHarness().reconcileAccountProtectionCleanup()
  require(try Data(contentsOf:RuntimeLock.directory.appendingPathComponent(FreedProtectionConfigurationLock.stateFileName))==legacyReservedBytes && runtime.ownerVerified,"Missing legacy marker on prepared reservation never invents execution intent")
  rejected {_=try RuntimeLock.withExclusiveAccess {try FreedAccountProtectionCleanup.fence(legacyReservationID,$0)}}
  require(try compatibilityModule.statusCleanup(operationID:legacyReservationID)["executionAdmitted"] as? Bool==false,"Lower fence and status cannot arm an unrequested reservation")
  _=compatibilityModule.executeAccountProtectionCleanup(operationID:legacyReservationID)
  for _ in 0..<40 {await Task.yield()}
  try setExecutionMarker(legacyReservationID,nil)
  let historicalBytes=try Data(contentsOf:RuntimeLock.directory.appendingPathComponent(FreedProtectionConfigurationLock.stateFileName)),historicalPhotos=compatibilityModule.cancelledPhotos
  compatibilityModule.reconcileAccountProtectionCleanup()
  let historicalReplay=compatibilityModule.executeAccountProtectionCleanup(operationID:legacyReservationID)
  require(historicalReplay["replayed"] as? Bool==true && historicalReplay["executionRequested"] as? Bool==false && historicalReplay["executionState"] as? String=="completed","Historical terminal replay preserves outcome without certifying explicit JS/cloud intent")
  require(try Data(contentsOf:RuntimeLock.directory.appendingPathComponent(FreedProtectionConfigurationLock.stateFileName))==historicalBytes && compatibilityModule.cancelledPhotos==historicalPhotos,"Legacy terminal replay is still zero-effect")
  try fresh();let (legacyFenceScope,legacyFenceHandle)=try seeded(runtime)
  let legacyFenceModule=CleanupModuleHarness(),legacyFenceReservation=try legacyFenceModule.prepareAccountProtectionCleanup(scope:legacyFenceScope,handle:legacyFenceHandle)
  let legacyFenceID=legacyFenceReservation["operationID"] as! String
  RuntimeLock.stopAfterNextFenceCommit=true
  _=legacyFenceModule.executeAccountProtectionCleanup(operationID:legacyFenceID)
  let committedLegacy=try RuntimeLock.withExclusiveAccess {try FreedAccountProtectionCleanup.required(legacyFenceID,$0)}
  require(committedLegacy.phase == .fenced && !committedLegacy.privateStoreErased,"Actual Module fixture pauses after committed fence before private erasure")
  try setExecutionMarker(legacyFenceID,nil)
  let legacyFenceStatus=try legacyFenceModule.statusCleanup(operationID:legacyFenceID)
  require(legacyFenceStatus["executionAdmitted"] as? Bool==true && legacyFenceStatus["executionRequested"] as? Bool==false && legacyFenceStatus["executionState"] as? String=="legacyInProgress","Missing-marker legacy fence is admitted without fabricated explicit/cloud confirmation")
  // Explicit false with an incompatible fenced phase is unavailable, not legacy.
  let goodLegacyJournal=try RuntimeLock.withExclusiveAccess {$0.data(forKey:FreedAccountProtectionCleanup.key)!}
  try setExecutionMarker(legacyFenceID,false)
  let falseMarkerBytes=try Data(contentsOf:RuntimeLock.directory.appendingPathComponent(FreedProtectionConfigurationLock.stateFileName))
  rejected {_=try legacyFenceModule.statusCleanup(operationID:legacyFenceID)}
  legacyFenceModule.reconcileAccountProtectionCleanup();_=legacyFenceModule.executeAccountProtectionCleanup(operationID:legacyFenceID)
  require(try Data(contentsOf:RuntimeLock.directory.appendingPathComponent(FreedProtectionConfigurationLock.stateFileName))==falseMarkerBytes,"Incompatible explicit-false marker cannot become a valid completion or empty journal")
  try RuntimeLock.withExclusiveAccess {$0.set(goodLegacyJournal,forKey:FreedAccountProtectionCleanup.key)}
  let legacyCold=CleanupModuleHarness();legacyCold.cleanupRuntime=FreedAppGroupsRuntime()
  legacyCold.reconcileAccountProtectionCleanup()
  for _ in 0..<40 {await Task.yield()}
  try RuntimeLock.withExclusiveAccess { d in
   let completed=try FreedAccountProtectionCleanup.required(legacyFenceID,d)
   require(completed.terminal && completed.nativeEpoch==committedLegacy.nativeEpoch && completed.resultingGeneration==committedLegacy.resultingGeneration,"Legacy fenced cold resume preserves its original native epoch/generation")
  }
  // Arming was committed for A, then B replaces it before any native fence.
  try fresh();let (preFenceA,preFenceAH)=try seeded(runtime)
  let preFenceModule=CleanupModuleHarness(),preFenceReservation=try preFenceModule.prepareAccountProtectionCleanup(scope:preFenceA,handle:preFenceAH)
  RuntimeLock.stopAfterNextArmingCommit=true
  _=preFenceModule.executeAccountProtectionCleanup(operationID:preFenceReservation["operationID"] as! String)
  let (_,preFenceB)=try bind(runtime,"[\"armed-before-fence-B\",0]")
  let preFenceBH=preFenceB["bindingHandle"] as! String
  preFenceModule.earnedPhotoBindingID=preFenceBH;FreedAppGroupPicker.bindingID=preFenceBH;FreedWebsiteProbePicker.bindingID=preFenceBH
  preFenceModule.pendingFamilyPickerBindingID=preFenceBH;var preFenceBFamily=0;preFenceModule.pendingFamilyPickerReset={preFenceBFamily += 1}
  let preFenceBBytes=try Data(contentsOf:RuntimeLock.directory.appendingPathComponent(FreedProtectionConfigurationLock.stateFileName))
  preFenceModule.reconcileAccountProtectionCleanup()
  require(try Data(contentsOf:RuntimeLock.directory.appendingPathComponent(FreedProtectionConfigurationLock.stateFileName))==preFenceBBytes && runtime.ownerVerified,"Armed-before-fence A automatic retry performs no write or native fence against B")
  require(preFenceModule.cancelledPhotos==0 && preFenceBFamily==0 && FreedAppGroupPicker.bindingID==preFenceBH && FreedWebsiteProbePicker.bindingID==preFenceBH,"Armed A's lost acknowledgement cannot cancel B process resources")
  // Unknown/corrupt marker bytes remain intact/unavailable on every entry.
  try fresh();let (unknownScope,unknownHandle)=try seeded(runtime)
  let unknownModule=CleanupModuleHarness(),unknownReservation=try unknownModule.prepareAccountProtectionCleanup(scope:unknownScope,handle:unknownHandle)
  let unknownID=unknownReservation["operationID"] as! String
  try setExecutionMarker(unknownID,"not-a-boolean")
  let unknownBytes=try Data(contentsOf:RuntimeLock.directory.appendingPathComponent(FreedProtectionConfigurationLock.stateFileName))
  rejected {_=try unknownModule.statusCleanup(operationID:unknownID)}
  unknownModule.reconcileAccountProtectionCleanup()
  let unknownResult=unknownModule.executeAccountProtectionCleanup(operationID:unknownID)
  require(unknownResult["privateCleanupAccepted"] as? Bool==false && unknownModule.cancelledPhotos==0,"Unknown execution marker is unavailable rather than armed success")
  require(try Data(contentsOf:RuntimeLock.directory.appendingPathComponent(FreedProtectionConfigurationLock.stateFileName))==unknownBytes,"Corrupt marker never replaces or erases its native snapshot")
  print("Task82 inert prepare / durable explicit execution / arming failure / cold resume / original-ID retry / B: PASS")
  print("Task82 actual runtime / Module cleanup / atomic filesystem: replay, missing/corrupt retention, envelope, phases, new owner and native sessions PASS")
 }
}
