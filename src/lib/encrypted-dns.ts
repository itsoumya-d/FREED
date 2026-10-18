export type EncryptedDnsProvider = 'cloudflare-families' | 'freed-recovery-pilot';
export type EncryptedDnsReadback = {
  version: 1; operationId: string; stage: string; configurationGeneration: number | null;
  freshPreferencesLoaded: boolean; managerHasSettings: boolean | null; managerIsEnabled: boolean | null;
  protocolMatches: boolean | null; serverURLMatches: boolean | null; serversMatch: boolean | null;
  matchDomainsMatch: boolean | null; matchDomainsNoSearchMatch: boolean | null; onDemandRulesMatch: boolean | null;
  allowFailoverSupported: boolean; allowFailoverMatch: boolean | null; configurationValid: boolean;
};
const readbackKeys = ['managerHasSettings','managerIsEnabled','protocolMatches','serverURLMatches','serversMatch','matchDomainsMatch','matchDomainsNoSearchMatch','onDemandRulesMatch','allowFailoverMatch'] as const;
const dnsErrorDomains = new Set(['NEDNSSettingsErrorDomain','NEConfigurationErrorDomain','NEVPNErrorDomain','NSURLErrorDomain','NSCocoaErrorDomain','NSPOSIXErrorDomain','FreedProtection']);
export function normalizeEncryptedDnsReadback(value: unknown): EncryptedDnsReadback | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const r = value as Record<string,unknown>;
  if (r.version !== 1 || typeof r.operationId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(r.operationId)
    || typeof r.stage !== 'string' || !/^dns-[a-z-]{1,48}$/.test(r.stage) || !(r.configurationGeneration === null || typeof r.configurationGeneration === 'number' && Number.isSafeInteger(r.configurationGeneration) && r.configurationGeneration >= 0)
    || typeof r.freshPreferencesLoaded !== 'boolean' || typeof r.allowFailoverSupported !== 'boolean' || typeof r.configurationValid !== 'boolean'
    || readbackKeys.some(key => r[key] !== null && typeof r[key] !== 'boolean')) return null;
  const full = r.freshPreferencesLoaded && readbackKeys.filter(key => key !== 'managerIsEnabled' && key !== 'allowFailoverMatch').every(key => r[key] === true)
    && (!r.allowFailoverSupported || r.allowFailoverMatch === true);
  if (r.configurationValid !== full) return null;
  return {version:1,operationId:r.operationId,stage:r.stage,configurationGeneration:r.configurationGeneration as number|null,freshPreferencesLoaded:r.freshPreferencesLoaded,
    allowFailoverSupported:r.allowFailoverSupported,configurationValid:r.configurationValid,...Object.fromEntries(readbackKeys.map(key=>[key,r[key]]))} as EncryptedDnsReadback;
}

/** Configuration, OS enablement, and resolver health are separate facts. */
export type EncryptedDnsStatus = {
  supported: boolean;
  releaseEnabled: boolean;
  configured: boolean;
  enabled: boolean;
  healthy: boolean | null;
  reason: string | null;
  provider: EncryptedDnsProvider;
  requiresSettings: boolean;
  hostedModeRetained?: boolean;
  modeActive?: boolean;
  /** Actual saved native profile label; absent means its identity is unconfirmed. */
  configurationLabel?: string;
  /** Mutation receipt only; ordinary OS reads do not grant acceptance. */
  operationAccepted?: boolean;
  operationReason?: string | null;
  operationErrorDomain?: string;
  operationErrorCode?: number;
  operationLockStage?: string;
  operationAppGroupContainerAvailable?: boolean;
  operationProtectedDataAvailable?: boolean;
  operationConfigurationGeneration?: number | null;
  configurationReadback?: EncryptedDnsReadback;
};

export type EncryptedDnsConfiguration = { enabled: boolean; provider: 'cloudflare-families' };

export function unavailableEncryptedDnsStatus(reason = 'native-module-unavailable'): EncryptedDnsStatus {
  return { supported: false, releaseEnabled: false, configured: false, enabled: false,
    healthy: null, reason, provider: 'cloudflare-families', requiresSettings: false };
}

