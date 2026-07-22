import { randomUUID } from "node:crypto";

import { getApps, initializeApp } from "firebase-admin/app";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { onSchedule } from "firebase-functions/v2/scheduler";

import {
  APPROVED_ADULT_FEED_SOURCE,
  MAX_SOURCE_BYTES,
  assertEmptyRetrievalPayload,
  readLatestReviewedFeed,
  refreshReviewedFeed,
  type AdultFeedMetadata,
  type SourceFetchResponse
} from "./adult-feed.js";
import { COLLECTIONS, validateServerDocument } from "./contracts.js";

if (!getApps().length) initializeApp();

const db = getFirestore();
const bucket = getStorage().bucket();
const LEASE_ID = "adult_feed_refresh";
const LATEST_ID = "latest";

export const refreshReviewedAdultDomainFeed = onSchedule({
  region: "asia-south1",
  schedule: "every 24 hours",
  timeZone: "Asia/Kolkata"
}, async () => {
  await refreshReviewedFeed({
    now: Date.now,
    owner: randomUUID(),
    fetcher: fetchApprovedSource,
    acquireLease,
    releaseLease,
    findByChecksum,
    writeImmutableObject,
    publishMetadata
  });
});

export const getReviewedAdultDomainFeed = onCall({ region: "asia-south1", enforceAppCheck: true }, async (request) => {
  requireAuthenticatedUid(request.auth?.uid);
  try {
    assertEmptyRetrievalPayload(request.data);
  } catch {
    throw new HttpsError("invalid-argument", "The callable payload is not permitted.");
  }
  try {
    return await readLatestReviewedFeed({
      now: Date.now,
      getLatestMetadata,
      readObject: readValidatedObject
    });
  } catch {
    throw new HttpsError("unavailable", "A validated adult-domain feed is unavailable.");
  }
});

function requireAuthenticatedUid(uid: string | undefined): string {
  if (!uid) throw new HttpsError("unauthenticated", "A Firebase Auth session is required.");
  return uid;
}

async function fetchApprovedSource(
  url: string,
  init: { signal: AbortSignal; headers: Readonly<Record<string, string>> }
): Promise<SourceFetchResponse> {
  const response = await fetch(url, { signal: init.signal, headers: init.headers });
  return {
    ok: response.ok,
    status: response.status,
    headers: response.headers,
    body: response.body as unknown as AsyncIterable<Uint8Array> | null
  };
}

async function acquireLease(lease: { owner: string; acquiredAt: number; expiresAt: number }): Promise<"acquired" | "busy"> {
  const reference = db.collection(COLLECTIONS.leases).doc(LEASE_ID);
  return db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(reference);
    const existing = snapshot.exists ? snapshot.data() as { owner?: unknown; expiresAt?: unknown } : undefined;
    if (existing && typeof existing.owner === "string" && typeof existing.expiresAt === "number" && existing.expiresAt > lease.acquiredAt) {
      return "busy";
    }
    transaction.set(reference, validateServerDocument(COLLECTIONS.leases, lease));
    return "acquired";
  });
}

async function releaseLease(owner: string): Promise<void> {
  const reference = db.collection(COLLECTIONS.leases).doc(LEASE_ID);
  await db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(reference);
    if (snapshot.exists && snapshot.data()?.owner === owner) transaction.delete(reference);
  });
}

async function findByChecksum(checksum: string): Promise<AdultFeedMetadata | undefined> {
  const snapshot = await db.collection(COLLECTIONS.adultFeedMetadata).doc(versionDocumentId(checksum)).get();
  return snapshot.exists ? metadataFromDocument(snapshot.data()) : undefined;
}

async function getLatestMetadata(): Promise<AdultFeedMetadata | undefined> {
  const snapshot = await db.collection(COLLECTIONS.adultFeedMetadata).doc(LATEST_ID).get();
  return snapshot.exists ? metadataFromDocument(snapshot.data()) : undefined;
}

