import {withNativeAccountFixture,acknowledgeNativeFixture,fixtureActionScope} from './helpers/acknowledged-native-fixture';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

const { buildSync } = createRequire(resolve('package.json'))('esbuild') as typeof import('esbuild');
async function bridge(native: unknown, platform = 'ios') {
  const code = buildSync({ entryPoints: ['modules/freed-protection/src/index.ts'], bundle: true, platform: 'node', format: 'cjs', write: false, external: ['expo-modules-core', 'react-native'] }).outputFiles[0].text;
  const sandbox = { module: { exports: {} as any }, setTimeout, clearTimeout, require: (name: string) => name === 'react-native' ? { Platform: { OS: platform } } : { requireNativeModule: () => withNativeAccountFixture(native) } };
  vm.runInNewContext(code, sandbox);
  return acknowledgeNativeFixture(sandbox.module.exports);
}
const ownerScope = fixtureActionScope;
const offerRequest = { version: 2, policyVersion: 2, nativeInterventionId: 'a2b4053a-a9e0-4209-9bba-6a6e0fb270ba', groupId: 'focus', groupRevision: 2, configurationGeneration: 1, scopeEpoch: 2, kind: 'ios-app-group', tokenType: 'application', requestedSeconds: 300 };
const budget = { version: 2, configuredCapMinutes: 20, effectiveCapMinutes: 20, spentSeconds: 0, remainingSeconds: 1200, dayKey: '2026-10-08', nextResetAt: '2026-10-09T00:00:00Z', pendingCapMinutes: null, pendingEffectiveAt: null, revision: 0, clockState: 'verified' };
const offer = { offerId: 'b2b4053a-a9e0-4209-9bba-6a6e0fb270ba', nativeInterventionId: offerRequest.nativeInterventionId, groupId: 'focus', groupRevision: 2, configurationGeneration: 1, scopeEpoch: 2, kind: 'ios-app-group', requestedSeconds: 300, budgetDay: '2026-10-08', budgetRevision: 0, validUntil: '2026-10-08T10:20:00Z', availableMethods: ['timer'], requiredActiveSeconds: 60, requiredSteps: 30, requiredDistinctPhotoTargets: 1 };
const offerReceipt = { version: 2, policyVersion: 2, supported: true, accepted: true, reason: null, offer, budget };
const grantRequest = { version: 2, policyVersion: 2, offerId: offer.offerId, completionSessionId: 'session-1', category: 'breathe', templateId: 'momentum-breathe-soft:earned-v2:300', templateVersion: 2, evidence: { method: 'timer', activeDurationSec: 60, observedSteps: 0, photoProofIds: [] } };
const grantReceipt = { version: 2, policyVersion: 2, supported: true, accepted: true, reason: null, offerId: offer.offerId, completionSessionId: 'session-1', groupId: 'focus', nativeInterventionId: offer.nativeInterventionId, seconds: 300, expiresAt: '2026-10-08T10:05:00Z', effective: true, remainingRestrictionCount: 0, replayed: false, budget: { ...budget, spentSeconds: 300, remainingSeconds: 900, revision: 1 } };

