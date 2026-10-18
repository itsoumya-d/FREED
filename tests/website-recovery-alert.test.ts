import assert from 'node:assert/strict';
import test from 'node:test';
import { createFirebaseNotificationOpenListener } from '../src/lib/firebase-notification-flow';
import { createWebsiteRecoveryAlertInbox, parseWebsiteRecoveryAlert } from '../src/lib/website-recovery-alert';

const NOW = 1_792_300_000_000;
const AUDIENCE_A = "0123456789abcdef0123456789abcdef";
const AUDIENCE_B = "fedcba9876543210fedcba9876543210";
const id = (index = 1) => `3afc6ea2-a71c-4d98-b112-${index.toString(16).padStart(12, '0')}`;
const payload = (index = 1, expiry = NOW + 30_000) => ({ version: '1', kind: 'website-recovery', id: id(index), audience: AUDIENCE_A, expiresAt: String(expiry) });
const message = (index = 1, data: unknown = payload(index), messageId = `message-${index}`) => ({ messageId, data });
const flush = () => new Promise<void>(resolve => setImmediate(resolve));
function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>(done => { resolve = done; }); return { promise, resolve }; }
function fixture(options: { callback?: boolean; allowed?: boolean; binding?: boolean; audience?: string | null } = {}) {
  let listener: ((message: unknown) => void) | null = null;
  let audience: string | null = options.audience === undefined ? AUDIENCE_A : options.audience;
  let current = true, now = NOW, allowed = options.allowed !== false, checkIns = 0, recoveries = 0;
  const calls: string[] = [];
  const initial = deferred<unknown>();
  const permission = deferred<boolean>();
  const dependencies = {
    now: () => now,
    permissionGranted: async () => { calls.push('permission'); return permission.promise; },
    getInitialNotification: () => { calls.push('initial'); return initial.promise; },
    onNotificationOpened: (next: (message: unknown) => void) => { calls.push('subscribe'); listener = next; return () => { calls.push('unsubscribe'); }; }
  };
  const stop = createFirebaseNotificationOpenListener(dependencies, () => { checkIns += 1; }, {
    isCurrent: () => current,
    readCurrentWebsiteAudience: options.binding === false ? undefined : () => audience,
    onWebsiteRecovery: options.callback === false ? undefined : () => { recoveries += 1; }
  });
  permission.resolve(allowed);
  return { calls, initial, stop, emit: (value: unknown) => listener?.(value), checkIns: () => checkIns, recoveries: () => recoveries,
    setCurrent: (value: boolean) => { current = value; }, setAudience: (value: string | null) => { audience = value; }, setNow: (value: number) => { now = value; } };
}

test('a tapped website alert uses only the optional recovery callback and one SDK open subscription', async () => {
  const f = fixture(); await flush();
  assert.equal(f.recoveries(), 0, 'arrival without a person-open event cannot navigate');
  f.emit(message());
  f.initial.resolve(message()); await flush();
  assert.equal(f.recoveries(), 1); assert.equal(f.checkIns(), 0);
  assert.equal(f.calls.filter(call => call === 'subscribe').length, 1);
});

test('website alerts reject expired, oversized lifetime, malformed, unknown and extra fields', async () => {
  const f = fixture(); await flush();
  const invalid = [null, [], {}, { ...payload(), version: '2' }, { ...payload(), kind: 'checkin' },
    { ...payload(), id: 'not-a-uuid' }, { ...payload(), audience: undefined }, { ...payload(), audience: 'A'.repeat(32) }, { ...payload(), audience: 'owner-uid' }, { ...payload(), expiresAt: String(NOW) }, { ...payload(), expiresAt: String(NOW - 1) },
    { ...payload(), expiresAt: String(NOW + 60_001) }, { ...payload(), expiresAt: NOW + 1000 },
    { ...payload(), expiresAt: `${NOW + 1000}.0` }, { ...payload(), expiresAt: `0${NOW + 1000}` },
    { ...payload(), expiresAt: '9007199254740992' }, { ...payload(), domain: 'private.example' },
    { ...payload(), route: 'checkin' }, { ...payload(), url: 'freed://unlock' }, { ...payload(), authority: 'app-token' }];
  for (let index = 0; index < invalid.length; index += 1) f.emit(message(index + 1, invalid[index]));
  f.emit({ data: payload() }); f.emit(message(80, payload(), '')); f.emit(message(81, payload(), 'a'.repeat(201)));
  assert.equal(f.recoveries(), 0); assert.equal(f.checkIns(), 0);
  f.emit(message(90, payload(90, NOW + 60_000)));
  assert.equal(f.recoveries(), 1, 'exactly sixty seconds remaining is valid');
});

