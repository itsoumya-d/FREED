"use strict";

const assert = require("node:assert/strict");

const SAFARI_FOCUS_HOST_PERMISSIONS = Object.freeze([
  "*://youtube.com/*",
  "*://*.youtube.com/*",
  "*://instagram.com/*",
  "*://*.instagram.com/*",
  "*://tiktok.com/*",
  "*://*.tiktok.com/*",
  "https://intervention.freed.app/*",
]);
const SAFARI_FOCUS_ALLOWED_DOMAINS = Object.freeze([
  "youtube.com",
  "*.youtube.com",
  "instagram.com",
  "*.instagram.com",
  "tiktok.com",
  "*.tiktok.com",
  "intervention.freed.app",
]);
const APPROVED_RULE_HOSTS = Object.freeze({
  "short-form:youtube-shorts": "youtube.com",
  "short-form:instagram-reels": "instagram.com",
  "short-form:tiktok-feed": "tiktok.com",
});

function exactStringSet(actual, expected) {
  if (!Array.isArray(actual) || actual.some((value) => typeof value !== "string")) return false;
  return JSON.stringify([...actual].sort()) === JSON.stringify([...expected].sort());
}

function versionAtLeast(value, minimum) {
  const parse = (input) => String(input || "").split(".").map((part) => Number.parseInt(part, 10));
  const actual = parse(value);
  const required = parse(minimum);
  if (actual.some((part) => !Number.isFinite(part))) return false;
  for (let index = 0; index < Math.max(actual.length, required.length); index += 1) {
    const left = actual[index] || 0;
    const right = required[index] || 0;
    if (left !== right) return left > right;
  }
  return true;
}

function inspectSafariFocusShieldContract({ manifest, info, background, content, nativeHandlerBinary }) {
  const contentScripts = Array.isArray(manifest?.content_scripts) ? manifest.content_scripts : [];
  const contentScriptsScoped =
    contentScripts.length === 1 &&
    exactStringSet(contentScripts[0]?.matches, SAFARI_FOCUS_HOST_PERMISSIONS) &&
    Array.isArray(contentScripts[0]?.js) &&
    contentScripts[0].js.length === 1 &&
    contentScripts[0].js[0] === "content.js";
  const hostPermissionsScoped = exactStringSet(manifest?.host_permissions, SAFARI_FOCUS_HOST_PERMISSIONS);
  const allowedDomains = info?.NSExtension?.SFSafariWebsiteAccess?.["Allowed Domains"];
  const infoAllowedDomainsScoped =
    info?.NSExtension?.SFSafariWebsiteAccess?.Level === "Some" &&
    exactStringSet(allowedDomains, SAFARI_FOCUS_ALLOWED_DOMAINS);
  const serviceWorker = manifest?.background?.service_worker || "";
  const backgroundServiceWorkerValid = serviceWorker === "background.js";
  const backgroundOwnsNativeMessaging =
    background.includes("runtime.onMessage.addListener") &&
    background.includes("sendNativeMessage") &&
    background.includes("APPROVED_RULE_HOSTS");
  const fixedNativeEnvelope =
    background.includes('type: "record-pending-intervention"') &&
    background.includes('source: "ios-safari-short-form"');
  const approvedRuleHostsPresent = Object.entries(APPROVED_RULE_HOSTS).every(
    ([rule, host]) => background.includes(`"${rule}": "${host}"`) && nativeHandlerBinary.includes(rule) && nativeHandlerBinary.includes(host),
  );
  const nativePayloadSchemaValid =
    /return\s*\{\s*type:\s*"record-pending-intervention",\s*source:\s*"ios-safari-short-form",\s*host,\s*rule\s*\}/s.test(background) &&
    !/originalUrl|originalURL|pathname|searchParams/i.test(background);
  const nativeHandlerContractValid =
    nativeHandlerBinary.includes("record-pending-intervention") &&
    nativeHandlerBinary.includes("ios-safari-short-form") &&
    approvedRuleHostsPresent;
  const contentUsesRuntimeMessaging =
    content.includes("runtime?.sendMessage") &&
    !content.includes("sendNativeMessage") &&
    !/originalUrl|originalURL/i.test(content);
  const minimumSafariVersion = manifest?.browser_specific_settings?.safari?.strict_min_version || "";
  const minimumOSVersion = info?.MinimumOSVersion || "";
  const minimumOSVersionAtLeast154 = versionAtLeast(minimumOSVersion, "15.4");
  const manifestVersion3 = manifest?.manifest_version === 3;
  const nativeMessagingPermission =
    Array.isArray(manifest?.permissions) &&
    manifest.permissions.length === 1 &&
    manifest.permissions[0] === "nativeMessaging";
  const usableForManualEvidence =
    manifestVersion3 &&
    minimumSafariVersion === "15.4" &&
    minimumOSVersionAtLeast154 &&
    backgroundServiceWorkerValid &&
    nativeMessagingPermission &&
    hostPermissionsScoped &&
    contentScriptsScoped &&
    infoAllowedDomainsScoped &&
    backgroundOwnsNativeMessaging &&
    fixedNativeEnvelope &&
    approvedRuleHostsPresent &&
    nativePayloadSchemaValid &&
    nativeHandlerContractValid &&
    contentUsesRuntimeMessaging;

  return {
    allowedDomains: Array.isArray(allowedDomains) ? allowedDomains : [],
    approvedRuleHostsPresent,
    backgroundOwnsNativeMessaging,
    backgroundServiceWorkerValid,
    contentScriptsScoped,
    contentUsesRuntimeMessaging,
    fixedNativeEnvelope,
    hostPermissions: Array.isArray(manifest?.host_permissions) ? manifest.host_permissions : [],
    hostPermissionsScoped,
    infoAllowedDomainsScoped,
    manifestVersion3,
    minimumOSVersion,
    minimumOSVersionAtLeast154,
    minimumSafariVersion,
    nativeHandlerContractValid,
    nativeMessagingPermission,
    nativePayloadSchemaValid,
    serviceWorker,
    usableForManualEvidence,
  };
}

