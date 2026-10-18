const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { test } = require('node:test');
const { inspectNativeAccessibilitySources } = require('../scripts/accessibility-safety-audit');

const read = path => readFileSync(path, 'utf8');
const { inspectRecoveryReminderPrivacySources } = require('../scripts/lib/recovery-reminder-privacy-contract');
const reminderSources = {
  reminders: read('src/lib/recovery-reminders.ts'),
  hook: read('src/hooks/use-recovery-reminders.ts'),
  controller: read('src/lib/recovery-reminder-controller.ts'),
};

test('reminder privacy audit accepts current scheduling metadata and hashed owner provenance', () => {
  assert.equal(inspectRecoveryReminderPrivacySources(reminderSources), true);
  assert.equal(inspectRecoveryReminderPrivacySources({ ...reminderSources, reminders: reminderSources.reminders + '\n// explicit tests never schedule adult-content metadata\n' }), true);
  assert.equal(inspectRecoveryReminderPrivacySources({ ...reminderSources, reminders: reminderSources.reminders.replaceAll('route: "checkin"', "route: 'checkin'").replaceAll('kind: "test"', "kind: 'test'") }), true);
});

test('reminder privacy audit rejects private, unknown, duplicate and spread payload fields', () => {
  const data = 'data: { route: "checkin", kind: item.key,';
  for (const field of ['ownerId', 'ownerUid', 'journal', 'reflection', 'photo', 'url', 'token', 'unknown']) {
    const reminders = reminderSources.reminders.replace(data, `data: { ${field}: privateValue, route: "checkin", kind: item.key,`);
    assert.notEqual(reminders, reminderSources.reminders);
    assert.equal(inspectRecoveryReminderPrivacySources({ ...reminderSources, reminders }), false, field);
  }
  for (const [before, after] of [
    [data, 'data: { ...privateData, route: "checkin", kind: item.key,'],
    [data, 'data: { route: "private", route: "checkin", kind: item.key,'],
    ['freedReminderVersion: 2, reminderTimezone: timezone', 'freedReminderVersion: 1, reminderTimezone: timezone'],
    ['reminderOwnerKey: options.ownerKey', 'reminderOwnerKey: context.ownerId'],
    ['reminderRevision: preferences.revision', 'reminderRevision: 0'],
    ['reminderRevision: preferences.revision', 'reminderRevision: preferences.revision, ...privateData'],
    ['kind: "test", freedReminderVersion: 2', 'kind: "test", freedReminderVersion: 2, reflection: privateValue'],
    ['kind: "test", freedReminderVersion: 2', 'kind: "test", freedReminderVersion: 2, ...privateData'],
    ['title: "FREED morning reset"', 'title: "FREED adult reset"'],
    ['title: "FREED morning reset"', 'title: `FREED explicit ${privateValue}`'],
  ]) {
    assert.ok(reminderSources.reminders.includes(before));
    const reminders = reminderSources.reminders.replace(before, after) + '\n// ' + before;
    assert.equal(inspectRecoveryReminderPrivacySources({ ...reminderSources, reminders }), false, before);
  }
});

test('reminder privacy audit rejects raw-owner forwarding, changed hashing and untrusted imports', () => {
  for (const [file, before, after] of [
    ['hook', "require('expo-crypto')", "require('./untrusted-crypto')"],
    ['hook', 'Crypto.CryptoDigestAlgorithm.SHA256', 'Crypto.CryptoDigestAlgorithm.MD5'],
    ['hook', 'return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, `freed-reminder-owner-v1:${ownerId}`);', 'return ownerId;'],
    ['controller', 'await dependencies.getOwnerKey(context.ownerId)', 'context.ownerId'],
    ['controller', 'ownerKey, requestPermission, timezone', 'ownerKey: context.ownerId, requestPermission, timezone'],
    ['controller', "from '@/lib/recovery-reminders'", "from './untrusted-reminders'"],
  ]) {
    assert.ok(reminderSources[file].includes(before));
    const source = reminderSources[file].replace(before, after) + '\n// ' + before;
    assert.equal(inspectRecoveryReminderPrivacySources({ ...reminderSources, [file]: source }), false, before);
  }
});

