const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const root = path.resolve(__dirname, '..');
const modulePath = path.join(root, 'scripts/momentum-review-plan.js');
const load = () => require(modulePath);
function unitBuildCapture(directory, sourceFingerprint, artifactSha256) {
    // Synthetic test receipt only: never emitted into the repository or a device report.
    const file = path.join(directory, 'unit-build-capture.json');
    const capture = { schemaVersion: 'freed-compiled-source-binding-v1', capturePhase: 'build-input', capturedBy: 'external-native-build', sourceFingerprint, artifactSha256, sourceCapturedAt: '2026-10-03T10:00:00Z', buildStartedAt: '2026-10-03T10:00:01Z', buildFinishedAt: '2026-10-03T10:01:00Z' };
    fs.writeFileSync(file, JSON.stringify(capture));
    return { buildCapturePath: file, buildCaptureSha256: require('node:crypto').createHash('sha256').update(fs.readFileSync(file)).digest('hex') };
}

const input = () => ({
    matrix: JSON.parse(fs.readFileSync(path.join(root, 'docs/implementation/screen-review-matrix.json'), 'utf8')), treatments: JSON.parse(fs.readFileSync(path.join(root, 'docs/implementation/momentum-surface-treatment-map.json'), 'utf8'))
});
test('review plan implementation exists before any native-cell completeness claim', () => assert.ok(fs.existsSync(modulePath), 'Missing deterministic native review planner'));
test('joins 85 inherited review units and public Help into 3440 unique native cells without fabricating execution', () => {
    const { buildPlan } = load();
    const data = input();
    const before = JSON.stringify(data);
    const plan = buildPlan({
        ...data, root
    });
    assert.equal(plan.surfaces.length, 86);
    assert.equal(plan.cells.length, 3440);
    assert.equal(new Set(plan.cells.map(c => c.id)).size, 3440);
    assert.equal(plan.summary.execution.passed, 0);
    assert.equal(plan.summary.execution['not-run'], 2140);
    assert.equal(plan.summary.execution.blocked, 1300);
    assert.equal(JSON.stringify(data), before);
    assert.ok(plan.cells.every(c => !c.nativeEvidence.length));
});
test('rejects duplicate or unmatched surfaces and unsupported language coverage', () => {
    const { buildPlan } = load();
    let data = input();
    data.treatments.surfaces.pop();
    assert.throws(() => buildPlan({
        ...data, root
    }), /surface sets|treatment|missing/i);
    data = input();
    data.matrix.surfaces[1].surface = data.matrix.surfaces[0].surface;
    assert.throws(() => buildPlan({
        ...data, root
    }), /duplicate/i);
    data = input();
    delete data.matrix.surfaces[0].checks.ko;
    assert.throws(() => buildPlan({
        ...data, root
    }), /ko.*coverage|coverage.*ko/i);
});
test('shared/source checks never promote a native platform cell to passed', () => {
    const { buildPlan } = load();
    const data = input();
    data.matrix.surfaces[0].checks.en.light.layout = 'passed';
    data.matrix.surfaces[0].checks.en.light.evidence = ['source-composition'];
    const plan = buildPlan({
        ...data, root
    });
    assert.equal(plan.cells.find(c => c.surface === 'splash' && c.language === 'en' && c.theme === 'light' && c.platform === 'ios').status, 'not-run');
});
test('flow inventory accepts the ten current language rows and rejects retired selectors in isolated fixtures', () => {
    const { inventoryFlows, sourceSelectors } = load();
    const index = sourceSelectors(root);
    const flows = inventoryFlows(root, index);
    const language = flows.find(f => f.name === 'preferences-language');
    const rowIds = [...new Set(language.selectors.map(selector => selector.id).filter(id => /^language-(?:en|hi|es|pt|fr|de|ar|ja|ko|zh-Hans)$/.test(id)))].sort();
    assert.deepEqual(rowIds, ['language-ar', 'language-de', 'language-en', 'language-es', 'language-fr', 'language-hi', 'language-ja', 'language-ko', 'language-pt', 'language-zh-Hans']);
    assert.equal(language.gaps.some(gap => ['retired-language', 'obsolete-language-container'].includes(gap.reason)), false);
    assert.ok(language.selectors.filter(selector => rowIds.includes(selector.id)).every(selector => selector.evidence.confirmed));
    assert.ok(flows.find(f => f.name === 'root-navigation').localeSensitiveTextSelectors.length > 0);

    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'freed-retired-flow-selectors-'));
    try {
        fs.mkdirSync(path.join(directory, '.maestro/flows'), { recursive: true });
        fs.writeFileSync(path.join(directory, '.maestro/flows/retired-language.yaml'), 'appId: app.freed.recovery\nname: retired-language\n---\n- tapOn: { id: "language-bn" }\n- assertVisible: { id: "language" }\n- tapOn: { id: "language-ko" }\n');
        const [obsolete] = inventoryFlows(directory, index);
        assert.deepEqual(obsolete.gaps.map(gap => ({ selector: gap.selector, reason: gap.reason })), [
            { selector: 'language-bn', reason: 'retired-language' },
            { selector: 'language', reason: 'obsolete-language-container' }
        ]);
        assert.equal(obsolete.selectors.find(selector => selector.id === 'language-ko').evidence.confirmed, true);
    } finally {
        fs.rmSync(directory, { recursive: true, force: true });
    }
});
test('guard rejects owner data, missing/mismatched installed/source binding and changed source', () => {
    const { validateGuard } = load();
    assert.throws(() => validateGuard({}, 'a'.repeat(64), root), /disposable|fixture/i);
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'freed-review-guard-'));
    try {
        fs.writeFileSync(path.join(directory, 'binary'), 'test binary');
        const crypto = require('node:crypto');
        const hash = crypto.createHash('sha256').update('test binary').digest('hex');
        const guard = {
            fixture: {
                schemaVersion: 'freed-disposable-ui-fixture-v1', deviceId: 'DISPOSABLE-TEST', platform: 'ios', disposable: true, dataOwner: 'test-only', services: 'disabled', allowRealEmail: false, allowRealPurchases: false, allowRealMessages: false
            }, baseline: {
                language: 'en', theme: 'light', rtl: false, onboardingComplete: true
            }, binding: {
                sourceFingerprint: 'a'.repeat(64), artifactPath: path.join(directory, 'binary'), artifactSha256: hash, installedBinarySha256: hash, installedSourceFingerprint: 'a'.repeat(64), deviceId: 'DISPOSABLE-TEST'
            }
        };
        Object.assign(guard.binding, unitBuildCapture(directory, 'a'.repeat(64), hash));
        assert.equal(validateGuard(guard, 'a'.repeat(64), root).platform, 'ios');
        assert.throws(() => validateGuard({
            ...guard, binding: {
                ...guard.binding, installedBinarySha256: 'b'.repeat(64)
            }
        }, 'a'.repeat(64), root), /installed.*binary|binary.*mismatch/i);
        assert.throws(() => validateGuard(guard, 'c'.repeat(64), root), /source.*mismatch|source.*changed/i);
        assert.throws(() => validateGuard({
            ...guard, fixture: {
                ...guard.fixture, dataOwner: 'owner'
            }
        }, 'a'.repeat(64), root), /disposable|fixture/i);
    }
    finally {
        fs.rmSync(directory, {
            recursive: true, force: true
        });
    }
});
test('candidate native sweeps use observed routes/selectors, retain blockers and never reset/run UI', () => {
    const { buildPlan, renderSweep } = load();
    const plan = buildPlan({
        ...input(), root
    });
    const flow = renderSweep(plan, {
        platform: 'android', language: 'ko', theme: 'dark'
    });
    assert.match(flow, /language-ko/);
    assert.doesNotMatch(flow, /language-bn|clearState|clearKeychain|eraseDevice|evalScript/);
    assert.match(flow, /screen-main-today/);
    assert.ok(plan.surfaces.some(s => s.requirements.includes('store-sandbox')));
    assert.ok(plan.surfaces.some(s => s.requirements.includes('physical-camera')));
    assert.ok(plan.summary.coverageGapSurfaceCount > 0);
    assert.ok(plan.surfaces.every(s => s.reviewed === false));
});
test('fingerprint and plan are deterministic and bind source changes', () => {
    const { fingerprint, buildPlan } = load();
    const files = ['src/lib/app-preferences.ts', 'src/components/PreferencesScreen.tsx'];
    assert.equal(fingerprint(root, files).sha256, fingerprint(root, [...files].reverse()).sha256);
    const first = buildPlan({
        ...input(), root
    });
    const second = buildPlan({
        ...input(), root
    });
    assert.deepEqual(first, second);
});
test('language/theme generation is guarded and writes only scoped candidate files', () => {
    const { writeFlows, fingerprint } = load();
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'freed-review-write-'));
    try {
        assert.throws(() => writeFlows({
            sourceFingerprint: {
                sha256: fingerprint(directory).sha256
            }
        }, {}, directory), /disposable|fixture/i);
        assert.equal(fs.existsSync(path.join(directory, '.maestro/momentum-review')), false);
    }
    finally {
        fs.rmSync(directory, {
            recursive: true, force: true
        });
    }
});
test('source matrix blocked check remains blocked without platform-pass inference', () => {
    const { buildPlan } = load();
    const data = input();
    data.matrix.surfaces[0].checks.en.light.layout = 'blocked-awaiting-fixture';
    const p = buildPlan({
        ...data, root
    });
    const c = p.cells.find(c => c.surface === data.matrix.surfaces[0].surface && c.platform === 'ios' && c.language === 'en' && c.theme === 'light');
    assert.equal(c.status, 'blocked');
    assert.equal(c.blockReason, 'blocked-awaiting-fixture');
});
test('bound generation emits twenty source-observed flows and rejects stale source before writing', () => {
    const { buildPlan, writeFlows, fingerprint } = load();
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'freed-review-positive-'));
    try {
        for (const language of [
            'en', 'hi', 'es', 'pt', 'fr', 'de', 'ar', 'ja', 'ko', 'zh-Hans'
        ]) {
            const folder = path.join(directory, 'src/i18n/locales');
            fs.mkdirSync(folder, {
                recursive: true
            });
            fs.copyFileSync(path.join(root, `src/i18n/locales/${language}.json`), path.join(folder, `${language}.json`));
        }
        const binary = path.join(directory, 'binary');
        fs.writeFileSync(binary, 'unit-test binary');
        const crypto = require('node:crypto'), hash = crypto.createHash('sha256').update('unit-test binary').digest('hex');
        const current = fingerprint(directory).sha256;
        const plan = {
            ...buildPlan({
                ...input(), root
            }), sourceFingerprint: {
                sha256: current
            }
        };
        const guard = {
            fixture: {
                schemaVersion: 'freed-disposable-ui-fixture-v1', deviceId: 'UNIT-DISPOSABLE', platform: 'ios', disposable: true, dataOwner: 'test-only', services: 'disabled', allowRealEmail: false, allowRealPurchases: false, allowRealMessages: false
            }, baseline: {
                language: 'en', theme: 'light', rtl: false, onboardingComplete: true
            }, binding: {
                deviceId: 'UNIT-DISPOSABLE', sourceFingerprint: current, installedSourceFingerprint: current, artifactPath: binary, artifactSha256: hash, installedBinarySha256: hash
            }
        };
        Object.assign(guard.binding, unitBuildCapture(directory, current, hash));
        const result = writeFlows(plan, guard, directory);
        assert.equal(result.files.length, 20);
        assert.equal(result.status, 'generated-not-executed');
        const flow = fs.readFileSync(path.join(directory, '.maestro/momentum-review/ios-ko-dark.yaml'), 'utf8');
        assert.match(flow, /language-ko/);
        assert.match(flow, /다크/);
        assert.doesNotMatch(flow, /UNBOUND|clearState|clearKeychain|eraseDevice/);
        fs.writeFileSync(path.join(directory, 'src/i18n/locales/en.json'), '{"changed":true}');
        assert.throws(() => writeFlows(plan, guard, directory), /Source changed/);
    }
    finally {
        fs.rmSync(directory, {
            recursive: true, force: true
        });
    }
});

