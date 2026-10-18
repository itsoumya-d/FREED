import assert from "node:assert/strict";
import { createCipheriv, createDecipheriv, pbkdf2Sync, randomBytes } from "node:crypto";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { test } from "node:test";
import { runInNewContext } from "node:vm";
import { decryptBackupPayload, encryptBackupPayload, generateBackupRandomBase64 } from "../src/lib/backup-crypto";

import {
  createEncryptedRecoveryBackup,
  restoreEncryptedRecoveryBackup,
  type RecoveryBackupEnvelope
} from "../src/lib/recovery-backup";
import { createDefaultRecoveryState } from "../src/lib/recovery-state";

const passphrase = "correct horse battery staple";
const exportedAt = "2026-09-30T12:00:00.000Z";
const verifiedEntitlement = {
  productId: "freed_premium_monthly" as const,
  platform: "android" as const,
  status: "verified" as const,
  verifiedAt: exportedAt,
  expiresAt: "2026-10-30T12:00:00.000Z"
};
const salt = Buffer.from("000102030405060708090a0b0c0d0e0f", "hex");
const iv = Buffer.from("101112131415161718191a1b", "hex");

// Frozen independently with Node PBKDF2 + AES-GCM, also used by the native core tests.
const vectors = [
  { password: passphrase, plaintext: "FREED backup v1", payload: "X73wvPSyCPik6JmupXandIsbc6SidWAZwLpHUCzskA==" },
  { password: "pässword 🔐\0 trail ", plaintext: "FREED backup 🚀", payload: "31btXu3Kc0qpBo4g1TXTPXFu17QTjitnK6kA8TwkhJzO" },
  { password: "  whitespace password  ", plaintext: "", payload: "DDNodavCps+OgvaYTIIC/w==" }
];

test("WebCrypto matches the fixed v1 ciphertext-plus-tag vectors", async () => {
  for (const vector of vectors) {
    assert.equal(await encryptBackupPayload(vector.password, salt.toString("base64"), iv.toString("base64"), vector.plaintext), vector.payload);
    assert.equal(await decryptBackupPayload(vector.password, salt.toString("base64"), iv.toString("base64"), vector.payload), vector.plaintext);
  }
});

test("fresh exports use independently random salts and IVs", async () => {
  const first = JSON.parse(await createEncryptedRecoveryBackup(createDefaultRecoveryState(), passphrase, exportedAt));
  const second = JSON.parse(await createEncryptedRecoveryBackup(createDefaultRecoveryState(), passphrase, exportedAt));
  assert.notEqual(first.kdf.salt, second.kdf.salt);
  assert.notEqual(first.cipher.iv, second.cipher.iv);
  assert.notEqual(first.payload, second.payload);
  assert.equal(Buffer.from(first.kdf.salt, "base64").byteLength, 16);
  assert.equal(Buffer.from(first.cipher.iv, "base64").byteLength, 12);
  await assert.rejects(generateBackupRandomBase64(65_536), /invalid random byte count/);
});

test("payload byte limits account for UTF-8 expansion", async () => {
  await assert.rejects(encryptBackupPayload(passphrase, salt.toString("base64"), iv.toString("base64"), "🚀".repeat(524_289)), /size limit/);
});

function nativeBackupSandbox(available: boolean) {
  // The Expo registry is the unavailable external boundary in Node. Keep real
  // AES/PBKDF2 behind that boundary while exercising the actual native adapter
  // and recovery-backup code with Hermes-like missing browser globals.
  const esbuild = createRequire(resolve("package.json"))("esbuild") as typeof import("esbuild");
  const result = esbuild.buildSync({
    entryPoints: [resolve("src/lib/recovery-backup.ts")],
    alias: { "@/lib/backup-crypto": resolve("src/lib/backup-crypto.native.ts") },
    bundle: true, external: ["expo"], platform: "node", format: "cjs", write: false, logLevel: "silent"
  });
  const nativeModule = {
    async randomBase64(length: number) { return randomBytes(length).toString("base64"); },
    async encrypt(password: string, salt: string, iv: string, plaintext: string) {
      const cipher = createCipheriv("aes-256-gcm", pbkdf2Sync(password, Buffer.from(salt, "base64"), 210_000, 32, "sha256"), Buffer.from(iv, "base64"));
      return Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final(), cipher.getAuthTag()]).toString("base64");
    },
    async decrypt(password: string, salt: string, iv: string, payload: string) {
      const encrypted = Buffer.from(payload, "base64");
      const cipher = createDecipheriv("aes-256-gcm", pbkdf2Sync(password, Buffer.from(salt, "base64"), 210_000, 32, "sha256"), Buffer.from(iv, "base64"));
      cipher.setAuthTag(encrypted.subarray(-16));
      return Buffer.concat([cipher.update(encrypted.subarray(0, -16)), cipher.final()]).toString("utf8");
    }
  };
  const sandbox = {
    module: { exports: {} },
    require(name: string) {
      assert.equal(name, "expo");
      return { requireOptionalNativeModule(name: string) { return name === "FreedBackupCrypto" && available ? nativeModule : null; } };
    }
  };
  runInNewContext(result.outputFiles[0].text, sandbox);
  return sandbox.module.exports as typeof import("../src/lib/recovery-backup");
}

