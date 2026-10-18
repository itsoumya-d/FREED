import type { ProtectionCapability, ProtectionStatus } from 'freed-protection';
import { getAdultProtectionPresentation, type AdultProtectionObservations } from './adult-protection-presentation';
import type { EncryptedDnsSnapshot } from './encrypted-dns';

export type AdultProtectionPresentation = ReturnType<typeof getAdultProtectionPresentation>;
export type ObservedAdultProtectionInput = {
  capability?: ProtectionCapability | null;
  status?: ProtectionStatus | null;
  observations?: AdultProtectionObservations | null;
  syncing?: boolean;
  syncMessage?: string | null;
};

/** Both root screens consume the same native facts and shared DNS readback.
 * Configuration and authorization never manufacture network/browser evidence.
 */
export function getObservedAdultProtectionPresentation(input: ObservedAdultProtectionInput, dns: Pick<EncryptedDnsSnapshot, 'status' | 'lastCheckedAt' | 'error' | 'pending'>): AdultProtectionPresentation {
  const { capability, status } = input;
  const ios = capability?.platform === 'ios';
  return getAdultProtectionPresentation({
    platform: capability?.platform === 'ios' || capability?.platform === 'android' ? capability.platform : 'unsupported',
    nativeSupported: ios ? capability.screenTime === true && capability.managedSettings === true : capability?.platform === 'android',
    authorized: status?.authorized === true,
    policyConfigured: ios ? status?.adultWebPolicyConfigured === true || status?.authorized === true && status?.adultFilterActive === true && status.adultWebPolicyConfigured !== false
      : status?.adultFilterActive === true && status.dnsGuardCoverageReady === true,
    nativeRoutingEnabled: capability?.platform === 'android' && status?.adultFilterActive === true && status.dnsGuardCoverageReady === true,
    dnsStatus: dns.status,
    configurationCheckedAt: dns.lastCheckedAt,
    observations: input.observations,
    error: input.syncMessage || dns.error || null,
    pending: input.syncing || Boolean(dns.pending),
  });
}