test('all assets, canonical tokens, dependency locks and bundler configs invalidate source binding', () => {
    const { fingerprint } = load();
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'freed-review-inputs-'));
    try {
        for (const file of ['assets/brand/companion.bin', 'assets/animations/breathing.lottie', 'design/freed.mobile.tokens.json', 'package-lock.json', 'ios/Podfile.lock', 'babel.config.js', 'metro.config.js']) {
            const target = path.join(directory, file);
            fs.mkdirSync(path.dirname(target), { recursive: true });
            fs.writeFileSync(target, 'original');
            const before = fingerprint(directory).sha256;
            fs.writeFileSync(target, 'changed');
            assert.notEqual(fingerprint(directory).sha256, before, `Unbound build input: ${file}`);
        }
    } finally { fs.rmSync(directory, { recursive: true, force: true }); }
});

test('source guard refuses post-edit claims without an external build-time capture receipt', () => {
    const { validateGuard } = load();
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'freed-build-input-proof-'));
    try {
        const binary = path.join(directory, 'binary');
        fs.writeFileSync(binary, 'unit-test binary');
        const crypto = require('node:crypto'), hash = crypto.createHash('sha256').update('unit-test binary').digest('hex');
        const guard = { fixture: { schemaVersion: 'freed-disposable-ui-fixture-v1', deviceId: 'UNIT-DISPOSABLE', platform: 'ios', disposable: true, dataOwner: 'test-only', services: 'disabled', allowRealEmail: false, allowRealPurchases: false, allowRealMessages: false }, baseline: { language: 'en', theme: 'light', rtl: false, onboardingComplete: true }, binding: { deviceId: 'UNIT-DISPOSABLE', sourceFingerprint: 'a'.repeat(64), installedSourceFingerprint: 'a'.repeat(64), artifactPath: binary, artifactSha256: hash, installedBinarySha256: hash } };
        assert.throws(() => validateGuard(guard, 'a'.repeat(64), directory), /build-time|build capture/i);
    } finally { fs.rmSync(directory, { recursive: true, force: true }); }
});

