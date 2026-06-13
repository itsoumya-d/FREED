#!/usr/bin/env node

const assert = require("node:assert/strict");
const net = require("node:net");

const RESERVED_HOSTS = new Set([
  "0.0.0.0",
  "127.0.0.1",
  "example.com",
  "example.net",
  "example.org",
  "localhost",
  "::",
  "::1",
]);

const RESERVED_TLDS = new Set(["example", "invalid", "localhost", "test"]);

function safeExternalHttpsUrl(value, label) {
  const raw = noPlaceholderText(value, label);
  let parsed;
  try {
    parsed = new URL(raw);
  } catch {
    throw new Error(`${label} must be a valid HTTPS URL.`);
  }
  if (parsed.protocol !== "https:") {
    throw new Error(`${label} must use https://.`);
  }
  assertExternalHostname(parsed.hostname, label);
  return parsed.toString();
}

function safeExternalHttpsEndpoint(value, label) {
  const normalized = safeExternalHttpsUrl(value, label);
  const parsed = new URL(normalized);
  if (parsed.username || parsed.password) {
    throw new Error(`${label} must not include URL credentials.`);
  }
  if (parsed.search) {
    throw new Error(`${label} must not include query strings.`);
  }
  if (parsed.hash) {
    throw new Error(`${label} must not include URL fragments.`);
  }
  if (parsed.pathname === "/" || parsed.pathname.trim() === "") {
    throw new Error(`${label} must include a concrete route path.`);
  }
  return normalized;
}

function safeExternalHost(value, label) {
  const raw = noPlaceholderText(value, label);
  const host = raw.includes("://") ? hostnameFromUrl(raw, label) : raw;
  if (/[/?#]/.test(host)) {
    throw new Error(`${label} must be a host name, not a URL path.`);
  }
  const normalized = normalizeHost(host);
  assertExternalHostname(normalized, label);
  return normalized;
}

function hostnameFromUrl(value, label) {
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error(`${label} must be a host name or valid URL.`);
  }
  if (parsed.protocol !== "https:") {
    throw new Error(`${label} URL form must use https://.`);
  }
  return parsed.hostname;
}

function noPlaceholderText(value, label) {
  const raw = String(value || "").trim();
  if (!raw) throw new Error(`${label} must not be empty.`);
  if (/[<>]/.test(raw) || /\b(?:placeholder|example|todo|your-|sample)\b/i.test(raw)) {
    throw new Error(`${label} must be a real external target, not placeholder text.`);
  }
  return raw;
}

function assertExternalHostname(value, label) {
  const host = normalizeHost(value);
  if (!host) throw new Error(`${label} must include a host.`);
  if (RESERVED_HOSTS.has(host)) throw new Error(`${label} must not use reserved host ${host}.`);
  if (host.endsWith(".local") || host.endsWith(".internal")) {
    throw new Error(`${label} must not use local/private host ${host}.`);
  }
  const tld = host.split(".").pop() || "";
  if (RESERVED_TLDS.has(tld)) throw new Error(`${label} must not use reserved .${tld} domains.`);
  if (!net.isIP(host) && !/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/i.test(host)) {
    throw new Error(`${label} must include a concrete external domain.`);
  }
  if (isPrivateIp(host)) throw new Error(`${label} must not use private, loopback, multicast, or documentation IPs.`);
}

function normalizeHost(value) {
  return String(value || "")
    .trim()
    .replace(/^\[/, "")
    .replace(/\]$/, "")
    .replace(/\.$/, "")
    .toLowerCase();
}

function isPrivateIp(host) {
  const family = net.isIP(host);
  if (family === 4) {
    const parts = host.split(".").map((part) => Number(part));
    const [a, b] = parts;
    return (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      a === 169 && b === 254 ||
      a === 172 && b >= 16 && b <= 31 ||
      a === 192 && b === 0 && parts[2] === 2 ||
      a === 192 && b === 168 ||
      a === 198 && b === 18 ||
      a === 198 && b === 19 ||
      a === 198 && b === 51 && parts[2] === 100 ||
      a === 203 && b === 0 && parts[2] === 113 ||
      a >= 224
    );
  }
  if (family === 6) {
    return (
      host === "::" ||
      host === "::1" ||
      host.startsWith("fc") ||
      host.startsWith("fd") ||
      host.startsWith("fe80:") ||
      host.startsWith("2001:db8:")
    );
  }
  return false;
}

function runSelfTest() {
  assert.equal(safeExternalHttpsUrl("https://youtube.com/results?search_query=workout", "--normal-url"), "https://youtube.com/results?search_query=workout");
  assert.equal(safeExternalHttpsEndpoint("https://api.freedrecovery.app/api/purchases/verify", "--purchase-verify-endpoint"), "https://api.freedrecovery.app/api/purchases/verify");
  assert.equal(safeExternalHost("adult-domain.realsite.com", "--adult-host"), "adult-domain.realsite.com");
  assert.equal(safeExternalHost("https://adult-domain.realsite.com/path", "--adult-host"), "adult-domain.realsite.com");

  assert.throws(() => safeExternalHttpsUrl("http://youtube.com", "--normal-url"), /https/);
  assert.throws(() => safeExternalHttpsUrl("https://example.com", "--normal-url"), /placeholder|reserved/);
  assert.throws(() => safeExternalHttpsUrl("https://127.0.0.1", "--normal-url"), /reserved|private/);
  assert.throws(() => safeExternalHttpsEndpoint("https://user:pass@api.freedrecovery.app/api/purchases/verify", "--purchase-verify-endpoint"), /URL credentials/);
  assert.throws(() => safeExternalHttpsEndpoint("https://api.freedrecovery.app/api/purchases/verify?token=secret", "--purchase-verify-endpoint"), /query strings/);
  assert.throws(() => safeExternalHttpsEndpoint("https://api.freedrecovery.app/api/purchases/verify#access_token=secret", "--purchase-verify-endpoint"), /URL fragments/);
  assert.throws(() => safeExternalHttpsEndpoint("https://api.freedrecovery.app", "--purchase-verify-endpoint"), /concrete route path/);
  assert.throws(() => safeExternalHost("<real-adult-host>", "--adult-host"), /placeholder/);
  assert.throws(() => safeExternalHost("localhost", "--adult-host"), /reserved/);
  assert.throws(() => safeExternalHost("192.168.0.1", "--adult-host"), /private/);
  assert.throws(() => safeExternalHost("adult.local", "--adult-host"), /local/);

  console.log("evidence-target-safety self-test: pass");
}

if (require.main === module) {
  if (process.argv.includes("--self-test")) {
    runSelfTest();
  } else {
    console.error("Usage: node scripts/lib/evidence-target-safety.js --self-test");
    process.exit(1);
  }
}

module.exports = {
  assertExternalHostname,
  safeExternalHost,
  safeExternalHttpsEndpoint,
  safeExternalHttpsUrl,
};
