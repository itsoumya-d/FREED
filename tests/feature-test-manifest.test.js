const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { test } = require('node:test');
const {
  buildManifest, summarize, evaluateRequirement, validateReceipt, parseArgs,
  countTestResults, validateIsolation,
} = require('../scripts/lib/feature-test-manifest');
const ledger = require('../docs/validation/artifacts/2026-10-02-native-ui-testflight/feature-ledger.json');
const { runCommand, redactLog, listLocalTests, localSuiteCommand } = require('../scripts/run-feature-verification');

test('every ledger feature has individual scenario obligations and terminal modes', () => {
  const manifest = buildManifest(ledger);
  assert.equal(manifest.baselineFeatureCount, 99);
  assert.equal(manifest.features.length, 109);
  assert.deepEqual(manifest.features.slice(0, 99).map(f => f.id), ledger.rows.map(r => r.id));
  for (const feature of manifest.features) {
    assert.ok(feature.scenarios.length >= 3, feature.id);
    assert.ok(feature.requirements.some(r => r.mode === 'local'), feature.id);
    assert.ok(feature.requirements.some(r => r.mode === 'device'), feature.id);
    for (const requirement of feature.requirements) {
      assert.ok(requirement.assertions.length > 0, `${feature.id}:${requirement.mode}`);
      assert.ok(requirement.nextAction, `${feature.id}:${requirement.mode}`);
    }
  }
});

test('premium catalog appends coverage without mutating the historical ledger', () => {
  const before = JSON.stringify(ledger);
  const manifest = buildManifest(ledger);
  const additions = manifest.features.slice(99);
  assert.deepEqual(additions.map(feature => feature.id), ['feature-100', 'feature-101', 'feature-102', 'feature-103', 'feature-104', 'feature-105', 'feature-106', 'feature-107', 'feature-108', 'feature-109']);
  assert.equal(JSON.stringify(ledger), before);
  assert.ok(additions.every(feature => feature.catalog === 'premium-verification'));
  assert.ok(additions.every(feature => feature.requirements.filter(requirement => requirement.mode !== 'local').every(requirement => requirement.receiptRequired)));
  const outcomes = additions.flatMap(feature => feature.requirements.map(requirement => evaluateRequirement(requirement, { suites: {}, receipts: [] })));
  assert.equal(summarize(outcomes).total, additions.reduce((total, feature) => total + feature.requirements.length, 0));
  assert.equal(summarize(outcomes).passed, 0);
  assert.match(additions.find(feature => feature.id === 'feature-104').scenarios.map(s => s.expected).join(' '), /consent.*release.gate|release.gate.*consent/i);
  assert.match(additions.find(feature => feature.id === 'feature-106').scenarios.map(s => s.expected).join(' '), /unavailable.*retry|retry.*unavailable/i);
});

test('UI Jest suites are discovered recursively and dispatched without the Node test runner', () => {
  assert.ok(listLocalTests().includes('tests/ui/preferences-screen.test.tsx'));
  assert.deepEqual(localSuiteCommand('tests/ui/preferences-screen.test.tsx'), ['node_modules/jest/bin/jest.js', '--runInBand', '--watch=false', '--runTestsByPath', 'tests/ui/preferences-screen.test.tsx']);
  assert.deepEqual(localSuiteCommand('tests/core.test.ts'), ['scripts/run-ts-entry.js', 'tests/core.test.ts']);
  assert.deepEqual(localSuiteCommand('tests/feature-test-manifest.test.js'), ['--test', '--test-concurrency=1', 'tests/feature-test-manifest.test.js']);
});

test('missing or failed local suites cannot become passed feature evidence', () => {
  const requirement = { mode: 'local', suites: ['tests/core.test.ts'], assertions: ['known events reconcile'] };
  assert.equal(evaluateRequirement(requirement, { suites: {} }).status, 'not-run');
  assert.equal(evaluateRequirement(requirement, { suites: { 'tests/core.test.ts': { status: 'failed' } } }).status, 'failed');
  assert.equal(evaluateRequirement(requirement, { suites: { 'tests/core.test.ts': { status: 'passed' } } }).status, 'passed');
});

test('passing UI automation is only smoke evidence until scenario receipt exists', () => {
  const requirement = { id: 'feature-048:ios', mode: 'ios', flow: 'checkin-save', assertions: ['saved check-in survives restart'] };
  const result = evaluateRequirement(requirement, { flows: { 'checkin-save': { status: 'passed' } }, receipts: [] });
  assert.equal(result.status, 'blocked');
  assert.equal(result.uiSmoke, 'passed');
  assert.match(result.reason, /receipt/i);
});

