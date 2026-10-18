const crypto=require('node:crypto');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),assert=require('node:assert/strict');const {spawnSync}=require('node:child_process');
const scratch=fs.mkdtempSync(path.join(os.tmpdir(),'freed-groups-filesystem-tests-'));
try {
 const nativeSource=process.argv.includes('--before') ? '.superpowers/sdd/2026-10-08-challenge-earned-time-v2/activation-repair/before/FreedAppGroupsRuntime.swift' : 'modules/freed-protection/ios/FreedAppGroupsRuntime.swift';
 const source=fs.readFileSync(nativeSource,'utf8').replace('#if canImport(FamilyControls) && canImport(DeviceActivity) && canImport(ManagedSettings)','#if true').replaceAll('import FamilyControls','').replaceAll('import DeviceActivity','').replaceAll('import ManagedSettings','').replaceAll('FreedProtectionConfigurationLock','RuntimeLock');
 const input=path.join(scratch,'Runtime.swift');fs.writeFileSync(input,source);
 const framework=fs.readFileSync('modules/freed-protection/tests/AppGroupsRuntimeBoundary.swift','utf8').split('final class RuntimeDefaults')[0];
 const adapter=`enum RuntimeLock {
 static var directory:URL!; static var domain:String!; static var attempts=0; static var afterFailure:(()->Void)?
 typealias AccessError=FreedProtectionConfigurationLock.AccessError
 static let resetMarkerKey=FreedProtectionConfigurationLock.resetMarkerKey
 static func diagnostics(_ error:Error?=nil,generation:Int?=nil)->[String:Any]{FreedProtectionConfigurationLock.diagnostics(error,generation:generation)}
 static func generation(_ d:UserDefaults)->Int{FreedProtectionConfigurationLock.generation(d)}
 static func persist(_ d:UserDefaults)->Bool{FreedProtectionConfigurationLock.persist(d)}
 static func permitsPublication(_ d:UserDefaults,capturedGeneration:Int?=nil)->Bool{FreedProtectionConfigurationLock.permitsPublication(d,capturedGeneration:capturedGeneration)}
 static func withExclusiveAccess<T>(afterSuccessfulPersistence:((T)->Void)?=nil,readOnly: Bool = false, _ body:(UserDefaults)throws->T)throws->T{attempts += 1; do{return try FreedProtectionConfigurationLock.withExclusiveAccess(containerOverride:directory,domain:domain,afterSuccessfulPersistence:afterSuccessfulPersistence,readOnly:readOnly,body)}catch{afterFailure?();throw error}}
 static func bindingFailure(reason:String,stage:String,supported:Bool=true,operationId:String=UUID().uuidString,generation:Int?=nil,scopeEpoch:Int?=nil,errorCode:Int32?=nil)->[String:Any]{FreedProtectionConfigurationLock.bindingFailure(reason:reason,stage:stage,supported:supported,operationId:operationId,generation:generation,scopeEpoch:scopeEpoch,errorCode:errorCode)}
}`;
 const boundary=path.join(scratch,'FrameworkBoundary.swift');fs.writeFileSync(boundary,framework+adapter);
 const binary=path.join(scratch,'cases');
 const results=[];
 const selected=process.argv.find(v=>v.startsWith('--case='))?.split('=')[1];
 const scenarios=selected ? [selected]:['monitor','monitor-failure','monitor-capacity','binding-denial','threshold-commit','threshold-lock','expiry-commit','persistent-callback','callback-owner-fence'];
 for(const[cmd,args]of[['xcrun',['swiftc','-parse-as-library','-swift-version','5','modules/freed-protection/ios/FreedProtectionConfigurationLock.swift','modules/freed-protection/ios/FreedAppGroupsPolicy.swift','modules/freed-protection/ios/FreedEarnedAppTimePolicy.swift','modules/freed-protection/ios/FreedChallengeEvidencePolicy.swift','modules/freed-protection/ios/FreedChallengeStepObserver.swift','modules/freed-protection/ios/FreedEarnedAppTimeTrustedClock.swift',boundary,input,'modules/freed-protection/tests/AppGroupsReconciliationCases.swift','-o',binary]],...scenarios.map(scenario=>[binary,[scenario]])]){const r=spawnSync(cmd,args,{encoding:'utf8',timeout:60000});results.push({command:[cmd,...args],exitCode:r.status,signal:r.signal,stdout:r.stdout,stderr:r.stderr});process.stdout.write(r.stdout+r.stderr);assert.equal(r.status,0,`${cmd} failed`);}
 const receiptIndex=process.argv.indexOf('--receipt');
 if(receiptIndex>=0){const hash=file=>({path:file,sha256:crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')});fs.writeFileSync(process.argv[receiptIndex+1],JSON.stringify({physicalProof:false,environment:{platform:process.platform,osRelease:os.release(),architecture:process.arch},binary:{kind:'unsigned macOS framework-boundary executable',...hash(binary)},sources:[nativeSource,'modules/freed-protection/ios/FreedProtectionConfigurationLock.swift','modules/freed-protection/ios/FreedAppGroupsPolicy.swift','modules/freed-protection/ios/FreedEarnedAppTimePolicy.swift','modules/freed-protection/ios/FreedChallengeEvidencePolicy.swift','modules/freed-protection/ios/FreedChallengeStepObserver.swift','modules/freed-protection/ios/FreedEarnedAppTimeTrustedClock.swift','modules/freed-protection/tests/AppGroupsRuntimeBoundary.swift','modules/freed-protection/tests/AppGroupsReconciliationCases.swift',__filename,input,boundary].map(hash),results},null,2)+'\n');}
}finally{fs.rmSync(scratch,{recursive:true,force:true});}
