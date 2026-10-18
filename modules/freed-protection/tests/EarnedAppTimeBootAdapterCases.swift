import Foundation
import Darwin

// Only the syscall and Apple framework boundaries are substituted. Runtime,
// budget policy and Darwin transactional filesystem/lock execute unchanged.
enum TestKernel {
 static var uuidAvailable=true, fallbackAvailable=false, uuidMalformed=false
 static var fallbackSize=MemoryLayout<timeval>.size, seconds=1_899_999_999, micros=123_456
 static var uuidCalls=0, fallbackCalls=0
 static func byName(_ name:String,_ pointer:UnsafeMutableRawPointer?,_ size:inout Int,_ unused:UnsafeMutableRawPointer?=nil,_ count:Int=0)->Int32 {
  uuidCalls += 1
  guard uuidAvailable else{errno=EPERM;return -1}
  let bytes=Array((uuidMalformed ? "invalid":"11111111-1111-4111-8111-111111111111").utf8)+[0]
  if let pointer {bytes.withUnsafeBytes{pointer.copyMemory(from:$0.baseAddress!,byteCount:min(size,bytes.count))}}
  size=bytes.count;return 0
 }
 static func bootTime(_ pointer:UnsafeMutableRawPointer,_ size:inout Int)->Int32 {
  fallbackCalls += 1
  guard fallbackAvailable else{errno=EACCES;return -1}
  var value=timeval(tv_sec:seconds,tv_usec:numericCast(micros))
  withUnsafeBytes(of:&value){pointer.copyMemory(from:$0.baseAddress!,byteCount:MemoryLayout<timeval>.size)}
  size=fallbackSize;return 0
 }
}
@main struct EarnedBootAdapterCases {
 static var now=Date(timeIntervalSince1970:1_900_022_400),uptime=10_000.0
 static func clock()->FreedAppGroupsClock {
  #if TASK49_BEFORE
  return .init(now:{now},uptime:{uptime},bootIdentity:{FreedAppGroupsClock.kernelBootIdentity()})
  #else
  return .init(now:{now},uptime:{uptime},bootReader:FreedAppGroupsBootReader(namedRead:{TestKernel.byName($0,$1,&$2)},bootTimeRead:{TestKernel.bootTime($0,&$1)}))
  #endif
 }
 static func expect(_ condition:Bool,_ message:String){if !condition{FileHandle.standardError.write(Data(("FAIL: "+message+"\n").utf8));exit(1)}}
 static func main()throws {
  let scenario=CommandLine.arguments[1]
  #if !TASK49_BEFORE
  if scenario=="reader" {
   let c=clock();let primary=c.readBoot();expect(primary.identity=="11111111-1111-4111-8111-111111111111" && primary.source=="kernel-uuid" && TestKernel.fallbackCalls==0,"Primary UUID retains exact old identity without fallback")
   TestKernel.uuidAvailable=false;TestKernel.fallbackAvailable=true
   let first=c.readBoot();expect(first.source=="kernel-boottime" && first.identity != nil && first.primaryStage=="uuid-size" && first.primaryErrno==EPERM,"Validated public fallback records bounded primary failure")
   for _ in 0..<20{expect(clock().readBoot().identity==first.identity,"Independent app/extension-style reader instances repeat exact injected boot identity")}
   TestKernel.micros += 1;expect(c.readBoot().identity != first.identity,"Full microseconds distinguish identity without quantization")
   TestKernel.seconds += 1;expect(c.readBoot().identity != first.identity,"Changed complete timeval changes identity")
   for size in [0,MemoryLayout<timeval>.size-1,MemoryLayout<timeval>.size+1]{TestKernel.fallbackSize=size;let value=c.readBoot();expect(value.identity==nil && value.stage=="boottime-size","Wrong returned timeval size rejects")}
   TestKernel.fallbackSize=MemoryLayout<timeval>.size
   for seconds in [0,-1]{TestKernel.seconds=seconds;expect(c.readBoot().identity==nil,"Nonpositive seconds reject")}
   TestKernel.seconds=1_899_999_999
   for micros in [-1,1_000_000]{TestKernel.micros=micros;expect(c.readBoot().identity==nil,"Microseconds outside strict timeval range reject")}
   TestKernel.micros=123_456;TestKernel.fallbackAvailable=false
   let unavailable=c.readBoot();expect(unavailable.identity==nil && unavailable.source=="unavailable" && unavailable.errorCode==EACCES && unavailable.primaryErrno==EPERM,"Both unavailable preserve errno and reject")
   TestKernel.uuidAvailable=true;TestKernel.uuidMalformed=true;TestKernel.fallbackAvailable=true
   expect(c.readBoot().source=="kernel-boottime" && c.readBoot().primaryStage=="uuid-value","Malformed UUID also requires validated fallback")
   print("Boot reader: primary precedence, exact full fallback, repeated injected reads, changed boot, invalid timeval/size and syscall errno passed; no device stability proof")
   return
  }
  #endif
  let directory=FileManager.default.temporaryDirectory.appendingPathComponent("freed-boot-adapter-\(UUID().uuidString)"),domain="app.freed.boot-adapter.\(UUID().uuidString)"
  try FileManager.default.createDirectory(at:directory,withIntermediateDirectories:true);RuntimeLock.directory=directory;RuntimeLock.domain=domain
  defer{UserDefaults(suiteName:domain)?.removePersistentDomain(forName:domain);try? FileManager.default.removeItem(at:directory)}
  let r=FreedAppGroupsRuntime(clock:clock()),owner="[\"owner-A\",1]",origin=TestToken(value:"origin"),other=TestToken(value:"other"),baseline=TestToken(value:"existing-protected")
  precondition(r.setScope(owner)["accepted"] as? Bool==true)
  _=r.snapshot(owner)
  func state()->FreedAppGroupsState{try! RuntimeLock.withExclusiveAccess{FreedAppGroupsPolicy.decode($0.data(forKey:FreedAppGroupsPolicy.key))!}}
  func ledger()->FreedEarnedAppTimeState{try! RuntimeLock.withExclusiveAccess{FreedEarnedAppTimeState.decode($0.data(forKey:FreedEarnedAppTimePolicy.key))!}}
  func target(_ id:String)->[String:Any]{let s=state(),g=s.groups.first{$0.id==id}!;return ["version":1,"expectedStoreRevision":s.revision,"id":id,"expectedRevision":g.revision]}
  func create(_ tokens:Set<TestToken>)->String{
   expect(r.create(["version":1,"expectedStoreRevision":state().revision,"name":"Focus"],owner)["accepted"] as? Bool==true,"Draft creation remains allowed")
   let id=state().groups.last!.id;var selection=FamilyActivitySelection();selection.applicationTokens=tokens
   expect(r.update(target(id),owner,selectionData:try! JSONEncoder().encode(selection))["accepted"] as? Bool==true,"Pending tokens stage")
   return id
  }
  func activate(_ id:String,_ kind:String)->[String:Any]{var q=target(id);q["version"]=2;q["name"]="Focus";q["enabled"]=true;q["packages"]=[String]();q["rule"]=kind=="daily-limit" ? ["kind":kind,"limitMinutes":30] : ["kind":kind];q["extraTimeCapMinutes"]=20;q["preferredBreakSeconds"]=300;return q}
  func shields()->[String:Set<TestToken>]{ManagedSettingsStore.shields.mapValues{$0.applications ?? []}}
  let base=create([baseline]);expect(r.updateAppGroupWithEarnedTime(activate(base,"before-use"),owner)["accepted"] as? Bool==true,"Existing protected group activates")
  let file=directory.appendingPathComponent("freed-enforcement-state.v1.plist")
  if scenario=="retained-spend" {
   let id=create([origin,other]);expect(r.updateAppGroupWithEarnedTime(activate(id,"before-use"),owner)["accepted"] as? Bool==true,"Spend group activates")
   let legacyRequest:[String:Any]=try RuntimeLock.withExclusiveAccess{d in let issued=r.issueScope(for:baseline,d)!,event=UUID().uuidString.lowercased();precondition(r.stageClaim(id:event,scope:issued,d));return ["version":1,"policyVersion":1,"category":"breathe","completionSessionId":"legacy-session","templateId":"fixture-breathe","templateVersion":1,"nativeInterventionId":event,"groupId":base,"groupRevision":issued["groupRevision"]!,"configurationGeneration":issued["configurationGeneration"]!,"scopeEpoch":issued["scopeEpoch"]!,"kind":"ios-app-group","tokenType":"application"]}
   expect(r.grantResetReward(legacyRequest,owner)["accepted"] as? Bool==true,"Immutable v1 native reward grants original120 seconds")
   let oldV1=try RuntimeLock.withExclusiveAccess{FreedResetAppGroupRewardLedger.decode($0.data(forKey:FreedResetAppGroupRewardLedger.key))!.records}
   expect(oldV1.values.first!.expiresAt-oldV1.values.first!.grantedAt==120,"V1 lease duration remains120")
   // Existing cross-policy gate forbids overlapping v1/v2 windows. Expire v1
   // through its real native callback; retain consumption history for comparison.
   let v1Expiry=DeviceActivityCenter().activities.first{$0.rawValue.hasSuffix(".break")}!
   now=now.addingTimeInterval(121);uptime += 121
   expect(r.callback(activity:v1Expiry.rawValue),"Original v1 expiry callback relocks before v2 offer")
   let request:[String:Any]=try RuntimeLock.withExclusiveAccess{d in let issued=r.issueScope(for:origin,d)!,event=UUID().uuidString.lowercased();precondition(r.stageClaim(id:event,scope:issued,d));return ["version":2,"policyVersion":2,"nativeInterventionId":event,"groupId":id,"groupRevision":issued["groupRevision"]!,"configurationGeneration":issued["configurationGeneration"]!,"scopeEpoch":issued["scopeEpoch"]!,"kind":"ios-app-group","tokenType":"application","requestedSeconds":300]}
   let offered=r.prepareEarnedAppTimeOffer(request,owner);expect(offered["accepted"] as? Bool==true,"Genuine originating claim offers")
   let offer=offered["offer"] as! [String:Any],grant:[String:Any]=["version":2,"policyVersion":2,"offerId":offer["offerId"]!,"completionSessionId":"spent-session","category":"breathe","templateId":"momentum-breathe-soft:earned-v2:300","templateVersion":2,"evidence":["method":"timer","activeDurationSec":60,"observedSteps":0,"photoProofIds":[String]()]]
   expect(r.grantEarnedAppTimeBreak(grant,owner)["accepted"] as? Bool==true,"Real runtime grant consumes native budget")
   let old=ledger();expect(old.budgets.values.contains{$0.spentSeconds==300},"Spend exists before changed boot")
   TestKernel.uuidAvailable=false;TestKernel.fallbackAvailable=true
   _=r.snapshot(owner)
   let after=ledger();let afterV1=try RuntimeLock.withExclusiveAccess{FreedResetAppGroupRewardLedger.decode($0.data(forKey:FreedResetAppGroupRewardLedger.key))!.records}
   expect(afterV1==oldV1,"Fallback preserves exact v1 consumed lease identities/deadlines and120 duration")
   expect(after.budgets==old.budgets && after.consumptions==old.consumptions,"Changed provider cannot reset budget/spend or rewrite consumed lease identity/deadline")
   expect(after.leases==old.leases && state().leases.isEmpty && shields().values.contains{$0.contains(origin)},"Changed boot retains stored lease identity while invalidating active authority and relocking")
   expect(r.grantEarnedAppTimeBreak(grant,owner)["accepted"] as? Bool==false,"Old exact grant cannot revive on fallback boot")
   print("Actual native runtime changed-provider path retained spent budgets and consumed lease identities; revoked/relocked stale active authority and refused replay")
   return
  }
  TestKernel.uuidAvailable=false;TestKernel.fallbackAvailable=false
  let id=create([origin,other]),q=activate(id,"daily-limit"),before=try Data(contentsOf:file),beforeState=state(),beforeLedger=ledger(),beforeShields=shields(),beforeNames=Set(DeviceActivityCenter().activities)
  let failed=r.updateAppGroupWithEarnedTime(q,owner),diag=failed["diagnostics"] as! [String:Any]
  expect(failed["accepted"] as? Bool==false && failed["reason"] as? String=="earned-time-clock-unverified" && diag["stage"] as? String=="clock-validation","Actual nil-boot activation rejects at native clock stage")
  expect(diag["errorDomain"] as? String=="FreedProtection" && diag["errorCode"] as? Int==1,"Original policy error remains exposed")
  #if !TASK49_BEFORE
  expect(diag["clockBudgetPhase"] as? String=="bootstrap" && diag["clockBootAvailable"] as? Bool==false && diag["clockBootSource"] as? String=="unavailable" && diag["clockBootErrno"] as? Int==Int(EACCES) && diag["clockPrimaryErrno"] as? Int==Int(EPERM) && diag["clockWallValid"] as? Bool==true && diag["clockUptimeValid"] as? Bool==true && diag["clockCalendarValid"] as? Bool==true,"Bounded native failure components identify missing boot at bootstrap")
  expect(Set(diag.keys).isDisjoint(with:["bootIdentity","ownerDigest","token","wall","uptime"]),"Diagnostics exclude native authority/clock values")
  #endif
  expect(try! Data(contentsOf:file)==before && state()==beforeState && ledger()==beforeLedger && shields()==beforeShields && Set(DeviceActivityCenter().activities)==beforeNames,"Rejected activation preserves exact committed bytes, pending selection, budget/spend and native monitors/shields")
  TestKernel.fallbackAvailable=true
  #if !TASK49_BEFORE
  TestKernel.fallbackSize=0
  expect(r.updateAppGroupWithEarnedTime(q,owner)["accepted"] as? Bool==false && (try! Data(contentsOf:file))==before,"Malformed fallback rejects without mutation")
  TestKernel.fallbackSize=MemoryLayout<timeval>.size
  #endif
  let retried=r.updateAppGroupWithEarnedTime(q,owner)
  expect(retried["accepted"] as? Bool==true,"Validated kernel timeval fallback must retry first-budget v2 activation")
  expect((retried["diagnostics"] as! [String:Any])["clockBootSource"] as? String=="kernel-boottime","Successful native receipt reports only current adapter source")
  let active=state().groups.first{$0.id==id}!,selection=try JSONDecoder().decode(FamilyActivitySelection.self,from:active.selection!)
  expect(active.enabled && active.pendingSelection==nil && active.preferredBreakSeconds==300 && active.rule.limitMinutes==30 && selection.applicationTokens==[origin,other],"Retry acknowledges retained individual tokens, daily30 and preferred300")
  expect(ledger().budgets.values.allSatisfy{$0.spentSeconds==0 && $0.effectiveCapMinutes==20} && ledger().leases.isEmpty && ledger().consumptions.isEmpty,"Activation spends nothing and creates no grant authority")
  let activity=DeviceActivityCenter().activities.first{$0.rawValue.contains(id) && $0.rawValue.hasSuffix(".daily")}!,event=DeviceActivityCenter().events(for:activity).values.first!
  expect(event.applications==[origin,other] && event.threshold.minute==30 && event.includesPastActivity,"Native daily registration/readback retains30 combined threshold")
  expect(!shields().values.contains{$0.contains(origin)||$0.contains(other)} && shields().values.contains{$0.contains(baseline)},"First allowance remains usable and existing protection remains")
  let committed=try Data(contentsOf:file);var changed=target(id);changed["version"]=2;changed["name"]="Focus";changed["enabled"]=true;changed["rule"]=["kind":"scheduled","startMinute":60,"endMinute":120,"days":[0,1,2,3,4,5,6]];changed["packages"]=[String]();changed["extraTimeCapMinutes"]=20
  DeviceActivityCenter.failNext=true
  expect(r.updateAppGroupWithEarnedTime(changed,owner)["accepted"] as? Bool==false && (try! Data(contentsOf:file))==committed,"Native registration failure still rolls back after fallback activation")
  print("Actual native runtime nil/malformed-boot activation rejection preserved bytes, pending tokens, spend, shields and monitors; validated fallback retry registered daily30/cap20/window300 with zero spend; OS failure rollback retained")
 }
}
