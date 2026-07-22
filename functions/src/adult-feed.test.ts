import assert from "node:assert/strict";
import test from "node:test";

import {
  APPROVED_ADULT_FEED_SOURCE,
  MAX_SOURCE_BYTES,
  SOURCE_TIMEOUT_MS,
  assertEmptyRetrievalPayload,
  createDomainPayload,
  fetchApprovedSourceText,
  parseApprovedSource,
  readLatestReviewedFeed,
  refreshReviewedFeed,
  type AdultFeedMetadata,
  type FeedObject,
  type FeedResponse
} from "./adult-feed.js";

const NOW = Date.parse("2026-07-22T06:30:00.000Z");

test("approved source identity is exact, immutable, and the fetch URL is not injectable", async () => {
  assert.deepEqual(APPROVED_ADULT_FEED_SOURCE, {
    id: "oisd-nsfw-small",
    label: "OISD NSFW Small",
    url: "https://nsfw-small.oisd.nl/"
  });
  assert.equal(Object.isFrozen(APPROVED_ADULT_FEED_SOURCE), true);

  let requestedUrl = "";
  const text = await fetchApprovedSourceText({
    fetcher: async (url) => {
      requestedUrl = url;
      return response(["example.xxx\n"]);
    }
  });
  assert.equal(requestedUrl, APPROVED_ADULT_FEED_SOURCE.url);
  assert.equal(text, "example.xxx\n");
});

test("retrieval callable accepts no client-selected source or object path", () => {
  assert.doesNotThrow(() => assertEmptyRetrievalPayload(undefined));
  assert.doesNotThrow(() => assertEmptyRetrievalPayload({}));
  assert.throws(() => assertEmptyRetrievalPayload({ url: "https://attacker.example/feed" }), /not permitted/i);
  assert.throws(() => assertEmptyRetrievalPayload({ objectKey: "adult-domain-feeds/chosen.json" }), /not permitted/i);
});

test("hosts, plain-domain, and adblock rules normalize, deduplicate, and sort deterministically", () => {
  assert.deepEqual(parseApprovedSource([
    "# reviewed source",
    "0.0.0.0 B.example.xxx",
    "127.0.0.1 a.example.xxx # inline comment",
    "||C.example.xxx^",
    "b.example.xxx",
    "! adblock comment",
    ""
  ].join("\n")), ["a.example.xxx", "b.example.xxx", "c.example.xxx"]);
});

test("malformed, public-suffix-only, empty, and protected normal-domain sources fail closed", () => {
  for (const invalid of [
    "127.0.0.1", "*.example.xxx", "example.xxx/path", "user@example.xxx", "example.xxx:443",
    "example.xxx?q=1", "example.xxx#part", "-bad.example", "bad_.example", "com", "co.uk", "github.io"
  ]) {
    assert.throws(() => parseApprovedSource(invalid), /invalid reviewed feed/i, invalid);
  }
  assert.throws(() => parseApprovedSource("# comments only\n! still empty"), /empty/i);

  for (const protectedRoot of [
    "google.com", "youtube.com", "instagram.com", "tiktok.com", "apple.com",
    "microsoft.com", "github.com", "cloudflare.com", "freedrecovery.app"
  ]) {
    assert.throws(() => parseApprovedSource(`sub.${protectedRoot}`), /protected normal domain/i, protectedRoot);
  }
});

