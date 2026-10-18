import { configureRemoteCoachProvider } from "@/lib/ai-coach";
import {configureClaraConversationTransport,type ClaraCloudPayload,type ClaraDispatchGuard} from './clara-conversation';
import { configureChallengeGenerationProvider } from "@/lib/challenge-generator";
import { configureRemoteRetentionProvider } from "@/lib/retention-orchestrator";
import { configureRemoteAdultDomainFeedProvider } from "@/lib/adult-domain-feed-sync";
import { createAdultDomainFeed } from "@/lib/blocking-engine";
import { ANALYTICS_SNAPSHOT_SCHEMA_VERSION, getPersistedAnalyticsPendingSnapshot, parseAnalyticsSnapshotRecovery, configureRemoteAnalyticsProvider } from "@/lib/recovery-analytics";
import { configureRecoveryBackupClientSyncTransport, type RecoveryBackupClientSyncConfig } from "@/lib/recovery-backup-client-sync";
import { getFirebaseClientReadiness, type createFirebaseCallableContracts } from "@/lib/firebase-client";
import { MAX_BACKUP_ENVELOPE_CHARS } from "@/lib/backup-crypto-format";

type Contracts = ReturnType<typeof createFirebaseCallableContracts>;
const CALLABLE_TIMEOUT_MS = 15_000;
let eventSequence = 0;

function eventId() {
  eventSequence += 1;
  return `evt_${Date.now().toString(36)}_${eventSequence.toString(36)}_${Math.random().toString(36).slice(2, 12)}`;
}

async function sha256FirebaseFeatureBytes(text: string): Promise<string> {
  if (globalThis.crypto?.subtle) {
    const bytes = new TextEncoder().encode(text);
    const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);
    return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, "0")).join("");
  }
  const crypto = await import("expo-crypto");
  return crypto.digestStringAsync(crypto.CryptoDigestAlgorithm.SHA256, text);
}

async function deadline<T>(operation: Promise<T>, timeoutMs = CALLABLE_TIMEOUT_MS): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([operation, new Promise<never>((_resolve, reject) => {
      timer = setTimeout(() => reject(new Error("Firebase feature request timed out.")), timeoutMs);
    })]);
  } finally { if (timer) clearTimeout(timer); }
}

export function configureFirebaseFeatureProviders(
  getContracts: (expectedOwnerUid?:string) => Promise<ReturnType<typeof createFirebaseCallableContracts> | null>
): () => void {
  const contracts = async (): Promise<Contracts> => {
    const result = await deadline(getContracts());
    if (!result) throw new Error("Firebase feature services are unavailable for this build.");
    return result;
  };
  // Native startup is not consent to send health signals or user messages.
  // Cloud AI stays unavailable until a separate consent and service-readiness flow exists.
  configureRemoteCoachProvider(null);
  configureClaraConversationTransport(createClaraConversationDispatcher(getContracts));
  configureChallengeGenerationProvider(null);
  configureRemoteRetentionProvider(null);
  configureRemoteAdultDomainFeedProvider(async () => {
    const feed = await deadline((await contracts()).getReviewedAdultDomainFeed());
    const checksum = await sha256FirebaseFeatureBytes(`${feed.domains.join("\n")}\n`);
    if (checksum !== feed.checksum) throw new Error("Reviewed adult-domain feed checksum integrity check failed.");
    const nativeFeed = createAdultDomainFeed({ version: feed.version, generatedAt: feed.generatedAt, domains: feed.domains,
      sources: [{ id: feed.source.id, label: feed.source.label, updatedAt: feed.publishedAt, domainCount: feed.domains.length }] });
    if (nativeFeed.domains.length !== feed.domains.length) throw new Error("Reviewed adult-domain feed exceeds supported device capacity.");
    return nativeFeed;
  });
  const firebase = getFirebaseClientReadiness();
  configureRemoteAnalyticsProvider({
    endpointUrl: `https://${firebase.functionsRegion ?? "asia-south1"}-${firebase.projectId ?? "freed-7d5ee"}.cloudfunctions.net/ingestAggregateAnalytics`,
    requiredRetentionDays: 14,
    send: async (_snapshot, state) => {
      const captured = getPersistedAnalyticsPendingSnapshot(state);
      const snapshotId = captured.snapshotId;
      const response = await deadline((await contracts()).ingestAggregateAnalytics(captured));
      const recovery = parseAnalyticsSnapshotRecovery(response, captured);
      if (recovery) return { accepted: false, status: "error", provider: "firebase", snapshotRecovery: recovery,
        reason: "The saved analytics request needs a current sharing window before retrying." };
      if (!isRecord(response) || response.ok !== true || response.schemaVersion !== ANALYTICS_SNAPSHOT_SCHEMA_VERSION ||
          response.snapshotId !== snapshotId || response.lineageId !== captured.lineageId ||
          response.acceptedRevision !== captured.baseRevision + 1 || typeof response.duplicate !== "boolean") {
        throw new Error("Firebase has not acknowledged support for this exact aggregate snapshot.");
      }
      return { accepted: true, status: "ok", provider: "firebase", snapshotReceipt: {
        schemaVersion: ANALYTICS_SNAPSHOT_SCHEMA_VERSION, lineageId: captured.lineageId, baseRevision: captured.baseRevision,
        acceptedRevision: captured.baseRevision + 1, snapshotId, days: captured.days
      }, ...(state.activityArchive.legacyCompletedChallenges > 0 ? {
        reason: "Dated 14-day counts accepted. Older undated completion totals remain on this device."
      } : {}) };
    }
  });
  configureRecoveryBackupClientSyncTransport(async (payload, config) => backupTransport(await contracts(), payload, config));
  return () => {
    configureClaraConversationTransport(null);
    configureRemoteCoachProvider(null);
    configureChallengeGenerationProvider(null);
    configureRemoteRetentionProvider(null);
    configureRemoteAdultDomainFeedProvider(null);
    configureRemoteAnalyticsProvider(null);
    configureRecoveryBackupClientSyncTransport(null);
  };
}

