import { createHash } from "node:crypto";
import { COLLECTIONS } from "./contracts.js";
import { isFcmRegistrationToken } from "./notifications.js";

/** Admin-only paths. No raw DNS credential or browsing payload belongs in these documents. */
export const DNS_COLLECTIONS = {
  installations: "recoveryDnsInstallations", owners: "recoveryDnsOwners",
  pilot: "recoveryDnsPilot", requests: "recoveryDnsRequests"
} as const;
const CONFIG = `${DNS_COLLECTIONS.pilot}/config`;
const DAY = 86_400_000;
const MAX_INSTALLATIONS = 5;
const MONTHLY_REQUEST_LIMIT = 100_000;
const HASH = /^[a-f0-9]{64}$/;
const AUDIENCE = /^[a-f0-9]{32}$/;
const FID = /^[cdef][A-Za-z0-9_-]{21}$/;
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
const UID = /^[A-Za-z0-9_-]{1,128}$/;

type Document = Record<string, unknown>;
export interface RecoveryDnsStore {
  get<T extends object>(path: string): Promise<T | undefined>;
  queryUid(collection: string, uid: string, limit: number): Promise<Array<{ path: string; value: Document }>>;
  set(path: string, value: object): void;
  delete(path: string): void;
}
export class RecoveryDnsError extends Error {
  constructor(readonly reason: "invalid-request" | "pilot-unavailable" | "account-deleting" | "pilot-full" | "recovery-required" | "deletion-unconfirmed") {
    super(`Recovery DNS ${reason}.`);
  }
}
export type RecoveryDnsEnrollment = {
  credentialHash: string; installationId: string; audience: string; clientEventId: string;
  consentVersion: "2026-10-18"; dnsConsent: true; websiteAlertConsent: boolean; retentionAcknowledged: true;
};
export type RecoveryDnsReceipt = {
  status: "enrolled"; installationId: string; ownerGeneration: string; audience: string;
  endpointHost: "freedrecovery.web.app"; credentialHash: string;
};
export type ResolvedRecoveryDnsInstallation = {
  installationId: string; active: true; dnsConsent: true; websiteAlertConsent: boolean;
  ownerGeneration: string; currentOwnerGeneration: string; audience: string;
  pushTarget?: { installationId: string; token: string };
};
export type DnsRequestReservation = { installationHash: string; installationId: string; ownerGeneration: string; requestId: string };
export type DnsRequestReservationResult = { status: "granted" | "exhausted" | "unavailable" };
type Installation = RecoveryDnsEnrollment & {
  version: 1; uid: string | null; ownerGeneration: string; state: "active" | "revoked";
  createdAt: number; updatedAt: number; expiresAt: number;
};
type Owner = {
  version: 1; uid: string | null; installationId: string; credentialHash: string; ownerGeneration: string;
  state: "active" | "revoked"; createdAt: number; updatedAt: number; expiresAt: number;
};
type Pilot = Document & { enabled: true; allowedUids: string[]; activeCredentialHashes?: string[] };
const installationPath = (hash: string) => `${DNS_COLLECTIONS.installations}/${hash}`;
const ownerPath = (id: string) => `${DNS_COLLECTIONS.owners}/${id}`;
const tombstonePath = (uid: string) => `${COLLECTIONS.deletionTombstones}/${uid}`;
const pushPath = (uid: string, id: string) => `${COLLECTIONS.pushTokens}/${uid}_${id}`;

