export type BlockVerdict = "allow" | "block" | "review";

export type ClassificationResult = {
  verdict: BlockVerdict;
  confidence: number;
  host: string;
  category: "adult" | "adult-search-intent" | "known-safe" | "unknown";
  reason: string;
  matchedRule: string;
};

export type BlockingAttempt = {
  url: string;
  host: string;
  detectedAt: string;
  result: ClassificationResult;
  source: "browser" | "search" | "manual-check" | "panic-button" | "app";
  sourcePackage?: string;
  sessionDurationSec?: number;
};

export type AdultDomainFeedSource = {
  id: "embedded-seed" | "oisd-nsfw" | "stevenblack" | "cloudflare-family" | "freed-custom" | "server-extra" | string;
  label: string;
  updatedAt?: string;
  domainCount: number;
};

export type AdultDomainFeed = {
  version: string;
  generatedAt: string;
  domains: string[];
  exceptions: string[];
  sources: AdultDomainFeedSource[];
  checksum: string;
};

export type SafariContentBlockerRule = {
  trigger: {
    "url-filter": string;
  };
  action: {
    type: "block";
  };
};

export type AdultDomainFeedReadiness = {
  ready: boolean;
  version: string;
  generatedAt: string;
  domainCount: number;
  sourceCount: number;
  checksum: string;
  issues: string[];
};

export const DEFAULT_ALLOWED_NORMAL_DOMAINS = [
  "google.com",
  "youtube.com",
  "youtu.be",
  "instagram.com",
  "x.com",
  "twitter.com",
  "reddit.com",
  "facebook.com",
  "linkedin.com",
  "wikipedia.org",
  "github.com",
  "stackoverflow.com",
  "netflix.com",
  "spotify.com",
  "twitch.tv",
  "roblox.com",
  "minecraft.net",
  "coursera.org",
  "khanacademy.org"
];

export const ADULT_DOMAIN_SEEDS = [
  "adultfriendfinder.com",
  "beeg.com",
  "bongacams.com",
  "brazzers.com",
  "cam4.com",
  "camsoda.com",
  "chaturbate.com",
  "drtuber.com",
  "empflix.com",
  "eporner.com",
  "erome.com",
  "fakku.net",
  "flirt4free.com",
  "fux.com",
  "gotporn.com",
  "hentaihaven.xxx",
  "hentaifox.com",
  "javhd.com",
  "literotica.com",
  "livejasmin.com",
  "manyvids.com",
  "motherless.com",
  "myfreecams.com",
  "naughtyamerica.com",
  "nhentai.net",
  "nuvid.com",
  "onlyfans.com",
  "porn.com",
  "porn300.com",
  "pornhub.com",
  "porntrex.com",
  "redtube.com",
  "rule34.xxx",
  "sex.com",
  "spankbang.com",
  "stripchat.com",
  "sunporno.com",
  "tnaflix.com",
  "tube8.com",
  "vporn.com",
  "xhamster.com",
  "xhamsterlive.com",
  "xnxx.com",
  "xvideos.com",
  "youjizz.com",
  "youporn.com"
];

export const DEFAULT_SEARCH_ENGINE_DOMAINS = [
  "bing.com",
  "duckduckgo.com",
  "yahoo.com",
  "brave.com",
  "ecosia.org",
  "startpage.com",
  "qwant.com",
  "yandex.com",
  "baidu.com"
];

const explicitDomainTokens = [
  "porn",
  "xvideos",
  "xnxx",
  "xhamster",
  "redtube",
  "youporn",
  "camgirl",
  "chaturbate",
  "stripchat",
  "hentai",
  "nsfw",
  "xxx"
];

const explicitSearchTerms = [
  "porn",
  "pornography",
  "porno",
  "xxx",
  "adult video",
  "nude videos",
  "nsfw video",
  "hentai",
  "camgirl",
  "onlyfans leak"
];

const recoveryEducationSearchTerms = [
  "addiction",
  "recovery",
  "quit",
  "blocker",
  "parental control",
  "therapy",
  "research",
  "statistics",
  "effects",
  "education",
  "health",
  "support",
  "support group",
  "accountability",
  "relapse",
  "prevention",
  "urge",
  "sobriety",
  "nofap",
  "dopamine",
  "compulsive",
  "screen time"
];

const consumptionIntentSearchTerms = [
  "watch",
  "stream",
  "download",
  "free",
  "full",
  "leak",
  "gallery",
  "pics",
  "images",
  "uncensored"
];

