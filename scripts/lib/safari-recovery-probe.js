"use strict";

const { SAFARI_FOCUS_HOST_PERMISSIONS, SAFARI_FOCUS_ALLOWED_DOMAINS } = require('./ios-safari-focus-shield-contract');
const PROBE_LINK = 'freed://guided-reset';
const PROBE_ID = 'freed_safe_recovery_probe_v1';
const PROBE_HOSTS = ['https://example.com/*', 'https://nudity.testcategory.com/*'];
const PROBE_DOMAINS = ['example.com', 'nudity.testcategory.com'];
const PROBE_RESOURCES = [{ resources: ['recovery-probe/page.html'], matches: PROBE_HOSTS }];
const PROBE_RULES = [
  { id: 81001, priority: 1, action: { type: 'redirect', redirect: { extensionPath: '/recovery-probe/page.html' } }, condition: { regexFilter: '^https://example[.]com/freed-recovery-probe$', isUrlFilterCaseSensitive: true, resourceTypes: ['main_frame'] } },
  { id: 81002, priority: 1, action: { type: 'redirect', redirect: { extensionPath: '/recovery-probe/page.html' } }, condition: { regexFilter: '^https://nudity[.]testcategory[.]com/$', isUrlFilterCaseSensitive: true, resourceTypes: ['main_frame'] } }
];
const RULE_RESOURCE = { id: PROBE_ID, enabled: true, path: 'recovery-probe/rules.json' };
function exact(actual, expected) { return JSON.stringify(actual) === JSON.stringify(expected); }

/** Build-only, default-off safe-fixture experiment. Never modifies enforcement. */
function buildSafariRecoveryProbeConfiguration(manifestInput, infoInput, options = {}) {
  const { profile, enabled = false } = options;
  if (typeof enabled !== 'boolean') throw new Error('Probe enabled must be a Boolean.');
  if (enabled && profile !== 'internal') throw new Error('Safari recovery probe requires the explicit internal build profile.');
  const manifest = structuredClone(manifestInput), info = structuredClone(infoInput);
  const permissions = manifest.permissions;
  if (!exact(permissions, ['nativeMessaging']) && !exact(permissions, ['nativeMessaging', 'declarativeNetRequestWithHostAccess'])) throw new Error('Probe found unrecognized permissions.');
  if (!exact(manifest.host_permissions, SAFARI_FOCUS_HOST_PERMISSIONS) && !exact(manifest.host_permissions, [...SAFARI_FOCUS_HOST_PERMISSIONS, ...PROBE_HOSTS])) throw new Error('Probe found unrecognized hosts.');
  if (manifest.declarative_net_request !== undefined && !exact(manifest.declarative_net_request, { rule_resources: [RULE_RESOURCE] })) throw new Error('Probe found unrecognized rule resources.');
  if (manifest.web_accessible_resources !== undefined && !exact(manifest.web_accessible_resources, PROBE_RESOURCES)) throw new Error('Probe found unrecognized web resources.');
  const access = info.NSExtension?.SFSafariWebsiteAccess;
  if (access?.Level !== 'Some' || (!exact(access['Allowed Domains'], SAFARI_FOCUS_ALLOWED_DOMAINS) && !exact(access['Allowed Domains'], [...SAFARI_FOCUS_ALLOWED_DOMAINS, ...PROBE_DOMAINS]))) throw new Error('Probe found unrecognized native website access.');

  manifest.permissions = enabled ? ['nativeMessaging', 'declarativeNetRequestWithHostAccess'] : ['nativeMessaging'];
  manifest.host_permissions = enabled ? [...SAFARI_FOCUS_HOST_PERMISSIONS, ...PROBE_HOSTS] : [...SAFARI_FOCUS_HOST_PERMISSIONS];
  access['Allowed Domains'] = enabled ? [...SAFARI_FOCUS_ALLOWED_DOMAINS, ...PROBE_DOMAINS] : [...SAFARI_FOCUS_ALLOWED_DOMAINS];
  if (enabled) {
    manifest.declarative_net_request = { rule_resources: [RULE_RESOURCE] };
    manifest.web_accessible_resources = structuredClone(PROBE_RESOURCES);
    info.FREEDWebsiteRecoveryProbeEnabled = true;
  } else {
    delete manifest.declarative_net_request;
    delete manifest.web_accessible_resources;
    delete info.FREEDWebsiteRecoveryProbeEnabled;
  }
  return { manifest, info };
}
module.exports = { buildSafariRecoveryProbeConfiguration, PROBE_LINK, PROBE_RULES };
