const evidence=process.argv.find(x=>x.startsWith("--evidence-dir="))?.slice(15);
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '../../..');
const workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'freed-adult-policy-'));
function block(source, marker) {
  const start = source.indexOf(marker); if (start < 0) return null;
  const open = source.indexOf('{', start); let depth = 1, end = open + 1;
  for (; depth && end < source.length; end++) { if (source[end] === '{') depth++; if (source[end] === '}') depth--; }
  return source.slice(start, end);
}

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
  // Explicit known native fixture baseline: no filter or risk schedule installed.
  static func capture(_ defaults: ${defaultsType}) throws -> FreedRetainedAdultProtection.Policy {
    FreedRetainedAdultProtection.Policy(continuous: false, encryptedDNS: false, safari: false, riskEnabled: false)
  }
}
${gate}`);
  const retained = path.join(directory, 'RetainedAdultFixture.swift');
  fs.writeFileSync(retained, fs.readFileSync('modules/freed-protection/ios/FreedRetainedAdultProtection.swift', 'utf8').replaceAll('UserDefaults', defaultsType));
  return [...fixtureCoreSources, retained, seam];
}
try {
 const source = fs.readFileSync(path.join(root,'modules/freed-protection/ios/FreedProtectionModule.swift'),'utf8');
 const names = ['isAdultFilterActive','isAdultFilterRequested','isAdultWebPolicyConfigured','setAdultFilterActive','applyWebContentFilterForCurrentState','withProtectionConfigurationAccess','applyAdultContentPolicy'];
 let methods = names.map(name=>block(source,`private func ${name}(`)).filter(Boolean).join('\n');
 if (!methods.includes('private func applyAdultContentPolicy(')) {
   const callable=block(source,'AsyncFunction("applyAdultContentFilter")');
   methods += '\nprivate func applyAdultContentPolicy() -> [String: Any] {' + callable.slice(callable.indexOf(' in')+3,-1) + '}';
 }
 methods = methods.replaceAll('#if canImport(ManagedSettings)','#if true');
 const input=path.join(workspace,'main.swift');
 fs.writeFileSync(input,fs.readFileSync(path.join(root,'modules/freed-protection/tests/AdultPolicyHarnessMembers.swift'),'utf8').replace('// PRODUCTION_METHODS',methods));
 const fixtureSources = legacyAdultFixture(workspace);
 const executable=path.join(workspace,'cases');
 for (const [command,args] of [['xcrun',['swiftc','-swift-version','5','-D','FREED_NATIVE_FIXTURES',...fixtureSources,input,'-o',executable]],[executable,[]]]) {
   const result=spawnSync(command,args,{cwd:root,encoding:'utf8',timeout:60000});
   assert.equal(result.status,0,`${command}: ${result.stdout}${result.stderr}`); process.stdout.write(result.stdout);
 }
 // Type-check those production methods against the real iOS ManagedSettings
 // and UIKit interfaces without compiling or installing the application.
 const sdkResult=spawnSync('xcrun',['--sdk','iphoneos','--show-sdk-path'],{encoding:'utf8'});
 assert.equal(sdkResult.status,0);
 let iosInput=fs.readFileSync(input,'utf8');
 for (const marker of ['struct WebDomain:', 'enum FreedProtectionConfigurationLock {', 'final class WebContentSettings {', 'final class ManagedSettingsStore {']) {
   const removed=block(iosInput,marker); if (removed) iosInput=iosInput.replace(removed,'');
 }
 iosInput=iosInput.slice(0,iosInput.indexOf('  func check()'))+'}';
 iosInput='import ManagedSettings\nimport UIKit\n'+iosInput;
 const iosPath=path.join(workspace,'AdultPolicyIOS.swift');fs.writeFileSync(iosPath,iosInput);
 const checked=spawnSync('xcrun',['swiftc','-typecheck','-swift-version','5','-sdk',sdkResult.stdout.trim(),'-target','arm64-apple-ios15.1',iosPath,...sdkAdultSources,'modules/freed-protection/ios/FreedProtectionConfigurationLock.swift'],{cwd:root,encoding:'utf8',timeout:60000});
 assert.equal(checked.status,0,checked.stdout+checked.stderr);
 process.stdout.write('Adult policy production methods type-check with the actual iOS ManagedSettings SDK\n');
} finally { if(evidence){fs.mkdirSync(evidence,{recursive:true});fs.cpSync(workspace,path.join(evidence,"fixture-artifacts"),{recursive:true});}
  fs.rmSync(workspace,{recursive:true,force:true}); }
