import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import {transpileModule,ModuleKind} from 'typescript';
import {createAuthSnapshotObserver} from '../src/lib/user-journey';
import {createNativeAccountSessionCoordinator} from '../src/lib/native-account-session';
import {summarizeFirebaseAccount} from '../src/lib/firebase-client';
import {actualAdapter} from './helpers/native-account-adapter-fixture';
test('actual Firebase SDK/observer integration invalidates before publication and ignores queued wrong SDK identity',async()=>{
 const native=actualAdapter('android'),auth:any={currentUser:{uid:'A',isAnonymous:false,email:null,providerData:[{providerId:'password'}]}};let emit!:(user:any)=>void;const seen:any[]=[];
 const s=readFileSync('src/lib/firebase-native.ts','utf8'),start=s.indexOf('const nativeAccountSession='),end=s.indexOf('\nexport function getFirebaseAccountSummary',start),body=s.slice(start,end).replaceAll('export ','')+';return {getFirebaseAuthSnapshot,subscribeFirebaseAuthSnapshot,retryFirebaseAuthSnapshot,getFirebaseNativeAccountAdmission,getFirebaseNativeAccountSessionSnapshot};';
 const deps={createAuthSnapshotObserver,createNativeAccountSessionCoordinator,createNativeAccountSession:native.api.createNativeAccountSession,getFirebaseAccountScope:()=>auth.currentUser?.uid??null,randomUUID:()=> '33333333-3333-4333-8333-333333333333',Platform:{OS:'android'},getFirebaseClientReadiness:()=>({ready:true}),getConfiguredAuth:()=>auth,onAuthStateChanged:(_auth:any,fn:any)=>{emit=fn;return()=>{};},summarizeFirebaseAccount};
 const api=new Function(...Object.keys(deps),transpileModule(body,{compilerOptions:{module:ModuleKind.CommonJS}}).outputText)(...Object.values(deps));
 const off=api.subscribeFirebaseAuthSnapshot(()=>seen.push({status:api.getFirebaseAuthSnapshot().status,admitted:api.getFirebaseNativeAccountAdmission(),events:[...native.events]}));emit(auth.currentUser);await new Promise(r=>setImmediate(r));const a=api.getFirebaseNativeAccountAdmission();assert.ok(a);assert.equal(a.ownerUid,'A');
 api.retryFirebaseAuthSnapshot();assert.equal(seen.at(-1).status,'hydrating');assert.equal(seen.at(-1).admitted,null);assert.ok(seen.at(-1).events.includes('release:1'));
 const queuedA=auth.currentUser;auth.currentUser={...queuedA,uid:'B'};emit(queuedA);assert.equal(api.getFirebaseAuthSnapshot().status,'hydrating');assert.equal(api.getFirebaseNativeAccountAdmission(),null);
 off();assert.equal(api.getFirebaseNativeAccountAdmission(),null);
});
