import {
  DECLARED_RECOVERY_CAPABILITY_REGISTRY,
  INTERCEPTION_HANDOFF_CONTRACTS,
  type DeclaredRecoveryCapability,
  type InterceptionPlatform
} from './interception-capabilities';

export type DeclaredRecoveryCapabilityRegistry = {
  version: 3;
  contractVersion: 3;
  maxEvidenceAgeMs: number;
  capabilities: readonly DeclaredRecoveryCapability[];
};

export type DeclaredRecoveryIssue = { code: string; detail: string; requirement: string };
export type DeclaredRecoveryResult = {
  registryVersion: number;
  contractVersion: number;
  publicReleaseAllowed: boolean;
  internalTestingAllowed: boolean;
  reasons: DeclaredRecoveryIssue[];
};

const sha256 = /^[a-f0-9]{64}$/;
const appScenarios = [
  'threshold-interruption', 'grant-300', 'grant-600', 'grant-1200',
  'native-relock-300', 'native-relock-600', 'native-relock-1200',
  'daily-cap', 'exact-retry', 'replay-rejected', 'overlap-scope', 'clock-restart'
] as const;
const claimStatuses = ['verified-recovery', 'blocking-only', 'unsupported', 'untested', 'verified-app-journey'] as const;
const object = (value: unknown): Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
const text = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0 && value.length <= 512;
const platform = (value: unknown): value is InterceptionPlatform => value === 'ios' || value === 'android';
const stringList = (value: unknown): string[] => Array.isArray(value) && value.length <= 100 && value.every(text) ? value as string[] : [];
const unique = (values: readonly string[]) => new Set(values).size === values.length;
const sameStrings = (left: readonly string[], right: readonly string[]) => left.length === right.length
  && [...left].sort().every((value, index) => value === [...right].sort()[index]);

function validBinding(value: Record<string, unknown>, expectedPlatform?: InterceptionPlatform): boolean {
  return platform(value.platform) && (!expectedPlatform || value.platform === expectedPlatform)
    && typeof value.sourceSnapshot === 'string' && sha256.test(value.sourceSnapshot)
    && typeof value.binarySha256 === 'string' && sha256.test(value.binarySha256)
    && text(value.deviceId) && text(value.osVersion);
}

function matchesBinding(value: unknown, candidate: Record<string, unknown>): boolean {
  const binding = object(value);
  return validBinding(candidate) && validBinding(binding)
    && ['platform', 'sourceSnapshot', 'binarySha256', 'deviceId', 'osVersion'].every((key) => binding[key] === candidate[key]);
}

function artifactBound(value: unknown): boolean {
  const artifact = object(value);
  return text(artifact.path) && !artifact.path.startsWith('/') && !artifact.path.includes('\\')
    && !artifact.path.split('/').includes('..') && !artifact.path.includes('://')
    && typeof artifact.sha256 === 'string' && sha256.test(artifact.sha256);
}

function fresh(value: unknown, nowMs: number, maxAgeMs: number): boolean {
  return typeof value === 'number' && Number.isFinite(value) && Number.isFinite(nowMs)
    && value > 0 && value <= nowMs && nowMs - value <= maxAgeMs;
}

function capabilityEligible(capability: DeclaredRecoveryCapability | undefined): boolean {
  return capability?.publicApi === 'supported' && capability.storeEligibility === 'eligible'
    && capability.implementation === 'reviewed-implemented';
}

function validHandoff(row: Record<string, unknown>, capability: DeclaredRecoveryCapability): boolean {
  const accepted = capability.acceptedEntryMethods as readonly unknown[];
  const methodAccepted = row.entryMethod === 'automatic'
    ? accepted.includes('automatic')
    : (row.entryMethod === 'open-challenge' || row.entryMethod === 'open-freed')
      && (accepted.includes('open-challenge') || accepted.includes('open-freed'));
  if (!methodAccepted) return false;
  const handoff = object(row.handoff);
  if (handoff.foregroundAppId !== 'app.freed.recovery' || handoff.recoveryEntered !== true) return false;
  if (row.entryMethod === 'automatic') {
    return handoff.action === 'none' && handoff.productActionCount === 0 && handoff.osConfirmationCount === 0;
  }
  return (row.entryMethod === 'open-challenge' || row.entryMethod === 'open-freed')
    && (handoff.action === 'open-challenge' || handoff.action === 'open-freed')
    && handoff.productActionCount === 1 && (handoff.osConfirmationCount === 0 || handoff.osConfirmationCount === 1);
}

