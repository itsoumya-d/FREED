const assert=require('node:assert/strict');
const {spawnSync}=require('node:child_process');
const {mkdtempSync,rmSync,readFileSync}=require('node:fs');
const {tmpdir}=require('node:os');
const {join,resolve}=require('node:path');
const root=resolve(__dirname,'../../..'), tmp=mkdtempSync(join(tmpdir(),'freed-website-probe-'));
function run(command,args){const r=spawnSync(command,args,{cwd:root,encoding:'utf8',timeout:60000});assert.equal(r.status,0,r.error?.message||r.stdout+r.stderr);if(r.stdout)process.stdout.write(r.stdout);}
try{
 run('xcrun',['swiftc','-parse-as-library','-swift-version','5','modules/freed-protection/ios/FreedWebsiteRecoveryProbe.swift','modules/freed-protection/tests/WebsiteRecoveryProbeCases.swift','-o',join(tmp,'cases')]);run(join(tmp,'cases'),[]);
 const ios='modules/freed-protection/ios/',sdk='/Applications/Xcode.app/Contents/Developer/Platforms/iPhoneOS.platform/Developer/SDKs/iPhoneOS.sdk';
 const args=['-typecheck','-swift-version','5','-target','arm64-apple-ios16.0','-sdk',sdk];
 const shared=['FreedProtectionConfigurationLock.swift','FreedWebsiteRecoveryProbe.swift','FreedWebsiteProbeCopy.swift'];
 run('xcrun',['swiftc',...args,...shared.map(f=>ios+f),'ios/FREEDShieldConfiguration/ShieldConfigurationExtension.swift']);
 run('xcrun',['swiftc',...args,...shared.map(f=>ios+f),...['FreedWebsiteProbePicker.swift','FreedAppGroupsPolicy.swift','FreedEarnedAppTimePolicy.swift','FreedEarnedAppTimeTrustedClock.swift','FreedChallengeEvidencePolicy.swift','FreedChallengeStepObserver.swift','FreedAppGroupsRuntime.swift'].map(f=>ios+f),'ios/FREEDShieldAction/ShieldActionExtension.swift']);
 run('xcrun',['swiftc','-frontend','-parse',ios+'FreedProtectionModule.swift']);
 const {nativePublicBuildConfig}=require('../../../scripts/lib/native-public-build-config');
 assert.equal(nativePublicBuildConfig({EXPO_PUBLIC_BUILD_CHANNEL:'development'},root).websiteRecoveryProbeEnabled,false);
 assert.equal(nativePublicBuildConfig({EXPO_PUBLIC_BUILD_CHANNEL:'development',FREED_IOS_WEBSITE_RECOVERY_PROBE:'true'},root).websiteRecoveryProbeEnabled,true);
 assert.throws(()=>nativePublicBuildConfig({EXPO_PUBLIC_BUILD_CHANNEL:'production',FREED_IOS_WEBSITE_RECOVERY_PROBE:'true',EAS_BUILD_PLATFORM:'web'},root),/internal-only/);
 // Existing generated app copy must remain byte-identical to the before packet.
 const packet='.superpowers/sdd/2026-10-11-android-recovery-friend-lock/task-53-ios-website-recovery-probe/before/';
 const file='ios/FREEDShieldConfiguration/ShieldConfigurationExtension.swift';
 const generated=s=>s.slice(s.indexOf('// BEGIN GENERATED SHIELD COPY'),s.indexOf('// END GENERATED SHIELD COPY'));
 assert.equal(generated(readFileSync(join(root,file),'utf8')),generated(readFileSync(join(root,packet+file),'utf8')));
 run('ruby',['-rxcodeproj','-e',`p=Xcodeproj::Project.open('ios/FREED.xcodeproj'); {'FREEDShieldConfiguration'=>['FreedWebsiteProbeCopy.swift'],'FREEDShieldAction'=>['FreedWebsiteRecoveryProbe.swift']}.each{|name,files|t=p.targets.find{|v|v.name==name}; files.each{|file|abort(file) unless t.source_build_phase.files_references.any?{|r|r.path.end_with?(file)}}}; puts 'PASS packaged extension source membership'`]);
 console.log('PASS public iOS SDK adapter/picker/action/configuration types, module parse, bundled production refusal, app-copy preservation; signed-device runtime remains unexecuted');
}finally{rmSync(tmp,{recursive:true,force:true});}
