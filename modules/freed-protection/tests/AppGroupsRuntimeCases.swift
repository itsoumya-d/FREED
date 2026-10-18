import Foundation
struct RuntimeBootClock {
 static var boot="boot-A"
 static var uptime=ProcessInfo.processInfo.systemUptime
 static func runtime()->FreedAppGroupsRuntime { FreedAppGroupsRuntime(clock:FreedAppGroupsClock(uptime:{uptime},bootIdentity:{boot})) }
}
@main struct Cases {
 static func main()throws {
  let d=FreedProtectionConfigurationLock.defaults,r=RuntimeBootClock.runtime(),a="[\"owner-A\",1]",b="[\"owner-B\",2]"
  precondition(r.setScope(a)["accepted"] as? Bool == true);let first=r.snapshot(a)
  func revision()->Int{r.snapshot(a)["revision"] as! Int}
  func create(_ name:String)->[String:Any]{r.create(["version":1,"expectedStoreRevision":revision(),"name":name],a)}
  precondition((first["groups"] as! [[String:Any]]).isEmpty)
  let one=create("One");precondition(one["accepted"] as? Bool == true)
  var group=(r.snapshot(a)["groups"] as! [[String:Any]])[0];let id=group["id"] as! String
  let token=TestToken(value:"opaque-app-one");var selected=FamilyActivitySelection();selected.applicationTokens=[token]
  func encoded(_ selection:FamilyActivitySelection)->Data {try! JSONEncoder().encode(selection)}
  func target(_ group:[String:Any])->[String:Any]{["version":1,"expectedStoreRevision":revision(),"id":group["id"]!,"expectedRevision":group["revision"]!]}
  precondition(r.update(target(group),a,selectionData:encoded(selected))["accepted"] as? Bool == true)
  group=(r.snapshot(a)["groups"] as! [[String:Any]])[0]
  precondition(group["applicationCount"] as? Int==0 && group["draftApplicationCount"] as? Int==1)
  var update=target(group);update["name"]="One";update["enabled"]=true;update["rule"]=["kind":"before-use"];update["packages"]=[String]()
  precondition(r.update(update,a)["accepted"] as? Bool==true)
  precondition(ManagedSettingsStore.shields.values.contains{($0.applications ?? []).contains(token)})
  group=(r.snapshot(a)["groups"] as! [[String:Any]])[0]
  let before=FreedAppGroupsPolicy.decode(d.data(forKey:FreedAppGroupsPolicy.key))!
  d.failSync=true
  precondition(r.update(target(group),a,selectionData:encoded(FamilyActivitySelection()))["accepted"] as? Bool==false)
  precondition(ManagedSettingsStore.shields.values.contains{($0.applications ?? []).contains(token)})
  precondition(FreedAppGroupsPolicy.decode(d.data(forKey:FreedAppGroupsPolicy.key))==before)
  // A second active group continues shielding the same target after a scoped break.
  precondition(create("Two")["accepted"] as? Bool==true)
  var two=(r.snapshot(a)["groups"] as! [[String:Any]])[1]
  precondition(r.update(target(two),a,selectionData:encoded(selected))["accepted"] as? Bool==true)
  two=(r.snapshot(a)["groups"] as! [[String:Any]])[1]
  var second=target(two);second["name"]="Two";second["enabled"]=true;second["rule"]=["kind":"before-use"];second["packages"]=[String]()
  precondition(r.update(second,a)["accepted"] as? Bool==true)
  let scope=r.issueScope(for:token,d)!;let event=UUID().uuidString.lowercased()
  precondition(r.stageClaim(id:event,scope:scope,d))
  precondition(r.grant(id:event,expiry:Date().timeIntervalSince1970+7200)==nil,"Generic group creation cannot bypass category policy")
  let rewardRequest:[String:Any]=["version":1,"policyVersion":1,"category":"breathe","completionSessionId":"fixture-session","templateId":"fixture-breathe","templateVersion":1,"nativeInterventionId":event,"kind":"ios-app-group","tokenType":"application","groupId":before.groups[0].id,"groupRevision":before.groups[0].revision,"configurationGeneration":before.generation,"scopeEpoch":before.scopeEpoch]
  precondition(r.grantResetReward(rewardRequest,a)["accepted"] as? Bool==true)
  let requestedExpiry=FreedAppGroupsPolicy.decode(d.data(forKey:FreedAppGroupsPolicy.key))!.leases[id]!.requestedExpiry
  let grant=r.grant(id:event,expiry:requestedExpiry)!
  let expiryActivity=DeviceActivityCenter().activities.first{$0.rawValue.hasSuffix(".break")}!
  let expirySchedule=DeviceActivityCenter().schedule(for:expiryActivity)!
  precondition(Calendar.current.date(from:expirySchedule.intervalStart)!.timeIntervalSince1970>=requestedExpiry,"native relock cannot fire before fractional expiry and defer until interval end")
  precondition(grant["nativeUnlockGrantInterventionId"] as? String==event)
  precondition(grant["nativeUnlockGrantAccepted"] as? Bool==true && grant["appGroupBreakEffective"] as? Bool==false)
  precondition(grant["activeUnlockExpiresAt"]==nil && grant["appGroupRemainingRestrictionCount"] as? Int==1)
  precondition(ManagedSettingsStore.adultProtected)
  // Same-owner cold binding preserves genuine scope/claim/lease; changed owner relocks.
  let restart=RuntimeBootClock.runtime();restart.suspend()
  let held=d.data(forKey:FreedAppGroupsPolicy.key)
  let unknownRead=restart.snapshot(a);precondition(unknownRead["supported"] as? Bool==false && (unknownRead["groups"] as! [Any]).isEmpty)
  precondition(restart.create(["version":1,"expectedStoreRevision":0,"name":"Late old read"],a)["accepted"] as? Bool==false)
  precondition(restart.privateSelection(groupId:id)==nil && d.data(forKey:FreedAppGroupsPolicy.key)==held)
  let epochBeforeSameOwner = d.integer(forKey:"freed.deviceAdult.mutationEpoch.v1")
  precondition(restart.setScope(a)["accepted"] as? Bool == true);precondition(restart.hasAuthority(event))
  precondition(d.integer(forKey:"freed.deviceAdult.mutationEpoch.v1")==epochBeforeSameOwner,"Same-owner bind must not revoke adult native authority")
  restart.suspend();precondition((restart.snapshot(a)["groups"] as! [Any]).isEmpty)
  precondition(restart.create(["version":1,"expectedStoreRevision":0,"name":"Suspended"],a)["accepted"] as? Bool==false)
  precondition(!restart.ownerVerified && d.data(forKey:FreedAppGroupsPolicy.key)==held)
  precondition(restart.setScope(a)["accepted"] as? Bool == true);precondition(restart.hasAuthority(event))
  // New boot may have a greater uptime; kernel identity still revokes authority and relocks.
  RuntimeBootClock.boot="boot-B";RuntimeBootClock.uptime += 50
  let afterBoot=RuntimeBootClock.runtime();precondition(afterBoot.setScope(a)["accepted"] as? Bool == true);precondition(!afterBoot.hasAuthority(event))
  precondition(afterBoot.grant(id:event,expiry:requestedExpiry)==nil)
  precondition(FreedAppGroupsPolicy.decode(d.data(forKey:FreedAppGroupsPolicy.key))!.groups.count==2)
  precondition(ManagedSettingsStore.shields.values.filter{($0.applications ?? []).contains(token)}.count>=2)
  precondition(!afterBoot.stageClaim(id:UUID().uuidString.lowercased(),scope:scope,d))
  let epochBeforeNewOwner = d.integer(forKey:"freed.deviceAdult.mutationEpoch.v1")
  precondition(restart.setScope(b)["accepted"] as? Bool == true);precondition(!restart.hasAuthority(event))
  precondition(d.integer(forKey:"freed.deviceAdult.mutationEpoch.v1")==epochBeforeNewOwner+1,"Changed owner must revoke adult native authority in its configuration transaction")
  precondition(ManagedSettingsStore.shields.values.filter{($0.applications ?? []).contains(token)}.count>=2)
  let staleRead=restart.snapshot(a);precondition(staleRead["supported"] as? Bool==false && (staleRead["groups"] as! [Any]).isEmpty)
  let staleMutation=restart.create(["version":1,"expectedStoreRevision":0,"name":"Stale"],a)
  precondition(staleMutation["accepted"] as? Bool==false && ((staleMutation["snapshot"] as! [String:Any])["groups"] as! [Any]).isEmpty)
  let oldOS=FreedAppGroupsRuntime(clock:FreedAppGroupsClock(uptime:{RuntimeBootClock.uptime},bootIdentity:{RuntimeBootClock.boot},dailyPastUsageAvailable:{false}))
  precondition(oldOS.setScope(b)["accepted"] as? Bool == true);let prior=oldOS.snapshot(b),priorGroup=(prior["groups"] as! [[String:Any]])[0]
  let unsupported:[String:Any]=["version":1,"expectedStoreRevision":prior["revision"]!,"id":priorGroup["id"]!,"expectedRevision":priorGroup["revision"]!,"name":"One","enabled":true,"rule":["kind":"daily-limit","limitMinutes":30],"packages":[String]()]
  let dailyRejected=oldOS.update(unsupported,b)
  precondition(dailyRejected["accepted"] as? Bool==false && dailyRejected["reason"] as? String=="daily-past-usage-unavailable")
  precondition((oldOS.snapshot(b)["groups"] as! [[String:Any]])[0]["revision"] as? Int==priorGroup["revision"] as? Int)
  precondition(ManagedSettingsStore.shields.values.filter{($0.applications ?? []).contains(token)}.count>=2)
  precondition(restart.setScope("[null,3]")["bindingCurrent"] as? Bool == true);precondition((restart.snapshot("[null,3]")["groups"] as! [Any]).isEmpty)
  precondition(restart.create(["version":1,"expectedStoreRevision":0,"name":"Guest"],"[null,3]")["accepted"] as? Bool==false)
  // Corrupt private selection data cannot turn existing shields into an empty set.
  var corrupted=FreedAppGroupsPolicy.decode(d.data(forKey:FreedAppGroupsPolicy.key))!
  corrupted.groups[0].selection=Data([255,0,1]);d.set(try JSONEncoder().encode(corrupted),forKey:FreedAppGroupsPolicy.key)
  let protectedCount=ManagedSettingsStore.shields.values.filter{($0.applications ?? []).contains(token)}.count
  let unreadable=restart.snapshot("[null,3]");precondition(unreadable["supported"] as? Bool==false)
  restart.callback(activity:"freed.group.\(id).g0.r2.window")
  precondition(ManagedSettingsStore.shields.values.filter{($0.applications ?? []).contains(token)}.count==protectedCount)
  FreedAppGroupsRuntime.reset(d);d.values=[:]
  var oldSelection=FamilyActivitySelection();let legacyToken=TestToken(value:"legacy-individual"),category=TestToken(value:"legacy-category"),domain=TestToken(value:"legacy-domain")
  oldSelection.applicationTokens=[legacyToken];oldSelection.categoryTokens=[category];oldSelection.webDomainTokens=[domain]
  d.set(encoded(oldSelection),forKey:"freed.familyActivitySelection");d.set(true,forKey:"freed.appLimit.active")
  let defaultStore=ManagedSettingsStore();defaultStore.shield.applications=[legacyToken];defaultStore.shield.applicationCategories=[category];defaultStore.shield.webDomains=[domain]
  let migration=RuntimeBootClock.runtime(),owner="[\"legacy-owner\",1]";precondition(migration.setScope(owner)["accepted"] as? Bool == true)
  let migrated=migration.snapshot(owner),migratedAgain=migration.snapshot(owner)
  precondition(migrated["revision"] as? Int==migratedAgain["revision"] as? Int)
  let oldGroup=(migrated["groups"] as! [[String:Any]])[0];precondition(oldGroup["id"] as? String=="legacy-default" && oldGroup["categoryCount"] as? Int==1 && oldGroup["webDomainCount"] as? Int==1)
  let adopted:[String:Any]=["version":1,"expectedStoreRevision":migrated["revision"]!,"id":"legacy-default","expectedRevision":oldGroup["revision"]!,"name":"Default group","enabled":true,"rule":["kind":"before-use"],"packages":[String]()]
  precondition(migration.update(adopted,owner)["accepted"] as? Bool==true)
  precondition(defaultStore.shield.applicationCategories==[category] && defaultStore.shield.webDomains==[domain] && ManagedSettingsStore.adultProtected)
  // Capacity rejection retains the current bank and every other owner monitor.
  let centre=DeviceActivityCenter(),schedule=DeviceActivitySchedule(intervalStart:DateComponents(hour:0),intervalEnd:DateComponents(hour:23,minute:59),repeats:true)
  for index in 0..<20 {try centre.startMonitoring(.init("other.monitor.\(index)"),during:schedule)}
  let current=migration.snapshot(owner),currentGroup=(current["groups"] as! [[String:Any]])[0]
  var capacity=adopted;capacity["expectedStoreRevision"]=current["revision"]!;capacity["expectedRevision"]=currentGroup["revision"]!;capacity["rule"]=["kind":"scheduled","startMinute":1320,"endMinute":420,"days":[0,1,2,3,4,5,6]]
  let failed=migration.update(capacity,owner);precondition(failed["accepted"] as? Bool==false && failed["reason"] as? String=="monitor-capacity")
  precondition(centre.activities.count==20 && ManagedSettingsStore.shields.values.contains{($0.applications ?? []).contains(legacyToken)})
  print("Actual native group runtime cases: pending selection isolation/persistence rollback/overlap/scoped receipt/same-owner restart/different owner relock/stale request privacy/signedout mutation rejection")
 }
}
