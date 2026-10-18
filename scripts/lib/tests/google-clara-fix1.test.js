const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const contract = require('../google-clara-release-evidence');
const { fixture } = require('./google-clara-fixture');
const verifier = require('../../release-verify');
const deploymentPath = '.superpowers/sdd/2026-10-05-daily-usability-release-completion/deployed-source-comparison.json';

function withFixture(run) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'freed-clara-fix1-'));
  try { run(root, fixture(root)); }
  finally { fs.rmSync(root, { recursive: true, force: true }); }
}

test('backend drift cannot claim the same reviewed deployment', () => withFixture((root) => {
  fs.appendFileSync(path.join(root, 'functions/src/clara-cloud.ts'), '\n// changed backend after reviewed deployment\n');
  assert.throws(() => contract.currentCandidate(root), /backend|source|deployment/i);
}));

test('missing deployment compiled coverage must fail', () => withFixture((root) => {
  const file = path.join(root, deploymentPath);
  const comparison = JSON.parse(fs.readFileSync(file));
  comparison.find(row => row.function === contract.IDENTITY.callable).matchedFiles = [];
  fs.writeFileSync(file, JSON.stringify(comparison));
  assert.throws(() => contract.currentCandidate(root), /coverage|comparison|deployment/i);
}));

test('later override cannot reuse a stale deployment/source association', () => withFixture((root) => {
  const later = 'docs/validation/artifacts/controlled-contract-fixture/later-deployment.json';
  const comparison = JSON.parse(fs.readFileSync(path.join(root, deploymentPath)));
  comparison.find(row => row.function === contract.IDENTITY.callable).revision = 'generategoogleclarareply-later';
  fs.writeFileSync(path.join(root, later), JSON.stringify(comparison));
  const prior = process.env.FREED_CLARA_DEPLOYMENT_BINDING;
  process.env.FREED_CLARA_DEPLOYMENT_BINDING = later;
  try { assert.throws(() => contract.currentCandidate(root), /association|deployment/i); }
  finally {
    if (prior === undefined) delete process.env.FREED_CLARA_DEPLOYMENT_BINDING;
    else process.env.FREED_CLARA_DEPLOYMENT_BINDING = prior;
  }
}));

test('valid and forged v2 reports traverse the actual generic artifact verifier', () => withFixture((root, f) => {
  const artifactDir = 'docs/validation/artifacts/controlled-contract-fixture';
  const reportFile = path.join(root, artifactDir, 'ai-backend-smoke-report.json');
  fs.writeFileSync(reportFile, JSON.stringify(f.report));
  const originalCwd = process.cwd();
  process.chdir(root);
  try {
    assert.doesNotThrow(() => verifier.assertReportArtifact('smoke:ai-backend', artifactDir));
    const validRows = JSON.parse(JSON.stringify(f.report.results));
    f.report.results[0].detail = 'A detail field is unsupported in the exact v2 row schema';
    fs.writeFileSync(reportFile, JSON.stringify(f.report));
    assert.throws(() => verifier.assertReportArtifact('smoke:ai-backend', artifactDir), /non-PASS|result/i);
    f.report.results = validRows;
    f.capture('remote-response', { ...contract.PROOFS['remote-response'], provider: 'fallback' });
    fs.writeFileSync(reportFile, JSON.stringify(f.report));
    assert.throws(() => verifier.assertReportArtifact('smoke:ai-backend', artifactDir), /remote-response/);
    f.capture('remote-response');
    f.report.summary.passCount = 99;
    fs.writeFileSync(reportFile, JSON.stringify(f.report));
    assert.throws(() => verifier.assertReportArtifact('smoke:ai-backend', artifactDir), /summary|counts/i);
  } finally { process.chdir(originalCwd); }
}));

test('missing comparison coverage and foreign source associations fail', () => withFixture((root) => {
  const file = path.join(root, deploymentPath);
  const originalComparison = fs.readFileSync(file);
  const comparison = JSON.parse(originalComparison);
  delete comparison.find(row => row.function === contract.IDENTITY.callable).matchedFiles;
  fs.writeFileSync(file, JSON.stringify(comparison));
  assert.throws(() => contract.currentCandidate(root), /coverage|comparison/i);
  fs.writeFileSync(file, originalComparison);

  const receiptPath = path.join(root, '.superpowers/sdd/2026-10-05-daily-usability-release-completion/clara-backend-source-binding.json');
  const receipt = JSON.parse(fs.readFileSync(receiptPath));
  receipt.association.identity.projectId = 'foreign-project';
  fs.writeFileSync(receiptPath, JSON.stringify(receipt));
  assert.throws(() => contract.currentCandidate(root), /foreign|association/i);
}));

