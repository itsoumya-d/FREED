const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),assert=require('node:assert/strict'),{spawnSync}=require('node:child_process');
const redObservers=process.argv.includes('--c1-red-observer');
const c1Fix1Before=process.argv.includes('--c1-fix1-before');
const before=process.argv.includes('--before');
const task79Before=process.argv.includes('--task79-before');
const fix1Before=process.argv.includes('--fix1-before');
const caseArgs=process.argv.filter(arg=>['--fix1-reset-only','--fix1-repair-only','--fix1-cancel-only','--c1-only','--c1-fix1-only'].includes(arg));
const evidence=process.argv.find(arg=>arg.startsWith('--evidence-dir='))?.slice('--evidence-dir='.length);
const hash=file=>require('node:crypto').createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const sourcePath=c1Fix1Before?'.superpowers/sdd/2026-10-13-publishable-recovery/task-79c/fix1/preimages/modules/freed-protection/ios/FreedProtectionModule.swift':fix1Before?'.superpowers/sdd/2026-10-13-publishable-recovery/task-79/fix1/preimages/modules/freed-protection/ios/FreedProtectionModule.swift':task79Before?'.superpowers/sdd/2026-10-13-publishable-recovery/task-79/preimages/modules/freed-protection/ios/FreedProtectionModule.swift':before?'.superpowers/sdd/2026-10-08-verified-blocking-balanced-screens/task-dns-readback-before/modules/freed-protection/ios/FreedProtectionModule.swift':'modules/freed-protection/ios/FreedProtectionModule.swift';
const source=fs.readFileSync(sourcePath,'utf8');
const scratch=fs.mkdtempSync(path.join(os.tmpdir(),'freed-dns-readback-'));

