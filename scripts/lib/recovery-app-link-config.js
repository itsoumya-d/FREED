"use strict";

const RECOVERY_APP_LINK_HOST = "freed-7d5ee.firebaseapp.com";
const RECOVERY_APP_LINK_PATH = "/intervention";
const RECOVERY_APP_LINK = `https://${RECOVERY_APP_LINK_HOST}${RECOVERY_APP_LINK_PATH}`;
const RECOVERY_ASSOCIATED_DOMAIN = `applinks:${RECOVERY_APP_LINK_HOST}`;
const RECOVERY_INTENT_FILTER = Object.freeze({
  action: "VIEW",
  autoVerify: true,
  data: Object.freeze([Object.freeze({
    scheme: "https",
    host: RECOVERY_APP_LINK_HOST,
    path: RECOVERY_APP_LINK_PATH
  })]),
  category: Object.freeze(["DEFAULT", "BROWSABLE"])
});

function isRecoveryIntentFilter(filter) {
  if (!filter || filter.action !== "VIEW" || filter.autoVerify !== true) return false;
  if (!Array.isArray(filter.category) || filter.category.length !== 2 ||
      !filter.category.includes("DEFAULT") || !filter.category.includes("BROWSABLE")) return false;
  if (!Array.isArray(filter.data) || filter.data.length !== 1) return false;
  const datum = filter.data[0];
  return datum?.scheme === "https" && datum?.host === RECOVERY_APP_LINK_HOST &&
    datum?.path === RECOVERY_APP_LINK_PATH && Object.keys(datum).length === 3;
}

function recoveryIntentFilter() {
  return {
    action: RECOVERY_INTENT_FILTER.action,
    autoVerify: RECOVERY_INTENT_FILTER.autoVerify,
    data: RECOVERY_INTENT_FILTER.data.map(datum => ({ ...datum })),
    category: [...RECOVERY_INTENT_FILTER.category]
  };
}

function applyRecoveryAppLinkConfig(config = {}) {
  const ios = config.ios && typeof config.ios === "object" ? config.ios : {};
  const android = config.android && typeof config.android === "object" ? config.android : {};
  const associatedDomains = Array.isArray(ios.associatedDomains) ? [...ios.associatedDomains] : [];
  const intentFilters = Array.isArray(android.intentFilters) ? [...android.intentFilters] : [];

  if (!associatedDomains.includes(RECOVERY_ASSOCIATED_DOMAIN)) {
    associatedDomains.push(RECOVERY_ASSOCIATED_DOMAIN);
  }
  if (!intentFilters.some(isRecoveryIntentFilter)) {
    intentFilters.push(recoveryIntentFilter());
  }

  return {
    ...config,
    ios: { ...ios, associatedDomains },
    android: { ...android, intentFilters }
  };
}

module.exports = {
  RECOVERY_APP_LINK,
  RECOVERY_APP_LINK_HOST,
  RECOVERY_APP_LINK_PATH,
  RECOVERY_ASSOCIATED_DOMAIN,
  RECOVERY_INTENT_FILTER,
  applyRecoveryAppLinkConfig,
  isRecoveryIntentFilter
};
