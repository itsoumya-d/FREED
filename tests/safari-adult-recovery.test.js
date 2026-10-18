"use strict";

// These tests catch missing feed coverage, widened permissions, unbound package
// bytes, partial configuration writes and page-created authority.
const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const vm = require('node:vm');
const Module = require('node:module');
const { createHash } = require('node:crypto');
const plist = require('@expo/plist').default;
const ts = require('typescript');
const { spawn, spawnSync } = require('node:child_process');
const sha = value => createHash('sha256').update(value).digest('hex');
const file = path.resolve('scripts/lib/safari-adult-recovery.js');
const api = fs.existsSync(file) ? require(file) : {};
const { configureSafariRecoveryProbe } = require('../scripts/configure-safari-recovery-probe');
const { inspectSafariFocusShieldContract } = require('../scripts/lib/ios-safari-focus-shield-contract');
const source = path.resolve('ios/FREEDSafariFocusShield');
const enginePath = path.resolve('src/lib/blocking-engine.ts');
const engine = new Module(enginePath, module);
engine._compile(ts.transpileModule(fs.readFileSync(enginePath, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, enginePath);
const now = Date.now();
const makeFeed = (domains = ['adult-fixture.test', 'protected-fixture.test']) => engine.exports.createAdultDomainFeed({ version: 'task94-reviewed-fixture-v1', generatedAt: new Date(now).toISOString(), domains, exceptions: ['ordinary-fixture.test'], sources: [{ id: 'freed-reviewed-task94-fixture', label: 'Task94 synthetic fixture only', updatedAt: new Date(now).toISOString() }] });
const input = feed => Buffer.from(JSON.stringify(feed));
const compile = (feed = makeFeed(), options = {}) => { const bytes = input(feed); return api.compileSafariAdultRecoveryArtifact(bytes, { sha256: sha(bytes), now, ...options }); };
function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'freed-adult-artifact-'));
  const folder = path.join(root, 'ios/FREEDSafariFocusShield');
  fs.cpSync(source, folder, { recursive: true });
  const feedPath = path.join(root, 'pinned-feed.json');
  const bytes = input(makeFeed()); fs.writeFileSync(feedPath, bytes);
  const env = { EAS_BUILD_PROFILE: 'internal', FREED_SAFARI_ADULT_RECOVERY: '1', FREED_SAFARI_ADULT_FEED_PATH: feedPath, FREED_SAFARI_ADULT_FEED_SHA256: sha(bytes) };
  return { root, folder, env };
}
function tree(folder) { return Object.fromEntries(fs.readdirSync(folder, { recursive: true }).filter(file => fs.lstatSync(path.join(folder, file)).isFile()).sort().map(file => [file, fs.readFileSync(path.join(folder, file)).toString('base64')])); }
function inspect(folder) {
  return inspectSafariFocusShieldContract({ manifest: JSON.parse(fs.readFileSync(path.join(folder, 'manifest.json'))), info: { ...plist.parse(fs.readFileSync(path.join(folder, 'Info.plist'), 'utf8')), MinimumOSVersion: '15.4' }, background: fs.readFileSync(path.join(folder, 'background.js'), 'utf8'), content: fs.readFileSync(path.join(folder, 'content.js'), 'utf8'), nativeHandlerBinary: fs.readFileSync(path.join(folder, 'SafariWebExtensionHandler.swift'), 'utf8'), extensionPath: folder });
}

test('actual compiler retains every pinned root/subdomain HTTP(S) main-frame destination and rejects confusing URL hosts', () => {
  assert.equal(typeof api.compileSafariAdultRecoveryArtifact, 'function', 'separate Safari feed compiler must exist');
  const artifact = compile();
  assert.equal(artifact.rules.length, 2);
  assert.deepEqual(artifact.hostPermissions, ['*://adult-fixture.test/*', '*://*.adult-fixture.test/*', '*://protected-fixture.test/*', '*://*.protected-fixture.test/*']);
  const rule = artifact.rules[0];
  assert.deepEqual(rule.condition.resourceTypes, ['main_frame']);
  assert.equal(rule.action.redirect.extensionPath, '/adult-recovery/page.html');
  const regex = new RegExp(rule.condition.regexFilter, rule.condition.isUrlFilterCaseSensitive ? '' : 'i');
  for (const url of ['https://adult-fixture.test/', 'http://adult-fixture.test:8080/path?q=x#fragment', 'HTTPS://SUB.ADULT-FIXTURE.TEST:443/p', 'https://one.two.adult-fixture.test/x', 'https://user:password@adult-fixture.test/p']) assert.equal(regex.test(url), true, url);
  for (const url of ['ftp://adult-fixture.test/', 'https://adult-fixture.test.evil.test/', 'https://evil-adult-fixture.test/', 'https://adult-fixtureXtest/', 'https://adult-fixture.test@ordinary-fixture.test/', 'https://ordinary-fixture.test/?q=https://adult-fixture.test/', 'https://ordinary-fixture.test/adult-fixture.test', 'https://adult-fixture.test:evil/']) assert.equal(regex.test(url), false, url);
  assert.equal(artifact.metadata.feed.sha256, sha(input(makeFeed())));
  assert.equal(artifact.metadata.coverage, 'pinned-input-only');
});

