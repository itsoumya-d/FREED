const assert=require('node:assert/strict');
const {readFileSync,writeFileSync,mkdirSync,mkdtempSync,rmSync}=require('node:fs');
const {tmpdir}=require('node:os');const {resolve,join}=require('node:path');const {spawnSync}=require('node:child_process');
const root=resolve(__dirname,'../../..'),tmp=mkdtempSync(join(tmpdir(),'freed-task60fix1-'));
function run(cmd,args){const r=spawnSync(cmd,args,{cwd:root,encoding:'utf8',timeout:60000});process.stdout.write(r.stdout+r.stderr);assert.equal(r.status,0,`exit ${r.status}`);}
function block(s,needle){const start=s.indexOf(needle);assert.ok(start>=0,needle);let i=s.indexOf('{',start),n=1;for(i++;n&&i<s.length;i++){if(s[i]==='{')n++;if(s[i]==='}')n--;}return s.slice(start,i);}
try{
 const ios='modules/freed-protection/ios/';
 const cases=join(tmp,'codec');run('xcrun',['swiftc','-parse-as-library','-swift-version','5',ios+'FreedShieldRuntimeDiagnostics.swift','modules/freed-protection/tests/ShieldRuntimeDiagnosticCases.swift','-o',cases]);run(cases,[]);
 const suite='freed-task60fix1-'+Date.now(),file=join(tmp,'freed-enforcement-state.v1.plist');
 const runtime=readFileSync(join(root,ios+'FreedShieldRuntimeDiagnostics.swift'),'utf8').replace('private static let group = "group.app.freed.recovery"',`private static let group = "${suite}"`).replace('FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: group)?.appendingPathComponent("freed-enforcement-state.v1.plist")',`URL(fileURLWithPath:"${file}")`);
 writeFileSync(join(tmp,'Diagnostics.swift'),runtime);
 const lock=readFileSync(join(root,ios+'FreedProtectionConfigurationLock.swift'),'utf8').replace('static let appGroupIdentifier = "group.app.freed.recovery"',`static let appGroupIdentifier = "${suite}"`).replace('guard let url = FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: appGroupIdentifier) else { throw AccessError.containerUnavailable }','let url = Fixture.directory');
 writeFileSync(join(tmp,'Lock.swift'),lock);
 const native=readFileSync(join(root,ios+'FreedAppGroupsRuntime.swift'),'utf8');
 const ownerMethods=[' var ownerVerified: Bool',' private func read(',' private func scopeOwner(',' private func ownerCurrent('].map(n=>block(native,n));
 if(native.includes(' func diagnosticOwnerVerified('))ownerMethods.push(block(native,' func diagnosticOwnerVerified(').replace('{','{\n  Fixture.beforeOwnerFence()'));
 const owner=`import Foundation\nimport CoreFoundation\nimport CryptoKit\nfinal class FreedAppGroupsRuntime {static let shared=FreedAppGroupsRuntime();private var actionScope:String?;private var privateOwner=false;private var boundEpoch:Int?;private let saltKey="freed.appGroups.ownerSalt.v1";enum Failure:Error{case reason(String)};func configureFixture(scope:String,privateOwner:Bool,epoch:Int){self.actionScope=scope;self.privateOwner=privateOwner;self.boundEpoch=epoch}\n${ownerMethods.join('\n')}\n}`;
 writeFileSync(join(tmp,'Owner.swift'),owner);
 const module=readFileSync(join(root,ios+'FreedProtectionModule.swift'),'utf8');
 const closure=block(module,'    AsyncFunction("getShieldRuntimeDiagnostics")');
 let body=closure.slice(closure.indexOf('\n')+1,-1);
 body=body.replace('FreedProtectionConfigurationLock.withExclusiveAccess {','FreedProtectionConfigurationLock.withExclusiveAccess(containerOverride: Fixture.beforeLock()) {');
 writeFileSync(join(tmp,'Bridge.swift'),`import Foundation\nfunc runBridge() async -> [String:Any] {\n${body}\n}\n`);
 const contents=join(tmp,'Fixture.app','Contents'),macos=join(contents,'MacOS');mkdirSync(macos,{recursive:true});
 writeFileSync(join(contents,'Info.plist'),'<?xml version="1.0"?><plist version="1.0"><dict><key>CFBundleExecutable</key><string>Fixture</string><key>CFBundleIdentifier</key><string>local.freed.task60fix1.fixture</string><key>CFBundleVersion</key><string>16</string><key>FREEDWebsiteRecoveryProbeEnabled</key><true/><key>FREEDWebsiteRecoveryProbeChannel</key><string>internal-testflight</string><key>FREEDWebsiteRecoveryProbeInternalTestflight</key><true/></dict></plist>');
 const executable=join(macos,'Fixture');
 run('xcrun',['swiftc','-parse-as-library','-swift-version','5',...['FreedAppGroupsPolicy.swift','FreedEarnedAppTimePolicy.swift','FreedEarnedAppTimeTrustedClock.swift','FreedChallengeEvidencePolicy.swift'].map(f=>ios+f),join(tmp,'Diagnostics.swift'),join(tmp,'Lock.swift'),join(tmp,'Owner.swift'),join(tmp,'Bridge.swift'),'modules/freed-protection/tests/ShieldDiagnosticBridgeCases.swift','-o',executable]);
 run(executable,[tmp,suite]);
}finally{rmSync(tmp,{recursive:true,force:true});}