test('old binary returns explicit unavailable offers and grants without invoking v1 or generic unlock', async () => {
  let fallback = 0;
  const api = await bridge({ grantResetAppGroupBreak: () => { fallback++; }, applyEarnedUnlockWindow: () => { fallback++; }, getStatus: () => { fallback++; } });
  assert.equal(typeof api.prepareEarnedAppTimeOffer, 'function', 'v2 old-binary fallback is absent');
  assert.equal((await api.prepareEarnedAppTimeOffer(offerRequest, ownerScope)).accepted, false);
  assert.equal((await api.grantEarnedAppTimeBreak(grantRequest, ownerScope, offer)).accepted, false);
  assert.equal(fallback, 0);
});
test('offer bridge forwards the exact owner-bound claim and retains the native deadline', async () => {
  const calls: unknown[][] = [];
  const api = await bridge({ prepareEarnedAppTimeOffer: async (...args: unknown[]) => { calls.push(args); return offerReceipt; } });
  assert.equal(JSON.stringify(await api.prepareEarnedAppTimeOffer(offerRequest, ownerScope)), JSON.stringify(offerReceipt));
  assert.deepEqual(calls, [[offerRequest, ownerScope]]);
});
test('malformed offer input is rejected before touching native authority', async () => {
  let calls = 0;
  const api = await bridge({ prepareEarnedAppTimeOffer: async () => { calls++; return offerReceipt; } });
  for (const bad of [null, { ...offerRequest, requestedSeconds: 120 }, { ...offerRequest, seconds: 600 }, { ...offerRequest, token: 'client-supplied' }, { ...offerRequest, groupRevision: 0 }, { ...offerRequest, scopeEpoch: -1 }]) {
    assert.equal((await api.prepareEarnedAppTimeOffer(bad, ownerScope)).accepted, false);
  }
  assert.equal((await api.prepareEarnedAppTimeOffer(offerRequest, '')).accepted, false);
  assert.equal(calls, 0);
});
test('offer receipts cannot change the duration, owner configuration fence, requirements or cap accounting', async () => {
  for (const bad of [
    { ...offerReceipt, offer: { ...offer, requestedSeconds: 600 } },
    { ...offerReceipt, offer: { ...offer, scopeEpoch: 3 } },
    { ...offerReceipt, offer: { ...offer, configurationGeneration: 2 } },
    { ...offerReceipt, offer: { ...offer, requiredActiveSeconds: 1 } },
    { ...offerReceipt, budget: { ...budget, remainingSeconds: 9999 } },
    { ...offerReceipt, offer: { ...offer, validUntil: 'tomorrow' } },
  ]) {
    const api = await bridge({ prepareEarnedAppTimeOffer: async () => bad });
    assert.equal((await api.prepareEarnedAppTimeOffer(offerRequest, ownerScope)).accepted, false);
  }
});
test('grant bridge binds the saved offer, forwards no expiry or duration override, and returns native replay deadlines', async () => {
  const calls: unknown[][] = [];
  const api = await bridge({ grantEarnedAppTimeBreak: async (...args: unknown[]) => { calls.push(args); return { ...grantReceipt, replayed: calls.length > 1 }; } });
  const first = await api.grantEarnedAppTimeBreak(grantRequest, ownerScope, offer);
  const retry = await api.grantEarnedAppTimeBreak(grantRequest, ownerScope, offer);
  assert.equal(first.accepted, true);
  assert.equal(first.expiresAt, '2026-10-08T10:05:00Z');
  assert.equal(retry.expiresAt, first.expiresAt);
  assert.equal(retry.replayed, true);
  assert.deepEqual(calls, [[grantRequest, ownerScope], [grantRequest, ownerScope]]);
});
test('grant receipt cannot replace the original target, chosen duration or completion', async () => {
  for (const bad of [
    { ...grantReceipt, seconds: 600 }, { ...grantReceipt, groupId: 'other' },
    { ...grantReceipt, nativeInterventionId: 'c2b4053a-a9e0-4209-9bba-6a6e0fb270ba' },
    { ...grantReceipt, completionSessionId: 'other' }, { ...grantReceipt, expiresAt: 'bad' },
    { ...grantReceipt, effective: false }, { ...grantReceipt, budget: null },
  ]) {
    const api = await bridge({ grantEarnedAppTimeBreak: async () => bad });
    assert.equal((await api.grantEarnedAppTimeBreak(grantRequest, ownerScope, offer)).accepted, false);
  }
});
test('invalid original offer binding and duration-template mismatches never reach a native grant', async () => {
  let calls = 0;
  const api = await bridge({ grantEarnedAppTimeBreak: async () => { calls++; return grantReceipt; } });
  for (const original of [null, { offerId: offer.offerId }, { ...offer, requiredActiveSeconds: 1 }, { ...offer, requestedSeconds: 600, requiredActiveSeconds: 120, requiredSteps: 60, requiredDistinctPhotoTargets: 2 }]) {
    assert.equal((await api.grantEarnedAppTimeBreak(grantRequest, ownerScope, original)).accepted, false);
  }
  assert.equal(calls, 0);
});
test('client step counts cannot enable a method omitted from the native offer', async () => {
  let calls = 0;
  const api = await bridge({ grantEarnedAppTimeBreak: async () => { calls++; return grantReceipt; } });
  const steps = { ...grantRequest, category: 'move', templateId: 'momentum-move-steps:earned-v2:300', evidence: { method: 'steps', activeDurationSec: 0, observedSteps: 9999, photoProofIds: [] } };
  assert.equal((await api.grantEarnedAppTimeBreak(steps, ownerScope, offer)).accepted, false);
  assert.equal(calls, 0);
});
test('an overlap activated after grant is returned as committed but unavailable app access', async () => {
  const api = await bridge({ grantEarnedAppTimeBreak: async () => ({ ...grantReceipt, effective: false, remainingRestrictionCount: 1, replayed: true }) });
  const receipt = await api.grantEarnedAppTimeBreak(grantRequest, ownerScope, offer);
  assert.equal(receipt.accepted, true);
  assert.equal(receipt.effective, false);
  assert.equal(receipt.remainingRestrictionCount, 1);
  assert.equal(receipt.expiresAt, '2026-10-08T10:05:00Z');
  assert.equal(receipt.budget.spentSeconds, 300);
});
test('native exceptions produce rejected receipts without exposing error messages', async () => {
  const api = await bridge({ prepareEarnedAppTimeOffer: async () => { throw new Error('private account data'); }, grantEarnedAppTimeBreak: async () => { throw new Error('private account data'); } });
  for (const receipt of [await api.prepareEarnedAppTimeOffer(offerRequest, ownerScope), await api.grantEarnedAppTimeBreak(grantRequest, ownerScope, offer)]) {
    assert.equal(receipt.accepted, false);
    assert.equal(JSON.stringify(receipt).includes('private account'), false);
  }
});
test('v2 cap-only update requires a native budget acknowledgement and can retain the group revision', async () => {
  const snapshot = JSON.parse(readFileSync(resolve('tests/fixtures/native-android-app-groups-snapshot.json'), 'utf8'));
  const group = snapshot.groups[0];
  const update = { version: 2, expectedStoreRevision: 2, id: group.id, expectedRevision: group.revision, name: group.name, enabled: group.enabled, rule: group.rule, packages: group.packages, extraTimeCapMinutes: 5 };
  const nextBudget = { ...budget, configuredCapMinutes: 5, effectiveCapMinutes: 5, remainingSeconds: 300, revision: 1 };
  const calls: unknown[][] = [];
  const api = await bridge({ updateAppGroupWithEarnedTime: async (...args: unknown[]) => { calls.push(args); return { accepted: true, reason: null, snapshot: { ...snapshot, groups: [{ ...group, extraTimeBudget: nextBudget }] } }; } }, 'android');
  const result = await api.updateAppGroupWithEarnedTime(update, ownerScope);
  assert.equal(result.accepted, true);
  assert.equal(result.snapshot.groups[0].revision, group.revision);
  assert.equal(result.snapshot.groups[0].extraTimeBudget.remainingSeconds, 300);
  assert.deepEqual(calls, [[update, ownerScope]]);
  for (const malformed of [undefined, { ...nextBudget, remainingSeconds: 9999 }, { ...nextBudget, configuredCapMinutes: 20 }]) {
    const bad = await bridge({ updateAppGroupWithEarnedTime: async () => ({ accepted: true, reason: null, snapshot: { ...snapshot, groups: [{ ...group, extraTimeBudget: malformed }] } }) }, 'android');
    assert.equal((await bad.updateAppGroupWithEarnedTime(update, ownerScope)).accepted, false);
  }
});
test('invalid cap and older binary never call the v1 group update', async () => {
  let fallback = 0, nativeCalls = 0;
  const update = { version: 2, expectedStoreRevision: 1, id: 'focus', expectedRevision: 2, name: 'Focus', enabled: false, rule: { kind: 'daily-limit', limitMinutes: 30 }, packages: [], extraTimeCapMinutes: 20 };
  const old = await bridge({ updateAppGroup: async () => { fallback++; } });
  assert.equal((await old.updateAppGroupWithEarnedTime(update, ownerScope)).accepted, false);
  const api = await bridge({ updateAppGroupWithEarnedTime: async () => { nativeCalls++; } });
  for (const bad of [{ ...update, extraTimeCapMinutes: 15 }, { ...update, version: 1 }, { ...update, extra: true }]) assert.equal((await api.updateAppGroupWithEarnedTime(bad, ownerScope)).accepted, false);
  assert.equal(fallback, 0);
  assert.equal(nativeCalls, 0);
});
test('a saved preferred window requires the same native readback without changing active authority',async()=>{
 const snapshot=JSON.parse(readFileSync(resolve('tests/fixtures/native-android-app-groups-snapshot.json'),'utf8'));
 const group=snapshot.groups[0];snapshot.revision++;
 snapshot.supportedBreakSeconds=[300,600,1200];
 const update={version:2,expectedStoreRevision:snapshot.revision-1,id:group.id,expectedRevision:group.revision,name:group.name,enabled:group.enabled,rule:group.rule,packages:group.packages,extraTimeCapMinutes:20,preferredBreakSeconds:1200};
 const nextBudget={...budget,spentSeconds:300,remainingSeconds:900,revision:1};
 for(const preferredBreakSeconds of [undefined,300,1200]){
  const api=await bridge({updateAppGroupWithEarnedTime:async()=>({accepted:true,reason:null,snapshot:{...snapshot,groups:[{...group,preferredBreakSeconds,extraTimeBudget:nextBudget}]}})},'android');
  const result=await api.updateAppGroupWithEarnedTime(update,ownerScope);
  assert.equal(result.accepted,preferredBreakSeconds===1200,'native acknowledgement must confirm the saved window');
  if(result.accepted){assert.equal(result.snapshot.groups[0].revision,group.revision);assert.equal(result.snapshot.groups[0].extraTimeBudget.spentSeconds,300);}
 }
});
test('cold-start readback cannot fall back to a mutating grant and validates exact original receipt',async()=>{
 let grants=0,reads=0;
 const old=await bridge({grantEarnedAppTimeBreak:async()=>{grants++;return grantReceipt;}});
 assert.equal((await old.getEarnedAppTimeGrant(grantRequest,ownerScope,offer)).accepted,false);assert.equal(grants,0);
 const api=await bridge({getEarnedAppTimeGrant:async()=>{reads++;return {...grantReceipt,replayed:true};},grantEarnedAppTimeBreak:async()=>{grants++;return grantReceipt;}});
 const result=await api.getEarnedAppTimeGrant(grantRequest,ownerScope,offer);assert.equal(result.accepted,true);assert.equal(result.expiresAt,grantReceipt.expiresAt);assert.equal(reads,1);assert.equal(grants,0);
 assert.equal((await api.getEarnedAppTimeGrant({...grantRequest,offerId:'invalid'},ownerScope,offer)).accepted,false);assert.equal(reads,1);assert.equal(grants,0);
});
