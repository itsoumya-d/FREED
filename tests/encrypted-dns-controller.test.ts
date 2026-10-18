import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as dns from '../src/lib/encrypted-dns';
import type { EncryptedDnsStatus } from '../src/lib/encrypted-dns';

const off: EncryptedDnsStatus = { supported: true, releaseEnabled: true, configured: false,
  enabled: false, healthy: null, reason: null, provider: 'cloudflare-families', requiresSettings: false };
const active: EncryptedDnsStatus = { ...off, configured: true, enabled: true, healthy: true };
function deferred<T>() {
  let resolve!: (value: T) => void; let reject!: (error: Error) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
const create = (dns as any).createEncryptedDnsController;

test('settings return during activation reconciles final native state without losing the result', async () => {
  assert.equal(typeof create, 'function', 'DNS needs a shared operation controller');
  const write = deferred<EncryptedDnsStatus>(); let reads = 0;
  const controller = create({ readStatus: async () => { reads++; return active; }, configure: () => write.promise, now: () => 1234 });
  const action = controller.configure(true); await Promise.resolve();
  const returned = controller.refresh();
  assert.equal(controller.getSnapshot().pending, 'enable');
  assert.equal(reads, 0, 'do not read system preferences while a native write is running');
  write.resolve({ ...active, healthy: null });
  await Promise.all([action, returned]);
  assert.equal(controller.getSnapshot().status.healthy, true);
  assert.equal(controller.getSnapshot().lastCheckedAt, 1234);
  assert.equal(controller.getSnapshot().pending, null);
});

test('a read begun before activation cannot replace the newer native readback', async () => {
  const old = deferred<EncryptedDnsStatus>(); let reads = 0;
  const controller = create({ readStatus: () => ++reads === 1 ? old.promise : Promise.resolve(active), configure: async () => active, now: () => 10 });
  const refresh = controller.refresh();
  await controller.configure(true);
  old.resolve(off); await refresh;
  assert.equal(controller.getSnapshot().status.enabled, true);
  assert.equal(controller.getSnapshot().lastCheckedAt, 10);
});

test('enable and disable never overlap and publish only the last requested operation', async () => {
  const first = deferred<EncryptedDnsStatus>(); const calls: boolean[] = []; let actual = off;
  const controller = create({ readStatus: async () => actual, configure: async ({ enabled }: { enabled: boolean }) => {
    calls.push(enabled);
    if (enabled) { const result = await first.promise; actual = result; return result; }
    actual = off; return off;
  }, now: () => 10 });
  const enable = controller.configure(true); await Promise.resolve();
  const disable = controller.configure(false); await Promise.resolve();
  assert.deepEqual(calls, [true]);
  assert.equal(controller.getSnapshot().pending, 'disable');
  first.resolve(active); await Promise.all([enable, disable]);
  assert.deepEqual(calls, [true, false]);
  assert.equal(controller.getSnapshot().status.enabled, false);
  assert.equal(controller.getSnapshot().pending, null);
});

test('failed activation still reads the OS and preserves an actionable write error', async () => {
  let reads = 0;
  const controller = create({ readStatus: async () => { reads++; return off; }, configure: async () => { throw new Error('save failed'); }, now: () => 15 });
  const result = await controller.configure(true);
  assert.equal(result.accepted, false);
  assert.equal(reads, 1);
  assert.equal(controller.getSnapshot().status.enabled, false);
  assert.equal(controller.getSnapshot().error, 'write-failed');
  assert.equal(controller.getSnapshot().pending, null);
});

test('failed readback never uses a successful write payload as active enforcement proof', async () => {
  const controller = create({ readStatus: async () => { throw new Error('read failed'); }, configure: async () => active, now: () => 15 });
  await controller.configure(true);
  assert.equal(controller.getSnapshot().status.enabled, false);
  assert.equal(controller.getSnapshot().status.healthy, null);
  assert.equal(controller.getSnapshot().error, 'read-failed');
  assert.equal(controller.getSnapshot().lastCheckedAt, null);
});

test('a new user action supersedes queued work before it reaches native preferences', async () => {
  const calls: boolean[] = [];
  const controller = create({ readStatus: async () => off, configure: async ({ enabled }: { enabled: boolean }) => { calls.push(enabled); return off; }, now: () => 1 });
  const old = controller.configure(true); const latest = controller.configure(false);
  await Promise.all([old, latest]);
  assert.deepEqual(calls, [false]);
});

test('concurrent refreshes coalesce and disposal suppresses late publication', async () => {
  const pending = deferred<EncryptedDnsStatus>(); let reads = 0, notices = 0;
  const controller = create({ readStatus: () => { reads++; return pending.promise; }, configure: async () => off, now: () => 5 });
  const unsubscribe = controller.subscribe(() => { notices++; });
  const first = controller.refresh(), second = controller.refresh();
  assert.equal(reads, 1);
  const snapshot = controller.getSnapshot(); const before = notices;
  controller.dispose(); pending.resolve(active); await Promise.all([first, second]);
  assert.equal(controller.getSnapshot(), snapshot);
  assert.equal(notices, before);
  unsubscribe();
});

test('network loss replaces an earlier active result with current degraded native state', async () => {
  let actual = active;
  const controller = create({ readStatus: async () => actual, configure: async () => actual, now: () => 50 });
  await controller.refresh();
  actual = { ...active, healthy: false, reason: 'resolver-unreachable' };
  await controller.refresh();
  assert.equal(dns.getEncryptedDnsPresentation(controller.getSnapshot().status).state, 'failed');
  assert.equal(controller.getSnapshot().status.reason, 'resolver-unreachable');
});

test('a rejected native save payload retains its reason after an ordinary successful read', async () => {
  const controller = create({ readStatus: async () => off, configure: async () => ({ ...off, operationAccepted: false, operationReason: 'ios-dns-preferences-save-failed' }), now: () => 20 });
  const result = await controller.configure(true);
  assert.equal(result.accepted, false);
  assert.equal(controller.getSnapshot().operationReason, 'ios-dns-preferences-save-failed');
  assert.equal(controller.getSnapshot().error, 'write-failed');
  assert.equal(controller.getSnapshot().status.enabled, false);
});

test('a saved DNS configuration is accepted without pretending it is OS enabled', async () => {
  const saved = { ...off, configured: true, requiresSettings: true, reason: 'ios-dns-settings-enable-required' };
  const controller = create({ readStatus: async () => saved, configure: async () => ({ ...saved, operationAccepted: true, operationReason: null }), now: () => 20 });
  const result = await controller.configure(true);
  assert.equal(result.accepted, true); assert.equal(controller.getSnapshot().status.enabled, false);
  assert.equal(controller.getSnapshot().operationReason, null);
});

test('legacy native error payload rejects save while keeping the final system readback authoritative', async () => {
  const controller = create({ readStatus: async () => active, configure: async () => ({ ...off, reason: 'ios-reset-dns-configuration-invalidated' }), now: () => 20 });
  const result = await controller.configure(true);
  assert.equal(result.accepted, false);
  assert.equal(controller.getSnapshot().operationReason, 'ios-reset-dns-configuration-invalidated');
  assert.equal(controller.getSnapshot().status.enabled, true);
});

test('the native error identity survives final readback without exposing an error description', async () => {
  const controller = create({ readStatus: async () => off, configure: async () => ({ ...off, operationAccepted: false, operationReason: 'ios-dns-preferences-save-failed', operationErrorDomain: 'NEConfigurationErrorDomain', operationErrorCode: 10 }), now: () => 20 });
  await controller.configure(true);
  assert.deepEqual(controller.getSnapshot().operationDiagnostic, { domain: 'NEConfigurationErrorDomain', code: 10 });
});

test('a native preferences-read failure payload clears the check time instead of claiming a current configuration', async () => {
  const controller = create({ readStatus: async () => ({ ...active, reason: 'ios-dns-preferences-load-failed' }), configure: async () => off, now: () => 20 });
  await controller.refresh();
  assert.equal(controller.getSnapshot().lastCheckedAt, null);
  assert.equal(controller.getSnapshot().error, 'read-failed');
  assert.equal(controller.getSnapshot().status.enabled, false);
});

test('a container rejection retains lock stage and availability even without an NSError code', async () => {
  const controller = create({ readStatus: async () => off, configure: async () => ({ ...off, operationAccepted: false, operationReason: 'ios-dns-configuration-lock-unavailable', operationLockStage: 'app-group-container', operationAppGroupContainerAvailable: false, operationProtectedDataAvailable: true }), now: () => 20 });
  await controller.configure(true);
  assert.deepEqual(controller.getSnapshot().operationDiagnostic, { stage: 'app-group-container', appGroupContainerAvailable: false, protectedDataAvailable: true });
});

test('a refresh queued during a rejected DNS save keeps its mutation receipt after both promises settle', async () => {
  const write = deferred<EncryptedDnsStatus>();
  const controller = create({ readStatus: async () => off, configure: () => write.promise, now: () => 25 });
  const action = controller.configure(true); await Promise.resolve();
  const settingsReturn = controller.refresh();
  write.resolve({ ...off, operationAccepted: false, operationReason: 'ios-dns-preferences-save-failed', operationErrorDomain: 'NEConfigurationErrorDomain', operationErrorCode: 10 });
  const [result] = await Promise.all([action, settingsReturn]);
  assert.equal(result.accepted, false);
  assert.equal(controller.getSnapshot().status.configured, false);
  assert.equal(controller.getSnapshot().error, 'write-failed');
  assert.equal(controller.getSnapshot().operationReason, 'ios-dns-preferences-save-failed');
  assert.deepEqual(controller.getSnapshot().operationDiagnostic, { domain: 'NEConfigurationErrorDomain', code: 10 });
  await controller.refresh();
  assert.equal(controller.getSnapshot().error, 'write-failed');
  assert.equal(controller.getSnapshot().operationReason, 'ios-dns-preferences-save-failed');
});

test('explicit mutation acknowledgement clears the save receipt while retaining a current read failure', async () => {
  const controller = create({ readStatus: async () => { throw new Error('read unavailable'); }, configure: async () => ({ ...off, operationAccepted: false, operationReason: 'ios-dns-preferences-save-failed' }), now: () => 25 });
  await controller.configure(true);
  assert.equal(typeof controller.acknowledgeOperation, 'function');
  controller.acknowledgeOperation();
  assert.equal(controller.getSnapshot().operationReason, null);
  assert.equal(controller.getSnapshot().operationDiagnostic, null);
  assert.equal(controller.getSnapshot().error, 'read-failed');
});

for (const [label, receipt] of [
  ['invalid normalized receipt', dns.unavailableEncryptedDnsStatus('native-status-invalid')],
  ['legacy enable without saved configuration', off],
  ['incomplete native acknowledgement', { provider: 'cloudflare-families', supported: true, releaseEnabled: true, configured: true, operationAccepted: true }],
  ['unsupported explicit acknowledgement', { ...off, supported: false, configured: true, operationAccepted: true }],
  ['malformed acknowledgement type', { ...off, configured: true, operationAccepted: 'yes' }],
  ['malformed operation reason', { ...off, configured: true, operationAccepted: true, operationReason: { code: 10 } }],
] as const) {
  test(`DNS activation rejects ${label}`, async () => {
    const controller = create({ readStatus: async () => off, configure: async () => receipt, now: () => 25 });
    const result = await controller.configure(true);
    assert.equal(result.accepted, false);
    assert.equal(controller.getSnapshot().error, 'write-failed');
    assert.equal(controller.getSnapshot().status.enabled, false);
  });
}

test('an explicit confirmed save is accepted independently from a degraded resolver readback', async () => {
  const degraded = { ...active, healthy: false, reason: 'android-encrypted-dns-resolver-failed' };
  const controller = create({ readStatus: async () => degraded, configure: async () => ({ ...degraded, operationAccepted: true, operationReason: null }), now: () => 25 });
  const result = await controller.configure(true);
  assert.equal(result.accepted, true);
  assert.equal(controller.getSnapshot().error, null);
  assert.equal(controller.getSnapshot().status.healthy, false);
  assert.equal(dns.getEncryptedDnsPresentation(controller.getSnapshot().status).state, 'failed');
});