test('replays are blocked by either event identity or SDK message identity', async () => {
  const f = fixture(); await flush();
  f.emit(message(1)); f.emit(message(2, payload(1))); f.emit(message(3, payload(3), 'message-1'));
  assert.equal(f.recoveries(), 1);
  f.emit(message(4)); assert.equal(f.recoveries(), 2);
});

test('late initial responses after stop or owner readiness loss cannot navigate', async () => {
  for (const mode of ['stop', 'owner']) {
    const f = fixture(); await flush();
    if (mode === 'stop') f.stop(); else f.setCurrent(false);
    f.initial.resolve(message()); f.emit(message(2)); await flush();
    assert.equal(f.recoveries(), 0); assert.equal(f.checkIns(), 0);
    if (mode === 'stop') assert.equal(f.calls.filter(call => call === 'unsubscribe').length, 1);
  }
});

test('permission denial, absent callback and changed readiness before subscription ignore alerts', async () => {
  for (const options of [{ allowed: false }, { callback: false }]) {
    const f = fixture(options); await flush(); f.emit(message()); f.initial.resolve(message()); await flush();
    assert.equal(f.recoveries(), 0);
    if (options.allowed === false) assert.deepEqual(f.calls, ['permission']);
  }
  const f = fixture(); f.setCurrent(false); await flush();
  assert.deepEqual(f.calls, ['permission']);
});

test('initial expiry is checked when opened, and website/checkin routes coexist without accepting unknown routes', async () => {
  const f = fixture(); await flush(); f.setNow(NOW + 30_001); f.initial.resolve(message()); await flush();
  assert.equal(f.recoveries(), 0);
  f.setNow(NOW); f.emit(message(2));
  f.emit({ messageId: 'check-1', data: { route: 'checkin', kind: 'night-guard', url: 'ignored-existing-checkin-field' } });
  f.emit({ messageId: 'check-1', data: { route: 'checkin' } });
  f.emit({ messageId: 'bad-route', data: { route: 'unlock' } });
  f.emit({ messageId: 'unknown-kind', data: { ...payload(5), kind: 'other' } });
  assert.equal(f.recoveries(), 1); assert.equal(f.checkIns(), 1);
});


test('payload validation is exact and never returns arbitrary notification or authority fields', () => {
  assert.deepEqual(parseWebsiteRecoveryAlert(payload(), NOW), payload());
  assert.equal(Object.isFrozen(parseWebsiteRecoveryAlert(payload(), NOW)), true);
  const inherited = Object.create(payload());
  const withSymbol = { ...payload(), [Symbol('private')]: 'private value' };
  for (const value of [inherited, withSymbol, { ...payload(), expiresAt: '1e12' }, { ...payload(), expiresAt: '+1792300030000' }]) {
    assert.equal(parseWebsiteRecoveryAlert(value, NOW), null);
  }
  assert.equal(parseWebsiteRecoveryAlert(payload(), NaN), null);
});

test('shared inbox retains only 256 event IDs and 256 message IDs across listener replacement', async () => {
  const seenMessageIds = new Set<string>(), seenEventIds = new Set<string>();
  const inbox = createWebsiteRecoveryAlertInbox({ now: () => NOW, seenMessageIds, seenEventIds });
  for (let index = 1; index <= 300; index += 1) assert.notEqual(inbox.takeOpened(message(index), AUDIENCE_A), null);
  assert.equal(seenEventIds.size, 256); assert.equal(seenMessageIds.size, 256);
  assert.equal(seenEventIds.has(id(1)), false); assert.equal(seenEventIds.has(id(300)), true);
  const dependencies = { permissionGranted: async () => true, getInitialNotification: async () => message(300),
    onNotificationOpened: (_listener: (value: unknown) => void) => () => undefined, seenMessageIds, websiteRecoveryInbox: inbox };
  let recoveries = 0;
  const first = createFirebaseNotificationOpenListener(dependencies, () => undefined, { onWebsiteRecovery: () => { recoveries += 1; }, readCurrentWebsiteAudience: () => AUDIENCE_A });
  await flush(); first();
  const second = createFirebaseNotificationOpenListener(dependencies, () => undefined, { onWebsiteRecovery: () => { recoveries += 1; }, readCurrentWebsiteAudience: () => AUDIENCE_A });
  await flush(); second();
  assert.equal(recoveries, 0);
});