test("source fetch rejects unsuccessful, oversized, truncated, malformed UTF-8, and timed-out responses", async () => {
  await assert.rejects(
    () => fetchApprovedSourceText({ fetcher: async () => response(["failure"], { ok: false, status: 503 }) }),
    /unavailable/i
  );
  await assert.rejects(
    () => fetchApprovedSourceText({ fetcher: async () => response(["x"], { contentLength: MAX_SOURCE_BYTES + 1 }) }),
    /invalid/i
  );
  await assert.rejects(
    () => fetchApprovedSourceText({ fetcher: async () => response(["short"], { contentLength: 100 }) }),
    /invalid/i
  );
  await assert.rejects(
    () => fetchApprovedSourceText({ fetcher: async () => response([new Uint8Array([0xc3, 0x28])]) }),
    /invalid/i
  );

  let scheduledFor = 0;
  let aborted = false;
  await assert.rejects(
    () => fetchApprovedSourceText({
      scheduleTimeout(callback, ms) {
        scheduledFor = ms;
        callback();
        return 1;
      },
      clearScheduledTimeout() {},
      fetcher: async (_url, init) => {
        aborted = init.signal.aborted;
        throw new Error("provider detail must not escape");
      }
    }),
    /unavailable/i
  );
  assert.equal(scheduledFor, SOURCE_TIMEOUT_MS);
  assert.equal(aborted, true);
});

test("domain payload checksum is deterministic", () => {
  const first = createDomainPayload(["b.example.xxx", "a.example.xxx"]);
  const second = createDomainPayload(["a.example.xxx", "b.example.xxx"]);
  assert.deepEqual(first, second);
  assert.match(first.checksum, /^[a-f0-9]{64}$/);
  assert.equal(first.payload, "a.example.xxx\nb.example.xxx\n");
});

test("refresh writes an immutable object before metadata and is idempotent by checksum under a lease", async () => {
  const events: string[] = [];
  let latest: AdultFeedMetadata | undefined;
  const result = await refreshReviewedFeed({
    now: () => NOW,
    owner: "scheduler-run-123",
    fetcher: async () => response(["b.example.xxx\na.example.xxx\n"]),
    acquireLease: async (lease) => { events.push(`lease:${lease.owner}`); return "acquired"; },
    releaseLease: async () => { events.push("release"); },
    findByChecksum: async () => latest,
    writeImmutableObject: async (_key, body) => {
      events.push("storage");
      assert.deepEqual(JSON.parse(body) as FeedObject, {
        schemaVersion: 1,
        version: resultVersion(["a.example.xxx", "b.example.xxx"]),
        checksum: createDomainPayload(["a.example.xxx", "b.example.xxx"]).checksum,
        source: APPROVED_ADULT_FEED_SOURCE,
        domains: ["a.example.xxx", "b.example.xxx"]
      });
    },
    publishMetadata: async (metadata) => { events.push("metadata"); latest = metadata; }
  });
  assert.equal(result.status, "published");
  assert.deepEqual(events, ["lease:scheduler-run-123", "storage", "metadata", "release"]);
  assert.equal(latest?.domainCount, 2);

  events.length = 0;
  const duplicate = await refreshReviewedFeed({
    now: () => NOW + 1_000,
    owner: "scheduler-run-456",
    fetcher: async () => response(["a.example.xxx\nb.example.xxx\n"]),
    acquireLease: async () => "acquired",
    releaseLease: async () => { events.push("release"); },
    findByChecksum: async () => latest,
    writeImmutableObject: async () => { events.push("storage"); },
    publishMetadata: async (metadata) => {
      events.push("metadata");
      assert.equal(metadata.generatedAt, new Date(NOW + 1_000).toISOString());
      assert.equal(metadata.objectKey, latest?.objectKey);
    }
  });
  assert.equal(duplicate.status, "unchanged");
  assert.deepEqual(events, ["metadata", "release"]);
});

test("busy lease skips refresh and Storage failure never publishes Firestore metadata", async () => {
  let fetched = false;
  const busy = await refreshReviewedFeed({
    now: () => NOW,
    owner: "scheduler-run-busy",
    fetcher: async () => { fetched = true; return response(["example.xxx"]); },
    acquireLease: async () => "busy",
    releaseLease: async () => {},
    findByChecksum: async () => undefined,
    writeImmutableObject: async () => {},
    publishMetadata: async () => {}
  });
  assert.equal(busy.status, "busy");
  assert.equal(fetched, false);

  let metadataPublished = false;
  await assert.rejects(() => refreshReviewedFeed({
    now: () => NOW,
    owner: "scheduler-run-fail",
    fetcher: async () => response(["example.xxx"]),
    acquireLease: async () => "acquired",
    releaseLease: async () => {},
    findByChecksum: async () => undefined,
    writeImmutableObject: async () => { throw new Error("bucket name and object provider error"); },
    publishMetadata: async () => { metadataPublished = true; }
  }), /refresh failed/i);
  assert.equal(metadataPublished, false);
});

