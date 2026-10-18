const { withEntitlementsPlist, withInfoPlist, withAndroidManifest, AndroidConfig } = require('@expo/config-plugins');

const ENTITLEMENT = 'com.apple.developer.networking.networkextension';
const RELEASE_FLAG = 'app.freed.protection.ENCRYPTED_DNS_RELEASE_ENABLED';
const PREVIEW_FLAG = 'app.freed.protection.ENCRYPTED_DNS_DEV_PREVIEW';

function dnsFlags(options = {}) {
  // Build capability defaults off. A runtime/user preference cannot lift it.
  return { releaseEnabled: options.releaseEnabled === true, devPreview: options.devPreview === true };
}

function applyDnsEntitlements(entitlements, options) {
  const flags = dnsFlags(options);
  const existing = Array.isArray(entitlements[ENTITLEMENT]) ? entitlements[ENTITLEMENT] : [];
  const values = existing.filter((value) => value !== 'dns-settings');
  if (flags.releaseEnabled || flags.devPreview) values.push('dns-settings');
  if (values.length) entitlements[ENTITLEMENT] = [...new Set(values)];
  else delete entitlements[ENTITLEMENT];
  return entitlements;
}

function applyDnsInfoPlist(info, options) {
  const flags = dnsFlags(options);
  info.FreedEncryptedDnsReleaseEnabled = flags.releaseEnabled;
  info.FreedEncryptedDnsDevPreview = flags.devPreview;
  return info;
}

function applyDnsAndroidMetadata(application, options) {
  const flags = dnsFlags(options);
  application['meta-data'] ||= [];
  for (const [name, enabled] of [[RELEASE_FLAG, flags.releaseEnabled], [PREVIEW_FLAG, flags.devPreview]]) {
    const entry = application['meta-data'].find((item) => item.$?.['android:name'] === name);
    if (entry) entry.$['android:value'] = String(enabled);
    else application['meta-data'].push({ $: { 'android:name': name, 'android:value': String(enabled) } });
  }
  return application;
}

function applyFocusShieldAndroidMetadata(application, options = {}) {
  application['meta-data'] ||= [];
  for (const [name, enabled] of [
    ['app.freed.protection.FOCUS_SHIELD_SURFACE_RELEASE_ENABLED', options.focusShieldReleaseEnabled === true],
    ['app.freed.protection.FOCUS_SHIELD_SURFACE_DEV_PREVIEW', options.focusShieldDevPreview === true]
  ]) {
    const entry = application['meta-data'].find((item) => item.$?.['android:name'] === name);
    if (entry) entry.$['android:value'] = String(enabled);
    else application['meta-data'].push({ $: { 'android:name': name, 'android:value': String(enabled) } });
  }
  return application;
}

module.exports = function withFreedEncryptedDns(config, options = {}) {
  config = withEntitlementsPlist(config, (mod) => {
    mod.modResults = applyDnsEntitlements(mod.modResults, options);
    return mod;
  });
  config = withInfoPlist(config, (mod) => {
    mod.modResults = applyDnsInfoPlist(mod.modResults, options);
    return mod;
  });
  return withAndroidManifest(config, (mod) => {
    const application = AndroidConfig.Manifest.getMainApplicationOrThrow(mod.modResults);
    applyDnsAndroidMetadata(application, options);
    applyFocusShieldAndroidMetadata(application, options);
    for (const [name, value] of [['FREEDRecoveryDnsPilotEnabled', options.recoveryDnsPilotEnabled === true && ['internal','development'].includes(options.recoveryDnsPilotChannel)], ['FREEDRecoveryDnsPilotChannel', options.recoveryDnsPilotChannel ?? 'production']]) {
      const entry = application['meta-data'].find(item => item.$?.['android:name'] === name);
      if (entry) entry.$['android:value'] = String(value);
      else application['meta-data'].push({$: {'android:name': name, 'android:value': String(value)}});
    }
    return mod;
  });
};

module.exports.applyDnsEntitlements = applyDnsEntitlements;
module.exports.applyDnsInfoPlist = applyDnsInfoPlist;
module.exports.applyDnsAndroidMetadata = applyDnsAndroidMetadata;
module.exports.applyFocusShieldAndroidMetadata = applyFocusShieldAndroidMetadata;