test('compiler visibly rejects malformed, changed, noncanonical, excessive, exception/ordinary-overlapping and unqualified metadata inputs', () => {
  assert.equal(typeof api.compileSafariAdultRecoveryArtifact, 'function');
  for (const change of [f => f.domains.push(f.domains[0]), f => f.domains[0] = 'ADULT-fixture.test', f => f.domains[0] = 'https://adult-fixture.test/', f => f.domains[0] = '../adult.test', f => f.checksum = 'wrong', f => f.exceptions.push(f.domains[0]), f => f.version = '', f => f.sources = [], f => f.sources[0].id = 'embedded-seed', f => f.sources[0].domainCount = -1, f => f.generatedAt = 'yesterday', f => f.generatedAt = new Date(now + 3600000).toISOString(), f => f.generatedAt = new Date(now - 49 * 3600000).toISOString()]) { const feed = makeFeed(); change(feed); assert.throws(() => compile(feed)); }
  assert.throws(() => compile(makeFeed(['google.com'])), /normal|ordinary/);
  assert.throws(() => compile(makeFeed(['foo.test', 'sub.foo.test'])), /overlap/);
  assert.throws(() => compile(makeFeed(Array.from({ length: 1001 }, (_, i) => `adult${i}.test`))), /capacity/);
  assert.throws(() => compile(undefined, { sha256: '0'.repeat(64) }), /SHA256/);
  assert.throws(() => api.compileSafariAdultRecoveryArtifact(Buffer.alloc(1024 * 1024 + 1), { sha256: '0'.repeat(64) }), /size/);
  const full = compile(makeFeed(Array.from({ length: 1000 }, (_, i) => `adult${i}.test`)));
  assert.equal(full.rules.length, 1000); assert.equal(full.metadata.ruleCount, 1000); assert.equal(full.rules.at(-1).id, 941000);
  const raw = input(makeFeed()), offset = raw.indexOf('Task94');
  const bytes = Buffer.concat([raw.subarray(0, offset), Buffer.from([0xff]), raw.subarray(offset + 1)]);
  assert.throws(() => api.compileSafariAdultRecoveryArtifact(bytes, { sha256: sha(bytes), now }), /UTF-8/);
});

test('real configurator is default-off, deterministic, exact-byte reversible, rejects conflicts and preserves unknown work', () => {
  const f = fixture();
  try {
    const before = tree(f.folder);
    configureSafariRecoveryProbe(f.root, {}); assert.deepEqual(tree(f.folder), before);
    assert.throws(() => configureSafariRecoveryProbe(f.root, { ...f.env, EAS_BUILD_PROFILE: 'production' }), /internal/);
    assert.throws(() => configureSafariRecoveryProbe(f.root, { ...f.env, FREED_SAFARI_RECOVERY_PROBE: '1' }), /conflict/);
    assert.deepEqual(tree(f.folder), before);
    configureSafariRecoveryProbe(f.root, f.env);
    const first = tree(f.folder); configureSafariRecoveryProbe(f.root, f.env); assert.deepEqual(tree(f.folder), first);
    const contract = inspect(f.folder);
    assert.equal(contract.adultRecoveryArtifactValid, true);
    assert.equal(contract.packageContractVariant, 'adult-recovery-internal-v1');
    assert.equal(contract.usableForManualEvidence, false);
    assert.equal(contract.nativePayloadSchemaValid, true);
    fs.writeFileSync(path.join(f.folder, 'adult-recovery/unknown.txt'), 'another contributor');
    assert.throws(() => configureSafariRecoveryProbe(f.root, {}), /unknown|unexpected/i);
    assert.equal(fs.readFileSync(path.join(f.folder, 'adult-recovery/unknown.txt'), 'utf8'), 'another contributor');
    fs.unlinkSync(path.join(f.folder, 'adult-recovery/unknown.txt'));
    configureSafariRecoveryProbe(f.root, {}); assert.deepEqual(tree(f.folder), before);
    configureSafariRecoveryProbe(f.root, f.env); configureSafariRecoveryProbe(f.root, {}); assert.deepEqual(tree(f.folder), before);
  } finally { fs.rmSync(f.root, { recursive: true, force: true }); }
});

