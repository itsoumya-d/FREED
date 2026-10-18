import Foundation
import Darwin

final class EvidenceStepAdapter:FreedChallengeStepObserving {
 var available=true
 let processId=UUID().uuidString.lowercased()
 var observations:[(Date,(FreedChallengeStepSample?,String?)->Void)]=[]
 var stops=0
 func start(from:Date,receive:@escaping(FreedChallengeStepSample?,String?)->Void){observations.append((from,receive))}
 func stop(){stops += 1}
 func emit(_ count:Int,now:Date,index:Int?=nil){let (start,callback)=observations[index ?? observations.count-1];callback(FreedChallengeStepSample(count:count,start:start.timeIntervalSince1970,end:now.timeIntervalSince1970),nil);RunLoop.current.run(until:Date().addingTimeInterval(0.02))}
 func fail(_ reason:String){observations.last!.1(nil,reason);RunLoop.current.run(until:Date().addingTimeInterval(0.02))}
}
@main struct ChallengeEvidenceRuntimeCases {
 static var now=Date(timeIntervalSince1970:1_900_022_400),uptime=10_000.0,boot="boot-A"
 static func main()throws {
  func expect(_ condition:Bool,_ message:String){if !condition{FileHandle.standardError.write(Data(("FAIL: "+message+"\n").utf8));exit(1)}}
  let directory=FileManager.default.temporaryDirectory.appendingPathComponent("freed-earned-v2-\(UUID().uuidString)"),domain="app.freed.earned-v2.\(UUID().uuidString)"
  try FileManager.default.createDirectory(at:directory,withIntermediateDirectories:true);RuntimeLock.directory=directory;RuntimeLock.domain=domain
  defer{try? FileManager.default.setAttributes([.posixPermissions:0o700],ofItemAtPath:directory.path);UserDefaults(suiteName:domain)?.removePersistentDomain(forName:domain);try? FileManager.default.removeItem(at:directory)}
  let sensor=EvidenceStepAdapter()
  func runtime(_ sensor:EvidenceStepAdapter)->FreedAppGroupsRuntime {FreedAppGroupsRuntime(clock:FreedAppGroupsClock(now:{now},uptime:{uptime},bootIdentity:{boot}),challengeSteps:sensor)}
  let r=runtime(sensor),owner="[\"owner-A\",1]",token=TestToken(value:"origin"),other=TestToken(value:"other")
  let scenario=CommandLine.arguments[1]
  precondition(r.setScope(owner)["accepted"] as? Bool==true)
  func state()throws->FreedAppGroupsState {try RuntimeLock.withExclusiveAccess{FreedAppGroupsPolicy.decode($0.data(forKey:FreedAppGroupsPolicy.key))!}}
  func ledger()throws->FreedEarnedAppTimeState {try RuntimeLock.withExclusiveAccess{FreedEarnedAppTimeState.decode($0.data(forKey:FreedEarnedAppTimePolicy.key))!}}
  func group(_ id:String?=nil)->[String:Any] {(r.snapshot(owner)["groups"] as! [[String:Any]]).first{ id==nil || $0["id"] as? String==id }!}
  func target(_ id:String)->[String:Any] {let s=r.snapshot(owner),g=group(id);return["version":1,"expectedStoreRevision":s["revision"]!,"id":id,"expectedRevision":g["revision"]!]}
  func create(_ tokens:Set<TestToken>)->String {
   let s=r.snapshot(owner);precondition(r.create(["version":1,"expectedStoreRevision":s["revision"]!,"name":"Focus"],owner)["accepted"] as? Bool==true)
   let g=(r.snapshot(owner)["groups"] as! [[String:Any]]).last!,id=g["id"] as! String
   var selection=FamilyActivitySelection();selection.applicationTokens=tokens
   precondition(r.update(target(id),owner,selectionData:try! JSONEncoder().encode(selection))["accepted"] as? Bool==true)
   var q=target(id);q["name"]="Focus";q["enabled"]=true;q["packages"]=[String]();q["rule"]=["kind":"before-use"]
   precondition(r.update(q,owner)["accepted"] as? Bool==true)
   return id
  }
  let id=create([token,other]),file=directory.appendingPathComponent("freed-enforcement-state.v1.plist")
  func issue()->[String:Any] {try! RuntimeLock.withExclusiveAccess{d in let scope=r.issueScope(for:token,d)!,event=UUID().uuidString.lowercased();precondition(r.stageClaim(id:event,scope:scope,d));return["version":2,"policyVersion":2,"nativeInterventionId":event,"groupId":scope["groupId"]!,"groupRevision":scope["groupRevision"]!,"configurationGeneration":scope["configurationGeneration"]!,"scopeEpoch":scope["scopeEpoch"]!,"kind":"ios-app-group","tokenType":"application","requestedSeconds":300]}}
  func offer(_ q:[String:Any])->[String:Any] {let result=r.prepareEarnedAppTimeOffer(q,owner);precondition(result["accepted"] as? Bool==true,"Offer rejected: \(result)");return result["offer"] as! [String:Any]}
  func grant(_ offer:[String:Any],session:String="session")->[String:Any] {let seconds=offer["requestedSeconds"] as! Int;return["version":2,"policyVersion":2,"offerId":offer["offerId"]!,"completionSessionId":session,"category":"breathe","templateId":"momentum-breathe-soft:earned-v2:\(seconds)","templateVersion":2,"evidence":["method":"timer","activeDurationSec":seconds==300 ? 60:120,"observedSteps":0,"photoProofIds":[String]()]]}
  func cap(_ minutes:Int)->[String:Any] {var q=target(id);q["version"]=2;q["name"]="Focus";q["enabled"]=true;q["packages"]=[String]();q["rule"]=["kind":"before-use"];q["extraTimeCapMinutes"]=minutes;return r.updateAppGroupWithEarnedTime(q,owner)}
  func advance(_ seconds:Double){now=now.addingTimeInterval(seconds);uptime += seconds}
  func isShielded(_ target:TestToken)->Bool {ManagedSettingsStore.shields.values.contains{($0.applications ?? []).contains(target)}}
  func begin(_ offered:[String:Any],session:String="challenge",template:String?=nil)->[String:Any] {["version":1,"offerId":offered["offerId"]!,"completionSessionId":session,"templateId":template ?? "momentum-move-steps:earned-v2:\(offered["requestedSeconds"] as! Int)","templateVersion":2,"method":"steps"]}
  func command(_ id:String,phase:String?=nil)->[String:Any] {var q:[String:Any]=["version":1,"evidenceSessionId":id];if let phase{q["phase"]=phase};return q}
  func live(_ receipt:[String:Any])->[String:Any] {precondition(receipt["accepted"] as? Bool==true,"Native evidence rejected: \(receipt)");return receipt["session"] as! [String:Any]}
  func stepsGrant(_ offered:[String:Any],_ completed:[String:Any])->[String:Any] {["version":2,"policyVersion":2,"offerId":offered["offerId"]!,"completionSessionId":completed["completionSessionId"]!,"category":"move","templateId":completed["templateId"]!,"templateVersion":2,"evidence":["method":"steps","activeDurationSec":0,"observedSteps":completed["observedSteps"]!,"photoProofIds":[String](),"stepProofId":completed["stepProofId"]!]]}
  if scenario=="unavailable" {sensor.available=false}
  var offeredRequest=issue();if ["steps600","cancel-partial-photo","steps1200"].contains(scenario){offeredRequest["requestedSeconds"]=600}
  if scenario=="steps1200"{offeredRequest["requestedSeconds"]=1200}
  let offered=offer(offeredRequest)
  if scenario=="unavailable" {
   precondition(offered["availableMethods"] as? [String]==["timer"])
   precondition(r.beginEarnedChallengeEvidence(begin(offered),owner)["accepted"] as? Bool==false)
   print("Native challenge evidence runtime passed: unavailable");return
  }
  precondition(offered["availableMethods"] as? [String]==["timer","steps"])
  let beginRequest=begin(offered),initial=live(r.beginEarnedChallengeEvidence(beginRequest,owner)),sessionId=initial["evidenceSessionId"] as! String
  let query=command(sessionId)
  if scenario=="idempotent" {
   let replay=live(r.beginEarnedChallengeEvidence(beginRequest,owner))
   precondition(replay["evidenceSessionId"] as? String==sessionId && sensor.observations.count==1)
   advance(10);sensor.emit(30,now:now)
   let completed=live(r.finishEarnedChallengeEvidence(query,owner)),same=live(r.beginEarnedChallengeEvidence(beginRequest,owner))
   precondition(same["evidenceSessionId"] as? String==sessionId && same["stepProofId"] as? String==completed["stepProofId"] as? String)
  }else if scenario=="steps300" || scenario=="steps600" || scenario=="steps1200" {
   let needed=scenario=="steps300" ? 30:60
   advance(10);sensor.emit(needed-1,now:now)
   precondition(r.finishEarnedChallengeEvidence(query,owner)["reason"] as? String=="challenge-evidence-incomplete")
   let fake:[String:Any]=["version":2,"policyVersion":2,"offerId":offered["offerId"]!,"completionSessionId":"challenge","category":"move","templateId":initial["templateId"]!,"templateVersion":2,"evidence":["method":"steps","activeDurationSec":0,"observedSteps":needed,"photoProofIds":[String](),"stepProofId":UUID().uuidString.lowercased()]]
   precondition(r.grantEarnedAppTimeBreak(fake,owner)["accepted"] as? Bool==false && isShielded(token))
   advance(1);sensor.emit(needed,now:now)
   let completed=live(r.finishEarnedChallengeEvidence(query,owner)),request=stepsGrant(offered,completed)
   let accepted=r.grantEarnedAppTimeBreak(request,owner);precondition(accepted["accepted"] as? Bool==true && !isShielded(token) && isShielded(other) && ManagedSettingsStore.adultProtected)
   precondition((try! ledger()).challengeProofs!.values.first!.consumedBy=="challenge")
   advance(10);let replay=r.grantEarnedAppTimeBreak(request,owner)
   let spentAfterRetry=(try! ledger()).budgets.values.first!.spentSeconds,requestedSeconds=offered["requestedSeconds"] as! Int
   precondition(replay["accepted"] as? Bool==true && replay["replayed"] as? Bool==true && replay["expiresAt"] as? String==accepted["expiresAt"] as? String && spentAfterRetry==requestedSeconds)
  }else if scenario=="pause" {
   advance(10);sensor.emit(10,now:now)
   precondition(r.setEarnedChallengeEvidencePhase(command(sessionId,phase:"paused"),owner)["accepted"] as? Bool==true)
   advance(20);sensor.emit(100,now:now,index:0)
   precondition(live(r.getEarnedChallengeEvidence(query,owner))["observedSteps"] as? Int==10)
   precondition(r.setEarnedChallengeEvidencePhase(command(sessionId,phase:"active"),owner)["accepted"] as? Bool==true)
   advance(10);sensor.emit(100,now:now,index:0);sensor.emit(20,now:now)
   precondition(live(r.finishEarnedChallengeEvidence(query,owner))["observedSteps"] as? Int==30)
  }else if scenario=="permission" {
   sensor.fail("steps-permission-denied")
   let denied=r.getEarnedChallengeEvidence(query,owner)
   precondition(denied["accepted"] as? Bool==false && denied["reason"] as? String=="steps-permission-denied" && (denied["session"] as! [String:Any])["phase"] as? String=="cancelled")
   precondition(r.finishEarnedChallengeEvidence(query,owner)["accepted"] as? Bool==false && (try! ledger()).challengeProofs==nil)
   advance(10);sensor.emit(30,now:now);precondition((try! ledger()).challengeSessions![sessionId]!.observedSteps==0)
  }else if scenario=="restart" {
   advance(10);sensor.emit(20,now:now)
   let nextSensor=EvidenceStepAdapter(),cold=runtime(nextSensor);precondition(cold.setScope(owner)["accepted"] as? Bool==true)
   precondition(cold.getEarnedChallengeEvidence(query,owner)["reason"] as? String=="challenge-evidence-restart-required")
   precondition(cold.finishEarnedChallengeEvidence(query,owner)["accepted"] as? Bool==false)
   let retry=live(cold.beginEarnedChallengeEvidence(beginRequest,owner));precondition(retry["evidenceSessionId"] as? String != sessionId && retry["observedSteps"] as? Int==0)
   advance(10);nextSensor.emit(30,now:now)
   let completed=live(cold.finishEarnedChallengeEvidence(command(retry["evidenceSessionId"] as! String),owner))
   let restored=runtime(EvidenceStepAdapter());precondition(restored.setScope(owner)["accepted"] as? Bool==true)
   let reread=live(restored.getEarnedChallengeEvidence(command(completed["evidenceSessionId"] as! String),owner));precondition(reread["stepProofId"] as? String==completed["stepProofId"] as? String)
   precondition(restored.grantEarnedAppTimeBreak(stepsGrant(offered,reread),owner)["accepted"] as? Bool==true)
  }else if scenario=="cancel-completed-proof" {
   advance(10);sensor.emit(30,now:now)
   let completed=live(r.finishEarnedChallengeEvidence(query,owner)),proofId=completed["stepProofId"] as! String,request=stepsGrant(offered,completed)
   // Native finish succeeded but JS durable save is still unfinished. Cancel
   // must cross the strict bridge so replacement/discard can proceed.
   let receipt=r.setEarnedChallengeEvidencePhase(command(sessionId,phase:"cancelled"),owner),cancelled=live(receipt)
   print("NATIVE_CANCELLED_RECEIPT="+String(data:try JSONSerialization.data(withJSONObject:["offer":offered,"begin":beginRequest,"receipt":receipt]),encoding:.utf8)!);fflush(stdout)
   expect(cancelled["phase"] as? String=="cancelled" && cancelled["stepProofId"] is NSNull && (cancelled["photoProofIds"] as! [String]).isEmpty && (cancelled["matchedTargetIds"] as! [String]).isEmpty,"Successful cancellation must clear all public proof pointers/targets")
   let persisted=try ledger();precondition(persisted.challengeSessions![sessionId]!.stepProofId==nil && persisted.challengeProofs?[proofId]==nil,"Acknowledged cancellation must revoke its unconsumed native proof record")
   precondition(r.grantEarnedAppTimeBreak(request,owner)["accepted"] as? Bool==false && isShielded(token) && persisted.budgets.values.first!.spentSeconds==0)
  }else if scenario=="cancel-partial-photo" {
   // Fixture represents already minted local partial-photo state. It exercises
   // real cancellation/state I/O without enabling an unevaluated photo target.
   var e=try ledger();let original=e.offers[offered["offerId"] as! String]!
   let photoOffer=FreedEarnedAppTimeOffer(id:original.id,ownerDigest:original.ownerDigest,request:original.request,claim:original.claim,budgetDay:original.budgetDay,budgetRevision:original.budgetRevision,validUntil:original.validUntil,availableMethods:original.availableMethods+["photo"],supportedPhotoTargetIds:["chair","cup"])
   e.offers[original.id]=photoOffer
   let photoBegin=FreedChallengeEvidenceBegin(version:1,offerId:original.id,completionSessionId:"partial-photo",templateId:"momentum-find-chair-cup:earned-v2:600",templateVersion:2,method:"photo")
   var partial=FreedChallengeEvidenceSession.make(photoBegin,binding:FreedChallengeEvidenceBinding.make(photoOffer)!,processId:"local-fixture",now:now.timeIntervalSince1970,supportedTargetIds:["chair","cup"])
   let proof=FreedChallengeEvidenceProof.photo(partial,targetId:"chair",operationId:UUID().uuidString.lowercased(),digest:String(repeating:"a",count:64),providerRevision:"local-state-fixture-not-photo-evaluation",now:now.timeIntervalSince1970)
   partial.matchedTargetIds=["chair"];partial.photoProofIds=[proof.id]
   e.challengeSessions?[partial.id]=partial;e.challengeProofs=[proof.id:proof]
   let encoded=try JSONEncoder().encode(e);precondition(FreedEarnedAppTimeState.decode(encoded) != nil)
   try RuntimeLock.withExclusiveAccess{$0.set(encoded,forKey:FreedEarnedAppTimePolicy.key)}
   let receipt=r.setEarnedChallengeEvidencePhase(command(partial.id,phase:"cancelled"),owner),cancelled=live(receipt)
   print("NATIVE_CANCELLED_RECEIPT="+String(data:try JSONSerialization.data(withJSONObject:["offer":photoOffer.payload,"begin":["version":1,"offerId":photoBegin.offerId,"completionSessionId":photoBegin.completionSessionId,"templateId":photoBegin.templateId,"templateVersion":2,"method":"photo"],"receipt":receipt]),encoding:.utf8)!);fflush(stdout)
   expect((cancelled["matchedTargetIds"] as! [String]).isEmpty && (cancelled["photoProofIds"] as! [String]).isEmpty && cancelled["stepProofId"] is NSNull,"Partial photo cancellation must clear proof/target pointers")
   let persisted=try ledger();precondition(persisted.challengeSessions![partial.id]!.photoProofIds.isEmpty && persisted.challengeProofs?[proof.id]==nil && persisted.budgets.values.first!.spentSeconds==0)

  }else if scenario=="cancel" {
   advance(10);sensor.emit(30,now:now)
   let completed=live(r.finishEarnedChallengeEvidence(query,owner)),request=stepsGrant(offered,completed)
   precondition(r.setEarnedChallengeEvidencePhase(command(sessionId,phase:"cancelled"),owner)["accepted"] as? Bool==true)
   precondition(r.grantEarnedAppTimeBreak(request,owner)["accepted"] as? Bool==false)
   let replacement=live(r.beginEarnedChallengeEvidence(beginRequest,owner));precondition(replacement["evidenceSessionId"] as? String != sessionId)
   advance(10);sensor.emit(30,now:now)
   let done=live(r.finishEarnedChallengeEvidence(command(replacement["evidenceSessionId"] as! String),owner))
   precondition(r.grantEarnedAppTimeBreak(stepsGrant(offered,done),owner)["accepted"] as? Bool==true)
   precondition(r.setEarnedChallengeEvidencePhase(command(done["evidenceSessionId"] as! String,phase:"cancelled"),owner)["accepted"] as? Bool==false && (try! ledger()).budgets.values.first!.spentSeconds==300)
  }else if scenario=="binding" {
   advance(10);sensor.emit(30,now:now);let completed=live(r.finishEarnedChallengeEvidence(query,owner))
   precondition(r.setScope("[\"owner-B\",2]")["accepted"] as? Bool==true)
   precondition(r.getEarnedChallengeEvidence(query,owner)["accepted"] as? Bool==false && r.grantEarnedAppTimeBreak(stepsGrant(offered,completed),owner)["accepted"] as? Bool==false)
   precondition((try! ledger()).budgets.values.first!.spentSeconds==0 && isShielded(token))
  }else if scenario=="failures" {
   advance(10);sensor.emit(30,now:now);let completed=live(r.finishEarnedChallengeEvidence(query,owner)),request=stepsGrant(offered,completed),before=try Data(contentsOf:file)
   DeviceActivityCenter.failNext=true;precondition(r.grantEarnedAppTimeBreak(request,owner)["accepted"] as? Bool==false)
   precondition((try! ledger()).challengeProofs!.values.first!.consumedBy==nil && (try! ledger()).budgets.values.first!.spentSeconds==0 && isShielded(token))
   try FileManager.default.setAttributes([.posixPermissions:0o500],ofItemAtPath:directory.path)
   precondition(r.grantEarnedAppTimeBreak(request,owner)["accepted"] as? Bool==false)
   try FileManager.default.setAttributes([.posixPermissions:0o700],ofItemAtPath:directory.path)
   precondition(try! Data(contentsOf:file)==before)
   precondition((try! ledger()).challengeProofs!.values.first!.consumedBy==nil && isShielded(token))
   precondition(r.grantEarnedAppTimeBreak(request,owner)["accepted"] as? Bool==true)
  }else if scenario=="old-completion" {
   advance(10);sensor.emit(30,now:now);_=live(r.finishEarnedChallengeEvidence(query,owner))
   let second=live(r.beginEarnedChallengeEvidence(begin(offered,session:"second"),owner)),secondId=second["evidenceSessionId"] as! String,beforeStops=sensor.stops
   _=live(r.finishEarnedChallengeEvidence(query,owner));precondition(sensor.stops==beforeStops,"An exact old finish replay cannot stop a newer live sensor interval")
   precondition(r.setEarnedChallengeEvidencePhase(command(sessionId,phase:"cancelled"),owner)["accepted"] as? Bool==true && sensor.stops==beforeStops,"Cancelling unconsumed old proof cannot stop a newer live sensor interval")
   advance(10);sensor.emit(30,now:now)
   let done=live(r.finishEarnedChallengeEvidence(command(secondId),owner));precondition(r.grantEarnedAppTimeBreak(stepsGrant(offered,done),owner)["accepted"] as? Bool==true)
  }else if scenario=="late-replacement" {
   var newOfferRequest=offeredRequest;newOfferRequest["requestedSeconds"]=600;let replacementOffer=offer(newOfferRequest)
   let replacement=live(r.beginEarnedChallengeEvidence(begin(replacementOffer,session:"replacement"),owner)),replacementId=replacement["evidenceSessionId"] as! String
   let beforeStops=sensor.stops;advance(10);sensor.emit(100,now:now,index:0)
   precondition(sensor.stops==beforeStops,"A stale old authority callback cannot stop the newer native sensor interval")
   sensor.emit(60,now:now)
   precondition(live(r.finishEarnedChallengeEvidence(command(replacementId),owner))["observedSteps"] as? Int==60)
  }else if scenario=="finish-write" {
   advance(10);sensor.emit(30,now:now);let before=try Data(contentsOf:file)
   try FileManager.default.setAttributes([.posixPermissions:0o500],ofItemAtPath:directory.path)
   precondition(r.finishEarnedChallengeEvidence(query,owner)["accepted"] as? Bool==false)
   try FileManager.default.setAttributes([.posixPermissions:0o700],ofItemAtPath:directory.path)
   precondition(try! Data(contentsOf:file)==before)
   precondition((try! ledger()).challengeSessions![sessionId]!.phase=="active" && (try! ledger()).challengeSessions![sessionId]!.stepProofId==nil && (try! ledger()).challengeProofs==nil)
   precondition(live(r.finishEarnedChallengeEvidence(query,owner))["stepProofId"] is String)
  }else if scenario=="suspend" {
   advance(10);sensor.emit(20,now:now);r.suspend();precondition(r.setScope(owner)["accepted"] as? Bool==true)
   precondition(r.getEarnedChallengeEvidence(query,owner)["reason"] as? String=="challenge-evidence-restart-required")
   let retry=live(r.beginEarnedChallengeEvidence(beginRequest,owner));precondition(retry["evidenceSessionId"] as? String != sessionId && retry["observedSteps"] as? Int==0)
   advance(10);sensor.emit(30,now:now,index:0)
   precondition(live(r.getEarnedChallengeEvidence(command(retry["evidenceSessionId"] as! String),owner))["observedSteps"] as? Int==0)
  }else if scenario=="photo" {
   var q=beginRequest;q["method"]="photo";q["templateId"]="momentum-find-chair:earned-v2:300"
   precondition(r.beginEarnedChallengeEvidence(q,owner)["reason"] as? String=="photo-verification-unavailable")
   precondition(r.verifyEarnedChallengePhoto(["version":1,"evidenceSessionId":sessionId,"targetId":"chair","captureOperationId":"capture","uri":"file:///tmp/user-photo.jpg"],owner)["reason"] as? String=="native-capture-required")
   precondition((try! ledger()).challengeProofs==nil && isShielded(token))
  }else if scenario=="stale" {
   advance(10);sensor.emit(30,now:now);let completed=live(r.finishEarnedChallengeEvidence(query,owner))
   var updated=target(id);updated["name"]="Changed";updated["enabled"]=true;updated["packages"]=[String]();updated["rule"]=["kind":"before-use"]
   precondition(r.update(updated,owner)["accepted"] as? Bool==true)
   precondition(r.grantEarnedAppTimeBreak(stepsGrant(offered,completed),owner)["accepted"] as? Bool==false && isShielded(token))
   precondition(r.setEarnedChallengeEvidencePhase(command(sessionId,phase:"cancelled"),owner)["accepted"] as? Bool==true,"Same-owner revocation can cancel stale unconsumed proof to permit a fresh verification")
   let fresh=offer(issue()),replacement=live(r.beginEarnedChallengeEvidence(begin(fresh),owner))
   precondition(replacement["evidenceSessionId"] as? String != sessionId && replacement["observedSteps"] as? Int==0)
  }else{fatalError("Unknown scenario")}
  print("Actual native challenge evidence runtime + protected file transaction passed: \(scenario)")
 }
}
