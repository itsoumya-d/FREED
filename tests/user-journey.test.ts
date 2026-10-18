import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createAccountFlowFence, createAuthSnapshotObserver, createOfferDecisionStore, guardJourneyRoute, getJourneyDestination, sanitizeJourneyMetadata, type JourneyAuthSnapshot } from '../src/lib/user-journey';
import { createDefaultRecoveryState, hydrateRecoveryState, recordDailyCheckIn } from '../src/lib/recovery-state';
const ready = (ownerUid: string | null = null, anonymous = false): JourneyAuthSnapshot => ({ status: 'ready', signedIn: ownerUid !== null, anonymous, ownerUid, email: null });
const journey = { entry: 'new' as const, introCompletedAt: '2026-10-05T00:00:00.000Z' };
const input = (auth = ready(), metadata = journey) => ({ auth, journey: metadata, offerAcknowledged: false, verifiedPremium: false });
test('fresh flow and existing account branch have different entry destinations', () => {
  assert.equal(getJourneyDestination(input(ready(), { entry: 'new', introCompletedAt: null })), 'welcome');
  assert.equal(getJourneyDestination(input(ready(), { entry: 'existing', introCompletedAt: null })), 'account');
  assert.equal(getJourneyDestination(input()), 'account');
});
test('restored real owner including null-email Apple owner reaches owner offer', () => {
  assert.equal(getJourneyDestination(input(ready('apple-owner'))), 'paywall');
  assert.equal(getJourneyDestination({ ...input(ready('owner')), verifiedPremium: true }), 'main');
});
test('anonymous or legacy skipped account cannot expose protected routes or use saved email', () => {
  for (const auth of [ready(), ready('guest', true)]) {
    assert.equal(guardJourneyRoute('main', input(auth)), 'account');
    assert.equal(guardJourneyRoute('protectionSetup', input(auth)), 'account');
    assert.equal(guardJourneyRoute('paywall', input(auth)), 'account');
  }
  assert.equal(guardJourneyRoute('account', input(ready(), { entry: 'new', introCompletedAt: null })), 'welcome');
});
test('sign-out/deep-link and deferred hydration gate every protected route', () => {
  assert.equal(guardJourneyRoute('challenge', input(ready('owner'))), 'paywall');
  assert.equal(guardJourneyRoute('journal', { ...input(), auth: { ...ready(), status: 'hydrating' } }), 'splash');
  assert.equal(guardJourneyRoute('main', { ...input(), auth: { ...ready(), status: 'unavailable' } }), 'account');
  assert.equal(guardJourneyRoute('coach', { ...input(ready('owner')), offerAcknowledged: true }), 'coach');
});
test('offer decisions are versioned, owner-scoped, synchronous and survive failed remote service', async () => {
  const saved = new Map<string, string>();
  const storage = { getItem: (key: string) => saved.get(key) ?? null, setItem: (key: string, value: string) => { saved.set(key, value); } };
  const store = createOfferDecisionStore(storage, { read: async () => { throw Error('offline'); }, write: async () => { throw Error('offline'); } });
  assert.equal(store.acknowledge('owner-a', 'free').saved, true);
  assert.equal(store.has('owner-a'), true);
  assert.equal(store.has('owner-b'), false);
  assert.equal(createOfferDecisionStore(storage).has('owner-a'), true);
  assert.equal((await store.sync('owner-a')).status, 'retryable');
  assert.equal(store.has('owner-a'), true);
  assert.equal(store.acknowledge('guest', 'purchase-cancelled' as never).saved, false);
  assert.equal(store.has('guest'), false);
});
test('failed local save retains free continuation in-session and reports retryable durability', () => {
  const store = createOfferDecisionStore({ getItem: () => null, setItem: () => { throw Error('disk'); } });
  assert.equal(store.acknowledge('owner-a', 'free').saved, false);
  assert.equal(store.has('owner-a'), true);
  assert.equal(store.has('owner-b'), false);
});
test('stale deferred auth callbacks cannot hydrate a stopped or superseded observer', () => {
  const callbacks: Array<(snapshot: JourneyAuthSnapshot) => void> = [];
  const observer = createAuthSnapshotObserver(callback => { callbacks.push(callback); return () => {}; }, 1000);
  const stop = observer.subscribe(() => {});
  stop();
  const stop2 = observer.subscribe(() => {});
  callbacks[0](ready('stale'));
  assert.equal(observer.getSnapshot().status, 'hydrating');
  callbacks[1](ready('current'));
  assert.equal(observer.getSnapshot().ownerUid, 'current');
  stop2();
});
test('auth timeout is actionable and retry accepts only the new listener', async () => {
  const callbacks: Array<(snapshot: JourneyAuthSnapshot) => void> = [];
  const observer = createAuthSnapshotObserver(callback => { callbacks.push(callback); return () => {}; }, 5);
  const stop = observer.subscribe(() => {});
  await new Promise(resolve => setTimeout(resolve, 15));
  assert.equal(observer.getSnapshot().status, 'unavailable');
  observer.retry();
  callbacks[0](ready('stale'));
  assert.equal(observer.getSnapshot().status, 'hydrating');
  callbacks[1](ready('restored'));
  assert.equal(observer.getSnapshot().ownerUid, 'restored');
  stop();
});
test('additive metadata preserves all five answers and legacy history through hydration', () => {
  const state = recordDailyCheckIn(createDefaultRecoveryState(), { mood: "steady", urgeLevel: 2, sleepQuality: 4, reflection: "Keep history" }, "2026-10-04T12:00:00.000Z");
  const retained = hydrateRecoveryState({ ...state, answers: ['a', 'b', 'c', 'd', 'e'], accountSkippedAt: '2026-10-04T00:00:00.000Z', signedInEmail: 'old@example.com', journey, pledges: [{ dateKey: '2026-10-04', createdAt: '2026-10-04T00:00:00.000Z' }] });
  assert.deepEqual(retained.answers, ['a', 'b', 'c', 'd', 'e']);
  assert.deepEqual(retained.journey, journey);
  assert.deepEqual(retained.checkIns, state.checkIns);
  assert.deepEqual(retained.pledges, [{ dateKey: '2026-10-04', createdAt: '2026-10-04T00:00:00.000Z' }]);
  assert.equal(retained.accountSkippedAt, '2026-10-04T00:00:00.000Z');
  assert.equal(retained.signedInEmail, 'old@example.com');
  assert.deepEqual(sanitizeJourneyMetadata({ entry: 'new', introCompletedAt: 'bad' }), { entry: 'new', introCompletedAt: null });
});
test('stale remote read cannot overwrite a newer explicit Free decision', async () => {
  let resolve!: (value: unknown) => void;
  let stored: string | null = null;
  const store = createOfferDecisionStore({ getItem: () => stored, setItem: (_key, value) => { stored = value; } }, { read: () => new Promise(done => { resolve = done; }), write: async () => {} });
  const pending = store.sync('owner');
  store.acknowledge('owner', 'free');
  const explicit = stored;
  resolve({ version: 1, decision: 'verified-membership', decidedAt: '2026-10-04T00:00:00.000Z' });
  await pending;
  assert.equal(stored, explicit);
});
test('failed local save is retried without depending on remote availability', async () => {
  let available = false; let stored: string | null = null;
  const store = createOfferDecisionStore({ getItem: () => stored, setItem: (_key, value) => { if (!available) throw Error('disk'); stored = value; } });
  store.acknowledge('owner', 'free');
  available = true;
  await store.sync('owner');
  assert.notEqual(stored, null);
});
import { createFirebaseCallableContracts } from '../src/lib/firebase-client';
test('journey callable contract rejects private/extra input and malformed response before recording acknowledgement', async () => {
  const sent: unknown[] = [];
  let response: unknown = { offerVersion: 1, acknowledged: true };
  const contracts = createFirebaseCallableContracts({ call: async (name, data) => { sent.push([name, data]); return response; } });
  assert.deepEqual(await contracts.getJourneyOfferState(), { offerVersion: 1, acknowledged: true });
  const request = { offerVersion: 1 as const, decision: 'free' as const, eventId: `journey_${'a'.repeat(32)}` };
  await contracts.acknowledgeJourneyOffer(request);
  const count = sent.length;
  await assert.rejects(() => contracts.getJourneyOfferState({ answers: [] } as never));
  await assert.rejects(() => contracts.acknowledgeJourneyOffer({ ...request, ownerUid: 'wrong' } as never));
  await assert.rejects(() => contracts.acknowledgeJourneyOffer({ ...request, eventId: 'journey_bad' }));
  assert.equal(sent.length, count);
  response = { offerVersion: 1, acknowledged: true, premium: true };
  await assert.rejects(() => contracts.getJourneyOfferState());
  response = { offerVersion: 2, acknowledged: true };
  await assert.rejects(() => contracts.acknowledgeJourneyOffer(request));
});
import { createFirebaseJourneyMetadataAdapter } from '../src/lib/user-journey';
test('owner change during remote metadata read cannot record a former account decision', async () => {
  let owner: string | null = 'owner-a';
  let resolve!: (value: { offerVersion: 1; acknowledged: boolean }) => void;
  const adapter = createFirebaseJourneyMetadataAdapter({ currentOwner: () => owner, createEventId: () => `journey_${'a'.repeat(32)}`, getContracts: async () => ({ getJourneyOfferState: () => new Promise(done => { resolve = done; }), acknowledgeJourneyOffer: async () => ({ offerVersion: 1, acknowledged: true }) }) });
  const saved = new Map<string, string>();
  const store = createOfferDecisionStore({ getItem: key => saved.get(key) ?? null, setItem: (key, value) => { saved.set(key, value); } }, adapter);
  const pending = store.sync('owner-a');
  await Promise.resolve(); owner = 'owner-b';
  resolve({ offerVersion: 1, acknowledged: true });
  assert.equal((await pending).status, 'retryable');
  assert.equal(store.has('owner-a'), false);
  assert.equal(store.has('owner-b'), false);
});
test('bounded remote timeout cannot mutate an offer cache after free continuation', async () => {
  let resolve!: (value: unknown) => void;
  const store = createOfferDecisionStore({ getItem: () => null, setItem: () => {} }, { read: () => new Promise(done => { resolve = done; }), write: async () => {} }, 5);
  assert.equal((await store.sync('owner')).status, 'retryable');
  resolve({ version: 1, decision: 'verified-membership', decidedAt: '2026-10-05T00:00:00.000Z' });
  await Promise.resolve(); await Promise.resolve();
  assert.equal(store.has('owner'), false);
});
test('real Firebase custom UID is retained without inventing a second identity format', () => {
  assert.equal(getJourneyDestination(input(ready('owner:custom'))), 'paywall');
  const saved = new Map<string, string>();
  const store = createOfferDecisionStore({ getItem: key => saved.get(key) ?? null, setItem: (key, value) => { saved.set(key, value); } });
  assert.equal(store.acknowledge('owner:custom', 'free').saved, true);
  assert.equal(store.has('owner:custom'), true);
});
test('remote rejection preserves failed and successful local persistence results', async () => {
  for (const localWorks of [false, true]) {
    const store = createOfferDecisionStore({ getItem: () => null, setItem: () => { if (!localWorks) throw Error('quota'); } }, { read: async () => null, write: async () => { throw Error('offline'); } });
    store.acknowledge('owner', 'free');
    assert.deepEqual(await store.sync('owner'), { status: 'retryable', saved: localWorks });
  }
});
test('remote timeout preserves failed local persistence result', async () => {
  const store = createOfferDecisionStore({ getItem: () => null, setItem: () => { throw Error('quota'); } }, { read: async () => null, write: () => new Promise(() => {}) }, 5);
  store.acknowledge('owner', 'free');
  assert.deepEqual(await store.sync('owner'), { status: 'retryable', saved: false });
});

test('active account fence preserves account UI during hydration without granting protected access', () => {
  const fence = createAccountFlowFence(); const control = fence.begin();
  const policy = { ...input(ready('owner')), auth: { ...ready('owner'), status: 'hydrating' as const } };
  assert.equal(guardJourneyRoute('account', policy, fence.isActive()), 'account');
  assert.equal(guardJourneyRoute('main', policy, fence.isActive()), 'account');
  assert.equal(control.complete(), true);
  assert.equal(guardJourneyRoute('main', policy, fence.isActive()), 'splash');
});
test('a stale continuation cannot release a newly entered account flow', () => {
  const fence = createAccountFlowFence(); const first = fence.begin();
  assert.equal(first.complete(), true);
  const current = fence.begin();
  assert.equal(first.isCurrent(), false); assert.equal(first.complete(), false);
  assert.equal(fence.isActive(), true); assert.equal(current.isCurrent(), true);
  assert.equal(current.complete(), true); assert.equal(current.complete(), false);
});
