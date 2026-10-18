import assert from 'node:assert/strict';
import test from 'node:test';
import * as cadence from '../src/lib/breathing-cadence';
const create=(cadence as any).createBreathingCueController;
const frame={enabled:true,active:true,running:true,key:'session:cycle0:phase0',kind:'inhale'};
test('phase cues play once per real phase boundary rather than every countdown update',async()=>{
 assert.equal(typeof create,'function');const played:string[]=[];
 const c=create({play:async(kind:string)=>{played.push(kind);},stop:()=>{}});
 await c.update(frame);await c.update(frame);await c.update({...frame,key:'session:cycle0:phase1',kind:'exhale'});
 assert.deepEqual(played,['inhale','exhale']);
});
test('pause, background and disabled sound stop playback without advancing or inventing phases',async()=>{
 for(const change of [{running:false},{active:false},{enabled:false}]){
 const played:string[]=[],stops:number[]=[];const c=create({play:async(kind:string)=>{played.push(kind);},stop:()=>{stops.push(1);}});
 await c.update(frame);const before=stops.length;await c.update({...frame,...change});
 assert.deepEqual(played,['inhale']);assert.equal(stops.length,before+1);
 }
});
test('a late audio load cannot start after navigation or a phase change',async()=>{
 let finish!:()=>void;const loaded=new Promise<void>(resolve=>{finish=resolve;});let audible=0;
 const c=create({play:async(_kind:string,current:()=>boolean)=>{await loaded;if(current())audible++;},stop:()=>{}});
 const load=c.update(frame);await Promise.resolve();c.dispose();finish();await load;assert.equal(audible,0);
});
test('audio failures are recoverable and never become exercise completion',async()=>{
 let calls=0;const c=create({play:async()=>{if(++calls===1)throw Error('unavailable');},stop:()=>{}});
 assert.equal(await c.update(frame),'unavailable');
 assert.equal(await c.update({...frame,key:'session:cycle0:phase1',kind:'exhale'}),'played');
});