test('native runner refuses passed receipts without current installed binary identity', () => {
  const requirement = { id: 'feature-048:ios', mode: 'ios', assertions: ['persistence'], receiptRequired: true };
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'freed-feature-current-build-'));
  try {
    fs.writeFileSync(path.join(directory, 'fixture.log'), 'Disposable test execution fixture');
    const receipt = { requirementId: requirement.id, status: 'passed', generatedAt: new Date().toISOString(), appBuildSha256: 'a'.repeat(64), platform: 'ios', device: { id: 'test-sim', physical: false }, assertions: [{ id: 'persistence', status: 'passed', artifact: 'fixture.log' }], artifacts: [{ path: 'fixture.log', sha256: crypto.createHash('sha256').update(fs.readFileSync(path.join(directory, 'fixture.log'))).digest('hex') }] };
    const result = evaluateRequirement(requirement, { receipts: [{ receipt, baseDirectory: directory }], expected: {} });
    assert.equal(result.status, 'blocked');
    assert.match(result.reason, /build-sha256|current.*build/i);
  } finally { fs.rmSync(directory, { recursive: true, force: true }); }
});

test('coverage includes blocked and not-run rows in its denominator', () => {
  const summary = summarize([{ status: 'passed' }, { status: 'failed' }, { status: 'blocked' }, { status: 'not-run' }]);
  assert.deepEqual(summary, { total: 4, passed: 1, failed: 1, blocked: 1, notRun: 1, passedPercent: 25, complete: false });
  assert.equal(summarize([]).complete, false);
});

test('native receipts require build identity, every assertion, and real artifact hashes', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'freed-feature-evidence-'));
  try {
    const artifact = path.join(directory, 'trace.json');
    fs.writeFileSync(artifact, JSON.stringify({ observed: 'checked a disposable fixture' }));
    const requirement = { id: 'feature-048:ios', mode: 'ios', assertions: ['persistence'] };
    const receipt = {
      requirementId: requirement.id, status: 'passed', generatedAt: new Date().toISOString(),
      appBuildSha256: 'a'.repeat(64), platform: 'ios', device: { id: 'isolated-device', physical: false },
      assertions: [{ id: 'persistence', status: 'passed', artifact: 'trace.json' }],
      artifacts: [{ path: 'trace.json', sha256: crypto.createHash('sha256').update(fs.readFileSync(artifact)).digest('hex') }],
    };
    assert.equal(validateReceipt(receipt, requirement, directory).valid, true);
    assert.equal(validateReceipt({ ...receipt, assertions: [] }, requirement, directory).valid, false);
    fs.writeFileSync(artifact, 'modified');
    assert.equal(validateReceipt(receipt, requirement, directory).valid, false);
  } finally { fs.rmSync(directory, { recursive: true, force: true }); }
});

test('a simulator recording cannot pass a physical-device or measured motion check', () => {
  const requirement = { id: 'feature-047:device:ios', mode: 'device', platform: 'ios', assertions: ['timing'], motion: true };
  const receipt = { requirementId: requirement.id, status: 'passed', generatedAt: new Date().toISOString(), appBuildSha256: 'a'.repeat(64), platform: 'ios', device: { id: 'sim', physical: false }, assertions: [{ id: 'timing', status: 'passed' }], artifacts: [] };
  assert.match(validateReceipt(receipt, requirement, process.cwd()).reason, /physical/i);
  const physical = { ...receipt, device: { id: 'test-phone', physical: true } };
  assert.match(validateReceipt(physical, requirement, process.cwd()).reason, /motion|frame|trace/i);
});

test('receipt artifacts cannot escape their folder or reuse stale build evidence', () => {
  const requirement = { id: 'feature-001:ios', mode: 'ios', assertions: ['routing'] };
  const receipt = { requirementId: requirement.id, status: 'passed', generatedAt: new Date().toISOString(), appBuildSha256: 'a'.repeat(64), platform: 'ios', device: { id: 'sim', physical: false }, assertions: [{ id: 'routing', status: 'passed', artifact: '../private.txt' }], artifacts: [{ path: '../private.txt', sha256: 'b'.repeat(64) }] };
  assert.equal(validateReceipt(receipt, requirement, process.cwd(), { appBuildSha256: 'c'.repeat(64) }).valid, false);
  assert.equal(validateReceipt(receipt, requirement, process.cwd()).valid, false);
});

test('terminal arguments reject accidental shared device execution and unknown modes', () => {
  assert.throws(() => parseArgs(['--mode', 'anything']), /mode/i);
  assert.throws(() => parseArgs(['--mode', 'ios', '--run-ui']), /device|isolation/i);
  assert.throws(() => parseArgs(['--mode', 'ios', '--run-ui', '--device', '20494937-BC1B-427D-92B4-914FD9C1848D', '--isolation', 'fixture.json']), /preserv|owner|shared/i);
  assert.throws(() => parseArgs(['--mode', 'ios', '--run-ui', '--device', 'fresh-sim,20494937-BC1B-427D-92B4-914FD9C1848D', '--isolation', 'fixture.json']), /single|owner|preserv/i);
  assert.equal(parseArgs(['--mode', 'local', '--feature', 'feature-048']).feature, 'feature-048');
  assert.equal(parseArgs(['--catalog', 'premium']).catalog, 'premium');
  assert.throws(() => parseArgs(['--catalog', 'unknown']), /catalog/i);
});

