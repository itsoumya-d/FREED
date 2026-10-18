import test from 'node:test';
import assert from 'node:assert/strict';
import {createDefaultRecoveryState, createDefaultDisciplineSettings, hydrateRecoveryState, updateDisciplineSettings} from '../src/lib/recovery-state';
import {buildNativeAppScheduleConfiguration, sanitizeAppScheduleConfiguration} from '../src/lib/app-schedules';
import {getAppGuardPackages, syncNativeAppGuard, describeAppGuard} from '../src/lib/app-guard';
import {getProtectionSetupReadiness} from '../src/lib/protection-readiness';
import {createLatestSerialJob} from '../src/lib/latest-serial-job';
const stamp='2026-10-05T08:00:00.000Z';
const android={platform:'android',appGuardModes:true,appSchedules:true,accessibility:true,usageStats:true} as any;
const ios={platform:'ios',appGuardModes:true,appSchedules:true,screenTime:true,managedSettings:true} as any;
const base={authorized:true,active:false,message:'',appGuardMode:'before-use',appGuardModeConfigurationAccepted:true,appGuardReady:true,blockedApplications:1,appInterventionAuthorized:true,usageStatsAuthorized:true,selectedApplications:1} as any;
test('new preferences do not activate, legacy missing mode remains daily-limit, explicit saves survive hydration',()=>{
 assert.equal(hydrateRecoveryState({}).disciplineSettings.appGuardMode,'daily-limit');
 const fresh=createDefaultRecoveryState(); assert.equal(fresh.disciplineSettings.appGuardMode,'before-use'); assert.equal(fresh.disciplineSettings.appGuardModeConfiguredAt,null);
 const {appGuardMode,appGuardModeConfiguredAt,strictGuardConfiguredAt,...old}=fresh.disciplineSettings;
 assert.equal(hydrateRecoveryState({...fresh,disciplineSettings:old}).disciplineSettings.appGuardMode,'daily-limit');
 const saved=updateDisciplineSettings(fresh,{appGuardMode:'before-use',emergencyStrictMode:false},stamp);
 assert.equal(saved.disciplineSettings.appGuardModeConfiguredAt,stamp);assert.equal(saved.disciplineSettings.strictGuardConfiguredAt,stamp);
 assert.equal(hydrateRecoveryState(saved).disciplineSettings.appGuardModeConfiguredAt,stamp);
 assert.equal(updateDisciplineSettings(fresh,{dailyLimitMinutes:35},stamp).disciplineSettings.appGuardModeConfiguredAt,null);
});
test('iOS timing uses empty packages and application scope; strict false presence differs from omitted',()=>{
 const settings={...createDefaultDisciplineSettings(),sleepModeEnabled:true};
 const config=buildNativeAppScheduleConfiguration(settings,'ios');assert.equal(config.targetScope,'selected-applications');assert.ok(config.schedules.every(s=>s.packages.length===0));assert.ok(sanitizeAppScheduleConfiguration(config));assert.equal('strictGuard' in config,false);
 assert.equal(buildNativeAppScheduleConfiguration({...settings,strictGuardConfiguredAt:stamp},'ios').strictGuard,false);
 assert.equal(buildNativeAppScheduleConfiguration({...settings,deepFocusModeEnabled:true},'ios').strictGuard,true);
 assert.equal(sanitizeAppScheduleConfiguration({...config,strictGuard:null}),null);
 assert.equal(sanitizeAppScheduleConfiguration({...config,targetScope:'all-apps'}),null);
 assert.equal(sanitizeAppScheduleConfiguration({...config,schedules:config.schedules.map(s=>({...s,packages:['com.instagram.android']}))}),null);
 assert.equal(sanitizeAppScheduleConfiguration({...config,targetScope:undefined}),null);
});
test('modern package intent stays selected, legacy preserves widened strict fallback',()=>{
 const settings={...createDefaultDisciplineSettings(),blockedAppPackages:['com.instagram.android'],emergencyStrictMode:true};
 assert.deepEqual(getAppGuardPackages(settings,android),['com.instagram.android']);assert.ok(getAppGuardPackages(settings,{...android,appGuardModes:false}).length>1);
});
test('stable mode readiness uses current native facts, individual applications and reset latch',()=>{
 for(const mode of ['before-use','daily-limit','scheduled'] as const){const s={...base,appGuardMode:mode,appSchedulesSupported:true,appSchedulesConfigured:true,appSchedulesServiceConnected:true,appSchedulesConfigurationAccepted:true};assert.equal(describeAppGuard(ios,s).ready,true);assert.ok(describeAppGuard(ios,s).scope.includes('selected'));}
 assert.equal(describeAppGuard(ios,{...base,selectedApplications:0,selectedCategories:5,selectedWebDomains:3}).ready,false);
 assert.equal(describeAppGuard(android,{...base,appGuardModeConfigurationAccepted:undefined}).ready,true);
 assert.equal(describeAppGuard(android,{...base,appGuardMode:undefined}).ready,false);
 assert.equal(describeAppGuard(android,base,'scheduled').ready,false);
 assert.equal(describeAppGuard(android,{...base,protectionConfigurationResetDisabled:true}).ready,false);
 assert.equal(describeAppGuard(android,{...base,blockedApplications:0}).ready,false);
});
function native(events:string[],overrides:any={}){return {configurePackages:async()=>{events.push('manual');return base},configureMode:async(mode:string)=>{events.push(mode);return {...base,appGuardMode:mode}},configureSchedules:async(config:any)=>{events.push('schedules');return {...base,appSchedulesSupported:true,appSchedulesConfigurationAccepted:true,strictAppGuardEnabled:config.strictGuard===true}},...overrides};}
test('bootstrap skips default mode; explicit sync orders manual/mode/schedules and validates acknowledgments',async()=>{
 const events:string[]=[];await syncNativeAppGuard(createDefaultDisciplineSettings(),android,native(events),()=>true);assert.deepEqual(events,['manual','schedules']);
 events.length=0;const settings={...createDefaultDisciplineSettings(),appGuardModeConfiguredAt:stamp,strictGuardConfiguredAt:stamp};await syncNativeAppGuard(settings,android,native(events),()=>true);assert.deepEqual(events,['manual','before-use','schedules']);
 await assert.rejects(syncNativeAppGuard(settings,android,native([],{configureMode:async()=>({...base,appGuardModeConfigurationAccepted:false})}),()=>true));
 await assert.rejects(syncNativeAppGuard({...settings,emergencyStrictMode:true},android,native([],{configureSchedules:async()=>({...base,appSchedulesConfigurationAccepted:true,strictAppGuardEnabled:false})}),()=>true));
 await assert.rejects(syncNativeAppGuard(settings,android,native([],{configurePackages:async()=>({...base,protectionConfigurationResetDisabled:true})}),()=>true));
});
test('serialized failures retry, superseded manual writes skip stale mode and schedules',async()=>{
 let release!:()=>void;const gate=new Promise<void>(resolve=>release=resolve),events:string[]=[];let calls=0;
 const api=native(events,{configurePackages:async()=>{events.push('manual');if(++calls===1)await gate;return base}});
 const queue=createLatestSerialJob<any,any>((settings,current)=>syncNativeAppGuard(settings,android,api,current));const settings={...createDefaultDisciplineSettings(),appGuardModeConfiguredAt:stamp};
 const old=queue.submit(settings);await Promise.resolve();const latest=queue.submit({...settings,appGuardMode:'daily-limit'});release();assert.equal(await old.result,null);assert.ok(await latest.result);assert.deepEqual(events,['manual','manual','daily-limit','schedules']);
 let fail=true;const retry=createLatestSerialJob<any,any>((s,current)=>syncNativeAppGuard(s,android,native([],{configureMode:async()=>({...base,appGuardModeConfigurationAccepted:!fail})}),current));await assert.rejects(retry.submit(settings).result);fail=false;assert.ok(await retry.submit(settings).result);
});

