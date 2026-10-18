import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import {transpileModule,ModuleKind} from 'typescript';
import {actualAdapter} from './helpers/native-account-adapter-fixture';
import {createNativeAccountSessionCoordinator} from '../src/lib/native-account-session';
import {createAuthSnapshotObserver} from '../src/lib/user-journey';
import {summarizeFirebaseAccount} from '../src/lib/firebase-client';
import {trustedPrivateOwner} from '../src/lib/trusted-private-owner';
import {createAccountOperationGate} from '../src/lib/account-operation';
import {reserveNativeCleanup,executeStoredNativeCleanup} from '../src/lib/account-cleanup-metadata';
const tick=()=>new Promise<void>(r=>setImmediate(r));
const receipt=(terminal=false)=>({version:2,accepted:true,operationId:'44444444-4444-4444-8444-444444444444',phase:terminal?'terminal':'prepared',privateCleanupAccepted:terminal,runtimeScrubComplete:terminal,adultPolicyRetained:true,coreState:terminal?'complete':'pending',processState:terminal?'complete':'pending'});
async function fixture(stage:'prepare'|'execute'='prepare'){
 const f=actualAdapter('android'),sdk:{currentUser:any}={currentUser:{uid:'A',isAnonymous:false,email:'a@example.test'}},values=new Map<string,string>(),storage={getItem:(k:string)=>values.get(k)??null,setItem:(k:string,v:string)=>{values.set(k,v);}};
 let deliver!:(user:any)=>void,startThrows=false,subscriptions=0,signouts=0,executes=0,resumes=0,screen='main',notice='',locked=false,uuid=0;const effects:string[]=[];
 const nativeSource=readFileSync('src/lib/firebase-native.ts','utf8'),a=nativeSource.indexOf('const nativeAccountSession='),b=nativeSource.indexOf('\nexport function getFirebaseAccountSummary',a);
 assert.ok(a>0&&b>a);const observerDeps={createNativeAccountSessionCoordinator,createNativeAccountSession:f.api.createNativeAccountSession,getFirebaseAccountScope:()=>sdk.currentUser?.uid??null,randomUUID:()=>`${String(++uuid).padStart(8,'0')}-3333-4333-8333-333333333333`,createAuthSnapshotObserver,Platform:{OS:'android'},getFirebaseClientReadiness:()=>({ready:true}),getConfiguredAuth:()=>sdk,onAuthStateChanged:(_sdk:any,fn:(user:any)=>void)=>{if(startThrows)throw Error('Auth unavailable');deliver=fn;return()=>{};},summarizeFirebaseAccount};
 const observer=new Function(...Object.keys(observerDeps),transpileModule(nativeSource.slice(a,b).replaceAll('export ',''),{compilerOptions:{module:ModuleKind.CommonJS}}).outputText+';return {nativeAccountSession,getFirebaseAuthSnapshot,subscribeFirebaseAuthSnapshot,retryFirebaseAuthSnapshot,getFirebaseNativeAccountAdmission,retireFirebaseNativeAccountSession,reconcileFirebaseNativeAccountSession,withFirebaseNativeAccountCleanup};')(...Object.values(observerDeps));
 const off=observer.subscribeFirebaseAuthSnapshot(()=>{});deliver(sdk.currentUser);await tick();const original=observer.getFirebaseNativeAccountAdmission();assert.ok(original);
 let entered!:()=>void,release!:(v:any)=>void,reject!:(e:Error)=>void;const started=new Promise<void>(r=>{entered=r;}),held=()=>{entered();return new Promise((r,j)=>{release=r;reject=j;});};
 f.native.prepareAccountProtectionCleanup=()=>stage==='prepare'?held():receipt();f.native.executeAccountProtectionCleanup=()=>{executes++;return stage==='execute'?held():receipt(true);};
 const record=(name:string)=>{if(sdk.currentUser?.uid==='B')effects.push(name);};const no=()=>{};
 const deps:any={React:{useCallback:(fn:any)=>fn},localStorage:storage,accountFlowFence:{current:{isActive:()=>false}},retireFirebaseNativeAccountSession:observer.retireFirebaseNativeAccountSession,reconcileFirebaseNativeAccountSession:observer.reconcileFirebaseNativeAccountSession,withFirebaseNativeAccountCleanup:observer.withFirebaseNativeAccountCleanup,getFirebaseNativeAccountAdmission:observer.getFirebaseNativeAccountAdmission,getFirebaseAccountScope:()=>sdk.currentUser?.uid??null,getFirebaseAuthSnapshot:observer.getFirebaseAuthSnapshot,subscribeFirebaseAuthSnapshot:(fn:()=>void)=>{subscriptions++;const stop=observer.subscribeFirebaseAuthSnapshot(fn);return()=>{subscriptions--;stop();};},reserveNativeCleanup,executeStoredNativeCleanup,prepareNativeAccountCleanup:f.api.prepareNativeAccountCleanup,executeNativeAccountCleanup:f.api.executeNativeAccountCleanup,accountOperationGate:{current:createAccountOperationGate(()=>sdk.currentUser?.uid??null)},deletionBusyRef:{current:false},signingOutRef:{current:false},setSigningOut:()=>record('busy'),privateSignoutOwner:{current:null},privateCleanupOwner:{current:null},privateLockedRef:{current:false},setPrivateViewLocked:(v:boolean)=>{locked=v;record('lock');},accountHostGeneration:{current:1},profileAccountOrigin:{current:null},protectionReadback:{current:{invalidate:no}},appConfigQueue:{current:{invalidate:no}},setPendingRecoveryRestore:()=>record('restore'),setPendingFirebaseEmailLink:()=>record('email'),setAccountNotice:(v:string)=>{notice=v;record('notice');},cancelAutomaticBackupSync:()=>record('backup'),disableAutomaticBackup:()=>new Promise(()=>{}),persistRecoveryState:()=>record('preferences'),journalResources:{current:{repository:{revoke:()=>record('journal')}}},suspendOwner:()=>record('lease'),setJourneyMembership:()=>record('membership'),setActiveAttempt:()=>record('attempt'),setSelectedChallenge:()=>record('challenge'),setBasicHelpContext:()=>record('help'),challengeBreakOrigin:{current:null},signOutFirebaseAccount:async()=>{record('Auth');signouts++;sdk.currentUser=null;deliver(null);},setAccountReturnToProfile:()=>record('account-route'),setScreen:(v:string)=>{screen=v;record('screen');},setRemoteRetentionPlan:()=>record('retention'),safeUserFacingMessage:(_e:any,fallback:string)=>fallback,resumeOwner:()=>{resumes++;record('resume');},getProtectionActionScope:()=>null};
 const source=readFileSync(process.env.TASK86_FIX2_ROOT_SOURCE??'src/features/freed-app.tsx','utf8'),start=source.indexOf('  const signOutRecoveryAccount ='),end=source.indexOf('  const restoreRecoveryState =',start);assert.ok(start>0&&end>start);
 const callback=new Function(...Object.keys(deps),transpileModule(source.slice(start,end)+';return signOutRecoveryAccount;',{compilerOptions:{module:ModuleKind.CommonJS}}).outputText)(...Object.values(deps));
 const renderEffect=()=>{const start=source.indexOf('  React.useEffect(',source.indexOf('  const privateSignoutOwner =')),end=source.indexOf('  const membershipBusyRef',start),effectDeps={...deps,React:{useEffect:(fn:()=>void)=>fn()},journeyOwner:trustedPrivateOwner(observer.getFirebaseAuthSnapshot(),sdk.currentUser?.uid??null),privateViewLocked:locked};new Function(...Object.keys(effectDeps),transpileModule(source.slice(start,end),{compilerOptions:{module:ModuleKind.CommonJS}}).outputText)(...Object.values(effectDeps));};
 return {f,observer,original,deps,started,run:callback,release:()=>release(receipt(stage==='execute')),reject:()=>reject(Error('Native unavailable')),publish:(uid:string|null)=>{sdk.currentUser=uid?{uid,isAnonymous:false,email:uid+'@example.test'}:null;deliver(sdk.currentUser);},mismatch:()=>{sdk.currentUser={uid:'B',isAnonymous:false};deliver({uid:'A',isAnonymous:false});},unknown:()=>observer.retryFirebaseAuthSnapshot(),unavailable:()=>{startThrows=true;observer.retryFirebaseAuthSnapshot();startThrows=false;},lateA:()=>deliver({uid:'A',isAnonymous:false}),renderEffect,effects,get signouts(){return signouts},get executes(){return executes},get resumes(){return resumes},get locked(){return locked},get screen(){return screen},get notice(){return notice},get subscriptions(){return subscriptions},close:off};
}
for(const stage of ['prepare','execute'] as const)test('actual observer repeated ready(A) during cleanup '+stage+' keeps logical transition and completes logout',async()=>{
 const f=await fixture(stage);try{const work=f.run();await f.started;const first=f.observer.getFirebaseAuthSnapshot();f.publish('A');assert.notEqual(f.observer.getFirebaseAuthSnapshot(),first);if(stage==='prepare')assert.equal(f.observer.getFirebaseNativeAccountAdmission(),f.original);await tick();f.release();await work;
 assert.equal(f.signouts,1);assert.equal(f.screen,'welcome');assert.match(f.notice,/^Signed out\./);assert.equal(f.deps.signingOutRef.current,false);assert.equal(f.subscriptions,0);f.renderEffect();assert.equal(f.locked,false);
 const snapshot=f.observer.getFirebaseAuthSnapshot(),notice=f.notice;f.lateA();assert.equal(f.observer.getFirebaseAuthSnapshot(),snapshot);assert.equal(f.notice,notice);assert.equal(f.signouts,1);assert.equal(f.subscriptions,0);
 }finally{f.close();}
});
for(const interrupted of ['unknown','unavailable'] as const)test('actual observer '+interrupted+' then same A during prepare aborts old logout into fresh reachable account retry',async()=>{
 const f=await fixture();try{const work=f.run();await f.started;f[interrupted]();if(interrupted==='unavailable')f.unknown();f.publish('A');await tick();assert.notEqual(f.observer.getFirebaseNativeAccountAdmission(),f.original);f.release();await work;
 assert.equal(f.signouts,0);assert.equal(f.executes,0);assert.equal(f.locked,false);assert.equal(f.screen,'account');assert.match(f.notice,/Sign-out could not complete/);assert.equal(f.deps.signingOutRef.current,false);assert.equal(f.subscriptions,0);assert.ok(f.observer.getFirebaseNativeAccountAdmission());assert.equal(f.observer.nativeAccountSession.isCurrent(f.original),false);assert.ok(f.resumes>0);
 }finally{f.close();}
});
for(const interrupted of ['unavailable','mismatch'] as const)test('actual observer '+interrupted+' during prepare never logs out or locks mismatched private account',async()=>{
 const f=await fixture();try{const work=f.run();await f.started;f[interrupted]();f.renderEffect();f.effects.length=0;f.release();await work;assert.equal(f.signouts,0);assert.equal(f.executes,0);assert.equal(f.locked,false);assert.deepEqual(f.effects,[]);assert.equal(f.subscriptions,0);}finally{f.close();}
});
test('actual observer B during cleanup prepare has zero B effects and retires original admission',async()=>{
 const f=await fixture();try{const work=f.run();await f.started;f.publish('B');await tick();f.renderEffect();f.effects.length=0;const b=f.observer.getFirebaseNativeAccountAdmission();f.release();await work;assert.equal(f.signouts,0);assert.equal(f.executes,0);assert.deepEqual(f.effects,[]);assert.equal(f.observer.getFirebaseNativeAccountAdmission(),b);assert.equal(f.subscriptions,0);}finally{f.close();}
});
for(const outcome of ['resolve','reject','timeout'] as const)test('actual observer B during cleanup execute '+outcome+' has zero B effects',async()=>{
 const f=await fixture('execute');try{const work=f.run();await f.started;f.publish('B');await tick();f.renderEffect();f.effects.length=0;const b=f.observer.getFirebaseNativeAccountAdmission();if(outcome==='resolve')f.release();if(outcome==='reject')f.reject();await work;assert.equal(f.signouts,0);assert.deepEqual(f.effects,[]);assert.equal(f.observer.getFirebaseNativeAccountAdmission(),b);assert.equal(f.subscriptions,0);}finally{f.close();}
});
for(const next of ['same-A','B'] as const)test('actual observer interrupted fresh abort reconciliation '+next+' never continues old logout or leaves a spinner',async()=>{
 const f=await fixture();try{
  const work=f.run();await f.started;f.unknown();f.publish('A');await tick();
  const prepare=f.f.native.prepareAccountBindingV2;let entered!:()=>void,release!:(v:any)=>void,held=false;const started=new Promise<void>(r=>{entered=r;});
  f.f.native.prepareAccountBindingV2=(...args:any[])=>{if(held)return prepare(...args);held=true;entered();return new Promise(r=>{release=r;});};
  f.release();let timer:ReturnType<typeof setTimeout>|undefined;try{await Promise.race([started,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('Fresh abort reconciliation was not entered')),500);})]);}finally{if(timer)clearTimeout(timer);}
  if(next==='same-A'){f.unknown();f.publish('A');}else f.publish('B');await tick();if(next==='B'){f.renderEffect();f.effects.length=0;}
  release({ticket:'11111111-1111-4111-8111-111111111111',admissionRevision:0});await work;
  assert.equal(f.signouts,0);assert.equal(f.executes,0);assert.equal(f.locked,false);assert.equal(f.subscriptions,0);
  if(next==='same-A'){assert.equal(f.screen,'account');assert.equal(f.resumes,0);assert.match(f.notice,/Sign-out could not complete/);}else assert.deepEqual(f.effects,[]);
 }finally{f.close();}
});
for(const newerBusy of [false,true])test('actual batched B→null without owner effect settles only original busy marker; newer operation='+newerBusy,async()=>{
 const f=await fixture('execute');try{const work=f.run();await f.started;f.publish('B');await tick();
  if(newerBusy){f.deps.privateSignoutOwner.current='B';f.deps.accountHostGeneration.current++;}
  f.effects.length=0;f.publish(null);f.release();await work;
  assert.equal(f.signouts,0);assert.equal(f.screen,'main');assert.equal(f.notice,'Signing out…');assert.deepEqual(f.effects,[]);assert.equal(f.subscriptions,0);
  assert.equal(f.deps.signingOutRef.current,newerBusy);assert.equal(f.deps.privateSignoutOwner.current,newerBusy?'B':null);
  if(!newerBusy){f.renderEffect();assert.equal(f.locked,false);}
 }finally{f.close();}
});
