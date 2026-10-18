'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),esbuild=require('esbuild');
const code=esbuild.buildSync({entryPoints:['modules/freed-protection/src/index.ts'],bundle:true,external:['expo-modules-core','react-native'],platform:'node',format:'cjs',write:false,logLevel:'silent'}).outputFiles[0].text;
// Captured from the real v2 journal/status boundary; acceptance supplies the fresh runner output via FREED_TASK134_ABI.
const abi=JSON.parse(fs.readFileSync(process.env.FREED_TASK134_ABI || 'modules/freed-protection/tests/fixtures/status-v2-abi.json','utf8'));
function load(extra={},platform='ios') {
 const timers=[],events=[],module={exports:{}};let carrier;
 const native={FreedAccountBindingSession:class {constructor(){carrier=this;}release(){}},
  prepareAccountBindingV2:()=>abi.preparation,commitAccountBindingV2:()=>abi.binding,
  getStatus:()=>{events.push('legacy');return abi.legacy;},
  getStatusV2:(session,scope)=>{if(session!==carrier||scope!==abi.binding.actionScope)throw Error('wrong-carrier-or-scope');events.push('v2');return abi.private;},
  getDevicePublicStatus:()=>{events.push('device');return abi.public;},...extra};
 vm.runInNewContext(code,{module,exports:module.exports,require:n=>n==='react-native'?{Platform:{OS:platform}}:{requireNativeModule:()=>native},setTimeout:(callback,ms)=>{const t={callback,ms};timers.push(t);return t;},clearTimeout:()=>{}});
 return {api:module.exports,native,events,timers};
}
async function admit(f,current=()=>true){const driver=f.api.createNativeAccountSession(current);assert.ok(driver);const p=await driver.prepare('A','11111111-1111-4111-8111-111111111111',1);await driver.commit(p.ticket);return driver;}
function safe(result,reason){assert.equal(result.active,false);assert.equal(result.authorized,false);assert.equal(result.statusReadAccepted,false);assert.equal(result.statusReadError,reason);assert.equal(result.selectedApplications,undefined);assert.equal(result.activeUnlockExpiresAt,undefined);}
test('real v2 journal commit rejects legacy ABI but actual JS bridge reads through exact native carrier and scope',async()=>{
 assert.equal(abi.legacy.accepted,false);assert.equal(abi.legacy.reason,'binding-v2-transport-required');
 const f=load();await admit(f);const status=await f.api.getProtectionStatus();assert.equal(status.statusReadAccepted,true);assert.equal(status.statusVisibility,'account');assert.equal(status.selectedApplications,4);assert.deepEqual(f.events,['v2']);
});
test('no admitted account uses narrow public OS status and never legacy status',async()=>{const f=load();const status=await f.api.getProtectionStatus();assert.equal(status.statusReadAccepted,true);assert.equal(status.statusVisibility,'device');assert.equal(status.adultWebPolicyConfigured,true);assert.equal(status.selectedApplications,undefined);assert.equal(status.appInterventionAuthorized,undefined);assert.deepEqual(f.events,['device']);});
test('rejected dictionaries, malformed payloads and native rejections never become valid status',async()=>{for(const raw of [abi.legacy,{}, {statusReadAccepted:false,statusReadError:['native-status-unavailable']}, {...abi.private,authorized:'true'},{...abi.private,selectedApplications:'4'},{...abi.private,statusBinding:{...abi.private.statusBinding,scopeEpoch:999}}]){const f=load({getStatusV2:()=>raw});await admit(f);safe(await f.api.getProtectionStatus(),'native-status-malformed');assert.equal(f.events.includes('legacy'),false);}const f=load({getStatusV2:()=>Promise.reject(Error('private text'))});await admit(f);safe(await f.api.getProtectionStatus(),'native-status-read-failed');});
test('old binaries fail explicitly with no status or owner rebinding fallback',async()=>{const f=load({getStatusV2:undefined});await admit(f);safe(await f.api.getProtectionStatus(),'native-status-v2-unavailable');assert.deepEqual(f.events,[]);const p=load({getDevicePublicStatus:undefined});safe(await p.api.getProtectionStatus(),'native-device-status-unavailable');assert.deepEqual(p.events,[]);});
test('timeout and late stale owner result fail closed without later publication',async()=>{let finish;const f=load({getStatusV2:()=>new Promise(r=>finish=r)});await admit(f);const pending=f.api.getProtectionStatus();assert.equal(f.timers[0].ms,8000);f.timers[0].callback();safe(await pending,'native-status-timeout');finish(abi.private);await Promise.resolve();let current=true,resolve;const g=load({getStatusV2:()=>new Promise(r=>resolve=r)});const driver=await admit(g,()=>current);const late=g.api.getProtectionStatus();current=false;driver.retire();resolve(abi.private);safe(await late,'native-status-binding-stale');});
test('replacement admission invalidates pending private read even for same owner',async()=>{let finish;const f=load({getStatusV2:()=>new Promise(r=>finish=r)});await admit(f);const pending=f.api.getProtectionStatus();await admit(f);finish(abi.private);safe(await pending,'native-status-binding-stale');});
test('public payloads with private fields or malformed observation fields are rejected',async()=>{for(const raw of [{...abi.public,selectedApplications:4},{...abi.public,adultWebPolicyReason:{private:'never publish'}},{...abi.public,safariContentBlockerStateCheckedAt:[]}]){const f=load({getDevicePublicStatus:()=>raw});safe(await f.api.getProtectionStatus(),'native-status-malformed');}});
test('iOS rejects malformed consumer-facing collections before diagnostics can map or enumerate them',async()=>{
 const malformed=[{activeAppScheduleIds:{length:1}},{activeAppScheduleIds:['sleep',3]},
  {activeAppScheduleIds:new Array(1)},{usageStatsObservedPackageNames:'one'},
  {androidSettingsRoutes:[{}]},{usageStatsTodayMinutesByPackage:[]},
  {usageStatsTodayMinutesByPackage:{one:'3'}},{usageStatsTodayMinutesByPackage:{one:Infinity}},
  {usageStatsTodayMinutesByPackage:new Date()},{usageStatsTodayMinutesByPackage:new Map()}];
 for(const fields of malformed){const f=load({getStatusV2:()=>({...abi.private,...fields})});await admit(f);safe(await f.api.getProtectionStatus(),'native-status-malformed');}
 const f=load({getStatusV2:()=>({...abi.private,activeAppScheduleIds:['sleep','work'],usageStatsObservedPackageNames:[],androidSettingsRoutes:[],usageStatsTodayMinutesByPackage:{one:3.5}})});
 await admit(f);const status=await f.api.getProtectionStatus();assert.equal(status.statusReadAccepted,true);
 assert.equal(status.activeAppScheduleIds.map(id=>id.toUpperCase()).join(', '),'SLEEP, WORK');
 assert.equal(Object.entries(status.usageStatsTodayMinutesByPackage)[0][1],3.5);
});
test('Android retains legacy status schema and rejects rejected dictionaries',async()=>{const value={authorized:true,active:false,mode:'accessibility',message:'Observed',usageStatsAuthorized:true};const f=load({getStatus:()=>value},'android');assert.equal((await f.api.getProtectionStatus()).usageStatsAuthorized,true);const g=load({},'android');safe(await g.api.getProtectionStatus(),'native-status-malformed');const malformed=load({getStatus:()=>({...value,mode:['accessibility']})},'android');safe(await malformed.api.getProtectionStatus(),'native-status-malformed');});
