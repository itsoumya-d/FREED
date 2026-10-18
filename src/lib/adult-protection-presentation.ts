import { normalizeEncryptedDnsStatus } from './encrypted-dns';

/** Supplied by observed checks, never by a saved profile, a link tap or a consent response.
 * Every observation belongs to the latest configuration read; a new read invalidates it.
 */
export type AdultProtectionObservations = {
  readbackAt: number;
  enablement: 'observed-current' | 'unobserved';
  routing: 'observed-current' | 'unobserved';
  adultBrowsing: 'observed-blocked' | 'unobserved';
  ordinaryBrowsing: 'observed-allowed' | 'unobserved';
};
export type AdultProtectionStep = 'authorize' | 'policy' | 'save-dns' | 'enable-dns' | 'readback' | 'browse' | 'complete' | 'unsupported';
export function getAdultProtectionPresentation(input: {
  platform: 'ios' | 'android' | 'unsupported'; nativeSupported: boolean; authorized: boolean;
  policyConfigured: boolean; nativeRoutingEnabled?: boolean; dnsStatus: unknown;
  configurationCheckedAt?: number | null; observations?: AdultProtectionObservations | null; error?: string | null; pending?: boolean;
}) {
  const dns = normalizeEncryptedDnsStatus(input.dnsStatus);
  const dnsAvailable = dns.supported && dns.releaseEnabled;
  const supported = input.nativeSupported || dnsAvailable;
  const configured = input.policyConfigured || dns.configured || input.nativeRoutingEnabled === true;
  const hostedReady = dns.provider === 'freed-recovery-pilot' && dns.modeActive === true && dns.configured && dns.enabled;
  const policyReady = hostedReady || input.platform !== 'ios' || !input.nativeSupported || input.authorized && input.policyConfigured;
  const enabled = dnsAvailable ? dns.configured && dns.enabled : input.platform === 'android' && input.nativeRoutingEnabled === true;
  // iOS publishes unknown health. Only observed routing can prove it; a known failure vetoes that proof.
  const routingNotKnownBad = dnsAvailable ? dns.healthy !== false : input.platform === 'android' && input.nativeRoutingEnabled === true;
  const checkedAt = input.configurationCheckedAt;
  const checked = typeof checkedAt === 'number' && Number.isSafeInteger(checkedAt) && checkedAt > 0;
  const observed = input.observations;
  const verified = supported && policyReady && enabled && routingNotKnownBad && !input.error && !input.pending && checked
    && observed != null && observed.readbackAt === checkedAt && observed.enablement === 'observed-current' && observed.routing === 'observed-current'
    && observed.adultBrowsing === 'observed-blocked' && observed.ordinaryBrowsing === 'observed-allowed';
  let step: AdultProtectionStep;
  if (!supported) step = 'unsupported';
  else if (input.platform === 'ios' && input.nativeSupported && !input.authorized && !hostedReady) step = 'authorize';
  else if (!policyReady) step = 'policy';
  else if (input.error || input.pending) step = 'readback';
  else if (dnsAvailable && !dns.configured) step = 'save-dns';
  else if (dnsAvailable && !dns.enabled) step = 'enable-dns';
  else if (!enabled) step = input.platform === 'ios' ? 'unsupported' : 'readback';
  else if (!checked || dns.healthy === false) step = 'readback';
  else step = verified ? 'complete' : 'browse';
  const tone = !supported ? 'neutral' : verified ? 'on' : configured || input.error || input.pending ? 'attention' : 'off';
  const status = tone === 'neutral' ? 'Unavailable' : tone === 'on' ? 'On' : tone === 'off' ? 'Off' : 'Needs attention';
  const nextAction = {
    authorize: 'Allow Screen Time', policy: 'Apply adult website policy', 'save-dns': 'Save Cloudflare Families DNS',
    'enable-dns': 'Select FREED DNS in Settings', readback: 'Check configuration', browse: 'Test websites',
    complete: 'Review protection', unsupported: 'Check device support',
  }[step];
  const description = verified ? 'Verified on this network.' : step === 'browse' ? 'Check that adult sites are blocked and ordinary sites open.'
    : step === 'enable-dns' ? 'The profile is saved. Enable it in system Settings.'
      : step === 'unsupported' ? 'Review which protection layers this device supports.'
        : configured ? 'Setup is saved. Finish the current step before relying on protection.' : 'Choose setup to begin adult website protection.';
  return { supported, requested: configured, configured, verified, status, tone, step, nextAction, description };
}

/** An arbitrary truthy callback result is not a current configuration read. */
export function isAdultConfigurationReadbackCurrent(native: unknown, resolver: unknown, nativeRequired: boolean) {
  if (!native || typeof native !== 'object') return false;
  const fresh = native as { superseded?: unknown; capability?: { platform?: unknown }; status?: { authorized?: unknown; adultFilterActive?: unknown; adultWebPolicyConfigured?: unknown } };
  const dns = normalizeEncryptedDnsStatus(resolver);
  if (fresh.superseded !== undefined && fresh.superseded !== false || fresh.capability?.platform !== 'ios'
    || !dns.supported || !dns.releaseEnabled || !dns.configured || !dns.enabled
    || ['native-status-refresh-failed', 'native-status-check-failed', 'native-status-invalid', 'ios-dns-preferences-load-failed', 'ios-dns-configuration-in-progress'].includes(dns.reason ?? '')) return false;
  return dns.provider === 'freed-recovery-pilot' && dns.modeActive === true || !nativeRequired || fresh.status?.authorized === true && fresh.status.adultFilterActive === true && fresh.status.adultWebPolicyConfigured !== false;
}
