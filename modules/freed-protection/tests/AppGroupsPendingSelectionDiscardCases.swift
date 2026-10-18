import Foundation

@main struct AppGroupsPendingSelectionDiscardCases {
 static func main() throws {
  let directory=FileManager.default.temporaryDirectory.appendingPathComponent("freed-draft-discard-\(UUID().uuidString)"),domain="app.freed.tests.discard.\(UUID().uuidString)"
  try FileManager.default.createDirectory(at:directory,withIntermediateDirectories:true)
  RuntimeLock.directory=directory;RuntimeLock.domain=domain
  defer{UserDefaults(suiteName:domain)?.removePersistentDomain(forName:domain);try? FileManager.default.removeItem(at:directory)}
  let runtime=FreedAppGroupsRuntime(clock:FreedAppGroupsClock(bootIdentity:{"boot-A"})),scope="[\"owner-A\",1]"
  precondition(runtime.setScope(scope)["accepted"] as? Bool==true)
  let initial=runtime.snapshot(scope)
  precondition(runtime.create(["version":1,"expectedStoreRevision":initial["revision"]!,"name":"Focus"],scope)["accepted"] as? Bool==true)
  func state()throws->FreedAppGroupsState{try RuntimeLock.withExclusiveAccess{d in FreedAppGroupsPolicy.decode(d.data(forKey:FreedAppGroupsPolicy.key))!}}
  func target()throws->[String:Any]{let s=try state(),g=s.groups[0];return["version":1,"id":g.id,"expectedRevision":g.revision,"expectedStoreRevision":s.revision]}
  let committed=TestToken(value:"private-committed-app"),pending=TestToken(value:"private-pending-app")
  var selection=FamilyActivitySelection();selection.applicationTokens=[committed]
  let selected=runtime.update(try target(),scope,selectionData:try JSONEncoder().encode(selection));precondition(selected["accepted"] as? Bool==true)
  var enable=try target();enable["name"]="Focus";enable["enabled"]=true;enable["rule"]=["kind":"before-use"];enable["packages"]=[String]()
  precondition(runtime.update(enable,scope)["accepted"] as? Bool==true)
  let event=UUID().uuidString.lowercased()
  try RuntimeLock.withExclusiveAccess{d in precondition(runtime.stageClaim(id:event,scope:runtime.issueScope(for:committed,d)!,d))}
  let priorRewardState=try state()
  let rewardRequest:[String:Any]=["version":1,"policyVersion":1,"category":"breathe","completionSessionId":"fixture-session","templateId":"fixture-breathe","templateVersion":1,"nativeInterventionId":event,"kind":"ios-app-group","tokenType":"application","groupId":priorRewardState.groups[0].id,"groupRevision":priorRewardState.groups[0].revision,"configurationGeneration":priorRewardState.generation,"scopeEpoch":priorRewardState.scopeEpoch]
  precondition(runtime.grantResetReward(rewardRequest,scope)["accepted"] as? Bool==true)
  let next=runtime.snapshot(scope);precondition(runtime.create(["version":1,"expectedStoreRevision":next["revision"]!,"name":"Other draft"],scope)["accepted"] as? Bool==true)
  var draft=FamilyActivitySelection();draft.applicationTokens=[pending]
  let pendingData=try JSONEncoder().encode(draft)
  func seedPending()throws{try RuntimeLock.withExclusiveAccess{d in var s=FreedAppGroupsPolicy.decode(d.data(forKey:FreedAppGroupsPolicy.key))!;s.groups[0].pendingSelection=pendingData;s.groups[1].pendingSelection=pendingData;d.set(try JSONEncoder().encode(s),forKey:FreedAppGroupsPolicy.key);d.set(true,forKey:"freed.adultFilterActive");d.set("protected",forKey:"freed.encryptedDns.testPolicy")}}
  let file=directory.appendingPathComponent(FreedProtectionConfigurationLock.stateFileName)
  func bytes()throws->Data{try Data(contentsOf:file)}
  func sameBytes(_ expected:Data)throws{let actual=try bytes();precondition(actual==expected)}
  func osState()->String{let monitors=DeviceActivityCenter.records.map{"\($0.key.rawValue)|\($0.value.0)|\($0.value.1)"}.sorted();let shields=ManagedSettingsStore.shields.map{"\($0.key)|\($0.value.applications ?? [])|\($0.value.applicationCategories ?? [])|\($0.value.webDomains ?? [])|\($0.value.webDomainCategories ?? [])"}.sorted();return "\(monitors)|\(shields)|\(ManagedSettingsStore.adultProtected)"}
  func assertNoPublication(_ body:()throws->Void)throws{let before=osState(),count=TestOSPublication.count;try body();precondition(osState()==before && TestOSPublication.count==count,"Discard must issue zero monitor start/stop and shield writes/clears on every result")}
  try seedPending();let before=try state(),request=try target()
  let envelopeBefore=(try PropertyListSerialization.propertyList(from:bytes(),format:nil)) as! [String:Any],valuesBefore=envelopeBefore["values"] as! [String:Any]
  try assertNoPublication {
   let receipt=runtime.discardPendingSelection(request,scope)
   precondition(receipt["accepted"] as? Bool==true && receipt["operation"] as? String=="discard-pending-selection" && receipt["targetId"] as? String==before.groups[0].id && receipt["pendingSelectionDiscarded"] as? Bool==true)
   let result=receipt["snapshot"] as! [String:Any],g=(result["groups"] as! [[String:Any]])[0]
   precondition(g["draftApplicationCount"] is NSNull && g["revision"] as? Int==before.groups[0].revision && g["enabled"] as? Bool==true && g["break"] is [String:Any])
   let serialized=String(data:try JSONSerialization.data(withJSONObject:receipt),encoding:.utf8)!
   precondition(!serialized.contains(committed.value) && !serialized.contains(pending.value),"Opaque selection values never enter a bridge receipt")
  }
  var expected=before;expected.groups[0].pendingSelection=nil;expected.revision += 1
  let after=try state();precondition(after==expected,"Only target pending selection and store draft revision can change; committed bank/revision/rule/enablement/claims/leases/thresholds remain exact")
  var valuesAfter=((try PropertyListSerialization.propertyList(from:bytes(),format:nil)) as! [String:Any])["values"] as! [String:Any]
  var otherBefore=valuesBefore;otherBefore.removeValue(forKey:FreedAppGroupsPolicy.key);valuesAfter.removeValue(forKey:FreedAppGroupsPolicy.key)
  precondition(NSDictionary(dictionary:otherBefore).isEqual(to:valuesAfter),"Adult/DNS/legacy intent and owner metadata remain exact")
  let idempotent=try bytes();try assertNoPublication{let request=try target();precondition(runtime.discardPendingSelection(request,scope)["accepted"] as? Bool==true)};try sameBytes(idempotent)
  try seedPending();let activeBytes=try bytes(),fenced=try target()
  for input in [fenced.merging(["expectedStoreRevision":0]){$1},fenced.merging(["expectedRevision":0]){$1},fenced.merging(["id":"missing"]){$1},fenced.merging(["version":true]){$1}] {
   try assertNoPublication{precondition(runtime.discardPendingSelection(input,scope)["accepted"] as? Bool==false)};try sameBytes(activeBytes)
  }
  try assertNoPublication{precondition(runtime.discardPendingSelection(fenced,"[\"other-owner\",99]")["accepted"] as? Bool==false)};try sameBytes(activeBytes)
  let cold=FreedAppGroupsRuntime();try assertNoPublication{let receipt=cold.discardPendingSelection(fenced,scope);precondition(receipt["accepted"] as? Bool==false && ((receipt["snapshot"] as! [String:Any])["groups"] as! [Any]).isEmpty)};try sameBytes(activeBytes)
  try FileManager.default.setAttributes([.posixPermissions:0o500],ofItemAtPath:directory.path)
  try assertNoPublication{let denied=runtime.discardPendingSelection(fenced,scope);precondition(denied["accepted"] as? Bool==false && denied["pendingSelectionDiscarded"] as? Bool==false);let diagnostics=denied["diagnostics"] as! [String:Any];precondition(diagnostics["stage"] as? String=="state-commit" && diagnostics["errorCode"] as? Int != nil)}
  try FileManager.default.setAttributes([.posixPermissions:0o700],ofItemAtPath:directory.path);try sameBytes(activeBytes)
  let corrupt=Data("unreadable protected state".utf8);try corrupt.write(to:file)
  try assertNoPublication{precondition(runtime.discardPendingSelection(fenced,scope)["accepted"] as? Bool==false)};try sameBytes(corrupt)
  try activeBytes.write(to:file)
  runtime.suspend();try assertNoPublication{precondition(runtime.discardPendingSelection(fenced,scope)["accepted"] as? Bool==false)};try sameBytes(activeBytes)
  precondition(runtime.setScope(scope)["accepted"] as? Bool==true)
  try RuntimeLock.withExclusiveAccess{d in d.set(true,forKey:FreedProtectionConfigurationLock.resetMarkerKey)}
  let resetBytes=try bytes();try assertNoPublication{precondition(runtime.discardPendingSelection(fenced,scope)["accepted"] as? Bool==false)};try sameBytes(resetBytes)
  print("Real Darwin filesystem + unchanged native runtime: draft-only success/idempotence, exact committed enabled policy and genuine break retention, stale store/group/owner, cold/suspended owner, read-only commit failure, reset and zero OS publications passed")
 }
}