test('build capture authored after compilation is rejected even if file hashes match', () => {
    const { validateGuard } = load();
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'freed-build-order-'));
    try {
        const binary = path.join(directory, 'binary'); fs.writeFileSync(binary, 'unit-test binary');
        const crypto = require('node:crypto'), hash = crypto.createHash('sha256').update('unit-test binary').digest('hex');
        const receipt = unitBuildCapture(directory, 'a'.repeat(64), hash);
        const capture = JSON.parse(fs.readFileSync(receipt.buildCapturePath, 'utf8'));
        capture.sourceCapturedAt = '2026-10-03T11:00:00Z'; fs.writeFileSync(receipt.buildCapturePath, JSON.stringify(capture));
        receipt.buildCaptureSha256 = crypto.createHash('sha256').update(fs.readFileSync(receipt.buildCapturePath)).digest('hex');
        const guard = { fixture: { schemaVersion: 'freed-disposable-ui-fixture-v1', deviceId: 'UNIT-DISPOSABLE', platform: 'ios', disposable: true, dataOwner: 'test-only', services: 'disabled', allowRealEmail: false, allowRealPurchases: false, allowRealMessages: false }, baseline: { language: 'en', theme: 'light', rtl: false, onboardingComplete: true }, binding: { deviceId: 'UNIT-DISPOSABLE', sourceFingerprint: 'a'.repeat(64), installedSourceFingerprint: 'a'.repeat(64), artifactPath: binary, artifactSha256: hash, installedBinarySha256: hash, ...receipt } };
        assert.throws(() => validateGuard(guard, 'a'.repeat(64), directory), /build-time source capture/);
    } finally { fs.rmSync(directory, { recursive: true, force: true }); }
});

