import Foundation
@main struct GroupCallbackPublicationCases {
 static func main()throws {
  let op=CommandLine.arguments[1],dir=FileManager.default.temporaryDirectory.appendingPathComponent("freed-group-callback-fix2-\(UUID().uuidString)")
  try FileManager.default.createDirectory(at:dir,withIntermediateDirectories:true);RuntimeLock.directory=dir;RuntimeLock.domain="app.freed.tests.group-callback-fix2.\(UUID().uuidString)"
  defer{UserDefaults(suiteName:RuntimeLock.domain)?.removePersistentDomain(forName:RuntimeLock.domain);try? FileManager.default.setAttributes([.posixPermissions:0o700],ofItemAtPath:dir.path);try? FileManager.default.removeItem(at:dir)}
  var now=Date(),uptime=ProcessInfo.processInfo.systemUptime,boot="boot-A"
  let r=FreedAppGroupsRuntime(clock:FreedAppGroupsClock(now:{now},uptime:{uptime},bootIdentity:{boot},dailyPastUsageAvailable:{true})),scope="[\"owner\",0]"
  precondition(r.setScope(scope)["accepted"] as? Bool==true)
  var snapshot=r.snapshot(scope);precondition(r.create(["version":1,"expectedStoreRevision":snapshot["revision"]!,"name":"Selected"],scope)["accepted"] as? Bool==true)
  func group()->[String:Any]{(r.snapshot(scope)["groups"] as! [[String:Any]])[0]}
  func target()->[String:Any]{let g=group();return["version":1,"expectedStoreRevision":r.snapshot(scope)["revision"]!,"id":g["id"]!,"expectedRevision":g["revision"]!]}
  let token=TestToken(value:"opaque-app");var selected=FamilyActivitySelection();selected.applicationTokens=[token];let encoded=try JSONEncoder().encode(selected)
  precondition(r.update(target(),scope,selectionData:encoded)["accepted"] as? Bool==true)
  var update=target();update["name"]="Selected";update["enabled"]=true;update["packages"]=[String]()
  if op=="group-threshold" {update["rule"]=["kind":"daily-limit","limitMinutes":30]}
  else if op=="group-schedule" {let c=Calendar.current,m=c.component(.hour,from:now)*60+c.component(.minute,from:now);update["rule"]=["kind":"scheduled","startMinute":(m+1439)%1440,"endMinute":(m+30)%1440,"days":[0,1,2,3,4,5,6]]}
  else{update["rule"]=["kind":"before-use"]}
  let configured=r.update(update,scope);precondition(configured["accepted"] as? Bool==true,"Fixture setup rejected: \(configured)")
  let g=group(),id=g["id"] as! String,revision=g["revision"] as! Int,generation=r.snapshot(scope)["configurationGeneration"] as! Int
  var activity="freed.group.\(id).g\(generation).r\(revision).\(op=="group-threshold" ? "daily":"window")",event:String?
  if op=="group-threshold"{event="freed.group.\(id).r\(revision).threshold"}
  if ["group-expiry","group-boot"].contains(op) {
   let intervention=UUID().uuidString.lowercased();try RuntimeLock.withExclusiveAccess{d in let issued=r.issueScope(for:token,d)!;precondition(r.stageClaim(id:intervention,scope:issued,d))}
   let priorRewardState=try RuntimeLock.withExclusiveAccess{d in FreedAppGroupsPolicy.decode(d.data(forKey:FreedAppGroupsPolicy.key))!}
   let rewardRequest:[String:Any]=["version":1,"policyVersion":1,"category":"breathe","completionSessionId":"fixture-session","templateId":"fixture-breathe","templateVersion":1,"nativeInterventionId":intervention,"kind":"ios-app-group","tokenType":"application","groupId":priorRewardState.groups[0].id,"groupRevision":priorRewardState.groups[0].revision,"configurationGeneration":priorRewardState.generation,"scopeEpoch":priorRewardState.scopeEpoch]
   precondition(r.grantResetReward(rewardRequest,scope)["accepted"] as? Bool==true)
   activity=DeviceActivityCenter().activities.first{$0.rawValue.hasSuffix(".break")}!.rawValue
   if op=="group-boot"{boot="boot-B"}else{now=now.addingTimeInterval(181);uptime += 181}
  }
  let file=dir.appendingPathComponent(FreedProtectionConfigurationLock.stateFileName),before=try Data(contentsOf:file)
  func shieldFrame()->[String:Set<TestToken>]{ManagedSettingsStore.shields.mapValues{$0.applications ?? []}}
  let prior=shieldFrame(),activities=Set(DeviceActivityCenter().activities)
  TestShield.writeCount=0;DeviceActivityCenter.stopCount=0
  try FileManager.default.setAttributes([.posixPermissions:0o500],ofItemAtPath:dir.path)
  r.callback(activity:activity,event:event)
  let denied=try Data(contentsOf:file);precondition(before==denied && Set(DeviceActivityCenter().activities)==activities,"Rejected group transition must preserve exact persisted state and every monitor")
  if ["group-expiry","group-boot"].contains(op) {
   // 2026-10-08 correction: a readable, permanently expired lease may regain
   // its exact additive restriction without pretending the failed save passed.
   let current=try RuntimeLock.withExclusiveAccess{FreedAppGroupsPolicy.decode($0.data(forKey:FreedAppGroupsPolicy.key))!},group=current.groups[0]
   var expected=prior;let bank="freed.app-group.slot\(group.slot).bank\(group.bank)";expected[bank]=(expected[bank] ?? []).union([token])
   precondition(shieldFrame()==expected && TestShield.writeCount==1 && DeviceActivityCenter.stopCount==0,"Read-only expiry adds exactly its originating restriction, without state writes, clears or monitor stops")
  }else{
   precondition(shieldFrame()==prior && TestShield.writeCount==0 && DeviceActivityCenter.stopCount==0,"New thresholds and other transitions still require durable publication")
  }
  try FileManager.default.setAttributes([.posixPermissions:0o700],ofItemAtPath:dir.path)
  TestShield.observeWrites={let saved=try! Data(contentsOf:file);precondition(saved != before,"Group OS publication must follow a durable commit")}
  r.callback(activity:activity,event:event);TestShield.observeWrites=nil
  let after=try Data(contentsOf:file);precondition(after != before)
  try RuntimeLock.withExclusiveAccess{d in let state=FreedAppGroupsPolicy.decode(d.data(forKey:FreedAppGroupsPolicy.key))!;if op=="group-threshold"{let f=DateFormatter();f.calendar=Calendar(identifier:.gregorian);f.locale=Locale(identifier:"en_US_POSIX");f.dateFormat="yyyy-MM-dd";precondition(state.thresholds[id]==f.string(from:now))};if ["group-expiry","group-boot"].contains(op){precondition(state.leases.isEmpty)}}
  precondition(ManagedSettingsStore.shields.values.contains{($0.applications ?? []).contains(token)})
  if ["group-expiry","group-boot"].contains(op){precondition(!DeviceActivityCenter().activities.contains{ $0.rawValue==activity })}
  print("PASS \(op): failed save preserves state/monitors; only verified irreversible expiry can add its target; writable retry commits before ordinary reconciliation")
 }
}
