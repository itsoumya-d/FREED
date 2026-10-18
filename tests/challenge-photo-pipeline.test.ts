import assert from 'node:assert/strict';
import test from 'node:test';
import { runChallengePhotoCapture, type ChallengePhotoCaptureOptions } from '../src/lib/challenge-verification-runtime';
const identity = { provider: 'bundled-mlkit', classifierRevision: 'com.google.mlkit:image-labeling:17.0.9', runtimeRevision: 'android-36', ruleRevision: 'freed-photo-targets-v1', modelWeightsRevision: null };
const capabilities = { cameraAvailable: true, classifierAvailable: true, identity, supportedTargetIds: ['flower'], validatedPhotoTargets: [] };
const result = { available: true, matched: true, labels: ['flower'], matchedLabels: ['flower'], confidence: .8, message: 'Target found.', outcome: 'matched', identity };
function flow(extra: Record<string, unknown> = {}) {
 const published: unknown[] = []; const deleted: string[] = [];
 const options = { expectedLabels: ['flower'], isCurrent: () => true, getCapabilities: async () => capabilities,
 preparePhotoCapture: async () => true,
 requestPermission: async () => ({granted: true}), launchCamera: async () => ({canceled: false, assets: [{uri:'capture'}]}),
 adoptPhoto: async (uri: string) => uri, classifyPhoto: async () => result, cancelPhoto: async () => true,
 deletePhoto: (uri: string) => { deleted.push(uri); }, onStatus: () => {}, onPermissionDenied: () => {}, onClassification: (value: unknown) => {published.push(value);}, ...extra } as ChallengePhotoCaptureOptions;
 return { options, published, deleted };
}
test('boolean-only legacy capability cannot open camera or manufacture proof', async () => {
 const f = flow({getCapabilities: async () => ({cameraAvailable:true,classifierAvailable:true}), launchCamera: () => { throw Error('must fail closed before camera'); }});
 assert.equal(await runChallengePhotoCapture(f.options), 'unavailable'); assert.deepEqual(f.published, []);
});
test('provider identity mismatch cannot publish a match', async () => {
 const f = flow({classifyPhoto: async () => ({...result, identity:{...identity,classifierRevision:'unknown'}})});
 assert.equal(await runChallengePhotoCapture(f.options), 'unavailable'); assert.equal((f.published[0] as any).matched, false); assert.deepEqual(f.deleted,['capture']);
});
test('hanging inference reaches a bounded deadline and requests native cancellation', async () => {
 let cancelled = false; const f = flow({ inferenceTimeoutMs: 10, classifyPhoto: () => new Promise(()=>{}), cancelPhoto: async () => {cancelled=true;return true;} });
 assert.equal(await runChallengePhotoCapture(f.options), 'unavailable'); assert.equal(cancelled,true); assert.deepEqual(f.deleted,['capture']); assert.deepEqual(f.published,[]);
});
test('abort closes UI while a delayed camera retains global authority and cleans on return', async () => {
 let resolve!: (v:any)=>void; let started!:()=>void;const launched=new Promise<void>(r=>started=r);const camera=new Promise<any>(r=>resolve=r);const controller=new AbortController();
 const f=flow({signal:controller.signal,launchCamera:()=>{started();return camera;}});const running=runChallengePhotoCapture(f.options);await launched;controller.abort();
 assert.equal(await running,'cancelled');const second=flow(); assert.equal(await runChallengePhotoCapture(second.options),'unavailable');
 resolve({canceled:false,assets:[{uri:'late-camera'}]});await new Promise(r=>setTimeout(r,0)); assert.deepEqual(f.deleted,['late-camera']); assert.deepEqual(f.published,[]);
 assert.equal(await runChallengePhotoCapture(second.options),'matched');
});
test('generic plant, uncertain outcome and unknown identity cannot become flower proof',async()=>{
 for(const value of [{...result,matchedLabels:['plant']},{...result,outcome:'uncertain'},{...result,identity:null}]){const f=flow({classifyPhoto:async()=>value});assert.notEqual(await runChallengePhotoCapture(f.options),'matched');}
});
test('a native matched label absent from its observations cannot manufacture proof',async()=>{const f=flow({classifyPhoto:async()=>({...result,labels:['plant']})});assert.notEqual(await runChallengePhotoCapture(f.options),'matched');});
test('late inference callbacks after abort or deadline never publish proof',async()=>{
 for(const abort of [true,false]){let resolve!:(v:any)=>void;let started!:()=>void;const began=new Promise<void>(r=>started=r);const controller=new AbortController();const f=flow({signal:controller.signal,inferenceTimeoutMs:5,classifyPhoto:()=>{started();return new Promise(r=>resolve=r);}});const running=runChallengePhotoCapture(f.options);await began;if(abort)controller.abort();assert.equal(await running,abort?'cancelled':'unavailable');resolve(result);await new Promise(r=>setTimeout(r,0));assert.deepEqual(f.published,[]);assert.deepEqual(f.deleted,['capture']);}
});
test('native cancellation remains an explicit cancelled outcome',async()=>{const f=flow({classifyPhoto:async()=>({...result,available:false,matched:false,outcome:'cancelled',matchedLabels:[]})});assert.equal(await runChallengePhotoCapture(f.options),'cancelled');assert.equal((f.published[0] as any).outcome,'cancelled');});

test('unwritable ownership admission refuses camera before permission and preserves session proof', async () => {
 const f = flow({ preparePhotoCapture: async () => false,
   requestPermission: async () => { throw Error('storage rejection must precede permission'); },
   launchCamera: async () => { throw Error('storage rejection must precede camera'); } });
 assert.equal(await runChallengePhotoCapture(f.options), 'unavailable');
 assert.deepEqual(f.published, []);
 assert.deepEqual(f.deleted, []);
});
