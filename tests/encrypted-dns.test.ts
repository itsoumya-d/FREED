import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import vm from 'node:vm';

const { buildSync } = createRequire(resolve('package.json'))('esbuild') as typeof import('esbuild');

function loadBridge(native: unknown = null) {
  const bundle = buildSync({ entryPoints: ['modules/freed-protection/src/index.ts'], bundle: true,
    platform: 'node', format: 'cjs', write: false, external: ['expo-modules-core', 'react-native'] }).outputFiles[0].text;
  const sandbox = { module: { exports: {} as any }, setTimeout, clearTimeout,
    require: (name: string) => name === 'react-native' ? { Platform: { OS: 'android' } } : {
      requireNativeModule: () => { if (native) return native; throw new Error('native unavailable'); }
    } };
  vm.runInNewContext(bundle, sandbox);
  return sandbox.module.exports;
}

async function main() {
  const preview = loadBridge();
  assert.equal(typeof preview.getEncryptedDnsStatus, 'function', 'the DNS bridge must report unavailable previews without inventing native coverage');
  const unavailable = await preview.getEncryptedDnsStatus();
  assert.equal(unavailable.supported, false);
  assert.equal(unavailable.releaseEnabled, false);
  assert.equal(unavailable.configured, false);
  assert.equal(unavailable.enabled, false);
  assert.equal(unavailable.healthy, null);
  assert.equal(unavailable.reason, 'native-module-unavailable');
  const unavailableEnable = await preview.configureEncryptedDns({ enabled: true, provider: 'cloudflare-families' });
  assert.equal(unavailableEnable.enabled, false);
  await assert.rejects(preview.configureEncryptedDns({ enabled: true, provider: 'other-provider' }), /Invalid encrypted DNS configuration/);
  await assert.rejects(preview.configureEncryptedDns({ enabled: 'yes', provider: 'cloudflare-families' }), /Invalid encrypted DNS configuration/);

  // An older native binary must never claim the newly added transport exists.
  const oldBinary = loadBridge({ getStatus: async () => ({ active: true }) });
  assert.equal((await oldBinary.getEncryptedDnsStatus()).supported, false);
  assert.equal((await oldBinary.configureEncryptedDns({ enabled: true, provider: 'cloudflare-families' })).enabled, false);
  const incomplete = loadBridge({ getEncryptedDnsStatus: async () => ({ enabled: true, healthy: true }) });
  assert.equal((await incomplete.getEncryptedDnsStatus()).enabled, false);
  const broken = loadBridge({ getEncryptedDnsStatus: async () => { throw new Error('permission denied'); } });
  assert.equal((await broken.getEncryptedDnsStatus()).reason, 'native-status-check-failed');

  assert.ok(existsSync('src/lib/encrypted-dns.ts'), 'DNS presentation must distinguish configured, enabled, and verified');
  const model = buildSync({ entryPoints: ['src/lib/encrypted-dns.ts'], bundle: true, platform: 'node',
    format: 'cjs', write: false }).outputFiles[0].text;
  const sandbox = { module: { exports: {} as any } };
  vm.runInNewContext(model, sandbox);
  const { getEncryptedDnsPresentation, normalizeEncryptedDnsStatus, createEncryptedDnsController } = sandbox.module.exports;
  const receipt = loadBridge({ configureEncryptedDns: async () => ({ supported: true, releaseEnabled: true, configured: false, enabled: false, provider: 'cloudflare-families', operationAccepted: false, operationReason: 'ios-dns-preferences-save-failed' }) });
  const rejected = await receipt.configureEncryptedDns({ enabled: true, provider: 'cloudflare-families' });
  assert.equal(rejected.operationAccepted, false);
  assert.equal(rejected.operationReason, 'ios-dns-preferences-save-failed');
  const off = { supported: true, releaseEnabled: true, configured: false, enabled: false,
    healthy: null, reason: null, provider: 'cloudflare-families', requiresSettings: false };
  for (const nativePayload of [
    { enabled: true, healthy: true },
    { provider: 'cloudflare-families', supported: true, releaseEnabled: true, configured: true },
    { ...off, provider: 'wrong-provider', configured: true, operationAccepted: true },
  ]) {
    const malformedBridge = loadBridge({ configureEncryptedDns: async () => nativePayload });
    const controller = createEncryptedDnsController({ readStatus: async () => off, configure: malformedBridge.configureEncryptedDns, now: () => 25 });
    const result = await controller.configure(true);
    assert.equal(result.accepted, false, 'The real bridge cannot promote an incomplete/wrong-provider configure result to a successful save');
    assert.equal(controller.getSnapshot().operationReason, 'native-status-invalid');
    assert.equal(controller.getSnapshot().error, 'write-failed');
  }
  assert.equal(getEncryptedDnsPresentation(off).state, 'off');
  assert.equal(getEncryptedDnsPresentation({ ...off, configured: true, requiresSettings: true }).state, 'settings-required');
  const iosEnabled = { ...off, configured: true, enabled: true };
  assert.equal(getEncryptedDnsPresentation(iosEnabled).state, 'unverified');
  assert.equal(getEncryptedDnsPresentation(iosEnabled).isVerifiedActive, false);
  const active = { ...iosEnabled, healthy: true };
  assert.equal(getEncryptedDnsPresentation(active).state, 'active');
  assert.equal(getEncryptedDnsPresentation(active).isVerifiedActive, true);
  assert.equal(getEncryptedDnsPresentation({ ...active, releaseEnabled: false }).state, 'unverified');
  assert.equal(getEncryptedDnsPresentation({ ...active, healthy: false, reason: 'android-encrypted-dns-resolver-failed' }).state, 'failed');
  assert.equal(getEncryptedDnsPresentation({ ...off, supported: false, reason: 'encrypted-dns-release-gated' }).state, 'release-gated');
  assert.equal(getEncryptedDnsPresentation({ ...off, supported: false }).canEnable, false);
  assert.equal(getEncryptedDnsPresentation({ ...off, supported: false, configured: true }).canDisable, true);
  const invalid = normalizeEncryptedDnsStatus({ ...active, configured: false });
  assert.equal(invalid.enabled, false);
  assert.equal(invalid.healthy, null);
  assert.equal(normalizeEncryptedDnsStatus({ ...active, provider: 'unreviewed-provider' }).supported, false);
  const plugin = createRequire(resolve('package.json'))('./modules/freed-protection/app.plugin.js');
  const entitlementKey = 'com.apple.developer.networking.networkextension';
  const entitlements = { [entitlementKey]: ['packet-tunnel-provider', 'dns-settings'] };
  plugin.applyDnsEntitlements(entitlements, {});
  assert.deepEqual(entitlements[entitlementKey], ['packet-tunnel-provider']);
  plugin.applyDnsEntitlements(entitlements, { devPreview: true });
  plugin.applyDnsEntitlements(entitlements, { devPreview: true });
  assert.deepEqual(entitlements[entitlementKey], ['packet-tunnel-provider', 'dns-settings']);
  const info = plugin.applyDnsInfoPlist({}, { devPreview: true });
  assert.equal(info.FreedEncryptedDnsReleaseEnabled, false);
  assert.equal(info.FreedEncryptedDnsDevPreview, true);
  const application = { 'meta-data': [{ $: { 'android:name': 'unrelated', 'android:value': 'keep' } }] };
  plugin.applyDnsAndroidMetadata(application, { devPreview: true });
  plugin.applyDnsAndroidMetadata(application, {});
  assert.equal(application['meta-data'].length, 3);
  assert.equal(application['meta-data'][0].$['android:value'], 'keep');
  assert.equal(application['meta-data'][1].$['android:value'], 'false');
  assert.equal(application['meta-data'][2].$['android:value'], 'false');
  console.log('Encrypted DNS bridge and presentation tests passed');
}

void main().catch((error) => { console.error(error); process.exitCode = 1; });