export async function enrollRecoveryDnsControl(store: RecoveryDnsStore, uid: string, value: unknown, now: number, generation: string): Promise<RecoveryDnsReceipt> {
  const input = parseEnrollment(value);
  if (!UID.test(uid) || !UUID.test(generation) || !validTime(now)) throw new RecoveryDnsError("invalid-request");
  const [configValue, tombstone, existingValue, registryValue] = await Promise.all([
    store.get<Document>(CONFIG), store.get<Document>(tombstonePath(uid)),
    store.get<Document>(installationPath(input.credentialHash)), store.get<Document>(ownerPath(input.installationId))
  ]);
  if (tombstone) throw new RecoveryDnsError("account-deleting");
  const config = requirePilot(configValue, uid);
  if (existingValue || registryValue) {
    const existing = parseInstallation(existingValue);
    const registry = parseOwner(registryValue);
    if (!existing || !registry || !pairMatches(existing, registry) || existing.uid !== uid || !isLive(existing, now) ||
      !slots(config).includes(input.credentialHash) || Object.entries(input).some(([key, item]) => existing[key as keyof Installation] !== item)) {
      throw new RecoveryDnsError("recovery-required");
    }
    return receipt(existing);
  }
  // Keep all account-linked records within the atomic deletion helper's bound, including revoked records.
  const [ownedInstallations, ownedRegistries] = await Promise.all([
    store.queryUid(DNS_COLLECTIONS.installations, uid, MAX_INSTALLATIONS + 1),
    store.queryUid(DNS_COLLECTIONS.owners, uid, MAX_INSTALLATIONS + 1)
  ]);
  if (ownedInstallations.length >= MAX_INSTALLATIONS || ownedRegistries.length >= MAX_INSTALLATIONS) throw new RecoveryDnsError("pilot-full");
  if (ownedInstallations.length !== ownedRegistries.length) throw new RecoveryDnsError("recovery-required");
  // The configuration document serializes allocation. Only expired/revoked slots can be reclaimed.
  const hashes = slots(config);
  const previous = await Promise.all(hashes.map(hash => store.get<Document>(installationPath(hash))));
  const active: string[] = [];
  for (let index = 0; index < hashes.length; index += 1) {
    const document = previous[index];
    if (!document) continue; // Firestore TTL may have removed an expired record.
    const installation = parseInstallation(document);
    if (!installation || installation.credentialHash !== hashes[index]) throw new RecoveryDnsError("pilot-unavailable");
    if (isLive(installation, now)) active.push(hashes[index]);
  }
  if (active.length >= MAX_INSTALLATIONS) throw new RecoveryDnsError("pilot-full");
  const installation: Installation = { ...input, version: 1, uid, ownerGeneration: generation,
    state: "active", createdAt: now, updatedAt: now, expiresAt: now + 30 * DAY };
  const owner: Owner = { version: 1, uid, installationId: input.installationId, credentialHash: input.credentialHash,
    ownerGeneration: generation, state: "active", createdAt: now, updatedAt: now, expiresAt: installation.expiresAt };
  store.set(installationPath(input.credentialHash), installation);
  store.set(ownerPath(input.installationId), owner);
  store.set(CONFIG, { ...config, activeCredentialHashes: [...active, input.credentialHash] });
  return receipt(installation);
}

export async function revokeRecoveryDnsControl(store: RecoveryDnsStore, uid: string, value: unknown, now: number): Promise<{ status: "revoked"; installationId: string; ownerGeneration: string }> {
  const input = parseAuthority(value);
  if (!UID.test(uid) || !validTime(now)) throw new RecoveryDnsError("invalid-request");
  const [configValue, tombstone, installationValue, ownerValue] = await Promise.all([
    store.get<Document>(CONFIG), store.get<Document>(tombstonePath(uid)),
    store.get<Document>(installationPath(input.credentialHash)), store.get<Document>(ownerPath(input.installationId))
  ]);
  if (tombstone) throw new RecoveryDnsError("account-deleting");
  const config = requirePilot(configValue, uid);
  const installation = parseInstallation(installationValue), owner = parseOwner(ownerValue);
  if (!installation || !owner || !pairMatches(installation, owner) || installation.uid !== uid ||
    installation.installationId !== input.installationId || installation.ownerGeneration !== input.ownerGeneration || installation.credentialHash !== input.credentialHash) {
    throw new RecoveryDnsError("recovery-required");
  }
  if (installation.state !== "revoked") {
    store.set(installationPath(input.credentialHash), { ...installation, state: "revoked", websiteAlertConsent: false, updatedAt: now });
    store.set(ownerPath(input.installationId), { ...owner, state: "revoked", updatedAt: now });
    store.set(CONFIG, { ...config, activeCredentialHashes: slots(config).filter(hash => hash !== input.credentialHash) });
  }
  return { status: "revoked", installationId: input.installationId, ownerGeneration: input.ownerGeneration };
}

