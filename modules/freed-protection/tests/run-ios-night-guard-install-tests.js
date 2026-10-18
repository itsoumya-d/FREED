const evidence=process.argv.find(x=>x.startsWith("--evidence-dir="))?.slice(15);
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),assert=require('node:assert/strict');const{spawnSync}=require('node:child_process');const dir=fs.mkdtempSync(path.join(os.tmpdir(),'freed-night-install-'));
const source=fs.readFileSync('modules/freed-protection/ios/FreedProtectionModule.swift','utf8');
function block(marker){let start=source.indexOf(marker);assert.ok(start>=0,marker);let open=source.indexOf('{',start),depth=1,end=open+1;for(;depth&&end<source.length;end++){if(source[end]==='{')depth++;if(source[end]==='}')depth--;}return source.slice(start,end);}

// Legacy controller cases intentionally use an explicitly empty protected-byte
// fixture. The extracted gate and Package A record reader are actual source;
// enrolled/corrupt/unavailable gate cases remain Task71/72 evidence.
const fixtureCoreSources = ['modules/freed-protection/ios/FreedFriendLockCore.swift', 'modules/freed-protection/ios/FreedFriendLockRecordStore.swift'];
const sdkAdultSources = [...fixtureCoreSources, 'modules/freed-protection/ios/FreedRetainedAdultProtection.swift', 'modules/freed-protection/ios/FreedAdultProtectionLockCoordinator.swift', 'modules/freed-protection/ios/FreedAdultProtectionOperationStore.swift', 'modules/freed-protection/ios/FreedNativeAdultMutationAdapter.swift', 'modules/freed-protection/ios/FreedFriendLockKeychain.swift'];
function legacyAdultFixture(directory, defaultsType = 'UserDefaults') {
  const host = fs.readFileSync('modules/freed-protection/ios/FreedAdultProtectionLockCoordinator.swift', 'utf8');
  let gate = host.slice(host.indexOf('enum FreedAdultLockIntegrationFailure'), host.indexOf('private enum FreedAdultExecutor'));
  gate = gate.replace('static var fixtureStore: FriendLockRecordStore?', 'static var fixtureStore: FriendLockRecordStore? = FriendLockRecordStore(bytes: LegacyUnenrolledBytes())');
  const seam = path.join(directory, 'LegacyAdultFixture.swift');
  fs.writeFileSync(seam, `import Foundation
final class LegacyUnenrolledBytes: FriendLockProtectedBytes {
  func read(_ key: String) throws -> Data? { nil }
  func write(_ key: String, _ data: Data) throws { throw FriendLockFailure.storageUnavailable }
  func remove(_ key: String) throws { throw FriendLockFailure.storageUnavailable }
}
enum FreedAdultProtectionNativeObservation {
  // Explicit native fixture observation: installed adult filter and current schedule.
  static func capture(_ defaults: ${defaultsType}) throws -> FreedRetainedAdultProtection.Policy {
    let schedule = DeviceActivityCenter().schedule(for: DeviceActivityName("freed.nightGuard"))
    return FreedRetainedAdultProtection.Policy(continuous: ManagedSettingsStore.adultProtected, encryptedDNS: false, safari: false, riskEnabled: schedule != nil,
      riskStartMinute: schedule.map { ($0.intervalStart.hour ?? 0) * 60 + ($0.intervalStart.minute ?? 0) },
      riskEndMinute: schedule.map { ($0.intervalEnd.hour ?? 0) * 60 + ($0.intervalEnd.minute ?? 0) })
  }
}
${gate}`);
  const retained = path.join(directory, 'RetainedAdultFixture.swift');
  fs.writeFileSync(retained, fs.readFileSync('modules/freed-protection/ios/FreedRetainedAdultProtection.swift', 'utf8').replaceAll('UserDefaults', defaultsType));
  return [...fixtureCoreSources, retained, seam];
}
try{
const closure=block('    AsyncFunction("startRiskWindowMonitoring")');let body=closure.slice(closure.indexOf(' in\n')+4,closure.lastIndexOf('}'));
let helpers=source.includes('  private func installAcknowledgedNightGuard(')?block('  private func installAcknowledgedNightGuard('):'';
helpers=helpers.replaceAll('private ','').replaceAll('UserDefaults','RuntimeDefaults');
const stub=`
final class NightHarness {
 var lastNightGuardDiagnostics:[String:Any]?
 let riskWindowActivityName="freed.nightGuard",riskWindowActiveKey="freed.riskWindowActive"
 func sharedDefaults()->RuntimeDefaults{FreedProtectionConfigurationLock.defaults}
 func withProtectionConfigurationAccess(_ body:()->[String:Any])->[String:Any]{body()}
 func isAuthorized()->Bool{true};func isAdultFilterActive()->Bool{true}
 func isRiskWindowMonitoringActive()->Bool{sharedDefaults().bool(forKey:riskWindowActiveKey)}
 func setRiskWindowMonitoringActive(_ enabled:Bool) throws {sharedDefaults().set(enabled,forKey:riskWindowActiveKey)}
 func timeLabel(_ h:Int,_ m:Int)->String{"clock"}
 func statusPayload(authorized:Bool,active:Bool,scheduled:Bool,message:String)->[String:Any]{["authorized":authorized,"active":active,"scheduled":scheduled,"message":message]}
 func start(_ startHour:Int,_ endHour:Int,_ startMinute:Int,_ endMinute:Int)->[String:Any]{${body}}
 ${helpers}
}
enum FreedProtectionResetPolicy{static let resetMarkerKey="reset"}
`;
const fixtureSources=legacyAdultFixture(dir,'RuntimeDefaults');
const production=path.join(dir,'Production.swift'),exe=path.join(dir,'cases');fs.writeFileSync(production,'import Foundation\n'+stub.replaceAll('#if canImport(DeviceActivity)','#if true'));
for(const[cmd,args]of[['xcrun',['swiftc','-parse-as-library','-swift-version','5','-D','FREED_NATIVE_FIXTURES',...fixtureSources,'modules/freed-protection/ios/FreedAppGroupsPolicy.swift','modules/freed-protection/tests/AppGroupsRuntimeBoundary.swift',production,'modules/freed-protection/tests/NightGuardInstallCases.swift','-o',exe]],[exe,[]]]){const r=spawnSync(cmd,args,{encoding:'utf8',timeout:60000});assert.equal(r.status,0,r.stdout+r.stderr);process.stdout.write(r.stdout);}

if(process.argv.includes('--sdk')) {
 const sdk=spawnSync('xcrun',['--sdk','iphoneos','--show-sdk-path'],{encoding:'utf8'});assert.equal(sdk.status,0);
 const sdkInput=path.join(dir,'SDK.swift');fs.writeFileSync(sdkInput,'import Foundation\nimport DeviceActivity\nfinal class NightSDK { var lastNightGuardDiagnostics:[String:Any]?; let riskWindowActivityName=\"freed.nightGuard\",riskWindowActiveKey=\"freed.riskWindowActive\"\n'+block('  private func installAcknowledgedNightGuard(')+'\n}');
 const result=spawnSync('xcrun',['swiftc','-typecheck','-swift-version','5','-sdk',sdk.stdout.trim(),'-target','arm64-apple-ios15.1','modules/freed-protection/ios/FreedAppGroupsPolicy.swift','modules/freed-protection/ios/FreedProtectionConfigurationLock.swift',...sdkAdultSources,sdkInput],{encoding:'utf8',timeout:60000});assert.equal(result.status,0,result.stdout+result.stderr);console.log('Actual iOS SDK Night Guard installer/intent/shared-fence typecheck passed');
}
}finally{if(evidence){fs.mkdirSync(evidence,{recursive:true});fs.cpSync(dir,path.join(evidence,"fixture-artifacts"),{recursive:true});}
  fs.rmSync(dir,{recursive:true,force:true})}
