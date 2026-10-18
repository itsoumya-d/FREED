import assert from "node:assert/strict";
import test from "node:test";
import {
  enrollRecoveryDnsControl, revokeRecoveryDnsControl,
  detachRecoveryDnsAccountControl, resolveRecoveryDnsCredential, reserveRecoveryDnsRequest,
  type RecoveryDnsStore
} from "./recovery-dns-control.js";

const NOW = Date.UTC(2026, 9, 18);
const UID = "pilotOwner";
const HASH = "a".repeat(64);
const INSTALL = "c123456789012345678901";
const GENERATION = "11111111-1111-4111-8111-111111111111";
const EVENT = "22222222-2222-4222-8222-222222222222";
const input = (extra: Record<string, unknown> = {}) => ({ credentialHash: HASH, installationId: INSTALL,
  audience: "b".repeat(32), clientEventId: EVENT, consentVersion: "2026-10-18", dnsConsent: true,
  websiteAlertConsent: true, retentionAcknowledged: true, ...extra });
const reason = (wanted: string) => (error: unknown) => (error as { reason?: string }).reason === wanted;

/** Stages writes and serializes transactions; an exception never partially commits. */
function fixture() {
  const docs = new Map<string, Record<string, any>>();
  docs.set("recoveryDnsPilot/config", { enabled: true, allowedUids: [UID] });
  let queue: Promise<unknown> = Promise.resolve();
  async function run<T>(body: (store: RecoveryDnsStore) => Promise<T>): Promise<T> {
    const next = queue.then(async () => {
      const staged = new Map<string, object | null>();
      const store: RecoveryDnsStore = {
        async get<T extends object>(path: string) { assert.equal(staged.size, 0, "Firestore reads precede writes"); return structuredClone(docs.get(path)) as T | undefined; },
        async queryUid(collection, uid, limit) {
          assert.equal(staged.size, 0, "Firestore queries precede writes");
          return [...docs].filter(([path, value]) => path.startsWith(`${collection}/`) && value.uid === uid)
            .slice(0, limit).map(([path, value]) => ({ path, value: structuredClone(value) }));
        },
        set(path, value) { staged.set(path, structuredClone(value)); },
        delete(path) { staged.set(path, null); }
      };
      const value = await body(store);
      for (const [path, doc] of staged) { if (doc === null) docs.delete(path); else docs.set(path, doc); }
      return value;
    });
    queue = next.catch(() => undefined);
    return next;
  }
  return { docs, run,
    enroll: (value: unknown = input(), uid = UID, generation = GENERATION, now = NOW) => run(store => enrollRecoveryDnsControl(store, uid, value, now, generation)),
    revoke: (value: unknown = { installationId: INSTALL, credentialHash: HASH, ownerGeneration: GENERATION }, uid = UID) => run(store => revokeRecoveryDnsControl(store, uid, value, NOW + 100)),
    detach: (uid = UID) => run(store => detachRecoveryDnsAccountControl(store, uid, NOW + 200)),
    resolve: (hash = HASH, now = NOW + 300) => run(store => resolveRecoveryDnsCredential(store, hash, now)),
    reserve: (requestId = "33333333-3333-4333-8333-333333333333", now = NOW + 300) => run(store => reserveRecoveryDnsRequest(store, { installationHash: HASH, installationId: INSTALL, ownerGeneration: GENERATION, requestId }, now))
  };
}

test("enrollment records only consented opaque identity and exact retries keep original generation and expiry", async () => {
  const f = fixture();
  const first = await f.enroll();
  assert.deepEqual(first, { status: "enrolled", installationId: INSTALL, credentialHash: HASH,
    ownerGeneration: GENERATION, audience: "b".repeat(32), endpointHost: "freedrecovery.web.app" });
  const stored = structuredClone(f.docs.get(`recoveryDnsInstallations/${HASH}`));
  assert.equal(stored?.expiresAt, NOW + 30 * 24 * 60 * 60 * 1000);
  assert.equal(stored?.uid, UID);
  assert.equal("rawSecret" in stored!, false);
  assert.deepEqual(await f.enroll(input(), UID, "44444444-4444-4444-8444-444444444444", NOW + 1000), first);
  assert.deepEqual(f.docs.get(`recoveryDnsInstallations/${HASH}`), stored);
  assert.deepEqual(f.docs.get("recoveryDnsPilot/config")?.activeCredentialHashes, [HASH]);
});