function validFixture() {
  const manifest = {
    manifest_version: 3,
    browser_specific_settings: { safari: { strict_min_version: "15.4" } },
    background: { service_worker: "background.js" },
    permissions: ["nativeMessaging"],
    host_permissions: [...SAFARI_FOCUS_HOST_PERMISSIONS],
    content_scripts: [{ matches: [...SAFARI_FOCUS_HOST_PERMISSIONS], js: ["content.js"] }],
  };
  const info = {
    MinimumOSVersion: "15.4",
    NSExtension: { SFSafariWebsiteAccess: { Level: "Some", "Allowed Domains": [...SAFARI_FOCUS_ALLOWED_DOMAINS] } },
  };
  const background = `
    const APPROVED_RULE_HOSTS = {
      "short-form:youtube-shorts": "youtube.com",
      "short-form:instagram-reels": "instagram.com",
      "short-form:tiktok-feed": "tiktok.com"
    };
    function payload(host, rule) { return { type: "record-pending-intervention", source: "ios-safari-short-form", host, rule }; }
    browser.runtime.onMessage.addListener(() => browser.runtime.sendNativeMessage("app.freed.recovery", payload("youtube.com", "short-form:youtube-shorts")));
  `;
  const content = "const runtime = browser.runtime; if (runtime?.sendMessage) runtime.sendMessage({host: 'youtube.com', rule: 'short-form:youtube-shorts'});";
  const nativeHandlerBinary = `record-pending-intervention ios-safari-short-form ${Object.entries(APPROVED_RULE_HOSTS).flat().join(" ")}`;
  return { manifest, info, background, content, nativeHandlerBinary };
}

function assertSafariFocusShieldContractSelfTest() {
  const fixture = validFixture();
  assert.equal(inspectSafariFocusShieldContract(fixture).usableForManualEvidence, true);
  const unsafeCases = [
    { ...fixture, manifest: { ...fixture.manifest, background: {} } },
    { ...fixture, manifest: { ...fixture.manifest, host_permissions: ["<all_urls>"] } },
    { ...fixture, manifest: { ...fixture.manifest, content_scripts: [] } },
    { ...fixture, info: { ...fixture.info, MinimumOSVersion: "15.3" } },
    { ...fixture, info: { ...fixture.info, NSExtension: { SFSafariWebsiteAccess: { Level: "All", "Allowed Domains": ["*"] } } } },
    { ...fixture, background: fixture.background.replace("APPROVED_RULE_HOSTS", "rules") },
    { ...fixture, background: fixture.background.replace('source: "ios-safari-short-form"', 'source: "unsafe"') },
    { ...fixture, nativeHandlerBinary: "record-pending-intervention" },
    { ...fixture, content: "browser.runtime.sendNativeMessage('app.freed.recovery', {})" },
  ];
  for (const unsafe of unsafeCases) {
    assert.equal(inspectSafariFocusShieldContract(unsafe).usableForManualEvidence, false);
  }
}

module.exports = {
  APPROVED_RULE_HOSTS,
  SAFARI_FOCUS_ALLOWED_DOMAINS,
  SAFARI_FOCUS_HOST_PERMISSIONS,
  assertSafariFocusShieldContractSelfTest,
  inspectSafariFocusShieldContract,
  versionAtLeast,
};
