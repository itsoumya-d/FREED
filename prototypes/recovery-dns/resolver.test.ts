import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createHostedDnsController, type DnsDependencies } from './resolver';

function query(name = 'example.org', type = 1, id = 0x1234): Uint8Array {
  const labels = name.split('.').flatMap(label => [label.length, ...Buffer.from(label, 'ascii')]);
  return Uint8Array.from([id >> 8, id & 255, 1, 0, 0, 1, 0, 0, 0, 0, 0, 0,
    ...labels, 0, type >> 8, type & 255, 0, 1]);
}

function dnsResponse(request: Uint8Array, flags = [0x81, 0x80]): Uint8Array {
  return Uint8Array.from([...request.slice(0, 2), ...flags, ...request.slice(4)]);
}

const delay = (milliseconds: number) => new Promise(resolve => setTimeout(resolve, milliseconds));

async function waitFor(predicate: () => boolean, timeoutMs = 100): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (!predicate() && Date.now() < deadline) await delay(1);
  assert.equal(predicate(), true, 'condition did not become true before timeout');
}

function fixtures() {
  const forwarded: Uint8Array[] = [];
  const delivered: unknown[] = [];
  const deliveryAuthorities: unknown[] = [];
  const classified: string[] = [];
  let now = 1_000;
  let verdict: unknown = 'allow';
  let installation: Awaited<ReturnType<DnsDependencies['resolveInstallation']>> = {
    status: 'active', installationRef: 'internal-only-route', ownerGeneration: 7,
    activeOwnerGeneration: 7, cloudDnsConsent: true, notificationConsent: true,
  };
  let alertMode: 'ok' | 'reject' | 'hang' | 'late' = 'ok';
  let alertWasAborted = false;
  let lateDeliveryWasSuppressed = false;
  let deliveryStarted = 0;
  let resolveCalls = 0;
  const deferredTasks: Promise<void>[] = [];
  let deferMode: 'retain' | 'throw' | 'unavailable' = 'retain';
  let deferCalls = 0;
  let pauseAlertFence = false;
  let releaseAlertFence = () => {};
  let markAlertFenceStarted = () => {};
  const alertFenceStarted = new Promise<void>(resolve => { markAlertFenceStarted = resolve; });
  const alertFence = new Promise<void>(resolve => { releaseAlertFence = resolve; });
  let forwardMode: 'ok' | 'wrong-id' | 'wrong-question' | 'reserved-z' | 'timeout' = 'ok';
  let forwardWasAborted = false;
  let afterDecision: (() => void) | undefined;
  const deps: DnsDependencies = {
    defer: task => {
      deferCalls += 1;
      if (deferMode === 'throw') throw Error('host lifecycle unavailable');
      if (deferMode === 'unavailable') return 'unavailable';
      deferredTasks.push(task);
      return 'retained';
    },
    resolveInstallation: async token => {
      resolveCalls += 1;
      if (pauseAlertFence && resolveCalls >= 3) {
        markAlertFenceStarted();
        await alertFence;
      }
      return token === 'synthetic-test-token' ? installation : null;
    },
    decideCategory: async name => {
      classified.push(name);
      afterDecision?.();
      return verdict as 'allow' | 'deny' | 'unavailable';
    },
    forward: async (wire, signal) => {
      assert.equal(signal.aborted, false);
      forwarded.push(wire);
      if (forwardMode === 'timeout') {
        return new Promise<Uint8Array>((_resolve, reject) => {
          signal.addEventListener('abort', () => {
            forwardWasAborted = true;
            reject(Error('aborted'));
          }, { once: true });
        });
      }
      const response = dnsResponse(wire);
      if (forwardMode === 'wrong-id') response[1] ^= 1;
      if (forwardMode === 'wrong-question') response[13] = 'x'.charCodeAt(0);
      if (forwardMode === 'reserved-z') response[3] |= 0x40;
      return response;
    },
    alert: {
      kind: 'open-freed-action',
      deliver: async (...args: unknown[]) => {
        const [authority, event, signal] = args as [unknown, unknown, AbortSignal | undefined];
        deliveryStarted += 1;
        deliveryAuthorities.push(authority);
        if (alertMode === 'reject') throw Error('unavailable');
        if (alertMode === 'hang') {
          return new Promise<void>((_resolve, reject) => {
            signal?.addEventListener('abort', () => {
              alertWasAborted = true;
              reject(Error('aborted'));
            }, { once: true });
          });
        }
        if (alertMode === 'late') {
          await delay(20);
          if (signal?.aborted) {
            lateDeliveryWasSuppressed = true;
            return;
          }
        }
        delivered.push(event);
      },
    },
    now: () => now,
    upstreamTimeoutMs: 5,
    alertTimeoutMs: 5,
  };
  const controller = createHostedDnsController(deps);
  const send = (wire: Uint8Array, method = 'POST', headers: Record<string, string> = {
    authorization: 'Bearer synthetic-test-token', 'content-type': 'application/dns-message',
  }) => controller.handle({ method, url: '/dns-query', headers, body: wire });
  return { controller, send, forwarded, delivered, deliveryAuthorities, classified, deferredTasks,
    setVerdict: (value: 'allow' | 'deny' | 'unavailable') => { verdict = value; },
    setRuntimeVerdict: (value: unknown) => { verdict = value; },
    setInstallation: (value: typeof installation) => { installation = value; },
    mutateActiveInstallation: (value: Partial<Extract<typeof installation, { status: 'active' }>>) => {
      if (installation?.status === 'active') Object.assign(installation, value);
    },
    setAfterDecision: (value: (() => void) | undefined) => { afterDecision = value; },
    setForwardMode: (value: typeof forwardMode) => { forwardMode = value; },
    setAlertMode: (value: typeof alertMode) => { alertMode = value; },
    setAlertTimeout: (milliseconds: number) => { deps.alertTimeoutMs = milliseconds; },
    pauseAlertFence: () => { pauseAlertFence = true; },
    waitForAlertFence: () => alertFenceStarted,
    releaseAlertFence: () => releaseAlertFence(),
    resolveCalls: () => resolveCalls,
    drainDeferred: () => Promise.all(deferredTasks),
    setDeferMode: (value: typeof deferMode) => { deferMode = value; },
    deferCalls: () => deferCalls,
    deliveryStarted: () => deliveryStarted,
    alertWasAborted: () => alertWasAborted,
    lateDeliveryWasSuppressed: () => lateDeliveryWasSuppressed,
    forwardWasAborted: () => forwardWasAborted,
    advance: (milliseconds: number) => { now += milliseconds; },
    failDelivery: () => { alertMode = 'reject'; },
  };
}