test("invalid consent, unknown fields, credential formats and event values fail before any enrollment write", async () => {
  const f = fixture();
  for (const data of [null, [], {}, input({ rawSecret: "sensitive" }), input({ dnsConsent: false }),
    input({ retentionAcknowledged: false }), input({ consentVersion: "old" }), input({ websiteAlertConsent: "true" }),
    input({ credentialHash: "A".repeat(64) }), input({ audience: "B".repeat(32) }), input({ clientEventId: "not-a-uuid" }),
    input({ installationId: "../../private" }), input({ installationId: "a".repeat(129) })]) {
    await assert.rejects(() => f.enroll(data), reason("invalid-request"));
  }
  assert.equal(f.docs.size, 1);
});

test("missing or disabled allowlist and deletion fences deny both first enrollment and exact retries", async () => {
  const f = fixture();
  for (const config of [undefined, {}, { enabled: true }, { enabled: false, allowedUids: [UID] }, { enabled: true, allowedUids: ["other"] }]) {
    if (config) f.docs.set("recoveryDnsPilot/config", config); else f.docs.delete("recoveryDnsPilot/config");
    await assert.rejects(() => f.enroll(), reason("pilot-unavailable"));
  }
  f.docs.set("recoveryDnsPilot/config", { enabled: true, allowedUids: [UID] });
  await f.enroll();
  for (const status of ["deleting", "cooldown"]) {
    f.docs.set(`deletion_tombstones/${UID}`, { uid: UID, status });
    await assert.rejects(() => f.enroll(), reason("account-deleting"));
    await assert.rejects(() => f.revoke(), reason("account-deleting"));
  }
});

test("colliding accounts, credentials, audiences or events never transfer the existing owner", async () => {
  const f = fixture();
  f.docs.set("recoveryDnsPilot/config", { enabled: true, allowedUids: [UID, "other"] });
  await f.enroll();
  const before = structuredClone([...f.docs]);
  for (const [data, uid] of [[input(), "other"], [input({ credentialHash: "c".repeat(64) }), UID],
    [input({ installationId: "d123456789012345678901" }), UID], [input({ audience: "d".repeat(32) }), UID],
    [input({ clientEventId: "55555555-5555-4555-8555-555555555555" }), UID], [input({ websiteAlertConsent: false }), UID]] as const) {
    await assert.rejects(() => f.enroll(data, uid), reason("recovery-required"));
  }
  assert.deepEqual([...f.docs], before);
});

test("six simultaneous enrollment requests cannot allocate more than five active pilot slots", async () => {
  const f = fixture();
  const results = await Promise.allSettled(Array.from({ length: 6 }, (_, n) => f.enroll(input({
    credentialHash: String(n + 1).repeat(64), installationId: `c12345678901234567890${n + 1}`,
    clientEventId: `${n + 1}2222222-2222-4222-8222-222222222222`
  }))));
  assert.equal(results.filter(result => result.status === "fulfilled").length, 5);
  const failure = results.find(result => result.status === "rejected") as PromiseRejectedResult;
  assert.equal(failure.reason.reason, "pilot-full");
  assert.equal(f.docs.get("recoveryDnsPilot/config")?.activeCredentialHashes.length, 5);
});

