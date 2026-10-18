const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),assert=require('node:assert/strict');const {spawnSync}=require('node:child_process');
const scratch=fs.mkdtempSync(path.join(os.tmpdir(),'freed-groups-filesystem-tests-'));
try {
 const nativeSource=process.argv.includes('--pre-generic-refusal') ? '.superpowers/sdd/2026-10-08-verified-blocking-balanced-screens/task-native-reward-pre-generic-refusal.swift' : process.argv.includes('--pre-owner-fence') ? '.superpowers/sdd/2026-10-08-verified-blocking-balanced-screens/task-native-reward-pre-owner-fence.swift' : process.argv.includes('--before') ? '.superpowers/sdd/2026-10-08-verified-blocking-balanced-screens/task-native-reward-before/modules/freed-protection/ios/FreedAppGroupsRuntime.swift' : 'modules/freed-protection/ios/FreedAppGroupsRuntime.swift';
 const source=fs.readFileSync(nativeSource,'utf8').replace('#if canImport(FamilyControls) && canImport(DeviceActivity) && canImport(ManagedSettings)','#if true').replaceAll('import FamilyControls','').replaceAll('import DeviceActivity','').replaceAll('import ManagedSettings','').replaceAll('FreedProtectionConfigurationLock','RuntimeLock');
 const input=path.join(scratch,'Runtime.swift');fs.writeFileSync(input,source);
 let framework=fs.readFileSync('modules/freed-protection/tests/AppGroupsRuntimeBoundary.swift','utf8').split('final class RuntimeDefaults')[0];
 framework=framework.replace('var applications:Set<TestToken>?','var applications:Set<TestToken>? {didSet{TestRewardPublication.afterWrite?()}}');
 framework += '\nenum TestRewardPublication {static var afterWrite:(()->Void)?}\n';
 const adapter=`enum RuntimeLock {
 static var directory:URL!; static var domain:String!
 typealias AccessError=FreedProtectionConfigurationLock.AccessError
 static let resetMarkerKey=FreedProtectionConfigurationLock.resetMarkerKey
 static func diagnostics(_ error:Error?=nil,generation:Int?=nil)->[String:Any]{FreedProtectionConfigurationLock.diagnostics(error,generation:generation)}
 static func generation(_ d:UserDefaults)->Int{FreedProtectionConfigurationLock.generation(d)}
 static func persist(_ d:UserDefaults)->Bool{FreedProtectionConfigurationLock.persist(d)}
 static func permitsPublication(_ d:UserDefaults,capturedGeneration:Int?=nil)->Bool{FreedProtectionConfigurationLock.permitsPublication(d,capturedGeneration:capturedGeneration)}
 static func withExclusiveAccess<T>(afterSuccessfulPersistence:((T)->Void)?=nil,readOnly: Bool = false, _ body:(UserDefaults)throws->T)throws->T{try FreedProtectionConfigurationLock.withExclusiveAccess(containerOverride:directory,domain:domain,afterSuccessfulPersistence:afterSuccessfulPersistence,readOnly:readOnly,body)}
 static func bindingFailure(reason:String,stage:String,supported:Bool=true,operationId:String=UUID().uuidString,generation:Int?=nil,scopeEpoch:Int?=nil,errorCode:Int32?=nil)->[String:Any]{FreedProtectionConfigurationLock.bindingFailure(reason:reason,stage:stage,supported:supported,operationId:operationId,generation:generation,scopeEpoch:scopeEpoch,errorCode:errorCode)}
}`;
 const boundary=path.join(scratch,'FrameworkBoundary.swift');fs.writeFileSync(boundary,framework+adapter);
 const binary=path.join(scratch,'cases');
 for(const[cmd,args]of[['xcrun',['swiftc','-parse-as-library','-swift-version','5','modules/freed-protection/ios/FreedProtectionConfigurationLock.swift','modules/freed-protection/ios/FreedAppGroupsPolicy.swift','modules/freed-protection/ios/FreedEarnedAppTimePolicy.swift','modules/freed-protection/ios/FreedChallengeEvidencePolicy.swift','modules/freed-protection/ios/FreedChallengeStepObserver.swift','modules/freed-protection/ios/FreedEarnedAppTimeTrustedClock.swift',boundary,input,'modules/freed-protection/tests/AppGroupsResetRewardCases.swift','-o',binary]],[binary,[]]]){const r=spawnSync(cmd,args,{encoding:'utf8',timeout:180000});process.stdout.write(r.stdout+r.stderr);assert.equal(r.status,0,`${cmd} failed`);}
}finally{fs.rmSync(scratch,{recursive:true,force:true});}
