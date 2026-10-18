const evidence=process.argv.find(x=>x.startsWith("--evidence-dir="))?.slice(15);
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const workspace = fs.mkdtempSync(path.join(os.tmpdir(),'freed-dns-receipt-'));
function run(command,args) {
 const result=spawnSync(command,args,{encoding:'utf8',timeout:60000});
 assert.equal(result.status,0,`${command}: ${result.stdout}${result.stderr}`);
 process.stdout.write(result.stdout);
}

const sdkAdultSources = ['FreedFriendLockCore.swift', 'FreedFriendLockRecordStore.swift', 'FreedRetainedAdultProtection.swift', 'FreedAdultProtectionLockCoordinator.swift', 'FreedAdultProtectionOperationStore.swift', 'FreedNativeAdultMutationAdapter.swift', 'FreedFriendLockKeychain.swift'].map(name => `modules/freed-protection/ios/${name}`);
try {
 const source=fs.readFileSync('modules/freed-protection/ios/FreedProtectionModule.swift','utf8');
 const start=source.indexOf('  private func configurationResult(');
 const end=source.indexOf('  private func dnsConfigurationGenerationIsCurrent',start);
 assert.ok(start>0 && end>start);
 const policy=source.slice(source.indexOf('struct FreedEncryptedDnsPolicy'),source.indexOf('#if os(iOS) && canImport(NetworkExtension)'));
 const input=path.join(workspace,'Receipt.swift');
 fs.writeFileSync(input,'import Foundation\nenum FreedProtectionConfigurationLock { static let appGroupIdentifier = "app.freed.tests.receipt" }\nfinal class Receipt {\n'+source.slice(start,end).replace('private func configurationResult','func configurationResult')+'}\n'+fs.readFileSync('modules/freed-protection/tests/DnsReceiptCases.swift','utf8').replace('// PRODUCTION_POLICY',policy));
 const executable=path.join(workspace,'cases');
 run('xcrun',['swiftc','-swift-version','5',input,'-o',executable]);run(executable,[]);
 const sdk=spawnSync('xcrun',['--sdk','iphoneos','--show-sdk-path'],{encoding:'utf8'});assert.equal(sdk.status,0);
 const iosInput=path.join(workspace,'DnsIOS.swift');
 fs.writeFileSync(iosInput,'import Foundation\nimport NetworkExtension\nimport UIKit\n'+source.slice(source.indexOf('// MARK: - Optional encrypted DNS'),source.indexOf('// MARK: - Protection configuration reset policy')));
 run('xcrun',['swiftc','-typecheck','-swift-version','5','-sdk',sdk.stdout.trim(),'-target','arm64-apple-ios15.1',iosInput,...sdkAdultSources,'modules/freed-protection/ios/FreedProtectionConfigurationLock.swift']);
 process.stdout.write('Complete native encrypted-DNS controller type-checks against the actual iOS SDK\n');
} finally { if(evidence){fs.mkdirSync(evidence,{recursive:true});fs.cpSync(workspace,path.join(evidence,"fixture-artifacts"),{recursive:true});}
  fs.rmSync(workspace,{recursive:true,force:true}); }
