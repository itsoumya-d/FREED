import { INTERCEPTION_CAPABILITY_REGISTRY as registry, INTERCEPTION_HANDOFF_CONTRACTS, type InterceptionCapability, type InterceptionPlatform } from './interception-capabilities';
import { evaluateDeclaredRecoveryCoverage } from './declared-recovery-coverage';

export type InterceptionBinding = {
  platform: InterceptionPlatform;
  sourceSnapshot: string; // SHA-256 of the frozen source manifest, including uncommitted files.
  binarySha256: string;
  deviceId: string;
  osVersion: string;
};
export type InterceptionReleaseRequest = {
  audience: 'public' | 'internal-testing';
  contractVersion: 2;
  capabilityId: string;
  candidate: InterceptionBinding;
  browserIds: readonly string[];
  newlyInstalledBrowserIds: readonly string[];
  browserInventory: unknown;
  evidence: readonly unknown[];
};
export type InterceptionReleaseIssue = { code: string; detail: string; requirement: string };
export type InterceptionReleaseResult = {
  registryVersion: number;
  contractVersion: number;
  publicReleaseAllowed: boolean;
  internalTestingAllowed: boolean;
  reasons: InterceptionReleaseIssue[];
};
const scenarios = ['existing-browser', 'newly-installed-browser', 'private-browsing', 'encrypted-dns-bypass', 'network-change'] as const;
const networks = ['wifi', 'cellular'] as const;
const memberships = ['free', 'premium', 'unknown'] as const;
const sha256 = /^[a-f0-9]{64}$/;
const object = (value: unknown): Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
const text = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0 && value.length <= 512;
const platform = (value: unknown): value is InterceptionPlatform => value === 'ios' || value === 'android';
function validBinding(value: Record<string, unknown>): boolean {
  return platform(value.platform) && typeof value.sourceSnapshot === 'string' && sha256.test(value.sourceSnapshot)
    && typeof value.binarySha256 === 'string' && sha256.test(value.binarySha256) && text(value.deviceId) && text(value.osVersion);
}
function broadBlocking(path: InterceptionCapability): boolean {
  return path.target === 'adult-web' && path.coverage === 'all-existing-and-new-browsers' && path.blocking.api === 'supported';
}
function supportedRecoveryHandoff(path: InterceptionCapability): boolean {
  return broadBlocking(path) && path.detection.api === 'supported' && path.handoff.api === 'supported'
    && ['automatic-app-entry', 'primary-shield-tap', 'notification-tap', 'extension-open-freed-action'].includes(path.handoff.method);
}
function matchesHandoffPath(path: InterceptionCapability | undefined, entryMethod: unknown): boolean {
  if (!path) return false;
  const method = { 'automatic-app-entry': 'automatic', 'primary-shield-tap': 'shield-primary-tap', 'notification-tap': 'notification-tap', 'extension-open-freed-action': 'extension-open-freed-action' };
  return entryMethod === method[path.handoff.method as keyof typeof method] && entryMethod !== undefined;
}
function validHandoffActionProof(row: Record<string, unknown>): boolean {
  const proof = object(row.handoff);
  if (proof.foregroundAppId !== 'app.freed.recovery' || proof.recoveryEntered !== true) return false;
  if (row.entryMethod === 'automatic') {
    return proof.action === 'none' && proof.productActionCount === 0 && proof.osConfirmationCount === 0;
  }
  return proof.action === 'open-freed' && proof.productActionCount === 1
    && (proof.osConfirmationCount === 0 || proof.osConfirmationCount === 1);
}

function eligiblePath(path: InterceptionCapability): boolean {
  // No current registered path meets this. Future API findings require a reviewed registry/code revision.
  return supportedRecoveryHandoff(path) && path.consumerStoreEligibility === 'eligible'
    && [path.blocking, path.detection, path.handoff].every((step) => step.implementation === 'reviewed-implemented');
}
function artifactBound(value: unknown): boolean {
  const artifact = object(value);
  return text(artifact.path) && !artifact.path.startsWith('/') && !artifact.path.includes('\\') && !artifact.path.split('/').includes('..')
    && !artifact.path.includes('://') && typeof artifact.sha256 === 'string' && sha256.test(artifact.sha256);
}
function matchesBinding(value: unknown, candidate: Record<string, unknown>): boolean {
  const binding = object(value);
  return validBinding(candidate) && validBinding(binding)
    && ['platform', 'sourceSnapshot', 'binarySha256', 'deviceId', 'osVersion'].every((key) => binding[key] === candidate[key]);
}
function fresh(value: unknown, nowMs: number): boolean {
  return typeof value === 'number' && Number.isFinite(value) && Number.isFinite(nowMs) && value > 0
    && value <= nowMs && nowMs - value <= registry.maxEvidenceAgeMs;
}