function validAppScenario(row: Record<string, unknown>): boolean {
  switch (row.scenario) {
    case 'threshold-interruption':
      return row.thresholdReached === true && row.nativeBarrierShown === true && row.recoveryEntered === true;
    case 'grant-300':
    case 'grant-600':
    case 'grant-1200': {
      const seconds = Number(String(row.scenario).slice('grant-'.length));
      return row.grantSeconds === seconds && row.challengeCompleted === true && row.completionSavedOnce === true
        && row.explicitBreakStarted === true && row.originatingAppOnly === true && row.adultWebRemainedBlocked === true
        && row.nativeDeadlineRecorded === true;
    }
    case 'native-relock-300':
    case 'native-relock-600':
    case 'native-relock-1200': {
      const seconds = Number(String(row.scenario).slice('native-relock-'.length));
      return row.grantSeconds === seconds && row.nativeDeadlineRecorded === true
        && row.freedClosedBeforeExpiry === true && row.nativeExpiryObserved === true && row.originatingAppRelocked === true;
    }
    case 'daily-cap':
      return row.dailyCapSeconds === 1200 && row.capEnforced === true;
    case 'exact-retry':
      return row.sameDeadlineReturned === true && row.spentOnce === true;
    case 'replay-rejected':
      return row.replayRejected === true && row.noAuthorityRestored === true;
    case 'overlap-scope':
      return row.otherRestrictionsPreserved === true && row.originatingAppOnly === true && row.adultWebRemainedBlocked === true;
    case 'clock-restart':
      return row.clockChangeDidNotExtend === true && row.deviceRestartDidNotExtend === true && row.relockWithoutFreedOpen === true;
    default:
      return false;
  }
}

/**
 * Pure v3 validator. Tests and offline evidence tooling may supply an explicit
 * reviewed registry. Store/public consumers must call the wrapper below,
 * which always uses the frozen source registry.
 */