test('forwards an allowed ordinary-search DNS query unchanged, with no SafeSearch substitution', async () => {
  const f = fixtures();
  const wire = query('search.example');
  const result = await f.send(wire);
  assert.equal(result.status, 200);
  assert.deepEqual(result.body, dnsResponse(wire));
  assert.deepEqual(f.forwarded, [wire]);
  assert.deepEqual(f.delivered, []);
});

test('denies an adult destination and emits only an opaque expiring recovery alert', async () => {
  const f = fixtures();
  f.setVerdict('deny');
  const result = await f.send(query('adult.example'));
  assert.equal(result.status, 200);
  assert.equal(result.body[3] & 15, 5); // REFUSED, independent of alert delivery.
  assert.equal(f.forwarded.length, 0);
  await waitFor(() => f.delivered.length === 1);
  assert.equal(f.delivered.length, 1);
  const event = f.delivered[0] as Record<string, unknown>;
  assert.deepEqual(Object.keys(event).sort(), ['expiresAt', 'id', 'kind']);
  assert.equal(event.kind, 'website-recovery');
  assert.equal(event.expiresAt, 61_000);
  assert.match(String(event.id), /^[0-9a-f-]{36}$/i);
  assert.doesNotMatch(JSON.stringify(event), /adult|example|internal-only-route|synthetic-test-token/);
  assert.deepEqual(f.deliveryAuthorities, [{ installationRef: 'internal-only-route', ownerGeneration: 7 }]);
});

test('coalesces A, AAAA, and duplicate blocked bursts for an installation', async () => {
  const f = fixtures();
  f.setVerdict('deny');
  for (const type of [1, 28, 1]) assert.equal((await f.send(query('adult.example', type))).body[3] & 15, 5);
  await waitFor(() => f.delivered.length === 1);
  assert.equal(f.delivered.length, 1);
  f.advance(60_001);
  assert.equal((await f.send(query('adult.example', 1))).body[3] & 15, 5);
  await waitFor(() => f.delivered.length === 2);
  assert.equal(f.delivered.length, 2);
});