test("revoke matches both registries and is idempotent while expired credentials cannot reenroll silently", async () => {
  const f = fixture();
  await f.enroll();
  await assert.rejects(() => f.revoke({ installationId: INSTALL, credentialHash: HASH, ownerGeneration: "55555555-5555-4555-8555-555555555555" }), reason("recovery-required"));
  assert.deepEqual(await f.reserve(), { status: "granted" });
  assert.deepEqual(await f.revoke(), { status: "revoked", installationId: INSTALL, ownerGeneration: GENERATION });
  assert.deepEqual(await f.revoke(), { status: "revoked", installationId: INSTALL, ownerGeneration: GENERATION });
  assert.equal(await f.resolve(), undefined);
  assert.deepEqual(await f.reserve(), { status: "unavailable" });
  await assert.rejects(() => f.enroll(), reason("recovery-required"));
});

test("independent owner generation, active state, consent and expiry are required for credential resolution", async () => {
  const f = fixture();
  await f.enroll();
  assert.deepEqual(await f.resolve(), { installationId: INSTALL, active: true, dnsConsent: true,
    websiteAlertConsent: true, ownerGeneration: GENERATION, currentOwnerGeneration: GENERATION, audience: "b".repeat(32) });
  const owner = f.docs.get(`recoveryDnsOwners/${INSTALL}`)!;
  const originalOwner = structuredClone(owner);
  owner.ownerGeneration = "different";
  assert.equal(await f.resolve(), undefined);
  assert.deepEqual(await f.reserve(), { status: "unavailable" });
  f.docs.set(`recoveryDnsOwners/${INSTALL}`, originalOwner);
  const installation = f.docs.get(`recoveryDnsInstallations/${HASH}`)!;
  installation.dnsConsent = false;
  assert.equal(await f.resolve(), undefined);
  installation.dnsConsent = true;
  assert.equal(await f.resolve(HASH, installation.expiresAt), undefined);
});

test("push targets require existing matching UID/installation, token expiry and separate alert consent", async () => {
  const f = fixture();
  await f.enroll();
  const token = "eYxZ4l07n8X9AbCdEfGhIjKlMnOpQrStUvWxYz0123456789:APA91bHi0123456789abcdefghijklmnopqrstuvwx";
  const path = `push_tokens/${UID}_${INSTALL}`;
  f.docs.set(path, { uid: UID, installationId: INSTALL, token, expiresAt: NOW + 60_000 });
  assert.deepEqual((await f.resolve())?.pushTarget, { installationId: INSTALL, token });
  f.docs.get(path)!.uid = "other";
  assert.equal((await f.resolve())?.pushTarget, undefined);
  f.docs.get(path)!.uid = UID;
  f.docs.get(path)!.expiresAt = NOW;
  assert.equal((await f.resolve())?.pushTarget, undefined);
  f.docs.get(path)!.expiresAt = NOW + 60_000;
  f.docs.set(`deletion_tombstones/${UID}`, { status: "deleting" });
  assert.equal((await f.resolve())?.websiteAlertConsent, false);
  assert.equal((await f.resolve())?.pushTarget, undefined);
});

test("deletion atomically detaches account and push routing while retaining consented live filtering identity", async () => {
  const f = fixture();
  await f.enroll();
  f.docs.set(`push_tokens/${UID}_${INSTALL}`, { uid: UID, installationId: INSTALL, token: "private" });
  await assert.rejects(() => f.detach(), reason("deletion-unconfirmed"));
  f.docs.set(`deletion_tombstones/${UID}`, { uid: UID, status: "deleting" });
  assert.deepEqual(await f.detach(), { status: "detached", installations: 1 });
  assert.equal(f.docs.get(`recoveryDnsInstallations/${HASH}`)?.uid, null);
  assert.equal(f.docs.get(`recoveryDnsOwners/${INSTALL}`)?.uid, null);
  assert.equal(f.docs.get(`recoveryDnsInstallations/${HASH}`)?.websiteAlertConsent, false);
  assert.equal(f.docs.has(`push_tokens/${UID}_${INSTALL}`), false);
  assert.equal((await f.resolve())?.active, true);
  assert.equal((await f.resolve())?.websiteAlertConsent, false);
  assert.deepEqual(await f.reserve(), { status: "granted" });
  assert.deepEqual(await f.detach(), { status: "detached", installations: 0 });
  await assert.rejects(() => f.enroll(), reason("account-deleting"));
});