test("native adapter creates and restores without WebCrypto or browser encoding globals", async () => {
  const native = nativeBackupSandbox(true);
  assert.equal(native.getRecoveryBackupReadiness().status, "ready");
  const serialized = await native.createEncryptedRecoveryBackup({ ...createDefaultRecoveryState(), streakDays: 27, premium: true }, passphrase, exportedAt);
  const payload = decryptWithNode(JSON.parse(serialized));
  assert.equal(payload.state.streakDays, 27);
  assert.equal(payload.state.premium, false);
  const restored = await native.restoreEncryptedRecoveryBackup(JSON.stringify(legacyEnvelope({ ...createDefaultRecoveryState(), streakDays: 18 })), passphrase);
  assert.equal(restored.streakDays, 18);
});

test("older native binaries report unavailable and reject corrupt envelopes before native work", async () => {
  const native = nativeBackupSandbox(false);
  assert.equal(native.getRecoveryBackupReadiness().status, "unavailable");
  await assert.rejects(native.createEncryptedRecoveryBackup(createDefaultRecoveryState(), passphrase), /requires a native build/);
  const envelope = legacyEnvelope(createDefaultRecoveryState());
  envelope.kdf.iterations = Number.MAX_SAFE_INTEGER;
  await assert.rejects(native.restoreEncryptedRecoveryBackup(JSON.stringify(envelope), passphrase), /envelope is unsupported/);
});

function decryptWithNode(envelope: RecoveryBackupEnvelope) {
  const key = pbkdf2Sync(passphrase, Buffer.from(envelope.kdf.salt, "base64"), 210_000, 32, "sha256");
  const encrypted = Buffer.from(envelope.payload, "base64");
  const cipher = createDecipheriv("aes-256-gcm", key, Buffer.from(envelope.cipher.iv, "base64"));
  cipher.setAuthTag(encrypted.subarray(-16));
  return JSON.parse(Buffer.concat([cipher.update(encrypted.subarray(0, -16)), cipher.final()]).toString("utf8"));
}

function legacyEnvelope(state: unknown): RecoveryBackupEnvelope {
  const cipher = createCipheriv("aes-256-gcm", pbkdf2Sync(passphrase, salt, 210_000, 32, "sha256"), iv);
  const plain = JSON.stringify({ app: "FREED", version: 1, exportedAt, state });
  const payload = Buffer.concat([cipher.update(plain, "utf8"), cipher.final(), cipher.getAuthTag()]);
  return {
    app: "FREED", version: 1, createdAt: exportedAt,
    kdf: { name: "PBKDF2-SHA256", iterations: 210_000, salt: salt.toString("base64") },
    cipher: { name: "AES-GCM", iv: iv.toString("base64") },
    payload: payload.toString("base64")
  };
}

