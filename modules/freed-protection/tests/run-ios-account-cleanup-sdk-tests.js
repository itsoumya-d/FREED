const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');const{spawnSync}=require('node:child_process');
const dir=process.argv.find(x=>x.startsWith('--evidence-dir='))?.slice(15),adult=process.argv.find(x=>x.startsWith('--adult-sdk='))?.slice(12);assert(dir&&adult);fs.mkdirSync(dir,{recursive:true});
const source=fs.readFileSync('modules/freed-protection/ios/FreedProtectionModule.swift','utf8');
function method(name,actor=true){const start=source.indexOf(actor?'  @MainActor private func '+name:'  private func '+name);assert(start>=0,name);let at=source.indexOf('{',start),n=1,end=at+1;while(n){if(source[end]==='{')n++;if(source[end]==='}')n--;end++;}return source.slice(start,end).replace('private func','func')}
const helpers=['prepareAccountProtectionCleanup','executeAccountProtectionCleanup','reconcileAccountProtectionCleanup','continueAccountCleanup','cancelEarnedChallengeCapture','captureEarnedChallengePhoto'].map(n=>method(n)).join('\n');
const pipeline=fs.readFileSync('modules/freed-protection/ios/FreedChallengePhotoPipeline.swift','utf8').replace('import ExpoModulesCore','').replace(/  func classify\(uri: String, expectedLabels: \[String\], operationId: String, promise: Promise\) \{[\s\S]*?\n  \}/,'');
fs.writeFileSync(path.join(dir,'Pipeline.swift'),pipeline);
const views=fs.readFileSync('modules/freed-protection/ios/FreedAppGroupViews.swift','utf8');fs.writeFileSync(path.join(dir,'Picker.swift'),'import SwiftUI\nimport FamilyControls\nimport UIKit\n'+views.slice(views.indexOf('@available(iOS 16.0,*)\n@MainActor\nenum FreedAppGroupPicker')));
const harness=`import Foundation
import UIKit
import ManagedSettings
import UserNotifications
@MainActor final class CleanupSDKHarness {
 var accountCleanupTasks:Set<String>=[];var earnedPhotoBindingID:String?;var earnedPhotoOperationId:String?;var earnedPhotoOwnerScope:String?;var earnedPhotoEvidenceSessionId:String?
 var pendingFamilyPickerBindingID:String?;var pendingFamilyPickerReset:(()->Void)?
 let store=ManagedSettingsStore();let challengeCamera=FreedChallengeNativeCamera();let photoPipeline=FreedChallengePhotoPipeline()
 ${helpers}
 ${method('clearSelectedShields',false)}
}
`;
fs.writeFileSync(path.join(dir,'CleanupSDK.swift'),harness);fs.copyFileSync(adult,path.join(dir,'AdultSDK.swift'));
const names=['FreedAccountProtectionCleanup','FreedAccountBindingSession','FreedRetainedAdultProtection','FreedProtectionConfigurationLock','FreedAppGroupsRuntime','FreedAppGroupsPolicy','FreedEarnedAppTimePolicy','FreedChallengeEvidencePolicy','FreedChallengeStepObserver','FreedEarnedAppTimeTrustedClock','FreedFriendLockCore','FreedFriendLockRecordStore','FreedFriendLockKeychain','FreedAdultProtectionLockCoordinator','FreedAdultProtectionOperationStore','FreedNativeAdultMutationAdapter','FreedAdultProtectionRuntime','FreedWebsiteProbePicker','FreedWebsiteRecoveryProbe','FreedWebsiteProbeCopy','FreedChallengeNativeCamera','FreedPhotoTargetMatching','FreedPhotoOperationGate'];
const sources=names.map(n=>'modules/freed-protection/ios/'+n+'.swift').concat(['CleanupSDK.swift','AdultSDK.swift','Picker.swift','Pipeline.swift'].map(n=>path.join(dir,n)));
const records=[];function run(cmd,args){const t=Date.now(),r=spawnSync(cmd,args,{encoding:'utf8',timeout:180000});records.push({cmd,args,status:r.status,signal:r.signal,error:r.error?String(r.error):null,elapsedMs:Date.now()-t,stdout:r.stdout,stderr:r.stderr});fs.writeFileSync(path.join(dir,'commands.json'),JSON.stringify(records,null,2));process.stdout.write(r.stdout+r.stderr);assert.equal(r.status,0);return r.stdout.trim()}
const sdk=run('xcrun',['--sdk','iphoneos','--show-sdk-path']);const hash=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
fs.writeFileSync(path.join(dir,'source-bindings.json'),JSON.stringify({sources:Object.fromEntries(sources.map(p=>[p,hash(p)])),moduleSHA256:hash('modules/freed-protection/ios/FreedProtectionModule.swift'),pickerSourceSHA256:hash('modules/freed-protection/ios/FreedAppGroupViews.swift'),pipelineSourceSHA256:hash('modules/freed-protection/ios/FreedChallengePhotoPipeline.swift'),limits:'Actual complete cleanup/capture methods and visual picker/native OS dependencies; Expo ModuleDefinition and SharedObject subclass branch excluded. Pipeline Promise overload excluded; actual classification implementation preserved.'},null,2));
for(const p of sources.filter(p=>p.startsWith('modules/')))fs.copyFileSync(p,path.join(dir,path.basename(p)));
run('xcrun',['swiftc','-typecheck','-swift-version','5','-sdk',sdk,'-target','arm64-apple-ios15.1',...sources]);
run('xcrun',['swiftc','-frontend','-parse','modules/freed-protection/ios/FreedProtectionModule.swift','modules/freed-protection/ios/FreedAccountBindingSession.swift']);
console.log('Task82 actual native cleanup/camera/pickers public SDK methods: PASS; Expo bridge registration excluded from typecheck');
