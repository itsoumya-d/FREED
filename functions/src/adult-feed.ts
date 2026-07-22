import { createHash } from "node:crypto";
import { isIP } from "node:net";
import { getDomain } from "tldts";

export const SOURCE_TIMEOUT_MS = 8_000;
export const MAX_SOURCE_BYTES = 2_000_000;
export const MAX_FEED_AGE_MS = 48 * 60 * 60 * 1_000;
export const MAX_FUTURE_SKEW_MS = 5 * 60 * 1_000;
export const FEED_LEASE_MS = 2 * 60 * 1_000;

export type ApprovedAdultFeedSource = Readonly<{ id: string; label: string; url: string }>;

export const APPROVED_ADULT_FEED_SOURCE: ApprovedAdultFeedSource = Object.freeze({
  id: "oisd-nsfw-small",
  label: "OISD NSFW Small",
  url: "https://nsfw-small.oisd.nl/"
});

const PROTECTED_NORMAL_DOMAINS = Object.freeze([
  "google.com",
  "youtube.com",
  "youtu.be",
  "instagram.com",
  "tiktok.com",
  "apple.com",
  "microsoft.com",
  "github.com",
  "cloudflare.com",
  "freedrecovery.app"
]);

const HOST_LABEL = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?|xn--[a-z0-9-]{1,59})$/;
const VERSION = /^oisd-nsfw-small-[a-f0-9]{16}$/;
const CHECKSUM = /^[a-f0-9]{64}$/;

export type SourceFetchResponse = {
  ok: boolean;
  status: number;
  headers: { get(name: string): string | null };
  body: AsyncIterable<Uint8Array> | null;
};

export type SourceFetcher = (
  url: string,
  init: { signal: AbortSignal; redirect: "error"; headers: Readonly<Record<string, string>> }
) => Promise<SourceFetchResponse>;

export type FeedObject = {
  schemaVersion: 1;
  version: string;
  checksum: string;
  source: ApprovedAdultFeedSource;
  domains: string[];
};

export type AdultFeedMetadata = {
  version: string;
  generatedAt: string;
  publishedAt: string;
  checksum: string;
  domainCount: number;
  source: ApprovedAdultFeedSource;
  objectKey: string;
};

export type FeedLeaseClaim = {
  owner: string;
  token: number;
  expiresAt: number;
};

export type FeedResponse = Omit<AdultFeedMetadata, "domainCount" | "objectKey"> & { domains: string[] };

type TimerHandle = ReturnType<typeof setTimeout> | number;

export function assertEmptyRetrievalPayload(value: unknown): void {
  if (value === undefined || value === null) return;
  if (typeof value === "object" && !Array.isArray(value) && Object.keys(value).length === 0) return;
  throw new Error("Callable payload is not permitted.");
}

export function assertFeedPublicationFence(
  active: FeedLeaseClaim | undefined,
  claim: FeedLeaseClaim,
  now: number
): void {
  if (
    !active || active.owner !== claim.owner || active.token !== claim.token ||
    active.expiresAt !== claim.expiresAt || active.expiresAt <= now
  ) {
    throw new Error("The adult-feed publication lease is no longer valid.");
  }
}

