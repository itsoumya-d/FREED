import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createRecoveryDnsEnrollment, type RecoveryDnsEnrollmentConsent, type RecoveryDnsPendingEnrollment } from '../src/lib/recovery-dns-enrollment';
import { createFirebaseCallableContracts, type FirebaseRecoveryDnsEnrollment, type FirebaseRecoveryDnsReceipt } from '../src/lib/firebase-client';
import { unavailableRecoveryDns, type RecoveryDnsPilotInput } from '../modules/freed-protection/src/recovery-dns-pilot';
const generation = '12345678-1234-4123-8123-123456789abc';
const consent: RecoveryDnsEnrollmentConsent = { ownerId: 'owner-a', actionScope: 'scope-a', consentVersion: '2026-10-18', dnsConsent: true, websiteAlertConsent: false, retentionAcknowledged: true };
const receipt = (request: FirebaseRecoveryDnsEnrollment): FirebaseRecoveryDnsReceipt => ({ status: 'enrolled', installationId: request.installationId, ownerGeneration: generation, audience: request.audience, endpointHost: 'freedrecovery.web.app', credentialHash: request.credentialHash });
function fixture() {
  let owner: {ownerId:string;actionScope:string}|null = { ownerId: 'owner-a', actionScope: 'scope-a' };
  let stored: unknown = null, failSave = false, failEnroll = false, failStage = false;
  let calls = 0, randomCalls = 0;
  const requests: FirebaseRecoveryDnsEnrollment[] = [], stages: RecoveryDnsPilotInput[] = [];
  let after: ((phase: string) => void) | undefined;
  const deps = {
    currentOwner: () => owner,
    pending: { load: async (_owner: string) => { after?.('load'); return structuredClone(stored); }, save: async (_owner: string, value: RecoveryDnsPendingEnrollment) => { if (failSave) throw Error('secret-bearing storage error'); stored = structuredClone(value); after?.('save'); } },
    installationId: async () => { after?.('installation'); return 'c123456789012345678901'; },
    randomHex: async (bytes: number) => { randomCalls++; after?.('random'); return 'ab'.repeat(bytes); },
    uuid: () => generation,
    hashSecret: async (raw: string) => { after?.('hash'); return createHash('sha256').update(raw).digest('hex'); },
    enroll: async (request: FirebaseRecoveryDnsEnrollment) => { calls++; requests.push(structuredClone(request)); after?.('enroll'); if (failEnroll) throw Error('transport lost response'); return receipt(request); },
    stage: async (input: RecoveryDnsPilotInput) => { stages.push(structuredClone(input)); after?.('stage'); if (failStage) return unavailableRecoveryDns(); return { ...unavailableRecoveryDns(), kind: 'candidate' as const, supported: true, staged: true, reference: 'cd'.repeat(16), nativeConfigurationGeneration: 1, credentialHash: input.credentialHash, audience: input.audience, ownerGeneration: input.ownerGeneration }; }
  };
  return { deps, run: createRecoveryDnsEnrollment(deps), requests, stages, setOwner: (v: typeof owner) => { owner = v; }, setStored: (v: unknown) => { stored = v; }, stored: () => structuredClone(stored), calls: () => calls, randomCalls: () => randomCalls, failSave: (v:boolean) => { failSave=v; }, failEnroll: (v:boolean) => { failEnroll=v; }, failStage: (v:boolean) => { failStage=v; }, after: (v:typeof after) => { after=v; } };
}
async function run() {
  const f = fixture(); f.failEnroll(true);
  assert.deepEqual(await f.run.enroll(consent), {status:'error',reason:'enrollment-unavailable'});
  assert.ok(f.stored()); assert.equal(f.stages.length, 0);
  f.failEnroll(false); f.failStage(true);
  assert.deepEqual(await f.run.enroll(consent), {status:'error',reason:'stage-unavailable'});
  assert.deepEqual(f.requests[0], f.requests[1]); assert.equal(f.randomCalls(),2);
  f.failStage(false);
  assert.equal((await createRecoveryDnsEnrollment(f.deps).enroll(consent)).status,'staged');
  assert.equal(f.calls(),2); assert.equal(f.stages[1].ownerGeneration,generation);
  assert.equal(f.stages[0].rawSecret,f.stages[1].rawSecret);
  assert.equal(JSON.stringify(f.requests).includes('rawSecret'),false);
  assert.equal(JSON.stringify(f.requests).includes('abababababababababababababababababababababababababababababababab'),false);
  assert.deepEqual(await f.run.enroll({...consent,websiteAlertConsent:true}),{status:'error',reason:'consent-changed'});
  assert.equal(f.calls(),2);
  const save = fixture(); save.failSave(true);
  assert.deepEqual(await save.run.enroll(consent),{status:'error',reason:'storage-unavailable'}); assert.equal(save.calls(),0);
  const invalid = fixture(); invalid.setStored({...f.stored() as object,ownerId:'owner-b'});
  assert.deepEqual(await invalid.run.enroll(consent),{status:'error',reason:'pending-invalid'}); assert.equal(invalid.calls(),0);
  const corrupt = fixture(); corrupt.setStored({...f.stored() as object,rawSecret:'cd'.repeat(32)});
  assert.deepEqual(await corrupt.run.enroll(consent),{status:'error',reason:'pending-invalid'});
  for (const phase of ['load','installation','random','hash','save','enroll','stage']) {
    const switched=fixture(); switched.after(p=>{if(p===phase)switched.setOwner({ownerId:'owner-b',actionScope:'scope-b'});});
    assert.deepEqual(await switched.run.enroll(consent),{status:'error',reason:'owner-changed'},phase);
    if (phase !== 'stage') assert.equal(switched.stages.length,0,phase);
  }
  const receiptSave=fixture(); let saves=0; receiptSave.after(p=>{if(p==='save' && ++saves===1)receiptSave.failSave(true);});
  assert.deepEqual(await receiptSave.run.enroll(consent),{status:'error',reason:'storage-unavailable'}); assert.equal(receiptSave.calls(),1); assert.equal(receiptSave.stages.length,0);
  receiptSave.failSave(false); receiptSave.after(undefined); assert.equal((await receiptSave.run.enroll(consent)).status,'staged'); assert.deepEqual(receiptSave.requests[0],receiptSave.requests[1]);
  const stageOwner=fixture(); let saveCount=0;stageOwner.after(p=>{if(p==='save' && ++saveCount===2)stageOwner.setOwner({ownerId:'owner-b',actionScope:'scope-b'});});assert.deepEqual(await stageOwner.run.enroll(consent),{status:'error',reason:'owner-changed'});assert.equal(stageOwner.stages.length,0);
  const frozenConsent=fixture(), mutableConsent={...consent};frozenConsent.after(p=>{if(p==='load')mutableConsent.websiteAlertConsent=true;});assert.equal((await frozenConsent.run.enroll(mutableConsent)).status,'staged');assert.equal(frozenConsent.requests[0].websiteAlertConsent,false);
  const noConsent=fixture(); assert.deepEqual(await noConsent.run.enroll({...consent,retentionAcknowledged:false} as never),{status:'error',reason:'consent-required'}); assert.equal(noConsent.calls(),0);
  const stale=fixture(); stale.setOwner({ownerId:'owner-a',actionScope:'new-scope'}); assert.deepEqual(await stale.run.enroll(consent),{status:'error',reason:'owner-changed'});
  // A concurrent tap cannot generate or overwrite a second durable secret.
  const concurrent=fixture(); let release!:()=>void; const wait=new Promise<void>(resolve=>{release=resolve;}); const baseLoad=concurrent.deps.pending.load; concurrent.deps.pending.load=async id=>{await wait;return baseLoad(id);}; const first=concurrent.run.enroll(consent); assert.deepEqual(await concurrent.run.enroll(consent),{status:'error',reason:'busy'}); release(); assert.equal((await first).status,'staged'); assert.equal(concurrent.calls(),1);

  let current=true, transportCalls=0; let response: unknown; const request=f.requests[0];
  const api=createFirebaseCallableContracts({call:async(name,data,options)=>{transportCalls++;assert.equal(options?.limitedUseAppCheckToken,true);assert.equal(options?.operationIsCurrent?.(),true);assert.equal('rawSecret' in (data as object),false);return response ?? (name==='enrollRecoveryDns'?receipt(data as FirebaseRecoveryDnsEnrollment):{status:'revoked',installationId:request.installationId,ownerGeneration:generation});}});
  const options={operationIsCurrent:()=>current};
  assert.equal((await api.enrollRecoveryDns(request,options)).ownerGeneration,generation);
  await assert.rejects(api.enrollRecoveryDns({...request,rawSecret:'ab'.repeat(32)} as never,options));
  await assert.rejects(api.enrollRecoveryDns({...request,websiteAlertConsent:undefined} as never,options));
  response={...receipt(request),extra:'unexpected'};await assert.rejects(api.enrollRecoveryDns(request,options));
  response={...receipt(request),ownerGeneration:'bad'};await assert.rejects(api.enrollRecoveryDns(request,options));
  response={...receipt(request),audience:'cd'.repeat(16)};await assert.rejects(api.enrollRecoveryDns(request,options));
  response=undefined;assert.equal((await api.revokeRecoveryDns({installationId:request.installationId,credentialHash:request.credentialHash,ownerGeneration:generation},options)).status,'revoked');
  await assert.rejects(api.revokeRecoveryDns({installationId:request.installationId,credentialHash:request.credentialHash,ownerGeneration:generation,rawSecret:'private'} as never,options));
  current=false; const before=transportCalls; await assert.rejects(api.enrollRecoveryDns(request,options));assert.equal(transportCalls,before);
  current=true;const switchingApi=createFirebaseCallableContracts({call:async()=>{current=false;return receipt(request);}});await assert.rejects(switchingApi.enrollRecoveryDns(request,options));
  console.log('Recovery DNS enrollment: durable retries, strict callable metadata, staging failure, consent, and owner fences passed.');
}
void run().catch(error=>{console.error(error);process.exitCode=1;});