/** Acquire contracts for the original owner, then recheck cancellation/consent before dispatch. */
export function createClaraConversationDispatcher(getContracts:(expectedOwnerUid?:string)=>Promise<Contracts|null>) {
  return async(payload:ClaraCloudPayload,guard:ClaraDispatchGuard)=>{
    if(!guard.isCurrent())throw new Error('Cloud-chat operation changed.');
    const api=await deadline(getContracts(guard.ownerUid));
    if(!api||!guard.isCurrent())throw new Error('Cloud-chat operation changed.');
    return deadline(api.generateGoogleClaraReply(payload,guard.isCurrent));
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function signedBackupUrl(value: unknown): { url: string; response: Record<string, unknown> } {
  if (!isRecord(value) || value.ok !== true || typeof value.signedUrl !== "string" ||
      typeof value.expiresAt !== "string" || Date.parse(value.expiresAt) <= Date.now() || !Number.isFinite(Date.parse(value.expiresAt))) {
    throw new Error("Encrypted backup signed transfer is unavailable.");
  }
  const url = new URL(value.signedUrl);
  if (url.protocol !== "https:" || url.username || url.password ||
      !(url.hostname === "storage.googleapis.com" || url.hostname.endsWith(".storage.googleapis.com"))) {
    throw new Error("Encrypted backup transfer URL is invalid.");
  }
  return { url: value.signedUrl, response: value };
}

async function transfer(fetcher: typeof fetch, url: string, init: RequestInit): Promise<Response> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([fetcher(url, { ...init, signal: controller.signal }), new Promise<never>((_resolve, reject) => {
      timer = setTimeout(() => { controller.abort(); reject(new Error("Encrypted backup transfer timed out.")); }, CALLABLE_TIMEOUT_MS);
    })]);
  } finally { if (timer) clearTimeout(timer); }
}

async function readEncryptedEnvelopeText(response: Response): Promise<string> {
  const statedLength = response.headers.get("content-length");
  if (statedLength && (!/^\d+$/.test(statedLength) || Number(statedLength) > MAX_BACKUP_ENVELOPE_CHARS)) {
    throw new Error("Encrypted backup download exceeds the transfer limit.");
  }
  const reader = response.body?.getReader?.();
  if (!reader) {
    const text = await deadline(response.text());
    if (new TextEncoder().encode(text).byteLength > MAX_BACKUP_ENVELOPE_CHARS) throw new Error("Encrypted backup download exceeds the transfer limit.");
    return text;
  }
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    await deadline((async () => {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        total += value.byteLength;
        if (total > MAX_BACKUP_ENVELOPE_CHARS) throw new Error("Encrypted backup download exceeds the transfer limit.");
        chunks.push(value);
      }
    })());
  } catch (error) {
    void reader.cancel().catch(() => undefined);
    throw error;
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
}

