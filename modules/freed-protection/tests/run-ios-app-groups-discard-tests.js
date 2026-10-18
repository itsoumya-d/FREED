const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),assert=require('node:assert/strict');const {spawnSync}=require('node:child_process');
const runtimePath='modules/freed-protection/ios/FreedAppGroupsRuntime.swift';
assert.ok(fs.readFileSync(runtimePath,'utf8').includes('func discardPendingSelection('),'Native data-only discard method is required');
const scratch=fs.mkdtempSync(path.join(os.tmpdir(),'freed-groups-discard-'));
try {
 const source=fs.readFileSync(runtimePath,'utf8').replace('#if canImport(FamilyControls) && canImport(DeviceActivity) && canImport(ManagedSettings)','#if true').replaceAll('import FamilyControls','').replaceAll('import DeviceActivity','').replaceAll('import ManagedSettings','').replaceAll('FreedProtectionConfigurationLock','RuntimeLock');
 const input=path.join(scratch,'Runtime.swift');fs.writeFileSync(input,source);
 let framework=fs.readFileSync('modules/freed-protection/tests/AppGroupsRuntimeBoundary.swift','utf8').split('final class RuntimeDefaults')[0];
 const replace=(from,to)=>{assert.ok(framework.includes(from),from);framework=framework.replace(from,to);};
 replace('func startMonitoring(_ name:','func startMonitoring(_ name:');
 replace('throws{if Self.failNext','throws{TestOSPublication.count += 1;if Self.failNext');
 replace('func stopMonitoring(_ names:[DeviceActivityName]){','func stopMonitoring(_ names:[DeviceActivityName]){TestOSPublication.count += 1;');
 for(const property of ['applications','applicationCategories','webDomains','webDomainCategories'])replace(`var ${property}:Set<TestToken>?`,`var ${property}:Set<TestToken>? {didSet{TestOSPublication.count += 1}}`);
 replace('func clearAllSettings(){','func clearAllSettings(){TestOSPublication.count += 1;');
 const adapter=`\nenum TestOSPublication {static var count=0}\nenum RuntimeLock {
 static var directory:URL!;static var domain:String!
 typealias AccessError=FreedProtectionConfigurationLock.AccessError
 static let resetMarkerKey=FreedProtectionConfigurationLock.resetMarkerKey
 static func diagnostics(_ error:Error?=nil,generation:Int?=nil)->[String:Any]{FreedProtectionConfigurationLock.diagnostics(error,generation:generation)}
 static func generation(_ d:UserDefaults)->Int{FreedProtectionConfigurationLock.generation(d)}
 static func persist(_ d:UserDefaults)->Bool{FreedProtectionConfigurationLock.persist(d)}
 static func permitsPublication(_ d:UserDefaults,capturedGeneration:Int?=nil)->Bool{FreedProtectionConfigurationLock.permitsPublication(d,capturedGeneration:capturedGeneration)}
 static func withExclusiveAccess<T>(afterSuccessfulPersistence:((T)->Void)?=nil,readOnly: Bool = false, _ body:(UserDefaults)throws->T)throws->T{try FreedProtectionConfigurationLock.withExclusiveAccess(containerOverride:directory,domain:domain,afterSuccessfulPersistence:afterSuccessfulPersistence,readOnly:readOnly,body)}
 static func bindingFailure(reason:String,stage:String,supported:Bool=true,operationId:String=UUID().uuidString,generation:Int?=nil,scopeEpoch:Int?=nil,errorCode:Int32?=nil)->[String:Any]{FreedProtectionConfigurationLock.bindingFailure(reason:reason,stage:stage,supported:supported,operationId:operationId,generation:generation,scopeEpoch:scopeEpoch,errorCode:errorCode)}
 }`;
 const boundary=path.join(scratch,'Boundary.swift');fs.writeFileSync(boundary,framework+adapter);
 const binary=path.join(scratch,'cases');
 for(const [command,args] of [['xcrun',['swiftc','-parse-as-library','-swift-version','5','modules/freed-protection/ios/FreedProtectionConfigurationLock.swift','modules/freed-protection/ios/FreedAppGroupsPolicy.swift','modules/freed-protection/ios/FreedEarnedAppTimePolicy.swift','modules/freed-protection/ios/FreedChallengeEvidencePolicy.swift','modules/freed-protection/ios/FreedChallengeStepObserver.swift','modules/freed-protection/ios/FreedEarnedAppTimeTrustedClock.swift',boundary,input,'modules/freed-protection/tests/AppGroupsPendingSelectionDiscardCases.swift','-o',binary]],[binary,[]]]) {
  const result=spawnSync(command,args,{encoding:'utf8',timeout:180000});process.stdout.write(result.stdout+result.stderr);assert.equal(result.status,0,result.error?.message ?? `${command} failed`);
 }
}finally{fs.rmSync(scratch,{recursive:true,force:true})}
