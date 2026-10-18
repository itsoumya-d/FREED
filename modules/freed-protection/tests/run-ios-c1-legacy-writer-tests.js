const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),assert=require('node:assert/strict'),{spawnSync}=require('node:child_process'),{createHash}=require('node:crypto');
const scratch=fs.mkdtempSync(path.join(os.tmpdir(),'freed-c1-writers-'));
const evidence=process.argv.find(x=>x.startsWith('--evidence-dir='))?.slice(15);
const sourcePath=process.argv.includes('--c1-fix1-before')?'.superpowers/sdd/2026-10-13-publishable-recovery/task-79c/fix1/preimages/modules/freed-protection/ios/FreedProtectionModule.swift':'modules/freed-protection/ios/FreedProtectionModule.swift';
const source=fs.readFileSync(sourcePath,'utf8');
const host=fs.readFileSync('modules/freed-protection/ios/FreedAdultProtectionLockCoordinator.swift','utf8');
const hash=p=>createHash('sha256').update(fs.readFileSync(p)).digest('hex');
function block(marker){let start=source.indexOf(marker);assert(start>=0,marker);let open=source.indexOf('{',start),end=open+1,depth=1;while(depth){if(source[end]==='{')depth++;if(source[end]==='}')depth--;end++;}return source.slice(start,end);}
const names=['performLegacySafariConfiguration','configureSafariContentBlockerRulesFile','validateSafariContentBlockerRules','isSafariFocusShieldRule','reloadSafariContentBlocker','refreshSafariContentBlockerStateIfAvailable'];
let methods=names.map(n=>block('  private func '+n+'(')).join('\n');
methods+='\n@MainActor '+block('  private func safariCallSettled<T>')+'\n@MainActor '+block('  private func safariCallWithTimeout<T>');
methods+='\n'+block('  private enum SafariReloadOutcome')+'\n'+block('  private enum SafariStateOutcome');
let outer=block('    AsyncFunction("configureSafariContentBlockerRules")');outer=outer.slice(outer.indexOf(' in\n')+4,-1);
methods+='\nfunc configure(_ rulesJson:String,version:String="fixture",checksum:String="fixture",generatedAt:String="fixture") async->[String:Any]{'+outer+'}\n';
methods=methods.replaceAll('FreedProtectionConfigurationLock.withExclusiveAccess','self.access');
const members=source.split('\n').filter(l=>/^  private let safariContentBlocker/.test(l)).join('\n');
const harness=`final class C1SafariWriterHarness {
 let directory:URL,domain:String
 init(directory:URL){self.directory=directory;self.domain="freed.c1.safari.\\(UUID().uuidString)"}
 func access<T>(_ body:(UserDefaults)throws->T)throws->T{try FreedProtectionConfigurationLock.withExclusiveAccess(containerOverride:directory,domain:domain,body)}
 func sharedDefaults()->UserDefaults{FreedProtectionConfigurationLock.sharedDefaults(containerOverride:directory,domain:domain)}
 func safariContentBlockerRulesURL()->URL?{directory.appendingPathComponent("rules.json")}
 func makeFreedError(_ message:String)->NSError{NSError(domain:"C1",code:1)}
 func formatIsoDate(_ date:Date)->String{"fixture"}
 func isAuthorized()->Bool{true};func isAdultFilterActive()->Bool{true};func isRiskWindowMonitoringActive()->Bool{false}
 func statusPayload(authorized:Bool,active:Bool,scheduled:Bool,message:String)->[String:Any]{["message":message]}
 func refreshStandalone() async {await refreshSafariContentBlockerStateIfAvailable()}
 private static let safariCallbackTimeoutSeconds:Double=8
 ${members}
 ${methods}
}
`;
const gate=host.slice(host.indexOf('enum FreedAdultLockIntegrationFailure'),host.indexOf('private enum FreedAdultExecutor'));
const nativeObservation=host.slice(0,host.indexOf('enum FreedAdultLockIntegrationFailure'));
const reset=source.slice(source.indexOf('struct FreedProtectionResetPolicy'),source.indexOf('// MARK: - Existing protection layers'));
const fixtureAPI=`
final class SFContentBlockerState { let isEnabled=true }
enum SFContentBlockerManager {
 static var holdState=false;static var stateCalls=0;static var pendingState:((SFContentBlockerState?,Error?)->Void)?
 static var hold=true;static var calls=0;static var pending:((Error?)->Void)?
 static func reloadContentBlocker(withIdentifier:String,completionHandler:@escaping(Error?)->Void){calls += 1;if hold{pending=completionHandler}else{completionHandler(nil)}}
 static func getStateOfContentBlocker(withIdentifier:String,completionHandler:@escaping(SFContentBlockerState?,Error?)->Void){stateCalls += 1;if holdState{pendingState=completionHandler}else{completionHandler(SFContentBlockerState(),nil)}}
 static func settleState(error:Error?=nil){let callback=pendingState;pendingState=nil;callback?(error==nil ? SFContentBlockerState():nil,error)}
 static func settle(){let callback=pending;pending=nil;callback?(nil);callback?(nil)}
}
final class C1EmptyProtectedBytes:FriendLockProtectedBytes {
 func read(_ key:String)throws->Data?{precondition(!FreedProtectionConfigurationLock.isInsideExclusiveAccess,"Safari gate must be read before configuration exclusion");return nil}
 func write(_ key:String,_ value:Data)throws{throw FriendLockFailure.storageUnavailable}
 func remove(_ key:String)throws{throw FriendLockFailure.storageUnavailable}
}
@main struct C1SafariCases {
 @MainActor static func main() async throws {
  let directory=FileManager.default.temporaryDirectory.appendingPathComponent("freed-c1-safari-\\(UUID().uuidString)")
  try FileManager.default.createDirectory(at:directory,withIntermediateDirectories:true)
  defer{try? FileManager.default.removeItem(at:directory)}
  FreedAdultProtectionLegacyGate.fixtureStore=FriendLockRecordStore(bytes:C1EmptyProtectedBytes())
  let h=C1SafariWriterHarness(directory:directory)
  let rules=#"[{"trigger":{"url-filter":"adult-fixture"},"action":{"type":"block"}}]"#
  try h.access { d in
   try FreedRetainedAdultProtection.stage(.init(continuous:true,encryptedDNS:true,safari:false,riskEnabled:false),d)
  }
  func seedNewerState(revokeEpoch:Bool=true,bumpGeneration:Bool=false) throws {
   try h.access { d in
    if revokeEpoch {try FreedProtectionConfigurationLock.fenceAdultMutations(d)}
    if bumpGeneration {d.set(FreedProtectionConfigurationLock.generation(d)+1,forKey:FreedProtectionConfigurationLock.generationKey)}
    d.set(false,forKey:FreedProtectionConfigurationLock.resetMarkerKey)
    d.set("new-owner-diagnostic",forKey:"freed.safariContentBlocker.lastReloadError")
    d.set(true,forKey:"freed.safariContentBlocker.stateKnown")
    d.set(false,forKey:"freed.safariContentBlocker.enabled")
    d.set("new-owner-time",forKey:"freed.safariContentBlocker.stateCheckedAt")
    d.set("new-owner-state-error",forKey:"freed.safariContentBlocker.stateError")
   }
  }
  func assertNewerState(_ route:String) {
   let d=h.sharedDefaults()
   precondition(d.bool(forKey:"freed.safariContentBlocker.stateKnown"),"Stale Safari "+route+" must preserve newer stateKnown")
   precondition(!d.bool(forKey:"freed.safariContentBlocker.enabled"),"Stale Safari "+route+" must preserve newer enabled")
   precondition(d.string(forKey:"freed.safariContentBlocker.stateCheckedAt")=="new-owner-time","Stale Safari "+route+" must preserve newer stateCheckedAt")
   precondition(d.string(forKey:"freed.safariContentBlocker.stateError")=="new-owner-state-error","Stale Safari "+route+" must preserve newer stateError")
  }
  let stateOnly=CommandLine.arguments.contains("--fix1-state-only") || CommandLine.arguments.contains("--fix1-config-state-only")
  if !stateOnly {
  let first=Task{await h.configure(rules)}
  for _ in 0..<1000{if SFContentBlockerManager.pending != nil{break};await Task.yield()}
  precondition(SFContentBlockerManager.pending != nil && SFContentBlockerManager.calls==1)
  let pending=await first.value
  precondition(pending["operationPending"] as? Bool==true,"Safari caller deadline must be pending")
  do{_ = try FreedAdultProtectionLegacyGate.withWriter{true};preconditionFailure("Safari timeout may not release outer writer ownership")}
  catch FreedAdultLockIntegrationFailure.operationInProgress{}
  try seedNewerState()
  let stateCallsBeforeReload=SFContentBlockerManager.stateCalls
  SFContentBlockerManager.settle()
  let barrier=FreedAdultProtectionLegacyGate.enqueueLegacy(key:"c1-safari-settlement-barrier"){_ in ["released":true]}
  let barrierResult=await barrier.value
  precondition(barrierResult["released"] as? Bool==true,"Real duplicate callback must settle the Safari writer exactly once")
  precondition(h.sharedDefaults().string(forKey:"freed.safariContentBlocker.lastReloadError")=="new-owner-diagnostic","Old reload callback cannot publish into a newer native epoch")
  assertNewerState("reload follow-on")
  precondition(SFContentBlockerManager.stateCalls==stateCallsBeforeReload,"Revoked reload must not launch a follow-on Safari state refresh")
  SFContentBlockerManager.hold=false
  let repaired=await h.configure(rules)
  precondition((repaired["message"] as? String)?.contains("synced") == true && SFContentBlockerManager.calls==2,"Explicit stronger repair must remain usable after real callback settlement")
  print("C1 actual Safari entry/publication/reload: caller timeout retains writer, duplicate callback settles once, independent native epoch fences old callback, stronger repair succeeds: PASS")
  }
  SFContentBlockerManager.hold=false
  for configurationOwned in [false,true] {
   if !configurationOwned && CommandLine.arguments.contains("--fix1-config-state-only") {continue}
   for outcome in ["success","error","timeout"] {
    SFContentBlockerManager.holdState=true
    let read=Task { () -> Void in
     if configurationOwned {_ = await h.configure(rules)}
     else {await h.refreshStandalone()}
    }
    for _ in 0..<1000 {if SFContentBlockerManager.pendingState != nil{break};try await Task.sleep(nanoseconds:1_000_000)}
    precondition(SFContentBlockerManager.pendingState != nil,"Actual Safari state API must be suspended")
    try seedNewerState()
    if outcome != "timeout" {SFContentBlockerManager.settleState(error:outcome=="error" ? NSError(domain:"C1State",code:9):nil)}
    await read.value
    let barrier=FreedAdultProtectionLegacyGate.enqueueLegacy(key:"c1-state-settlement-"+outcome){_ in ["settled":true]}
    _ = await barrier.value
    assertNewerState((configurationOwned ? "configuration ":"standalone ")+outcome)
    if outcome=="timeout" {
     SFContentBlockerManager.settleState()
     assertNewerState("late callback after timeout")
    }
    SFContentBlockerManager.holdState=false
    await h.refreshStandalone()
    let d=h.sharedDefaults()
    precondition(d.bool(forKey:"freed.safariContentBlocker.stateKnown") && d.bool(forKey:"freed.safariContentBlocker.enabled") && d.string(forKey:"freed.safariContentBlocker.stateCheckedAt")=="fixture" && d.object(forKey:"freed.safariContentBlocker.stateError")==nil,"Fresh standalone refresh must publish its actual successful observation")
   }
  }
  SFContentBlockerManager.holdState=true
  let generationRead=Task{await h.refreshStandalone()}
  for _ in 0..<1000 {if SFContentBlockerManager.pendingState != nil{break};try await Task.sleep(nanoseconds:1_000_000)}
  precondition(SFContentBlockerManager.pendingState != nil)
  let unchangedEpoch=try h.access{try FreedProtectionConfigurationLock.adultMutationEpoch($0)}
  try seedNewerState(revokeEpoch:false,bumpGeneration:true)
  let readEpoch=try h.access{try FreedProtectionConfigurationLock.adultMutationEpoch($0)}
  precondition(unchangedEpoch==readEpoch,"Generation-only fixture must not rely on the epoch check")
  SFContentBlockerManager.settleState()
  await generationRead.value
  assertNewerState("generation-only revocation")
  SFContentBlockerManager.holdState=false
  let finalRepair=await h.configure(rules)
  precondition((finalRepair["message"] as? String)?.contains("synced")==true && h.sharedDefaults().bool(forKey:"freed.safariContentBlocker.stateKnown"),"Fresh repair must remain usable after revoked state observations")
  print("C1 Fix1 actual Safari standalone/configuration-owned held state success/error/timeout and held reload preserve all four newer fields; fresh refresh and repair publish: PASS")
 }
}
`;
const sources=['modules/freed-protection/ios/FreedFriendLockCore.swift','modules/freed-protection/ios/FreedFriendLockRecordStore.swift','modules/freed-protection/ios/FreedProtectionConfigurationLock.swift','modules/freed-protection/ios/FreedRetainedAdultProtection.swift'];
function run(args){const r=spawnSync('xcrun',args,{encoding:'utf8',timeout:60000});process.stdout.write(r.stdout+r.stderr);assert.equal(r.status,0);}
try {
 const native=path.join(scratch,'C1Native.swift');fs.writeFileSync(native,nativeObservation+'\n'+gate+'\n'+reset+'\n'+harness.replaceAll('#if canImport(SafariServices)','#if true')+'\n'+fixtureAPI);
 const binary=path.join(scratch,'cases');
 if(evidence){fs.mkdirSync(evidence,{recursive:true});fs.copyFileSync(native,path.join(evidence,'C1Native.swift'));fs.writeFileSync(path.join(evidence,'source-bindings.json'),JSON.stringify(Object.fromEntries([...sources,sourcePath,'modules/freed-protection/ios/FreedAdultProtectionLockCoordinator.swift',__filename].map(p=>[p,hash(p)])),null,2)+'\n');}
 run(['swiftc','-parse-as-library','-D','FREED_NATIVE_FIXTURES','-swift-version','5',...sources,native,'-o',binary]);
 console.log('fixtureBinarySHA256='+hash(binary));if(evidence)fs.copyFileSync(binary,path.join(evidence,'native-fixture'));
 const executed=spawnSync(binary,process.argv.filter(x=>['--fix1-state-only','--fix1-config-state-only'].includes(x)),{encoding:'utf8',timeout:60000});process.stdout.write(executed.stdout+executed.stderr);assert.equal(executed.status,0);
 const sdk=spawnSync('xcrun',['--sdk','iphoneos','--show-sdk-path'],{encoding:'utf8'});assert.equal(sdk.status,0);
 const mixedMethods=['reloadSafariContentBlockerForReset','safariContentBlockerEnabledForReset','safariFocusShieldEnabledForReset'].map(n=>block('  private func '+n+'(')).join('\n')+'\n@MainActor '+block('  private func resetProtectionConfiguration(')+'\n@MainActor '+block('  private func performLegacyProtectionReset(');
 const mixedScaffold=`
 var resettingProtectionConfiguration=false
 @MainActor var pendingFamilyPickerReset:(()->Void)?
 let appGroupIdentifier="group.app.freed.recovery",safariFocusShieldIdentifier="app.freed.recovery.safari-focus-shield"
 func removePendingShieldInterventionNotifications(before:Int){}
 // SDK-only dependent host seams: lower reset behavior is independently exercised
 // by the actual reset-policy/Task72 suites; this scaffold checks async routing.
 func performSynchronousProtectionReset()->[String:Any]{[:]}
 `;
 const sdkHarness=harness.slice(0,harness.lastIndexOf('}'))+mixedScaffold+mixedMethods+'\n}\n';
 const dns=source.slice(source.indexOf('// MARK: - Optional encrypted DNS'),source.indexOf('// MARK: - Protection configuration reset policy'));
 const sdkSource=path.join(scratch,'C1SDK.swift');fs.writeFileSync(sdkSource,'import Foundation\nimport SafariServices\nimport NetworkExtension\nimport UIKit\n'+reset+'\n'+dns+'\n'+sdkHarness+'\nenum FreedAppGroupPicker{static func cancelCurrent(){}}\nenum FreedWebsiteProbePicker{static func cancelCurrent(){}}\n');
 if(evidence)fs.copyFileSync(sdkSource,path.join(evidence,'C1SDK.swift'));
 run(['swiftc','-typecheck','-swift-version','5','-sdk',sdk.stdout.trim(),'-target','arm64-apple-ios15.1',...sources,'modules/freed-protection/ios/FreedFriendLockKeychain.swift','modules/freed-protection/ios/FreedAdultProtectionLockCoordinator.swift','modules/freed-protection/ios/FreedAdultProtectionOperationStore.swift','modules/freed-protection/ios/FreedNativeAdultMutationAdapter.swift',sdkSource]);
 console.log('C1 actual async Safari / mixed-reset routing / admitted DNS helpers public iOS SDK typecheck: PASS');
}finally{fs.rmSync(scratch,{recursive:true,force:true})}