async function downloadEnvelope(api: Contracts, config: RecoveryBackupClientSyncConfig) {
  const response = await deadline(config.backupId ? api.getBackupDownload({ backupId: config.backupId }) : api.getLatestBackupDownload());
  const signed = signedBackupUrl(response);
  const metadata = signed.response;
  if (metadata.status !== "verified") throw new Error("Encrypted backup is not verified.");
  const downloaded = await transfer(config.fetcher ?? fetch, signed.url, { method: "GET" });
  if (!downloaded.ok) throw new Error("Encrypted backup download failed.");
  const encoded = await readEncryptedEnvelopeText(downloaded);
  if (typeof metadata.ciphertextSha256 !== "string" || !/^[a-f0-9]{64}$/.test(metadata.ciphertextSha256) ||
      typeof metadata.encryptedBytes !== "number" || metadata.encryptedBytes !== new TextEncoder().encode(encoded).byteLength ||
      await sha256FirebaseFeatureBytes(encoded) !== metadata.ciphertextSha256) {
    throw new Error("Encrypted backup download integrity check failed.");
  }
  const envelope: unknown = JSON.parse(encoded);
  if (!isRecord(envelope)) throw new Error("Encrypted backup envelope is invalid.");
  return { envelope, backupId: metadata.backupId };
}

async function backupTransport(api: Contracts, payload: Record<string, unknown>, config: RecoveryBackupClientSyncConfig): Promise<unknown> {
  if (payload.action === "upload") {
    if (!isRecord(payload.envelope)) throw new Error("Encrypted backup envelope is invalid.");
    const body = JSON.stringify(payload.envelope);
    const encryptedBytes = new TextEncoder().encode(body).byteLength;
    if (encryptedBytes > MAX_BACKUP_ENVELOPE_CHARS) throw new Error("Encrypted backup exceeds the transfer limit.");
    const ciphertextSha256 = await sha256FirebaseFeatureBytes(body);
    const backupId = `bkp_${ciphertextSha256}`;
    const signed = signedBackupUrl(await deadline(api.startBackupUpload({ backupId, encryptedBytes, ciphertextSha256, clientEventId: eventId() })));
    const headers = signed.response.requiredHeaders;
    if (!isRecord(headers) || headers["content-type"] !== "application/octet-stream" ||
        headers["content-length"] !== String(encryptedBytes) || typeof headers["x-goog-if-generation-match"] !== "string" ||
        !/^\d{1,32}$/.test(headers["x-goog-if-generation-match"])) {
      throw new Error("Encrypted backup upload headers are invalid.");
    }
    const uploaded = await transfer(config.fetcher ?? fetch, signed.url, { method: "PUT", headers: {
      "content-type": "application/octet-stream", "content-length": String(encryptedBytes),
      "x-goog-if-generation-match": headers["x-goog-if-generation-match"]
    }, body });
    if (!uploaded.ok) throw new Error("Encrypted backup upload failed.");
    const finalized = await deadline(api.finalizeBackupUpload({ backupId, clientEventId: eventId() }));
    if (!isRecord(finalized) || finalized.ok !== true || finalized.status !== "verified" || finalized.verifiedBytes !== encryptedBytes) {
      throw new Error("Encrypted backup upload was not verified.");
    }
    return { ok: true, status: "ok", syncedAt: new Date().toISOString(), backupCreatedAt: payload.envelope.createdAt };
  }
  if (payload.action === "download") {
    const { envelope } = await downloadEnvelope(api, config);
    return { ok: true, status: "ok", envelope, syncedAt: new Date().toISOString(), backupCreatedAt: envelope.createdAt };
  }
  if (payload.action === "delete") {
    let backupId = config.backupId;
    if (!backupId) {
      const latest = await deadline(api.getLatestBackupDownload());
      if (!isRecord(latest) || latest.ok !== true || latest.status !== "verified" || typeof latest.backupId !== "string") {
        throw new Error("No verified encrypted backup is available to delete.");
      }
      backupId = latest.backupId;
    }
    const deleted = await deadline(api.deleteBackup({ backupId, clientEventId: eventId() }));
    if (!isRecord(deleted) || deleted.ok !== true || deleted.status !== "deleted") throw new Error("Encrypted backup deletion did not complete.");
    return { ok: true, status: "ok", syncedAt: new Date().toISOString() };
  }
  throw new Error("Unsupported encrypted backup action.");
}
