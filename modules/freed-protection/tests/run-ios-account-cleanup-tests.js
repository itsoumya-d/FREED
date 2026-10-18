const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {spawnSync}=require('node:child_process');
const evidence=process.argv.find(v=>v.startsWith('--evidence-dir='))?.slice(15);assert(evidence,'Evidence directory required');fs.mkdirSync(evidence,{recursive:true});
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'freed-account-cleanup-'));const logs=[];
function hash(p){return crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex')}
function run(cmd,args){const t=Date.now(),r=spawnSync(cmd,args,{encoding:'utf8',timeout:180000});logs.push({cmd,args,elapsedMs:Date.now()-t,status:r.status,signal:r.signal,error:r.error?String(r.error):null,stdout:r.stdout,stderr:r.stderr});fs.writeFileSync(path.join(evidence,'commands.json'),JSON.stringify(logs,null,2));process.stdout.write(r.stdout+r.stderr);assert.equal(r.status,0);}
function method(source,name){const start=source.indexOf('  @MainActor private func '+name);assert(start>=0,name);let at=source.indexOf('{',start),depth=1,end=at+1;while(depth){if(source[end]==='{')depth++;if(source[end]==='}')depth--;end++;}return source.slice(start,end).replace('private func','func');}
try {
 const beforePrepared=process.argv.includes('--task82-prepared-before');
 const beforeFix2=process.argv.includes('--task82-fix2-before');
 const priorRoot=beforePrepared ? '.superpowers/sdd/2026-10-13-publishable-recovery/task-82/prepared-execution/preimages/' : '.superpowers/sdd/2026-10-13-publishable-recovery/task-82/fix2/preimages/';
 const modulePath=(beforePrepared||beforeFix2?priorRoot:'')+'modules/freed-protection/ios/FreedProtectionModule.swift';
 const cleanupPath=(beforePrepared||beforeFix2?priorRoot:'')+'modules/freed-protection/ios/FreedAccountProtectionCleanup.swift';
 const mod=fs.readFileSync(modulePath,'utf8');
 const statusStart=mod.indexOf('    AsyncFunction("getAccountProtectionCleanup")');assert(statusStart>=0);
 let statusAt=mod.indexOf('{',statusStart),statusDepth=1,statusEnd=statusAt+1;
 while(statusDepth){if(mod[statusEnd]==='{')statusDepth++;if(mod[statusEnd]==='}')statusDepth--;statusEnd++;}
 const statusBlock=mod.slice(statusAt+1,statusEnd-1);const statusBody=statusBlock.slice(statusBlock.indexOf(' in\n')+4).replaceAll('FreedProtectionConfigurationLock.withExclusiveAccess','RuntimeLock.withExclusiveAccess');
 const helpers=['prepareAccountProtectionCleanup','executeAccountProtectionCleanup','reconcileAccountProtectionCleanup','continueAccountCleanup'].map(name=>method(mod,name)).join('\n').replaceAll('FreedProtectionConfigurationLock.withExclusiveAccess','RuntimeLock.withExclusiveAccess').replaceAll('#if canImport(ManagedSettings)','#if true').replaceAll('FreedAppGroupsRuntime.shared','cleanupRuntime');
 const runtimePath=beforePrepared||beforeFix2 ? priorRoot+'modules/freed-protection/ios/FreedAppGroupsRuntime.swift' : process.argv.includes('--task82-fix1-before') ? '.superpowers/sdd/2026-10-13-publishable-recovery/task-82/fix1/preimages/modules/freed-protection/ios/FreedAppGroupsRuntime.swift' : 'modules/freed-protection/ios/FreedAppGroupsRuntime.swift';
 const runtime=fs.readFileSync(runtimePath,'utf8').replace('#if canImport(FamilyControls) && canImport(DeviceActivity) && canImport(ManagedSettings)','#if true').replaceAll('import FamilyControls','').replaceAll('import DeviceActivity','').replaceAll('import ManagedSettings','').replaceAll('FreedProtectionConfigurationLock','RuntimeLock');
 const framework=fs.readFileSync('modules/freed-protection/tests/AppGroupsRuntimeBoundary.swift','utf8').split('final class RuntimeDefaults')[0];
 const boundary=`${framework}
enum RuntimeLock {
 static var directory:URL!;static var domain:String!
 typealias AccessError=FreedProtectionConfigurationLock.AccessError
 static let generationKey=FreedProtectionConfigurationLock.generationKey,resetMarkerKey=FreedProtectionConfigurationLock.resetMarkerKey
 static func adultMutationEpoch(_ d:UserDefaults)throws->Int{try FreedProtectionConfigurationLock.adultMutationEpoch(d)}
 static func fenceAdultMutations(_ d:UserDefaults)throws->Int{try FreedProtectionConfigurationLock.fenceAdultMutations(d)}
 static func generation(_ d:UserDefaults)->Int{FreedProtectionConfigurationLock.generation(d)}
 static func persist(_ d:UserDefaults)->Bool{FreedProtectionConfigurationLock.persist(d)}
 static func permitsPublication(_ d:UserDefaults,capturedGeneration:Int?=nil)->Bool{FreedProtectionConfigurationLock.permitsPublication(d,capturedGeneration:capturedGeneration)}
 static func diagnostics(_ error:Error?=nil,generation:Int?=nil)->[String:Any]{FreedProtectionConfigurationLock.diagnostics(error,generation:generation)}
 static func bindingFailure(reason:String,stage:String,supported:Bool=true,operationId:String=UUID().uuidString,generation:Int?=nil,scopeEpoch:Int?=nil,errorCode:Int32?=nil)->[String:Any]{FreedProtectionConfigurationLock.bindingFailure(reason:reason,stage:stage,supported:supported,operationId:operationId,generation:generation,scopeEpoch:scopeEpoch,errorCode:errorCode)}
 static var failNext=false;static var beforeNextCommit:(()->Void)?;static var afterBackgroundTransaction:(()->Void)?;static var stopAfterNextArmingCommit=false;static var stopAfterNextFenceCommit=false;static var lastAccessFailure:[String:Any]?
 static func withExclusiveAccess<T>(afterSuccessfulPersistence:((T)->Void)?=nil,readOnly: Bool = false, _ body:(UserDefaults)throws->T)throws->T{
  if failNext{failNext=false;throw TestFailure.failed}
  let result:T
  do {result=try FreedProtectionConfigurationLock.withExclusiveAccess(containerOverride:directory,domain:domain,afterSuccessfulPersistence:afterSuccessfulPersistence,readOnly:readOnly){d in let result=try body(d);let callback=beforeNextCommit;beforeNextCommit=nil;callback?();return result}}
  catch {lastAccessFailure=FreedProtectionConfigurationLock.diagnostics(error);throw error}
  if stopAfterNextArmingCommit,let record=result as? FreedAccountProtectionCleanup.Record,record.receipt()["executionRequested"] as? Bool==true,record.resultingGeneration==nil {stopAfterNextArmingCommit=false;throw TestFailure.failed}
  if stopAfterNextFenceCommit,let record=result as? FreedAccountProtectionCleanup.Record,record.phase == .fenced,!record.privateStoreErased {stopAfterNextFenceCommit=false;throw TestFailure.failed}
  if !Thread.isMainThread {afterBackgroundTransaction?()}
  return result
 }
}
struct NoticeContent {let userInfo:[AnyHashable:Any]}
struct Notice {let identifier:String;let content:NoticeContent}
struct DeliveredNotice {let request:Notice}
final class UNUserNotificationCenter {
 static let instance=UNUserNotificationCenter();static func current()->UNUserNotificationCenter{instance}
 var pending:[Notice]=[];var delivered:[DeliveredNotice]=[];var hold=false;var reads=0;var removed:[String]=[]
 var callback:(([Notice])->Void)?
 func getPendingNotificationRequests(completionHandler:@escaping([Notice])->Void){reads += 1;if hold{callback=completionHandler}else{completionHandler(pending)}}
 func getDeliveredNotifications(completionHandler:@escaping([DeliveredNotice])->Void){completionHandler(delivered)}
 func removePendingNotificationRequests(withIdentifiers ids:[String]){removed += ids;pending.removeAll{ids.contains($0.identifier)}}
 func removeDeliveredNotifications(withIdentifiers ids:[String]){delivered.removeAll{ids.contains($0.request.identifier)}}
}
enum FixtureFriendStatus {case notEnrolled,enrolled,missingEnrolled,corrupt,unavailable}
actor FixtureCoordinator {enum Status {case acknowledged,pending};func invalidateForPrivateCleanup(operationID:String)->Status{.pending}}
@MainActor final class FreedAdultProtectionRuntime {
 static let value=FreedAdultProtectionRuntime();static func shared()throws->FreedAdultProtectionRuntime{value}
 var status:FixtureFriendStatus = .notEnrolled;var cleanupStatusReads=0;let coordinator=FixtureCoordinator()
 func friendLockStatusForCleanup()async throws->FixtureFriendStatus{cleanupStatusReads += 1;return status}
}
@MainActor enum FreedAppGroupPicker {static var bindingID:String?;static var cancelled:[String]=[];static func cancel(bindingID expected:String){if bindingID==expected{cancelled.append(expected);bindingID=nil}}}
@MainActor enum FreedWebsiteProbePicker {static var bindingID:String?;static var cancelled:[String]=[];static func cancel(bindingID expected:String){if bindingID==expected{cancelled.append(expected);bindingID=nil}}}
@MainActor final class CleanupModuleHarness {
 var cleanupRuntime=FreedAppGroupsRuntime.shared
 func statusCleanup(operationID:String)throws->[String:Any]{${statusBody}}
 var accountCleanupTasks:Set<String>=[];var earnedPhotoBindingID:String?;var pendingFamilyPickerBindingID:String?;var pendingFamilyPickerReset:(()->Void)?
 var cancelledPhotos=0;let store=ManagedSettingsStore()
 func cancelEarnedChallengeCapture(){cancelledPhotos += 1;earnedPhotoBindingID=nil}
 func clearSelectedShields(){store.shield.applications=nil;store.shield.applicationCategories=nil;store.shield.webDomains=nil;store.shield.webDomainCategories=nil}
 ${helpers}
}
`;
 const evidencePolicy=fs.readFileSync('modules/freed-protection/ios/FreedChallengeEvidencePolicy.swift','utf8').replace(/static var nativeDirectory:URL \{[^\n]+\}/,'static var nativeDirectory:URL {URL(fileURLWithPath:'+JSON.stringify(path.join(temp,'owned-photos'))+',isDirectory:true)}');
 const generated=[['Evidence.swift',evidencePolicy],['Runtime.swift',runtime],['ModuleBoundary.swift',boundary]].map(([n,s])=>{const p=path.join(temp,n);fs.writeFileSync(p,s);return p});
 let casesPath='modules/freed-protection/tests/AccountProtectionCleanupCases.swift';
 const originalCasesSHA256=hash(casesPath);
 if(beforePrepared||beforeFix2){let original=fs.readFileSync(casesPath,'utf8');casesPath=path.join(temp,'AccountProtectionCleanupCases.swift');if(beforeFix2)original=original.replace(/^.*FIX2_PROCESS_ACK.*\n/gm,'');if(beforePrepared)original=original.replace(/^.*PREPARED_EXECUTION_ACK.*\n/gm,'');fs.writeFileSync(casesPath,original);}
 const sources=['FreedProtectionConfigurationLock.swift','FreedRetainedAdultProtection.swift','FreedAccountProtectionCleanup.swift','FreedAccountBindingSession.swift','FreedAppGroupsPolicy.swift','FreedEarnedAppTimePolicy.swift','FreedChallengeStepObserver.swift','FreedEarnedAppTimeTrustedClock.swift'].map(n=>n==='FreedAccountProtectionCleanup.swift'?cleanupPath:'modules/freed-protection/ios/'+n).concat(generated,[casesPath]);
 for(const p of sources)fs.copyFileSync(p,path.join(evidence,path.basename(p)));
 fs.writeFileSync(path.join(evidence,'source-bindings.json'),JSON.stringify({sources:Object.fromEntries(sources.map(p=>[p,hash(p)])),module:hash(modulePath),moduleSourcePath:modulePath,originalCasesSHA256,beforePrepared,beforeFix2,runtime:hash(runtimePath),runtimeSourcePath:runtimePath,runnerSHA256:hash(__filename),boundary:'Actual complete Module cleanup methods and runtime; scripted public OS/provider callbacks and camera/picker cancellation delegates; actual atomic configuration filesystem. Runtime singleton reference is injected (default actual shared, fresh actual runtime for cold-source case); status body extracted verbatim from native export.'},null,2));
 const binary=path.join(evidence,'native-fixture');run('xcrun',['swiftc','-parse-as-library','-swift-version','5',...sources,'-o',binary]);run(path.resolve(binary),[]);console.log('fixtureBinarySHA256='+hash(binary));
}finally{fs.rmSync(temp,{recursive:true,force:true})}