export async function fetchApprovedSourceText(deps: {
  fetcher: SourceFetcher;
  scheduleTimeout?: (callback: () => void, milliseconds: number) => TimerHandle;
  clearScheduledTimeout?: (handle: TimerHandle) => void;
}): Promise<string> {
  const controller = new AbortController();
  const schedule = deps.scheduleTimeout ?? ((callback, milliseconds) => setTimeout(callback, milliseconds));
  const clear = deps.clearScheduledTimeout ?? ((handle) => clearTimeout(handle as ReturnType<typeof setTimeout>));
  const timeout = schedule(() => controller.abort(), SOURCE_TIMEOUT_MS);
  try {
    const result = await deps.fetcher(APPROVED_ADULT_FEED_SOURCE.url, {
      signal: controller.signal,
      redirect: "error",
      headers: Object.freeze({ accept: "text/plain", "accept-encoding": "identity" })
    });
    if (!result.ok || result.status < 200 || result.status >= 300 || !result.body) {
      throw new Error("Approved source unavailable.");
    }
    const contentEncoding = result.headers.get("content-encoding")?.trim().toLowerCase();
    if (contentEncoding && contentEncoding !== "identity") throw new Error("Approved source response is invalid.");
    const declaredLength = parseContentLength(result.headers.get("content-length"));
    if (declaredLength !== undefined && declaredLength > MAX_SOURCE_BYTES) {
      throw new Error("Approved source response is invalid.");
    }

    let byteLength = 0;
    const chunks: Uint8Array[] = [];
    for await (const rawChunk of result.body) {
      if (!(rawChunk instanceof Uint8Array) || rawChunk.byteLength === 0) continue;
      byteLength += rawChunk.byteLength;
      if (byteLength > MAX_SOURCE_BYTES) throw new Error("Approved source response is invalid.");
      chunks.push(rawChunk);
    }
    if (declaredLength !== undefined && declaredLength !== byteLength) {
      throw new Error("Approved source response is invalid.");
    }
    if (byteLength === 0) throw new Error("Approved source response is invalid.");

    const body = new Uint8Array(byteLength);
    let offset = 0;
    for (const chunk of chunks) {
      body.set(chunk, offset);
      offset += chunk.byteLength;
    }
    let text: string;
    try {
      text = new TextDecoder("utf-8", { fatal: true }).decode(body);
    } catch {
      throw new Error("Approved source response is invalid.");
    }
    if (!text.trim() || text.includes("\0")) throw new Error("Approved source response is invalid.");
    return text;
  } catch (error) {
    if (error instanceof Error && /^Approved source response is invalid\.$/.test(error.message)) throw error;
    throw new Error("Approved source unavailable.");
  } finally {
    clear(timeout);
  }
}

export function parseApprovedSource(text: string): string[] {
  if (typeof text !== "string" || !text.trim()) throw new Error("Reviewed feed is empty.");
  const domains = new Set<string>();
  let headerSeen = false;
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#") || line.startsWith("!")) continue;
    if (line === "[Adblock Plus]") {
      if (headerSeen || domains.size > 0) throw new Error("Invalid reviewed feed rule.");
      headerSeen = true;
      continue;
    }
    const candidate = extractCandidate(line);
    const domain = canonicalDomain(candidate);
    if (isProtectedNormalDomain(domain)) throw new Error("Reviewed feed contains a protected normal domain.");
    domains.add(domain);
  }
  if (domains.size === 0) throw new Error("Reviewed feed is empty.");
  return [...domains].sort();
}

export function createDomainPayload(domains: string[]): { domains: string[]; payload: string; checksum: string } {
  const normalized = [...new Set(domains.map(canonicalDomain))].sort();
  if (normalized.length === 0) throw new Error("Reviewed feed is empty.");
  for (const domain of normalized) {
    if (isProtectedNormalDomain(domain)) throw new Error("Reviewed feed contains a protected normal domain.");
  }
  const payload = `${normalized.join("\n")}\n`;
  return { domains: normalized, payload, checksum: createHash("sha256").update(payload, "utf8").digest("hex") };
}

