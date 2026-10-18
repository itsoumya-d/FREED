// Controlled contract fixture only. Caller deletes the OS temporary root; never release evidence.
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const contract = require('../google-clara-release-evidence');
const backend = require('../clara-deployment-source-binding');

function fixture(root) {
  const origin = process.cwd();
  const copy = file => {
    const destination = path.join(root, file);
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.copyFileSync(path.join(origin, file), destination);
  };
  const write = (file, bytes) => {
    const destination = path.join(root, file);
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.writeFileSync(destination, bytes);
  };
  fs.mkdirSync(root, { recursive: true });
  const gitDir = execFileSync('git', ['rev-parse', '--absolute-git-dir'], { encoding: 'utf8' }).trim();
  write('.git', `gitdir: ${gitDir}\n`);

  const sourceReceiptPath = backend.DEFAULTS.FREED_CLARA_BACKEND_SOURCE_BINDING;
  const sourceReceipt = JSON.parse(fs.readFileSync(path.join(origin, sourceReceiptPath)));
  const association = sourceReceipt.association;
  const sourceFiles = new Set([...contract.SOURCE_FILES, ...Object.keys(sourceReceipt.inputSha256s)]);
  sourceFiles.forEach(copy);
  [sourceReceiptPath, association.archivesArtifact, association.comparisonArtifact, association.archiveArtifact].forEach(copy);
  Object.keys(association.compiledSha256s).forEach(file => copy(`${association.stage}/source/${file}`));
  copy(`${association.stage}/firebase.json`);
  copy(`${association.stage}/source-receipt.json`);
  // Only compiler dependency resolution uses this symlink; captured/source/receipt inputs cannot use it.
  fs.symlinkSync(path.join(origin, 'functions/node_modules'), path.join(root, 'functions/node_modules'), 'dir');

  const artifactDir = 'docs/validation/artifacts/controlled-contract-fixture';
  const candidatePath = 'docs/validation/artifacts/2026-10-05-internal-candidate/binary-source-binding.json';
  const inventoryPath = '.superpowers/native-closure-20261005/source-daily-usability-v6-comfort.json';
  const binaryPath = '.superpowers/native-closure-20261005/FREED-internal-3-v6.ipa';
  const nativeFiles = Object.fromEntries(Object.entries(contract.sourceHashes(root))
    .filter(([file]) => !file.startsWith('functions/')));
  const inventory = {
    label: 'controlled-offline-candidate',
    inventorySha256: contract.sha(JSON.stringify(nativeFiles)),
    sourceStableDuringCopy: true,
    files: nativeFiles,
  };
  const binary = Buffer.from('OFFLINE CONTRACT SELF TEST; NOT A SIGNED APP');
  const candidate = {
    sourceSnapshot: inventory.label,
    sourceInventorySha256: inventory.inventorySha256,
    version: '1.0',
    buildNumber: '3',
    codeSignatureStrictVerification: 'PASS',
    artifactGate: 'PASS',
    ipaSha256: contract.sha(binary),
  };
  write(candidatePath, JSON.stringify(candidate));
  write(inventoryPath, JSON.stringify(inventory));
  write(binaryPath, binary);
  fs.mkdirSync(path.join(root, artifactDir), { recursive: true });

  const binding = contract.currentCandidate(root);
  const report = {
    schemaVersion: contract.REPORT_SCHEMA,
    generatedAt: new Date().toISOString(),
    sanitized: true,
    source: 'production-native',
    identity: contract.IDENTITY,
    architecture: contract.ARCHITECTURE,
    binding,
    captureArtifacts: [],
    results: contract.REQUIRED_RESULT_IDS.map(id => ({ id, status: 'PASS' })),
    summary: { passCount: contract.REQUIRED_RESULT_IDS.length, failCount: 0 },
  };

  function capture(kind, proof = contract.PROOFS[kind], change = {}) {
    const artifactPath = `${artifactDir}/capture-${kind}.json`;
    const raw = JSON.stringify({
      schemaVersion: 'freed-google-clara-capture-v2',
      generatedAt: report.generatedAt,
      sanitized: true,
      source: kind === 'deployment' ? 'production-deployment' : 'production-native',
      identity: contract.IDENTITY,
      binding,
      kind,
      proof,
      ...change,
    });
    write(artifactPath, raw);
    const item = { kind, path: artifactPath, sha256: contract.sha(raw) };
    const index = report.captureArtifacts.findIndex(artifact => artifact.kind === kind);
    if (index < 0) report.captureArtifacts.push(item);
    else report.captureArtifacts[index] = item;
  }
  contract.REQUIRED_RESULT_IDS.forEach(kind => capture(kind));

  const reportPath = `${artifactDir}/report.json`;
  function save() {
    const raw = JSON.stringify(report);
    write(reportPath, raw);
    return {
      schemaVersion: contract.EVIDENCE_SCHEMA,
      validatedAt: report.generatedAt,
      tester: 'Controlled schema self test',
      build: '1.0 (3)',
      environment: 'Offline contract fixture',
      evidence: [reportPath],
      ai: { smokeReportArtifact: reportPath, smokeReportSha256: contract.sha(raw) },
      checks: Object.fromEntries(contract.CHECKS.map(key => [key, true])),
    };
  }
  return { report, capture, save, reportPath };
}

module.exports = { fixture };