test('every actual write failure rolls all generated config/resource bytes back', () => {
  const f = fixture();
  try {
    const before = tree(f.folder);
    for (let failAt = 1; failAt <= 6; failAt++) {
      const original = fs.renameSync; let count = 0;
      fs.renameSync = (...args) => { if (++count === failAt) throw new Error('injected write failure'); return original(...args); };
      try { assert.throws(() => configureSafariRecoveryProbe(f.root, f.env), /injected write failure/); } finally { fs.renameSync = original; }
      assert.deepEqual(tree(f.folder), before, `write ${failAt}`);
    }
  } finally { fs.rmSync(f.root, { recursive: true, force: true }); }
});

test('package inspector fails closed for altered resources, feed/rule bytes, scopes, flags, extra resources and symlinks', () => {
  for (const tamper of [
    f => fs.appendFileSync(path.join(f, 'adult-recovery/page.js'), '\nfetch("https://evil.test")'),
    f => fs.writeFileSync(path.join(f, 'adult-recovery/rules.json'), '[]'),
    f => fs.appendFileSync(path.join(f, 'adult-recovery/feed.json'), ' '),
    f => fs.writeFileSync(path.join(f, 'adult-recovery/unexpected'), 'x'),
    f => { const m = JSON.parse(fs.readFileSync(path.join(f, 'manifest.json'))); m.host_permissions.push('<all_urls>'); fs.writeFileSync(path.join(f, 'manifest.json'), JSON.stringify(m)); },
    f => { const m = JSON.parse(fs.readFileSync(path.join(f, 'manifest.json'))); m.web_accessible_resources[0].resources.push('background.js'); fs.writeFileSync(path.join(f, 'manifest.json'), JSON.stringify(m)); },
    f => { const p = plist.parse(fs.readFileSync(path.join(f, 'Info.plist'), 'utf8')); p.FREEDSafariAdultRecoveryArtifact = 'unrecognized'; fs.writeFileSync(path.join(f, 'Info.plist'), plist.build(p)); },
    f => { const target = path.join(f, 'adult-recovery/page.css'); fs.unlinkSync(target); fs.symlinkSync(path.join(source, 'recovery-probe/page.css'), target); },
  ]) {
    const f = fixture();
    try { configureSafariRecoveryProbe(f.root, f.env); tamper(f.folder); const result = inspect(f.folder); assert.equal(result.adultRecoveryArtifactValid, false); assert.equal(result.usableForManualEvidence, false); } finally { fs.rmSync(f.root, { recursive: true, force: true }); }
  }
});

test('shipped adult page executes in all ten locales with no private reads/authority or automatic navigation; explicit exit is local', () => {
  const script = fs.readFileSync(path.join(source, 'adult-recovery/page.js'), 'utf8');
  for (const language of ['en', 'hi', 'es', 'pt', 'fr', 'de', 'ar', 'ja', 'ko', 'zh', 'xx']) {
    const elements = new Map(), root = {}, events = {};
    const denied = () => { throw new Error('prohibited page side effect'); };
    const document = { documentElement: root, getElementById: id => { if (!elements.has(id)) elements.set(id, { textContent: '', addEventListener: (event, callback) => { events[id] = callback; } }); return elements.get(id); } };
    Object.defineProperty(document, 'referrer', { get: denied });
    const location = new Proxy({}, { get: denied, set: denied });
    vm.runInNewContext(script, { document, navigator: { language, sendBeacon: denied }, location, history: new Proxy({}, { get: denied }), localStorage: new Proxy({}, { get: denied }), sessionStorage: new Proxy({}, { get: denied }), browser: new Proxy({}, { get: denied }), fetch: denied, XMLHttpRequest: denied, setTimeout: denied, window: { open: denied, location } });
    assert.equal(root.lang, language === 'xx' ? 'en' : language); assert.equal(root.dir, language === 'ar' ? 'rtl' : 'ltr');
    for (const id of ['open-freed', 'safe-exit', 'protection', 'notice']) assert.ok(elements.get(id).textContent.length > 3);
    events['open-freed'](); assert.ok(elements.get('status').textContent.length > 3);
  }
  const html = fs.readFileSync(path.join(source, 'adult-recovery/page.html'), 'utf8');
  assert.match(html, /href="freed:\/\/guided-reset"/); assert.match(html, /href="about:blank"/);
  assert.match(html, /content="no-referrer"/); assert.match(html, /connect-src 'none'/);
});