export function validateDeclaredRecoveryCoverage(
  request: unknown,
  registry: DeclaredRecoveryCapabilityRegistry,
  nowMs = Date.now()
): DeclaredRecoveryResult {
  const input = object(request);
  const reasons: DeclaredRecoveryIssue[] = [];
  const add = (code: string, detail: string, requirement: string) => reasons.push({ code, detail, requirement });
  const registryValid = registry?.version === 3 && registry.contractVersion === 3
    && Number.isFinite(registry.maxEvidenceAgeMs) && registry.maxEvidenceAgeMs > 0 && Array.isArray(registry.capabilities);
  if (!registryValid) add('registry-invalid', 'The declared-coverage capability registry is corrupt or unsupported.', 'Use the reviewed version 3 source registry.');
  if (input.contractVersion !== 3) add('request-contract-version-mismatch', 'The request is not a version 3 declared-coverage packet.', 'Use contract version 3; preserve version 1 and 2 universal packets as historical evidence.');
  if (input.audience !== 'public' && input.audience !== 'internal-testing') add('request-invalid', 'An explicit public or internal-testing audience is required.', 'Declare the release audience.');
  if (!Number.isFinite(nowMs) || nowMs <= 0) add('request-invalid', 'Evaluation time is invalid.', 'Use the verifier clock.');

  const candidatesObject = object(input.candidates);
  const candidates = { ios: object(candidatesObject.ios), android: object(candidatesObject.android) };
  for (const candidatePlatform of ['ios', 'android'] as const) {
    if (!validBinding(candidates[candidatePlatform], candidatePlatform)) {
      add('candidate-binding-invalid', `The ${candidatePlatform} candidate is not bound to an exact source, binary, physical device and OS.`, 'Supply one valid binding for each platform.');
    }
  }

  const rawClaims = Array.isArray(input.claims) && input.claims.length <= 100 ? input.claims : [];
  if (!rawClaims.length) add('claims-missing', 'No declared browser or app-limit coverage was supplied.', 'Declare Safari/iOS, Chrome/Android and both app-limit journeys, plus explicit optional-path statuses.');
  const claims = rawClaims.map(object);
  const claimIds = new Set<string>();
  const claimScopes = new Set<string>();
  for (const claim of claims) {
    const claimPlatform = platform(claim.platform) ? claim.platform : undefined;
    const target = claim.target === 'browser-recovery' || claim.target === 'app-limit' ? claim.target : undefined;
    const status = (claimStatuses as readonly unknown[]).includes(claim.status) ? claim.status : undefined;
    const networks = stringList(claim.networks);
    const permissions = stringList(claim.permissions);
    const browserId = target === 'browser-recovery' && text(claim.browserId) ? claim.browserId : undefined;
    if (!text(claim.id) || !claimPlatform || !target || !status || !networks.length || !unique(networks) || !unique(permissions)
      || !text(claim.osVersion) || claim.osVersion !== candidates[claimPlatform].osVersion || (target === 'browser-recovery' && !browserId)
      || (target === 'app-limit' && status !== 'verified-app-journey')
      || (target === 'browser-recovery' && status === 'verified-app-journey')) {
      add('claim-invalid', 'A declared path has an unknown status, duplicate/invalid conditions, mismatched OS or target.', 'Bind each claim to one candidate OS and unique exact permission/network conditions.');
    }
    if (text(claim.id)) {
      if (claimIds.has(claim.id)) add('claim-duplicate', `Claim id ${claim.id} is duplicated.`, 'Declare each path once.');
      claimIds.add(claim.id);
    }
    if (claimPlatform && target) {
      const scope = [claimPlatform, target, browserId ?? 'selected-apps'].join('|');
      if (claimScopes.has(scope)) add('claim-duplicate', `Claim scope ${scope} is duplicated.`, 'Use one status per exact browser/platform or app-limit platform scope.');
      claimScopes.add(scope);
    }

    if (status === 'verified-recovery' || status === 'blocking-only' || status === 'verified-app-journey') {
      const capability = registry.capabilities.find((entry) => entry.id === claim.capabilityId);
      if (!capability || capability.platform !== claimPlatform || capability.target !== target
        || (target === 'browser-recovery' && capability.browserId !== browserId)) {
        add('claim-capability-mismatch', `Claim ${String(claim.id)} does not match its reviewed source capability.`, 'Use the exact source-registered platform, target and browser capability.');
      } else {
        if (!capabilityEligible(capability)) add('declared-capability-ineligible', `Capability ${capability.id} lacks reviewed public API, source implementation or store eligibility.`, 'Review and register all three findings before relying on device evidence.');
        if (!capability.requiredPermissions.every((permission) => permissions.includes(permission))) {
          add('claim-permissions-incomplete', `Claim ${String(claim.id)} omits required permission conditions.`, 'Declare every permission required by the reviewed capability.');
        }
      }
    }
  }

  const requiredBrowserClaims = [
    { platform: 'ios', browserId: 'safari' },
    { platform: 'android', browserId: 'chrome' }
  ] as const;
  for (const required of requiredBrowserClaims) {
    if (!claims.some((claim) => claim.platform === required.platform && claim.target === 'browser-recovery'
      && claim.browserId === required.browserId && claim.status === 'verified-recovery')) {
      add('minimum-browser-claim-missing', `${required.browserId}/${required.platform} is not declared as verified recovery.`, 'Version 3 public release requires Safari/iOS and Chrome/Android recovery.');
    }
  }
  for (const requiredPlatform of ['ios', 'android'] as const) {
    if (!claims.some((claim) => claim.platform === requiredPlatform && claim.target === 'app-limit' && claim.status === 'verified-app-journey')) {
      add('app-journey-claim-missing', `${requiredPlatform} has no complete selected-app journey claim.`, 'Declare a complete threshold, activity, 300/600/1200 grant, relock, cap, retry, replay, overlap and clock/restart journey.');
    }
  }

  const rawEvidence = Array.isArray(input.evidence) && input.evidence.length <= 10_000 ? input.evidence : [];
  const covered = new Set<string>();
  const evidenceKeys = new Set<string>();
  for (let index = 0; index < rawEvidence.length; index += 1) {
    const row = object(rawEvidence[index]);
    const before = reasons.length;
    const context = `Evidence ${index + 1}`;
    const claim = claims.find((entry) => entry.id === row.claimId);
    const claimPlatform = claim && platform(claim.platform) ? claim.platform : undefined;
    const capability = registry.capabilities.find((entry) => entry.id === row.capabilityId);
    if (row.schemaVersion !== INTERCEPTION_HANDOFF_CONTRACTS[3].evidenceSchemaVersion || row.registryVersion !== registry.version || row.contractVersion !== 3) {
      add('evidence-version-mismatch', `${context} is not bound to the version 3 registry and schema.`, 'Capture new rows under version 3; retain older rows without promotion.');
    }
    if (!claim || !claimPlatform || row.capabilityId !== claim.capabilityId || !matchesBinding(row.binding, candidates[claimPlatform])) {
      add('evidence-binding-mismatch', `${context} does not match its claim and exact candidate binding.`, 'Bind source, binary, platform, device, OS, claim and capability exactly.');
    }
    if (row.kind !== 'physical-device') add('physical-device-evidence-required', `${context} is not physical-device evidence.`, 'Source and simulator checks cannot establish enforcement or recovery.');
    if (row.outcome !== 'passed') add('evidence-outcome-not-passed', `${context} is failed, unavailable or unexecuted.`, 'Retain the row and add a distinct passing physical-device capture.');
    if (!fresh(row.capturedAtMs, nowMs, registry.maxEvidenceAgeMs)) add('evidence-time-invalid', `${context} is stale, future-dated or unbound in time.`, 'Capture within the reviewed evidence window.');
    if (!artifactBound(row.artifact)) add('evidence-artifact-unbound', `${context} lacks a safe relative artifact and SHA-256.`, 'Preserve and hash the actual capture artifact.');
    if (!claim || !stringList(claim.networks).includes(row.network as string) || !sameStrings(stringList(row.permissions), stringList(claim.permissions))) {
      add('evidence-scope-mismatch', `${context} does not match the claim's exact network and permissions.`, 'Do not infer results across permissions or networks.');
    }
    const evidenceKey = [String(row.claimId), String(row.scenario), String(row.network)].join('|');
    if (evidenceKeys.has(evidenceKey)) add('evidence-duplicate', `${context} duplicates ${evidenceKey}.`, 'Keep one authoritative row per claim, scenario and network.');
    evidenceKeys.add(evidenceKey);

    if (claim?.target === 'browser-recovery' && (claim.status === 'verified-recovery' || claim.status === 'blocking-only')) {
      const expectedScenario = claim.status === 'blocking-only' ? 'browser-blocking' : 'browser-recovery';
      if (row.scenario !== expectedScenario || row.browserId !== claim.browserId || row.adultContentBlocked !== true || row.ordinaryBrowsingAllowed !== true) {
        add('browser-evidence-invalid', `${context} does not prove the declared browser block/allow behavior.`, 'Capture the exact browser and network with both protected and ordinary destinations.');
      }
      if (claim.status === 'verified-recovery'
        && (row.attemptDetected !== true || row.openedFreed !== true || row.beforeContentDisplayed !== true || !capability || !validHandoff(row, capability))) {
        add('browser-handoff-invalid', `${context} does not prove automatic entry or exactly one Open Challenge action into FREED.`, 'A browser error or manual app-icon open is insufficient.');
      }
    } else if (claim?.target === 'app-limit' && claim.status === 'verified-app-journey') {
      if (!(appScenarios as readonly unknown[]).includes(row.scenario) || !validAppScenario(row)
        || (row.scenario === 'threshold-interruption' && (!capability || !validHandoff(row, capability)))) {
        add('app-journey-evidence-invalid', `${context} does not prove its exact native app-limit scenario.`, 'Capture threshold, each grant, relock, cap, retry, replay, overlap and clock/restart behavior.');
      }
    } else {
      add('evidence-scope-mismatch', `${context} references no declared evidence-bearing path.`, 'Evidence may reference only verified-recovery, blocking-only or verified-app-journey claims.');
    }
    if (before === reasons.length) covered.add(evidenceKey);
  }

  for (const claim of claims) {
    if (!text(claim.id)) continue;
    const networks = stringList(claim.networks);
    if (claim.target === 'browser-recovery' && (claim.status === 'verified-recovery' || claim.status === 'blocking-only')) {
      const scenario = claim.status === 'blocking-only' ? 'browser-blocking' : 'browser-recovery';
      for (const network of networks) if (!covered.has([claim.id, scenario, network].join('|'))) {
        add('browser-recovery-evidence-missing', `Claim ${claim.id} lacks passing ${scenario} evidence for ${network}.`, 'Capture each advertised browser under every declared network and permission condition.');
      }
    }
    if (claim.target === 'app-limit' && claim.status === 'verified-app-journey') {
      for (const network of networks) for (const scenario of appScenarios) if (!covered.has([claim.id, scenario, network].join('|'))) {
        add('app-journey-evidence-missing', `Claim ${claim.id} lacks passing ${scenario} evidence for ${network}.`, 'Capture the complete selected-app journey on each platform.');
      }
    }
  }

  return {
    registryVersion: registry.version,
    contractVersion: registry.contractVersion,
    publicReleaseAllowed: input.audience === 'public' && reasons.length === 0,
    internalTestingAllowed: input.audience === 'internal-testing' && reasons.every((reason) => !['registry-invalid', 'request-invalid', 'request-contract-version-mismatch', 'candidate-binding-invalid'].includes(reason.code)),
    reasons
  };
}

/** Public entry point: caller-supplied registries, booleans and environment flags are ignored. */
export function evaluateDeclaredRecoveryCoverage(request: unknown, nowMs = Date.now()): DeclaredRecoveryResult {
  return validateDeclaredRecoveryCoverage(request, DECLARED_RECOVERY_CAPABILITY_REGISTRY, nowMs);
}