test('modern feature readiness never substitutes saved selections, categories, active website state or permission for native app readiness',()=>{
 const capability={...ios,safariContentBlocker:false};const status={...base,adultFilterActive:true,appGuardReady:false};
 let read=getProtectionSetupReadiness(capability,status,5,'apps');assert.equal(read.appLimitsReady,false);assert.equal(read.websiteProtectionReady,true);
 read=getProtectionSetupReadiness(capability,{...status,appGuardModeConfigurationAccepted:true,selectedApplications:0,selectedCategories:10},5,'apps');assert.equal(read.selectedIosTargets,0);assert.equal(read.appLimitsReady,false);
 read=getProtectionSetupReadiness(capability,{...base,appGuardReady:false},5,'apps');assert.equal(read.activationReady,false);
});
test('strict intent preserves unknown legacy guard and explicit false acknowledgment cannot be inferred from missing fields',async()=>{
 const settings=createDefaultDisciplineSettings();let captured:any;await syncNativeAppGuard(settings,android,native([],{configureSchedules:async(config:any)=>{captured=config;return {...base,appSchedulesConfigurationAccepted:true}}}),()=>true);assert.equal('strictGuard' in captured,false);
 await assert.rejects(syncNativeAppGuard({...settings,strictGuardConfiguredAt:stamp},android,native([],{configureSchedules:async()=>({...base,appSchedulesConfigurationAccepted:true})}),()=>true));
});

test('stable refresh does not require transient configure receipts; exact saved mode and registered schedule facts remain required',()=>{
 const stable={...base,appGuardModeConfigurationAccepted:undefined,appSchedulesConfigurationAccepted:undefined};
 assert.equal(getProtectionSetupReadiness(android,stable,1,'apps','before-use').appLimitsReady,true);
 assert.equal(getProtectionSetupReadiness(android,stable,1,'apps','daily-limit').appLimitsReady,false);
 const scheduled={...stable,appGuardMode:'scheduled',appSchedulesSupported:true,appSchedulesConfigured:true,appSchedulesServiceConnected:true};
 assert.equal(getProtectionSetupReadiness(ios,scheduled,0,'apps','scheduled').appLimitsReady,true);
 assert.equal(getProtectionSetupReadiness(ios,{...scheduled,appSchedulesServiceConnected:undefined},0,'apps','scheduled').appLimitsReady,false);
});
