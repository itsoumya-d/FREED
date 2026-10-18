import assert from "node:assert/strict";
import { createHash, createCipheriv, createDecipheriv, pbkdf2Sync } from "node:crypto";
import test from "node:test";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { runInNewContext } from "node:vm";
import * as backupModule from "../src/lib/automatic-backup";
import type { AutomaticBackupDependencies } from "../src/lib/automatic-backup";
import { createDefaultRecoveryState, getActiveEarnedUnlock, type RecoveryState } from "../src/lib/recovery-state";
import { createEncryptedRecoveryBackup, restoreEncryptedRecoveryBackup, type RecoveryBackupEnvelope } from "../src/lib/recovery-backup";
import * as transportModule from "../src/lib/recovery-backup-client-sync";
const { configureRecoveryBackupClientSyncTransport, uploadSerializedEncryptedRecoveryBackup } = transportModule;

const api = backupModule;
const SECRET = "my explicit private backup passphrase";
const NOW = Date.parse("2026-10-01T12:00:00.000Z");
const syncedAt = new Date(NOW).toISOString();

function deferred<Value>() {
  let resolve!: (value: Value) => void;
  const promise = new Promise<Value>((complete) => { resolve = complete; });
  return { promise, resolve };
}
const flush = () => new Promise<void>((resolve) => setImmediate(resolve));
const state = (streakDays: number): RecoveryState => ({ ...createDefaultRecoveryState(), streakDays });

function harness(maxAttempts = 3) {
  let secret: string | null = null;
  let reads = 0;
  let writes = 0;
  let deletes = 0;
  let accountScope: string | null = "existing-firebase-uid";
  const ciphertexts: string[] = [];
  const encryptions: Array<{ state: unknown; secret: string }> = [];
  const phases: string[] = [];
  const dependencies: AutomaticBackupDependencies = {
    now: () => NOW,
    secretStore: {
      read: async () => { reads += 1; return secret; },
      write: async (value: string) => { writes += 1; secret = value; },
      remove: async () => { deletes += 1; secret = null; }
    },
    getAccountScope: async () => accountScope,
    fingerprint: async (value: string) => createHash("sha256").update(value).digest("hex"),
    encrypt: async (portable, value) => {
      encryptions.push({ state: portable, secret: value });
      return `ciphertext-for-${portable.streakDays}`;
    },
    upload: async (ciphertext: string, _options: { signal: AbortSignal; accountScope: string }) => {
      ciphertexts.push(ciphertext);
      return { ok: true, status: "ok" as const, action: "upload" as const, syncedAt };
    },
    wait: async (_milliseconds: number, _signal: AbortSignal) => undefined,
    maxAttempts
  };
  const controller = api.createAutomaticBackupController(dependencies);
  controller.subscribe((value: { phase: string }) => phases.push(value.phase));
  return {
    controller, dependencies, ciphertexts, encryptions, phases,
    secret: () => secret, setSecret: (value: string | null) => { secret = value; },
    reads: () => reads, writes: () => writes, deletes: () => deletes,
    setAccountScope: (value: string | null) => { accountScope = value; }
  };
}

test("construction and unconsented sync have no storage, encryption, upload, or account effects", async () => {
  const value = harness();
  assert.equal((await value.controller.sync(state(1))).status, "disabled");
  assert.equal(value.reads(), 0);
  assert.equal(value.writes(), 0);
  assert.equal(value.encryptions.length, 0);
  assert.equal(value.ciphertexts.length, 0);
});

test("explicit enabling stores the provided secret before accepting automatic sync", async () => {
  const value = harness();
  await value.controller.enable(SECRET);
  assert.equal(value.secret(), SECRET);
  assert.equal(value.writes(), 1);
  assert.equal(value.ciphertexts.length, 0);
  assert.equal((await value.controller.sync(state(1))).status, "synced");
  assert.equal(value.controller.getStatus().enabled, true);
  assert.equal(value.controller.getStatus().lastSyncedAt, syncedAt);
});

test("invalid passphrases never reach secure storage", async () => {
  const value = harness();
  for (const invalid of [" short ", "a".repeat(513)]) await assert.rejects(value.controller.enable(invalid), /passphrase/);
  assert.equal(value.writes(), 0);
  assert.equal(value.controller.getStatus().enabled, false);
});

