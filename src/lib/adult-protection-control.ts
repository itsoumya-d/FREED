import type { EncryptedDnsStatus, ProtectionStatus } from 'freed-protection';

/** A manual Off request is independent of rewards and never changes app-group rules. */
export async function disableAdultProtection(input: {
  isCurrent: () => boolean;
  stopPolicy: () => Promise<ProtectionStatus>;
  removeDns: () => Promise<{ accepted: boolean; status: EncryptedDnsStatus }>;
  readPolicy: () => Promise<ProtectionStatus | null>;
  readDns: () => Promise<EncryptedDnsStatus>;
}): Promise<'off' | 'needs-attention' | 'superseded'> {
  if (!input.isCurrent()) return 'superseded';
  const policy = await input.stopPolicy();
  if (!input.isCurrent()) return 'superseded';
  if (policy.nativeConfigurationOperationAccepted === false || policy.adultFilterActive !== false) return 'needs-attention';
  const dns = await input.removeDns();
  if (!input.isCurrent()) return 'superseded';
  if (!dns.accepted || dns.status.configured || dns.status.enabled) return 'needs-attention';
  const [observedPolicy, observedDns] = await Promise.all([input.readPolicy(), input.readDns()]);
  if (!input.isCurrent()) return 'superseded';
  return observedPolicy?.adultFilterActive === false && observedPolicy.adultFilterRequested !== true &&
    observedPolicy.nativeConfigurationOperationAccepted !== false && observedPolicy.adultWebPolicyConfigured !== true &&
    (observedPolicy.mode !== 'screen-time' || observedPolicy.adultWebPolicyConfigured === false) && !observedDns.configured && !observedDns.enabled
    && !observedPolicy.nativeConfigurationError && observedDns.supported && observedDns.releaseEnabled && !observedDns.reason ? 'off' : 'needs-attention';
}