test("deletion refuses a mismatched registry without partially detaching any owner", async () => {
  const f = fixture();
  await f.enroll();
  f.docs.set(`deletion_tombstones/${UID}`, { uid: UID, status: "deleting" });
  f.docs.get(`recoveryDnsOwners/${INSTALL}`)!.credentialHash = "d".repeat(64);
  const before = structuredClone([...f.docs]);
  await assert.rejects(() => f.detach(), reason("deletion-unconfirmed"));
  assert.deepEqual([...f.docs], before);
});

test("atomic global monthly cap admits one final request and exact retry spends once across month boundaries", async () => {
  const f = fixture();
  await f.enroll();
  f.docs.set("recoveryDnsPilot/budget-2026-10", { month: "2026-10", count: 99_999 });
  const results = await Promise.all([f.reserve(), f.reserve("44444444-4444-4444-8444-444444444444")]);
  assert.deepEqual(results, [{ status: "granted" }, { status: "exhausted" }]);
  assert.equal(f.docs.get("recoveryDnsPilot/budget-2026-10")?.count, 100_000);
  assert.deepEqual(await f.reserve(), { status: "granted" });
  assert.deepEqual(await f.reserve(undefined, Date.UTC(2026, 10, 1)), { status: "granted" });
  assert.equal(f.docs.has("recoveryDnsPilot/budget-2026-11"), false);
  f.docs.delete("recoveryDnsPilot/config");
  assert.deepEqual(await f.reserve(), { status: "unavailable" });
});

test("corrupt budget or unbounded pilot state fails closed without DNS request metadata beyond opaque IDs", async () => {
  const f = fixture();
  await f.enroll();
  for (const count of [-1, Number.NaN, "10", 100_001]) {
    f.docs.set("recoveryDnsPilot/budget-2026-10", { month: "2026-10", count });
    assert.deepEqual(await f.reserve(), { status: "unavailable" });
  }
  f.docs.delete("recoveryDnsPilot/budget-2026-10");
  assert.deepEqual(await f.reserve(), { status: "granted" });
  const request = [...f.docs].find(([path]) => path.startsWith("recoveryDnsRequests/"))!;
  assert.ok(request);
  assert.equal(JSON.stringify(request).includes("domain"), false);
  f.docs.get("recoveryDnsPilot/config")!.activeCredentialHashes = Array(6).fill(HASH);
  await assert.rejects(() => f.enroll(), reason("pilot-unavailable"));
});

test("revoked slots cannot grow account-linked retention beyond the five-record deletion bound", async () => {
  const f = fixture();
  for (let n = 1; n <= 5; n += 1) {
    const credentialHash = String(n).repeat(64), installationId = `c12345678901234567890${n}`;
    await f.enroll(input({ credentialHash, installationId, clientEventId: `${n}2222222-2222-4222-8222-222222222222` }));
    await f.revoke({ credentialHash, installationId, ownerGeneration: GENERATION });
  }
  await assert.rejects(() => f.enroll(input({ installationId: "c123456789012345678906" })), reason("pilot-full"));
  f.docs.set(`deletion_tombstones/${UID}`, { uid: UID, status: "deleting" });
  assert.deepEqual(await f.detach(), { status: "detached", installations: 5 });
});

test("expired enrollment exact retry requires recovery and never extends the old expiry", async () => {
  const f = fixture();
  await f.enroll();
  const first = structuredClone(f.docs.get(`recoveryDnsInstallations/${HASH}`));
  await assert.rejects(() => f.enroll(input(), UID, GENERATION, NOW + 30 * 24 * 60 * 60 * 1000), reason("recovery-required"));
  assert.deepEqual(f.docs.get(`recoveryDnsInstallations/${HASH}`), first);
});

