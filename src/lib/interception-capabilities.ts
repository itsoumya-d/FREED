/** Public-API assessment, not a runtime permission or device-enforcement report. */
export type InterceptionPlatform = 'ios' | 'android';
export type InterceptionCoverage = 'configured-dns' | 'participating-network-stacks' | 'safari' | 'selected-app-groups' | 'all-existing-and-new-browsers';
type CapabilityStep = {
  api: 'supported' | 'conditional' | 'unavailable';
  implementation: 'source-present-unreviewed' | 'reviewed-implemented' | 'not-implemented';
  deviceEvidence: 'unexecuted' | 'prior-unbound-safari-observation';
};
export type InterceptionCapability = {
  id: string;
  platform: InterceptionPlatform;
  target: 'adult-web' | 'native-app-group';
  coverage: InterceptionCoverage;
  consumerStoreEligibility: 'eligible' | 'unverified' | 'approval-and-infrastructure-required' | 'ineligible';
  blocking: CapabilityStep;
  detection: CapabilityStep;
  handoff: CapabilityStep & { method: 'none' | 'browser-page' | 'primary-shield-tap' | 'notification-tap' | 'attempted-background-launch' | 'automatic-app-entry' | 'extension-open-freed-action' };
  limits: readonly string[];
  sources: readonly string[];
};

function freeze<T>(value: T): T {
  if (value && typeof value === 'object') {
    for (const child of Object.values(value)) freeze(child);
    Object.freeze(value);
  }
  return value;
}
/** Version 1 remains historical automatic-only evidence; it is never reinterpreted as version 2. */
export const INTERCEPTION_HANDOFF_CONTRACTS = freeze({
  1: { evidenceSchemaVersion: 1, promise: 'adult-blocking-and-automatic-freed-entry-every-existing-and-new-browser', acceptedEntryMethods: ['automatic'] },
  2: { evidenceSchemaVersion: 2, promise: 'adult-blocking-and-automatic-or-open-freed-action-every-existing-and-new-browser', acceptedEntryMethods: ['automatic', 'shield-primary-tap', 'notification-tap', 'extension-open-freed-action'] },
  3: { evidenceSchemaVersion: 3, promise: 'declared-safari-ios-chrome-android-and-both-platform-app-journeys', acceptedEntryMethods: ['automatic', 'open-challenge', 'open-freed'] }
} as const);

export type InterceptionEntryMethod = typeof INTERCEPTION_HANDOFF_CONTRACTS[2]['acceptedEntryMethods'][number];
/** Action counts are recorded separately: a standard OS confirmation is not a second product CTA. */
export type InterceptionHandoffEvidence = {
  action: 'none' | 'open-freed';
  productActionCount: 0 | 1;
  osConfirmationCount: 0 | 1;
  foregroundAppId: 'app.freed.recovery';
  recoveryEntered: true;
};

const unexecuted = { api: 'unavailable', implementation: 'not-implemented', deviceEvidence: 'unexecuted' } as const;
const present = { api: 'conditional', implementation: 'source-present-unreviewed', deviceEvidence: 'unexecuted' } as const;
const appleNetworking = 'https://developer.apple.com/videos/play/wwdc2025/234/';
const androidBal = 'https://developer.android.com/guide/components/activities/secure-bal';

