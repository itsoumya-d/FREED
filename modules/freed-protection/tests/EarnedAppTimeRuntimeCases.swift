import Foundation
import Darwin

@main struct EarnedRuntimeCases {
 static var now=Date(timeIntervalSince1970:1_900_022_400),uptime=10_000.0,boot="boot-A"
 static func main()throws {
  func expect(_ condition:Bool,_ message:String){if !condition{FileHandle.standardError.write(Data(("FAIL: "+message+"\n").utf8));exit(1)}}
  let directory=FileManager.default.temporaryDirectory.appendingPathComponent("freed-earned-v2-\(UUID().uuidString)"),domain="app.freed.earned-v2.\(UUID().uuidString)"
  try FileManager.default.createDirectory(at:directory,withIntermediateDirectories:true);RuntimeLock.directory=directory;RuntimeLock.domain=domain
  defer{try? FileManager.default.setAttributes([.posixPermissions:0o700],ofItemAtPath:directory.path);UserDefaults(suiteName:domain)?.removePersistentDomain(forName:domain);try? FileManager.default.removeItem(at:directory)}
  func runtime()->FreedAppGroupsRuntime {FreedAppGroupsRuntime(clock:FreedAppGroupsClock(now:{now},uptime:{uptime},bootIdentity:{boot}))}
  let r=runtime(),owner="[\"owner-A\",1]",token=TestToken(value:"origin"),other=TestToken(value:"other")
  let scenario=CommandLine.arguments[1]
  if scenario=="legacy-adopt" {
   var legacy=FamilyActivitySelection();legacy.applicationTokens=[token,other]
   try RuntimeLock.withExclusiveAccess{d in d.set(try JSONEncoder().encode(legacy),forKey:"freed.familyActivitySelection");d.set("before-use",forKey:"freed.appGuard.mode")}
  }
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
  let id=create(scenario=="legacy-adopt" ? [other]:[token,other]),file=directory.appendingPathComponent("freed-enforcement-state.v1.plist")
  func issue()->[String:Any] {try! RuntimeLock.withExclusiveAccess{d in let scope=r.issueScope(for:token,d)!,event=UUID().uuidString.lowercased();precondition(r.stageClaim(id:event,scope:scope,d));return["version":2,"policyVersion":2,"nativeInterventionId":event,"groupId":scope["groupId"]!,"groupRevision":scope["groupRevision"]!,"configurationGeneration":scope["configurationGeneration"]!,"scopeEpoch":scope["scopeEpoch"]!,"kind":"ios-app-group","tokenType":"application","requestedSeconds":300]}}
  func offer(_ q:[String:Any])->[String:Any] {let result=r.prepareEarnedAppTimeOffer(q,owner);precondition(result["accepted"] as? Bool==true,"Offer rejected: \(result)");return result["offer"] as! [String:Any]}
  func grant(_ offer:[String:Any],session:String="session")->[String:Any] {let seconds=offer["requestedSeconds"] as! Int;return["version":2,"policyVersion":2,"offerId":offer["offerId"]!,"completionSessionId":session,"category":"breathe","templateId":"momentum-breathe-soft:earned-v2:\(seconds)","templateVersion":2,"evidence":["method":"timer","activeDurationSec":seconds==300 ? 60:120,"observedSteps":0,"photoProofIds":[String]()]]}
  func cap(_ minutes:Int)->[String:Any] {var q=target(id);q["version"]=2;q["name"]="Focus";q["enabled"]=true;q["packages"]=[String]();q["rule"]=["kind":"before-use"];q["extraTimeCapMinutes"]=minutes;return r.updateAppGroupWithEarnedTime(q,owner)}
  func advance(_ seconds:Double){now=now.addingTimeInterval(seconds);uptime += seconds}
  func isShielded(_ target:TestToken)->Bool {ManagedSettingsStore.shields.values.contains{($0.applications ?? []).contains(target)}}
  func expire(){let name=DeviceActivityCenter().activities.first{$0.rawValue.hasSuffix(".earned-v2")}!;advance(601);precondition(runtime().callback(activity:name.rawValue));precondition(isShielded(token))}
  if scenario=="binding-preserve-v1" || scenario=="binding-preserve-v2" {
   _=create([other]) // an independent overlapping restriction must survive rebind
   let issued=issue()
   var request:[String:Any]=[:]
   var deadline:Double=0
   if scenario=="binding-preserve-v1" {
    let st=try state(),claim=st.claim!
    let reward:[String:Any]=["version":1,"policyVersion":1,"category":"breathe","completionSessionId":"native-v1-session","templateId":"fixture-breathe","templateVersion":1,"nativeInterventionId":claim.interventionId,"kind":"ios-app-group","tokenType":"application","groupId":claim.groupId,"groupRevision":claim.groupRevision,"configurationGeneration":claim.generation,"scopeEpoch":claim.scopeEpoch]
    expect(r.grantResetReward(reward,owner)["accepted"] as? Bool==true,"Original v1 lease is natively acknowledged")
    deadline=try state().leases[id]!.expiresAt
   } else {
    request=grant(offer(issued));let result=r.grantEarnedAppTimeBreak(request,owner)
    expect(result["accepted"] as? Bool==true,"Original v2 lease is natively acknowledged")
    deadline=try ledger().leases.values.first!.native.expiresAt
   }
   expect(!isShielded(token) && isShielded(other),"Original lease releases only target")
   let beforeState=try state(),beforeLedger=try RuntimeLock.withExclusiveAccess{$0.data(forKey:FreedEarnedAppTimePolicy.key)},beforeReward=try RuntimeLock.withExclusiveAccess{$0.data(forKey:FreedResetAppGroupRewardLedger.key)}
   let monitor=DeviceActivityCenter().activities.first{$0.rawValue.hasSuffix(scenario=="binding-preserve-v1" ? ".break":".earned-v2")}!
   let schedule=DeviceActivityCenter().schedule(for:monitor)!
   let reopened=runtime(),module=UUID();FreedAccountBindingLifecycle.created(module:module)
   let session=try FreedAccountBindingLifecycle.issue(module:module);try reopened.installBindingSession(session)
   let ticket=try reopened.prepareBinding(scope:owner,session:session.id,transition:UUID().uuidString,sequence:0)
   let acknowledged=try reopened.commitBinding(ticket:ticket["ticket"] as! String,session:session.id),nativeScope=acknowledged["actionScope"] as! String
   expect(try state().scopeEpoch==beforeState.scopeEpoch && state().generation==beforeState.generation,"New runtime admission must preserve persistent policy scope and generation")
   expect(try state().leases==beforeState.leases,"Fresh supported same-owner binding preserves immutable v1 lease")
   expect(try RuntimeLock.withExclusiveAccess{$0.data(forKey:FreedEarnedAppTimePolicy.key)}==beforeLedger,"Fresh supported same-owner binding preserves v2 deadline, consumed receipt and spent budget")
   expect(try RuntimeLock.withExclusiveAccess{$0.data(forKey:FreedResetAppGroupRewardLedger.key)}==beforeReward,"Same-owner admission preserves v1 reward ledger")
   expect(DeviceActivityCenter().schedule(for:monitor)==schedule && !isShielded(token) && ManagedSettingsStore.shields.values.filter{($0.applications ?? []).contains(other)}.count>=2,"New session keeps target effectively released and other app restricted")
   expect(r.snapshot(owner)["supported"] as? Bool==false && r.create(["version":1,"expectedStoreRevision":beforeState.revision,"name":"Old queued"],owner)["accepted"] as? Bool==false,"Old raw admitted calls cannot adopt replacement same-owner binding")
   let replay=try reopened.commitBinding(ticket:ticket["ticket"] as! String,session:session.id)
   expect(replay["bindingHandle"] as? String==acknowledged["bindingHandle"] as? String,"Exact native ticket replay keeps original handle")
   if scenario=="binding-preserve-v2" {
    let read=reopened.getEarnedAppTimeGrant(request,nativeScope)
    expect(read["accepted"] as? Bool==true && ISO8601DateFormatter().date(from:read["expiresAt"] as! String)!.timeIntervalSince1970==deadline,"New admitted reader observes original active v2 deadline")
    expect(r.grantEarnedAppTimeBreak(request,owner)["accepted"] as? Bool==false,"Old completion callback cannot use new session authority")
   }
   advance(deadline-now.timeIntervalSince1970-1)
   expect(!isShielded(token),"Target remains released just before original expiry")
   // Native extension policy must keep working after every host admission retires.
   FreedAccountBindingLifecycle.destroyed(module:module)
   expect(!session.current && !reopened.ownerVerified,"No live host session remains before native expiry")
   advance(1)
   let extensionRuntime=runtime()
   expect(!extensionRuntime.ownerVerified,"Extension callback has no host binding")
   expect(extensionRuntime.callback(activity:monitor.rawValue) && isShielded(token) && isShielded(other),"Cold native callback restores restriction at original deadline after rebind")
   expect(ManagedSettingsStore.adultProtected,"Adult filter persists through session rebind and expiry")
   print("Task82 native same-owner \(scenario) admission identity / actual lease effect / original expiry PASS")
  }else if scenario=="supported20" {
   let snapshot=r.snapshot(owner),g=group(id)
   expect(snapshot["supportedBreakSeconds"] as? [Int]==[300,600,1200],"New native binary must explicitly advertise5/10/20 support")
   expect(g["preferredBreakSeconds"] as? Int==300,"Legacy stored preference omission must read back default5 minutes")
   print("NATIVE_WINDOW20_SNAPSHOT="+String(data:try JSONSerialization.data(withJSONObject:snapshot),encoding:.utf8)!);fflush(stdout)
  }else if scenario=="grant1200" {
   var q=issue();q["requestedSeconds"]=1200
   let response=r.prepareEarnedAppTimeOffer(q,owner)
   expect(response["accepted"] as? Bool==true,"Native20-minute offer must be supported")
   let offered=response["offer"] as! [String:Any]
   expect(offered["requiredActiveSeconds"] as? Int==120 && offered["requiredSteps"] as? Int==60 && offered["requiredDistinctPhotoTargets"] as? Int==2,"20-minute offer must use comfortable120 seconds/60 steps/two evaluated targets")
   expect((offered["availableMethods"] as? [String])?.contains("photo")==false,"Unevaluated photo targets remain unavailable for20")
   let request=grant(offered),before=now,accepted=r.grantEarnedAppTimeBreak(request,owner)
   expect(accepted["accepted"] as? Bool==true && accepted["seconds"] as? Int==1200,"Valid20 challenge must grant1200 seconds")
   expect(ISO8601DateFormatter().date(from:accepted["expiresAt"] as! String)!.timeIntervalSince(before)==1200,"Native continuous20 window must have exact deadline")
   expect(!isShielded(token) && isShielded(other) && ManagedSettingsStore.adultProtected,"20 window releases only originating app and retains adult protection")
   let spent=(try! ledger()).budgets.values.first!;expect(spent.spentSeconds==1200 && spent.remainingSeconds==0,"One20 window spends default20 cap exactly once")
   advance(10);let replay=r.grantEarnedAppTimeBreak(request,owner)
   expect(replay["accepted"] as? Bool==true && replay["replayed"] as? Bool==true && replay["expiresAt"] as? String==accepted["expiresAt"] as? String && (try! ledger()).budgets.values.first!.spentSeconds==1200,"Exact20 retry retains deadline and spends once")
   let activity=DeviceActivityCenter().activities.first{$0.rawValue.hasSuffix(".earned-v2")}!
   advance(1190);expect(runtime().callback(activity:activity.rawValue) && isShielded(token),"Cold native callback must relock20 window without app owner binding")
   expect(r.prepareEarnedAppTimeOffer(issue(),owner)["accepted"] as? Bool==false,"Spent default20 cap prevents more windows")
  }else if scenario=="preferred-active" {
   let request=grant(offer(issue())),accepted=r.grantEarnedAppTimeBreak(request,owner);precondition(accepted["accepted"] as? Bool==true)
   let old=try state(),oldLedger=try ledger(),activityCount=DeviceActivityCenter().activities.count
   var q=target(id);q["version"]=2;q["name"]="Focus";q["enabled"]=true;q["packages"]=[String]();q["rule"]=["kind":"before-use"];q["extraTimeCapMinutes"]=20;q["preferredBreakSeconds"]=1200
   expect(r.updateAppGroupWithEarnedTime(q,owner)["accepted"] as? Bool==true,"Native preference-only update must accept20-minute default")
   let changed=try state(),changedLedger=try ledger();expect(changed.groups.first!.revision==old.groups.first!.revision && changed.groups.first!.bank==old.groups.first!.bank && changed.generation==old.generation && changed.scopeEpoch==old.scopeEpoch,"Preference alone must not change group native authority")
   expect(changedLedger.leases==oldLedger.leases && changedLedger.consumptions==oldLedger.consumptions && changedLedger.budgets==oldLedger.budgets && DeviceActivityCenter().activities.count==activityCount && !isShielded(token),"Preference retains lease/deadline, spend, budget and native monitor")
   expect(group(id)["preferredBreakSeconds"] as? Int==1200,"Saved20 default must read back")
   print("NATIVE_WINDOW20_SNAPSHOT="+String(data:try JSONSerialization.data(withJSONObject:r.snapshot(owner)),encoding:.utf8)!);fflush(stdout)
   q=target(id);q["version"]=2;q["name"]="Focus";q["enabled"]=true;q["packages"]=[String]();q["rule"]=["kind":"before-use"];q["extraTimeCapMinutes"]=0
   expect(r.updateAppGroupWithEarnedTime(q,owner)["accepted"] as? Bool==true && group(id)["preferredBreakSeconds"] as? Int==1200,"Legacy omitted preference preserves saved value during cap-only update")
   expect((try! ledger()).leases==oldLedger.leases && (try! ledger()).budgets.values.first!.spentSeconds==300 && !isShielded(token),"Cap-only edit retains active window and spend")
   let replay=r.grantEarnedAppTimeBreak(request,owner);expect(replay["accepted"] as? Bool==true && replay["expiresAt"] as? String==accepted["expiresAt"] as? String,"Preference/cap edit cannot extend active retry deadline")
  }else if scenario=="preferred-invalid" {
   var q=target(id);q["version"]=2;q["name"]="Focus";q["enabled"]=true;q["packages"]=[String]();q["rule"]=["kind":"before-use"];q["extraTimeCapMinutes"]=20
   let before=try Data(contentsOf:file)
   for bad in ([900,true,"1200",NSNull()] as [Any]) {q["preferredBreakSeconds"]=bad;expect(r.updateAppGroupWithEarnedTime(q,owner)["accepted"] as? Bool==false,"Unsupported/non-integer preference must fail");expect(try! Data(contentsOf:file)==before,"Rejected preference cannot mutate authority")}
   q["preferredBreakSeconds"]=600;expect(r.updateAppGroupWithEarnedTime(q,owner)["accepted"] as? Bool==true,"Supported preference must persist")
   q=target(id);q["version"]=2;q["name"]="Focus";q["enabled"]=true;q["packages"]=[String]();q["rule"]=["kind":"before-use"];q["extraTimeCapMinutes"]=20
   expect(r.updateAppGroupWithEarnedTime(q,owner)["accepted"] as? Bool==true && group(id)["preferredBreakSeconds"] as? Int==600,"Omitted preference retains stored10 default")
  }else if scenario=="preferred-failure" {
   var q=target(id);q["version"]=2;q["name"]="Focus";q["enabled"]=true;q["packages"]=[String]();q["rule"]=["kind":"before-use"];q["extraTimeCapMinutes"]=20;q["preferredBreakSeconds"]=1200
   let before=try Data(contentsOf:file);try FileManager.default.setAttributes([.posixPermissions:0o500],ofItemAtPath:directory.path)
   expect(r.updateAppGroupWithEarnedTime(q,owner)["accepted"] as? Bool==false,"Preference write failure must not acknowledge")
   try FileManager.default.setAttributes([.posixPermissions:0o700],ofItemAtPath:directory.path);expect(try! Data(contentsOf:file)==before,"Preference write failure preserves original state")
   expect(r.updateAppGroupWithEarnedTime(q,owner)["accepted"] as? Bool==true,"Exact preference retry may persist after storage returns")
  }else if scenario=="daily-allowance" {
   var q=target(id);q["version"]=2;q["name"]="Focus";q["enabled"]=true;q["packages"]=[String]();q["rule"]=["kind":"daily-limit","limitMinutes":30];q["extraTimeCapMinutes"]=20;q["preferredBreakSeconds"]=1200
   expect(r.updateAppGroupWithEarnedTime(q,owner)["accepted"] as? Bool==true,"Daily allowance plus20 default must save")
   expect(!isShielded(token) && group(id)["active"] as? Bool==false,"Initial daily allowance remains usable without challenge")
   let activity=DeviceActivityCenter().activities.first{$0.rawValue.hasSuffix(".daily")}!
   expect(r.callback(activity:activity.rawValue,event:"freed.group.\(id).r\(group(id)["revision"] as! Int).threshold") && isShielded(token),"Actual native daily threshold activates app boundary")
   var offerRequest=issue();offerRequest["requestedSeconds"]=1200;expect(r.prepareEarnedAppTimeOffer(offerRequest,owner)["accepted"] as? Bool==true,"20 window may be offered after daily allowance reached")
  }else if scenario=="legacy-adopt" {
   var q=target("legacy-default");q["name"]="Converted";q["enabled"]=true;q["packages"]=[String]();q["rule"]=["kind":"before-use"]
   precondition(r.update(q,owner)["accepted"] as? Bool==true)
   let prepared=offer(issue());precondition(prepared["groupId"] as? String=="legacy-default")
   precondition(r.grantEarnedAppTimeBreak(grant(prepared),owner)["accepted"] as? Bool==true && !isShielded(token) && isShielded(other))
   precondition((try! state()).groups.first{$0.id=="legacy-default"}!.legacy,"Adoption never rewrites v1 history metadata")
  }else if scenario=="offer" {
   let q=issue(),first=offer(q),again=offer(q)
   precondition(first["offerId"] as? String==again["offerId"] as? String && first["validUntil"] as? String==again["validUntil"] as? String)
   precondition(first["requiredActiveSeconds"] as? Int==60 && first["requiredSteps"] as? Int==30 && first["availableMethods"] as? [String]==["timer"])
   precondition((try! ledger()).budgets.values.first!.spentSeconds==0 && isShielded(token) && isShielded(other))
   var ten=q;ten["requestedSeconds"]=600;let replacement=offer(ten)
   precondition(replacement["requiredActiveSeconds"] as? Int==120 && replacement["requiredSteps"] as? Int==60)
   precondition(r.grantEarnedAppTimeBreak(grant(first),owner)["accepted"] as? Bool==false,"Superseded duration cannot grant")
   precondition(r.prepareEarnedAppTimeOffer(q.merging(["url":"https://example.com"],uniquingKeysWith:{$1}),owner)["accepted"] as? Bool==false)
  }else if scenario=="grant300" || scenario=="grant600" {
   var q=issue();let seconds=scenario=="grant300" ? 300:600;q["requestedSeconds"]=seconds;let prepared=offer(q),before=now
   let accepted=r.grantEarnedAppTimeBreak(grant(prepared),owner)
   precondition(accepted["accepted"] as? Bool==true && accepted["seconds"] as? Int==seconds && accepted["effective"] as? Bool==true)
   precondition(ISO8601DateFormatter().date(from:accepted["expiresAt"] as! String)!.timeIntervalSince(before)==Double(seconds))
   precondition(!isShielded(token) && isShielded(other) && ManagedSettingsStore.adultProtected)
   precondition((try! ledger()).budgets.values.first!.spentSeconds==seconds && (try! state()).leases.isEmpty,"V2 never changes v1 lease schema")
   let name=DeviceActivityCenter().activities.first{$0.rawValue.hasSuffix(".earned-v2")}!
   advance(Double(seconds));precondition(runtime().callback(activity:name.rawValue))
   precondition(isShielded(token) && isShielded(other) && !DeviceActivityCenter().activities.contains(name),"Cold extension callback relocks without private owner binding")
  }else if scenario=="midnight-replay" {
   let budget=(try! ledger()).budgets.values.first!;advance(budget.nextResetAt-now.timeIntervalSince1970-60)
   let prepared=offer(issue()),q=grant(prepared),accepted=r.grantEarnedAppTimeBreak(q,owner);precondition(accepted["accepted"] as? Bool==true)
   let grantBudget=accepted["budget"] as! [String:Any]
   advance(120);_=r.snapshot(owner)
   let replay=r.grantEarnedAppTimeBreak(q,owner),replayBudget=replay["budget"] as! [String:Any]
   precondition(replay["accepted"] as? Bool==true && replay["replayed"] as? Bool==true && replay["expiresAt"] as? String==accepted["expiresAt"] as? String)
   precondition(replayBudget["dayKey"] as? String==grantBudget["dayKey"] as? String && replayBudget["spentSeconds"] as? Int==300 && (try! ledger()).budgets.values.first!.spentSeconds==0,"Replay returns immutable grant-day budget while current-day budget remains separate")
  }else if scenario=="late-overlap" {
   let q=grant(offer(issue())),accepted=r.grantEarnedAppTimeBreak(q,owner);precondition(accepted["accepted"] as? Bool==true)
   _=create([token]);let replay=r.grantEarnedAppTimeBreak(q,owner)
   precondition(replay["accepted"] as? Bool==true && replay["replayed"] as? Bool==true && replay["effective"] as? Bool==false && replay["remainingRestrictionCount"] as? Int==1 && replay["expiresAt"] as? String==accepted["expiresAt"] as? String)
  }else if scenario=="cross-policy" {
   let q=issue(),prepared=offer(q)
   try RuntimeLock.withExclusiveAccess{$0.set(FreedEarnedAppTimePolicy.iso(now.timeIntervalSince1970+120),forKey:"freed.earnedUnlock.expiresAt")}
   precondition(r.prepareEarnedAppTimeOffer(q,owner)["accepted"] as? Bool==false && r.grantEarnedAppTimeBreak(grant(prepared),owner)["accepted"] as? Bool==false)
   try RuntimeLock.withExclusiveAccess{$0.removeObject(forKey:"freed.earnedUnlock.expiresAt")}
   precondition(r.grantEarnedAppTimeBreak(grant(prepared),owner)["accepted"] as? Bool==true)
   try RuntimeLock.withExclusiveAccess{precondition(r.hasActiveEarnedTimeBreak($0),"Legacy grant gate must observe active v2 authority")}
  }else if scenario=="read-unstarted" {
   let q=grant(offer(issue())),before=try Data(contentsOf:file),activities=DeviceActivityCenter().activities
   let result=r.getEarnedAppTimeGrant(q,owner)
   precondition(result["accepted"] as? Bool==false && result["reason"] as? String=="earned-time-grant-not-found","Read-only lookup must never start a prepared offer")
   precondition(try! Data(contentsOf:file)==before)
   precondition(DeviceActivityCenter().activities==activities && isShielded(token) && (try! ledger()).consumptions.isEmpty)
  }else if scenario=="read-existing" {
   let q=grant(offer(issue())),accepted=r.grantEarnedAppTimeBreak(q,owner);precondition(accepted["accepted"] as? Bool==true)
   let cold=runtime();precondition(cold.setScope(owner)["accepted"] as? Bool==true)
   let before=try Data(contentsOf:file),read=cold.getEarnedAppTimeGrant(q,owner)
   precondition(read["accepted"] as? Bool==true && read["replayed"] as? Bool==true && read["expiresAt"] as? String==accepted["expiresAt"] as? String)
   precondition(NSDictionary(dictionary:read["budget"] as! [String:Any]).isEqual(to:accepted["budget"] as! [String:Any]))
   precondition(try! Data(contentsOf:file)==before,"Exact cold-runtime lookup is read-only")
   advance(301)
   precondition(cold.getEarnedAppTimeGrant(q,owner)["reason"] as? String=="earned-time-grant-expired")
   precondition(try! Data(contentsOf:file)==before,"Expired lookup cannot extend or rewrite a consumed grant")
  }else if scenario=="retry" {
   let prepared=offer(issue()),request=grant(prepared),accepted=r.grantEarnedAppTimeBreak(request,owner);precondition(accepted["accepted"] as? Bool==true)
   advance(20);let replay=r.grantEarnedAppTimeBreak(request,owner)
   precondition(replay["accepted"] as? Bool==true && replay["replayed"] as? Bool==true && replay["expiresAt"] as? String==accepted["expiresAt"] as? String && (try! ledger()).budgets.values.first!.spentSeconds==300)
   precondition(r.grantEarnedAppTimeBreak(request.merging(["completionSessionId":"another"],uniquingKeysWith:{$1}),owner)["accepted"] as? Bool==false)
   expire();let next=offer(issue());precondition(r.grantEarnedAppTimeBreak(grant(next),owner)["accepted"] as? Bool==false,"One completion session cannot fund another offer")
   precondition(r.grantEarnedAppTimeBreak(request,owner)["accepted"] as? Bool==false,"Expired replay cannot renew")
  }else if scenario=="cap" {
   for n in 0..<4 {let accepted=r.grantEarnedAppTimeBreak(grant(offer(issue()),session:"session-\(n)"),owner);precondition(accepted["accepted"] as? Bool==true);expire()}
   let exhausted=r.prepareEarnedAppTimeOffer(issue(),owner);precondition(exhausted["accepted"] as? Bool==false && (try! ledger()).budgets.values.first!.spentSeconds==1200)
   precondition(cap(30)["accepted"] as? Bool==true)
   let pending=(try! ledger()).budgets.values.first!;precondition(pending.effectiveCapMinutes==20 && pending.pendingCapMinutes==30 && pending.spentSeconds==1200)
   let delta=pending.nextResetAt-now.timeIntervalSince1970+1;advance(delta)
   let renewed=offer(issue());precondition(renewed["requestedSeconds"] as? Int==300)
   let next=(try! ledger()).budgets.values.first!;precondition(next.effectiveCapMinutes==30 && next.spentSeconds==0 && next.previousDays.last!.spentSeconds==1200)
  }else if scenario=="cap-active" {
   let request=grant(offer(issue())),accepted=r.grantEarnedAppTimeBreak(request,owner);precondition(accepted["accepted"] as? Bool==true)
   let before=try state(),lease=(try! ledger()).leases.values.first!,count=DeviceActivityCenter().activities.count
   precondition(cap(0)["accepted"] as? Bool==true)
   let after=try state();precondition(after.groups==before.groups && after.revision>before.revision && (try! ledger()).leases.values.first! == lease && DeviceActivityCenter().activities.count==count && !isShielded(token))
   let replay=r.grantEarnedAppTimeBreak(request,owner)
   precondition(replay["accepted"] as? Bool==true && replay["expiresAt"] as? String==accepted["expiresAt"] as? String && (replay["budget"] as! [String:Any])["effectiveCapMinutes"] as? Int==20,"Cap reduction preserves active grant and immutable grant-day receipt")
   expire();precondition(r.prepareEarnedAppTimeOffer(issue(),owner)["accepted"] as? Bool==false)
  }else if scenario=="clock" {
   let prepared=offer(issue());let before=try ledger();now=now.addingTimeInterval(86_400)
   precondition(r.grantEarnedAppTimeBreak(grant(prepared),owner)["accepted"] as? Bool==false)
   precondition((try! ledger()).budgets==before.budgets,"Wall jump does not mint a new budget")
   now=now.addingTimeInterval(-86_400);boot="boot-B"
   precondition(r.prepareEarnedAppTimeOffer(issue(),owner)["accepted"] as? Bool==false)
   precondition((try! ledger()).budgets==before.budgets,"Cross-boot uncertainty does not clear spent state")
  }else if scenario=="overlap" {
   let q=issue();_=create([token]);let blocked=r.prepareEarnedAppTimeOffer(q,owner)
   precondition(blocked["accepted"] as? Bool==false && (try! ledger()).budgets.values.allSatisfy{$0.spentSeconds==0})
  }else if scenario=="stale" {
   let prepared=offer(issue());var changed=target(id);changed["name"]="Changed";changed["enabled"]=true;changed["packages"]=[String]();changed["rule"]=["kind":"before-use"]
   precondition(r.update(changed,owner)["accepted"] as? Bool==true)
   precondition(r.grantEarnedAppTimeBreak(grant(prepared),owner)["accepted"] as? Bool==false)
   let current=offer(issue());precondition(r.setScope("[\"owner-B\",2]")["accepted"] as? Bool==true)
   precondition(r.grantEarnedAppTimeBreak(grant(current),owner)["accepted"] as? Bool==false)
   precondition((try! ledger()).budgets.values.allSatisfy{$0.spentSeconds==0})
  }else if scenario=="update-rollback" {
   let old=try state(),budgets=(try! ledger()).budgets
   var q=target(id);q["version"]=2;q["name"]="Focus";q["enabled"]=true;q["packages"]=[String]();q["rule"]=["kind":"scheduled","startMinute":0,"endMinute":1439,"days":[0,1,2,3,4,5,6]];q["extraTimeCapMinutes"]=30
   DeviceActivityCenter.failNext=true;precondition(r.updateAppGroupWithEarnedTime(q,owner)["accepted"] as? Bool==false)
   precondition((try! state())==old && (try! ledger()).budgets==budgets && isShielded(token),"Rule/monitor failure rolls back the cap in the same transaction")
   try FileManager.default.setAttributes([.posixPermissions:0o500],ofItemAtPath:directory.path)
   precondition(cap(5)["accepted"] as? Bool==false)
   try FileManager.default.setAttributes([.posixPermissions:0o700],ofItemAtPath:directory.path)
   precondition((try! state())==old && (try! ledger()).budgets==budgets)
  }else if scenario=="retained-spend" {
   precondition(r.grantEarnedAppTimeBreak(grant(offer(issue())),owner)["accepted"] as? Bool==true);expire()
   let before=(try! ledger()).budgets
   var q=target(id);q["name"]="Renamed";q["enabled"]=true;q["packages"]=[String]();q["rule"]=["kind":"before-use"]
   precondition(r.update(q,owner)["accepted"] as? Bool==true && (try! ledger()).budgets==before)
   precondition(r.remove(target(id),owner)["accepted"] as? Bool==true && (try! ledger()).budgets==before,"Rule removal retains owner/group spent tombstone")
  }else if scenario=="malformed-ledger" {
   let q=issue()
   try RuntimeLock.withExclusiveAccess{d in
    var encoded=try JSONSerialization.jsonObject(with:d.data(forKey:FreedEarnedAppTimePolicy.key)!) as! [String:Any]
    let budgets=encoded["budgets"] as! [String:Any];encoded["budgets"]=["wrong-key":budgets.values.first!]
    d.set(try JSONSerialization.data(withJSONObject:encoded),forKey:FreedEarnedAppTimePolicy.key)
   }
   let before=try Data(contentsOf:file),rejected=r.prepareEarnedAppTimeOffer(q,owner)
   precondition(rejected["accepted"] as? Bool==false && rejected["reason"] as? String=="earned-time-state-unreadable")
   precondition(try! Data(contentsOf:file)==before,"Malformed stored budget never creates a default replacement")
  }else if scenario=="failures" {
   let prepared=offer(issue()),q=grant(prepared),before=try Data(contentsOf:file)
   DeviceActivityCenter.failNext=true;precondition(r.grantEarnedAppTimeBreak(q,owner)["accepted"] as? Bool==false)
   precondition(try! Data(contentsOf:file)==before)
   DeviceActivityCenter.replaceNextSchedule = .init(intervalStart:DateComponents(hour:1),intervalEnd:DateComponents(hour:2),repeats:true)
   precondition(r.grantEarnedAppTimeBreak(q,owner)["accepted"] as? Bool==false && isShielded(token))
   precondition(try! Data(contentsOf:file)==before)
   try FileManager.default.setAttributes([.posixPermissions:0o500],ofItemAtPath:directory.path)
   precondition(r.grantEarnedAppTimeBreak(q,owner)["accepted"] as? Bool==false && isShielded(token))
   try FileManager.default.setAttributes([.posixPermissions:0o700],ofItemAtPath:directory.path)
   precondition(try! Data(contentsOf:file)==before)
   precondition(r.grantEarnedAppTimeBreak(q,owner)["accepted"] as? Bool==true,"Failed commits retain the offer for exact retry")
  }else if scenario=="late-owner" {
   let prepared=offer(issue()),q=grant(prepared),before=try Data(contentsOf:file)
   DeviceActivityCenter.afterNextStart={r.suspend()}
   precondition(r.grantEarnedAppTimeBreak(q,owner)["accepted"] as? Bool==false && isShielded(token))
   precondition(try! Data(contentsOf:file)==before)
   precondition(r.setScope(owner)["accepted"] as? Bool==true)
   precondition(r.grantEarnedAppTimeBreak(q,owner)["accepted"] as? Bool==true)
  }else if scenario=="expiry-failure" {
   precondition(r.grantEarnedAppTimeBreak(grant(offer(issue())),owner)["accepted"] as? Bool==true)
   let before=try Data(contentsOf:file),activity=DeviceActivityCenter().activities.first{$0.rawValue.hasSuffix(".earned-v2")}!
   advance(300)
   try FileManager.default.setAttributes([.posixPermissions:0o500],ofItemAtPath:directory.path)
   precondition(!runtime().callback(activity:activity.rawValue))
   precondition(try! Data(contentsOf:file)==before)
   precondition(isShielded(token) && DeviceActivityCenter().activities.contains(activity),"Readable expired authority restores only its restriction while write failure and its monitor remain unresolved")
   try FileManager.default.setAttributes([.posixPermissions:0o700],ofItemAtPath:directory.path)
   precondition(runtime().callback(activity:activity.rawValue) && isShielded(token) && !DeviceActivityCenter().activities.contains(activity))
  }else if scenario=="evidence" {
   let prepared=offer(issue()),q=grant(prepared)
   for bad in [q.merging(["seconds":600],uniquingKeysWith:{$1}),q.merging(["templateId":"translated title"],uniquingKeysWith:{$1}),q.merging(["evidence":["method":"timer","activeDurationSec":59,"observedSteps":0,"photoProofIds":[String]()] as [String:Any]],uniquingKeysWith:{$1}),q.merging(["category":"find","templateId":"momentum-find-flower:earned-v2:300","evidence":["method":"photo","activeDurationSec":0,"observedSteps":0,"photoProofIds":["fake-proof"]]],uniquingKeysWith:{$1})] {precondition(r.grantEarnedAppTimeBreak(bad,owner)["accepted"] as? Bool==false)}
   precondition((try! ledger()).budgets.values.first!.spentSeconds==0 && isShielded(token))
  }else if scenario=="v1" {
   let q=issue();let old:[String:Any]=["version":1,"policyVersion":1,"category":"breathe","completionSessionId":"v1-session","templateId":"v1-template","templateVersion":1,"nativeInterventionId":q["nativeInterventionId"]!,"kind":"ios-app-group","tokenType":"application","groupId":id,"groupRevision":q["groupRevision"]!,"configurationGeneration":q["configurationGeneration"]!,"scopeEpoch":q["scopeEpoch"]!]
   precondition(r.grantResetReward(old,owner)["accepted"] as? Bool==true)
   let before=try state();precondition(before.leases[id]!.expiresAt-before.leases[id]!.grantedAt==120)
   precondition(r.prepareEarnedAppTimeOffer(q,owner)["accepted"] as? Bool==false)
   precondition((try! state()).leases==before.leases && (try! ledger()).budgets.values.first!.spentSeconds==0)
  }else{fatalError("Unknown scenario")}
  print("Actual runtime + real protected-state transaction v2 scenario passed: \(scenario)")
 }
}