export async function refreshReviewedFeed(deps: {
  now: () => number;
  owner: string;
  fetcher: SourceFetcher;
  acquireLease: (lease: { owner: string; acquiredAt: number; expiresAt: number }) => Promise<FeedLeaseClaim | "busy">;
  releaseLease: (claim: FeedLeaseClaim) => Promise<void>;
  findByChecksum: (checksum: string) => Promise<AdultFeedMetadata | undefined>;
  writeImmutableObject: (key: string, body: string) => Promise<void>;
  publishMetadata: (metadata: AdultFeedMetadata, claim: FeedLeaseClaim) => Promise<void>;
}): Promise<{ status: "published" | "unchanged" | "busy"; metadata?: AdultFeedMetadata }> {
  const startedAt = deps.now();
  const claim = await deps.acquireLease({ owner: deps.owner, acquiredAt: startedAt, expiresAt: startedAt + FEED_LEASE_MS });
  if (claim === "busy") return { status: "busy" };
  try {
    const text = await fetchApprovedSourceText({ fetcher: deps.fetcher });
    const { domains, checksum } = createDomainPayload(parseApprovedSource(text));
    const existing = await deps.findByChecksum(checksum);
    const generatedAt = new Date(startedAt).toISOString();
    if (existing) {
      assertStoredIdentity(existing, checksum, domains.length);
      const renewed = { ...existing, generatedAt, publishedAt: generatedAt };
      await deps.publishMetadata(renewed, claim);
      return { status: "unchanged", metadata: renewed };
    }

    const version = versionForChecksum(checksum);
    const objectKey = objectKeyForVersion(version);
    const object: FeedObject = {
      schemaVersion: 1,
      version,
      checksum,
      source: APPROVED_ADULT_FEED_SOURCE,
      domains
    };
    const metadata: AdultFeedMetadata = {
      version,
      generatedAt,
      publishedAt: generatedAt,
      checksum,
      domainCount: domains.length,
      source: APPROVED_ADULT_FEED_SOURCE,
      objectKey
    };
    await deps.writeImmutableObject(objectKey, JSON.stringify(object));
    await deps.publishMetadata(metadata, claim);
    return { status: "published", metadata };
  } catch {
    throw new Error("Reviewed adult feed refresh failed.");
  } finally {
    await deps.releaseLease(claim);
  }
}

export async function readLatestReviewedFeed(deps: {
  now: () => number;
  getLatestMetadata: () => Promise<AdultFeedMetadata | undefined>;
  readObject: (key: string) => Promise<string>;
}): Promise<FeedResponse> {
  try {
    const metadata = deps.getLatestMetadata ? await deps.getLatestMetadata() : undefined;
    assertMetadata(metadata, deps.now());
    const raw = await deps.readObject(metadata.objectKey);
    const object = parseFeedObject(raw);
    if (
      object.version !== metadata.version ||
      object.checksum !== metadata.checksum ||
      object.domains.length !== metadata.domainCount ||
      !sameSource(object.source, metadata.source)
    ) {
      throw new Error("Invalid validated feed.");
    }
    const calculated = createDomainPayload(object.domains);
    if (calculated.checksum !== metadata.checksum || !sameOrderedDomains(calculated.domains, object.domains)) {
      throw new Error("Invalid validated feed.");
    }
    return {
      version: metadata.version,
      generatedAt: metadata.generatedAt,
      publishedAt: metadata.publishedAt,
      checksum: metadata.checksum,
      source: APPROVED_ADULT_FEED_SOURCE,
      domains: [...object.domains]
    };
  } catch {
    throw new Error("Validated adult feed is unavailable.");
  }
}