test('does not coalesce the same denied name across installations', async () => {
  const f = fixtures();
  f.setVerdict('deny');
  await f.send(query('adult.example'));
  await waitFor(() => f.delivered.length === 1);
  f.setInstallation({ status: 'active', installationRef: 'second-route', ownerGeneration: 7,
    activeOwnerGeneration: 7, cloudDnsConsent: true, notificationConsent: true });
  await f.send(query('adult.example'));
  await waitFor(() => f.delivered.length === 2);
  assert.equal(f.delivered.length, 2);
});

test('evicts the oldest coalescing digest when the bounded map is full', async () => {
  const f = fixtures();
  f.setVerdict('deny');
  for (let index = 0; index < 257; index += 1) await f.send(query(`blocked-${index}.example`));
  await waitFor(() => f.delivered.length === 257);
  assert.equal(f.delivered.length, 257);
  await f.send(query('blocked-0.example'));
  await waitFor(() => f.delivered.length === 258);
  assert.equal(f.delivered.length, 258);
});

test('blocking survives notification failure or absent notification consent', async () => {
  const f = fixtures();
  f.setVerdict('deny');
  f.failDelivery();
  assert.equal((await f.send(query('adult.example'))).body[3] & 15, 5);
  f.setInstallation({ status: 'active', installationRef: 'internal-only-route', ownerGeneration: 7,
    activeOwnerGeneration: 7, cloudDnsConsent: true, notificationConsent: false });
  assert.equal((await f.send(query('second.example'))).body[3] & 15, 5);
  assert.equal(f.forwarded.length, 0);
  assert.equal(f.delivered.length, 0);
});

test('rejects absent, revoked, stale, and unconsented installations before policy or forwarding', async () => {
  const f = fixtures();
  const body = query();
  assert.equal((await f.send(body, 'POST', { 'content-type': 'application/dns-message' })).status, 401);
  for (const value of [
    { status: 'revoked' as const },
    { status: 'active' as const, installationRef: 'r', ownerGeneration: 6, activeOwnerGeneration: 7,
      cloudDnsConsent: true, notificationConsent: true },
    { status: 'active' as const, installationRef: 'r', ownerGeneration: 7, activeOwnerGeneration: 7,
      cloudDnsConsent: false, notificationConsent: true },
  ]) {
    f.setInstallation(value);
    assert.equal((await f.send(body)).status, 403);
  }
  assert.equal(f.forwarded.length, 0);
  assert.deepEqual(f.classified, []);
});

test('rechecks installation ownership and consent after classification before any side effect', async () => {
  const allowed = fixtures();
  allowed.setAfterDecision(() => allowed.setInstallation({ status: 'active', installationRef: 'r',
    ownerGeneration: 7, activeOwnerGeneration: 7, cloudDnsConsent: false, notificationConsent: true }));
  assert.equal((await allowed.send(query())).status, 403);
  assert.equal(allowed.forwarded.length, 0);
  assert.equal(allowed.delivered.length, 0);

  const denied = fixtures();
  denied.setVerdict('deny');
  denied.setAfterDecision(() => denied.setInstallation({ status: 'revoked' }));
  assert.equal((await denied.send(query('adult.example'))).status, 403);
  assert.equal(denied.forwarded.length, 0);
  assert.equal(denied.delivered.length, 0);
});

test('snapshots primitive installation authority across in-place adapter mutation', async () => {
  for (const verdict of ['allow', 'deny'] as const) {
    const f = fixtures();
    f.setVerdict(verdict);
    f.setAfterDecision(() => f.mutateActiveInstallation({ ownerGeneration: 8, activeOwnerGeneration: 8 }));
    assert.equal((await f.send(query(verdict === 'allow' ? 'safe.example' : 'adult.example'))).status, 403);
    assert.equal(f.forwarded.length, 0);
    assert.equal(f.deliveryStarted(), 0);
  }
});

