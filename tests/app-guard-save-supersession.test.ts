import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {transpileModule, ModuleKind} from 'typescript';
import {createLatestSerialJob} from '../src/lib/latest-serial-job';
import {syncNativeAppGuard} from '../src/lib/app-guard';
import {createDefaultDisciplineSettings} from '../src/lib/recovery-state';
import {getJourneyOwner} from '../src/lib/user-journey';

const deferred=()=>{let resolve!:()=>void;return{promise:new Promise<void>(done=>resolve=done),resolve:()=>resolve()}};
const capability={platform:'android',appGuardModes:true,appSchedules:true,accessibility:true,usageStats:true} as any;
const status={authorized:true,active:false,message:'',appGuardMode:'before-use',appGuardReady:true,blockedApplications:1,appInterventionAuthorized:true,usageStatsAuthorized:true} as any;
const settings={...createDefaultDisciplineSettings(),appGuardModeConfiguredAt:'2026-10-05T08:00:00.000Z'};
function productionCaller(queue:any,readStatus:()=>Promise<any>){
 const source=readFileSync(`${process.cwd()}/src/features/freed-app.tsx`,'utf8');const start=source.indexOf('  const syncAppProtection = React.useCallback');const end=source.indexOf('  const saveAppGuardMode = React.useCallback',start);
 const ticketStart=source.indexOf('  const captureProtectionActionTicket ='),ticketEnd=source.indexOf('  const appGroups =',ticketStart);
 const projectionStart=source.indexOf('  const projectGenericProtectionStatus ='),projectionEnd=source.indexOf('  const refreshProtectionStatus =',projectionStart);
 const compiled=transpileModule(`${source.slice(ticketStart,ticketEnd)}\n${source.slice(projectionStart,projectionEnd)}\n${source.slice(start,end)}\nreturn syncAppProtection;`,{compilerOptions:{module:ModuleKind.CommonJS}}).outputText;
 const owner='supersession-owner',scope=JSON.stringify([owner,1]);
 const deps={React:{useCallback:(fn:any)=>fn},appConfigQueue:{current:{submit:(input:any)=>queue.submit(input.settings),latestResult:()=>queue.latestResult(),invalidate:()=>queue.invalidate()}},appConfigReadScope:{current:{hydrated:true,storageReady:true,ownerLease:{ownerUid:owner,isCurrent:()=>true}}},recoveryStateRef:{current:{disciplineSettings:settings}},setAppConfigSyncBusy:()=>{},setProtectionStatus:()=>{},setProtectionSyncMessage:()=>{},getProtectionStatus:readStatus,
  getProtectionActionScope:()=>scope,appGroupsSuspensionEpoch:{current:0},getFirebaseAccountScope:()=>owner,accountHostGeneration:{current:1},protectionHostAlive:{current:true},appGroupsMemorySuspended:{current:false},appConfigBusyEpoch:{current:0},appConfigBusyRequest:{current:0},getFirebaseAuthSnapshot:()=>({status:'ready' as const,signedIn:true,anonymous:false,ownerUid:owner,email:null}),getJourneyOwner};
 return new Function(...Object.keys(deps),compiled)(...Object.values(deps)) as (s?:any)=>Promise<any>;
}
test('production explicit save rejects superseded same-settings mutation despite matching old native status',async()=>{
 const entered=deferred(),release=deferred();let manualCalls=0,reads=0;
 const queue=createLatestSerialJob<any,any>((s,current)=>syncNativeAppGuard(s,capability,{
  configurePackages:async()=>{if(++manualCalls===1){entered.resolve();await release.promise}return status},
  configureMode:async()=>({...status,appGuardModeConfigurationAccepted:true}),
  configureSchedules:async()=>({...status,appSchedulesSupported:true,appSchedulesConfigurationAccepted:false}),
 },current));
 const sync=productionCaller(queue,async()=>{reads++;return status});const explicit=sync(settings);await entered.promise;
 // The saved-settings effect submits exactly the same settings and retains the old mode in native status.
 const effect=sync(settings);const rejectedEffect=assert.rejects(effect,/schedule configuration was rejected/);const rejectedSave=assert.rejects(explicit,/schedule configuration was rejected/);release.resolve();await Promise.all([rejectedEffect,rejectedSave]);assert.equal(reads,0);
});
test('production superseded save returns only the receipt-validated replacement result',async()=>{
 const entered=deferred(),release=deferred();let calls=0,reads=0;
 const acknowledged={...status,appSchedulesSupported:true,appSchedulesConfigurationAccepted:true};
 const queue=createLatestSerialJob<any,any>(async(_s,current)=>{if(++calls===1){entered.resolve();await release.promise}return current()?acknowledged:null});
 const sync=productionCaller(queue,async()=>{reads++;return status});const explicit=sync(settings);await entered.promise;const effect=sync(settings);release.resolve();assert.equal(await explicit,acknowledged);assert.equal(await effect,acknowledged);assert.equal(reads,0);
});
test('replacement outcome preserves rejection while deletion drain remains nonthrowing and invalidation cannot succeed',async()=>{
 const queue=createLatestSerialJob<number,number>(async()=>{throw new Error('native rejected')});const rejected=queue.submit(1);await assert.rejects(rejected.result,/native rejected/);await queue.whenIdle();await assert.rejects(queue.latestResult(),/native rejected/);queue.invalidate();assert.equal(await queue.latestResult(),null);
});
test('production cancelled save rejects rather than reading matching stale native state',async()=>{
 const entered=deferred(),release=deferred();let reads=0;
 const queue=createLatestSerialJob<any,any>(async(_s,current)=>{entered.resolve();await release.promise;return current()?status:null});
 const sync=productionCaller(queue,async()=>{reads++;return status});const save=sync(settings);await entered.promise;queue.invalidate();const rejected=assert.rejects(save,/configuration was cancelled/);release.resolve();await rejected;await queue.whenIdle();assert.equal(reads,0);
});
test('latest result follows further supersession while waiting instead of returning an obsolete success',async()=>{
 const entered=deferred(),release=deferred();
 const queue=createLatestSerialJob<number,number>(async(input)=>{if(input===1){entered.resolve();await release.promise;return 1}throw new Error('replacement rejected')});
 queue.submit(1);await entered.promise;const latestOutcome=queue.latestResult();queue.submit(2);const rejected=assert.rejects(latestOutcome,/replacement rejected/);release.resolve();await rejected;await queue.whenIdle();
});