/** Only called behind the durable account-deletion fence, before account/private-data cleanup. */
export async function detachRecoveryDnsAccountControl(store: RecoveryDnsStore, uid: string, now: number): Promise<{ status: "detached"; installations: number }> {
  if (!UID.test(uid) || !validTime(now)) throw new RecoveryDnsError("deletion-unconfirmed");
  const [tombstone, installationRows, ownerRows, config] = await Promise.all([
    store.get<Document>(tombstonePath(uid)), store.queryUid(DNS_COLLECTIONS.installations, uid, MAX_INSTALLATIONS + 1),
    store.queryUid(DNS_COLLECTIONS.owners, uid, MAX_INSTALLATIONS + 1), store.get<Document>(CONFIG)
  ]);
  // Deletion must also remove the raw account identifier from the enrollment allowlist.
  // Missing configuration has no allowlist to scrub; never recreate it during account cleanup.
  const allowedUids = config?.allowedUids === undefined ? [] : config.allowedUids;
  if (!Array.isArray(allowedUids) || allowedUids.length > 100 || allowedUids.some(allowedUid => !matches(UID, allowedUid))) {
    throw new RecoveryDnsError("deletion-unconfirmed");
  }
  const isAllowlisted = allowedUids.includes(uid);
  // A completed request may be retried after cooldown publication. Only an already-empty detach is accepted then.
  if (tombstone?.uid === uid && tombstone.status === "cooldown" && installationRows.length === 0 && ownerRows.length === 0 && !isAllowlisted) {
    return { status: "detached", installations: 0 };
  }
  if (tombstone?.uid !== uid || tombstone.status !== "deleting" || installationRows.length > MAX_INSTALLATIONS || ownerRows.length > MAX_INSTALLATIONS || installationRows.length !== ownerRows.length) {
    throw new RecoveryDnsError("deletion-unconfirmed");
  }
  const pairs: Array<{ installation: Installation; owner: Owner }> = [];
  for (const row of installationRows) {
    const installation = parseInstallation(row.value);
    const ownerRow = ownerRows.find(candidate => candidate.path === ownerPath(installation?.installationId ?? ""));
    const owner = parseOwner(ownerRow?.value);
    if (!installation || !owner || installation.uid !== uid || owner.uid !== uid ||
      row.path !== installationPath(installation.credentialHash) || !pairMatches(installation, owner)) throw new RecoveryDnsError("deletion-unconfirmed");
    pairs.push({ installation, owner });
  }
  // Every record has been checked before the first write: no partial/unconfirmed detach.
  if (config && isAllowlisted) store.set(CONFIG, { ...config, allowedUids: allowedUids.filter(allowedUid => allowedUid !== uid) });
  for (const { installation, owner } of pairs) {
    store.set(installationPath(installation.credentialHash), { ...installation, uid: null, websiteAlertConsent: false, updatedAt: now });
    store.set(ownerPath(owner.installationId), { ...owner, uid: null, updatedAt: now });
    store.delete(pushPath(uid, installation.installationId));
  }
  return { status: "detached", installations: pairs.length };
}

/** A read transaction must supply fresh, independent installation and owner documents. */
export async function resolveRecoveryDnsCredential(store: RecoveryDnsStore, hash: string, now: number): Promise<ResolvedRecoveryDnsInstallation | undefined> {
  if (!HASH.test(hash) || !validTime(now)) return undefined;
  const [configValue, installationValue] = await Promise.all([
    store.get<Document>(CONFIG), store.get<Document>(installationPath(hash))
  ]);
  const config = parsePilot(configValue);
  const installation = parseInstallation(installationValue);
  // Every handoff/push lookup rechecks the operator controls; an earlier reservation is not authority.
  if (!config || !slots(config).includes(hash) || !installation || installation.credentialHash !== hash || !isLive(installation, now)) return undefined;
  const owner = parseOwner(await store.get<Document>(ownerPath(installation.installationId)));
  if (!owner || !pairMatches(installation, owner)) return undefined;
  const tombstone = installation.uid ? await store.get<Document>(tombstonePath(installation.uid)) : undefined;
  const alertConsent = installation.websiteAlertConsent && installation.uid !== null && !tombstone;
  const result: ResolvedRecoveryDnsInstallation = { installationId: installation.installationId, active: true, dnsConsent: true,
    websiteAlertConsent: alertConsent, ownerGeneration: installation.ownerGeneration, currentOwnerGeneration: owner.ownerGeneration, audience: installation.audience };
  if (alertConsent && installation.uid) {
    const push = await store.get<Document>(pushPath(installation.uid, installation.installationId));
    if (push?.uid === installation.uid && push.installationId === installation.installationId &&
      validTime(push.expiresAt) && push.expiresAt > now && isFcmRegistrationToken(push.token)) {
      result.pushTarget = { installationId: installation.installationId, token: push.token };
    }
  }
  return result;
}

