"use strict";

const NATIVE_APP_ID = "app.freed.recovery";
const APPROVED_RULE_HOSTS = Object.freeze({
  "short-form:youtube-shorts": "youtube.com",
  "short-form:instagram-reels": "instagram.com",
  "short-form:tiktok-feed": "tiktok.com"
});

function approvedNativePayload(message) {
  if (!message || typeof message !== "object") return null;
  const host = typeof message.host === "string" ? message.host : "";
  const rule = typeof message.rule === "string" ? message.rule : "";
  if (APPROVED_RULE_HOSTS[rule] !== host) return null;
  return {
    type: "record-pending-intervention",
    source: "ios-safari-short-form",
    host,
    rule
  };
}

browser.runtime.onMessage.addListener((message, sender) => {
  if (message?.type === "check-safari-configuration") {
    return isOwnSafariCheckSender(message, sender) ? runSafariRecoveryObservation() : Promise.resolve({ persisted: false });
  }
  if (message?.type === "get-protection-configuration") {
    return browser.runtime.sendNativeMessage(NATIVE_APP_ID, { type: "get-protection-configuration" })
      .catch(() => ({ protectionConfigurationActive: false }));
  }
  const payload = approvedNativePayload(message);
  if (!payload) return Promise.resolve({ accepted: false });
  return browser.runtime
    .sendNativeMessage(NATIVE_APP_ID, payload)
    .catch(() => ({ accepted: false }));
});

// Observation v1: fixed own-resource/API reads only. No page message supplies facts.
function isOwnSafariCheckSender(message, sender) {
  return message && Object.keys(message).sort().join(",") === "type,version" && message.version === 1 &&
    sender && sender.id === browser.runtime.id && sender.url === browser.runtime.getURL("safari-observation/check.html") &&
    sender.tab === undefined;
}

async function safariObservationHash(value) {
  const bytes = typeof value === "string" ? new TextEncoder().encode(value) : value;
  return Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)), byte => byte.toString(16).padStart(2, "0")).join("");
}

