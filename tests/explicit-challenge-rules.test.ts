import assert from 'node:assert/strict';
import test from 'node:test';
import { getChallengeVerificationRequirement, isChallengeVerificationSatisfied } from '../src/lib/challenge-verification';
import { selectCapableChallengeSet, getChallengeCapability, type ChallengeCapabilities } from '../src/lib/challenge-capability';
import { createChallengeSessionController } from '../src/lib/challenge-session';
import type { RecoveryChallenge } from '../src/lib/recovery-engine';
import { createCustomRecoveryChallenge, createDefaultRecoveryState, hydrateRecoveryState } from '../src/lib/recovery-state';

const base: RecoveryChallenge = { id: 'reviewed-flower', title: 'Find a flower', category: 'reset', durationSec: 30, intensity: 'calm', premium: false, icon: 'Camera', why: 'Notice something nearby.', steps: ['Find a flower.', 'Take a fresh photo.'] };
const photo = { ...base, verification: { version: 1, kind: 'photo', targetId: 'flower' } } as RecoveryChallenge;
const granted = { available: true, permission: 'granted' as const, canAskAgain: true };
const capabilities: ChallengeCapabilities = { photo: granted, motion: granted, steps: granted, location: granted, connection: granted };

test('localized wording cannot change an explicitly declared camera requirement', () => {
  const localized = { ...photo, title: '花を見つける', steps: ['近くの花を探します。', '新しい写真を撮ります。'] };
  const rule = getChallengeVerificationRequirement(localized);
  assert.equal(rule.kind, 'photo');
  assert.deepEqual(rule.expectedPhotoLabels, ['flower', 'blossom']);
});

test('generic plant labels cannot complete an explicitly requested flower', () => {
  const rule = getChallengeVerificationRequirement(photo);
  assert.equal(isChallengeVerificationSatisfied(rule, { elapsedSec: 30, photoMatched: true, photoLabels: ['plant'], photoConfidence: .99 }), false);
  assert.equal(isChallengeVerificationSatisfied(rule, { elapsedSec: 30, photoMatched: true, photoLabels: ['flowerpot'], photoConfidence: .99 }), false);
  assert.equal(isChallengeVerificationSatisfied(rule, { elapsedSec: 30, photoMatched: true, photoLabels: ['flower'], photoConfidence: .85 }), true);
});

test('unversioned legacy wording never turns unknown verification into a timer success', () => {
  const legacy = { ...base, title: 'Take a photo of salt', steps: ['Find salt.', 'Take a photo.'] };
  const rule = getChallengeVerificationRequirement(legacy);
  assert.equal(rule.kind, 'unavailable');
  assert.equal(isChallengeVerificationSatisfied(rule, { elapsedSec: 999 }), false);
  assert.equal(getChallengeCapability(legacy, capabilities).eligible, false);
});

test('unknown rule versions and unreviewed camera target identifiers fail closed', () => {
  for (const verification of [{ version: 99, kind: 'timer' }, { version: 1, kind: 'photo', targetId: 'salt' }]) {
    const rule = getChallengeVerificationRequirement({ ...base, verification } as RecoveryChallenge);
    assert.equal(rule.kind, 'unavailable');
    assert.equal(isChallengeVerificationSatisfied(rule, { elapsedSec: 999, photoMatched: true, photoLabels: ['salt'], photoConfidence: 1 }), false);
  }
});

test('capability filtering preserves rule metadata consumed by a later session', () => {
  const timed = { ...base, id: 'reviewed-timer', verification: { version: 1, kind: 'timer' } } as RecoveryChallenge;
  const selected = selectCapableChallengeSet([timed], capabilities, { premium: false });
  assert.deepEqual((selected[0] as any).verification, { version: 1, kind: 'timer' });
});

test('saved sessions retain their explicit rule while unknown legacy sessions need a fresh start', () => {
  const values = new Map<string,string>(); const storage = { getItem: (k:string) => values.get(k) ?? null, setItem: (k:string,v:string) => { values.set(k,v); }, removeItem: (k:string) => { values.delete(k); } };
  const make = () => createChallengeSessionController({ ownerId: 'owner-a', storage, createId: () => 'session-a', wallNow: () => 1000, monotonicNow: () => 10 });
  const initial = make(); initial.hydrate(); initial.start(photo);
  const resumed = make(); const snapshot = resumed.hydrate();
  assert.equal(getChallengeVerificationRequirement(snapshot.session!.challenge).kind, 'photo');
  const raw = JSON.parse([...values.values()][0]); delete raw.session.challenge.verification;
  storage.setItem('freed.challenge.session.v1', JSON.stringify(raw));
  assert.equal(make().hydrate().session, null);
});

test('new custom actions explicitly record timed self-confirmation and retain that rule through history restoration',()=>{
 const custom=createCustomRecoveryChallenge({title:'A quiet pause',category:'reflection',durationSec:60,intensity:'calm',steps:['Sit quietly.','Notice your surroundings.'],why:'A pause.'});
 assert.equal(getChallengeVerificationRequirement(custom).kind,'timer');
 const restored=hydrateRecoveryState({...createDefaultRecoveryState(),customChallenges:[custom]});
 assert.equal(getChallengeVerificationRequirement(restored.customChallenges[0]).kind,'timer');
});

test('a read snapshot cannot mutate the verification rule owned by a running session',()=>{
 const values=new Map<string,string>();const c=createChallengeSessionController({ownerId:'owner',storage:{getItem:k=>values.get(k)??null,setItem:(k,v)=>{values.set(k,v);},removeItem:k=>{values.delete(k);}},wallNow:()=>1000,monotonicNow:()=>0,createId:()=> 'session'});
 c.hydrate();c.start(photo);const exposed=c.read().session!.challenge;
 (exposed.verification as any).kind='timer';
 assert.equal(getChallengeVerificationRequirement(c.read().session!.challenge).kind,'photo');
});
