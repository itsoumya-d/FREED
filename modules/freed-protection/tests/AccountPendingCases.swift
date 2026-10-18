import Foundation
@main struct PendingCases {
 @MainActor static func main()throws {
  let parent=FileManager.default.temporaryDirectory.appendingPathComponent("freed-pending-\(UUID().uuidString)");try FileManager.default.createDirectory(at:parent,withIntermediateDirectories:true);defer{try? FileManager.default.removeItem(at:parent)}
  RuntimeLock.directory=parent;RuntimeLock.domain="freed.pending.\(UUID().uuidString)"
  let r=FreedAppGroupsRuntime.shared,h=PendingModuleHarness(),module=UUID();FreedAccountBindingLifecycle.created(module:module)
  func bind(_ owner:String)throws->(FreedAccountBindingSessionState,String){let session=try FreedAccountBindingLifecycle.issue(module:module);try r.installBindingSession(session);let p=try r.prepareBinding(scope:"[\"\(owner)\",1]",session:session.id,transition:UUID().uuidString,sequence:1);return(session,try r.commitBinding(ticket:p["ticket"] as! String,session:session.id)["actionScope"] as! String)}
  let (session,a)=try bind("A");func snapshot()->[String:Any]{r.snapshot(a)};func revision()->Int{snapshot()["revision"] as! Int}
  precondition(r.create(["version":1,"expectedStoreRevision":revision(),"name":"One"],a)["accepted"] as? Bool==true)
  var g=(snapshot()["groups"] as! [[String:Any]])[0];let token=TestToken(value:"one");var selection=FamilyActivitySelection();selection.applicationTokens=[token]
  func target()->[String:Any]{["version":1,"expectedStoreRevision":revision(),"id":g["id"]!,"expectedRevision":g["revision"]!]}
  precondition(r.update(target(),a,selectionData:try! JSONEncoder().encode(selection))["accepted"] as? Bool==true);g=(snapshot()["groups"] as! [[String:Any]])[0]
  var update=target();update["name"]="One";update["enabled"]=true;update["rule"]=["kind":"before-use"];update["packages"]=[String]();precondition(r.update(update,a)["accepted"] as? Bool==true)
  let issued=try RuntimeLock.withExclusiveAccess{r.issueScope(for:token,$0)!},id=UUID().uuidString.lowercased()
  func seed(_ id:String,_ scope:[String:Any],_ date:Date=Date())throws{try RuntimeLock.withExclusiveAccess{$0.set(try JSONSerialization.data(withJSONObject:["id":id,"host":"screen-time-shield.freed.local","sourcePackage":"ios-screen-time","reason":"Selected app boundary","matchedRule":"app-group","detectedAt":ISO8601DateFormatter().string(from:date),"scope":scope]),forKey:"freed.pendingIntervention.record")}}
  try seed(id,issued)
  precondition(h.getPending(actionScope:a)?["interventionId"] as? String==id,"Acknowledged v2 reads actual original group interruption")
  precondition(h.clearPending(expectedInterventionId:UUID().uuidString.lowercased(),actionScope:a)==false,"Wrong ID cannot claim")
  h.pendingInterventionClaimLock.lock();let busy=h.clearPending(expectedInterventionId:id,actionScope:a);h.pendingInterventionClaimLock.unlock()
  precondition(!busy&&h.getPending(actionScope:a)?["interventionId"] as? String==id,"Busy claim returns retryable failure without waiting or consuming")
  precondition(h.clearPending(expectedInterventionId:id,actionScope:a),"Exact admitted v2 clear commits claim")
  precondition(!h.clearPending(expectedInterventionId:id,actionScope:a)&&h.getPending(actionScope:a)==nil,"Exact clear reply loss replays without a second native claim")
  try RuntimeLock.withExclusiveAccess{d in precondition(FreedAppGroupsPolicy.decode(d.data(forKey:FreedAppGroupsPolicy.key))!.claim?.interventionId==id,"Claim remains original native application authority");precondition(d.object(forKey:"freed.pendingIntervention.unlockScope")==nil,"Group claim cannot create generic unlock")}
  #if TASK86_CANCELLATION
  if CommandLine.arguments.contains("cancellation") || CommandLine.arguments.contains("cancellation-busy") {
   let parts=try JSONSerialization.jsonObject(with:Data(a.utf8)) as! [Any],handle=parts[2] as! String
   var request=issued;request["version"]=2;request["policyVersion"]=2;request["nativeInterventionId"]=id;request["kind"]="ios-app-group";request["tokenType"]="application";request["requestedSeconds"]=300
   request.removeValue(forKey:"token");request.removeValue(forKey:"issuedAt");request.removeValue(forKey:"issuedUptime");request.removeValue(forKey:"bootIdentity")
   let offer=r.prepareEarnedAppTimeOffer(request,a)["offer"] as! [String:Any]
   let begin=r.beginEarnedChallengeEvidence(["version":1,"offerId":offer["offerId"]!,"completionSessionId":"cancel-session","templateId":"momentum-move-steps:earned-v2:300","templateVersion":2,"method":"steps"],a)
   let evidence=(begin["session"] as! [String:Any])["evidenceSessionId"] as! String
   #if TASK86_CANCELLATION_MODERN
   if CommandLine.arguments.contains("cancellation-busy") {
    let entered=DispatchSemaphore(value:0),release=DispatchSemaphore(value:0),done=DispatchSemaphore(value:0)
    FixtureSteps.shared.onStop={entered.signal();_ = release.wait(timeout:.now()+5)}
    DispatchQueue.global().async{_ = r.cancelOwnedChallengeObservation(binding:handle,evidenceSessionID:evidence);done.signal()}
    precondition(entered.wait(timeout:.now()+3) == .success,"Actual runtime cancellation acquired observation gate")
    let pending=r.cancelOwnedChallengeObservation(binding:handle,evidenceSessionID:evidence)
    release.signal();precondition(done.wait(timeout:.now()+3) == .success)
    precondition(pending=="pending","Contended runtime cancellation returns pending without reverse waiting")
    print("Actual cancellation-only runtime contention returns pending and settles without policy/proof mutation");return
   }
   #endif
   h.earnedPhotoBindingID=handle;h.earnedPhotoEvidenceSessionId=evidence;h.earnedPhotoOperationId="camera-A";h.earnedPhotoOwnerScope=a
   var groupCancels=0;FreedAppGroupPicker.bindingID=handle;FreedAppGroupPicker.presentationID=UUID();FreedAppGroupPicker.cancel={groupCancels += 1}
   let bytes=try RuntimeLock.withExclusiveAccess{$0.dictionaryRepresentation() as NSDictionary};session.retire();let result=h.cancelResources(binding:handle)
   precondition(result["state"] as? String=="pending"&&result["osDismissalConfirmed"] as? Bool==false,"Retired native binding requests exact camera/picker cancellation without certifying OS dismissal")
   precondition(result["observationState"] as? String=="cancelled","Actual runtime stops the observed evidence resource after admission retirement")
   precondition(groupCancels==1&&h.challengeCamera.cancels==1&&h.photoPipeline.cancels==["camera-A"],"Actual Module helpers invoke only original process resources")
   precondition(h.cancelResources(binding:handle)["state"] as? String=="pending"&&groupCancels==1&&h.challengeCamera.cancels==1,"Exact replay has zero process effects and keeps unobserved picker dismissal pending")
   try RuntimeLock.withExclusiveAccess{precondition(bytes.isEqual(to:$0.dictionaryRepresentation()),"Cancellation after revocation writes no proof/history/policy")}
   let (_,b)=try bind("B"),bparts=try JSONSerialization.jsonObject(with:Data(b.utf8)) as! [Any],bhandle=bparts[2] as! String
   let newer=UUID().uuidString.lowercased();h.earnedPhotoBindingID=bhandle;h.earnedPhotoEvidenceSessionId=newer;h.earnedPhotoOperationId="camera-B";FreedAppGroupPicker.bindingID=bhandle;FreedAppGroupPicker.presentationID=UUID();FreedAppGroupPicker.cancel={groupCancels += 10}
   precondition(h.cancelResources(binding:handle)["state"] as? String=="pending"&&h.earnedPhotoOperationId=="camera-B"&&groupCancels==1,"Late A retains its own pending dismissal and cannot cancel B resources")
   precondition(h.cancelResources(binding:bhandle,evidence:evidence)["state"] as? String=="notApplicable"&&h.earnedPhotoOperationId=="camera-B","Old individual evidence cannot cancel newer same-binding capture")
   h.earnedPhotoOperationId="camera-C2"
   precondition(h.cancelResources(binding:bhandle,evidence:newer,capture:"camera-C1")["state"] as? String=="notApplicable"&&h.earnedPhotoOperationId=="camera-C2","Delayed C1 disposal cannot cancel newer C2 with the same binding and evidence ID")
   precondition(h.cancelResources(binding:bhandle,evidence:newer)["state"] as? String=="notApplicable"&&h.earnedPhotoOperationId=="camera-C2","Individual cancellation without exact capture identity cannot cancel camera")
   precondition(h.cancelResources(binding:bhandle,evidence:newer,capture:"camera-C2")["state"] as? String=="pending"&&h.earnedPhotoOperationId==nil,"Exact C2 capture cancellation remains requested and never certifies OS dismissal")
   FreedAppGroupPicker.cancel=nil;precondition(h.cancelResources(binding:bhandle)["state"] as? String=="unavailable","Matched picker without cancellation delegate is unavailable")
   print("Actual cancellation-only Module/runtime/picker methods: retirement, exact replay, B/new evidence isolation, no policy/proof writes and unavailable delegate passed");return
  }
  #endif
  let old=UUID().uuidString.lowercased();try seed(old,issued,Date(timeIntervalSinceNow:-700));precondition(h.getPending(actionScope:a)==nil,"Stale event is never published")
  let pending=UUID().uuidString.lowercased();try seed(pending,issued);session.retire();precondition(h.getPending(actionScope:a)==nil && !h.clearPending(expectedInterventionId:pending,actionScope:a),"Retired session cannot read or consume")
  let (_,same)=try bind("A");precondition(same != a&&h.getPending(actionScope:a)==nil,"Same owner re-admission cannot revive old scope")
  precondition(h.getPending(actionScope:same)?["interventionId"] as? String==pending,"Fresh same-owner admission retains actual interruption")
  let (_,b)=try bind("B");let bytes=try RuntimeLock.withExclusiveAccess{$0.dictionaryRepresentation() as NSDictionary};precondition(h.getPending(actionScope:a)==nil && !h.clearPending(expectedInterventionId:pending,actionScope:a),"Old A callbacks cannot claim under B")
  try RuntimeLock.withExclusiveAccess{precondition(bytes.isEqual(to:$0.dictionaryRepresentation()),"Rejected A read/clear leaves B byte-identical")}
  let site=UUID().uuidString.lowercased();try seed(site,["kind":"ios-token","tokenType":"domain","token":Data("site".utf8).base64EncodedString(),"websiteProbeRevision":7,"websiteProbeOwner":"website-owner"])
  precondition(h.getPending(actionScope:b)?["interventionId"] as? String==site&&h.clearPending(expectedInterventionId:site,actionScope:b),"Validated website recovery remains a safe claim")
  try RuntimeLock.withExclusiveAccess{precondition($0.data(forKey:"freed.pendingIntervention.unlockScope")==nil,"Website recovery never stages app/adult unlock")}
  let denied=UUID().uuidString.lowercased();try seed(denied,["kind":"ios-token","tokenType":"domain","token":Data("site".utf8).base64EncodedString(),"websiteProbeRevision":6,"websiteProbeOwner":"website-owner"]);precondition(h.getPending(actionScope:b)==nil && !h.clearPending(expectedInterventionId:denied,actionScope:b),"Invalid website origin cannot be consumed")
  precondition(ManagedSettingsStore.adultProtected,"Adult protection stays installed")
  print("Actual pending exports/runtime: v2 read/exact claim, lost-clear reply, stale event, retirement, same owner, B isolation, website no-unlock passed")
 }
}
