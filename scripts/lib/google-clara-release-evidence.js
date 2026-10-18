/* Current release proof contract. Historical v1 evidence remains historical only. */
const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { execFileSync } = require('node:child_process');
const { isDeepStrictEqual } = require('node:util');
const backendSource = require('./clara-deployment-source-binding');

const IDENTITY = Object.freeze({
  projectId: "freed-7d5ee",
  region: "asia-south1",
  callable: "generateGoogleClaraReply",
  model: "gemini-3.5-flash-lite",
  runtimeIdentity: "freed-clara-runtime@freed-7d5ee.iam.gserviceaccount.com"
});
const ENDPOINT = 'https://asia-south1-freed-7d5ee.cloudfunctions.net/generateGoogleClaraReply';
const EVIDENCE_SCHEMA = 'freed-google-clara-evidence-v2';
const REPORT_SCHEMA = 'ai-backend-smoke-v2';
const SOURCE_FILES = [
  "functions/src/clara-cloud.ts",
  "functions/src/clara-cloud-firebase.ts",
  "functions/src/clara-google.ts",
  "functions/src/clara-quota.ts",
  "src/lib/clara-conversation.ts",
  "src/lib/firebase-feature-runtime.ts",
  "src/lib/firebase-client.ts",
  "src/lib/challenge-generator.ts",
  "src/lib/retention-orchestrator.ts"
];
const PROOFS = Object.freeze({
  deployment: {
    gateEnabled: true,
    attachedRuntime: true,
    modelAvailable: true,
    revisionBound: true
  },
  "signed-client": {
    authenticated: true,
    appCheckAccepted: true,
    limitedUseAppCheck: true,
    ownerFence: true,
    consentVersion: "clara-cloud-v1",
    explicitRequest: true,
    requestKeys: [
      "clientEventId",
      "consentVersion",
      "locale",
      "input",
      "conversation"
    ],
    deliberateConversationOnly: true
  },
  "remote-response": {
    provider: "remote",
    serviceState: "online",
    actionAllowlist: [
      "breathe",
      "journal",
      "routine",
      "none"
    ],
    responseKeys: [
      "text",
      "provider",
      "serviceState",
      "action",
      "quota"
    ],
    quotaValidated: true,
    attachedProviderSucceeded: true,
    ownerTokenSmokeOnly: false
  },
  "denial-controls": {
    unauthenticatedRejected: true,
    invalidAppCheckRejected: true,
    replayedAppCheckRejected: true,
    ownerChangeRejected: true,
    consentRevocationRejected: true
  },
  "quota-cost-controls": {
    freeLimit: 3,
    paidLimit: 20,
    dedupeRejected: true,
    rateLimitRejected: true,
    monthlyCutoffCents: 2500,
    reservationCents: 2,
    budgetCutoffVerified: true,
    expiredPriceReviewRejected: true
  },
  "privacy-transport": {
    rawTextOmitted: true,
    credentialsOmitted: true,
    journalPhotosBrowsingNativeSignalsExcluded: true,
    noSensitiveEcho: true,
    redactionVerified: true,
    contractAcquisitionTimeoutMs: 15000,
    callableRequestTimeoutMs: 15000,
    providerTimeoutMs: 11000,
    callableTimeoutSeconds: 30,
    providerResponseMaxBytes: 65536,
    replyMaxCharacters: 1200,
    responseBounded: true
  },
  fallbacks: {
    localUseful: true,
    crisisBasicHelp: true,
    unavailableUseful: true,
    providerFailureUseful: true,
    unknownStatusRejected: true,
    unsafeActionRejected: true
  },
  "local-recovery": {
    challenges: "LOCAL",
    retention: "LOCAL",
    networkRequests: 0,
    legacyProviderOptionsInactive: true,
    capabilityVerified: true,
    explicitRulesVerified: true,
    licenseAccessVerified: true,
    deterministicFallbackVerified: true,
    candidatePhotos: "UNAVAILABLE"
  }
});
const REQUIRED_RESULT_IDS = Object.keys(PROOFS);
const CHECKS = REQUIRED_RESULT_IDS.map(id => id.replace(/-([a-z])/g, (_, c) => c.toUpperCase()) + 'Verified');
const ARCHITECTURE = {
  cloudAi: "Google CLARA only",
  challenges: "LOCAL",
  retention: "LOCAL",
  candidatePhotos: "UNAVAILABLE"
};