test("persisted opt-in may resume an existing key but a missing key cannot silently enable backup", async () => {
  const resumed = harness();
  resumed.setSecret(SECRET);
  assert.equal((await resumed.controller.sync(state(2))).status, "disabled");
  assert.equal((await resumed.controller.sync(state(2), true)).status, "synced");
  assert.equal(resumed.writes(), 0);
  const missing = harness();
  const result = await missing.controller.sync(state(2), true);
  assert.equal(result.status, "unavailable");
  assert.equal(result.reason, "key-missing");
  assert.equal(missing.ciphertexts.length, 0);
});

test("unchanged portable recovery data skips encryption and upload despite changed local authority", async () => {
  const value = harness();
  await value.controller.enable(SECRET);
  await value.controller.sync(state(3));
  const changedAuthority: RecoveryState = {
    ...state(3), premium: true, premiumPlanId: "monthly", premiumActivatedAt: syncedAt,
    protectionActivatedAt: syncedAt, protectionActivationPlatform: "ios"
  };
  assert.equal((await value.controller.sync(changedAuthority)).status, "unchanged");
  assert.equal(value.encryptions.length, 1);
  assert.equal(value.ciphertexts.length, 1);
});

test("overlapping updates do not overlap writes and keep the newest queued snapshot", async () => {
  const value = harness();
  const firstUpload = deferred<void>();
  let active = 0;
  let maximumActive = 0;
  value.dependencies.upload = async (ciphertext) => {
    value.ciphertexts.push(ciphertext);
    active += 1; maximumActive = Math.max(maximumActive, active);
    if (ciphertext === "ciphertext-for-1") await firstUpload.promise;
    active -= 1;
    return { ok: true, status: "ok", action: "upload", syncedAt };
  };
  await value.controller.enable(SECRET);
  const first = value.controller.sync(state(1));
  await flush();
  const second = value.controller.sync(state(2));
  const newest = value.controller.sync(state(3));
  assert.deepEqual(value.ciphertexts, ["ciphertext-for-1"]);
  firstUpload.resolve();
  const results = await Promise.all([first, second, newest]);
  assert.equal(results.every((result) => result.status === "synced"), true);
  assert.deepEqual(value.ciphertexts, ["ciphertext-for-1", "ciphertext-for-3"]);
  assert.equal(maximumActive, 1);
});

test("transient failures retry the identical ciphertext without repeating encryption", async () => {
  const value = harness();
  let attempts = 0;
  value.dependencies.upload = async (ciphertext) => {
    value.ciphertexts.push(ciphertext);
    attempts += 1;
    return attempts < 3 ? { ok: false, status: "error", action: "upload", syncedAt } : { ok: true, status: "ok", action: "upload", syncedAt };
  };
  await value.controller.enable(SECRET);
  const result = await value.controller.sync(state(4));
  assert.equal(result.status, "synced");
  assert.equal(result.attempts, 3);
  assert.equal(value.encryptions.length, 1);
  assert.deepEqual(value.ciphertexts, Array(3).fill("ciphertext-for-4"));
  assert.equal(value.phases.filter((phase) => phase === "retrying").length, 2);
});

test("an invalid retry setting cannot prevent a valid first upload or expose non-finite attempt counts", async () => {
  const value = harness(Number.NaN);
  await value.controller.enable(SECRET);
  const result = await value.controller.sync(state(1));
  assert.equal(result.status, "synced");
  assert.equal(result.attempts, 1);
  assert.equal(value.ciphertexts.length, 1);
});

test("bounded retry exhaustion preserves the previous successful backup checkpoint", async () => {
  const value = harness();
  await value.controller.enable(SECRET);
  await value.controller.sync(state(1));
  let attempts = 0;
  value.dependencies.upload = async () => { attempts += 1; throw new Error(`${SECRET} private provider detail`); };
  const failed = await value.controller.sync(state(2));
  assert.equal(failed.status, "error");
  assert.equal(failed.attempts, 3);
  assert.equal(attempts, 3);
  assert.equal(value.controller.getStatus().lastSyncedAt, syncedAt);
  assert.equal((await value.controller.sync(state(1))).status, "unchanged");
  assert.equal(attempts, 3);
  assert.equal(JSON.stringify(failed).includes(SECRET), false);
  assert.equal(JSON.stringify(value.controller.getStatus()).includes(SECRET), false);
});