// Firebase transport is exercised with a transaction boundary double: no network, ADC or emulator claim.
import { getApps, initializeApp } from "firebase-admin/app";
import { Timestamp, type Firestore } from "firebase-admin/firestore";
import { createRequire } from "node:module";
if (!getApps().length) initializeApp({ projectId: "freed-dns-controller-unit" });
const firebaseModule = createRequire(__filename)("./recovery-dns-firebase.js") as typeof import("./recovery-dns-firebase.js");

function firebaseFixture() {
  const docs = new Map<string, Record<string, any>>([["recoveryDnsPilot/config", { enabled: true, allowedUids: [UID] }]]);
  const queries: Array<{ collection: string; uid: string; limit: number }> = [];
  let fail = false;
  const database = {
    doc(path: string) { return { path }; },
    collection(collection: string) { return { where(field: string, operator: string, uid: string) {
      assert.equal(field, "uid"); assert.equal(operator, "==");
      return { limit(limit: number) { return { collection, uid, limit }; } };
    } }; },
    async runTransaction(body: (transaction: any) => Promise<unknown>) {
      const staged = new Map<string, Record<string, any> | null>();
      const result = await body({
        async get(ref: { path?: string; collection?: string; uid?: string; limit?: number }) {
          assert.equal(staged.size, 0, "Admin transaction reads precede writes");
          if (fail) throw new Error("private Firestore backend detail");
          if (ref.path) { const value = docs.get(ref.path); return { exists: value !== undefined, data: () => value ? { ...value } : undefined }; }
          queries.push(ref as { collection: string; uid: string; limit: number });
          return { docs: [...docs].filter(([path, value]) => path.startsWith(`${ref.collection}/`) && value.uid === ref.uid)
            .slice(0, ref.limit).map(([path, value]) => ({ ref: { path }, data: () => ({ ...value }) })) };
        },
        set(ref: { path: string }, value: Record<string, any>) { staged.set(ref.path, value); },
        delete(ref: { path: string }) { staged.set(ref.path, null); }
      });
      for (const [path, value] of staged) { if (value === null) docs.delete(path); else docs.set(path, value); }
      return result;
    }
  } as unknown as Firestore;
  return { docs, queries, adapter: firebaseModule.createRecoveryDnsFirestoreAdapter(database),
    fail() { fail = true; } };
}

test("real Firebase callables reject absent or anonymous auth before any Firestore access", async () => {
  const callables = [firebaseModule.enrollRecoveryDns, firebaseModule.revokeRecoveryDns];
  for (const callable of callables) {
    await assert.rejects(() => callable.run({ data: input() } as any), error => (error as any).code === "unauthenticated");
    for (const provider of ["anonymous", "custom", undefined]) {
      await assert.rejects(() => callable.run({ data: input(), auth: { uid: UID, token: { firebase: { sign_in_provider: provider } } } } as any), error => (error as any).code === "failed-precondition");
    }

  }
});

test("Firestore adapter persists Timestamp identity and resolves independent owner with bounded UID queries", async t => {
  t.mock.method(Date, "now", () => NOW);
  const f = firebaseFixture();
  const first = await f.adapter.enroll(UID, input());
  const stored = f.docs.get(`recoveryDnsInstallations/${HASH}`)!;
  assert.ok(stored.expiresAt instanceof Timestamp);
  assert.equal(stored.expiresAt.toMillis(), NOW + 30 * 24 * 60 * 60 * 1000);
  assert.deepEqual(await f.adapter.enroll(UID, input()), first);
  assert.equal(f.queries.length, 2);
  assert.ok(f.queries.every(query => query.uid === UID && query.limit === 6));
  assert.equal((await f.adapter.resolveInstallation(HASH, {}))?.currentOwnerGeneration, first.ownerGeneration);
  f.docs.get(`recoveryDnsOwners/${INSTALL}`)!.ownerGeneration = "different";
  assert.equal(await f.adapter.resolveInstallation(HASH, {}), undefined);
});