export const INTERCEPTION_CAPABILITY_REGISTRY: Readonly<{
  version: 2;
  contractVersion: 2;
  assessedOn: string;
  promise: 'adult-blocking-and-automatic-or-open-freed-action-every-existing-and-new-browser';
  maxEvidenceAgeMs: number;
  paths: readonly InterceptionCapability[];
}> = freeze({
  version: 2,
  contractVersion: 2,
  assessedOn: '2026-10-12',
  promise: 'adult-blocking-and-automatic-or-open-freed-action-every-existing-and-new-browser',
  maxEvidenceAgeMs: 7 * 86_400_000,
  paths: [
    {
      id: 'ios-dns-settings', platform: 'ios', target: 'adult-web', coverage: 'configured-dns', consumerStoreEligibility: 'unverified',
      blocking: { ...present, deviceEvidence: 'prior-unbound-safari-observation' }, detection: unexecuted, handoff: { ...unexecuted, method: 'none' },
      limits: ['NEDNSSettingsManager saves DNS configuration; it exposes no blocked-query or foreground-app callback.', 'Prior TestFlight 1.0(7), iPhone 16/iOS 26.6.2 Safari Wi-Fi observation is not bound to this source/binary. Other browsers, cellular, bypasses and automatic entry remain unexecuted.'],
      sources: ['https://developer.apple.com/documentation/networkextension/nednssettingsmanager', appleNetworking]
    },
    {
      id: 'ios-url-filter', platform: 'ios', target: 'adult-web', coverage: 'participating-network-stacks', consumerStoreEligibility: 'approval-and-infrastructure-required',
      blocking: { ...unexecuted, api: 'conditional' }, detection: unexecuted, handoff: { ...unexecuted, method: 'none' },
      limits: ['App and extension do not execute in the filtering path. Custom networking stacks must voluntarily honor NEURLFilter verdicts.', 'Requires PIR, Privacy Pass, OHTTP gateway and Apple distribution approval. No such infrastructure or approval is evidenced or authorized here.'],
      sources: [appleNetworking]
    },
    {
      id: 'ios-classic-content-filter', platform: 'ios', target: 'adult-web', coverage: 'participating-network-stacks', consumerStoreEligibility: 'ineligible',
      blocking: { ...unexecuted, api: 'conditional' }, detection: { ...unexecuted, api: 'conditional' }, handoff: { ...unexecuted, method: 'none' },
      limits: ['iOS classic content-filter deployment requires supervision or eligible under-18 child authorization; neither satisfies the ordinary adult consumer product.'],
      sources: ['https://developer.apple.com/documentation/technotes/tn3134-network-extension-provider-deployment']
    },
    {
      id: 'ios-safari-content-blocker', platform: 'ios', target: 'adult-web', coverage: 'safari', consumerStoreEligibility: 'unverified',
      blocking: present, detection: unexecuted, handoff: { ...unexecuted, method: 'none' },
      limits: ['Safari content-blocker rules block covered requests; they provide no universal attempt callback or automatic FREED app entry.'],
      sources: ['https://developer.apple.com/documentation/safariservices/creating-a-content-blocker']
    },
    {
      id: 'ios-safari-dnr', platform: 'ios', target: 'adult-web', coverage: 'safari', consumerStoreEligibility: 'unverified',
      blocking: { ...unexecuted, api: 'conditional' }, detection: unexecuted, handoff: { ...unexecuted, api: 'conditional', method: 'browser-page' },
      limits: ['Safari main_frame redirect to an extensionPath requires declarativeNetRequestWithHostAccess and host permission.', 'A browser recovery page is a Safari-only path; it does not establish automatic foreground FREED entry or coverage of newly installed browsers.'],
      sources: ['https://developer.apple.com/videos/play/wwdc2026/216/']
    },
    {
      id: 'ios-native-groups', platform: 'ios', target: 'native-app-group', coverage: 'selected-app-groups', consumerStoreEligibility: 'unverified',
      blocking: present, detection: present, handoff: { ...present, method: 'primary-shield-tap' },
      limits: ['Screen Time opaque selected-group scopes are separate from adult-browser protection.', 'openParentalControlsApp is available on iOS 26.5+ after a shield action; current adapter requires the primary button. Earlier systems use a notification fallback. Group expiry/relock remains separate device evidence.'],
      sources: ['https://developer.apple.com/documentation/managedsettings/shieldactionresponse/openparentalcontrolsapp']
    },
    {
      id: 'android-vpn-dns', platform: 'android', target: 'adult-web', coverage: 'configured-dns', consumerStoreEligibility: 'unverified',
      blocking: present, detection: present, handoff: { ...present, method: 'notification-tap' },
      limits: ['FreedVpnService detects covered DNS blocks and posts a private generic notification with an activity PendingIntent.', 'A tap is required; background launch restrictions apply. Custom DoH/ECH/nonparticipating stacks and newly installed browser coverage have no universal API/device proof.'],
      sources: ['https://developer.android.com/reference/android/net/VpnService', androidBal]
    },
    {
      id: 'android-native-groups', platform: 'android', target: 'native-app-group', coverage: 'selected-app-groups', consumerStoreEligibility: 'unverified',
      blocking: present, detection: present, handoff: { ...present, method: 'attempted-background-launch' },
      limits: ['Selected package groups use Accessibility events. The adapter attempts startActivity and posts a notification; foreground success, store eligibility and native expiry need independent evidence.', 'This selected-app path supplies no every-browser adult-content guarantee.'],
      sources: [androidBal, 'https://support.google.com/googleplay/android-developer/answer/10964491']
    }
  ]
});

export type DeclaredRecoveryCapability = {
  id: string;
  platform: InterceptionPlatform;
  target: 'browser-recovery' | 'app-limit';
  browserId?: string;
  publicApi: 'supported' | 'conditional' | 'unavailable';
  storeEligibility: 'eligible' | 'unverified' | 'ineligible';
  implementation: 'reviewed-implemented' | 'source-present-unreviewed' | 'not-implemented';
  requiredPermissions: readonly string[];
  acceptedEntryMethods: readonly ('automatic' | 'open-challenge' | 'open-freed')[];
};

/**
 * Version 3 narrows the release promise to declared coverage. These source
 * capabilities remain unverified until a reviewed implementation and store
 * eligibility finding are checked in; device-result JSON cannot promote them.
 */
export const DECLARED_RECOVERY_CAPABILITY_REGISTRY: Readonly<{
  version: 3;
  contractVersion: 3;
  maxEvidenceAgeMs: number;
  capabilities: readonly DeclaredRecoveryCapability[];
}> = freeze({
  version: 3,
  contractVersion: 3,
  maxEvidenceAgeMs: 7 * 86_400_000,
  capabilities: [
    {
      id: 'ios-safari-dnr', platform: 'ios', target: 'browser-recovery', browserId: 'safari',
      publicApi: 'conditional', storeEligibility: 'unverified', implementation: 'not-implemented',
      requiredPermissions: ['safari-extension-enabled'], acceptedEntryMethods: ['open-freed']
    },
    {
      id: 'android-vpn-dns', platform: 'android', target: 'browser-recovery', browserId: 'chrome',
      publicApi: 'conditional', storeEligibility: 'unverified', implementation: 'source-present-unreviewed',
      requiredPermissions: ['vpn-consent', 'notifications-enabled'], acceptedEntryMethods: ['open-freed']
    },
    {
      id: 'ios-native-groups', platform: 'ios', target: 'app-limit',
      publicApi: 'supported', storeEligibility: 'unverified', implementation: 'source-present-unreviewed',
      requiredPermissions: ['family-controls', 'app-selection'], acceptedEntryMethods: ['open-freed']
    },
    {
      id: 'android-native-groups', platform: 'android', target: 'app-limit',
      publicApi: 'conditional', storeEligibility: 'unverified', implementation: 'source-present-unreviewed',
      requiredPermissions: ['accessibility', 'usage-access'], acceptedEntryMethods: ['open-freed']
    }
  ]
});