/** Fail closed when an old or malformed native binary omits capability evidence. */
export function normalizeEncryptedDnsStatus(value: unknown): EncryptedDnsStatus {
  if (!value || typeof value !== 'object') return unavailableEncryptedDnsStatus('native-status-invalid');
  const status = value as Partial<EncryptedDnsStatus>;
  if (!['cloudflare-families','freed-recovery-pilot'].includes(String(status.provider))
    || ![status.supported, status.releaseEnabled, status.configured, status.enabled].every(value => typeof value === 'boolean')
    || status.operationAccepted !== undefined && typeof status.operationAccepted !== 'boolean'
    || status.operationReason != null && typeof status.operationReason !== 'string'
    || status.reason != null && typeof status.reason !== 'string')
    return unavailableEncryptedDnsStatus('native-status-invalid');
  const supported = status.supported === true;
  const readback = normalizeEncryptedDnsReadback(status.configurationReadback);
  const invalidReadback = status.configurationReadback !== undefined && (!readback || !readback.configurationValid);
  const configured = status.configured === true && !invalidReadback;
  const enabled = supported && configured && status.enabled === true;
  return { supported, releaseEnabled: status.releaseEnabled === true, configured, enabled,
    healthy: enabled && typeof status.healthy === 'boolean' ? status.healthy : null,
    reason: invalidReadback && status.configured ? 'ios-dns-configuration-mismatch' : typeof status.reason === 'string' && status.reason.length > 0 ? status.reason : null,
    provider: status.provider as EncryptedDnsProvider, requiresSettings: status.requiresSettings === true,
    hostedModeRetained: status.provider === 'freed-recovery-pilot' && status.hostedModeRetained === true,
    modeActive: status.provider === 'freed-recovery-pilot' && enabled && status.modeActive === true,
    ...(configured && typeof status.configurationLabel === 'string' && status.configurationLabel.trim().length > 0 && status.configurationLabel.length <= 160 ? { configurationLabel: status.configurationLabel } : {}),
    ...(typeof status.operationAccepted === 'boolean' ? { operationAccepted: status.operationAccepted } : {}),
    ...(typeof status.operationReason === 'string' || status.operationReason === null ? { operationReason: status.operationReason } : {}),
    ...(typeof status.operationErrorDomain === 'string' && dnsErrorDomains.has(status.operationErrorDomain) ? { operationErrorDomain: status.operationErrorDomain } : {}),
    ...(typeof status.operationErrorCode === 'number' && Number.isSafeInteger(status.operationErrorCode) ? { operationErrorCode: status.operationErrorCode } : {}),
    ...(typeof status.operationLockStage === 'string' ? { operationLockStage: status.operationLockStage } : {}),
    ...(typeof status.operationAppGroupContainerAvailable === 'boolean' ? { operationAppGroupContainerAvailable: status.operationAppGroupContainerAvailable } : {}),
    ...(typeof status.operationProtectedDataAvailable === 'boolean' ? { operationProtectedDataAvailable: status.operationProtectedDataAvailable } : {}),
    ...(typeof status.operationConfigurationGeneration === 'number' && Number.isInteger(status.operationConfigurationGeneration) || status.operationConfigurationGeneration === null ? { operationConfigurationGeneration: status.operationConfigurationGeneration } : {}),
    ...(readback ? { configurationReadback: readback } : {}),
  };
}

export type EncryptedDnsPresentationState =
  'unavailable' | 'release-gated' | 'off' | 'settings-required' | 'waiting' | 'unverified' | 'active' | 'failed';

export function getEncryptedDnsPresentation(status: EncryptedDnsStatus) {
  const safe = normalizeEncryptedDnsStatus(status);
  let state: EncryptedDnsPresentationState;
  if (!safe.supported) {
    state = safe.reason === 'encrypted-dns-release-gated' ? 'release-gated' : 'unavailable';
  } else if (safe.requiresSettings) {
    state = 'settings-required';
  } else if (!safe.configured) {
    state = 'off';
  } else if (safe.healthy === false) {
    state = 'failed';
  } else if (!safe.enabled) {
    state = 'waiting';
  } else if (!safe.releaseEnabled || safe.healthy === null) {
    state = 'unverified';
  } else {
    state = 'active';
  }
  return { state, canEnable: safe.supported, canDisable: safe.configured || safe.enabled,
    isVerifiedActive: state === 'active', requiresSettings: safe.requiresSettings, reason: safe.reason };
}