test("Firestore adapter returns closed status on database failure or abort without exposing backend detail", async t => {
  t.mock.method(Date, "now", () => NOW);
  const f = firebaseFixture();
  const first = await f.adapter.enroll(UID, input());
  const reservation = { installationHash: HASH, installationId: INSTALL, ownerGeneration: first.ownerGeneration, requestId: EVENT };
  const aborted = new AbortController(); aborted.abort();
  assert.deepEqual(await f.adapter.reserveDnsRequest(reservation, { signal: aborted.signal }), { status: "unavailable" });
  assert.equal([...f.docs.keys()].some(path => path.startsWith("recoveryDnsRequests/")), false);
  f.fail();
  assert.deepEqual(await f.adapter.reserveDnsRequest(reservation, {}), { status: "unavailable" });
  await assert.rejects(() => f.adapter.resolveInstallation(HASH, {}), error => (error as Error).message === "Recovery DNS pilot-unavailable.");
});

test("Firestore detach adapter deletes account push link and leaves filtering active through repeated deletion", async t => {
  t.mock.method(Date, "now", () => NOW);
  const f = firebaseFixture();
  await f.adapter.enroll(UID, input());
  f.docs.set(`deletion_tombstones/${UID}`, { uid: UID, status: "deleting" });
  f.docs.set(`push_tokens/${UID}_${INSTALL}`, { uid: UID, installationId: INSTALL, token: "private" });
  assert.deepEqual(await f.adapter.detachAccount(UID), { status: "detached", installations: 1 });
  assert.deepEqual(await f.adapter.detachAccount(UID), { status: "detached", installations: 0 });
  assert.equal(f.docs.get(`recoveryDnsOwners/${INSTALL}`)?.uid, null);
  assert.equal(f.docs.has(`push_tokens/${UID}_${INSTALL}`), false);
  assert.equal((await f.adapter.resolveInstallation(HASH, {}))?.websiteAlertConsent, false);
});

test("expired global slots are reclaimed from actual records without renewing expired device identity", async () => {
  const f = fixture();
  await f.enroll();
  const expiry = NOW + 30 * 24 * 60 * 60 * 1000;
  const nextHash = "c".repeat(64);
  await f.enroll(input({ installationId: "d123456789012345678901", credentialHash: nextHash,
    clientEventId: "66666666-6666-4666-8666-666666666666" }), UID, GENERATION, expiry);
  assert.deepEqual(f.docs.get("recoveryDnsPilot/config")?.activeCredentialHashes, [nextHash]);
  assert.equal(f.docs.get(`recoveryDnsInstallations/${HASH}`)?.expiresAt, expiry);
  assert.equal(await f.resolve(HASH, expiry), undefined);
});

test("request reservation rejects private payload fields and another installation without spending budget", async () => {
  const f = fixture();
  await f.enroll();
  for (const extra of [{ domain: "private.example" }, { installationId: "d123456789012345678901" }, { requestId: "../../sensitive" }]) {
    assert.deepEqual(await f.run(store => reserveRecoveryDnsRequest(store, { installationHash: HASH,
      installationId: INSTALL, ownerGeneration: GENERATION, requestId: EVENT, ...extra }, NOW)), { status: "unavailable" });
  }
  assert.equal(f.docs.has("recoveryDnsPilot/budget-2026-10"), false);
  await assert.rejects(() => f.revoke({ installationId: INSTALL, credentialHash: HASH, ownerGeneration: GENERATION }, "other"), reason("pilot-unavailable"));
});

test("an overbound legacy account cannot receive a partial deletion confirmation", async () => {
  const f = fixture();
  await f.enroll();
  const original = f.docs.get(`recoveryDnsInstallations/${HASH}`)!;
  for (let n = 1; n <= 5; n += 1) {
    const installationId = `d12345678901234567890${n}`, credentialHash = String(n).repeat(64);
    f.docs.set(`recoveryDnsInstallations/${credentialHash}`, { ...original, installationId, credentialHash });
    f.docs.set(`recoveryDnsOwners/${installationId}`, { ...f.docs.get(`recoveryDnsOwners/${INSTALL}`)!, installationId, credentialHash });
  }
  f.docs.set(`deletion_tombstones/${UID}`, { uid: UID, status: "deleting" });
  const before = structuredClone([...f.docs]);
  await assert.rejects(() => f.detach(), reason("deletion-unconfirmed"));
  assert.deepEqual([...f.docs], before);
});