const sources = {
  tabs: read('app/(tabs)/_layout.tsx'),
  urgeSupport: read('src/components/UrgeSupportButton.tsx'),
  rootToolbar: read('src/components/RootToolbarActions.tsx'),
  controller: read('src/features/freed-app.tsx'),
  navigation: read('src/lib/native-navigation.ts'),
  tabStacks: ['today', 'shield', 'progress', 'profile'].map(tab => read(`app/(tabs)/${tab}/_layout.tsx`))
};

test('native tab audit accepts literal labels from the trusted translation import', () => {
  assert.equal(inspectNativeAccessibilitySources(sources).tabsNamed, true);
  const literalLabels = sources.tabs.replace(/\{translateSource\('([^']+)'\)\}/g, '$1').replace("import { translateSource } from '@/i18n/runtime';", '');
  assert.equal(inspectNativeAccessibilitySources({ ...sources, tabs: literalLabels }).tabsNamed, true);
});

test('native tab audit rejects missing, wrong, duplicate, and untrusted translated labels', () => {
  const mutations = [
    ["{translateSource('Today')}", ''],
    ["translateSource('Today')", "translateSource('Profile')"],
    ["translateSource('Today')", 'translateSource(label)'],
    ["translateSource('Today')", "translateSource('Today', arbitraryLanguage)"],
    ["translateSource('Today')", "other.translateSource('Today')"],
    ["from '@/i18n/runtime'", "from './untrusted-runtime'"],
    ["import { translateSource } from '@/i18n/runtime';", "const translateSource = (value) => '';"],
    ['name="profile"', 'name="today"'],
    ['</NativeTabs.Trigger.Label>', "</NativeTabs.Trigger.Label><NativeTabs.Trigger.Label>{translateSource('Today')}</NativeTabs.Trigger.Label>"],
    ['export default function MainTabs() {', 'export default function MainTabs(translateSource) {']
  ];
  for (const [before, after] of mutations) {
    assert.ok(sources.tabs.includes(before), `fixture must mutate ${before}`);
    assert.equal(inspectNativeAccessibilitySources({ ...sources, tabs: sources.tabs.replace(before, after) }).tabsNamed, false, before);
  }
});

test('native SOS audit rejects a named button whose recovery handler is disconnected', () => {
  assert.equal(inspectNativeAccessibilitySources({ ...sources, urgeSupport: sources.urgeSupport.replace('onPress={startPanicIntervention}', 'onPress={() => undefined}') }).urgeSupportWired, false);
});

test('native SOS audit traces the shared toolbar to its actual imported support button', () => {
  assert.equal(inspectNativeAccessibilitySources(sources).urgeSupportWired, true);
  const direct = { ...sources, tabStacks: sources.tabStacks.map(text => text.replaceAll('RootToolbarActions', 'UrgeSupportButton')) };
  assert.equal(inspectNativeAccessibilitySources(direct).urgeSupportWired, true, 'The original direct imported support composition remains valid.');
});

test('native SOS audit rejects a removed, fake, commented or untrusted toolbar support control', () => {
  const mutations = [
    sources.rootToolbar.replace('<UrgeSupportButton />', ''),
    sources.rootToolbar.replace("from './UrgeSupportButton'", "from './FakeSupport'"),
    "import { UrgeSupportButton } from './UrgeSupportButton'; export function RootToolbarActions() { return null; } // <UrgeSupportButton />",
    "import { UrgeSupportButton } from './UrgeSupportButton'; export function RootToolbarActions() { const unused = <UrgeSupportButton />; return null; }",
    "export function RootToolbarActions() { return <UrgeSupportButton />; }",
    "import { UrgeSupportButton } from './UrgeSupportButton'; export function RootToolbarActions() { return <View style={{display:'none'}}><UrgeSupportButton /></View>; }",
    "import { UrgeSupportButton } from './UrgeSupportButton'; export function RootToolbarActions() { return <View accessibilityElementsHidden><UrgeSupportButton /></View>; }"
  ];
  for (const rootToolbar of mutations) assert.equal(inspectNativeAccessibilitySources({ ...sources, rootToolbar }).urgeSupportWired, false);
});

test('native SOS audit rejects missing header binding, untrusted imports and hidden root headers', () => {
  for (const mutate of [
    text => text.replace('<RootToolbarActions />', 'null'),
    text => text.replace('headerRight:', 'unboundHeader:'),
    text => text.replace('"@/components/RootToolbarActions"', '"./FakeToolbar"'),
    text => text.replace('"expo-router"', '"./FakeStack"'),
    text => text.replace('headerRight: () => <RootToolbarActions />', 'headerShown: false, headerRight: () => <RootToolbarActions />'),
    text => text.replace('headerRight: () => <RootToolbarActions />', 'headerRight: () => <RootToolbarActions />, headerRight: () => null'),
    text => text.replace('headerRight: () => <RootToolbarActions />', 'headerRight: () => <RootToolbarActions />, ...untrustedOverrides'),
  ]) {
    const changed = mutate(sources.tabStacks[0]); assert.notEqual(changed, sources.tabStacks[0]);
    assert.equal(inspectNativeAccessibilitySources({ ...sources, tabStacks: [changed, ...sources.tabStacks.slice(1)] }).urgeSupportWired, false);
  }
});

test('native SOS audit checks trusted controller import and denies an ad route even beside intercept', () => {
  const direct = { ...sources, tabStacks: sources.tabStacks.map(text => text.replaceAll('RootToolbarActions', 'UrgeSupportButton')) };
  assert.equal(inspectNativeAccessibilitySources({ ...direct, urgeSupport: sources.urgeSupport.replace("from '@/features/freed-app'", "from './fake-controller'") }).urgeSupportWired, false);
  const controller = sources.controller.replace('setScreen("intercept");\n  }, [setRecoveryState]);', 'setScreen("ad"); setScreen("intercept");\n  }, [setRecoveryState]);');
  assert.notEqual(controller, sources.controller);
  assert.equal(inspectNativeAccessibilitySources({ ...direct, controller }).urgeSupportWired, false);
});

test('native SOS audit rejects a support button declared but not visibly returned', () => {
  const direct = { ...sources, tabStacks: sources.tabStacks.map(text => text.replaceAll('RootToolbarActions', 'UrgeSupportButton')) };
  for (const [before, after] of [
    ['return <Pressable', 'return false && <Pressable'],
    ['return <Pressable', 'return <Pressable accessibilityElementsHidden'],
    ['return <Pressable', 'return <Pressable importantForAccessibility="no-hide-descendants"'],
  ]) {
    assert.ok(sources.urgeSupport.includes(before));
    assert.equal(inspectNativeAccessibilitySources({ ...direct, urgeSupport: sources.urgeSupport.replace(before, after) }).urgeSupportWired, false);
  }
});

test('performance audit permits the gated iOS DNS settings layer while retaining its safety boundary', () => {
  const { spawnSync } = require('node:child_process');
  const result = spawnSync(process.execPath, ['scripts/performance-safety-audit.js'], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.match(result.stdout, /\| PASS \| ios-encrypted-dns-release-gated \|/);
  assert.match(result.stdout, /\| PASS \| android-encrypted-dns-protected-https \|/);
});

const { readEncryptedDnsSafetySources, inspectIosEncryptedDnsSafety, inspectAndroidEncryptedDnsSafety } = require('../scripts/lib/encrypted-dns-safety-contract');
const dnsSources = readEncryptedDnsSafetySources();
const allSafe = result => Object.values(result).every(value => value === true);

test('iOS DNS safety audit rejects runtime bypasses, false health, and invasive network APIs', () => {
  assert.equal(allSafe(inspectIosEncryptedDnsSafety(dnsSources)), true);
  const mutations = [
    ['if enabled && !supported { return payload(configured: saved, error: unavailableReason) }', ''],
    ['#else\n    return releaseEnabled', '#else\n    return true'],
    ['"healthy": NSNull()', '"healthy": true'],
    ['managerEnabled: manager.isEnabled', 'managerEnabled: true'],
    ['try await manager.loadFromPreferences()', ''],
    ['https://family.cloudflare-dns.com/dns-query', 'http://family.cloudflare-dns.com/dns-query'],
    ['NEDNSOverHTTPSSettings(servers: servers)', 'NEPacketTunnelProvider()'],
    ['private var changingConfiguration = false', 'private let vpn = NEVPNManager.shared()'],
    ['private var changingConfiguration = false', 'private let proxy = NEDNSProxyManager.shared()'],
    ['private var changingConfiguration = false', 'private let proxy = NETransparentProxyManager.shared()'],
    ['private var changingConfiguration = false', 'private let proxy = NEAppProxyProviderManager.shared()'],
    ['manager.onDemandRules = nil', 'manager.isEnabled = true'],
    ['manager.onDemandRules = nil', 'let ignored = connection.serverTrust']
  ];
  for (const [before, after] of mutations) {
    assert.ok(dnsSources.iosModule.includes(before), `fixture must mutate ${before}`);
    assert.equal(allSafe(inspectIosEncryptedDnsSafety({ ...dnsSources, iosModule: dnsSources.iosModule.replace(before, after) })), false, before);
  }
});

test('iOS DNS safety audit refuses default-enabled build flags or current DNS entitlement', () => {
  for (const flag of ['FreedEncryptedDnsReleaseEnabled', 'FreedEncryptedDnsDevPreview']) {
    const infoPlist = dnsSources.infoPlist.replace(new RegExp(`(<key>${flag}</key>\\s*)<false/>`), '$1<true/>');
    assert.notEqual(infoPlist, dnsSources.infoPlist);
    assert.equal(inspectIosEncryptedDnsSafety({ ...dnsSources, infoPlist }).currentReleaseOff, false);
  }
  assert.equal(inspectIosEncryptedDnsSafety({ ...dnsSources, entitlements: `${dnsSources.entitlements}<key>com.apple.developer.networking.networkextension</key><array><string>dns-settings</string></array>` }).currentReleaseOff, false);
  const plugin = { ...dnsSources.plugin, applyDnsInfoPlist: () => ({ FreedEncryptedDnsReleaseEnabled: true, FreedEncryptedDnsDevPreview: false }) };
  assert.equal(inspectIosEncryptedDnsSafety({ ...dnsSources, plugin }).pluginDefaultsOff, false);
  const tunnelPlugin = { ...dnsSources.plugin, applyDnsEntitlements: () => ({ 'com.apple.developer.networking.networkextension': ['dns-settings', 'packet-tunnel-provider'] }) };
  assert.equal(inspectIosEncryptedDnsSafety({ ...dnsSources, plugin: tunnelPlugin }).pluginDnsOnlyOptIn, false);
  const appConfig = { expo: { plugins: [['./modules/freed-protection/app.plugin.js', { releaseEnabled: true }]] } };
  assert.equal(inspectIosEncryptedDnsSafety({ ...dnsSources, appConfig }).currentReleaseOff, false);
});

test('iOS DNS status binds fresh public-manager readback to its operation receipt', () => {
  const safe = source => inspectIosEncryptedDnsSafety({ ...dnsSources, iosModule: source }).publicDnsSettingsOnly;
  assert.equal(safe(dnsSources.iosModule), true);
  const mutations = [
    ['return snapshot(manager, operationId: operationId)', 'return snapshot(otherManager, operationId: operationId)'],
    ['return snapshot(manager, operationId: operationId)', 'return snapshot(manager, operationId: otherOperation)'],
    ['return snapshot(manager, operationId: operationId)', 'return snapshot(manager)'],
    ['try await manager.loadFromPreferences()', 'try? await manager.loadFromPreferences()'],
    ['try await manager.loadFromPreferences()', ''],
    ['guard supported else', 'guard true else'],
    ['guard !changingConfiguration else', 'guard true else'],
    ['let manager = NEDNSSettingsManager.shared()', 'let manager = cachedManager'],
    ['let operationId = UUID().uuidString', 'let operationId = "reused-operation"'],
    ['return payload(configured: false, error: "ios-dns-preferences-load-failed", nativeError: error, operationId: operationId, stage: "dns-load")', 'return snapshot(manager, operationId: operationId)'],
  ];
  for (const [before, after] of mutations) {
    assert.ok(dnsSources.iosModule.includes(before), `fixture must mutate ${before}`);
    const changed = dnsSources.iosModule.replace(before, after);
    // A copied phrase in a comment or raw Swift string must not stand in for code.
    assert.equal(safe(changed + '\n/* ' + before + ' */\nlet auditLookalike = #"' + before + '"#\n'), false, before);
  }
  assert.equal(safe(dnsSources.iosModule.replace('return snapshot(manager, operationId: operationId)', 'return /* outer /* nested */ comment */ snapshot(manager, operationId: operationId)')), true);
  assert.equal(safe(dnsSources.iosModule + '\nmanager . isEnabled = true\n'), false, 'Whitespace cannot hide a write to system enablement');
});

test('iOS DNS configure preserves Families settings, OS save/removal and fresh success readback', () => {
  const safe = source => inspectIosEncryptedDnsSafety({ ...dnsSources, iosModule: source }).publicDnsSettingsOnly;
  const mutations = [
    ['settings.serverURL = url', 'settings.serverURL = otherUrl'],
    ['settings.matchDomains = [""]', 'settings.matchDomains = ["one.example"]'],
    ['settings.matchDomainsNoSearch = true', 'settings.matchDomainsNoSearch = false'],
    ['try await manager.saveToPreferences()', ''],
    ['if manager.dnsSettings != nil { try await manager.removeFromPreferences() }', 'if manager.dnsSettings != nil { /* removal omitted */ }'],
    ['try await manager.loadFromPreferences()\n      return configurationResult', 'return configurationResult'],
    ['result: snapshot(manager, operationId: operationId, generation: configurationGeneration, stage: enabled ? "dns-save-readback" : "dns-remove-readback")', 'result: payload(configured: enabled, error: "cached-state")'],
    ['let urlMatches = settings?.serverURL == url', 'let urlMatches = true'],
    ['let serversMatch = settings?.servers.sorted() == servers.sorted()', 'let serversMatch = true'],
    ['managerEnabled: manager.isEnabled', 'managerEnabled: true'],
    ['private let url = URL(string: "https://family.cloudflare-dns.com/dns-query")!', 'private let url = URL(string: "https://other.example/dns-query")!'],
    ['"1.1.1.3", "1.0.0.3", "2606:4700:4700::1113", "2606:4700:4700::1003"', '"1.1.1.1"'],
  ];
  for (const [before, after] of mutations) {
    assert.ok(dnsSources.iosModule.includes(before), `fixture must mutate ${before}`);
    assert.equal(safe(dnsSources.iosModule.replace(before, after) + '\n/* ' + before + ' */'), false, before);
  }
});

test('Android encrypted DNS audit rejects plaintext fallback and TLS or VPN socket bypasses', () => {
  assert.equal(allSafe(inspectAndroidEncryptedDnsSafety(dnsSources)), true);
  const mutations = [
    ['transportPolicy', 'if (encryptedRequested) encrypted() else plaintext()', 'if (encryptedRequested) encrypted() ?: plaintext() else plaintext()'],
    ['socketFactory', 'if (!protectSocket(socket)) throw IOException', 'if (false) throw IOException'],
    ['upstream', '.followRedirects(false)', '.followRedirects(true)'],
    ['upstream', '.followSslRedirects(false)', '.followSslRedirects(true)'],
    ['upstream', '.build()', '.hostnameVerifier { _, _ -> true }.build()'],
    ['upstream', 'FreedDohPolicy.readResponseBody(body.byteStream())', 'body.bytes()'],
    ['dohPolicy', 'if (host != HOST) throw UnknownHostException', 'if (false) throw UnknownHostException']
  ];
  for (const [file, before, after] of mutations) {
    assert.ok(dnsSources[file].includes(before), `fixture must mutate ${before}`);
    assert.equal(allSafe(inspectAndroidEncryptedDnsSafety({ ...dnsSources, [file]: dnsSources[file].replace(before, after) })), false, before);
  }
});