async function writeImmutableObject(key: string, body: string): Promise<void> {
  const file = bucket.file(key);
  try {
    await file.save(body, {
      resumable: false,
      validation: "crc32c",
      contentType: "application/json; charset=utf-8",
      metadata: { cacheControl: "private, max-age=0, no-store" },
      preconditionOpts: { ifGenerationMatch: 0 }
    });
  } catch (error) {
    if (!isPreconditionFailure(error)) throw error;
    const existing = await readBoundedObject(key);
    if (existing !== body) throw new Error("Immutable feed object conflicts with the validated version.");
  }
}

async function publishMetadata(metadata: AdultFeedMetadata): Promise<void> {
  const versionReference = db.collection(COLLECTIONS.adultFeedMetadata).doc(versionDocumentId(metadata.checksum));
  const latestReference = db.collection(COLLECTIONS.adultFeedMetadata).doc(LATEST_ID);
  const safe = validateServerDocument(COLLECTIONS.adultFeedMetadata, metadataDocument(metadata));
  await db.runTransaction(async (transaction) => {
    const existing = await transaction.get(versionReference);
    if (!existing.exists) transaction.create(versionReference, safe);
    else assertSameStoredVersion(metadataFromDocument(existing.data()), metadata);
    transaction.set(latestReference, safe);
  });
}

async function readValidatedObject(key: string): Promise<string> {
  return readBoundedObject(key);
}

async function readBoundedObject(key: string): Promise<string> {
  const file = bucket.file(key);
  const [metadata] = await file.getMetadata();
  const size = Number(metadata.size);
  if (!Number.isSafeInteger(size) || size < 1 || size > MAX_SOURCE_BYTES * 2) throw new Error("Validated object is invalid.");
  const [body] = await file.download();
  if (body.byteLength !== size || body.byteLength > MAX_SOURCE_BYTES * 2) throw new Error("Validated object is invalid.");
  return new TextDecoder("utf-8", { fatal: true }).decode(body);
}

function metadataDocument(metadata: AdultFeedMetadata) {
  return {
    version: metadata.version,
    checksum: metadata.checksum,
    source: APPROVED_ADULT_FEED_SOURCE.id,
    generatedAt: Timestamp.fromDate(new Date(metadata.generatedAt)),
    publishedAt: Timestamp.fromDate(new Date(metadata.publishedAt)),
    domainCount: metadata.domainCount,
    objectKey: metadata.objectKey
  };
}

function metadataFromDocument(value: unknown): AdultFeedMetadata {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Validated metadata is invalid.");
  const record = value as Record<string, unknown>;
  if (
    typeof record.version !== "string" || typeof record.checksum !== "string" ||
    record.source !== APPROVED_ADULT_FEED_SOURCE.id || typeof record.domainCount !== "number" ||
    typeof record.objectKey !== "string"
  ) {
    throw new Error("Validated metadata is invalid.");
  }
  return {
    version: record.version,
    checksum: record.checksum,
    source: APPROVED_ADULT_FEED_SOURCE,
    generatedAt: timestampIso(record.generatedAt),
    publishedAt: timestampIso(record.publishedAt),
    domainCount: record.domainCount,
    objectKey: record.objectKey
  };
}

function timestampIso(value: unknown): string {
  if (!(value instanceof Timestamp)) throw new Error("Validated metadata is invalid.");
  return value.toDate().toISOString();
}

function versionDocumentId(checksum: string): string {
  if (!/^[a-f0-9]{64}$/.test(checksum)) throw new Error("Validated metadata is invalid.");
  return `version_${checksum}`;
}

function assertSameStoredVersion(existing: AdultFeedMetadata, next: AdultFeedMetadata): void {
  if (
    existing.version !== next.version || existing.checksum !== next.checksum ||
    existing.domainCount !== next.domainCount || existing.objectKey !== next.objectKey ||
    existing.source.id !== next.source.id
  ) {
    throw new Error("Stored feed version conflicts with the validated version.");
  }
}

function isPreconditionFailure(error: unknown): boolean {
  const code = (error as { code?: number | string } | undefined)?.code;
  return code === 409 || code === "409" || code === 412 || code === "412";
}