function sha(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

function exact(value, keys) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  return Object.keys(value).length === keys.length && Object.keys(value).every(key => keys.includes(key));
}

function fresh(value, now = Date.now()) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)) return false;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) && new Date(timestamp).toISOString() === value &&
    now - timestamp <= 86_400_000 && timestamp <= now + 300_000;
}

function privateData(text) {
  const forbiddenValues = [
    /-----BEGIN|\bsk-(?:proj-)?[\w-]{16,}|\bAIza[\w-]{20,}|\bya29\./i,
    /\bBearer\s+(?!\[redacted)|\beyJ[\w-]+\.[\w-]+\.[\w-]+/i,
    /"(?:rawPrompt|rawUserInput|rawModelResponse|input|conversation|text|journal|photos|browsingHistory|nativeSignals|latitude|longitude|privateNotes|idToken|appCheckToken|accessToken|apiKey)"\s*:/i,
    /https?:\/\/[^/\s"'<>:@]+:[^/\s"'<>@]+@|\/Users\/|\/home\//i,
  ];
  return forbiddenValues.some(pattern => pattern.test(text));
}

function checkedWorkspaceFile(root, relativePath, allowedPrefixes, pattern = /^[-A-Za-z0-9_./]+$/) {
  const safeShape = typeof relativePath === 'string' && pattern.test(relativePath);
  const allowed = safeShape && allowedPrefixes.some(prefix => relativePath.startsWith(prefix));
  if (!allowed || relativePath.split('/').includes('..')) throw new Error('Unsafe evidence input path');
  let current = root;
  for (const segment of relativePath.split('/')) {
    current = path.join(current, segment);
    if (fs.lstatSync(current).isSymbolicLink()) throw new Error('Symbolic links forbidden');
  }
  if (!fs.statSync(current).isFile()) throw new Error('Evidence input must be a file');
  return current;
}

function safeFile(root, relativePath, prefix = 'docs/validation/artifacts/') {
  const absolute = checkedWorkspaceFile(root, relativePath, [prefix]);
  if (!relativePath.endsWith('.json') || fs.statSync(absolute).size > 2_000_000) {
    throw new Error('Evidence must be a bounded JSON file');
  }
  return absolute;
}

function sourceHashes(root) {
  return Object.fromEntries(SOURCE_FILES.map(file => [file, sha(fs.readFileSync(path.join(root, file)))]));
}

function revision(root) {
  return execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
}

function reviewedInput(root, key, fallback) {
  const relativePath = process.env[key] || fallback;
  const absolute = checkedWorkspaceFile(root, relativePath, ['docs/validation/artifacts/', '.superpowers/']);
  return { relativePath, raw: fs.readFileSync(absolute) };
}

function verifyFrozenNativeInputs(root, metadata, source, binaryBytes) {
  const signedBinaryMatches = metadata.codeSignatureStrictVerification === 'PASS' &&
    metadata.artifactGate === 'PASS' && metadata.ipaSha256 === sha(binaryBytes);
  const inventoryMatches = metadata.sourceSnapshot === source.label &&
    metadata.sourceInventorySha256 === source.inventorySha256 &&
    sha(JSON.stringify(source.files)) === source.inventorySha256 && source.sourceStableDuringCopy === true;
  if (!signedBinaryMatches || !inventoryMatches) throw new Error('Reviewed signed binary/source binding mismatch');
  for (const [file, digest] of Object.entries(source.files)) {
    if (!/^[-A-Za-z0-9_./()+@\[\]]+$/.test(file) || file.split('/').includes('..') || !/^[a-f0-9]{64}$/.test(digest)) {
      throw new Error('Unsafe frozen source input');
    }
    if (/^(?:scripts\/|tests\/)/.test(file)) continue; // Verification-only changes do not alter the native candidate.
    const absolute = checkedWorkspaceFile(root, file, [''], /^[-A-Za-z0-9_./()+@\[\]]+$/);
    if (sha(fs.readFileSync(absolute)) !== digest) throw new Error('Frozen native/source input changed');
  }
}

// Explicit reviewed inputs may change for a later candidate; capture claims cannot choose their authority.
function currentCandidate(root) {
  const candidate = reviewedInput(root, 'FREED_CLARA_CANDIDATE_BINDING', 'docs/validation/artifacts/2026-10-05-internal-candidate/binary-source-binding.json');
  const inventory = reviewedInput(root, 'FREED_CLARA_SOURCE_INVENTORY', '.superpowers/native-closure-20261005/source-daily-usability-v6-comfort.json');
  const binary = reviewedInput(root, 'FREED_CLARA_SIGNED_BINARY', '.superpowers/native-closure-20261005/FREED-internal-3-v6.ipa');
  const metadata = JSON.parse(candidate.raw);
  verifyFrozenNativeInputs(root, metadata, JSON.parse(inventory.raw), binary.raw);
  const backend = backendSource.validate(root, IDENTITY);
  return {
    snapshot: metadata.sourceSnapshot,
    version: metadata.version,
    buildNumber: String(metadata.buildNumber),
    platform: 'ios',
    binarySha256: metadata.ipaSha256,
    candidateBindingArtifact: candidate.relativePath,
    candidateBindingSha256: sha(candidate.raw),
    sourceInventorySha256: metadata.sourceInventorySha256,
    deploymentBindingSha256: backend.comparisonSha256,
    deploymentRevision: backend.revision,
    deploymentArchiveSha256: backend.archiveSha256,
    backendSourceBindingSha256: backend.receiptSha256,
    backendInputSha256s: backend.inputSha256s,
    revision: revision(root),
    sourceHashes: sourceHashes(root),
  };
}

function bindingIssues(binding, root) {
  try {
    if (!isDeepStrictEqual(binding, currentCandidate(root))) {
      return ['Current reviewed signed binary/source/revision/deployment binding mismatch'];
    }
  } catch {
    return ['Missing verified reviewed signed binary/source/revision/deployment binding'];
  }
  return [];
}

function resultIssues(rows, summary) {
  const results = Array.isArray(rows) ? rows : [];
  const ids = results.map(row => row?.id);
  const exactPassingRows = results.every(row => exact(row, ['id', 'status']) &&
    REQUIRED_RESULT_IDS.includes(row.id) && row.status === 'PASS');
  const completeUniqueRows = results.length === REQUIRED_RESULT_IDS.length && new Set(ids).size === results.length;
  const issues = [];
  if (!exactPassingRows || !completeUniqueRows) issues.push('Missing/duplicate/unknown/fallback/non-PASS mandatory result');
  if (!isDeepStrictEqual(summary, { passCount: REQUIRED_RESULT_IDS.length, failCount: 0 })) {
    issues.push('Forged or failing report summary');
  }
  return issues;
}

function captureIssues(report, root) {
  const artifacts = Array.isArray(report.captureArtifacts) ? report.captureArtifacts : [];
  const distinctKinds = new Set(artifacts.map(artifact => artifact?.kind)).size === artifacts.length;
  const distinctPaths = new Set(artifacts.map(artifact => artifact?.path)).size === artifacts.length;
  const issues = [];
  if (artifacts.length !== REQUIRED_RESULT_IDS.length || !distinctKinds || !distinctPaths) {
    issues.push('Missing or duplicate capture artifacts');
  }
  for (const kind of REQUIRED_RESULT_IDS) {
    try {
      const artifact = artifacts.find(item => item?.kind === kind);
      if (!exact(artifact, ['kind', 'path', 'sha256']) || !/^[a-f0-9]{64}$/.test(artifact.sha256)) {
        throw new Error('Missing capture artifact checksum');
      }
      const raw = fs.readFileSync(safeFile(root, artifact.path), 'utf8');
      if (sha(raw) !== artifact.sha256 || privateData(raw)) throw new Error('Invalid/private capture artifact');
      const capture = JSON.parse(raw);
      const validEnvelope = exact(capture, ['schemaVersion', 'generatedAt', 'sanitized', 'source', 'identity', 'binding', 'kind', 'proof']) &&
        capture.schemaVersion === 'freed-google-clara-capture-v2' && fresh(capture.generatedAt) &&
        capture.sanitized === true && capture.kind === kind;
      const expectedSource = kind === 'deployment' ? 'production-deployment' : 'production-native';
      const currentProof = capture.source === expectedSource && isDeepStrictEqual(capture.identity, IDENTITY) &&
        isDeepStrictEqual(capture.binding, report.binding) && isDeepStrictEqual(capture.proof, PROOFS[kind]);
      if (!validEnvelope || !currentProof) throw new Error('Missing current production capture proof');
    } catch {
      issues.push(`Missing fresh checksummed production capture for ${kind}`);
    }
  }
  return issues;
}

function reportIssues(report, root = process.cwd()) {
  const fields = ['schemaVersion', 'generatedAt', 'sanitized', 'source', 'identity', 'architecture', 'binding', 'captureArtifacts', 'results', 'summary'];
  const validEnvelope = exact(report, fields) && report.schemaVersion === REPORT_SCHEMA &&
    report.sanitized === true && report.source === 'production-native';
  if (!validEnvelope) {
    return ['Current ai-backend-smoke-v2 production-native report required; v1/offline/configuration reports are not release proof'];
  }
  const issues = [];
  if (privateData(JSON.stringify(report))) issues.push('Report contains raw/private/credential data');
  if (!fresh(report.generatedAt)) issues.push('Report timestamp stale or invalid');
  if (!isDeepStrictEqual(report.identity, IDENTITY)) issues.push('Wrong Google CLARA project/model/runtime identity');
  if (!isDeepStrictEqual(report.architecture, ARCHITECTURE)) {
    issues.push('Only CLARA cloud permitted; local recovery and unavailable candidate photos required');
  }
  return [...issues, ...bindingIssues(report.binding, root), ...resultIssues(report.results, report.summary), ...captureIssues(report, root)];
}

function evidenceIssues(payload, root = process.cwd()) {
  const fields = ['schemaVersion', 'validatedAt', 'tester', 'build', 'environment', 'evidence', 'ai', 'checks'];
  if (privateData(JSON.stringify(payload)) || !exact(payload, fields)) return ['AI evidence contains unknown/private fields'];
  if (payload.schemaVersion !== EVIDENCE_SCHEMA) {
    return ['Current freed-google-clara-evidence-v2 required; legacy cloud-challenge evidence is historical only'];
  }
  const ai = payload.ai;
  if (!exact(ai, ['smokeReportArtifact', 'smokeReportSha256'])) {
    return ['AI evidence requires report artifact/checksum only; obsolete endpoints and raw data forbidden'];
  }
  const issues = [];
  try {
    const raw = fs.readFileSync(safeFile(root, ai.smokeReportArtifact), 'utf8');
    const checksumMatches = /^[a-f0-9]{64}$/.test(ai.smokeReportSha256) && sha(raw) === ai.smokeReportSha256;
    if (!checksumMatches || privateData(raw)) throw new Error('Invalid/private current report');
    const report = JSON.parse(raw);
    issues.push(...reportIssues(report, root));
    if (!fresh(payload.validatedAt) || payload.build !== `${report.binding?.version} (${report.binding?.buildNumber})`) {
      issues.push('Evidence timestamp/build does not match current capture');
    }
    if (!exact(payload.checks, CHECKS) || CHECKS.some(key => payload.checks[key] !== true)) {
      issues.push('Missing mandatory evidence checks');
    }
    const references = payload.evidence;
    if (!Array.isArray(references) || !references.includes(ai.smokeReportArtifact) || new Set(references).size !== references.length) {
      issues.push('Missing/duplicate primary evidence reference');
    }
  } catch {
    issues.push('Missing sanitized checksummed current smoke report artifact');
  }
  return issues;
}

function importReport(file, root = process.cwd()) {
  const raw = fs.readFileSync(safeFile(root, file), 'utf8');
  if (privateData(raw)) throw new Error('Capture contains private data');
  const report = JSON.parse(raw);
  const issues = reportIssues(report, root);
  if (issues.length) throw new Error(issues.join('; '));
  return report;
}

function validateEndpoint(value) {
  const url = new URL(value);
  if (value !== ENDPOINT || url.username || url.password || url.search || url.hash) {
    throw new Error('Use the exact production Google CLARA callable HTTPS endpoint without URL credentials, query strings or URL fragments');
  }
  return value;
}

module.exports = {
  IDENTITY, ENDPOINT, EVIDENCE_SCHEMA, REPORT_SCHEMA, SOURCE_FILES, PROOFS,
  REQUIRED_RESULT_IDS, CHECKS, ARCHITECTURE, sha, sourceHashes, revision,
  currentCandidate, fresh, privateData, safeFile, reportIssues, evidenceIssues,
  importReport, validateEndpoint,
};
