// Current controlled reproduction; historical validation artifacts remain immutable.
const assert = require('node:assert/strict');
const { createSafariContentHarness } = require('./safari-content-harness.cjs');
async function main() {
  const deferredDom = createSafariContentHarness('https://youtube.com/shorts/fixture', { loading: true });
  await deferredDom.flush();
  assert.ok(deferredDom.documentListeners.has('DOMContentLoaded'), 'Real native approval must reach the deferred DOM path.');
  assert.equal(deferredDom.hasShield(), false);
  deferredDom.navigate('/watch'); deferredDom.dispatchWindow('popstate'); await deferredDom.flush();
  await deferredDom.ready();
  assert.equal(deferredDom.hasShield(), false, 'Allowed pre-DOM navigation must never receive the old shield.');
  assert.equal(deferredDom.messages.some(message => message.rule), false, 'The old route is not sent to native after navigation.');

  const pendingNative = createSafariContentHarness('https://youtube.com/shorts/fixture', { deferNative: true });
  assert.equal(pendingNative.pending.length, 1);
  pendingNative.navigate('/watch'); pendingNative.dispatchWindow('popstate');
  await pendingNative.resolveNextNative({ protectionConfigurationActive: true });
  assert.equal(pendingNative.hasShield(), false, 'A late native approval cannot shield the new allowed route.');
  assert.equal(pendingNative.messages.some(message => message.rule), false);
  assert.equal(pendingNative.pending.length, 0);

  const resetBeforeDom = createSafariContentHarness('https://youtube.com/shorts/fixture', { loading: true });
  await resetBeforeDom.flush();
  assert.ok(resetBeforeDom.documentListeners.has('DOMContentLoaded'));
  resetBeforeDom.setActive(false); await resetBeforeDom.ready();
  assert.equal(resetBeforeDom.hasShield(), false, 'A native reset before DOM readiness must prevent the deferred shield.');
  assert.equal(resetBeforeDom.messages.some(message => message.rule), false);
  console.log('Safari controlled pre-DOM navigation, pending native approval and reset guards passed');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
