import Foundation

// Production runtime/storage/lock; only unavailable Apple frameworks are replaced.
@main struct ReconciliationCases {
 static var now=Date(timeIntervalSince1970:1_900_022_400)
 static var uptime=10_000.0
 static func main()throws {
  let directory=FileManager.default.temporaryDirectory.appendingPathComponent("freed-reconciliation-\(UUID().uuidString)"),domain="app.freed.reconciliation.\(UUID().uuidString)"
  try FileManager.default.createDirectory(at:directory,withIntermediateDirectories:true);RuntimeLock.directory=directory;RuntimeLock.domain=domain
  defer{try? FileManager.default.setAttributes([.posixPermissions:0o700],ofItemAtPath:directory.path);UserDefaults(suiteName:domain)?.removePersistentDomain(forName:domain);try? FileManager.default.removeItem(at:directory)}
  let owner="[\"owner-A\",1]",r=FreedAppGroupsRuntime(clock:FreedAppGroupsClock(now:{now},uptime:{uptime},bootIdentity:{"boot-A"})),centre=DeviceActivityCenter(),token=TestToken(value:"originating-app")
  precondition(r.setScope(owner)["accepted"] as? Bool==true)
  func state()throws->FreedAppGroupsState {try RuntimeLock.withExclusiveAccess{FreedAppGroupsPolicy.decode($0.data(forKey:FreedAppGroupsPolicy.key))!}}
  func row()->[String:Any]{(r.snapshot(owner)["groups"] as! [[String:Any]])[0]}
  func target()->[String:Any]{let s=r.snapshot(owner),g=(s["groups"] as! [[String:Any]])[0];return["version":1,"expectedStoreRevision":s["revision"]!,"id":g["id"]!,"expectedRevision":g["revision"]!]}
  let s=r.snapshot(owner);precondition(r.create(["version":1,"expectedStoreRevision":s["revision"]!,"name":"Focus"],owner)["accepted"] as? Bool==true)
  var selection=FamilyActivitySelection();selection.applicationTokens=[token]
  let selectionData=try JSONEncoder().encode(selection)
  precondition(r.update(target(),owner,selectionData:selectionData)["accepted"] as? Bool==true)
  func activate(_ rule:[String:Any]) {var q=target();q["name"]="Focus";q["enabled"]=true;q["packages"]=[String]();q["rule"]=rule;precondition(r.update(q,owner)["accepted"] as? Bool==true)}
  let scenario=CommandLine.arguments[1]
  activate(["kind":"daily-limit","limitMinutes":30])
  let original=try state(),g=original.groups[0],activity=centre.activities.first!,schedule=centre.schedule(for:activity)!,events=centre.events(for:activity),event=events.keys.first!.rawValue
  let file=directory.appendingPathComponent("freed-enforcement-state.v1.plist"),before=try Data(contentsOf:file)
  if scenario=="monitor" {
   centre.stopMonitoring([activity]);precondition(row()["ready"] as? Bool==true,"A lost daily monitor must be restored by snapshot reconciliation")
   precondition(centre.schedule(for:activity)==schedule && centre.events(for:activity)==events)
   precondition(try! Data(contentsOf:file)==before,"Monitor recovery cannot change rule revisions, thresholds, owner or leases")
   let wrong=DeviceActivitySchedule(intervalStart:DateComponents(hour:1),intervalEnd:DateComponents(hour:2),repeats:true)
   try centre.startMonitoring(activity,during:wrong)
   precondition(row()["ready"] as? Bool==true && centre.events(for:activity)==events,"Wrong schedule/events must be repaired for the same rule")
   precondition(try! state()==original)
   activate(["kind":"scheduled","startMinute":0,"endMinute":1439,"days":[0,1,2,3,4,5,6]])
   let scheduled=try state(),n=centre.activities.first!,expected=centre.schedule(for:n)!
   centre.stopMonitoring([n]);precondition(row()["ready"] as? Bool==true,"A scheduled monitor must be restored")
   precondition(centre.schedule(for:n)==expected && (try! state())==scheduled)
   precondition(ManagedSettingsStore.shields.values.contains{($0.applications ?? []).contains(token)})
  }else if scenario=="monitor-failure" {
   r.callback(activity:activity.rawValue,event:event)
   let shield=ManagedSettingsStore(named:.init("freed.app-group.slot\(g.slot).bank\(g.bank)")).shield
   precondition(shield.applications==[token]);let established=try state()
   centre.stopMonitoring([activity]);DeviceActivityCenter.failNext=true
   let failed=r.snapshot(owner),failedRow=(failed["groups"] as! [[String:Any]])[0]
   precondition(failed["reason"] as? String=="monitor-registration-failed" && failedRow["ready"] as? Bool==false,"Failed reinstallation must remain visible")
   precondition(shield.applications==[token] && (try! state())==established,"Failure retains the working bank and durable authority")
   precondition(row()["ready"] as? Bool==true,"A later foreground retry can repair the same rule")
   let wrong=DeviceActivitySchedule(intervalStart:DateComponents(hour:1),intervalEnd:DateComponents(hour:2),repeats:true)
   try centre.startMonitoring(activity,during:wrong);DeviceActivityCenter.replaceNextSchedule=wrong
   let unreadback=r.snapshot(owner)
   precondition(unreadback["reason"] as? String=="monitor-readback-failed")
   precondition(centre.schedule(for:activity)==wrong && shield.applications==[token] && (try! state())==established,"Failed readback restores the previous monitor without clearing the working shield")
  }else if scenario=="monitor-capacity" {
   centre.stopMonitoring([activity])
   for index in 0..<20 {try centre.startMonitoring(.init("other.monitor.\(index)"),during:schedule)}
   let full=r.snapshot(owner)
   precondition(full["reason"] as? String=="monitor-capacity" && centre.activities.count==20)
   precondition(try! state()==original)
  }else if scenario=="binding-denial" {
   try FileManager.default.setAttributes([.posixPermissions:0o500],ofItemAtPath:directory.path)
   let failed=r.setScope(owner)
   try FileManager.default.setAttributes([.posixPermissions:0o700],ofItemAtPath:directory.path)
   precondition(failed["accepted"] as? Bool==false && failed["stage"] as? String=="state-commit")
   let hidden=r.snapshot(owner)
   precondition(hidden["reason"] as? String=="sign-in-required" && (hidden["groups"] as! [Any]).isEmpty)
   precondition(r.setScope(owner)["accepted"] as? Bool==true && row()["id"] as? String==g.id)
   precondition(try! state()==original,"Same-scope rebind recovers presentation without changing authority")
  }else if scenario=="callback-owner-fence" {
   try FileManager.default.setAttributes([.posixPermissions:0o500],ofItemAtPath:directory.path)
   RuntimeLock.afterFailure={
    RuntimeLock.afterFailure=nil
    try! FileManager.default.setAttributes([.posixPermissions:0o700],ofItemAtPath:directory.path)
    precondition(r.setScope("[\"owner-B\",2]")["accepted"] as? Bool==true)
   }
   r.callback(activity:activity.rawValue,event:event)
   let changed=try state()
   precondition(changed.scopeEpoch>original.scopeEpoch && changed.thresholds.isEmpty,"A failed threshold must not be replayed into a replacement owner")
   precondition(!ManagedSettingsStore.shields.values.contains{($0.applications ?? []).contains(token)})
  }else if scenario=="threshold-commit" || scenario=="threshold-lock" {
   let lock=directory.appendingPathComponent("freed-protection-configuration.lock")
   let deniedPath=scenario=="threshold-lock" ? lock.path:directory.path
   try FileManager.default.setAttributes([.posixPermissions:scenario=="threshold-lock" ? 0:0o500],ofItemAtPath:deniedPath)
   RuntimeLock.afterFailure={try! FileManager.default.setAttributes([.posixPermissions:scenario=="threshold-lock" ? 0o600:0o700],ofItemAtPath:deniedPath)}
   let attempts=RuntimeLock.attempts;r.callback(activity:activity.rawValue,event:event);let retries=RuntimeLock.attempts-attempts;RuntimeLock.afterFailure=nil
   precondition(retries==2,"A transient native callback failure must retry once")
   let recovered=try state();precondition(recovered.thresholds[g.id] != nil,"The daily threshold cannot disappear after a transient persistence failure")
   precondition(row()["active"] as? Bool==true && ManagedSettingsStore.shields.values.contains{($0.applications ?? []).contains(token)})
   precondition(recovered.revision==original.revision && recovered.groups==original.groups && recovered.leases==original.leases)
  }else if scenario=="expiry-commit" {
   r.callback(activity:activity.rawValue,event:event)
   let id=UUID().uuidString.lowercased()
   try RuntimeLock.withExclusiveAccess{d in precondition(r.stageClaim(id:id,scope:r.issueScope(for:token,d)!,d))}
   let request:[String:Any]=["version":1,"policyVersion":1,"category":"breathe","completionSessionId":"session","templateId":"breathe","templateVersion":1,"nativeInterventionId":id,"kind":"ios-app-group","tokenType":"application","groupId":g.id,"groupRevision":g.revision,"configurationGeneration":original.generation,"scopeEpoch":original.scopeEpoch]
   precondition(r.grantResetReward(request,owner)["accepted"] as? Bool==true)
   let leaseState=try state(),expiry=centre.activities.first{$0.rawValue.hasSuffix(".break")}!
   now=now.addingTimeInterval(121);uptime += 121
   try FileManager.default.setAttributes([.posixPermissions:0o500],ofItemAtPath:directory.path)
   RuntimeLock.afterFailure={try! FileManager.default.setAttributes([.posixPermissions:0o700],ofItemAtPath:directory.path)}
   let attempts=RuntimeLock.attempts;r.callback(activity:expiry.rawValue);let retries=RuntimeLock.attempts-attempts;RuntimeLock.afterFailure=nil
   precondition(retries==2,"Expiry must retry one transient failed file commit")
   let recovered=try state();precondition(recovered.leases.isEmpty && recovered.revision==leaseState.revision && recovered.groups==leaseState.groups)
   precondition(!centre.activities.contains(expiry) && ManagedSettingsStore.shields.values.contains{($0.applications ?? []).contains(token)},"Committed expiry stops its monitor only after relocking")
  }else if scenario=="persistent-callback" {
   try FileManager.default.setAttributes([.posixPermissions:0o500],ofItemAtPath:directory.path)
   let attempts=RuntimeLock.attempts;r.callback(activity:activity.rawValue,event:event);let retries=RuntimeLock.attempts-attempts
   try FileManager.default.setAttributes([.posixPermissions:0o700],ofItemAtPath:directory.path)
   precondition(retries==2,"Persistent denial stops at the bounded retry limit")
   precondition(try! Data(contentsOf:file)==before,"Persistent failure cannot publish uncommitted threshold or mutate authority")
   precondition(!ManagedSettingsStore.shields.values.contains{($0.applications ?? []).contains(token)})
  }else{fatalError("Unknown scenario")}
  print("Actual runtime + real file/lock reconciliation scenario passed: \(scenario)")
 }
}