/** Frozen version 2 universal contract retained for historical packets and tests. */
function evaluateUniversalInterceptionReleaseGateV2(request: unknown, nowMs = Date.now()): InterceptionReleaseResult {
  const input = object(request);
  const candidate = object(input.candidate);
  const reasons: InterceptionReleaseIssue[] = [];
  const add = (code: string, detail: string, requirement: string) => reasons.push({ code, detail, requirement });
  if (input.contractVersion !== registry.contractVersion) add('request-contract-version-mismatch', 'The request is not bound to the current automatic-or-one-action recovery contract.', 'Use contract version 2 for new captures; retain automatic-only version 1 packets as historical evidence.');
  const knownPlatform = platform(candidate.platform);
  if (!knownPlatform || (input.audience !== 'public' && input.audience !== 'internal-testing')) {
    add('request-invalid', 'A known native platform and explicit audience are required.', 'Select iOS or Android and distinguish public release from private internal testing.');
  }
  const paths = registry.paths.filter((path) => !knownPlatform || path.platform === candidate.platform);
  if (!paths.some(broadBlocking)) add('universal-blocking-api-unavailable', 'No registered API covers adult blocking in every existing and newly installed browser.', 'Register primary public-API and store-policy evidence covering nonparticipating/custom encrypted-DNS stacks; narrow DNS or Safari proof cannot substitute.');
  if (!paths.some(supportedRecoveryHandoff)) add('universal-recovery-handoff-api-unavailable', 'No registered API supports automatic entry or one clear Open FREED action for every-browser adult attempts.', 'Demonstrate an eligible public API and every-browser scope; a proven shield, notification or extension action can satisfy its documented scope, while narrow paths cannot establish universal coverage.');
  const path = paths.find((entry) => entry.id === input.capabilityId);
  if (!path || !eligiblePath(path)) add('candidate-api-path-ineligible', path ? path.limits.join(' ') : 'No matching capability is registered for this platform.', 'A reviewed registry revision must establish the complete adult consumer API/store contract; a supplied capability object cannot register itself.');
  if (!validBinding(candidate)) add('candidate-binding-invalid', 'The candidate source manifest hash, binary hash, platform, device and OS must all be concrete.', 'Freeze the complete dirty source manifest and signed binary; bind the exact physical device and OS.');
  const browserIds = Array.isArray(input.browserIds) && input.browserIds.length > 0 && input.browserIds.length <= 100
    && input.browserIds.every(text) && new Set(input.browserIds).size === input.browserIds.length ? input.browserIds as string[] : [];
  if (!browserIds.length) add('browser-inventory-missing', 'No concrete, nonduplicate installed-browser inventory was supplied.', 'Attach and review a device inventory artifact and record the browser installed after protection setup.');
  const newlyInstalledBrowserIds = Array.isArray(input.newlyInstalledBrowserIds) && input.newlyInstalledBrowserIds.length > 0
    && input.newlyInstalledBrowserIds.every((id) => text(id) && browserIds.includes(id))
    && new Set(input.newlyInstalledBrowserIds).size === input.newlyInstalledBrowserIds.length ? input.newlyInstalledBrowserIds as string[] : [];
  if (!newlyInstalledBrowserIds.length) add('new-browser-inventory-missing', 'No inventoried browser installed after protection setup was identified.', 'Record the post-setup installation and its binding to the candidate/device; a Safari-only baseline cannot demonstrate new-browser coverage.');
  const inventory = object(input.browserInventory);
  if (inventory.kind !== 'physical-device' || !matchesBinding(inventory.binding, candidate) || !artifactBound(inventory.artifact) || !fresh(inventory.capturedAtMs, nowMs)) add('browser-inventory-unbound', 'The browser inventory lacks matching fresh physical-device artifact proof.', 'Bind and verify the inventory artifact to this source, binary, device, OS and capture time; metadata must match the actual artifact.');
  if (typeof nowMs !== 'number' || !Number.isFinite(nowMs) || nowMs <= 0) add('request-invalid', 'Evaluation time must be a finite positive timestamp.', 'Use the release verifier clock; do not reuse the evidence capture time as a freshness override.');
  const evidence = Array.isArray(input.evidence) && input.evidence.length <= 10_000 ? input.evidence : [];
  const covered = new Set<string>();
  for (let index = 0; index < evidence.length; index += 1) {
    const row = object(evidence[index]);
    const before = reasons.length;
    const context = `Evidence ${index + 1}`;
    if (row.schemaVersion !== INTERCEPTION_HANDOFF_CONTRACTS[2].evidenceSchemaVersion || row.registryVersion !== registry.version || row.contractVersion !== registry.contractVersion) add('evidence-version-mismatch', `${context} uses an unsupported schema/registry revision.`, 'Capture against the current reviewed registry version; preserve older packets as historical observations.');
    if (row.capabilityId !== input.capabilityId || !matchesBinding(row.binding, candidate)) add('evidence-binding-mismatch', `${context} does not match this exact candidate.`, 'Bind every row to this source snapshot, signed binary, platform, physical device, OS and registered capability.');
    if (row.kind !== 'physical-device') add('physical-device-evidence-required', `${context} is not physical-device execution proof.`, 'Run the scenario on the signed binary and physical device; source tests, simulator layouts and declarations cannot prove enforcement.');
    if (row.outcome !== 'passed') add('evidence-outcome-not-passed', `${context} is failed, unavailable or unexecuted.`, 'Retain the unsuccessful observation and add a fresh successful device scenario when supported.');
    if (!fresh(row.capturedAtMs, nowMs)) add('evidence-time-invalid', `${context} is stale, future-dated or lacks a valid timestamp.`, 'Capture within seven days of the verifier clock, after freezing the candidate binary/source.');
    if (!artifactBound(row.artifact)) add('evidence-artifact-unbound', `${context} lacks a safe relative artifact path and SHA-256.`, 'Preserve the scenario artifact and verify its contents/hash in the release artifact validator; metadata alone is not authenticity proof.');
    if (row.adultContentBlocked !== true) add('adult-content-not-blocked', `${context} does not establish adult content blocking.`, 'Verify a safe category-test fixture stays blocked independently of membership.');
    if (row.ordinaryBrowsingAllowed !== true) add('ordinary-browsing-not-proved', `${context} does not establish that ordinary browsing remains available.`, 'Capture an ordinary allowed website alongside the blocked safe-category fixture on the same browser/network.');
    if (row.attemptDetected !== true) add('attempt-not-detected', `${context} does not establish detection of the covered attempt.`, 'Capture the actual native covered-attempt signal separately from saved-rule state.');
    if (row.openedFreed !== true) add('freed-not-opened', `${context} does not establish foreground FREED entry.`, 'Capture foreground app identity and recovery route separately from blocking and detection.');
    if (!(INTERCEPTION_HANDOFF_CONTRACTS[2].acceptedEntryMethods as readonly unknown[]).includes(row.entryMethod)) add('handoff-method-not-accepted', `${context} shows no accepted automatic or direct Open FREED handoff.`, 'A manual app-icon open, rendered page, browser error, attempted launch or unrelated navigation does not prove recovery entry.');
    if (!matchesHandoffPath(path, row.entryMethod)) add('evidence-handoff-path-mismatch', `${context} does not use the handoff mechanism registered for its capability.`, 'Bind the observed method to the reviewed path; a planned page, intent attempt or absent callback cannot be relabeled as an implemented direct action.');
    if (!validHandoffActionProof(row)) add('handoff-action-proof-invalid', `${context} lacks the exact product action count, separate OS confirmation and actual foreground recovery identity.`, 'Record zero product/OS actions for automatic entry, or one Open FREED action plus zero/one standard OS confirmation; observe FREED foreground and entry into recovery. Do not relabel two product actions as one.');
    if (row.beforeContentDisplayed !== true) add('content-order-unproven', `${context} lacks pre-content interruption order proof.`, 'Capture the ordered attempt, block and foreground recovery sequence using a safe category-test fixture.');
    if (!scenarios.includes(row.scenario as typeof scenarios[number]) || !browserIds.includes(row.browserId as string) || !networks.includes(row.network as typeof networks[number]) || !memberships.includes(row.membership as typeof memberships[number])) add('evidence-scenario-invalid', `${context} lacks a recognized browser/network/membership scenario.`, 'Use the exact existing/new browser, private, encrypted DNS and network-change matrix across Wi-Fi/cellular and free/Premium/unknown.');
    if (before === reasons.length) covered.add([row.browserId, row.scenario, row.network, row.membership].join('|'));
  }
  const missing: string[] = [];
  for (const browserId of browserIds) for (const scenario of scenarios) for (const network of networks) for (const membership of memberships) {
    if (scenario === 'newly-installed-browser' && !newlyInstalledBrowserIds.includes(browserId)) continue;
    const key = [browserId, scenario, network, membership].join('|');
    if (!covered.has(key)) missing.push(key);
  }
  if (!evidence.length || missing.length) add('scenario-evidence-missing', `${missing.length || 'All'} required physical-device matrix rows are missing or non-passing.`, 'Cover every inventoried browser, a newly installed browser, private browsing, encrypted-DNS bypass and network changes on Wi-Fi/cellular with free, Premium and unknown membership.');
  return {
    registryVersion: registry.version,
    contractVersion: registry.contractVersion,
    publicReleaseAllowed: input.audience === 'public' && reasons.length === 0,
    // Permits scoped development only; does not grant store submission, infrastructure provisioning or capability approval.
    internalTestingAllowed: input.audience === 'internal-testing' && knownPlatform && Boolean(path) && path?.consumerStoreEligibility !== 'ineligible',
    reasons
  };
}

/**
 * Dispatches only by the packet's explicit contract version. Version 3 uses
 * declared minimum coverage; all other inputs retain the frozen version 2
 * fail-closed behavior so old rows are never promoted.
 */
export function evaluateInterceptionReleaseGate(request: unknown, nowMs = Date.now()): InterceptionReleaseResult {
  if (object(request).contractVersion === 3) return evaluateDeclaredRecoveryCoverage(request, nowMs);
  return evaluateUniversalInterceptionReleaseGateV2(request, nowMs);
}