test('unknown flags, stale or mismatched inputs and unsafe config/resources refuse before any write', () => {
  const cases = [
    f => ({ ...f.env, FREED_SAFARI_ADULT_RECOVERY: 'true' }),
    f => ({ ...f.env, FREED_SAFARI_ADULT_RECOVERY: 1 }),
    f => ({ ...f.env, FREED_SAFARI_RECOVERY_PROBE: 'true' }),
    f => ({ ...f.env, FREED_SAFARI_ADULT_FEED_PATH: '' }),
    f => ({ ...f.env, FREED_SAFARI_ADULT_FEED_SHA256: '' }),
    f => ({ ...f.env, FREED_SAFARI_ADULT_FEED_SHA256: 'f'.repeat(64) }),
    f => { const feed = makeFeed(); feed.generatedAt = new Date(now - 49 * 3600000).toISOString(); const bytes = input(feed); fs.writeFileSync(f.env.FREED_SAFARI_ADULT_FEED_PATH, bytes); return { ...f.env, FREED_SAFARI_ADULT_FEED_SHA256: sha(bytes) }; },
    f => { const manifest = JSON.parse(fs.readFileSync(path.join(f.folder, 'manifest.json'))); manifest.permissions.push('tabs'); fs.writeFileSync(path.join(f.folder, 'manifest.json'), JSON.stringify(manifest)); return f.env; },
    f => { fs.writeFileSync(path.join(f.folder, 'adult-recovery/artifact.json'), '{}'); return f.env; },
    f => { fs.appendFileSync(path.join(f.folder, 'adult-recovery/page.html'), '<script>unreviewed()</script>'); return f.env; },
    f => { const target = path.join(f.folder, 'manifest.json'); fs.renameSync(target, target + '.original'); fs.symlinkSync(target + '.original', target); return f.env; },
  ];
  for (const change of cases) {
    const f = fixture();
    try { const env = change(f); const before = tree(f.folder); assert.throws(() => configureSafariRecoveryProbe(f.root, env)); assert.deepEqual(tree(f.folder), before); } finally { fs.rmSync(f.root, { recursive: true, force: true }); }
  }
});

test('disable failures restore the complete active artifact, missing/tampered restore records never erase current work', () => {
  const f = fixture();
  try {
    configureSafariRecoveryProbe(f.root, f.env); const active = tree(f.folder);
    for (let failAt = 1; failAt <= 6; failAt++) {
      const original = fs.renameSync; let count = 0;
      fs.renameSync = (...args) => { if (++count === failAt) throw new Error('injected disable failure'); return original(...args); };
      try { assert.throws(() => configureSafariRecoveryProbe(f.root, {}), /injected disable failure/); } finally { fs.renameSync = original; }
      assert.deepEqual(tree(f.folder), active, `disable ${failAt}`);
      assert.equal(inspect(f.folder).adultRecoveryArtifactValid, true);
    }
    const restorePath = path.join(f.folder, '.freed-adult-recovery-restore.json');
    const restore = fs.readFileSync(restorePath);
    fs.unlinkSync(restorePath); const missing = tree(f.folder);
    assert.throws(() => configureSafariRecoveryProbe(f.root, {})); assert.deepEqual(tree(f.folder), missing);
    const changed = JSON.parse(restore); changed.manifest = Buffer.from('{"permissions":["tabs"]}').toString('base64');
    fs.writeFileSync(restorePath, JSON.stringify(changed)); const bad = tree(f.folder);
    assert.throws(() => configureSafariRecoveryProbe(f.root, {})); assert.deepEqual(tree(f.folder), bad);
  } finally { fs.rmSync(f.root, { recursive: true, force: true }); }
});