test('source receipts require transitive and package/compiler configuration coverage', () => withFixture((root) => {
  const receiptPath = path.join(root, '.superpowers/sdd/2026-10-05-daily-usability-release-completion/clara-backend-source-binding.json');
  const originalReceipt = fs.readFileSync(receiptPath);
  for (const missingInput of ['functions/src/transactional.ts', 'functions/package-lock.json', 'functions/tsconfig.json']) {
    const receipt = JSON.parse(originalReceipt);
    delete receipt.inputSha256s[missingInput];
    fs.writeFileSync(receiptPath, JSON.stringify(receipt));
    assert.throws(() => contract.currentCandidate(root), /inputs|coverage/i, missingInput);
  }
  fs.writeFileSync(receiptPath, originalReceipt);
  fs.appendFileSync(path.join(root, 'functions/src/ai-quota.ts'), '\n// transitive runtime drift\n');
  assert.throws(() => contract.currentCandidate(root), /inputs|backend/i);
}));

test('resealing new source hashes cannot impersonate the reviewed compiled archive', () => withFixture((root) => {
  const source = 'functions/src/clara-cloud.ts';
  fs.appendFileSync(path.join(root, source), '\n// unreviewed source change\n');
  const receiptPath = path.join(root, '.superpowers/sdd/2026-10-05-daily-usability-release-completion/clara-backend-source-binding.json');
  const receipt = JSON.parse(fs.readFileSync(receiptPath));
  receipt.inputSha256s[source] = contract.sha(fs.readFileSync(path.join(root, source)));
  fs.writeFileSync(receiptPath, JSON.stringify(receipt));
  assert.throws(() => contract.currentCandidate(root), /reproduce|compiled/i);
}));

test('later native candidates retain reproducible backend association and reject backend drift', () => withFixture((root, f) => {
  const artifactDir = 'docs/validation/artifacts/controlled-contract-fixture';
  const candidate = JSON.parse(fs.readFileSync(path.join(root, f.report.binding.candidateBindingArtifact)));
  const inventory = JSON.parse(fs.readFileSync(path.join(root, '.superpowers/native-closure-20261005/source-daily-usability-v6-comfort.json')));
  candidate.sourceSnapshot = inventory.label = 'controlled-later-candidate';
  candidate.version = '1.1';
  candidate.buildNumber = '4';
  const keys = {
    FREED_CLARA_CANDIDATE_BINDING: `${artifactDir}/later-candidate.json`,
    FREED_CLARA_SOURCE_INVENTORY: `${artifactDir}/later-inventory.json`,
    FREED_CLARA_SIGNED_BINARY: `${artifactDir}/later.ipa`,
  };
  fs.writeFileSync(path.join(root, keys.FREED_CLARA_CANDIDATE_BINDING), JSON.stringify(candidate));
  fs.writeFileSync(path.join(root, keys.FREED_CLARA_SOURCE_INVENTORY), JSON.stringify(inventory));
  fs.copyFileSync(path.join(root, '.superpowers/native-closure-20261005/FREED-internal-3-v6.ipa'), path.join(root, keys.FREED_CLARA_SIGNED_BINARY));
  const previous = Object.fromEntries(Object.keys(keys).map(key => [key, process.env[key]]));
  Object.assign(process.env, keys);
  try {
    const later = contract.currentCandidate(root);
    assert.equal(later.version, '1.1');
    assert.equal(later.buildNumber, '4');
    assert.notDeepEqual(later, f.report.binding, 'Old captures cannot be associated with the later candidate.');
    assert.match(contract.reportIssues(f.report, root).join(';'), /binding mismatch/);
    fs.appendFileSync(path.join(root, 'functions/src/clara-cloud.ts'), '\n// changed later backend without deployed source association\n');
    assert.throws(() => contract.currentCandidate(root), /backend|inputs/i);
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}));
