const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { test } = require('node:test');
const vm = require('node:vm');
const { mkdtempSync, mkdirSync, copyFileSync, writeFileSync, rmSync } = require('node:fs');
const { join } = require('node:path');
const { tmpdir } = require('node:os');
const plist = require('@expo/plist').default;
const { configureSafariRecoveryProbe } = require('../scripts/configure-safari-recovery-probe');
const { buildSafariRecoveryProbeConfiguration, PROBE_RULES, PROBE_LINK } = require('../scripts/lib/safari-recovery-probe');
const base = JSON.parse(readFileSync('ios/FREEDSafariFocusShield/manifest.json', 'utf8'));
const info = { NSExtension: { SFSafariWebsiteAccess: { Level: 'Some', 'Allowed Domains': ['youtube.com', '*.youtube.com', 'instagram.com', '*.instagram.com', 'tiktok.com', '*.tiktok.com'] } } };

test('the probe is off by default and never adds general website access', () => {
  const result = buildSafariRecoveryProbeConfiguration(base, info, {});
  assert.deepEqual(result.manifest, base);
  assert.deepEqual(result.info, info);
  assert.deepEqual(base.permissions, ['nativeMessaging']);
});

test('explicit internal opt-in installs only two exact safe main-frame fixtures', () => {
  const result = buildSafariRecoveryProbeConfiguration(base, info, { enabled: true, profile: 'internal' });
  assert.deepEqual(result.manifest.permissions, ['nativeMessaging', 'declarativeNetRequestWithHostAccess']);
  assert.deepEqual(result.manifest.host_permissions.slice(-2), ['https://example.com/*', 'https://nudity.testcategory.com/*']);
  assert.equal(result.info.FREEDWebsiteRecoveryProbeEnabled, true);
  assert.deepEqual(result.manifest.declarative_net_request.rule_resources, [{ id: 'freed_safe_recovery_probe_v1', enabled: true, path: 'recovery-probe/rules.json' }]);
  assert.equal(PROBE_RULES.length, 2);
  for (const [index, url] of ['https://example.com/freed-recovery-probe', 'https://nudity.testcategory.com/'].entries()) {
    const rule = PROBE_RULES[index];
    assert.equal(rule.action.redirect.extensionPath, '/recovery-probe/page.html');
    assert.deepEqual(rule.condition.resourceTypes, ['main_frame']);
    const match = new RegExp(rule.condition.regexFilter);
    assert.ok(match.test(url));
    for (const rejected of [url + '?private=value', url + '#secret', url + 'extra', url.replace('https:', 'http:'), url.replace('.com', '.com.evil.example'), url.replace('https://', 'https://www.'), 'https://example.com/']) assert.equal(match.test(rejected), false, rejected);
  }
  assert.equal(PROBE_LINK, 'freed://guided-reset');
});

test('production, missing profile, and unknown truthy inputs cannot enable the probe', () => {
  for (const profile of [undefined, 'production', 'preview', 'development']) assert.throws(() => buildSafariRecoveryProbeConfiguration(base, info, { enabled: true, profile }), /internal/);
  for (const enabled of ['true', 1, {}, null]) assert.throws(() => buildSafariRecoveryProbeConfiguration(base, info, { enabled, profile: 'internal' }), /Boolean/);
});

test('configuration is idempotent and disabling removes only the owned probe', () => {
  const configured = buildSafariRecoveryProbeConfiguration(base, info, { enabled: true, profile: 'internal' });
  assert.deepEqual(buildSafariRecoveryProbeConfiguration(configured.manifest, configured.info, { enabled: true, profile: 'internal' }), configured);
  const disabled = buildSafariRecoveryProbeConfiguration(configured.manifest, configured.info, {});
  assert.deepEqual(disabled.manifest, base);
  assert.deepEqual(disabled.info, info);
});

test('unexpected existing permissions or rule sets fail before mutation', () => {
  const bad = { ...base, declarative_net_request: { rule_resources: [{ id: 'unrelated', enabled: true, path: 'other.json' }] } };
  const before = JSON.stringify(bad);
  assert.throws(() => buildSafariRecoveryProbeConfiguration(bad, info, { enabled: true, profile: 'internal' }), /unrecognized/);
  assert.equal(JSON.stringify(bad), before);
  assert.throws(() => buildSafariRecoveryProbeConfiguration({ ...base, host_permissions: [...base.host_permissions, '<all_urls>'] }, info, {}), /unrecognized/);
});