test('staging write failures and changed-feed replacement failures preserve every previous byte', () => {
  const f = fixture();
  try {
    const before = tree(f.folder);
    for (let failAt = 1; failAt <= 6; failAt++) {
      const original = fs.writeFileSync; let count = 0;
      fs.writeFileSync = (...args) => { if (String(args[0]).includes('.freed-adult-') && ++count === failAt) throw new Error('injected staging failure'); return original(...args); };
      try { assert.throws(() => configureSafariRecoveryProbe(f.root, f.env), /injected staging failure/); } finally { fs.writeFileSync = original; }
      assert.deepEqual(tree(f.folder), before, `staging ${failAt}`);
    }
    configureSafariRecoveryProbe(f.root, f.env); const active = tree(f.folder);
    const changed = makeFeed(['another-fixture.test']); changed.version = 'task94-reviewed-fixture-v2';
    const bytes = input(changed); fs.writeFileSync(f.env.FREED_SAFARI_ADULT_FEED_PATH, bytes);
    const env = { ...f.env, FREED_SAFARI_ADULT_FEED_SHA256: sha(bytes) };
    const original = fs.renameSync; let count = 0;
    fs.renameSync = (...args) => { if (++count === 4) throw new Error('injected replacement failure'); return original(...args); };
    try { assert.throws(() => configureSafariRecoveryProbe(f.root, env), /injected replacement failure/); } finally { fs.renameSync = original; }
    assert.deepEqual(tree(f.folder), active);
    configureSafariRecoveryProbe(f.root, env); assert.equal(inspect(f.folder).adultRecoveryArtifact.feed.version, 'task94-reviewed-fixture-v2');
    configureSafariRecoveryProbe(f.root, {}); assert.deepEqual(tree(f.folder), before);
  } finally { fs.rmSync(f.root, { recursive: true, force: true }); }
});

test('artifact and permission mutations cannot impersonate the named package variant or a production pass', () => {
  const manifestMutation = change => f => { const target = path.join(f, 'manifest.json'); const value = JSON.parse(fs.readFileSync(target)); change(value); fs.writeFileSync(target, JSON.stringify(value)); };
  const metadataMutation = change => f => { const target = path.join(f, 'adult-recovery/artifact.json'); const value = JSON.parse(fs.readFileSync(target)); change(value); fs.writeFileSync(target, JSON.stringify(value, null, 2) + '\n'); };
  for (const change of [
    manifestMutation(m => m.declarative_net_request.rule_resources[0].path = '../other.json'),
    manifestMutation(m => m.declarative_net_request.rule_resources[0].enabled = false),
    manifestMutation(m => m.declarative_net_request.rule_resources.push({ id: 'unknown', enabled: true, path: 'other.json' })),
    manifestMutation(m => m.host_permissions.pop()),
    manifestMutation(m => m.host_permissions.push(m.host_permissions.at(-1))),
    manifestMutation(m => m.web_accessible_resources[0].matches.push('*://*/*')),
    manifestMutation(m => m.permissions.push('webRequest')),
    manifestMutation(m => m.optional_host_permissions = ['<all_urls>']),
    manifestMutation(m => m.optional_permissions = ['tabs']),
    metadataMutation(m => m.feed.version = 'forged-version'),
    metadataMutation(m => m.ruleCount++),
    metadataMutation(m => m.internalOnly = false),
    metadataMutation(m => m.resourceHashes['page.js'] = sha('bad script')),
    f => fs.unlinkSync(path.join(f, 'adult-recovery/kite.svg')),
    f => { const target = path.join(f, 'adult-recovery'); fs.renameSync(target, target + '-original'); fs.symlinkSync(target + '-original', target); },
    f => { const target = path.join(f, 'Info.plist'); const value = plist.parse(fs.readFileSync(target, 'utf8')); value.NSExtension.SFSafariWebsiteAccess['Allowed Domains'].push('*'); fs.writeFileSync(target, plist.build(value)); },
    f => { const target = path.join(f, 'Info.plist'); const value = plist.parse(fs.readFileSync(target, 'utf8')); value.NSExtension.SFSafariWebsiteAccess['Allowed URL Patterns'] = ['*']; fs.writeFileSync(target, plist.build(value)); },
  ]) {
    const f = fixture();
    try { configureSafariRecoveryProbe(f.root, f.env); change(f.folder); const result = inspect(f.folder); assert.equal(result.adultRecoveryArtifactValid, false); assert.equal(result.adultRecoveryPackageContractValid, false); assert.equal(result.usableForManualEvidence, false); } finally { fs.rmSync(f.root, { recursive: true, force: true }); }
  }
  const f = fixture();
  try { const target = path.join(f.folder, 'manifest.json'); const value = JSON.parse(fs.readFileSync(target)); value.declarative_net_request = { rule_resources: [{ id: 'unknown', enabled: true, path: '../rules.json' }] }; fs.writeFileSync(target, JSON.stringify(value)); assert.equal(inspect(f.folder).usableForManualEvidence, false); } finally { fs.rmSync(f.root, { recursive: true, force: true }); }
});

