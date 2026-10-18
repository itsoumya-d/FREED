import test from 'node:test';
import assert from 'node:assert/strict';
import { createChallengeSessionController, CHALLENGE_SESSION_STORAGE_KEY } from '../src/lib/challenge-session';
import { MOMENTUM_RESET_TEMPLATES } from '../src/data/momentum-resets';
import { createDefaultRecoveryState, hydrateRecoveryState, recordChallengeCompletion } from '../src/lib/recovery-state';

function harness() {
 let mono=0, wall=1_800_000_000_000, fail=false;
 const values=new Map<string,string>();
 const storage={getItem:(key:string)=>values.get(key)??null,setItem:(key:string,value:string)=>{if(fail)throw Error('disk full');values.set(key,value);},removeItem:(key:string)=>{values.delete(key);}};
 const create=()=>createChallengeSessionController({ownerId:'owner',storage,monotonicNow:()=>mono,wallNow:()=>wall,createId:()=> 'session_one'});
 return{create,values,advance:()=>{mono+=1000;wall+=1000;},fail:(value:boolean)=>{fail=value;}};
}
test('authored template revision and actual completion method survive session restart and history hydration',()=>{
 const h=harness(),c=h.create(),challenge=MOMENTUM_RESET_TEMPLATES[0];c.hydrate();c.start(challenge);
 for(let n=0;n<60;n++){h.advance();c.tick();}
 assert.equal(c.claimCompletion({},'unknown'),true);const receipt=c.read().session;assert.ok(receipt);
 const provenance=(receipt!.completion as any).provenance;
 assert.deepEqual(provenance,{version:1,method:'timer',verificationRuleVersion:1,template:{id:challenge.id,revision:1}});
 const restored=h.create();restored.hydrate();assert.deepEqual((restored.read().session!.completion as any).provenance,provenance);
 const state=recordChallengeCompletion(createDefaultRecoveryState(),challenge,new Date(receipt!.completion!.completedAtMs).toISOString(),undefined,'unknown',receipt!.id,60,provenance);
 assert.deepEqual((hydrateRecoveryState(state).challengeHistory[0] as any).provenance,provenance);
 assert.equal(recordChallengeCompletion(state,challenge,undefined,undefined,'helped',receipt!.id,60,provenance),state);
});
test('legacy receipts retain their outcome without inventing a template revision or verification provenance',()=>{
 const state=createDefaultRecoveryState();
 state.challengeHistory=[{id:'old',sessionId:'legacy_session',title:'Private words',category:'reset',outcome:'unknown',completedAt:'2026-10-08T01:00:00Z',durationSec:60,premium:false}];
 const restored=hydrateRecoveryState(state);assert.equal((restored.challengeHistory[0] as any).provenance,undefined);
 assert.equal(restored.challengeHistory[0].title,'Private words');assert.equal(restored.challengeHistory[0].outcome,'unknown');
});
test('an unversioned clone cannot inherit authored revision and failed persistence cannot publish completion proof',()=>{
 const h=harness(),c=h.create();c.hydrate();c.start({...MOMENTUM_RESET_TEMPLATES[0],title:'Private custom words'});
 for(let n=0;n<60;n++){h.advance();c.tick();}
 h.fail(true);assert.throws(()=>c.claimCompletion({},'helped'),/disk full/);assert.equal(c.read().session?.phase,'paused');
 h.fail(false);assert.equal(c.claimCompletion({},'helped'),true);const receipt=c.read().session;assert.ok(receipt);
 assert.deepEqual((receipt!.completion as any).provenance,{version:1,method:'timer',verificationRuleVersion:1});
 assert.doesNotMatch(JSON.stringify((receipt!.completion as any).provenance),/Private custom words/);
});
test('malformed imported provenance is discarded without erasing history or publishing photos/labels',()=>{
 const state=createDefaultRecoveryState();
 state.challengeHistory=[{id:'old',title:'Kept',category:'reset',outcome:'unknown',completedAt:'2026-10-08T01:00:00Z',durationSec:60,premium:false,provenance:{version:1,method:'photo',verificationRuleVersion:1,photoLabels:['private'],photoPath:'/private/capture.jpg'}} as any];
 const restored=hydrateRecoveryState(state);assert.equal(restored.challengeHistory.length,1);assert.equal((restored.challengeHistory[0] as any).provenance,undefined);
});
test('imported evidence method must be an exact string rather than a coercible array or object',()=>{
 for(const method of [['timer'],{toString:()=> 'timer'}]){
  const state=createDefaultRecoveryState();state.challengeHistory=[{id:'old',title:'Kept',category:'reset',outcome:'unknown',completedAt:'2026-10-08T01:00:00Z',durationSec:60,premium:false,provenance:{version:1,method,verificationRuleVersion:1}} as any];
  assert.equal((hydrateRecoveryState(state).challengeHistory[0] as any).provenance,undefined);
 }
});