test("missing authentication and unavailable cloud sync are reported without retry loops", async () => {
  const signedOut = harness();
  await signedOut.controller.enable(SECRET);
  signedOut.setAccountScope(null);
  assert.equal((await signedOut.controller.sync(state(1))).reason, "signed-out");
  assert.equal(signedOut.ciphertexts.length, 0);
  const unavailable = harness();
  unavailable.dependencies.upload = async () => ({ ok: false, status: "unconfigured", action: "upload", syncedAt });
  await unavailable.controller.enable(SECRET);
  const result = await unavailable.controller.sync(state(1));
  assert.equal(result.status, "unavailable");
  assert.equal(result.attempts, 1);
});

test("disable removes the secret and prevents queued plaintext from uploading after encryption completes", async () => {
  const value = harness();
  const encryption = deferred<string>();
  value.dependencies.encrypt = async () => encryption.promise;
  await value.controller.enable(SECRET);
  const pending = value.controller.sync(state(1));
  await flush();
  const queued = value.controller.sync(state(2));
  await value.controller.disable();
  assert.equal(value.secret(), null);
  assert.equal(value.deletes(), 1);
  assert.equal(value.controller.getStatus().enabled, false);
  encryption.resolve("late-ciphertext");
  assert.equal((await pending).status, "cancelled");
  assert.equal((await queued).status, "cancelled");
  await flush();
  assert.equal(value.ciphertexts.length, 0);
  assert.equal((await value.controller.sync(state(3), true)).status, "disabled", "A stale persisted flag cannot restart a disabled session");
});

test("disable wins an in-flight secure key write and clears the late-written key", async () => {
  const value = harness();
  const write = deferred<void>();
  const originalWrite = value.dependencies.secretStore.write;
  value.dependencies.secretStore.write = async (secret) => { await write.promise; await originalWrite(secret); };
  const enabling = value.controller.enable(SECRET);
  await flush();
  const disabling = value.controller.disable();
  const rejectedEnable = assert.rejects(enabling, /cancel/);
  write.resolve();
  await Promise.all([rejectedEnable, disabling]);
  assert.equal(value.secret(), null);
  assert.equal(value.controller.getStatus().enabled, false);
});

test("a late secure-key read cannot start encryption after disable", async () => {
  const value = harness();
  const keyRead = deferred<string>();
  value.dependencies.secretStore.read = () => keyRead.promise;
  await value.controller.enable(SECRET);
  const pending = value.controller.sync(state(1));
  await flush();
  await value.controller.disable();
  keyRead.resolve(SECRET);
  assert.equal((await pending).status, "cancelled");
  await flush();
  assert.equal(value.encryptions.length, 0);
  assert.equal(value.ciphertexts.length, 0);
});

test("disable aborts an in-flight upload and cannot accept its late success", async () => {
  const value = harness();
  const upload = deferred<void>();
  let signal: AbortSignal | undefined;
  value.dependencies.upload = async (_ciphertext, options) => { signal = options.signal; await upload.promise; return { ok: true, status: "ok", action: "upload", syncedAt }; };
  await value.controller.enable(SECRET);
  const pending = value.controller.sync(state(1));
  await flush();
  await value.controller.disable();
  assert.equal(signal?.aborted, true);
  upload.resolve();
  assert.equal((await pending).status, "cancelled");
  await flush();
  assert.equal(value.controller.getStatus().lastSyncedAt, null);
  assert.equal(value.controller.getStatus().phase, "disabled");
});

test("re-enabling after disable waits for an older upload to finish instead of overlapping writes", async () => {
  const value = harness();
  const firstUpload = deferred<void>();
  value.dependencies.upload = async (ciphertext) => {
    value.ciphertexts.push(ciphertext);
    if (ciphertext === "ciphertext-for-1") await firstUpload.promise;
    return { ok: true, status: "ok", action: "upload", syncedAt };
  };
  await value.controller.enable(SECRET);
  const first = value.controller.sync(state(1));
  await flush();
  await value.controller.disable();
  await value.controller.enable(SECRET);
  const next = value.controller.sync(state(2));
  await flush();
  assert.deepEqual(value.ciphertexts, ["ciphertext-for-1"]);
  firstUpload.resolve();
  assert.equal((await first).status, "cancelled");
  assert.equal((await next).status, "synced");
  assert.deepEqual(value.ciphertexts, ["ciphertext-for-1", "ciphertext-for-2"]);
});