export type EncryptedDnsOperationDiagnostic = {
  domain?: string; code?: number; stage?: string; appGroupContainerAvailable?: boolean;
  protectedDataAvailable?: boolean; configurationGeneration?: number | null;
  readback?: EncryptedDnsReadback;
};
export type EncryptedDnsSnapshot = {
  status: EncryptedDnsStatus;
  pending: 'enable' | 'disable' | 'refresh' | null;
  error: 'write-failed' | 'read-failed' | null;
  operationReason: string | null;
  operationDiagnostic: EncryptedDnsOperationDiagnostic | null;
  lastCheckedAt: number | null;
};

/** Device preferences outlive a screen. Serialize mutations and read the OS after
 * every attempted write; a write response alone cannot establish enforcement.
 * Focus/settings/network events may refresh while a write runs without cancelling it.
 */
export function createEncryptedDnsController(options: {
  readStatus: () => Promise<EncryptedDnsStatus>;
  configure: (configuration: EncryptedDnsConfiguration) => Promise<EncryptedDnsStatus>;
  now: () => number;
}) {
  let snapshot: EncryptedDnsSnapshot = { status: unavailableEncryptedDnsStatus(), pending: null, error: null, operationReason: null, operationDiagnostic: null, lastCheckedAt: null };
  const listeners = new Set<() => void>();
  let disposed = false, latestWrite = 0, readGeneration = 0, pendingWrites = 0;
  let lastMutation: { accepted: boolean; reason: string | null; diagnostic: EncryptedDnsOperationDiagnostic | null } | null = null;
  let queue: Promise<void> = Promise.resolve();
  let currentRead: { generation: number; promise: Promise<EncryptedDnsStatus> } | null = null;
  const publish = (update: Partial<EncryptedDnsSnapshot>) => {
    if (disposed) return;
    snapshot = { ...snapshot, ...update };
    for (const listener of listeners) listener();
  };
  const readObserved = (writeId?: number): Promise<EncryptedDnsStatus> => {
    if (disposed) return Promise.resolve(snapshot.status);
    if (writeId === undefined && currentRead?.generation === readGeneration) return currentRead.promise;
    const generation = ++readGeneration;
    const current = () => !disposed && generation === readGeneration && (writeId === undefined || writeId === latestWrite);
    if (writeId === undefined) publish({ pending: 'refresh' });
    const promise = (async () => {
      try {
        const status = normalizeEncryptedDnsStatus(await options.readStatus());
        if (['ios-dns-preferences-load-failed', 'ios-dns-configuration-in-progress', 'native-status-check-failed', 'native-status-refresh-failed', 'native-status-invalid'].includes(status.reason ?? ''))
          throw new Error('Native configuration read not confirmed');
        if (current()) publish({ status, lastCheckedAt: options.now(), error: lastMutation?.accepted === false ? 'write-failed' : null });
        return status;
      } catch {
        const status = unavailableEncryptedDnsStatus('native-status-refresh-failed');
        if (current()) publish({ status, lastCheckedAt: null, error: 'read-failed' });
        return status;
      } finally {
        if (currentRead?.generation === generation) currentRead = null;
        if (current() && writeId === undefined && pendingWrites === 0) publish({ pending: null });
      }
    })();
    currentRead = { generation, promise };
    return promise;
  };
  const refresh = (): Promise<EncryptedDnsStatus> => {
    if (disposed) return Promise.resolve(snapshot.status);
    if (pendingWrites > 0) return queue.then(() => refresh());
    return readObserved();
  };
  return {
    getSnapshot: () => snapshot,
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    refresh,
    acknowledgeOperation() {
      lastMutation = null;
      publish({ operationReason: null, operationDiagnostic: null,
        error: snapshot.error === 'write-failed' ? null : snapshot.error });
    },
    configure(enabled: boolean): Promise<{ accepted: boolean; superseded: boolean }> {
      if (disposed) return Promise.resolve({ accepted: false, superseded: true });
      const id = ++latestWrite;
      pendingWrites++; readGeneration++;
      lastMutation = null;
      publish({ pending: enabled ? 'enable' : 'disable', error: null, operationReason: null, operationDiagnostic: null });
      const result = queue.then(async () => {
        if (disposed || id !== latestWrite) { pendingWrites--; return { accepted: false, superseded: true }; }
        let failed = false;
        let operationReason: string | null = null;
        let operationDiagnostic: EncryptedDnsOperationDiagnostic | null = null;
        try {
          const receipt = await options.configure({ enabled, provider: 'cloudflare-families' });
          const safeReceipt = normalizeEncryptedDnsStatus(receipt);
          const reason = safeReceipt.operationReason ?? safeReceipt.reason;
          // A saved configuration is distinct from OS selection and health.
          // Legacy success is limited to a supported, confirmed configuration
          // and known non-failure outcomes; absent/malformed receipts fail closed.
          const benignSaveReasons = ['ios-dns-settings-enable-required', 'ios-dns-health-unverified',
            'encrypted-dns-device-unverified', 'android-encrypted-dns-awaiting-query'];
          const available = safeReceipt.supported && safeReceipt.releaseEnabled;
          const confirmedConfiguration = safeReceipt.configured === enabled;
          const benignReason = reason === null || enabled && benignSaveReasons.includes(reason);
          const observedRuntimeReasons = ['android-encrypted-dns-resolver-failed', 'android-dns-guard-captive-paused',
            'android-dns-guard-not-running', 'android-other-vpn-active', 'android-vpn-consent-required'];
          const explicitSuccess = safeReceipt.operationAccepted === true && safeReceipt.operationReason == null
            && (benignReason || enabled && observedRuntimeReasons.includes(safeReceipt.reason ?? ''));
          const legacySuccess = safeReceipt.operationAccepted === undefined && benignReason;
          failed = !available || !confirmedConfiguration || !(explicitSuccess || legacySuccess);
          operationReason = failed ? reason ?? 'encrypted-dns-operation-not-confirmed' : null;
          if (failed || safeReceipt.configurationReadback) {
            const diagnostic: EncryptedDnsOperationDiagnostic = {
              ...(safeReceipt.operationErrorDomain !== undefined ? { domain: safeReceipt.operationErrorDomain } : {}),
              ...(safeReceipt.operationErrorCode !== undefined ? { code: safeReceipt.operationErrorCode } : {}),
              ...(safeReceipt.operationLockStage !== undefined ? { stage: safeReceipt.operationLockStage } : {}),
              ...(safeReceipt.operationAppGroupContainerAvailable !== undefined ? { appGroupContainerAvailable: safeReceipt.operationAppGroupContainerAvailable } : {}),
              ...(safeReceipt.operationProtectedDataAvailable !== undefined ? { protectedDataAvailable: safeReceipt.operationProtectedDataAvailable } : {}),
              ...(safeReceipt.operationConfigurationGeneration !== undefined ? { configurationGeneration: safeReceipt.operationConfigurationGeneration } : {}),
              ...(safeReceipt.configurationReadback ? { readback: safeReceipt.configurationReadback } : {}),
            };
            if (Object.keys(diagnostic).length) operationDiagnostic = diagnostic;
          }
        } catch { failed = true; }
        if (!disposed && id === latestWrite) {
          lastMutation = { accepted: !failed, reason: operationReason, diagnostic: operationDiagnostic };
          publish({ operationReason: lastMutation.reason, operationDiagnostic: lastMutation.diagnostic,
            error: failed ? 'write-failed' : null });
        }
        try { await readObserved(id); }
        finally {
          pendingWrites--;
          if (id === latestWrite && pendingWrites === 0) publish({ pending: null });
        }
        return { accepted: !failed && !disposed && id === latestWrite, superseded: disposed || id !== latestWrite };
      });
      queue = result.then(() => undefined);
      return result;
    },
    dispose() { disposed = true; readGeneration++; listeners.clear(); },
  };
}
