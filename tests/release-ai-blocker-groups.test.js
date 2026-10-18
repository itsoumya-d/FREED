const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const { mkdtempSync, readFileSync, writeFileSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join, resolve } = require('node:path');
const { test } = require('node:test');
const { productionBlockerGroups } = require('../scripts/lib/release-blocker-groups');
const { getProductionBlockerGroups } = require('../scripts/release-env-preflight');

const script = resolve(__dirname, '../scripts/release-env-preflight.js');
const legacyAi = {
  EXPO_PUBLIC_AI_COACH_MODE: 'remote',
  EXPO_PUBLIC_AI_COACH_ENDPOINT: 'https://api.freedrecovery.app/api/clara',
  EXPO_PUBLIC_AI_CHALLENGE_MODE: 'remote',
  EXPO_PUBLIC_AI_CHALLENGE_ENDPOINT: 'https://api.freedrecovery.app/api/challenges',
  FREED_AI_PROVIDER: 'openai',
  OPENAI_API_KEY: 'sk-proj-controlled-shape-fixture-12345678901234567890',
  OPENAI_MODEL: 'gpt-4.1-mini',
  EXPO_PUBLIC_RETENTION_MODE: 'local'
};
const legacyCheckIds = [
  'server-secret-public-leakage', 'ai-coach-mode', 'ai-coach-endpoint',
  'ai-challenge-mode', 'ai-challenge-endpoint', 'server-ai-key', 'optional-retention-endpoint'
];

function preflight(provider, additions = {}, envFile = false, processProvider = 'firebase') {
  const root = mkdtempSync(join(tmpdir(), 'freed-ai-group-'));
  try {
    const values = { ...legacyAi, EXPO_PUBLIC_BACKEND_PROVIDER: provider, ...additions };
    const report = 'docs/validation/artifacts/checks/report.json';
    const args = [script, '--report', report];
    const env = { PATH: process.env.PATH, HOME: process.env.HOME };
    if (envFile) {
      env.EXPO_PUBLIC_BACKEND_PROVIDER = processProvider;
      writeFileSync(join(root, 'release.env'), Object.entries(values).map(([key, value]) => `${key}=${value}`).join('\n'));
      args.push('--env-file', join(root, 'release.env'));
    } else Object.assign(env, values);
    const result = spawnSync(process.execPath, args, { cwd: root, env, encoding: 'utf8', timeout: 20_000 });
    assert.ifError(result.error);
    // The isolated fixture intentionally omits unrelated signing, store, and backend configuration.
    assert.equal(result.status, 1, result.stdout + result.stderr);
    return JSON.parse(readFileSync(join(root, report), 'utf8'));
  } finally { rmSync(root, { recursive: true, force: true }); }
}

function aiGroup(report) {
  return report.blockerGroups.find(group => group.id === 'production-ai-backend');
}

test('legacy and supabase AI groups propagate actual configuration failures', () => {
  const cases = [
    ['server-ai-key', { OPENAI_API_KEY: '' }],
    ['server-ai-key', { OPENAI_API_KEY: 'malformed' }],
    ['server-ai-key', { OPENAI_MODEL: '' }],
    ['server-ai-key', { FREED_AI_PROVIDER: 'unsupported' }],
    ['server-ai-key', { FREED_AI_PROVIDER: 'gemini' }],
    ['server-ai-key', { FREED_AI_PROVIDER_TIMEOUT_MS: '1' }],
    ['server-ai-key', { FREED_AI_PROVIDER_RESPONSE_MAX_BYTES: '1' }],
    ['ai-coach-mode', { EXPO_PUBLIC_AI_COACH_MODE: '' }],
    ['ai-coach-mode', { EXPO_PUBLIC_AI_COACH_MODE: 'local' }],
    ['ai-challenge-mode', { EXPO_PUBLIC_AI_CHALLENGE_MODE: '' }],
    ['ai-challenge-mode', { EXPO_PUBLIC_AI_CHALLENGE_MODE: 'local' }],
    ['ai-coach-endpoint', { EXPO_PUBLIC_AI_COACH_ENDPOINT: '' }],
    ['ai-challenge-endpoint', { EXPO_PUBLIC_AI_CHALLENGE_ENDPOINT: '' }],
    ['ai-coach-endpoint', { EXPO_PUBLIC_AI_COACH_ENDPOINT: 'https://api.freedrecovery.app/api/challenges' }],
    ['ai-challenge-endpoint', { EXPO_PUBLIC_AI_CHALLENGE_ENDPOINT: 'http://localhost/api/challenges' }],
    ['ai-coach-endpoint', { EXPO_PUBLIC_AI_COACH_TIMEOUT_MS: '1' }],
    ['ai-challenge-endpoint', { EXPO_PUBLIC_AI_CHALLENGE_TIMEOUT_MS: '99999' }],
    ['ai-coach-endpoint', { EXPO_PUBLIC_AI_COACH_ENDPOINT: 'https://api.freedrecovery.app/api/clara?token=private' }],
    ['ai-challenge-endpoint', { EXPO_PUBLIC_AI_CHALLENGE_ENDPOINT: 'https://user:private@api.freedrecovery.app/api/challenges' }],
    ['server-secret-public-leakage', { EXPO_PUBLIC_OPENAI_API_KEY: legacyAi.OPENAI_API_KEY }],
    ['optional-retention-endpoint', { EXPO_PUBLIC_RETENTION_MODE: 'unsupported' }],
    ['optional-retention-endpoint', { EXPO_PUBLIC_RETENTION_MODE: 'remote' }],
    ['optional-retention-endpoint', { EXPO_PUBLIC_RETENTION_ENDPOINT: 'https://api.freedrecovery.app/api/clara' }],
    ['optional-retention-endpoint', { EXPO_PUBLIC_RETENTION_TIMEOUT_MS: '1' }]
  ];
  for (const provider of ['legacy', 'supabase']) for (const [id, mutation] of cases) {
    const report = preflight(provider, mutation);
    assert.equal(report.checks.find(check => check.id === id).status, 'fail', `${provider}: ${id} validation`);
    assert.equal(aiGroup(report).status, 'fail', `${provider}: ${id} must block AI configuration`);
    assert.ok(aiGroup(report).failedPreflightChecks.some(check => check.id === id), `${provider}: ${id} must be reported`);
    assert.equal(JSON.stringify(report).includes(legacyAi.OPENAI_API_KEY), false, 'Synthetic server credentials must stay out of reports');
  }
});