test("completed deletion retry accepts an empty cooldown but cannot detach remaining records under cooldown", async () => {
  const f = fixture();
  await f.enroll();
  f.docs.set(`deletion_tombstones/${UID}`, { uid: UID, status: "cooldown", expiresAt: NOW + 1000 });
  await assert.rejects(() => f.detach(), reason("deletion-unconfirmed"));
  f.docs.get(`deletion_tombstones/${UID}`)!.status = "deleting";
  await f.detach();
  f.docs.get(`deletion_tombstones/${UID}`)!.status = "cooldown";
  assert.deepEqual(await f.detach(), { status: "detached", installations: 0 });
});

test("deletion removes only its account allowlist entries while preserving other accounts and device filtering", async () => {
  const f = fixture();
  f.docs.set("recoveryDnsPilot/config", { enabled: true, allowedUids: ["otherOwner", UID, "thirdOwner", UID], operatorRevision: "pilot-v1" });
  await f.enroll();
  const firstConfig = structuredClone(f.docs.get("recoveryDnsPilot/config"));
  const firstInstallation = structuredClone(f.docs.get(`recoveryDnsInstallations/${HASH}`));
  f.docs.set(`deletion_tombstones/${UID}`, { uid: UID, status: "deleting" });
  assert.deepEqual(await f.detach(), { status: "detached", installations: 1 });
  assert.deepEqual(f.docs.get("recoveryDnsPilot/config"), { ...firstConfig, allowedUids: ["otherOwner", "thirdOwner"] });
  assert.equal(f.docs.get(`recoveryDnsInstallations/${HASH}`)?.expiresAt, firstInstallation?.expiresAt);
  assert.equal(f.docs.get(`recoveryDnsInstallations/${HASH}`)?.dnsConsent, true);
  assert.deepEqual(await f.reserve(), { status: "granted" });
});

test("deleting the last allowlisted account retains filtering and cannot authorize new enrollment", async () => {
  const f = fixture();
  await f.enroll();
  f.docs.set(`deletion_tombstones/${UID}`, { uid: UID, status: "deleting" });
  await f.detach();
  assert.deepEqual(f.docs.get("recoveryDnsPilot/config")?.allowedUids, []);
  assert.equal((await f.resolve())?.active, true);
  assert.deepEqual(await f.reserve(), { status: "granted" });
  f.docs.delete(`deletion_tombstones/${UID}`);
  await assert.rejects(() => f.enroll(input({ installationId: "d123456789012345678901", credentialHash: "d".repeat(64) })), reason("pilot-unavailable"));
});

test("missing pilot config does not recreate an allowlist during deletion or an empty cooldown retry", async () => {
  const f = fixture();
  await f.enroll();
  f.docs.delete("recoveryDnsPilot/config");
  f.docs.set(`deletion_tombstones/${UID}`, { uid: UID, status: "deleting" });
  assert.deepEqual(await f.detach(), { status: "detached", installations: 1 });
  assert.equal(f.docs.has("recoveryDnsPilot/config"), false);
  f.docs.get(`deletion_tombstones/${UID}`)!.status = "cooldown";
  assert.deepEqual(await f.detach(), { status: "detached", installations: 0 });
  assert.equal(f.docs.has("recoveryDnsPilot/config"), false);
});

