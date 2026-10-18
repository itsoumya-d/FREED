import Foundation

// Framework-only boundaries are deterministic substitutes; native policy,
// binding and versioned storage run unchanged against real Darwin files/flock.
@main struct AppGroupsFilesystemCases {
 static func binding(_ r:FreedAppGroupsRuntime,_ scope:String)->[String:Any]{(r.setScope(scope) as Any) as? [String:Any] ?? [:]}
 static func main() throws {
  let args=CommandLine.arguments
  let directory:URL,domain:String
  if args.count>1 {directory=URL(fileURLWithPath:args[2]);domain=args[3]}
  else {directory=FileManager.default.temporaryDirectory.appendingPathComponent("freed-groups-filesystem-\(UUID().uuidString)");domain="app.freed.tests.groups-file.\(UUID().uuidString)";try FileManager.default.createDirectory(at:directory,withIntermediateDirectories:true)}
  RuntimeLock.directory=directory;RuntimeLock.domain=domain
  let runtime=FreedAppGroupsRuntime(clock:FreedAppGroupsClock(bootIdentity:{args.first=="never" ? nil:"boot-A"}))
  if args.count>1 {
   let owner=args[1]=="owner-b" ? "[\"owner-B\",0]":"[\"owner-A\",0]"
   if args[1]=="reset" {try RuntimeLock.withExclusiveAccess{d in FreedProtectionConfigurationLock.invalidateForReset(d);d.removeObject(forKey:FreedAppGroupsPolicy.key)};return}
   precondition(binding(runtime,owner)["accepted"] as? Bool==true)
   if args[1]=="same-owner" {
    precondition(runtime.hasAuthority(args[4]),"Genuine native lease retains authority on same-owner cold restart")
    try RuntimeLock.withExclusiveAccess{d in let s=FreedAppGroupsPolicy.decode(d.data(forKey:FreedAppGroupsPolicy.key))!;precondition(s.leases.count==1);let lease=s.leases.values.first!,group=s.groups.first!;precondition(FreedAppGroupsPolicy.leaseActive(lease,group:group,generation:s.generation,scopeEpoch:s.scopeEpoch,now:Date().timeIntervalSince1970,uptime:ProcessInfo.processInfo.systemUptime,bootIdentity:"boot-A"))}
   }else{precondition(!runtime.hasAuthority(args[4]))}
   return
  }
  defer{UserDefaults(suiteName:domain)?.removePersistentDomain(forName:domain);try? FileManager.default.removeItem(at:directory)}
  let a="[\"owner-A\",5]",file=directory.appendingPathComponent("freed-enforcement-state.v1.plist")
  precondition(binding(runtime,a)["accepted"] as? Bool==true)
  let first=runtime.snapshot(a);precondition((first["groups"] as! [Any]).isEmpty,"First launch starts with no selected apps")
  precondition(runtime.create(["version":1,"expectedStoreRevision":first["revision"]!,"name":"Selection"],a)["accepted"] as? Bool==true)
  func group()->[String:Any]{(runtime.snapshot(a)["groups"] as! [[String:Any]])[0]}
  func target()->[String:Any]{let g=group();return["version":1,"expectedStoreRevision":runtime.snapshot(a)["revision"]!,"id":g["id"]!,"expectedRevision":g["revision"]!]}
  let token=TestToken(value:"private-app");var selection=FamilyActivitySelection();selection.applicationTokens=[token]
  let selectionData=try JSONEncoder().encode(selection);precondition(runtime.update(target(),a,selectionData:selectionData)["accepted"] as? Bool==true)
  var enabled=target();enabled["name"]="Selection";enabled["enabled"]=true;enabled["rule"]=["kind":"before-use"];enabled["packages"]=[String]()
  precondition(runtime.update(enabled,a)["accepted"] as? Bool==true)
  let configured=try Data(contentsOf:file)
  var scheduled=target();scheduled["name"]="Selection";scheduled["enabled"]=true;scheduled["rule"]=["kind":"scheduled","startMinute":60,"endMinute":120,"days":[0,1,2,3,4,5,6]];scheduled["packages"]=[String]()
  DeviceActivityCenter.failNext=true
  precondition(runtime.update(scheduled,a)["accepted"] as? Bool==false,"Rejected OS registration cannot replace durable before-use policy")
  let afterRegistration=try Data(contentsOf:file);precondition(afterRegistration==configured)
  precondition(ManagedSettingsStore.shields.values.contains{($0.applications ?? []).contains(token)})
  let groupId=group()["id"] as! String
  let event=UUID().uuidString.lowercased()
  try RuntimeLock.withExclusiveAccess{d in let scope=runtime.issueScope(for:token,d)!;precondition(runtime.stageClaim(id:event,scope:scope,d))}
  let prior=try RuntimeLock.withExclusiveAccess{d in FreedAppGroupsPolicy.decode(d.data(forKey:FreedAppGroupsPolicy.key))!}
  let rewardRequest:[String:Any]=["version":1,"policyVersion":1,"category":"breathe","completionSessionId":"fixture-session","templateId":"fixture-breathe","templateVersion":1,"nativeInterventionId":event,"kind":"ios-app-group","tokenType":"application","groupId":prior.groups[0].id,"groupRevision":prior.groups[0].revision,"configurationGeneration":prior.generation,"scopeEpoch":prior.scopeEpoch]
  precondition(runtime.grantResetReward(rewardRequest,a)["accepted"] as? Bool==true)
  let grantedExpiry=try RuntimeLock.withExclusiveAccess{d in FreedAppGroupsPolicy.decode(d.data(forKey:FreedAppGroupsPolicy.key))!.leases[groupId]!.requestedExpiry}
  let grant=runtime.grant(id:event,expiry:grantedExpiry)!
  precondition(grant["nativeUnlockGrantAccepted"] as? Bool==true)
  func child(_ op:String)throws{let p=Process();p.executableURL=URL(fileURLWithPath:args[0]);p.arguments=[op,directory.path,domain,event];try p.run();p.waitUntilExit();precondition(p.terminationStatus==0)}
  try child("same-owner")
  precondition(runtime.hasAuthority(event))
  try child("owner-b")
  precondition(!runtime.ownerVerified,"Private owner readback must reflect another process changing the persisted owner")
  precondition(!runtime.hasAuthority(event));precondition(runtime.privateSelection(groupId:groupId)==nil)
  precondition(runtime.snapshot(a)["supported"] as? Bool==false,"Old owner cannot publish private data after another process changes owner")
  let current=try Data(contentsOf:file)
  precondition(binding(runtime,"[\"owner-A\",4]")["accepted"] as? Bool==false)
  let afterStale=try Data(contentsOf:file);precondition(current==afterStale)
  let unbound=FreedAppGroupsRuntime(clock:FreedAppGroupsClock(bootIdentity:{"boot-A"}))
  try FileManager.default.setAttributes([.posixPermissions:0o500],ofItemAtPath:directory.path)
  let denied=binding(unbound,"[\"owner-C\",0]")
  try FileManager.default.setAttributes([.posixPermissions:0o700],ofItemAtPath:directory.path)
  precondition(denied["accepted"] as? Bool==false && denied["stage"] as? String=="state-commit" && denied["errorCode"] as? Int != nil && !unbound.ownerVerified)
  let afterDenied=try Data(contentsOf:file);precondition(afterDenied==current)
  precondition(binding(runtime,"[\"owner-A\",6]")["accepted"] as? Bool==true)
  try child("reset")
  precondition(runtime.create(["version":1,"expectedStoreRevision":0,"name":"Late reset"],"[\"owner-A\",6]")["accepted"] as? Bool==false)
  print("Native runtime + real filesystem: first launch, registration rollback, genuine lease cold restart, cross-process owner invalidation, stale scope, failed binding receipt and late reset passed")
 }
}
