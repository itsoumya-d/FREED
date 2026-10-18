import Foundation
import Darwin
@main struct StatusTransportCases {
 @MainActor static func main() async throws {
  let parent=FileManager.default.temporaryDirectory.appendingPathComponent("freed-status-\(UUID().uuidString)")
  try FileManager.default.createDirectory(at:parent,withIntermediateDirectories:true);defer{try? FileManager.default.removeItem(at:parent)}
  RuntimeLock.directory=parent;RuntimeLock.domain="freed.status.\(UUID().uuidString)"
  let runtime=FreedAppGroupsRuntime.shared,module=UUID(),host=StatusModuleHarness()
  FreedAccountBindingLifecycle.created(module:module)
  let stateURL=parent.appendingPathComponent(FreedProtectionConfigurationLock.stateFileName)
  let legacyDefaults=UserDefaults(suiteName:RuntimeLock.domain)!
  defer { legacyDefaults.removePersistentDomain(forName:RuntimeLock.domain) }
  precondition(!FileManager.default.fileExists(atPath:stateURL.path))
  let fresh=await host.deviceStatus()
  precondition(!FileManager.default.fileExists(atPath:stateURL.path),"Public status before admission must not create enforcement state on a fresh store")
  precondition(fresh["statusReadAccepted"] as? Bool==false && fresh["statusReadError"] as? String=="native-status-unavailable","Missing enforcement snapshot remains unavailable, not assumed protection")
  legacyDefaults.set(true,forKey:"freed.adultFilterActive")
  legacyDefaults.set("ios-screen-time",forKey:"freed.earnedUnlock.source")
  legacyDefaults.set(Data("legacy-authority".utf8),forKey:"freed.earnedUnlock.scope")
  let legacyBefore=legacyDefaults.persistentDomain(forName:RuntimeLock.domain)! as NSDictionary
  let unmigrated=await host.deviceStatus()
  precondition(!FileManager.default.fileExists(atPath:stateURL.path) && legacyBefore.isEqual(to:legacyDefaults.persistentDomain(forName:RuntimeLock.domain)!),"Public status must not migrate legacy authority or alter legacy values")
  precondition(unmigrated["statusReadAccepted"] as? Bool==false,"Unmigrated legacy intent is not an observed public snapshot")
  try RuntimeLock.withExclusiveAccess { defaults in
   precondition(defaults.bool(forKey:"freed.adultFilterActive") && defaults.data(forKey:"freed.earnedUnlock.scope")==Data("legacy-authority".utf8),"Explicit writer still migrates the exact legacy enforcement projection")
  }
  precondition(FileManager.default.fileExists(atPath:stateURL.path),"Default writer migration remains durable")
  let migratedBytes=try Data(contentsOf:stateURL)
  let migrated=await host.deviceStatus()
  let bytesAfterPublicRead=try Data(contentsOf:stateURL)
  precondition(migrated["statusReadAccepted"] as? Bool==true && migratedBytes==bytesAfterPublicRead,"Public status reads materialized snapshots without changing persisted bytes")
  var mutationRejected=false
  do {
   try FreedProtectionConfigurationLock.withReadOnlyAccess(containerOverride:parent,domain:RuntimeLock.domain) { defaults in
    defaults.set(false,forKey:"freed.adultFilterActive")
    precondition(!FreedProtectionConfigurationLock.persist(defaults),"Snapshot mode cannot persist a mutation")
   }
  } catch { mutationRejected=true }
  let bytesAfterRejectedMutation=try Data(contentsOf:stateURL)
  precondition(mutationRejected && migratedBytes==bytesAfterRejectedMutation,"Rejected snapshot mutation leaves persisted enforcement byte-identical")
  var nestedWriterEntered=false,nestedWriterRejected=false
  do {
   try FreedProtectionConfigurationLock.withReadOnlyAccess(containerOverride:parent,domain:RuntimeLock.domain) { _ in
    try RuntimeLock.withExclusiveAccess { _ in nestedWriterEntered=true }
   }
  } catch { nestedWriterRejected=true }
  precondition(nestedWriterRejected && !nestedWriterEntered,"Snapshot access cannot upgrade into the default writer")
  func bind() throws -> (FreedAccountBindingSession,[String:Any],[String:Any]) {
   let state=try FreedAccountBindingLifecycle.issue(module:module);try runtime.installBindingSession(state)
   let prepared=try runtime.prepareBinding(scope:"[\"A\",1]",session:state.id,transition:UUID().uuidString,sequence:1)
   return (FreedAccountBindingSession(state),prepared,try runtime.commitBinding(ticket:prepared["ticket"] as! String,session:state.id))
  }
  let (carrier,preparation,binding)=try bind(),scope=binding["actionScope"] as! String
  let legacy=await host.legacyStatus(),privateStatus=await host.accountStatus(carrier,scope),publicStatus=await host.deviceStatus()
  let abi:[String:Any]=["legacy":legacy,"private":privateStatus,"public":publicStatus,"preparation":preparation,"binding":binding]
  try JSONSerialization.data(withJSONObject:abi,options:[.prettyPrinted,.sortedKeys]).write(to:URL(fileURLWithPath:CommandLine.arguments[1]))
  precondition(legacy["accepted"] as? Bool==false && legacy["reason"] as? String=="binding-v2-transport-required","Actual successful v2 journal commit must keep legacy status denied")
  precondition(privateStatus["statusReadAccepted"] as? Bool==true && privateStatus["selectedApplications"] as? Int==4,"Current carrier+scope must read private status after real v2 commit")
  precondition(publicStatus["statusReadAccepted"] as? Bool==true && publicStatus["selectedApplications"]==nil && publicStatus["appInterventionAuthorized"]==nil,"Public read must expose actual OS facts without private fields")
  let committedV2Bytes=try Data(contentsOf:stateURL)
  try FileManager.default.removeItem(at:stateURL)
  let missingPrivate=await host.accountStatus(carrier,scope)
  precondition(missingPrivate["statusReadAccepted"] as? Bool==false && !FileManager.default.fileExists(atPath:stateURL.path),"Current v2 status must reject a removed snapshot without reseeding or migrating legacy authority")
  try committedV2Bytes.write(to:stateURL)
  let bytes=try RuntimeLock.withExclusiveAccess{$0.dictionaryRepresentation() as NSDictionary}
  let wrongScope=await host.accountStatus(carrier,"wrong");precondition(wrongScope["statusReadAccepted"] as? Bool==false,"Wrong scope denied")
  let unrelated=FreedAccountBindingSession(try FreedAccountBindingLifecycle.issue(module:module))
  let wrongCarrier=await host.accountStatus(unrelated,scope);precondition(wrongCarrier["statusReadAccepted"] as? Bool==false,"Wrong carrier denied")
  try RuntimeLock.withExclusiveAccess{precondition(bytes.isEqual(to:$0.dictionaryRepresentation()),"Rejected reads cannot rebind or mutate authority")}
  let (current,_,newBinding)=try bind(),newScope=newBinding["actionScope"] as! String
  host.duringSafari={current.state.retire()}
  let retired=await host.accountStatus(current,newScope);precondition(retired["statusReadAccepted"] as? Bool==false,"Retired carrier during async Safari lookup cannot publish private status")
  let (next,_,nextBinding)=try bind(),nextScope=nextBinding["actionScope"] as! String
  host.duringSafari={FreedAccountBindingLifecycle.created(module:UUID())}
  let replaced=await host.accountStatus(next,nextScope);precondition(replaced["statusReadAccepted"] as? Bool==false,"Replaced module during async read cannot publish")
  FreedAccountBindingLifecycle.created(module:module)
  let (last,_,lastBinding)=try bind(),lastScope=lastBinding["actionScope"] as! String
  try RuntimeLock.withExclusiveAccess { d in
   var state=FreedAppGroupsPolicy.decode(d.data(forKey:FreedAppGroupsPolicy.key))!
   state.claim=FreedAppGroupClaim(interventionId:"expired",groupId:"none",groupRevision:1,target:"opaque",generation:state.generation,scopeEpoch:state.scopeEpoch,claimedAt:0,claimedUptime:0,bootIdentity:"retired-boot")
   d.set(try JSONEncoder().encode(state),forKey:FreedAppGroupsPolicy.key)
  }
  let before=try RuntimeLock.withExclusiveAccess{$0.dictionaryRepresentation() as NSDictionary}
  precondition(runtime.effectiveStatus(readOnly:true)==nil,"Expired boot authority cannot appear in readonly status")
  _=await host.accountStatus(last,lastScope)
  try RuntimeLock.withExclusiveAccess{precondition(before.isEqual(to:$0.dictionaryRepresentation()),"Successful status read is read-only")}
  _=runtime.effectiveStatus()
  try RuntimeLock.withExclusiveAccess{precondition(FreedAppGroupsPolicy.decode($0.data(forKey:FreedAppGroupsPolicy.key))!.claim==nil,"Existing mutating reconciliation retains boot revocation")}
  RuntimeLock.failNext=true
  let unavailable=await host.accountStatus(last,lastScope);precondition(unavailable["statusReadAccepted"] as? Bool==false,"Unavailable lock fails closed")
  let descriptor=open(parent.appendingPathComponent("freed-protection-configuration.lock").path,O_RDWR)
  precondition(descriptor>=0 && flock(descriptor,LOCK_EX|LOCK_NB)==0)
  let locked=await host.accountStatus(last,lastScope)
  flock(descriptor,LOCK_UN);close(descriptor)
  precondition(locked["statusReadAccepted"] as? Bool==false,"Actually locked storage fails closed")
  let actualState=parent.appendingPathComponent(FreedProtectionConfigurationLock.stateFileName)
  let original=try Data(contentsOf:actualState);try Data("corrupt".utf8).write(to:actualState)
  let corrupt=await host.accountStatus(last,lastScope);precondition(corrupt["statusReadAccepted"] as? Bool==false,"Corrupt persisted state fails closed")
  try original.write(to:actualState)
  print("Actual v2 journal + status exports: fresh/unmigrated public no-write, explicit writer migration, legacy denial, current/private, narrow public, wrong scope/carrier, retirement/replacement during Safari, read-only, unavailable/locked/corrupt storage passed")
 }
}