/** Server-only hook. This reserves an upstream request, without a question/domain/wire payload. */
export async function reserveRecoveryDnsRequest(store: RecoveryDnsStore, value: unknown, now: number): Promise<DnsRequestReservationResult> {
  const input = parseReservation(value);
  if (!input || !validTime(now)) return { status: "unavailable" };
  const month = new Date(now).toISOString().slice(0, 7);
  const requestHash = createHash("sha256").update(JSON.stringify([input.installationHash, input.ownerGeneration, input.requestId])).digest("hex");
  const requestPath = `${DNS_COLLECTIONS.requests}/${requestHash}`;
  const budgetPath = `${DNS_COLLECTIONS.pilot}/budget-${month}`;
  const [configValue, installationValue, ownerValue, previous, budget] = await Promise.all([
    store.get<Document>(CONFIG), store.get<Document>(installationPath(input.installationHash)),
    store.get<Document>(ownerPath(input.installationId)), store.get<Document>(requestPath), store.get<Document>(budgetPath)
  ]);
  const config = parsePilot(configValue);
  const installation = parseInstallation(installationValue), owner = parseOwner(ownerValue);
  if (!config || !slots(config).includes(input.installationHash) || !installation || !owner || !pairMatches(installation, owner) ||
    !isLive(installation, now) || installation.credentialHash !== input.installationHash ||
    installation.installationId !== input.installationId || installation.ownerGeneration !== input.ownerGeneration) return { status: "unavailable" };
  if (previous) {
    return { status: previous.installationHash === input.installationHash && previous.installationId === input.installationId &&
      previous.ownerGeneration === input.ownerGeneration && validTime(previous.expiresAt) && previous.expiresAt > now ? "granted" : "unavailable" };
  }
  if (budget && (budget.month !== month || !Number.isSafeInteger(budget.count) || (budget.count as number) < 0 || (budget.count as number) > MONTHLY_REQUEST_LIMIT)) return { status: "unavailable" };
  const count = budget ? budget.count as number : 0;
  if (count >= MONTHLY_REQUEST_LIMIT) return { status: "exhausted" };
  store.set(budgetPath, { month, count: count + 1, updatedAt: now, expiresAt: Date.UTC(new Date(now).getUTCFullYear(), new Date(now).getUTCMonth() + 1, 1) + 62 * DAY });
  store.set(requestPath, { installationHash: input.installationHash, installationId: input.installationId,
    ownerGeneration: input.ownerGeneration, budgetMonth: month, createdAt: now, expiresAt: now + 62 * DAY });
  return { status: "granted" };
}

