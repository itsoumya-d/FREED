#!/usr/bin/env node

const assert = require("node:assert/strict");

const REVIEWED_ADULT_DOMAIN_FEED_SOURCE_ID_FAMILIES = [
  "oisd-nsfw",
  "stevenblack",
  "cloudflare-family",
  "freed-custom",
];

function normalizeAdultDomainFeedSourceId(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64) || "adult-feed-source";
}

function reviewedAdultDomainFeedSourceFamily(value) {
  const id = normalizeAdultDomainFeedSourceId(value);
  if (id === "oisd-nsfw" || id.startsWith("oisd-nsfw-")) return "oisd-nsfw";
  if (id === "stevenblack" || id.startsWith("stevenblack-")) return "stevenblack";
  if (id === "cloudflare-family" || id.startsWith("cloudflare-family-")) return "cloudflare-family";
  if (
    id === "freed-custom" ||
    id.startsWith("freed-custom-") ||
    id.startsWith("freed-reviewed-") ||
    id.startsWith("custom-reviewed-")
  ) {
    return "freed-custom";
  }
  return null;
}

function parseAdultDomainFeedSourceConfigWithIssues(raw = "") {
  const sources = [];
  const issues = [];
  const seenIds = new Set();

  String(raw).split(/\r?\n/).forEach((rawLine, index) => {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) return;

    const lineNumber = index + 1;
    const [rawId, rawLabel, ...urlParts] = line.split("|").map((part) => part.trim());
    const url = urlParts.join("|").trim();
    if (!rawId || !rawLabel || !url) {
      issues.push(`FREED_ADULT_DOMAIN_FEED_SOURCE_URLS line ${lineNumber} must use id|label|https://source-url`);
      return;
    }

    const id = normalizeAdultDomainFeedSourceId(rawId);
    if (!reviewedAdultDomainFeedSourceFamily(id)) {
      issues.push(
        `${rawLabel} adult-domain feed source id must identify a reviewed source family: ${REVIEWED_ADULT_DOMAIN_FEED_SOURCE_ID_FAMILIES.join(", ")}`
      );
    }
    if (seenIds.has(id)) {
      issues.push(`FREED_ADULT_DOMAIN_FEED_SOURCE_URLS must not repeat source id ${id}`);
    }
    seenIds.add(id);
    sources.push({
      id,
      label: rawLabel.slice(0, 80),
      url,
    });
  });

  return { sources, issues };
}

module.exports = {
  REVIEWED_ADULT_DOMAIN_FEED_SOURCE_ID_FAMILIES,
  normalizeAdultDomainFeedSourceId,
  parseAdultDomainFeedSourceConfigWithIssues,
  reviewedAdultDomainFeedSourceFamily,
};

if (require.main === module && process.argv.includes("--self-test")) {
  const parsed = parseAdultDomainFeedSourceConfigWithIssues(
    [
      "oisd-nsfw|OISD NSFW|https://feeds.freedrecovery.app/oisd-nsfw.txt",
      "stevenblack-adult|StevenBlack Adult|https://feeds.freedrecovery.app/stevenblack-adult.txt",
      "freed-custom-release|FREED reviewed custom|https://feeds.freedrecovery.app/custom.txt",
    ].join("\n")
  );
  assert.equal(parsed.sources.length, 3);
  assert.deepEqual(parsed.issues, []);
  assert.equal(reviewedAdultDomainFeedSourceFamily("Cloudflare Family Adult Export"), "cloudflare-family");
  assert.equal(reviewedAdultDomainFeedSourceFamily("random-list"), null);
  assert.match(
    parseAdultDomainFeedSourceConfigWithIssues("random|Random|https://feeds.freedrecovery.app/random.txt").issues.join("\n"),
    /reviewed source family/
  );
  assert.match(parseAdultDomainFeedSourceConfigWithIssues("bad-line").issues.join("\n"), /id\|label\|https/);
  console.log("adult-domain-feed-source-contract self-test: pass");
}