const recoveryDomainContextTerms = [
  "addiction",
  "recovery",
  "quit",
  "blocker",
  "filter",
  "parental",
  "control",
  "therapy",
  "research",
  "statistics",
  "effects",
  "education",
  "health",
  "support",
  "accountability",
  "relapse",
  "prevention",
  "urge",
  "sobriety",
  "nofap",
  "dopamine",
  "compulsive",
  "screen",
  "time",
  "help"
];

const consumptionDomainContextTerms = [
  "watch",
  "stream",
  "download",
  "free",
  "full",
  "leak",
  "gallery",
  "pics",
  "images",
  "uncensored",
  "tube",
  "videos",
  "cams"
];

const EMBEDDED_ADULT_DOMAIN_FEED_VERSION = "freed-embedded-2026-05-19";
const EMBEDDED_ADULT_DOMAIN_FEED_GENERATED_AT = "2026-05-19T00:00:00.000Z";
const MAX_ADULT_FEED_DOMAINS = 50_000;

export function normalizeAdultDomainCandidate(input: string): string | null {
  let value = input.trim().toLowerCase();
  if (!value || value.startsWith("#") || value.startsWith("!") || value.startsWith("//")) return null;

  value = value.split("#")[0]?.trim() ?? "";
  if (!value) return null;

  const hostsLine = value.split(/\s+/);
  if (/^(?:0\.0\.0\.0|127\.0\.0\.1|::1)$/.test(hostsLine[0] ?? "")) {
    value = hostsLine[1] ?? "";
  }

  value = value
    .replace(/^\|\|/, "")
    .replace(/^\*\./, "")
    .replace(/^\./, "")
    .replace(/\^.*$/, "")
    .trim();

  try {
    if (/^https?:\/\//i.test(value)) {
      value = new URL(value).hostname;
    }
  } catch {
    return null;
  }

  value = value
    .replace(/^https?:\/\//i, "")
    .split("/")[0]
    .split("?")[0]
    .split("#")[0]
    .split(":")[0]
    .replace(/^www\./, "")
    .trim()
    .toLowerCase();

  if (!/^[a-z0-9.-]+$/.test(value)) return null;
  if (!value.includes(".") || value.includes("..")) return null;
  if (value.length > 253) return null;
  const labels = value.split(".");
  if (labels.some((label) => label.length === 0 || label.length > 63 || label.startsWith("-") || label.endsWith("-"))) return null;
  return value;
}

export function createAdultDomainFeed({
  version,
  generatedAt,
  domains,
  exceptions = [],
  sources = []
}: {
  version: string;
  generatedAt: string;
  domains: string[];
  exceptions?: string[];
  sources?: Omit<AdultDomainFeedSource, "domainCount">[] | AdultDomainFeedSource[];
}): AdultDomainFeed {
  const normalizedExceptions = normalizeDomainList(exceptions);
  const exceptionSet = new Set(normalizedExceptions);
  const normalizedDomains = normalizeDomainList(domains)
    .filter((domain) => !isFeedExceptionDomain(domain, exceptionSet))
    .slice(0, MAX_ADULT_FEED_DOMAINS);

  const normalizedSources = sources.length > 0
    ? sources.map((source) => ({
        ...source,
        label: source.label.slice(0, 80),
        domainCount: "domainCount" in source ? source.domainCount : normalizedDomains.length
      }))
    : [
        {
          id: "embedded-seed",
          label: "FREED embedded adult-domain seed",
          updatedAt: EMBEDDED_ADULT_DOMAIN_FEED_GENERATED_AT,
          domainCount: normalizedDomains.length
        }
      ];

  return {
    version: version.trim() || EMBEDDED_ADULT_DOMAIN_FEED_VERSION,
    generatedAt: validIsoOrFallback(generatedAt, EMBEDDED_ADULT_DOMAIN_FEED_GENERATED_AT),
    domains: normalizedDomains,
    exceptions: normalizedExceptions,
    sources: normalizedSources,
    checksum: checksumFeed(normalizedDomains, normalizedExceptions)
  };
}

export function getEmbeddedAdultDomainFeed(): AdultDomainFeed {
  return createAdultDomainFeed({
    version: EMBEDDED_ADULT_DOMAIN_FEED_VERSION,
    generatedAt: EMBEDDED_ADULT_DOMAIN_FEED_GENERATED_AT,
    domains: ADULT_DOMAIN_SEEDS,
    exceptions: DEFAULT_ALLOWED_NORMAL_DOMAINS,
    sources: [
      {
        id: "embedded-seed",
        label: "FREED embedded adult-domain seed",
        updatedAt: EMBEDDED_ADULT_DOMAIN_FEED_GENERATED_AT,
        domainCount: ADULT_DOMAIN_SEEDS.length
      }
    ]
  });
}

export function getAdultDomainFeedReadiness(feed: AdultDomainFeed = getEmbeddedAdultDomainFeed()): AdultDomainFeedReadiness {
  const issues: string[] = [];
  const normalizedDomains = normalizeDomainList(feed.domains);
  const normalizedExceptions = normalizeDomainList(feed.exceptions);
  const normalDomainLeak = normalizedDomains.filter((domain) =>
    DEFAULT_ALLOWED_NORMAL_DOMAINS.some((allowed) => hostMatches(domain, allowed) || hostMatches(allowed, domain))
  );

  if (normalizedDomains.length === 0) issues.push("adult domain feed is empty");
  if (normalizedDomains.length !== feed.domains.length) issues.push("adult domain feed contains invalid or duplicate domains");
  if (normalDomainLeak.length > 0) issues.push(`adult domain feed includes normal browsing domains: ${normalDomainLeak.slice(0, 5).join(", ")}`);
  if (feed.sources.length === 0) issues.push("adult domain feed has no source metadata");
  if (!Number.isFinite(Date.parse(feed.generatedAt))) issues.push("adult domain feed generatedAt is not valid ISO time");
  if (feed.checksum !== checksumFeed(normalizedDomains, normalizedExceptions)) issues.push("adult domain feed checksum does not match normalized content");

  return {
    ready: issues.length === 0,
    version: feed.version,
    generatedAt: feed.generatedAt,
    domainCount: normalizedDomains.length,
    sourceCount: feed.sources.length,
    checksum: feed.checksum,
    issues
  };
}

export function compileSafariContentBlockerRules(feed: AdultDomainFeed = getEmbeddedAdultDomainFeed()): SafariContentBlockerRule[] {
  return feed.domains.map((domain) => ({
    trigger: {
      "url-filter": `^https?://([^/?#]+\\.)?${escapeRegExp(domain)}([/:?#]|$)`
    },
    action: {
      type: "block"
    }
  }));
}

function normalizeDomainList(values: string[]) {
  return Array.from(
    new Set(
      values
        .map(normalizeAdultDomainCandidate)
        .filter((domain): domain is string => Boolean(domain))
    )
  ).sort();
}

function isFeedExceptionDomain(domain: string, exceptions: Set<string>) {
  return Array.from(exceptions).some((exception) => hostMatches(domain, exception));
}

function validIsoOrFallback(value: string, fallback: string) {
  return Number.isFinite(Date.parse(value)) ? value : fallback;
}

function checksumFeed(domains: string[], exceptions: string[]) {
  return fnv1aHex(`${domains.join("\n")}\n--exceptions--\n${exceptions.join("\n")}`);
}

function fnv1aHex(value: string) {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return `fnv1a32:${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function normalizeHost(input: string) {
  const raw = input.trim().toLowerCase();
  if (!raw) return "";

  const normalizeHostCandidate = (value: string) => {
    const hostOnly = value.trim().toLowerCase().split("@").pop() ?? value;
    const withoutPath = hostOnly.split("/")[0]?.split("?")[0]?.split("#")[0] ?? hostOnly;
    const withoutPort = !withoutPath.startsWith("[") && withoutPath.includes(":")
      ? withoutPath.split(":")[0] ?? withoutPath
      : withoutPath;
    const normalized = withoutPort
      .replace(/^www\./, "")
      .replace(/[^a-z0-9.-]/g, "")
      .replace(/^\.+|\.+$/g, "")
      .slice(0, 120);

    if (!normalized.includes(".")) return "";
    if (!/^[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?$/.test(normalized)) return "";
    if (normalized.split(".").some((part) => !part || part.startsWith("-") || part.endsWith("-"))) return "";
    return normalized;
  };

  try {
    const withProtocol = raw.match(/^https?:\/\//i) ? raw : `https://${raw}`;
    return normalizeHostCandidate(new URL(withProtocol).hostname);
  } catch {
    return normalizeHostCandidate(raw.replace(/^https?:\/\//i, ""));
  }
}

export function redactUrlForStorage(input: string) {
  const host = normalizeHost(input);
  return host ? `https://${host}` : "redacted://unknown";
}

function hostMatches(host: string, domain: string) {
  return host === domain || host.endsWith(`.${domain}`);
}

function isKnownSearchEngineHost(host: string) {
  return DEFAULT_SEARCH_ENGINE_DOMAINS.some((domain) => hostMatches(host, domain)) || /^google\.[a-z.]{2,}$/.test(host);
}

function hostContextParts(host: string) {
  return host.split(/[^a-z0-9]+/).filter(Boolean);
}

function hasHostContext(host: string, terms: string[]) {
  const parts = hostContextParts(host);
  const phrase = parts.join(" ");
  return terms.some((term) => (term.includes(" ") ? phrase.includes(term) : parts.includes(term)));
}

function extractSearchText(input: string) {
  try {
    const withProtocol = input.match(/^https?:\/\//i) ? input : `https://${input}`;
    const url = new URL(withProtocol);
    const fields = ["q", "query", "search_query", "p", "text"];
    return fields
      .map((key) => url.searchParams.get(key) ?? "")
      .join(" ")
      .replace(/\+/g, " ")
      .toLowerCase();
  } catch {
    return input.toLowerCase();
  }
}

export function classifyUrl(input: string, options: { adultDomainFeed?: AdultDomainFeed } = {}): ClassificationResult {
  const host = normalizeHost(input);
  const searchText = extractSearchText(input);
  const adultDomains = options.adultDomainFeed?.domains ?? ADULT_DOMAIN_SEEDS;

  if (!host) {
    return {
      verdict: "review",
      confidence: 0.3,
      host: "",
      category: "unknown",
      reason: "No domain was detected.",
      matchedRule: "empty-input"
    };
  }

  const normalAllowlisted = DEFAULT_ALLOWED_NORMAL_DOMAINS.some((domain) => hostMatches(host, domain));
  const knownSearchEngine = isKnownSearchEngineHost(host);

  if (normalAllowlisted || knownSearchEngine) {
    const explicitSearch = explicitSearchTerms.find((term) => searchText.includes(term));
    if (explicitSearch) {
      const educationalIntent = recoveryEducationSearchTerms.some((term) => searchText.includes(term));
      const consumptionIntent = consumptionIntentSearchTerms.some((term) => searchText.includes(term));

      if (educationalIntent && !consumptionIntent) {
        return {
          verdict: "allow",
          confidence: 0.9,
          host,
          category: "known-safe",
          reason: "The query mentions adult terms in a recovery, health, or education context.",
          matchedRule: `safe-site-education:${explicitSearch}`
        };
      }

      return {
        verdict: "block",
        confidence: 0.92,
        host,
        category: "adult-search-intent",
        reason: "The site is allowed, but the search query shows adult intent.",
        matchedRule: `safe-site-search:${explicitSearch}`
      };
    }

    return {
      verdict: "allow",
      confidence: 0.98,
      host,
      category: "known-safe",
      reason: knownSearchEngine
        ? "This is a known search engine without adult-consumption intent."
        : "This is a normal browsing domain on the explicit allowlist.",
      matchedRule: knownSearchEngine ? "known-search-engine" : "normal-web-allowlist"
    };
  }

  const domainMatch = adultDomains.find((domain) => hostMatches(host, domain));
  if (domainMatch) {
    return {
      verdict: "block",
      confidence: 0.99,
      host,
      category: "adult",
      reason: "The domain is in the adult-content domain feed.",
      matchedRule: `adult-domain:${domainMatch}`
    };
  }

  const tokenMatch = explicitDomainTokens.find((token) => {
    const parts = host.split(".");
    return parts.some((part) => part === token || part.startsWith(`${token}-`) || part.endsWith(`-${token}`));
  });

  if (tokenMatch) {
    const recoveryContext = hasHostContext(host, recoveryDomainContextTerms);
    const consumptionContext = hasHostContext(host, consumptionDomainContextTerms);

    if (recoveryContext && !consumptionContext) {
      return {
        verdict: "allow",
        confidence: 0.82,
        host,
        category: "unknown",
        reason: "The hostname contains an adult-looking token in a recovery, health, or filtering context.",
        matchedRule: `explicit-domain-token-recovery-context:${tokenMatch}`
      };
    }

    return {
      verdict: "block",
      confidence: 0.84,
      host,
      category: "adult",
      reason: "The hostname contains a high-confidence adult-content token.",
      matchedRule: `explicit-domain-token:${tokenMatch}`
    };
  }

  return {
    verdict: "allow",
    confidence: 0.72,
    host,
    category: "unknown",
    reason: "No adult-content signal was found. FREED allows normal browsing by default.",
    matchedRule: "default-allow"
  };
}

export function createBlockingAttempt(url: string, source: BlockingAttempt["source"]): BlockingAttempt {
  const result = classifyUrl(url);
  return {
    url: redactUrlForStorage(url),
    host: result.host,
    detectedAt: new Date().toISOString(),
    result,
    source
  };
}

export function createPanicInterventionAttempt(detectedAt = new Date().toISOString()): BlockingAttempt {
  const host = "self-urge.freed.local";
  return {
    url: `https://${host}`,
    host,
    detectedAt,
    source: "panic-button",
    result: {
      verdict: "block",
      confidence: 1,
      host,
      category: "unknown",
      reason: "The user requested immediate urge support.",
      matchedRule: "self-reported-urge"
    }
  };
}
