const assert=require('node:assert/strict');
const {spawnSync}=require('node:child_process');
const {readFileSync,writeFileSync,mkdtempSync,rmSync}=require('node:fs');
const {join}=require('node:path');
const packet='.superpowers/sdd/2026-10-11-android-recovery-friend-lock/task-53-ios-website-recovery-probe-review-fix1';
const tmp=mkdtempSync('/tmp/freed-website-review-fix-');
const moduleFile='modules/freed-protection/ios/FreedProtectionModule.swift',pickerFile='modules/freed-protection/ios/FreedWebsiteProbePicker.swift';
function ownerSource(source){const start=source.indexOf('    AsyncFunction("getWebsiteRecoveryProbe")'),end=source.indexOf('    AsyncFunction("presentWebsiteRecoveryProbePicker")',start);assert.ok(start>=0&&end>start);return source.slice(start,end);}
function finishSource(source){const start=source.indexOf('      let finish: ([String: Any]) -> Void = { receipt in'),end=source.indexOf('\n      cancel =',start);assert.ok(start>=0&&end>start);return source.slice(start,end);}
const prelude=`import Foundation
@MainActor final class FreedAppGroupsRuntime {
 static let shared=FreedAppGroupsRuntime(); var verified=false
 var ownerVerified:Bool {verified}; func suspend(){verified=false}
}
@MainActor enum FreedWebsiteRecoveryProbe {
 static let allowed=true; static var reads=0; static var mutations=0
 static var duringRead:(()->Void)?
 static func snapshot()->[String:Any]{precondition(FreedAppGroupsRuntime.shared.ownerVerified); reads += 1; duringRead?();return ["supported":true,"pendingCount":2]}
 static func mutate(operation:String,revision:Int,generation:Int,epoch:Int)->[String:Any]{precondition(FreedAppGroupsRuntime.shared.ownerVerified);mutations += 1;return ["accepted":true]}
}
@MainActor var getCallback:(@Sendable () async->[String:Any])?
@MainActor var mutateCallback:(@Sendable (String,Int,Int,Int) async->[String:Any])?
@MainActor func AsyncFunction(_ name:String,_ body:@escaping @Sendable () async->[String:Any]){getCallback=body}
@MainActor func AsyncFunction(_ name:String,_ body:@escaping @Sendable (String,Int,Int,Int) async->[String:Any]){mutateCallback=body}
final class FixtureContinuation {var count=0;func resume(returning:[String:Any]){count += 1}}
final class FixtureSelection {static var destroyed=0;deinit{Self.destroyed += 1}}
final class FixtureHost {var selection=FixtureSelection();var action:(()->Void)?;static var destroyed=0;func dismiss(animated:Bool){};deinit{Self.destroyed += 1}}
@main enum Cases {
 @MainActor static func register(){
`;
const ownerChecks=`
 }
 @MainActor static func main() async {
  register(); let runtime=FreedAppGroupsRuntime.shared
  runtime.verified=false
  let denied=await getCallback!();precondition(denied["pendingCount"]==nil && FreedWebsiteRecoveryProbe.reads==0,"suspended owner must not publish private counts")
  let noMutation=await mutateCallback!("remove",1,1,1);precondition(noMutation["accepted"] as? Bool == false && FreedWebsiteRecoveryProbe.mutations==0,"suspended owner must not remove preview")
  runtime.verified=true
  let allowed=await getCallback!();precondition(allowed["pendingCount"] as? Int==2)
  // A suspension queued during synchronous owner-check + snapshot cannot run
  // between that check and operation on MainActor. It precedes the next call.
  var suspendTask:Task<Void,Never>?
  FreedWebsiteRecoveryProbe.duringRead={suspendTask=Task{@MainActor in runtime.suspend()}}
  _=await getCallback!();await suspendTask?.value
  precondition(!runtime.ownerVerified)
  let stale=await mutateCallback!("remove",1,1,1)
  precondition(stale["accepted"] as? Bool == false && FreedWebsiteRecoveryProbe.mutations==0)
  runtime.verified=true;FreedWebsiteRecoveryProbe.duringRead=nil
  _=await mutateCallback!("remove",1,1,1);precondition(FreedWebsiteRecoveryProbe.mutations==1)
  print("PASS actual extracted owner bridge closures: denied private counts/removal after suspend; synchronous MainActor operation serialization; verified-owner mutation")
  for mode in 0..<3 {for _ in 0..<100 {testFinish(mode:mode)}}
  precondition(FixtureHost.destroyed==300 && FixtureSelection.destroyed==300,"picker finish retained host/root-view cycle")
  print("PASS actual extracted picker finish: 300 Done/Cancel/owner-dismiss host/root-view/selection cycles released; duplicate finish resumes once")
 }
 @MainActor static func testFinish(mode:Int){
  var finished=false;var cancel:(()->Void)?;var ownerObserver:NSObjectProtocol?=nil
  var host:FixtureHost?=FixtureHost();weak var weakHost=host
  let continuation=FixtureContinuation()
`;
const postlude=`
  cancel={finish([:])};host?.action={finish([:])}
  if mode==0 {weakHost?.action?()} else if mode==1 {cancel?()} else {
   ownerObserver=NotificationCenter.default.addObserver(forName:Notification.Name("fixture-owner-dismiss"),object:nil,queue:nil){_ in cancel?()}
   NotificationCenter.default.post(name:Notification.Name("fixture-owner-dismiss"),object:nil)
  }
  precondition(weakHost==nil && ownerObserver==nil,"picker host and observer release")
  finish([:]);precondition(continuation.count==1);precondition(cancel==nil)
 }
}
`;
function runCase(label,mod,picker,expectedPass){const input=join(tmp,'Cases.swift'),bin=join(tmp,'cases');writeFileSync(input,prelude+ownerSource(mod)+ownerChecks+finishSource(picker)+postlude);const compiled=spawnSync('xcrun',['swiftc','-parse-as-library','-swift-version','5',input,'-o',bin],{encoding:'utf8',timeout:60000});if(compiled.status!==0){assert.ok(!expectedPass,compiled.stderr);console.log(`RED ${label}: actual before owner-sensitive closures fail actor-isolation compilation`);return;}const ran=spawnSync(bin,[],{encoding:'utf8',timeout:60000});if(expectedPass){assert.equal(ran.status,0,ran.stderr);process.stdout.write(ran.stdout);}else{assert.notEqual(ran.status,0,`${label} did not fail`);console.log(`RED ${label}: ${ran.stderr.split('\n')[0]}`);}}
try{const mod=readFileSync(moduleFile,'utf8'),picker=readFileSync(pickerFile,'utf8');runCase('before owner boundary',readFileSync(`${packet}/before/${moduleFile}`,'utf8'),picker,false);runCase('before picker retention',mod,readFileSync(`${packet}/before/${pickerFile}`,'utf8'),false);runCase('final owner boundary and release',mod,picker,true);}finally{rmSync(tmp,{recursive:true,force:true});}
