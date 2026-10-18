import Foundation
@main struct Cases {
 static var now=Date(timeIntervalSince1970:2_000_000)
 static var uptime=500_000.0
 static var boot="boot-A"
 static func main()throws {
  let directory=FileManager.default.temporaryDirectory.appendingPathComponent("freed-reward-\(UUID().uuidString)"),domain="app.freed.reward.\(UUID().uuidString)"
  try FileManager.default.createDirectory(at:directory,withIntermediateDirectories:true);RuntimeLock.directory=directory;RuntimeLock.domain=domain
  defer{UserDefaults(suiteName:domain)?.removePersistentDomain(forName:domain);try? FileManager.default.removeItem(at:directory)}
  let owner="[\"owner-A\",1]",r=FreedAppGroupsRuntime(clock:FreedAppGroupsClock(now:{now},uptime:{uptime},bootIdentity:{boot}))
  precondition(r.setScope(owner)["accepted"] as? Bool==true)
  let token=TestToken(value:"opaque-target");var selection=FamilyActivitySelection();selection.applicationTokens=[token]
  func create()->[String:Any] {let snap=r.snapshot(owner);precondition(r.create(["version":1,"expectedStoreRevision":snap["revision"]!,"name":"Group"],owner)["accepted"] as? Bool==true);let snap2=r.snapshot(owner),g=(snap2["groups"] as! [[String:Any]]).last!;let target:[String:Any]=["version":1,"expectedStoreRevision":snap2["revision"]!,"id":g["id"]!,"expectedRevision":g["revision"]!];precondition(r.update(target,owner,selectionData:try! JSONEncoder().encode(selection))["accepted"] as? Bool==true);let snap3=r.snapshot(owner);var update=target;update["expectedStoreRevision"]=snap3["revision"];update["name"]="Group";update["enabled"]=true;update["packages"]=[String]();update["rule"]=["kind":"before-use"];precondition(r.update(update,owner)["accepted"] as? Bool==true);return(r.snapshot(owner)["groups"] as! [[String:Any]]).last!}
  let g=create()
  func issue()->(String,[String:Any]) {try! RuntimeLock.withExclusiveAccess{d in let issued=r.issueScope(for:token,d)!,id=UUID().uuidString.lowercased();precondition(r.stageClaim(id:id,scope:issued,d));return(id,issued)}}
  func request(_ event:(String,[String:Any]),category:String="breathe",session:String="session-1")->[String:Any] { ["version":1,"policyVersion":1,"category":category,"completionSessionId":session,"templateId":"reset-template","templateVersion":1,"nativeInterventionId":event.0,"groupId":event.1["groupId"]!,"groupRevision":event.1["groupRevision"]!,"configurationGeneration":event.1["configurationGeneration"]!,"scopeEpoch":event.1["scopeEpoch"]!,"kind":"ios-app-group","tokenType":"application"] }
  let event=issue(),q=request(event)
  // A pre-reward v1 file has no reward ledger field or key. Its genuine old
  // lease, selection and rule still decode/read identically; no fabricated grant.
  try RuntimeLock.withExclusiveAccess{d in
   let current=FreedAppGroupsPolicy.decode(d.data(forKey:FreedAppGroupsPolicy.key))!
   precondition(d.data(forKey:FreedResetAppGroupRewardLedger.key)==nil)
   var legacy=current
   legacy.leases[g["id"] as! String]=FreedAppGroupLease(claim:current.claim!,requestedExpiry:now.timeIntervalSince1970+60,expiresAt:now.timeIntervalSince1970+60,grantedAt:now.timeIntervalSince1970,grantedUptime:uptime,bootIdentity:boot)
   let encoded=try JSONEncoder().encode(legacy);precondition(FreedAppGroupsPolicy.decode(encoded)==legacy)
   d.set(encoded,forKey:FreedAppGroupsPolicy.key);precondition(RuntimeLock.persist(d))
  }
  let legacySnapshot=r.snapshot(owner)
  try RuntimeLock.withExclusiveAccess{d in
   var legacy=FreedAppGroupsPolicy.decode(d.data(forKey:FreedAppGroupsPolicy.key))!
   precondition(legacy.groups[0].selection != nil && legacy.groups[0].enabled && legacy.groups[0].rule.kind=="before-use" && legacy.leases.count==1 && d.data(forKey:FreedResetAppGroupRewardLedger.key)==nil)
   precondition((legacySnapshot["groups"] as! [[String:Any]])[0]["applicationCount"] as? Int==1)
   legacy.leases=[:];d.set(try JSONEncoder().encode(legacy),forKey:FreedAppGroupsPolicy.key)
   d.set(true,forKey:"freed.adultFilterActive");d.set("unchanged-families-config",forKey:"freed.encryptedDns.testSentinel")
  }
  precondition(r.grant(id:event.0,expiry:now.timeIntervalSince1970+7200)==nil,"Generic API cannot bypass category duration")
  var baseline=try Data(contentsOf:directory.appendingPathComponent("freed-enforcement-state.v1.plist"))
  for bad in [q.merging(["seconds":7200],uniquingKeysWith:{$1}),q.merging(["policyVersion":2],uniquingKeysWith:{$1}),q.merging(["category":"journal"],uniquingKeysWith:{$1}),q.merging(["templateVersion":true],uniquingKeysWith:{$1}),q.merging(["scopeEpoch":99],uniquingKeysWith:{$1}),q.merging(["groupRevision":99],uniquingKeysWith:{$1}),q.merging(["configurationGeneration":99],uniquingKeysWith:{$1})] {precondition(r.grantResetReward(bad,owner)["accepted"] as? Bool==false)}
  precondition(try! Data(contentsOf:directory.appendingPathComponent("freed-enforcement-state.v1.plist"))==baseline)
  DeviceActivityCenter.afterNextStart={r.suspend()}
  precondition(r.grantResetReward(q,owner)["accepted"] as? Bool==false,"A late private-owner suspension cannot consume a session or open its target")
  precondition(try! Data(contentsOf:directory.appendingPathComponent("freed-enforcement-state.v1.plist"))==baseline)
  precondition(r.setScope(owner)["accepted"] as? Bool==true)
  baseline=try Data(contentsOf:directory.appendingPathComponent("freed-enforcement-state.v1.plist"))
  TestRewardPublication.afterWrite={TestRewardPublication.afterWrite=nil;r.suspend()}
  precondition(r.grantResetReward(q,owner)["accepted"] as? Bool==false,"Suspension during staged shield publication must rollback consumption and relock")
  precondition(try! Data(contentsOf:directory.appendingPathComponent("freed-enforcement-state.v1.plist"))==baseline)
  precondition(r.setScope(owner)["accepted"] as? Bool==true)
  baseline=try Data(contentsOf:directory.appendingPathComponent("freed-enforcement-state.v1.plist"))
  DeviceActivityCenter.failNext=true;precondition(r.grantResetReward(q,owner)["accepted"] as? Bool==false)
  precondition(try! Data(contentsOf:directory.appendingPathComponent("freed-enforcement-state.v1.plist"))==baseline,"Registration rejection keeps claim and spent ledger unchanged")
  try FileManager.default.setAttributes([.posixPermissions:0o500],ofItemAtPath:directory.path)
  let denied=r.grantResetReward(q,owner);try FileManager.default.setAttributes([.posixPermissions:0o700],ofItemAtPath:directory.path)
  precondition(denied["accepted"] as? Bool==false && ManagedSettingsStore.shields.values.contains{($0.applications ?? []).contains(token)},"Failed file commit relocks and leaves completion unconsumed")
  let accepted=r.grantResetReward(q,owner);precondition(accepted["accepted"] as? Bool==true && accepted["seconds"] as? Int==120 && accepted["effective"] as? Bool==true)
  let deadline=accepted["expiresAt"] as! String;precondition(ISO8601DateFormatter().date(from:deadline)!.timeIntervalSince1970==now.timeIntervalSince1970+120)
  now=now.addingTimeInterval(20);uptime += 20
  let retry=r.grantResetReward(q,owner);precondition(retry["accepted"] as? Bool==true && retry["replayed"] as? Bool==true && retry["expiresAt"] as? String==deadline,"Exact retry never renews")
  precondition(r.grantResetReward(q.merging(["category":"move"],uniquingKeysWith:{$1}),owner)["accepted"] as? Bool==false)
  let restart=FreedAppGroupsRuntime(clock:FreedAppGroupsClock(now:{now},uptime:{uptime},bootIdentity:{boot}));precondition(restart.setScope(owner)["accepted"] as? Bool==true);precondition(restart.grantResetReward(q,owner)["expiresAt"] as? String==deadline)
  // A changed wall clock cannot extend the monotonic duration.
  now=now.addingTimeInterval(-10);uptime += 121
  precondition(r.grantResetReward(q,owner)["accepted"] as? Bool==false)
  now=now.addingTimeInterval(200);_ = r.snapshot(owner);precondition(r.grantResetReward(q,owner)["accepted"] as? Bool==false)
  let event2=issue(),q2=request(event2,category:"move",session:"session-2")
  let moved=r.grantResetReward(q2,owner);precondition(moved["accepted"] as? Bool==true && moved["seconds"] as? Int==300)
  let moveDeadline=moved["expiresAt"] as! String;precondition(ISO8601DateFormatter().date(from:moveDeadline)!.timeIntervalSince1970==now.timeIntervalSince1970+300)
  boot="boot-B";uptime += 30;precondition(r.grantResetReward(q2,owner)["accepted"] as? Bool==false);_ = r.snapshot(owner)
  precondition(ManagedSettingsStore.shields.values.contains{($0.applications ?? []).contains(token)})
  // Independent overlapping group remains restrictive.
  _=create();let event3=issue(),q3=request(event3,category:"find",session:"session-3")
  let found=r.grantResetReward(q3,owner);precondition(found["accepted"] as? Bool==true && found["seconds"] as? Int==300 && found["effective"] as? Bool==false && found["remainingRestrictionCount"] as? Int==1)
  let stacked=issue(),stackedQ=request(stacked,category:"breathe",session:"session-4");precondition(r.grantResetReward(stackedQ,owner)["accepted"] as? Bool==false,"Another group cannot stack a window")
  // Existing lease in a later group + a reused claim in an earlier group must
  // never let the generic API create a second uncategorized 2-hour window.
  func setFirstEnabled(_ enabled:Bool) {
   let snap=r.snapshot(owner),first=(snap["groups"] as! [[String:Any]])[0]
   let edit:[String:Any]=["version":1,"expectedStoreRevision":snap["revision"]!,"id":first["id"]!,"expectedRevision":first["revision"]!,"name":"First group","enabled":enabled,"rule":["kind":"before-use"],"packages":[String]()]
   precondition(r.update(edit,owner)["accepted"] as? Bool==true)
  }
  setFirstEnabled(false)
  let laterEvent=issue(),laterQ=request(laterEvent,category:"breathe",session:"session-generic-probe")
  precondition(r.grantResetReward(laterQ,owner)["accepted"] as? Bool==true)
  setFirstEnabled(true)
  try RuntimeLock.withExclusiveAccess{d in let firstIssued=r.issueScope(for:token,d)!;precondition(firstIssued["groupId"] as? String != laterEvent.1["groupId"] as? String);precondition(r.stageClaim(id:laterEvent.0,scope:firstIssued,d))}
  precondition(r.grant(id:laterEvent.0,expiry:now.timeIntervalSince1970+7200)==nil,"Generic API must not use another group's lease as permission to create a new grant")
  precondition(r.setScope("[\"owner-B\",2]")["accepted"] as? Bool==true);precondition(r.grantResetReward(q3,owner)["accepted"] as? Bool==false)
  precondition(r.setScope("[\"owner-A\",3]")["accepted"] as? Bool==true);precondition(r.grantResetReward(q3,"[\"owner-A\",3]")["accepted"] as? Bool==false)
  try RuntimeLock.withExclusiveAccess{d in FreedProtectionConfigurationLock.invalidateForReset(d);FreedAppGroupsRuntime.reset(d)}
  precondition(r.grantResetReward(q3,"[\"owner-A\",3]")["accepted"] as? Bool==false,"Reset rejects original completion/intervention regardless of deleted ledger")
  precondition(ManagedSettingsStore.adultProtected)
  try RuntimeLock.withExclusiveAccess{d in precondition(d.bool(forKey:"freed.adultFilterActive") && d.string(forKey:"freed.encryptedDns.testSentinel")=="unchanged-families-config")}
  precondition(g["id"] != nil)
  print("Native reward runtime + real atomic files: caps, strict version, generic bypass denial, monitor/commit rollback, same-owner restart, exact retry, expired/clock/reboot denial, overlapping restrictions, stacking, owner and reset fences passed")
 }
}