test("sync snapshots cannot be changed by mutating the caller's recovery state", async () => {
  const value = harness();
  await value.controller.enable(SECRET);
  const input = state(1);
  const pending = value.controller.sync(input);
  input.streakDays = 99;
  await pending;
  assert.deepEqual(value.ciphertexts, ["ciphertext-for-1"]);
});

test("cleanup cancels work and reports disabled without secretly deleting user opt-in", async () => {
  const value = harness();
  await value.controller.enable(SECRET);
  value.controller.dispose();
  assert.equal(value.controller.getStatus().enabled, false);
  assert.equal(value.controller.getStatus().phase, "disabled");
  assert.equal(value.secret(), SECRET);
  assert.equal((await value.controller.sync(state(1), true)).status, "disabled");
});

test("the secure-key adapter uses device-only unlocked accessibility and never browser storage", async () => {
  const calls: Array<{ method: string; key: string; options: unknown }> = [];
  let stored: string | null = null;
  const store = api.createAutomaticBackupSecureKeyStore({
    WHEN_UNLOCKED_THIS_DEVICE_ONLY: 8,
    isAvailableAsync: async () => true,
    getItemAsync: async (key: string, options: unknown) => { calls.push({ method: "read", key, options }); return stored; },
    setItemAsync: async (key: string, value: string, options: unknown) => { calls.push({ method: "write", key, options }); stored = value; },
    deleteItemAsync: async (key: string, options: unknown) => { calls.push({ method: "delete", key, options }); stored = null; }
  });
  assert.equal(calls.length, 0);
  await store.write(SECRET);
  assert.equal(await store.read(), SECRET);
  await store.remove();
  assert.deepEqual(calls.map((call) => call.method), ["write", "read", "delete"]);
  for (const call of calls) assert.deepEqual(call.options, {
    keychainService: "app.freed.recovery.automatic-backup.v1", keychainAccessible: 8, requireAuthentication: false
  });
  assert.equal(stored, null);
});

test("automatic upload sends real ciphertext without portable Premium or protection authority", async () => {
  const value = harness();
  let encrypted = "";
  value.dependencies.encrypt = async (portable, secret) => createEncryptedRecoveryBackup({ ...portable, premiumEntitlement: null }, secret, syncedAt);
  value.dependencies.upload = async (ciphertext) => { encrypted = ciphertext; return { ok: true, status: "ok", action: "upload", syncedAt }; };
  const input: RecoveryState & { automaticBackupEnabled: boolean } = {
    ...state(9), premium: true, premiumPlanId: "monthly", premiumActivatedAt: syncedAt,
    protectionActivatedAt: syncedAt, protectionActivationPlatform: "android", vpnDisclosureAcknowledgedAt: syncedAt,
    automaticBackupEnabled: true, signedInEmail: "private-recovery@example.com"
  };
  await value.controller.enable(SECRET);
  assert.equal((await value.controller.sync(input)).status, "synced");
  assert.equal(encrypted.includes(SECRET), false);
  assert.equal(encrypted.includes("private-recovery@example.com"), false);
  const envelope = JSON.parse(encrypted) as RecoveryBackupEnvelope;
  const packed = Buffer.from(envelope.payload, "base64");
  const decipher = createDecipheriv("aes-256-gcm", pbkdf2Sync(SECRET, Buffer.from(envelope.kdf.salt, "base64"), 210_000, 32, "sha256"), Buffer.from(envelope.cipher.iv, "base64"));
  decipher.setAuthTag(packed.subarray(-16));
  const portable = JSON.parse(Buffer.concat([decipher.update(packed.subarray(0, -16)), decipher.final()]).toString("utf8")).state;
  assert.equal(portable.premium, false);
  assert.equal("premiumEntitlement" in portable, false);
  assert.equal(portable.protectionActivatedAt, null);
  assert.equal(portable.vpnDisclosureAcknowledgedAt, null);
  assert.notEqual(portable.automaticBackupEnabled, true);
  assert.equal(portable.streakDays, 9);
});