test('an unknown broken restore symlink is preserved and cannot be replaced by opt-in configuration', () => {
  const f = fixture();
  try {
    const target = path.join(f.folder, '.freed-adult-recovery-restore.json'); fs.symlinkSync(path.join(f.root, 'unavailable-other-work'), target);
    const before = tree(f.folder); assert.throws(() => configureSafariRecoveryProbe(f.root, f.env));
    assert.equal(fs.lstatSync(target).isSymbolicLink(), true); assert.deepEqual(tree(f.folder), before);
  } finally { fs.rmSync(f.root, { recursive: true, force: true }); }
});

// Run these actual read-only consumer declarations and their real plist/process
// helpers. Do not execute either CLI's main/archive/device orchestration.
function declarations(file, functionNames, variableNames = []) {
  const text = fs.readFileSync(file, 'utf8'), ast = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  const selected = [];
  for (const statement of ast.statements) {
    if (ts.isFunctionDeclaration(statement) && functionNames.includes(statement.name?.text)) selected.push(statement.getText(ast));
    if (ts.isVariableStatement(statement)) for (const declaration of statement.declarationList.declarations) if (variableNames.includes(declaration.name.getText(ast))) selected.push('const ' + declaration.getText(ast) + ';');
  }
  assert.equal(selected.length, functionNames.length + variableNames.length, `consumer declaration closure from ${file}`);
  return selected.join('\n');
}
function consumers() {
  const context = { fs, path, os, spawn, spawnSync, process, setTimeout, clearTimeout, inspectSafariFocusShieldContract, ROOT: process.cwd() };
  const archive = vm.runInNewContext(declarations('scripts/build-ios-release-archive.js', ['runSync', 'readPlistJson', 'inspectSafariFocusShieldResources']) + '\ninspectSafariFocusShieldResources', { ...context });
  const device = vm.runInNewContext(declarations('scripts/ios-physical-device-evidence.js', ['run', 'readPlistJson', 'repoRelative', 'inspectSafariFocusShieldResources']) + '\ninspectSafariFocusShieldResources', { ...context });
  const release = vm.runInNewContext(declarations('scripts/release-verify.js', ['valueAtReportPath', 'expectedValueLabel', 'conditionalRequiredProofValues', 'assertReportProofValues'], ['androidProtectionFlowOrder', 'androidProtectionFlowOrderString', 'androidProtectionFlowDetails', 'reportArtifactRequiredProofValues']) + '\n({assertReportProofValues, expectations: reportArtifactRequiredProofValues["build:ios-archive:release"]})', { ...context });
  return { archive, device, release };
}
function generate(f) {
  for (const directory of ['scripts', 'assets/brand', 'ios/FREED.xcodeproj', 'ios/FREED', 'ios/FREEDShieldConfiguration', 'ios/FREEDShieldAction', 'ios/FREEDDeviceActivityMonitor', 'ios/FREEDSafariContentBlocker']) fs.mkdirSync(path.join(f.root, directory), { recursive: true });
  for (const file of ['scripts/add-ios-screen-time-extensions.rb', 'scripts/configure-safari-recovery-probe.js', 'assets/brand/freed-symbol.svg', 'ios/FREED.xcodeproj/project.pbxproj', 'ios/FREED/Info.plist', 'ios/FREEDShieldConfiguration/Info.plist', 'ios/FREEDShieldAction/Info.plist', 'ios/FREEDDeviceActivityMonitor/Info.plist', 'ios/FREEDSafariContentBlocker/Info.plist']) fs.copyFileSync(file, path.join(f.root, file));
  fs.symlinkSync(path.resolve('scripts/lib'), path.join(f.root, 'scripts/lib')); fs.symlinkSync(path.resolve('node_modules'), path.join(f.root, 'node_modules'));
  const result = spawnSync('ruby', ['scripts/add-ios-screen-time-extensions.rb'], { cwd: f.root, env: { ...process.env, ...f.env, FREED_SAFARI_RECOVERY_PROBE: '0' }, encoding: 'utf8', timeout: 30000 });
  assert.equal(result.status, 0, result.stdout + result.stderr);
  return result;
}
function assembledBundle(f) {
  const bundle = path.join(f.root, 'assembled/FREEDSafariFocusShield.appex'); fs.mkdirSync(bundle, { recursive: true });
  const code = 'require "xcodeproj"; require "json"; p=Xcodeproj::Project.open(ARGV[0]); t=p.targets.find { |t| t.name=="FREEDSafariFocusShield" }; puts JSON.generate(t.resources_build_phase.files_references.map { |r| {path:r.path,type:r.last_known_file_type} })';
  const result = spawnSync('ruby', ['-e', code, path.join(f.root, 'ios/FREED.xcodeproj')], { encoding: 'utf8' }); assert.equal(result.status, 0, result.stderr);
  const references = JSON.parse(result.stdout);
  for (const folder of ['icons', 'recovery-probe', 'adult-recovery']) assert.equal(references.filter(r => r.path === folder && r.type === 'folder').length, 1);
  for (const resource of references) fs.cpSync(path.join(f.folder, resource.path), path.join(bundle, resource.path), { recursive: resource.type === 'folder' });
  const info = plist.parse(fs.readFileSync(path.join(f.folder, 'Info.plist'), 'utf8')); info.MinimumOSVersion = '15.4'; info.CFBundleExecutable = 'fixture-native-contract.txt';
  fs.writeFileSync(path.join(bundle, 'Info.plist'), plist.build(info));
  fs.copyFileSync(path.join(f.folder, 'SafariWebExtensionHandler.swift'), path.join(bundle, info.CFBundleExecutable));
  return { bundle, references };
}
test('actual opt-in Ruby generator, resource-phase assembly and archive/device/release consumers share one fail-closed contract', async () => {
  const f = fixture();
  try {
    const originalTree = tree(f.folder);
    const inputFiles = ['scripts/lib/safari-adult-recovery.js', 'scripts/lib/safari-recovery-probe.js', 'scripts/lib/adult-domain-feed-source-contract.js', 'scripts/lib/ios-safari-focus-shield-contract.js', 'scripts/lib/png-screenshot-audit.js', 'scripts/configure-safari-recovery-probe.js', 'scripts/add-ios-screen-time-extensions.rb', 'scripts/build-ios-release-archive.js', 'scripts/ios-physical-device-evidence.js', 'scripts/release-verify.js', 'src/lib/blocking-engine.ts', 'tests/safari-adult-recovery.test.js', 'tests/safari-recovery-probe.test.js', 'tests/ios-safari-focus-shield-contract.test.js', 'ios/FREED.xcodeproj/project.pbxproj', 'assets/brand/freed-symbol.svg', 'package.json', 'package-lock.json', ...fs.readdirSync(source, { recursive: true }).filter(file => fs.lstatSync(path.join(source, file)).isFile()).map(file => path.relative(process.cwd(), path.join(source, file)))];
    const sourceInputs = Object.fromEntries([...new Set(inputFiles)].sort().map(file => [file, { sha256: sha(fs.readFileSync(file)), bytes: fs.statSync(file).size }]));
    const generated = generate(f); const first = tree(f.folder); const repeated = spawnSync('ruby', ['scripts/add-ios-screen-time-extensions.rb'], { cwd: f.root, env: { ...process.env, ...f.env, FREED_SAFARI_RECOVERY_PROBE: '0' }, encoding: 'utf8', timeout: 30000 }); assert.equal(repeated.status, 0, repeated.stdout + repeated.stderr); assert.deepEqual(tree(f.folder), first);
    const { bundle, references } = assembledBundle(f), actual = consumers();
    const archive = actual.archive(bundle), device = await actual.device(bundle, f.root);
    for (const result of [archive, device]) { assert.equal(result.adultRecoveryArtifactValid, true, JSON.stringify(result)); assert.equal(result.adultRecoveryPackageContractValid, true, JSON.stringify(result)); assert.equal(result.packageContractVariant, 'adult-recovery-internal-v1'); assert.equal(result.usableForManualEvidence, false); assert.equal(result.nativePayloadSchemaValid, true); }
    const report = {};
    for (const expectation of actual.release.expectations) {
      const keys = expectation.path.split('.'); let target = report;
      for (const key of keys.slice(0, -1)) target = target[key] ??= {};
      target[keys.at(-1)] = Object.hasOwn(expectation, 'equals') ? expectation.equals : expectation.includesAll ? [...expectation.includesAll] : expectation.numberBetween ? expectation.numberBetween[0] : 'synthetic-proof';
    }
    actual.release.assertReportProofValues(report, 'build:ios-archive:release', 'synthetic-baseline.json', {});
    report.archive.safariFocusShield = archive;
    assert.throws(() => actual.release.assertReportProofValues(report, 'build:ios-archive:release', 'adult-internal.json', {}), /safariFocusShield.usableForManualEvidence/);
    // Persist exactly the input and assembled bytes these actual consumers read.
    if (process.env.FREED_TASK94_EVIDENCE_DIR) {
      const evidence = path.resolve(process.env.FREED_TASK94_EVIDENCE_DIR); assert.equal(fs.existsSync(evidence), false, 'evidence directory must be a fresh destination'); fs.mkdirSync(evidence, { recursive: true });
      fs.cpSync(bundle, path.join(evidence, 'executed-bundle'), { recursive: true }); fs.copyFileSync(f.env.FREED_SAFARI_ADULT_FEED_PATH, path.join(evidence, 'pinned-feed.json'));
      fs.copyFileSync(path.join(f.root, 'ios/FREED.xcodeproj/project.pbxproj'), path.join(evidence, 'generated-project.pbxproj'));
      for (const [file, binding] of Object.entries(sourceInputs)) { assert.equal(sha(fs.readFileSync(file)), binding.sha256, 'executed input stayed stable'); const copy = path.join(evidence, 'source-inputs', file); fs.mkdirSync(path.dirname(copy), { recursive: true }); fs.copyFileSync(file, copy); }
      fs.writeFileSync(path.join(evidence, 'source-inputs.json'), JSON.stringify({ fixtureClockMs: now, node: process.version, platform: process.platform, arch: process.arch, files: sourceInputs }, null, 2) + '\n');
      fs.writeFileSync(path.join(evidence, 'consumer-results.json'), JSON.stringify({ fixtureOnly: true, nativeExecutableIsSourceText: true, noSignedBinaryOrDevice: true, archive, device, references, feedSha256: f.env.FREED_SAFARI_ADULT_FEED_SHA256, generatorStdout: generated.stdout }, null, 2) + '\n');
    }
    fs.appendFileSync(path.join(bundle, 'adult-recovery/page.js'), '\n// unreviewed');
    assert.equal(actual.archive(bundle).adultRecoveryArtifactValid, false); assert.equal((await actual.device(bundle, f.root)).adultRecoveryArtifactValid, false);
    for (let run = 0; run < 2; run++) {
      const reverted = spawnSync('ruby', ['scripts/add-ios-screen-time-extensions.rb'], { cwd: f.root, env: { ...process.env, EAS_BUILD_PROFILE: 'internal', FREED_SAFARI_ADULT_RECOVERY: '0', FREED_SAFARI_ADULT_FEED_PATH: undefined, FREED_SAFARI_ADULT_FEED_SHA256: undefined, FREED_SAFARI_RECOVERY_PROBE: '0' }, encoding: 'utf8', timeout: 30000 });
      assert.equal(reverted.status, 0, reverted.stdout + reverted.stderr); assert.deepEqual(tree(f.folder), originalTree, 'actual generator returns exact default resource/config bytes');
    }
  } finally { fs.rmSync(f.root, { recursive: true, force: true }); }
});

test('actual consumers preserve historical private17 production failure and its immutable receipt', async () => {
  const packet = path.resolve('.superpowers/internal-candidate-20261013-build17');
  const receiptPath = path.join(packet, 'production-artifact-inspection-failed.json');
  const bundle = path.join(packet, 'gate-exported-payload/Payload/FREED.app/PlugIns/FREEDSafariFocusShield.appex');
  const receipt = fs.readFileSync(receiptPath); assert.equal(sha(receipt), '5fba650f350e2d494d275de5f2ce50d1d8a64acff27277e23f4d21473367f87d');
  const actual = consumers(), archive = actual.archive(bundle), device = await actual.device(bundle, packet);
  for (const result of [archive, device]) {
    assert.equal(result.nativePayloadSchemaValid, true); assert.equal(result.nativeHandlerContractValid, true);
    assert.equal(result.hostPermissionsScoped, false); assert.equal(result.infoAllowedDomainsScoped, false); assert.equal(result.nativeMessagingPermission, false); assert.equal(result.usableForManualEvidence, false);
    assert.equal(result.adultRecoveryArtifactValid, false);
  }
  assert.equal(sha(fs.readFileSync(receiptPath)), sha(receipt));
});