test('valid legacy AI configuration remains separate from current runtime evidence', () => {
  for (const provider of ['legacy', 'supabase']) {
    const report = preflight(provider);
    const group = aiGroup(report);
    assert.equal(group.status, 'pass');
    assert.deepEqual(group.preflightCheckIds, legacyCheckIds);
    assert.deepEqual(group.failedPreflightChecks, []);
    assert.deepEqual(group.missingPreflightCheckIds, []);
    assert.ok(group.requiredReports.some(command => command.includes('smoke:ai-backend')));
    assert.equal(group.evidenceFile, 'docs/validation/evidence/ai-backend-smoke.json');
    assert.equal(report.blockerGroups.find(entry => entry.id === 'ai-backend-smoke-validation').status, 'external');
  }
  const gemini = preflight('legacy', { FREED_AI_PROVIDER: 'gemini', OPENAI_API_KEY: '', GEMINI_API_KEY: 'AIzaControlledShapeFixture12345678901234567890', GEMINI_MODEL: 'gemini-2.5-flash' });
  assert.equal(aiGroup(gemini).status, 'pass', 'Configured legacy provider alternatives remain compatibility validation only');
});

test('env-file selection binds the AI group to the resolved compatibility provider', () => {
  for (const provider of ['legacy', 'supabase', 'LEGACY']) {
    const report = preflight(provider, {}, true);
    assert.equal(report.backendProvider, 'legacy');
    assert.equal(aiGroup(report).status, 'pass');
    assert.deepEqual(aiGroup(report).preflightCheckIds, legacyCheckIds);
    const malformed = preflight(provider, { OPENAI_API_KEY: 'malformed' }, true);
    assert.equal(aiGroup(malformed).status, 'fail');
    assert.ok(aiGroup(malformed).failedPreflightChecks.some(check => check.id === 'server-ai-key'));
  }
  const firebase = preflight('firebase', { OPENAI_API_KEY: '', OPENAI_MODEL: '' }, true, 'legacy');
  assert.equal(firebase.backendProvider, 'firebase');
  assert.equal(aiGroup(firebase).preflightCheckIds.includes('server-ai-key'), false);
  assert.ok(aiGroup(firebase).failedPreflightChecks.some(check => check.id === 'firebase-production-runtime-evidence'));
});

test('Firebase keeps current runtime proof without legacy static-key or remote recovery requirements', () => {
  const report = preflight('firebase', { OPENAI_API_KEY: '', OPENAI_MODEL: '', EXPO_PUBLIC_AI_CHALLENGE_MODE: 'local' });
  const group = aiGroup(report);
  assert.equal(group.status, 'fail');
  assert.ok(group.failedPreflightChecks.some(check => check.id === 'firebase-production-runtime-evidence'));
  assert.ok(group.preflightCheckIds.includes('firebase-backend-config'));
  assert.ok(group.preflightCheckIds.includes('firebase-production-runtime-evidence'));
  for (const id of legacyCheckIds.filter(id => id !== 'server-secret-public-leakage')) {
    assert.equal(group.preflightCheckIds.includes(id), false, id);
    assert.equal(report.checks.some(check => check.id === id), false, id);
  }
  const original = process.env.EXPO_PUBLIC_BACKEND_PROVIDER;
  try {
    delete process.env.EXPO_PUBLIC_BACKEND_PROVIDER;
    const direct = productionBlockerGroups().find(entry => entry.id === 'production-ai-backend');
    assert.deepEqual(direct.preflightCheckIds, ['server-secret-public-leakage', 'firebase-backend-config', 'firebase-production-runtime-evidence']);
    assert.deepEqual(getProductionBlockerGroups('docs/validation/artifacts/checks', 'firebase').find(entry => entry.id === group.id).preflightCheckIds, group.preflightCheckIds);
  } finally {
    if (original === undefined) delete process.env.EXPO_PUBLIC_BACKEND_PROVIDER;
    else process.env.EXPO_PUBLIC_BACKEND_PROVIDER = original;
  }
});