test("serialized transport keeps exact ciphertext stable and honors cancellation before remote access", async () => {
  const encrypted = await createEncryptedRecoveryBackup(state(1), SECRET, syncedAt);
  const bodies: string[] = [];
  configureRecoveryBackupClientSyncTransport(async (payload) => {
    bodies.push(JSON.stringify(payload.envelope));
    return { ok: true, status: "ok", syncedAt };
  });
  try {
    const config = { getAuthToken: async () => "existing-user-auth-token" };
    assert.equal((await uploadSerializedEncryptedRecoveryBackup(encrypted, config)).ok, true);
    assert.equal((await uploadSerializedEncryptedRecoveryBackup(encrypted, config)).ok, true);
    assert.deepEqual(bodies, [encrypted, encrypted]);
    const controller = new AbortController(); controller.abort();
    const aborted = await uploadSerializedEncryptedRecoveryBackup(encrypted, { ...config, signal: controller.signal });
    assert.equal(aborted.ok, false);
    assert.equal(bodies.length, 2);
  } finally { configureRecoveryBackupClientSyncTransport(null); }
});

test("serialized transport links disable cancellation into an ongoing fetch", async () => {
  const encrypted = await createEncryptedRecoveryBackup(state(1), SECRET, syncedAt);
  let transferSignal: AbortSignal | null = null;
  configureRecoveryBackupClientSyncTransport(async (_payload, config) => {
    await config.fetcher!("https://storage.googleapis.com/prepared-backup", { method: "PUT" });
    return { ok: true, status: "ok", syncedAt };
  });
  try {
    const abort = new AbortController();
    const pending = uploadSerializedEncryptedRecoveryBackup(encrypted, {
      signal: abort.signal,
      getAuthToken: async () => "existing-user-auth-token",
      fetcher: async (_input, init) => {
        transferSignal = init?.signal ?? null;
        return new Promise((_resolve, reject) => init?.signal?.addEventListener("abort", () => reject(new Error("cancelled")), { once: true }));
      }
    });
    await flush();
    abort.abort();
    assert.equal((await pending).ok, false);
    assert.equal((transferSignal as AbortSignal | null)?.aborted, true);
  } finally { configureRecoveryBackupClientSyncTransport(null); }
});

test("the web entry refuses automatic backup without caching a secret or contacting an account", async () => {
  await assert.rejects(api.enableAutomaticBackup(SECRET), /unavailable/);
  assert.equal(api.getAutomaticBackupStatus().enabled, false);
  assert.equal(api.getAutomaticBackupStatus().reason, "unsupported");
  const optedIn = { ...state(1), automaticBackupEnabled: true };
  assert.equal((await api.syncAutomaticRecoveryBackup(optedIn)).status, "unavailable");
  await api.disableAutomaticBackup();
  assert.equal(JSON.stringify(api.getAutomaticBackupStatus()).includes(SECRET), false);
});

test("a missing native runtime yields an honest unavailable result without leaking SDK error text", async () => {
  const esbuild = createRequire(resolve("package.json"))("esbuild") as typeof import("esbuild");
  const built = esbuild.buildSync({
    entryPoints: [resolve("src/lib/automatic-backup.ts")], bundle: true, platform: "node", format: "cjs", write: false,
    external: ["./automatic-backup-runtime"], supported: { "dynamic-import": false }, logLevel: "silent"
  });
  let loads = 0;
  const sandbox = {
    module: { exports: {} }, process: { env: {} },
    require(name: string) {
      assert.equal(name, "./automatic-backup-runtime");
      loads += 1;
      throw new Error("private SDK installation detail");
    }
  };
  runInNewContext(built.outputFiles[0].text, sandbox);
  const entry = sandbox.module.exports as typeof backupModule;
  assert.equal(loads, 0);
  const result = await entry.syncAutomaticRecoveryBackup({ ...state(1), automaticBackupEnabled: true });
  assert.equal(result.status, "unavailable");
  assert.equal(entry.getAutomaticBackupStatus().phase, "unavailable");
  assert.equal(entry.getAutomaticBackupStatus().reason, "unsupported");
  assert.equal(JSON.stringify(result).includes("private SDK"), false);
});