test('returns denial while a never-settling alert is bounded and aborted', async () => {
  const f = fixtures();
  f.setVerdict('deny');
  f.setAlertMode('hang');
  const result = await Promise.race([f.send(query('adult.example')), delay(30).then(() => null)]);
  assert.notEqual(result, null);
  assert.equal(result!.body[3] & 15, 5);
  await waitFor(() => f.alertWasAborted());
  assert.equal(f.delivered.length, 0);
});

test('registers the complete reauthorization and delivery task once so the host can retain and drain it', async () => {
  const f = fixtures();
  f.setVerdict('deny');
  f.setAlertTimeout(1_000);
  f.pauseAlertFence();
  const result = await f.send(query('adult.example'));
  assert.equal(result.body[3] & 15, 5);
  assert.equal(f.deferredTasks.length, 1);
  assert.equal(f.deferCalls(), 1);
  const fenceStarted = await Promise.race([
    f.waitForAlertFence().then(() => true), delay(30).then(() => false),
  ]);
  assert.equal(fenceStarted, true);
  let drained = false;
  void f.drainDeferred().then(() => { drained = true; });
  await delay(1);
  assert.equal(drained, false);
  assert.equal(f.resolveCalls(), 3);
  assert.equal(f.deliveryStarted(), 0);
  f.releaseAlertFence();
  await f.drainDeferred();
  assert.equal(drained, true);
  assert.equal(f.deliveryStarted(), 1);
  assert.equal(f.delivered.length, 1);
});

test('unavailable or throwing host lifecycle registration returns denial without starting alert work', async () => {
  for (const mode of ['throw', 'unavailable'] as const) {
    const f = fixtures();
    f.setVerdict('deny');
    f.setDeferMode(mode);
    const result = await Promise.race([f.send(query(`${mode}.example`)), delay(30).then(() => null)]);
    assert.notEqual(result, null);
    assert.equal(result!.body[3] & 15, 5);
    await delay(10);
    assert.equal(f.deferredTasks.length, 0, mode);
    assert.equal(f.resolveCalls(), 2, mode);
    assert.equal(f.deliveryStarted(), 0, mode);
    assert.equal(f.delivered.length, 0, mode);
    assert.equal((await f.send(query(`${mode}.example`))).body[3] & 15, 5);
    assert.equal(f.deferCalls(), 2, mode);
  }
});

test('suppresses late alert completion after bounded cancellation', async () => {
  const f = fixtures();
  f.setVerdict('deny');
  f.setAlertMode('late');
  const result = await Promise.race([f.send(query('adult.example')), delay(10).then(() => null)]);
  assert.notEqual(result, null);
  assert.equal(result!.body[3] & 15, 5);
  await waitFor(() => f.lateDeliveryWasSuppressed());
  assert.equal(f.delivered.length, 0);
});

test('refuses alert provider side effects when any pending delivery fence becomes stale', async () => {
  for (const stale of ['generation', 'cloud-consent', 'notification-consent', 'expiry'] as const) {
    const f = fixtures();
    f.setVerdict('deny');
    f.pauseAlertFence();
    const result = await f.send(query('adult.example'));
    assert.equal(result.body[3] & 15, 5);
    const fenceStarted = await Promise.race([
      f.waitForAlertFence().then(() => true), delay(30).then(() => false),
    ]);
    assert.equal(fenceStarted, true);
    if (stale === 'generation') {
      f.mutateActiveInstallation({ ownerGeneration: 8, activeOwnerGeneration: 8 });
    } else if (stale === 'cloud-consent') {
      f.mutateActiveInstallation({ cloudDnsConsent: false });
    } else if (stale === 'notification-consent') {
      f.mutateActiveInstallation({ notificationConsent: false });
    } else {
      f.advance(60_000);
    }
    f.releaseAlertFence();
    await delay(10);
    assert.equal(f.deliveryStarted(), 0, stale);
    assert.equal(f.delivered.length, 0, stale);
  }
});