test('an absent optional callback does not consume an otherwise valid event for a later ready listener', async () => {
  const seenMessageIds = new Set<string>();
  const inbox = createWebsiteRecoveryAlertInbox({ now: () => NOW, seenMessageIds });
  const dependencies = { permissionGranted: async () => true, getInitialNotification: async () => message(),
    onNotificationOpened: (_listener: (value: unknown) => void) => () => undefined, seenMessageIds, websiteRecoveryInbox: inbox };
  const first = createFirebaseNotificationOpenListener(dependencies, () => undefined);
  await flush(); first();
  let recoveries = 0;
  const second = createFirebaseNotificationOpenListener(dependencies, () => undefined, { onWebsiteRecovery: () => { recoveries += 1; }, readCurrentWebsiteAudience: () => AUDIENCE_A });
  await flush(); second();
  assert.equal(recoveries, 1);
});

test('permission resolution after stop or owner loss cannot attach SDK listeners', async () => {
  for (const stopped of [true, false]) {
    const permission = deferred<boolean>(); let current = true, subscriptions = 0, initialReads = 0;
    const stop = createFirebaseNotificationOpenListener({ permissionGranted: () => permission.promise,
      getInitialNotification: async () => { initialReads += 1; return message(); },
      onNotificationOpened: () => { subscriptions += 1; return () => undefined; } }, () => undefined,
      { isCurrent: () => current, onWebsiteRecovery: () => assert.fail('stale callback') });
    if (stopped) stop(); else current = false;
    permission.resolve(true); await flush();
    assert.equal(subscriptions, 0); assert.equal(initialReads, 0);
  }
});


test('provider-accepted alerts for a previous enrollment audience cannot route a new owner', async () => {
  const f = fixture({ audience: AUDIENCE_B }); await flush();
  f.emit(message(1));
  f.initial.resolve(message(2)); await flush();
  assert.equal(f.recoveries(), 0);
  f.emit(message(3, { ...payload(3), audience: AUDIENCE_B }));
  assert.equal(f.recoveries(), 1);
});

test('changing the active audience invalidates an awaited initial result and the old listener', async () => {
  const f = fixture(); await flush();
  f.setAudience(AUDIENCE_B);
  f.initial.resolve(message()); await flush();
  f.emit(message(2));
  f.emit(message(3, { ...payload(3), audience: AUDIENCE_B }));
  assert.equal(f.recoveries(), 0, 'a new enrollment requires a fresh listener binding');
  f.emit({ messageId: 'unchanged-checkin', data: { route: 'checkin', kind: 'night-guard' } });
  assert.equal(f.checkIns(), 1, 'legacy reminder routing is independent of website enrollment');
});

test('website entry fails closed without a current enrollment audience', async () => {
  for (const options of [{ binding: false }, { audience: null }, { audience: '' }, { audience: 'A'.repeat(32) }]) {
    const f = fixture(options); await flush(); f.emit(message()); f.initial.resolve(message(2)); await flush();
    assert.equal(f.recoveries(), 0);
    f.emit({ messageId: 'checkin-without-enrollment', data: { route: 'checkin' } });
    assert.equal(f.checkIns(), 1);
  }
});

test('audience binding is rechecked after permission and immediately before recovery callback', async () => {
  const permission = deferred<boolean>(); let audience: string | null = AUDIENCE_A, opened: ((value: unknown) => void) | null = null;
  let recoveries = 0;
  const stop = createFirebaseNotificationOpenListener({ permissionGranted: () => permission.promise,
    getInitialNotification: async () => message(), onNotificationOpened: next => { opened = next; return () => undefined; }, now: () => NOW }, () => undefined,
    { onWebsiteRecovery: () => { recoveries += 1; }, readCurrentWebsiteAudience: () => audience });
  audience = AUDIENCE_B; permission.resolve(true); await flush();
  assert.equal(recoveries, 0); stop();
  audience = AUDIENCE_A;
  const realInbox = createWebsiteRecoveryAlertInbox({ now: () => NOW });
  const stopSecond = createFirebaseNotificationOpenListener({ permissionGranted: async () => true,
    getInitialNotification: async () => null, onNotificationOpened: next => { opened = next; return () => undefined; },
    websiteRecoveryInbox: { takeOpened: (value, expected) => { const result = realInbox.takeOpened(value, expected); audience = AUDIENCE_B; return result; } } }, () => undefined,
    { onWebsiteRecovery: () => { recoveries += 1; }, readCurrentWebsiteAudience: () => audience });
  await flush(); (opened as unknown as (value: unknown) => void)(message(3));
  assert.equal(recoveries, 0); stopSecond();
});

test('audience mismatches never consume the shared event and message replay identities', () => {
  const inbox = createWebsiteRecoveryAlertInbox({ now: () => NOW });
  assert.equal(inbox.takeOpened(message(), AUDIENCE_B), null);
  assert.notEqual(inbox.takeOpened(message(), AUDIENCE_A), null);
  for (const audience of [null, '', 'owner-uid', 'F'.repeat(32)]) assert.equal(inbox.takeOpened(message(2), audience), null);
});