test("portable export retains progress while removing purchase and device authority", async () => {
  const state = {
    ...createDefaultRecoveryState(),
    premium: true,
    premiumPlanId: "monthly" as const,
    premiumPlanAudience: "individual" as const,
    premiumActivatedAt: exportedAt,
    premiumEntitlement: verifiedEntitlement,
    streakDays: 23,
    bestStreakDays: 31,
    recoveryStartedAt: "2026-09-01T12:00:00.000Z",
    protectionActivatedAt: exportedAt,
    protectionActivationPlatform: "android" as const,
    vpnDisclosureAcknowledgedAt: exportedAt,
    pushToken: "old-device-push-token",
    reminders: {
      ...createDefaultRecoveryState().reminders,
      enabled: true,
      morningTime: "09:15",
      scheduledIds: ["old-device-notification"],
      permissionStatus: "granted" as const,
      lastScheduledAt: exportedAt
    }
  };
  const serialized = await createEncryptedRecoveryBackup(state, passphrase, exportedAt);
  const envelope = JSON.parse(serialized) as RecoveryBackupEnvelope;
  const portable = decryptWithNode(envelope).state;
  assert.equal(portable.premium, false);
  assert.equal(portable.premiumPlanId, null);
  assert.equal(portable.premiumPlanAudience, null);
  assert.equal(portable.premiumActivatedAt, null);
  assert.equal("premiumEntitlement" in portable, false);
  assert.equal(portable.protectionActivatedAt, null);
  assert.equal(portable.protectionActivationPlatform, null);
  assert.equal(portable.protectionSetupFallback, null);
  assert.equal(portable.vpnDisclosureAcknowledgedAt, null);
  assert.equal("pushToken" in portable, false);
  assert.deepEqual(portable.reminders.scheduledIds, []);
  assert.equal(portable.reminders.permissionStatus, "undetermined");
  assert.equal(portable.reminders.lastScheduledAt, null);
  assert.equal(portable.reminders.enabled, true);
  assert.equal(portable.reminders.morningTime, "09:15");
  assert.equal(portable.streakDays, 23);
  assert.equal(portable.bestStreakDays, 31);
  assert.equal(portable.recoveryStartedAt, state.recoveryStartedAt);
  assert.equal(serialized.includes("old-device-push-token"), false);
});

test("legacy v1 restore cannot reinstate premium or protection activation", async () => {
  const envelope = legacyEnvelope({
    ...createDefaultRecoveryState(), premium: true, premiumPlanId: "monthly",
    premiumActivatedAt: exportedAt, premiumEntitlement: verifiedEntitlement,
    protectionActivatedAt: exportedAt, protectionActivationPlatform: "ios", streakDays: 17,
    reminders: { ...createDefaultRecoveryState().reminders, scheduledIds: ["old-id"], permissionStatus: "granted" }
  });
  const restored = await restoreEncryptedRecoveryBackup(JSON.stringify(envelope), passphrase);
  assert.equal(restored.premium, false);
  assert.equal(restored.premiumEntitlement, null);
  assert.equal(restored.protectionActivatedAt, null);
  assert.equal(restored.protectionActivationPlatform, null);
  assert.deepEqual(restored.reminders.scheduledIds, []);
  assert.equal(restored.reminders.permissionStatus, "undetermined");
  assert.equal(restored.streakDays, 17);
});

test("wrong password and modified GCM tag cannot restore", async () => {
  const envelope = legacyEnvelope(createDefaultRecoveryState());
  await assert.rejects(restoreEncryptedRecoveryBackup(JSON.stringify(envelope), "incorrect passphrase"), /could not be decrypted/);
  const encrypted = Buffer.from(envelope.payload, "base64");
  encrypted[encrypted.length - 1] ^= 1;
  await assert.rejects(restoreEncryptedRecoveryBackup(JSON.stringify({ ...envelope, payload: encrypted.toString("base64") }), passphrase), /could not be decrypted/);
});

test("corrupt envelope parameters are rejected before derivation", async () => {
  const envelope = legacyEnvelope(createDefaultRecoveryState());
  const invalid = [
    { ...envelope, kdf: { ...envelope.kdf, iterations: 0 } },
    { ...envelope, kdf: { ...envelope.kdf, iterations: 1 } },
    { ...envelope, kdf: { ...envelope.kdf, iterations: 210_000.5 } },
    { ...envelope, kdf: { ...envelope.kdf, iterations: Number.MAX_SAFE_INTEGER } },
    { ...envelope, kdf: { ...envelope.kdf, salt: "AA==" } },
    { ...envelope, kdf: { ...envelope.kdf, salt: "!!!!!!!!!!!!!!!!!!!!!!!!" } },
    { ...envelope, kdf: { ...envelope.kdf, salt: "AAAAAAAAAAAAAAAAAAAAAB==" } },
    { ...envelope, cipher: { ...envelope.cipher, iv: "AA==" } },
    { ...envelope, payload: "AA==" },
    { ...envelope, payload: "not-base64" },
    { ...envelope, payload: "A".repeat(2_800_000) },
    { ...envelope, createdAt: "not-a-date" }
  ];
  for (const corrupt of invalid) {
    await assert.rejects(restoreEncryptedRecoveryBackup(JSON.stringify(corrupt), passphrase), /envelope|unsupported|size|parameters/);
  }
  await assert.rejects(restoreEncryptedRecoveryBackup(" ".repeat(3 * 1024 * 1024 + 1), passphrase), /size/);
  await assert.rejects(restoreEncryptedRecoveryBackup("null", passphrase), /invalid envelope/);
  await assert.rejects(restoreEncryptedRecoveryBackup("{", passphrase), /valid JSON/);
});