// Legacy controller cases intentionally use an explicitly empty protected-byte
// fixture. The extracted gate and Package A record reader are actual source;
// enrolled/corrupt/unavailable gate cases remain Task71/72 evidence.
const fixtureCoreSources = ['modules/freed-protection/ios/FreedFriendLockCore.swift', 'modules/freed-protection/ios/FreedFriendLockRecordStore.swift'];
const sdkAdultSources = [...fixtureCoreSources, 'modules/freed-protection/ios/FreedRetainedAdultProtection.swift', 'modules/freed-protection/ios/FreedAdultProtectionLockCoordinator.swift', 'modules/freed-protection/ios/FreedAdultProtectionOperationStore.swift', 'modules/freed-protection/ios/FreedNativeAdultMutationAdapter.swift', 'modules/freed-protection/ios/FreedFriendLockKeychain.swift'];
function legacyAdultFixture(directory, defaultsType = 'UserDefaults') {
  const host = fs.readFileSync('modules/freed-protection/ios/FreedAdultProtectionLockCoordinator.swift', 'utf8');
  const seam = path.join(directory, 'LegacyAdultFixture.swift');
  fs.writeFileSync(seam, `import Foundation
final class LegacyUnenrolledBytes: FriendLockProtectedBytes {
  func read(_ key: String) throws -> Data? { precondition(!FreedProtectionConfigurationLock.isInsideExclusiveAccess, "Protected friend gate read must occur outside configuration exclusion"); return nil }
  func write(_ key: String, _ data: Data) throws { throw FriendLockFailure.storageUnavailable }
  func remove(_ key: String) throws { throw FriendLockFailure.storageUnavailable }
}
`);
  const actualHost=path.join(directory,'ActualAdultCoordinator.swift');
  fs.writeFileSync(actualHost,host.replace('static var fixtureStore: FriendLockRecordStore?', 'static var fixtureStore: FriendLockRecordStore? = FriendLockRecordStore(bytes: LegacyUnenrolledBytes())').replace('static var fixtureCapture: ((UserDefaults) throws -> FreedRetainedAdultProtection.Policy)?', 'static var fixtureCapture: ((UserDefaults) throws -> FreedRetainedAdultProtection.Policy)? = { _ in FreedRetainedAdultProtection.Policy(continuous: false, encryptedDNS: false, safari: false, riskEnabled: false) }'));
  const actualAdapter=path.join(directory,'ActualAdultAdapter.swift');
  fs.writeFileSync(actualAdapter,fs.readFileSync('modules/freed-protection/ios/FreedNativeAdultMutationAdapter.swift','utf8').replace('return try FreedProtectionConfigurationLock.withExclusiveAccess(containerOverride: fixtureContainer, domain: fixtureDomain, body)','return try FreedProtectionConfigurationLock.withExclusiveAccess(body)'));
  const retained = path.join(directory, 'RetainedAdultFixture.swift');
  fs.writeFileSync(retained, fs.readFileSync('modules/freed-protection/ios/FreedRetainedAdultProtection.swift', 'utf8').replaceAll('UserDefaults', defaultsType));
  return [...fixtureCoreSources, retained, seam, actualHost, actualAdapter, 'modules/freed-protection/ios/FreedAdultProtectionOperationStore.swift'];
}
try{
 let controller=source.slice(source.indexOf('// MARK: - Optional encrypted DNS'),source.indexOf('// MARK: - Protection configuration reset policy'));
 controller=controller.replace('#if os(iOS) && canImport(NetworkExtension)','#if true').replace('private final class FreedEncryptedDnsController','final class FreedEncryptedDnsController').replaceAll('Bundle.main.object(forInfoDictionaryKey:','DnsFixtureInfo.object(forInfoDictionaryKey:');
 if(redObservers){assert(controller.includes('maximumCallerObservers = 16'));controller=controller.replace('maximumCallerObservers = 16','maximumCallerObservers = 64');}
 const input=path.join(scratch,'Controller.swift');fs.writeFileSync(input,'import Foundation\n'+controller);
 const fixtureSources=legacyAdultFixture(scratch);
 const ownerSource=fs.readFileSync('modules/freed-protection/ios/FreedAppGroupsRuntime.swift','utf8');
 function ownerMethod(name){const start=ownerSource.indexOf(' private func '+name+'(');assert(start>=0);let end=ownerSource.indexOf('{',start)+1,depth=1;while(depth){if(ownerSource[end]==='{')depth++;if(ownerSource[end]==='}')depth--;end++;}return ownerSource.slice(start,end);}
 const ownerInput=path.join(scratch,'ActualOwnerBind.swift');
 fs.writeFileSync(ownerInput,`import Foundation
import CryptoKit
import CoreFoundation
final class DNSOwnerBindHarness {
 enum Failure:Error{case reason(String)}
 var state=FreedAppGroupsState(),boundHost:Int?,actionScope:String?
 let saltKey="freed.c1.owner.salt";let centre=DNSOwnerCentre()
 // The actual bind body is compiled below. OS reconciliation and boot pruning
 // are inert fixture dependencies; no leases are present in these owner cases.
 func revokeInvalidBootAuthority(_ state:inout FreedAppGroupsState,_ defaults:UserDefaults)throws{}
 func reconcile(_ state:FreedAppGroupsState,_ defaults:UserDefaults){}
 func persist(_ state:FreedAppGroupsState,_ defaults:UserDefaults)throws{defaults.set(try JSONEncoder().encode(state),forKey:FreedAppGroupsPolicy.key)}
 func breakName(_ id:String,_ revision:Int,_ generation:Int,_ epoch:Int,_ event:String)->String{id}
 func bindOwner(_ owner:String,_ defaults:UserDefaults)throws{let nextHost=(boundHost ?? 0)+1;let scope="[\\""+owner+"\\","+String(nextHost)+"]";try bind(scope,&state,defaults);actionScope=scope;boundHost=nextHost}
 ${ownerMethod('scopeOwner')}
 ${ownerMethod('bind')}
}
final class DNSOwnerCentre{func stopMonitoring(_ names:[String]){}}
`);
 fixtureSources.push('modules/freed-protection/ios/FreedAppGroupsPolicy.swift',ownerInput);
 const binary=path.join(scratch,'cases');
 if(evidence){
  fs.mkdirSync(evidence,{recursive:true});
  const bindings=[sourcePath,'modules/freed-protection/ios/FreedAppGroupsRuntime.swift',...fixtureSources,'modules/freed-protection/tests/DnsControllerReadbackBoundary.swift',input,'modules/freed-protection/tests/DnsControllerReadbackCases.swift'];
  for(const file of bindings)fs.copyFileSync(file,path.join(evidence,path.basename(file)));
  const compiler=spawnSync('xcrun',['swiftc','--version'],{encoding:'utf8'});assert.equal(compiler.status,0);
  const record={mode:c1Fix1Before?'C1-fix1-red-preimage':redObservers?'C1-red-observer-bound':fix1Before?'Task79A-fix1-red-preimage':task79Before?'Task79A-red-preimage':'current',cases:caseArgs,compiler:compiler.stdout.trim(),sourceHashes:Object.fromEntries(bindings.map(file=>[file,hash(file)]))};
  fs.writeFileSync(path.join(evidence,'source-bindings.json'),JSON.stringify(record,null,2)+'\n');
  console.log(JSON.stringify(record,null,2));
 }
 for(const[cmd,args]of[['xcrun',['swiftc','-parse-as-library','-swift-version','5','-D','FREED_NATIVE_FIXTURES',...fixtureSources,'modules/freed-protection/tests/DnsControllerReadbackBoundary.swift',input,'modules/freed-protection/tests/DnsControllerReadbackCases.swift','-o',binary]],[binary,before?['--routing-regression-only']:caseArgs]]){const r=spawnSync(cmd,args,{encoding:'utf8',timeout:180000});process.stdout.write(r.stdout+r.stderr);if(redObservers&&cmd===binary){assert.notEqual(r.status,0);assert.match(r.stderr,/Duplicate unresolved caller observers must be bounded at sixteen/);console.log('C1 RED: compiled unbounded-observer mutation failed the intended sixteen-observer assertion');}else{assert.equal(r.status,0,r.error?.message??cmd);}if(evidence&&cmd==='xcrun'){fs.copyFileSync(binary,path.join(evidence,'native-fixture'));console.log('fixtureBinarySHA256='+hash(binary));}}
}finally{fs.rmSync(scratch,{recursive:true,force:true});}