function parseEnrollment(value: unknown): RecoveryDnsEnrollment {
  const data = strictRecord(value, ["credentialHash", "installationId", "audience", "clientEventId", "consentVersion", "dnsConsent", "websiteAlertConsent", "retentionAcknowledged"]);
  if (!matches(HASH, data.credentialHash) || !matches(FID, data.installationId) || !matches(AUDIENCE, data.audience) || !matches(UUID, data.clientEventId) ||
    data.consentVersion !== "2026-10-18" || data.dnsConsent !== true || typeof data.websiteAlertConsent !== "boolean" || data.retentionAcknowledged !== true) throw new RecoveryDnsError("invalid-request");
  return data as RecoveryDnsEnrollment;
}
function parseAuthority(value: unknown): { installationId: string; credentialHash: string; ownerGeneration: string } {
  const data = strictRecord(value, ["installationId", "credentialHash", "ownerGeneration"]);
  if (!matches(FID, data.installationId) || !matches(HASH, data.credentialHash) || !matches(UUID, data.ownerGeneration)) throw new RecoveryDnsError("invalid-request");
  return data as { installationId: string; credentialHash: string; ownerGeneration: string };
}
function parseReservation(value: unknown): DnsRequestReservation | undefined {
  try {
    const data = strictRecord(value, ["installationHash", "installationId", "ownerGeneration", "requestId"]);
    if (matches(HASH, data.installationHash) && matches(FID, data.installationId) && matches(UUID, data.ownerGeneration) && matches(UUID, data.requestId)) return data as DnsRequestReservation;
  } catch { /* Unknown or private fields are rejected without reproducing them. */ }
  return undefined;
}
function strictRecord(value: unknown, keys: string[]): Document {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new RecoveryDnsError("invalid-request");
  const data = value as Document;
  if (Object.keys(data).length !== keys.length || Object.keys(data).some(key => !keys.includes(key))) throw new RecoveryDnsError("invalid-request");
  return data;
}
function parsePilot(value: Document | undefined): Pilot | undefined {
  if (!value || value.enabled !== true || !Array.isArray(value.allowedUids) || value.allowedUids.length > 100 || value.allowedUids.some(uid => !matches(UID, uid))) return undefined;
  const hashes = value.activeCredentialHashes;
  if (hashes !== undefined && (!Array.isArray(hashes) || hashes.length > MAX_INSTALLATIONS || hashes.some(hash => !matches(HASH, hash)) || new Set(hashes).size !== hashes.length)) return undefined;
  return value as Pilot;
}
function requirePilot(value: Document | undefined, uid: string): Pilot {
  const pilot = parsePilot(value);
  if (!pilot || !pilot.allowedUids.includes(uid)) throw new RecoveryDnsError("pilot-unavailable");
  return pilot;
}
function slots(config: Pilot): string[] { return config.activeCredentialHashes ?? []; }
function parseInstallation(value: Document | undefined): Installation | undefined {
  if (!value || !baseRecord(value) || !matches(AUDIENCE, value.audience) || !matches(UUID, value.clientEventId) ||
    value.consentVersion !== "2026-10-18" || value.dnsConsent !== true || typeof value.websiteAlertConsent !== "boolean" || value.retentionAcknowledged !== true) return undefined;
  return value as Installation;
}
function parseOwner(value: Document | undefined): Owner | undefined { return value && baseRecord(value) ? value as Owner : undefined; }
function baseRecord(value: Document): boolean {
  return value.version === 1 && (value.uid === null || matches(UID, value.uid)) && matches(FID, value.installationId) && matches(HASH, value.credentialHash) && matches(UUID, value.ownerGeneration) &&
    (value.state === "active" || value.state === "revoked") && validTime(value.createdAt) && validTime(value.updatedAt) && validTime(value.expiresAt) && value.expiresAt === value.createdAt + 30 * DAY;
}
function pairMatches(installation: Installation, owner: Owner): boolean {
  return owner.installationId === installation.installationId && owner.credentialHash === installation.credentialHash && owner.ownerGeneration === installation.ownerGeneration &&
    owner.uid === installation.uid && owner.state === installation.state && owner.expiresAt === installation.expiresAt;
}
function isLive(installation: Installation, now: number): boolean { return installation.state === "active" && installation.dnsConsent && installation.expiresAt > now; }
function validTime(value: unknown): value is number { return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 && value <= 8_640_000_000_000_000; }
function matches(pattern: RegExp, value: unknown): value is string { return typeof value === "string" && pattern.test(value); }
function receipt(installation: Installation): RecoveryDnsReceipt {
  return { status: "enrolled", installationId: installation.installationId, ownerGeneration: installation.ownerGeneration,
    audience: installation.audience, endpointHost: "freedrecovery.web.app", credentialHash: installation.credentialHash };
}
