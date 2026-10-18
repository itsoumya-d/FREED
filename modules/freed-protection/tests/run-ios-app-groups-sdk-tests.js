const {spawnSync}=require('node:child_process');const assert=require('node:assert/strict');const fs=require('node:fs');const os=require('node:os');const path=require('node:path');
const sdk=spawnSync('xcrun',['--sdk','iphoneos','--show-sdk-path'],{encoding:'utf8'});assert.equal(sdk.status,0);
const common=['modules/freed-protection/ios/FreedAppGroupsPolicy.swift','modules/freed-protection/ios/FreedEarnedAppTimePolicy.swift','modules/freed-protection/ios/FreedChallengeEvidencePolicy.swift','modules/freed-protection/ios/FreedChallengeStepObserver.swift','modules/freed-protection/ios/FreedEarnedAppTimeTrustedClock.swift','modules/freed-protection/ios/FreedAppGroupsRuntime.swift','modules/freed-protection/ios/FreedProtectionConfigurationLock.swift'];
function run(files){const r=spawnSync('xcrun',['swiftc','-typecheck','-swift-version','5','-sdk',sdk.stdout.trim(),'-target','arm64-apple-ios16.0',...files],{encoding:'utf8',timeout:60000});assert.equal(r.status,0,r.stdout+r.stderr);}
const scratch=fs.mkdtempSync(path.join(os.tmpdir(),'freed-groups-sdk-'));
try {
 run(common); console.log('Actual iOS SDK group runtime typecheck passed');
 run([...common,'modules/freed-protection/ios/FreedAppGuardPolicy.swift','ios/FREEDDeviceActivityMonitor/DeviceActivityMonitorExtension.swift']);console.log('Actual DeviceActivityMonitor SDK callbacks typecheck passed');
 run([...common,'ios/FREEDShieldAction/ShieldActionExtension.swift']);console.log('Actual ShieldAction SDK group publication typecheck passed');
 const views=path.join(scratch,'Views.swift');fs.writeFileSync(views,fs.readFileSync('modules/freed-protection/ios/FreedAppGroupViews.swift','utf8').replace('import ExpoModulesCore','import UIKit\nclass AppContext {}\nclass EventDispatcher { func callAsFunction(_ payload: [String:Any]) {} }\nclass ExpoView:UIView { required init(appContext:AppContext?=nil){super.init(frame:.zero)};@available(*,unavailable) required init?(coder:NSCoder){fatalError()} }'));
 run([...common,views]);console.log('Actual SwiftUI token Label and individual picker SDK typecheck passed (Expo view superclass boundary stubbed)');
}finally{fs.rmSync(scratch,{recursive:true,force:true})}