test("empty cooldown cannot confirm deletion while its raw UID remains in pilot config", async () => {
  const f = fixture();
  f.docs.set(`deletion_tombstones/${UID}`, { uid: UID, status: "cooldown" });
  const before = structuredClone([...f.docs]);
  await assert.rejects(() => f.detach(), reason("deletion-unconfirmed"));
  assert.deepEqual([...f.docs], before, "Completed deletion status never authorizes a cleanup write");
  f.docs.get(`deletion_tombstones/${UID}`)!.status = "deleting";
  assert.deepEqual(await f.detach(), { status: "detached", installations: 0 });
  assert.deepEqual(f.docs.get("recoveryDnsPilot/config")?.allowedUids, []);
  f.docs.get(`deletion_tombstones/${UID}`)!.status = "cooldown";
  assert.deepEqual(await f.detach(), { status: "detached", installations: 0 });
});

test("malformed allowlist blocks all detach writes while a disabled valid pilot still permits account cleanup", async () => {
  const f = fixture();
  await f.enroll();
  f.docs.set(`deletion_tombstones/${UID}`, { uid: UID, status: "deleting" });
  f.docs.get("recoveryDnsPilot/config")!.allowedUids = { [UID]: true };
  const before = structuredClone([...f.docs]);
  await assert.rejects(() => f.detach(), reason("deletion-unconfirmed"));
  assert.deepEqual([...f.docs], before);
  f.docs.set("recoveryDnsPilot/config", { enabled: false, allowedUids: [UID, "otherOwner"], activeCredentialHashes: [HASH] });
  await f.detach();
  assert.deepEqual(f.docs.get("recoveryDnsPilot/config"), { enabled: false, allowedUids: ["otherOwner"], activeCredentialHashes: [HASH] });
});

test("every fresh credential lookup rechecks the operator kill switch after an earlier granted request", async () => {
  const f = fixture();
  await f.enroll();
  const token = "eYxZ4l07n8X9AbCdEfGhIjKlMnOpQrStUvWxYz0123456789:APA91bHi0123456789abcdefghijklmnopqrstuvwx";
  f.docs.set(`push_tokens/${UID}_${INSTALL}`, { uid: UID, installationId: INSTALL, token, expiresAt: NOW + 60_000 });
  assert.deepEqual(await f.reserve(), { status: "granted" });
  assert.ok((await f.resolve())?.pushTarget);
  const activeConfig = structuredClone(f.docs.get("recoveryDnsPilot/config")!);
  for (const config of [undefined, { ...activeConfig, enabled: false }, { ...activeConfig, enabled: "true" },
    { ...activeConfig, allowedUids: "malformed" }, { ...activeConfig, activeCredentialHashes: [] },
    { ...activeConfig, activeCredentialHashes: undefined }, { ...activeConfig, activeCredentialHashes: ["d".repeat(64)] },
    { ...activeConfig, activeCredentialHashes: [HASH, HASH] }]) {
    if (config) f.docs.set("recoveryDnsPilot/config", config); else f.docs.delete("recoveryDnsPilot/config");
    assert.equal(await f.resolve(), undefined, "A previous reservation cannot bypass a later config change");
  }
  f.docs.set("recoveryDnsPilot/config", { ...activeConfig, allowedUids: [] });
  assert.equal((await f.resolve())?.active, true, "Enrollment allowlist removal alone is not credential revocation");
});

test("Firestore adapter observes pilot disable and slot removal between reservation and the next lookup", async t => {
  t.mock.method(Date, "now", () => NOW);
  const f = firebaseFixture();
  const first = await f.adapter.enroll(UID, input());
  assert.deepEqual(await f.adapter.reserveDnsRequest({ installationHash: HASH, installationId: INSTALL,
    ownerGeneration: first.ownerGeneration, requestId: EVENT }, {}), { status: "granted" });
  assert.equal((await f.adapter.resolveInstallation(HASH, {}))?.active, true);
  f.docs.get("recoveryDnsPilot/config")!.enabled = false;
  assert.equal(await f.adapter.resolveInstallation(HASH, {}), undefined);
  f.docs.get("recoveryDnsPilot/config")!.enabled = true;
  f.docs.get("recoveryDnsPilot/config")!.activeCredentialHashes = [];
  assert.equal(await f.adapter.resolveInstallation(HASH, {}), undefined);
});
