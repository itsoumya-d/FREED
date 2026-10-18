import assert from 'node:assert/strict';
import test from 'node:test';
import * as capability from '../src/lib/challenge-capability';
import { createChallengeSessionController } from '../src/lib/challenge-session';
import type { RecoveryChallenge } from '../src/lib/recovery-engine';
import { getChallengeGenerationConfig } from '../src/lib/challenge-generator';
const denied = { available: false, permission: 'unavailable' as const, canAskAgain: false };
const caps: capability.ChallengeCapabilities = { motion: denied, steps: denied, location: denied, photo: denied, connection: denied };
const profile = { premium: false, hour: 23, mood: 'steady' as const, attemptsToday: 0, streakDays: 0 };
const select = (capability as any).selectResetChoices;
test('old remote configuration cannot enable off-device challenge generation',()=>{
 assert.equal(getChallengeGenerationConfig({mode:'remote'}).mode,'local');
 assert.equal(getChallengeGenerationConfig({mode:'remote'}).endpointUrl,null);
});
test('three distinct local reset choices remain available without sensors, camera or outdoor access', () => {
 assert.equal(typeof select, 'function');
 const options = select(profile, caps);
 assert.deepEqual(options.map((option: any) => option.group), ['breathe','find','move']);
 assert.equal(new Set(options.map((option:any) => option.challenge.id)).size, 3);
 assert.ok(options.every((option:any) => capability.getChallengeCapability(option.challenge,caps).eligible));
 assert.ok(options.every((option:any) => option.challenge.environment !== 'outdoors'));
 assert.equal(options.find((option:any) => option.group === 'move').challenge.seatedAlternative, true);
});
test('recently completed activities rotate within each category without changing the category choices', () => {
 const first = select(profile,caps);
 const next = select({ ...profile, challengeHistory: first.map((o:any) => ({ id:o.challenge.id,category:o.challenge.category,outcome:'helped',completedAt:'2026-10-05T10:00:00Z' })) },caps);
 assert.deepEqual(next.map((o:any) => o.group),['breathe','find','move']);
 assert.ok(next.every((o:any,index:number) => o.challenge.id !== first[index].challenge.id));
});
test('replacement offers a different activity in the same category before any completion is recorded',()=>{
 const first=select(profile,caps);
 for(const choice of first){const next=select(profile,caps,{excludeId:choice.challenge.id});assert.deepEqual(next.map((o:any)=>o.group),['breathe','find','move']);assert.notEqual(next.find((o:any)=>o.group===choice.group).challenge.id,choice.challenge.id);}
});
test('camera hardware alone cannot expose targets whose classifier accuracy has not been evaluated', () => {
 const options = select(profile,{...caps,photo:{available:true,permission:'granted',canAskAgain:false}});
 assert.equal(options.find((o:any)=>o.group==='find').challenge.verification.kind,'timer');
});
test('replacing a reset retains one licensed session and rejects old evidence without consuming another ad', () => {
 const values = new Map<string,string>(); let consumed = 0, clock = 0;
 const storage={getItem:(k:string)=>values.get(k)??null,setItem:(k:string,v:string)=>{values.set(k,v);},removeItem:(k:string)=>{values.delete(k);}};
 const timed: RecoveryChallenge={id:'one',title:'One',category:'breathing',durationSec:5,intensity:'calm',premium:false,icon:'Waves',why:'Pause.',steps:['Inhale.','Exhale.'],verification:{version:1,kind:'timer'}};
 const controller=createChallengeSessionController({ownerId:'owner',storage,wallNow:()=>1000,monotonicNow:()=>clock,createId:()=> 'licensed-session',access:{consume:()=>{consumed++;return true;},allows:()=>true}});
 controller.hydrate();controller.start(timed);clock=2000;controller.tick();
 assert.equal(typeof (controller as any).replace,'function');
 (controller as any).replace({...timed,id:'two',verification:{version:1,kind:'motion',minMotionSamples:6}},'licensed-session');
 assert.equal(consumed,1);assert.equal(controller.read().session!.id,'licensed-session');assert.equal(controller.read().elapsedSec,0);
 assert.equal(controller.claimCompletion({elapsedSec:999,motionSamples:999}),false);
 clock=3000;controller.tick();controller.pause();
 assert.throws(()=> (controller as any).replace(timed,'old-session'));
 assert.equal(controller.read().session!.challenge.id,'two');
});
test('a failed replacement write retains the previous resumable challenge and does not charge another session', () => {
 let raw:string|null=null, fail=false,consume=0;
 const timed:RecoveryChallenge={id:'one',title:'One',category:'breathing',durationSec:5,intensity:'calm',premium:false,icon:'Waves',why:'Pause.',steps:['Inhale.','Exhale.'],verification:{version:1,kind:'timer'}};
 const controller=createChallengeSessionController({ownerId:'owner',storage:{getItem:()=>raw,setItem:(_k,v)=>{if(fail)throw Error('disk full');raw=v;},removeItem:()=>{raw=null;}},wallNow:()=>1000,monotonicNow:()=>0,createId:()=> 'licensed',access:{consume:()=>{consume++;return true;},allows:()=>true}});
 controller.hydrate();controller.start(timed);fail=true;
 assert.throws(()=> (controller as any).replace({...timed,id:'two'},'licensed'),/disk full/);
 assert.equal(controller.read().session!.challenge.id,'one');assert.equal(consume,1);
});