test('public presentation contributes all forty pending cells and its four actual entry surfaces', () => {
    const {buildPlan, LANGUAGES, THEMES, PLATFORMS} = load();
    const plan = buildPlan({...input(), root});
    const help = plan.surfaces.find(row => row.surface === 'public-basic-help');
    assert.equal(help.kind, 'public-presentation');
    assert.deepEqual(help.entrySurfaces, ['splash', 'welcome', 'account', 'paywall']);
    assert.equal(help.source, 'src/components/BasicHelp.tsx');
    assert.equal(help.renderer, 'BasicHelpPresentation');
    assert.equal(help.anchor, null);
    assert.ok(help.coverageGaps.includes('public-modal-requires-entry-and-auth-transition-fixtures'));
    const cells = plan.cells.filter(cell => cell.surface === help.surface);
    assert.equal(cells.length, 40);
    for (const language of LANGUAGES) for (const theme of THEMES) for (const platform of PLATFORMS) {
        const cell = cells.find(item => item.language === language && item.theme === theme && item.platform === platform);
        assert.equal(cell.status, 'not-run'); assert.deepEqual(cell.nativeEvidence, []);
        assert.deepEqual(cell.entrySurfaces, help.entrySurfaces);
        assert.ok(cell.requirements.includes('public-support-entry-state-fixture'));
        assert.ok(cell.requirements.includes('no-cloud-store-ad-or-private-state'));
    }
    assert.equal(plan.dimensions.publicPresentationCount, 1);
    assert.equal(plan.dimensions.publicPresentationCellCount, 40);
    assert.equal(plan.dimensions.inheritedSurfaceCount, 85);
});
test('planner requires real source markers and rejects omitted or duplicate public presentations', () => {
    const {buildPlan} = load();
    let data = input(); data.treatments.publicPresentations = [];
    assert.throws(() => buildPlan({...data, root}), /surface sets/i);
    data = input(); data.treatments.publicPresentations.push(data.treatments.publicPresentations[0]);
    assert.throws(() => buildPlan({...data, root}), /duplicate/i);
    data = input(); data.treatments.surfaces.find(row => row.surface === 'coach/cloud-unavailable').sourceEvidence[0].markers.push('not-an-authored-marker');
    assert.throws(() => buildPlan({...data, root}), /source.*marker|marker.*source/i);
    data = input(); data.treatments.publicPresentations[0].entrySurfaces.push('invented-route');
    assert.throws(() => buildPlan({...data, root}), /entry.*surface/i);
});