async function collectSafariRecoveryFacts() {
  const manifest = browser.runtime.getManifest();
  const rules = manifest.declarative_net_request?.rule_resources ?? [];
  if (!Array.isArray(rules) || rules.length > 1 || (rules.length && !["freed_safe_recovery_probe_v1", "freed_adult_recovery_internal_v1"].includes(rules[0].id))) throw new Error("package-mismatch");
  const files = ["manifest.json", "background.js", "content.js", "safari-observation/check.html", "safari-observation/check.js", "safari-observation/check.css"];
  if (rules[0]?.id === "freed_adult_recovery_internal_v1") files.push("adult-recovery/artifact.json", "adult-recovery/feed.json", "adult-recovery/rules.json", "adult-recovery/page.html", "adult-recovery/page.js", "adult-recovery/page.css", "adult-recovery/kite.svg");
  if (rules[0]?.id === "freed_safe_recovery_probe_v1") files.push("recovery-probe/rules.json", "recovery-probe/page.html", "recovery-probe/page.js", "recovery-probe/page.css", "recovery-probe/kite.svg");
  const hashes = [];
  for (const file of files.sort()) {
    const response = await fetch(browser.runtime.getURL(file));
    if (!response.ok) throw new Error("package-read");
    const bytes = await response.arrayBuffer();
    if (bytes.byteLength > 1048576) throw new Error("package-read");
    hashes.push(file + "\0" + await safariObservationHash(bytes) + "\n");
  }
  const origins = [...new Set((manifest.host_permissions ?? []).flatMap(pattern => pattern.startsWith("*://") ? ["http://" + pattern.slice(4), "https://" + pattern.slice(4)] : [pattern]))].sort();
  if (!origins.length || origins.length > 4012 || origins.some(value => typeof value !== "string" || !/^https?:\/\//.test(value))) throw new Error("package-mismatch");
  const facts = { bundleArtifactDigest: await safariObservationHash("FREED_SAFARI_OBSERVATION_V1\n" + hashes.join("")), scopeDigest: await safariObservationHash("FREED_SAFARI_OBSERVATION_SCOPE_V1\n" + origins.map(value => value + "\n").join("")), staticRules: "unavailable", dynamicRules: "unavailable", sessionRules: "unavailable", grants: "unknown", requiredScopeCount: origins.length, coveredScopeCount: null, diagnostic: "none" };
  const dnr = browser.declarativeNetRequest;
  if (typeof dnr?.getEnabledRulesets === "function") {
    try { const ids = await dnr.getEnabledRulesets(); facts.staticRules = !Array.isArray(ids) ? "error" : ids.some(id => !rules.some(rule => rule.id === id)) || new Set(ids).size !== ids.length ? "unexpected" : rules.length ? ids.length === 1 ? "expected-enabled" : "missing" : "not-configured"; } catch { facts.staticRules = "error"; }
  }
  for (const [field, method] of [["dynamicRules", "getDynamicRules"], ["sessionRules", "getSessionRules"]]) {
    if (typeof dnr?.[method] === "function") { try { const values = await dnr[method](); facts[field] = Array.isArray(values) ? values.length ? "nonzero" : "zero" : "error"; } catch { facts[field] = "error"; } }
  }
  if (typeof browser.permissions?.contains === "function") {
    try {
      const allGranted = await browser.permissions.contains({ origins });
      if (typeof allGranted !== "boolean") throw new Error("api-error");
      if (allGranted === true) { facts.grants = "complete"; facts.coveredScopeCount = origins.length; }
      else {
        let covered = 0;
        for (let index = 0; index < origins.length; index += 16) { const granted = await Promise.all(origins.slice(index, index + 16).map(origin => browser.permissions.contains({ origins: [origin] }))); if (granted.some(value => typeof value !== "boolean")) throw new Error("api-error"); covered += granted.filter(value => value === true).length; }
        facts.coveredScopeCount = covered; facts.grants = covered === origins.length ? "complete" : covered === 0 ? "missing" : "partial";
      }
    } catch { facts.grants = "unknown"; facts.coveredScopeCount = null; }
  }
  if ([facts.staticRules, facts.dynamicRules, facts.sessionRules].includes("unavailable") || facts.grants === "unknown") facts.diagnostic = "api-unavailable";
  if ([facts.staticRules, facts.dynamicRules, facts.sessionRules].includes("error")) facts.diagnostic = "api-error";
  return facts;
}

let safariObservationInFlight = null;
let safariObservationRefreshPending = false;
function runSafariRecoveryObservation() {
  if (safariObservationInFlight) return safariObservationInFlight;
  const work = (async () => {
    let timer, expired = false;
    try {
      const operation = (async () => {
        const begin = await browser.runtime.sendNativeMessage(NATIVE_APP_ID, { version: 1, type: "begin-safari-recovery-observation" });
        if (expired) return { persisted: false };
        if (begin?.version !== 1 || begin.issued !== true || !/^[a-f0-9]{64}$/.test(begin.nonce) || begin.expiresAfterMs !== 30000) return { persisted: false };
        const facts = await collectSafariRecoveryFacts();
        if (expired) return { persisted: false };
        const commit = { version: 1, type: "commit-safari-recovery-observation", nonce: begin.nonce, ...facts };
        try { return await browser.runtime.sendNativeMessage(NATIVE_APP_ID, commit); }
        catch { return expired ? { persisted: false } : await browser.runtime.sendNativeMessage(NATIVE_APP_ID, commit); }
      })();
      return await Promise.race([operation, new Promise(resolve => { timer = setTimeout(() => { expired = true; resolve({ persisted: false }); }, 30000); })]);
    } catch { return { persisted: false }; }
    finally { clearTimeout(timer); }
  })();
  safariObservationInFlight = work;
  void work.finally(() => {
    if (safariObservationInFlight === work) safariObservationInFlight = null;
    if (safariObservationRefreshPending) { safariObservationRefreshPending = false; void runSafariRecoveryObservation(); }
  });
  return work;
}

function queueSafariRecoveryObservation() {
  if (safariObservationInFlight) { safariObservationRefreshPending = true; return safariObservationInFlight.then(() => safariObservationInFlight); }
  return runSafariRecoveryObservation();
}

browser.runtime.onStartup?.addListener(() => runSafariRecoveryObservation());
browser.runtime.onInstalled?.addListener(() => runSafariRecoveryObservation());
browser.permissions?.onAdded?.addListener(() => queueSafariRecoveryObservation());
browser.permissions?.onRemoved?.addListener(() => queueSafariRecoveryObservation());