function decryptPortableEnvelope(serialized: string) {
  const envelope = JSON.parse(serialized) as RecoveryBackupEnvelope;
  const packed = Buffer.from(envelope.payload, "base64");
  const decipher = createDecipheriv("aes-256-gcm", pbkdf2Sync(SECRET, Buffer.from(envelope.kdf.salt, "base64"), 210_000, 32, "sha256"), Buffer.from(envelope.cipher.iv, "base64"));
  decipher.setAuthTag(packed.subarray(-16));
  return JSON.parse(Buffer.concat([decipher.update(packed.subarray(0, -16)), decipher.final()]).toString("utf8")) as { exportedAt: string; state: RecoveryState };
}

function legacyEnvelopeWithState(input: RecoveryState, exportedAt: string): string {
  const salt = Buffer.alloc(16, 1);
  const iv = Buffer.alloc(12, 2);
  const cipher = createCipheriv("aes-256-gcm", pbkdf2Sync(SECRET, salt, 210_000, 32, "sha256"), iv);
  const plaintext = JSON.stringify({ app: "FREED", version: 1, exportedAt, state: input });
  const payload = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final(), cipher.getAuthTag()]).toString("base64");
  return JSON.stringify({
    app: "FREED", version: 1, createdAt: exportedAt,
    kdf: { name: "PBKDF2-SHA256", iterations: 210_000, salt: salt.toString("base64") },
    cipher: { name: "AES-GCM", iv: iv.toString("base64") }, payload
  });
}

test("encrypted exports seal copied open sessions at the actual export timestamp", async () => {
  const input: RecoveryState = {
    ...state(1),
    appSessions: [
      { id: "open-session", openedAt: "2026-09-30T11:59:00.000Z", closedAt: null, durationSec: 3 },
      { id: "closed-session", openedAt: "2026-09-29T12:00:00.000Z", closedAt: "2026-09-29T12:00:30.000Z", durationSec: 30 }
    ]
  };
  const exportedAt = "2026-09-30T12:00:00.000Z";
  const plaintext = decryptPortableEnvelope(await createEncryptedRecoveryBackup(input, SECRET, exportedAt));
  assert.equal(plaintext.exportedAt, exportedAt);
  assert.deepEqual(plaintext.state.appSessions[0], { id: "open-session", openedAt: "2026-09-30T11:59:00.000Z", closedAt: exportedAt, durationSec: 60 });
  assert.deepEqual(plaintext.state.appSessions[1], input.appSessions[1]);
  assert.equal(input.appSessions[0].closedAt, null, "Export must not mutate the live source session");
});

test("restoring legacy open sessions uses authenticated payload time rather than the receiver's current clock", async () => {
  const exportedAt = "2026-09-30T12:00:00.000Z";
  const input: RecoveryState = {
    ...state(1),
    appSessions: [{ id: "legacy-open", openedAt: "2026-09-30T11:59:00.000Z", closedAt: null, durationSec: 0 }]
  };
  const restored = await restoreEncryptedRecoveryBackup(legacyEnvelopeWithState(input, exportedAt), SECRET);
  assert.equal(restored.appSessions[0].closedAt, exportedAt);
  assert.equal(restored.appSessions[0].durationSec, 60);
});

test("portable unlock history cannot grant native or local access on the restored device", async () => {
  const input: RecoveryState = {
    ...state(1),
    earnedUnlocks: [{ id: "historical-unlock", startedAt: "2026-10-01T11:59:00.000Z", expiresAt: "2026-10-01T12:04:00.000Z", durationMinutes: 5,
      sourceChallengeId: "reset-1", sourceAttemptHost: "youtube.com", nativeInterventionId: "intervention-1234" }]
  };
  const restored = await restoreEncryptedRecoveryBackup(legacyEnvelopeWithState(input, syncedAt), SECRET);
  assert.equal(restored.earnedUnlocks.length, 1);
  assert.equal(restored.earnedUnlocks[0].durationMinutes, 5);
  assert.equal(restored.earnedUnlocks[0].startedAt, input.earnedUnlocks[0].startedAt);
  assert.equal(restored.earnedUnlocks[0].sourceAttemptHost, undefined);
  assert.equal(restored.earnedUnlocks[0].nativeInterventionId, undefined);
  assert.equal(getActiveEarnedUnlock(restored, syncedAt), null);
});