test('RFC8484 GET and POST shape validation rejects malformed and oversized wire', async () => {
  const f = fixtures();
  const wire = query();
  const encoded = Buffer.from(wire).toString('base64url');
  const get = await f.controller.handle({ method: 'GET', url: `/dns-query?dns=${encoded}`,
    headers: { authorization: 'Bearer synthetic-test-token', accept: 'application/dns-message' } });
  assert.equal(get.status, 200);
  assert.equal(get.body[3] & 15, 0);
  assert.equal((await f.controller.handle({ method: 'GET', url: `/dns-query?dns=${encoded}=`,
    headers: { authorization: 'Bearer synthetic-test-token' } })).status, 400);
  assert.equal((await f.controller.handle({ method: 'GET', url: `/dns-query?dns=${encoded}&dns=${encoded}`,
    headers: { authorization: 'Bearer synthetic-test-token' } })).status, 400);
  assert.equal((await f.controller.handle({ method: 'GET', url: `/dns-query?dns=${encoded}&next=https://example.test`,
    headers: { authorization: 'Bearer synthetic-test-token' } })).status, 400);
  assert.equal((await f.send(wire, 'PUT')).status, 405);
  assert.equal((await f.send(wire, 'POST', { authorization: 'Bearer synthetic-test-token',
    'content-type': 'text/plain' })).status, 415);
  assert.equal((await f.send(new Uint8Array(513))).status, 413);
  assert.equal((await f.controller.handle({ method: 'POST', url: '/dns-query?dns=ignored', headers: {
    authorization: 'Bearer synthetic-test-token', 'content-type': 'application/dns-message',
  }, body: wire })).status, 400);
});

test('rejects oversized GET and POST inputs before wire decode or copy', async () => {
  const f = fixtures();
  const oversizedGet = 'A'.repeat(684);
  const originalBufferFrom = Buffer.from;
  (Buffer as unknown as { from: typeof Buffer.from }).from = ((value: unknown, ...args: unknown[]) => {
    if (value === oversizedGet) throw Error('oversized GET was decoded');
    return originalBufferFrom(value as never, ...(args as never[]));
  }) as typeof Buffer.from;
  try {
    const result = await f.controller.handle({ method: 'GET', url: `/dns-query?dns=${oversizedGet}`,
      headers: { authorization: 'Bearer synthetic-test-token' } });
    assert.equal(result.status, 413);
  } finally {
    (Buffer as unknown as { from: typeof Buffer.from }).from = originalBufferFrom;
  }

  class CopySentinel extends Uint8Array {
    *[Symbol.iterator](): Uint8ArrayIterator<number> { throw Error('oversized POST was copied'); }
  }
  assert.equal((await f.send(new CopySentinel(513))).status, 413);
});

test('rejects multiple questions, compression pointers, and malformed labels', async () => {
  const f = fixtures();
  const multi = query(); multi[5] = 2;
  assert.equal((await f.send(multi)).status, 400);
  const pointer = query(); pointer[12] = 0xc0;
  assert.equal((await f.send(pointer)).status, 400);
  const short = query().slice(0, 15);
  assert.equal((await f.send(short)).status, 400);
  const trailing = Uint8Array.from([...query(), 0]);
  assert.equal((await f.send(trailing)).status, 400);
  const responseShape = query(); responseShape[2] |= 0x80;
  assert.equal((await f.send(responseShape)).status, 400);
  assert.equal((await f.send(query('mail.example', 15))).status, 400);
  assert.equal(f.forwarded.length, 0);
});

test('policy unavailable or runtime-invalid fails closed, and upstream timeout or identity mismatch never returns an unverified answer', async () => {
  const f = fixtures();
  f.setVerdict('unavailable');
  assert.equal((await f.send(query('adult.example'))).body[3] & 15, 2); // SERVFAIL
  assert.equal(f.forwarded.length, 0);

  const runtimeInvalid = fixtures();
  runtimeInvalid.setRuntimeVerdict('unknown-schema-value');
  assert.equal((await runtimeInvalid.send(query())).body[3] & 15, 2);
  assert.equal(runtimeInvalid.forwarded.length, 0);

  for (const mode of ['wrong-id', 'wrong-question', 'reserved-z'] as const) {
    const bad = fixtures();
    bad.setForwardMode(mode);
    const result = await bad.send(query());
    assert.equal(result.status, 200);
    assert.equal(result.body[3] & 15, 2);
  }

  const timedOut = fixtures();
  timedOut.setForwardMode('timeout');
  const result = await timedOut.send(query());
  assert.equal(result.status, 200);
  assert.equal(result.body[3] & 15, 2);
  assert.equal(timedOut.forwardWasAborted(), true);
});