function extractCandidate(line: string): string {
  const hosts = line.match(/^(?:0\.0\.0\.0|127\.0\.0\.1)\s+([^\s#]+)(?:\s+#.*)?$/);
  if (hosts) return hosts[1] ?? "";
  const adblock = line.match(/^\|\|([^|^\s]+)\^$/);
  if (adblock) return adblock[1] ?? "";
  if (/\s/.test(line)) throw new Error("Invalid reviewed feed rule.");
  return line;
}

function canonicalDomain(value: string): string {
  const domain = value.toLowerCase();
  if (
    domain !== value.toLocaleLowerCase("en-US") || domain.length > 253 || domain.endsWith(".") ||
    !domain.includes(".") || isIP(domain) !== 0 || /[\\/@:*?#%\[\]]/.test(domain)
  ) {
    throw new Error("Invalid reviewed feed rule.");
  }
  const labels = domain.split(".");
  if (labels.some((label) => !HOST_LABEL.test(label)) || getDomain(domain, { allowPrivateDomains: true }) === null) {
    throw new Error("Invalid reviewed feed rule.");
  }
  const tld = labels.at(-1) ?? "";
  if (!/^(?:[a-z]{2,63}|xn--[a-z0-9-]{2,59})$/.test(tld)) throw new Error("Invalid reviewed feed rule.");
  return domain;
}

function isProtectedNormalDomain(domain: string): boolean {
  return PROTECTED_NORMAL_DOMAINS.some((root) => domain === root || domain.endsWith(`.${root}`));
}

function parseContentLength(value: string | null): number | undefined {
  if (value === null) return undefined;
  if (!/^\d+$/.test(value)) throw new Error("Approved source response is invalid.");
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 0) throw new Error("Approved source response is invalid.");
  return parsed;
}

function versionForChecksum(checksum: string): string {
  return `oisd-nsfw-small-${checksum.slice(0, 16)}`;
}

function objectKeyForVersion(version: string): string {
  if (!VERSION.test(version)) throw new Error("Invalid validated feed.");
  return `adult-domain-feeds/${version}.json`;
}

function assertMetadata(metadata: AdultFeedMetadata | undefined, now: number): asserts metadata is AdultFeedMetadata {
  if (
    !metadata || !VERSION.test(metadata.version) || !CHECKSUM.test(metadata.checksum) ||
    metadata.version !== versionForChecksum(metadata.checksum)
  ) throw new Error("Invalid validated feed.");
  if (!Number.isInteger(metadata.domainCount) || metadata.domainCount < 1) throw new Error("Invalid validated feed.");
  if (metadata.objectKey !== objectKeyForVersion(metadata.version) || !sameSource(metadata.source, APPROVED_ADULT_FEED_SOURCE)) {
    throw new Error("Invalid validated feed.");
  }
  const generatedAt = Date.parse(metadata.generatedAt);
  const publishedAt = Date.parse(metadata.publishedAt);
  if (!Number.isFinite(generatedAt) || !Number.isFinite(publishedAt)) throw new Error("Invalid validated feed.");
  if (
    generatedAt < now - MAX_FEED_AGE_MS || generatedAt > now + MAX_FUTURE_SKEW_MS ||
    publishedAt < generatedAt || publishedAt > now + MAX_FUTURE_SKEW_MS
  ) {
    throw new Error("Invalid validated feed.");
  }
}

function parseFeedObject(raw: string): FeedObject {
  if (Buffer.byteLength(raw, "utf8") > MAX_SOURCE_BYTES * 2) throw new Error("Invalid validated feed.");
  const value = JSON.parse(raw) as Partial<FeedObject>;
  if (
    !value || value.schemaVersion !== 1 || typeof value.version !== "string" ||
    typeof value.checksum !== "string" || !Array.isArray(value.domains) || value.domains.some((domain) => typeof domain !== "string") ||
    !value.source || !sameSource(value.source, APPROVED_ADULT_FEED_SOURCE)
  ) {
    throw new Error("Invalid validated feed.");
  }
  return value as FeedObject;
}

function assertStoredIdentity(metadata: AdultFeedMetadata, checksum: string, domainCount: number): void {
  if (
    metadata.checksum !== checksum || metadata.version !== versionForChecksum(checksum) ||
    metadata.objectKey !== objectKeyForVersion(metadata.version) || metadata.domainCount !== domainCount ||
    !sameSource(metadata.source, APPROVED_ADULT_FEED_SOURCE)
  ) {
    throw new Error("Invalid validated feed.");
  }
}

function sameSource(left: ApprovedAdultFeedSource, right: ApprovedAdultFeedSource): boolean {
  return left.id === right.id && left.label === right.label && left.url === right.url;
}

function sameOrderedDomains(left: string[], right: string[]): boolean {
  return left.length === right.length && left.every((domain, index) => domain === right[index]);
}
