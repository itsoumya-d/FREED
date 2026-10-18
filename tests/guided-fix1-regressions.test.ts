import assert from 'node:assert/strict';
import test from 'node:test';
import { createGuidedResetAccessController } from '../src/lib/guided-reset-access';
import { createChallengeSessionController } from '../src/lib/challenge-session';
import { createPaywallNavigationSession } from '../src/lib/paywall-navigation';
const challenge={id:'one',title:'Breathe',category:'breathing' as const,durationSec:2,intensity:'calm' as const,premium:false,icon:'Waves',why:'Pause.',steps:['Inhale.','Exhale.'],verification:{version:1 as const,kind:'timer' as const}};
function accessHarness(){
 const values=new Map<string,string>();let fail=true,context='a',tier:'free'|'paid'|'review'|'unknown'='free';
 const storage={getItem:(k:string)=>values.get(k)??null,setItem:(k:string,v:string)=>{if(fail)throw Error('disk');values.set(k,v)},removeItem:(k:string)=>{values.delete(k)}};
 const controller=createGuidedResetAccessController({ownerUid:'u',storage,currentOwner:()=> 'u',currentTier:()=>tier,requestContext:()=>context,isForeground:()=>true,now:()=>1800000000000,createId:()=> 'session',createReward:()=>({provider:'native',status:'ready',id:'ad'} as any),completeReward:async()=>({provider:'native',status:'completed',rewardGranted:true,message:''})});controller.hydrate();
 return {controller,values,fail:(v:boolean)=>fail=v,context:(v:string)=>context=v,tier:(v:typeof tier)=>tier=v};
}
test('repair cannot transfer an earned result to a different context or tier, even after away-and-back',async()=>{
 for(const change of ['context','paid','review','away-back']){
  const h=accessHarness();assert.equal(await h.controller.watch(),'save-failed');h.fail(false);
  if(change==='context')h.context('b');if(change==='paid'||change==='review')h.tier(change);
  if(change==='away-back'){h.controller.invalidate();h.context('b');h.context('a');}
  assert.equal(h.controller.repair(),'denied');assert.equal(h.values.size,0);
 }
});
test('a persisted discard intent survives failed activity removal and restart, blocking another license until cleanup succeeds',()=>{
 const values=new Map<string,string>();let failActivity=false;
 const storage={getItem:(k:string)=>values.get(k)??null,setItem:(k:string,v:string)=>{values.set(k,v)},removeItem:(k:string)=>{if(k==='activity'&&failActivity)throw Error('disk');values.delete(k)}};
 const createAccess=()=>createGuidedResetAccessController({ownerUid:'u',storage,currentOwner:()=> 'u',currentTier:()=> 'paid',isForeground:()=>true,now:()=>1800000000000,createId:()=> 'session',createReward:()=>{throw Error()},completeReward:async()=>{throw Error()}});
 let access=createAccess();access.hydrate();access.startLicensed();const createActivity=()=>createChallengeSessionController({ownerId:'u',storage,storageKey:'activity',wallNow:()=>1800000000000,monotonicNow:()=>0,createId:()=> 'session',access});let activity=createActivity();activity.hydrate();activity.start(challenge);
 access.beginDiscard('session');failActivity=true;assert.throws(()=>activity.abandon());assert.equal(access.read()?.state,'discarding');assert.equal(access.canEnter(),false);assert.equal(access.startLicensed(),false);activity.dispose();access.dispose();
 access=createAccess();access.hydrate();activity=createActivity();activity.hydrate();assert.equal(access.read()?.state,'discarding');assert.equal(access.startLicensed(),false);failActivity=false;activity.abandon();access.clear();assert.equal(access.startLicensed(),true);
});
test('actual focused feature open stores its parameter in the paywall token and does not survive a later unrelated offer',()=>{
 const nav=createPaywallNavigationSession<'feature'|'paywall'|'ad'>('feature');nav.open('guided-reset');const first=nav.capture()!;assert.equal(first.origin,'feature');assert.equal(first.featureId,'guided-reset');nav.update('ad');nav.open();assert.equal(nav.owns(first),false);assert.equal(nav.capture()?.featureId,undefined);
});
