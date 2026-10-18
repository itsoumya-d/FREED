const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),assert=require('node:assert/strict');const {spawnSync}=require('node:child_process');
const evidence=process.argv.find(arg=>arg.startsWith('--evidence-dir='))?.slice(15);
const commandResults=[];
const scratch=fs.mkdtempSync(path.join(os.tmpdir(),'freed-groups-filesystem-tests-'));
try {
 const nativeSource=process.argv.includes('--before') ? '.superpowers/sdd/2026-10-07-activation-repair/task-a-before/modules/freed-protection/ios/FreedAppGroupsRuntime.swift' : 'modules/freed-protection/ios/FreedAppGroupsRuntime.swift';
 const source=fs.readFileSync(nativeSource,'utf8').replace('#if canImport(FamilyControls) && canImport(DeviceActivity) && canImport(ManagedSettings)','#if true').replaceAll('import FamilyControls','').replaceAll('import DeviceActivity','').replaceAll('import ManagedSettings','').replaceAll('FreedProtectionConfigurationLock','RuntimeLock');
 const input=path.join(scratch,'Runtime.swift');fs.writeFileSync(input,source);
 const framework=fs.readFileSync('modules/freed-protection/tests/AppGroupsRuntimeBoundary.swift','utf8').split('final class RuntimeDefaults')[0];
 const adapter=`enum RuntimeLock {
 static func adultMutationEpoch(_ d:UserDefaults)throws->Int{try FreedProtectionConfigurationLock.adultMutationEpoch(d)}
 static func fenceAdultMutations(_ d:UserDefaults)throws->Int{try FreedProtectionConfigurationLock.fenceAdultMutations(d)}
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
 for(const[cmd,args]of[['xcrun',['swiftc','-parse-as-library','-swift-version','5','modules/freed-protection/ios/FreedProtectionConfigurationLock.swift','modules/freed-protection/ios/FreedAppGroupsPolicy.swift','modules/freed-protection/ios/FreedEarnedAppTimePolicy.swift','modules/freed-protection/ios/FreedChallengeEvidencePolicy.swift','modules/freed-protection/ios/FreedChallengeStepObserver.swift','modules/freed-protection/ios/FreedEarnedAppTimeTrustedClock.swift','modules/freed-protection/ios/FreedRetainedAdultProtection.swift','modules/freed-protection/ios/FreedAccountProtectionCleanup.swift','modules/freed-protection/ios/FreedAccountBindingSession.swift',boundary,input,'modules/freed-protection/tests/AppGroupsFilesystemCases.swift','-o',binary]],[binary,[]]]){const r=spawnSync(cmd,args,{encoding:'utf8',timeout:60000});process.stdout.write(r.stdout+r.stderr);
  commandResults.push({command:[cmd,...args],status:r.status,signal:r.signal,error:r.error?String(r.error):null,stdout:r.stdout,stderr:r.stderr});
  if(evidence){
   fs.mkdirSync(evidence,{recursive:true});fs.writeFileSync(path.join(evidence,'commands.json'),JSON.stringify(commandResults,null,2)+'\n');
   const crypto=require('node:crypto'),hash=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
   const sources=cmd==='xcrun'?args.filter(p=>p.endsWith('.swift')):[];
   if(sources.length){for(const p of sources)fs.copyFileSync(p,path.join(evidence,path.basename(p)));fs.writeFileSync(path.join(evidence,'source-bindings.json'),JSON.stringify({sources:Object.fromEntries(sources.map(p=>[p,hash(p)])),actualRuntimeSHA256:hash(nativeSource),runnerSHA256:hash(__filename),boundary:'Actual runtime / atomic filesystem; scripted Screen Time OS APIs'},null,2)+'\n');}
   if(fs.existsSync(binary)){fs.copyFileSync(binary,path.join(evidence,'native-fixture'));fs.writeFileSync(path.join(evidence,'binary-sha256.txt'),hash(binary)+'\n');}
  }
  assert.equal(r.status,0,`${cmd} failed`);}
}finally{fs.rmSync(scratch,{recursive:true,force:true});}
