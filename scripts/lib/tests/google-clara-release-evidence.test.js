const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const c = require('../google-clara-release-evidence');
const { fixture } = require('./google-clara-fixture');
test('current CLARA production capture schema rejects missing, legacy, forged and private proof', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'freed-clara-contract-'));
  try {
    const f = fixture(root);
    const original = JSON.stringify(f.report);
    assert.deepEqual(c.evidenceIssues(f.save(), root), [], 'Controlled offline acceptance is a schema self-test only');
    const bad = (mutate, pattern) => {
      Object.assign(f.report, JSON.parse(original));
      mutate(f.report);
      assert.match(c.reportIssues(f.report, root).join(';'), pattern);
    };
    bad(r => r.schemaVersion = 'ai-backend-smoke-v1', /v1/);
    bad(r => r.source = 'emulator', /production.native/);
    bad(r => r.generatedAt = '2025-01-01T00:00:00.000Z', /stale/);
    for (const [key, value] of [['projectId', 'foreign'], ['model', 'gemini-2.5-flash'], ['runtimeIdentity', 'owner@example.org']])
      bad(r => r.identity = { ...r.identity, [key]: value }, /identity/);
    bad(r => r.binding = { ...r.binding, buildNumber: 2 }, /binding/);
    bad(r => r.binding = { ...r.binding, binarySha256: '1'.repeat(64) }, /binding/);
    bad(r => r.binding = { ...r.binding, revision: '1'.repeat(40) }, /binding/);
    bad(r => r.results[0].status = 'fallback', /non-PASS/);
    bad(r => r.results[0].status = 'unknown', /non-PASS/);
    bad(r => r.results[1].id = r.results[0].id, /duplicate/);
    bad(r => r.summary.passCount = 99, /summary/);
    bad(r => r.captureArtifacts.pop(), /capture/);
    bad(r => r.captureArtifacts[0].sha256 = '1'.repeat(64), /deployment/);
    bad(r => r.captureArtifacts[0].path = '../outside.json', /deployment/);
    bad(r => r.architecture = { ...r.architecture, challenges: 'REMOTE' }, /local recovery/);
    bad(r => r.architecture = { ...r.architecture, candidatePhotos: 'AVAILABLE' }, /unavailable/);
    Object.assign(f.report, JSON.parse(original));
    for (const kind of c.REQUIRED_RESULT_IDS) {
      f.capture(kind, { ...c.PROOFS[kind], rawPrompt: 'private' });
      assert.match(c.reportIssues(f.report, root).join(';'), /private|capture/);
      f.capture(kind);
    }
    f.capture('remote-response', { ...c.PROOFS['remote-response'], provider: 'fallback' });
    assert.match(c.reportIssues(f.report, root).join(';'), /remote-response/);
    f.capture('remote-response');
    f.capture('local-recovery', { ...c.PROOFS['local-recovery'], networkRequests: 1 });
    assert.match(c.reportIssues(f.report, root).join(';'), /local-recovery/);
    f.capture('local-recovery');
    f.capture('deployment', c.PROOFS.deployment, { source: 'production-native' });
    assert.match(c.reportIssues(f.report, root).join(';'), /deployment/);
    f.capture('deployment');
    f.capture('signed-client', { ...c.PROOFS['signed-client'], authenticated: false });
    assert.match(c.reportIssues(f.report, root).join(';'), /signed-client/);
    f.capture('signed-client', c.PROOFS['signed-client'], { generatedAt: '2025-01-01T00:00:00.000Z' });
    assert.match(c.reportIssues(f.report, root).join(';'), /signed-client/);
    f.capture('signed-client');
    bad(report => report.captureArtifacts[1].path = report.captureArtifacts[0].path, /duplicate capture/);
    Object.assign(f.report, JSON.parse(original));
    let p = f.save();
    p.ai.smokeReportSha256 = '1'.repeat(64);
    assert.match(c.evidenceIssues(p, root).join(';'), /checksummed/);
    p = f.save();
    p.ai.retentionEndpoint = 'https://invalid';
    assert.match(c.evidenceIssues(p, root).join(';'), /obsolete/);
    p = f.save();
    p.build = '1.0 (2)';
    assert.match(c.evidenceIssues(p, root).join(';'), /timestamp\/build/);
    p = f.save();
    p.validatedAt = '2025-01-01T00:00:00.000Z';
    assert.match(c.evidenceIssues(p, root).join(';'), /timestamp\/build/);
    p = f.save();
    p.checks.signedClientVerified = false;
    assert.match(c.evidenceIssues(p, root).join(';'), /mandatory/);
    p = f.save();
    p.rawPrompt = 'private';
    assert.match(c.evidenceIssues(p, root).join(';'), /private/);
    assert.doesNotThrow(() => require('../../release-verify').assertGoogleClaraReport(f.report, root));
    assert.throws(() => require('../../release-verify').assertGoogleClaraReport({ schemaVersion: 'ai-backend-smoke-v1' }, root), /production-native/);
    fs.symlinkSync(path.join(root, f.report.captureArtifacts[0].path), path.join(root, 'docs/validation/artifacts/controlled-contract-fixture/symlink.json'));
    bad(r => r.captureArtifacts[0].path = 'docs/validation/artifacts/controlled-contract-fixture/symlink.json', /capture/);
    for (const value of ['-----BEGIN PRIVATE KEY-----', 'Bearer controlled-secret-value', 'AIza' + 'x'.repeat(32), 'sk-proj-' + 'x'.repeat(32), 'eyJabc.defghijklmnop.signature', '/Users/controlled/private'])
      assert.equal(c.privateData(value), true);
    for (const field of ['input', 'conversation', 'journal', 'photos', 'browsingHistory', 'nativeSignals', 'latitude', 'idToken', 'appCheckToken'])
      assert.equal(c.privateData(JSON.stringify({ [field]: 'controlled' })), true);
    for (const suffix of ['?token=secret', '#secret'])
      assert.throws(() => c.validateEndpoint(c.ENDPOINT + suffix));
    assert.throws(() => c.validateEndpoint('https://user:pass@asia-south1-freed-7d5ee.cloudfunctions.net/generateGoogleClaraReply'));
    assert.throws(() => c.validateEndpoint('https://asia-south1-other.cloudfunctions.net/generateGoogleClaraReply'));
  }
  finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