test("latest callable payload validates freshness, future skew, checksum, count, and missing version", async () => {
  const fixture = feedFixture(NOW);
  const ok = await readLatestReviewedFeed({
    now: () => NOW + 60_000,
    getLatestMetadata: async () => fixture.metadata,
    readObject: async () => JSON.stringify(fixture.object)
  });
  assert.deepEqual(ok, fixture.response);
  assert.equal("objectKey" in ok, false);

  await assertReadFailure(undefined, fixture.object, NOW, /unavailable/i);
  await assertReadFailure({ ...fixture.metadata, generatedAt: new Date(NOW - 48 * 60 * 60 * 1000 - 1).toISOString() }, fixture.object, NOW, /unavailable/i);
  await assertReadFailure({ ...fixture.metadata, generatedAt: new Date(NOW + 5 * 60 * 1000 + 1).toISOString() }, fixture.object, NOW, /unavailable/i);
  await assertReadFailure({ ...fixture.metadata, checksum: "f".repeat(64) }, fixture.object, NOW, /unavailable/i);
  await assertReadFailure({ ...fixture.metadata, domainCount: 3 }, fixture.object, NOW, /unavailable/i);
  const unrelatedVersion = "oisd-nsfw-small-fedcba9876543210";
  await assertReadFailure(
    { ...fixture.metadata, version: unrelatedVersion, objectKey: `adult-domain-feeds/${unrelatedVersion}.json` },
    { ...fixture.object, version: unrelatedVersion },
    NOW,
    /unavailable/i
  );
  await assertReadFailure(
    { ...fixture.metadata, publishedAt: new Date(NOW - 1).toISOString() },
    fixture.object,
    NOW,
    /unavailable/i
  );
});

function response(
  chunks: Array<string | Uint8Array>,
  options: { ok?: boolean; status?: number; contentLength?: number } = {}
) {
  const encoded = chunks.map((chunk) => typeof chunk === "string" ? new TextEncoder().encode(chunk) : chunk);
  return {
    ok: options.ok ?? true,
    status: options.status ?? 200,
    headers: { get: (name: string) => name.toLowerCase() === "content-length" && options.contentLength !== undefined ? String(options.contentLength) : null },
    body: (async function* () { for (const chunk of encoded) yield chunk; })()
  };
}

function resultVersion(domains: string[]) {
  return `oisd-nsfw-small-${createDomainPayload(domains).checksum.slice(0, 16)}`;
}

function feedFixture(generatedAtMs: number): { metadata: AdultFeedMetadata; object: FeedObject; response: FeedResponse } {
  const domains = ["a.example.xxx", "b.example.xxx"];
  const checksum = createDomainPayload(domains).checksum;
  const generatedAt = new Date(generatedAtMs).toISOString();
  const publishedAt = new Date(generatedAtMs + 30_000).toISOString();
  const version = resultVersion(domains);
  return {
    metadata: { version, generatedAt, publishedAt, checksum, domainCount: 2, source: APPROVED_ADULT_FEED_SOURCE, objectKey: `adult-domain-feeds/${version}.json` },
    object: { schemaVersion: 1, version, checksum, source: APPROVED_ADULT_FEED_SOURCE, domains },
    response: { version, generatedAt, publishedAt, checksum, source: APPROVED_ADULT_FEED_SOURCE, domains }
  };
}

async function assertReadFailure(
  metadata: AdultFeedMetadata | undefined,
  object: FeedObject,
  now: number,
  pattern: RegExp
) {
  await assert.rejects(() => readLatestReviewedFeed({
    now: () => now,
    getLatestMetadata: async () => metadata,
    readObject: async () => JSON.stringify(object)
  }), pattern);
}