test('zero exit and skipped cases are not mistaken for complete test coverage', () => {
  assert.deepEqual(countTestResults('PASS first\nPASS second\n'), { passed: 2, failed: 0, skipped: 0 });
  assert.deepEqual(countTestResults('ℹ tests 8\nℹ pass 7\nℹ fail 0\nℹ skipped 1\n'), { passed: 7, failed: 0, skipped: 1 });
  assert.deepEqual(countTestResults('# pass 12\n# fail 2\n# skipped 3\n'), { passed: 12, failed: 2, skipped: 3 });
  assert.deepEqual(countTestResults('PASS tests/ui/preferences-screen.test.tsx\nTests:       1 skipped, 2 failed, 6 passed, 9 total\n'), { passed: 6, failed: 2, skipped: 1 });
  assert.deepEqual(countTestResults('Tests:       2 todo, 4 passed, 6 total\n'), { passed: 4, failed: 0, skipped: 2 });
});

test('UI fixture binds disposable identity and refuses production service or real communication', () => {
  const options = { device: 'test-sim', mode: 'ios' };
  const fixture = { schemaVersion: 'freed-disposable-ui-fixture-v1', deviceId: 'test-sim', platform: 'ios', disposable: true, dataOwner: 'test-only', services: 'disabled', allowRealEmail: false, allowRealPurchases: false, allowRealMessages: false };
  assert.equal(validateIsolation(fixture, options).valid, true);
  assert.equal(validateIsolation({ ...fixture, deviceId: 'someone-else' }, options).valid, false);
  assert.equal(validateIsolation({ ...fixture, services: 'production' }, options).valid, false);
  assert.equal(validateIsolation({ ...fixture, allowRealEmail: true }, options).valid, false);
});

test('actual child process failures and skips produce honest execution statuses', async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'freed-feature-child-'));
  try {
    // Exercise exit/skip classification independently of compiler-load timing.
    const options = { timeoutMs: 10000, logPath: path.join(directory, 'failed.log') };
    const failure = await runCommand(process.execPath, ['-e', 'process.exitCode = 1'], options);
    assert.equal(failure.status, 'failed');
    assert.equal(failure.exitCode, 1);
    const skipped = await runCommand(process.execPath, ['-e', 'console.log("# pass 2\\n# fail 0\\n# skipped 1")'], { ...options, logPath: path.join(directory, 'skipped.log') });
    assert.equal(skipped.status, 'blocked');
    assert.equal(skipped.counts.skipped, 1);
    const passed = await runCommand(process.execPath, ['-e', 'console.log("PASS actual fixture assertion")'], { ...options, logPath: path.join(directory, 'passed.log') });
    assert.equal(passed.status, 'passed');
    assert.equal(passed.counts.passed, 1);
  } finally { fs.rmSync(directory, { recursive: true, force: true }); }
});
test('generated logs redact local home-profile paths while retaining actionable relative context', () => {
  assert.equal(redactLog('Error at /Users/tester/Developer/FREED/scripts/audit.js:7'), 'Error at ~/Developer/FREED/scripts/audit.js:7');
  assert.equal(redactLog('Build /home/tester/FREED/artifact.json'), 'Build ~/FREED/artifact.json');
});

test('Momentum protection and membership regressions remain wired into their individual feature obligations', () => {
  const features = buildManifest(ledger).features;
  const suites = id => features.find(feature => feature.id === id).suites;
  for (const id of ['feature-020', 'feature-021', 'feature-022']) {
    assert.ok(suites(id).includes('tests/focus-shield-rollout.test.ts'));
    assert.ok(suites(id).includes('tests/focus-shield-native-policy.test.js'));
  }
  assert.ok(suites('feature-028').includes('tests/native-intervention-authority.test.ts'));
  assert.ok(suites('feature-065').includes('tests/membership-summary.test.ts'));
  assert.ok(suites('feature-106').includes('tests/native-iap-lifecycle.test.ts'));
});

test('public Basic Help remains a required native/device scenario with its own local UI suite', () => {
  const feature = buildManifest(ledger).features.find(item => item.id === 'feature-030');
  assert.ok(feature.suites.includes('tests/ui/public-basic-help.test.tsx'));
  const acceptance = feature.scenarios.map(item => item.expected).join(' ');
  assert.match(acceptance, /hydrating.*welcome.*unavailable account.*unacknowledged offer/);
  assert.match(acceptance, /background.*lost focus.*Reduce Motion.*RTL.*large text/);
  assert.match(acceptance, /drafts.*operation fence.*mounted/);
  for (const requirement of feature.requirements.filter(item => item.mode !== 'local')) {
    assert.ok(feature.scenarios.every(scenario => requirement.assertions.includes(scenario.id)));
    assert.notEqual(evaluateRequirement(requirement, {receipts: [], suites: {}, flows: {}}).status, 'passed');
  }
});
