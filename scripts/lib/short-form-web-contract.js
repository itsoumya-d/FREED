#!/usr/bin/env node

const assert = require("node:assert/strict");

const DEFAULT_SHORT_FORM_WEB_URL = "https://youtube.com/shorts/dQw4w9WgXcQ";

const SHORT_FORM_WEB_SURFACES = [
  {
    id: "youtube-shorts-web",
    label: "YouTube Shorts",
    hosts: ["youtube.com", "www.youtube.com", "m.youtube.com"],
    exactPaths: ["/shorts", "/feed/shorts"],
    pathPrefixes: ["/shorts/"],
    ruleFilter: "^https?://([^/?#]+\\.)?youtube\\.com/shorts([/?#]|$)",
    requiredRulePattern: /youtube\\\.com\/shorts/i,
  },
  {
    id: "youtube-shorts-feed-web",
    label: "YouTube Shorts feed",
    hosts: ["youtube.com", "www.youtube.com", "m.youtube.com"],
    exactPaths: ["/feed/shorts"],
    pathPrefixes: [],
    ruleFilter: "^https?://([^/?#]+\\.)?youtube\\.com/feed/shorts([/?#]|$)",
    requiredRulePattern: /youtube\\\.com\/feed\/shorts/i,
  },
  {
    id: "instagram-reels-web",
    label: "Instagram Reels",
    hosts: ["instagram.com", "www.instagram.com"],
    exactPaths: ["/reel", "/reels"],
    pathPrefixes: ["/reel/", "/reels/"],
    ruleFilter: "^https?://([^/?#]+\\.)?instagram\\.com/reel(s)?([/?#]|/|$)",
    requiredRulePattern: /instagram\\\.com\/reel/i,
  },
  {
    id: "tiktok-for-you-web",
    label: "TikTok For You",
    hosts: ["tiktok.com", "www.tiktok.com", "m.tiktok.com"],
    exactPaths: ["/foryou"],
    pathPrefixes: ["/foryou/"],
    ruleFilter: "^https?://([^/?#]+\\.)?tiktok\\.com/foryou([/?#]|$)",
    requiredRulePattern: /tiktok\\\.com\/foryou/i,
  },
];

const SAFARI_SHORT_FORM_WEB_RULE_FILTERS = SHORT_FORM_WEB_SURFACES.map((surface) => surface.ruleFilter);

// The feed URL is covered by a distinct rule but the package proof only needs one YouTube Shorts signal.
const SAFARI_SHORT_FORM_REQUIRED_RULE_SIGNALS = SHORT_FORM_WEB_SURFACES
  .filter((surface) => surface.id !== "youtube-shorts-feed-web")
  .map((surface) => ({ key: surface.id, pattern: surface.requiredRulePattern }));

function isShortFormWebUrl(value) {
  let parsed;
  try {
    parsed = new URL(String(value));
  } catch {
    return false;
  }

  if (parsed.protocol !== "https:") return false;

  const host = parsed.hostname.toLowerCase();
  const pathname = parsed.pathname.toLowerCase();
  return SHORT_FORM_WEB_SURFACES.some(
    (surface) =>
      surface.hosts.includes(host) &&
      (surface.exactPaths.includes(pathname) || surface.pathPrefixes.some((prefix) => pathname.startsWith(prefix)))
  );
}

module.exports = {
  DEFAULT_SHORT_FORM_WEB_URL,
  SAFARI_SHORT_FORM_REQUIRED_RULE_SIGNALS,
  SAFARI_SHORT_FORM_WEB_RULE_FILTERS,
  SHORT_FORM_WEB_SURFACES,
  isShortFormWebUrl,
};

if (require.main === module && process.argv.includes("--self-test")) {
  assert.equal(SAFARI_SHORT_FORM_WEB_RULE_FILTERS.length, 4);
  assert.equal(SAFARI_SHORT_FORM_REQUIRED_RULE_SIGNALS.length, 3);
  assert.equal(isShortFormWebUrl(DEFAULT_SHORT_FORM_WEB_URL), true);
  assert.equal(isShortFormWebUrl("https://www.youtube.com/feed/shorts"), true);
  assert.equal(isShortFormWebUrl("https://www.instagram.com/reels/"), true);
  assert.equal(isShortFormWebUrl("https://m.tiktok.com/foryou/"), true);
  assert.equal(isShortFormWebUrl("https://www.youtube.com/watch?v=dQw4w9WgXcQ"), false);
  console.log("short-form-web-contract self-test: pass");
}