test('the real prebuild configurator validates before writes, installs and removes only the probe', () => {
  const root = mkdtempSync(join(tmpdir(), 'freed-recovery-probe-'));
  const folder = join(root, 'ios/FREEDSafariFocusShield');
  try {
    mkdirSync(join(folder, 'recovery-probe'), { recursive: true });
    writeFileSync(join(folder, 'manifest.json'), JSON.stringify(base));
    writeFileSync(join(folder, 'Info.plist'), plist.build(info));
    for (const file of ['page.html', 'page.css', 'page.js', 'kite.svg', 'rules.json']) copyFileSync(`ios/FREEDSafariFocusShield/recovery-probe/${file}`, join(folder, 'recovery-probe', file));
    const original = readFileSync(join(folder, 'manifest.json'), 'utf8');
    assert.throws(() => configureSafariRecoveryProbe(root, { EAS_BUILD_PROFILE: 'production', FREED_SAFARI_RECOVERY_PROBE: '1' }), /internal/);
    assert.equal(readFileSync(join(folder, 'manifest.json'), 'utf8'), original);
    assert.deepEqual(configureSafariRecoveryProbe(root, { EAS_BUILD_PROFILE: 'internal', FREED_SAFARI_RECOVERY_PROBE: '1' }), { enabled: true, profile: 'internal' });
    assert.equal(JSON.parse(readFileSync(join(folder, 'manifest.json'), 'utf8')).declarative_net_request.rule_resources[0].enabled, true);
    configureSafariRecoveryProbe(root, { EAS_BUILD_PROFILE: 'production' });
    assert.deepEqual(JSON.parse(readFileSync(join(folder, 'manifest.json'), 'utf8')), base);
    assert.deepEqual(JSON.parse(JSON.stringify(plist.parse(readFileSync(join(folder, 'Info.plist'), 'utf8')))), info);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('the actual page script performs no network/native calls or automatic navigation', () => {
  const source = readFileSync('ios/FREEDSafariFocusShield/recovery-probe/page.js', 'utf8');
  const elements = new Map(), callbacks = [];
  const denied = () => { throw new Error('private probe attempted an unrelated side effect'); };
  const document = { documentElement: {}, getElementById: id => {
    if (!elements.has(id)) elements.set(id, { textContent: '', addEventListener: (event, callback) => { assert.equal(event, 'click'); callbacks.push(callback); } });
    return elements.get(id);
  } };
  Object.defineProperty(document, 'referrer', { get: denied });
  const location = new Proxy({}, { get: denied, set: denied });
  vm.runInNewContext(source, { document, location, window: { location, open: denied }, browser: { runtime: { sendMessage: denied, sendNativeMessage: denied }, tabs: new Proxy({}, { get: denied }) }, fetch: denied, XMLHttpRequest: denied, navigator: { sendBeacon: denied }, setTimeout: denied, setInterval: denied });
  assert.equal(elements.get('status')?.textContent ?? '', ''); assert.equal(callbacks.length, 1);
  callbacks[0](); assert.match(elements.get('status').textContent, /tap again/);
  const html = readFileSync('ios/FREEDSafariFocusShield/recovery-probe/page.html', 'utf8');
  assert.ok(html.includes(`href="${PROBE_LINK}"`));
  assert.match(html, /content="no-referrer"/);
  assert.doesNotMatch(html, /https?:|\son\w+=|http-equiv="refresh"/i);
});

test('the recovery page has complete local copy in all ten languages and explicit Arabic direction', () => {
  const source = readFileSync('ios/FREEDSafariFocusShield/recovery-probe/page.js', 'utf8');
  for (const locale of ['en', 'hi', 'es', 'pt', 'fr', 'de', 'ar', 'ja', 'ko', 'zh', 'xx']) {
    const elements = new Map(), root = {}, callbacks = [];
    const document = { documentElement: root, getElementById: id => {
      if (!elements.has(id)) elements.set(id, { textContent: '', addEventListener: (_event, callback) => callbacks.push(callback) });
      return elements.get(id);
    } };
    vm.runInNewContext(source, { document, navigator: { language: locale + '-XX' } });
    assert.equal(root.lang, locale === 'xx' ? 'en' : locale);
    assert.equal(root.dir, locale === 'ar' ? 'rtl' : 'ltr');
    for (const id of ['label', 'heading', 'body', 'open-freed', 'notice', 'protection']) assert.ok(elements.get(id).textContent.length > 3, `${locale}/${id}`);
    callbacks[0](); assert.ok(elements.get('status').textContent.length > 3);
    if (!['en', 'xx'].includes(locale)) assert.notEqual(elements.get('heading').textContent, 'A moment to choose.');
  }
});
