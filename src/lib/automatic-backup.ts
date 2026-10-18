import { buildPortableRecoveryState } from "./recovery-backup";
import type { RecoveryBackupClientSyncResult } from "./recovery-backup-client-sync";
import type { RecoveryState } from "./recovery-state";
import { validateJournalTextBackup, type JournalTextBackup } from './journal-text-backup';

export type PortableAutomaticBackupState = ReturnType<typeof buildPortableRecoveryState> & { journal?: JournalTextBackup };
export type AutomaticBackupPhase = "disabled" | "enabling" | "idle" | "queued" | "encrypting" | "uploading" | "retrying" | "synced" | "unavailable" | "error";
export type AutomaticBackupReason = "unsupported" | "key-missing" | "signed-out" | "cloud-unavailable" | "storage-error" | "encryption-error" | "upload-error" | "retry-exhausted" | "account-changed";
export type AutomaticBackupStatus = {
  phase: AutomaticBackupPhase;
  enabled: boolean;
  attempts: number;
  lastSyncedAt: string | null;
  reason?: AutomaticBackupReason;
  message?: string;
};
export type AutomaticBackupSyncResult = {
  ok: boolean;
  status: "synced" | "unchanged" | "disabled" | "cancelled" | "unavailable" | "error";
  attempts: number;
  lastSyncedAt: string | null;
  reason?: AutomaticBackupReason;
};
export type AutomaticBackupSecretStore = { read(): Promise<string | null>; write(secret: string): Promise<void>; remove(): Promise<void> };
export type AutomaticBackupDependencies = {
  secretStore: AutomaticBackupSecretStore;
  fingerprint(serializedPortableState: string): Promise<string>;
  encrypt(state: PortableAutomaticBackupState, secret: string, exportedAt: string): Promise<string>;
  upload(ciphertext: string, options: { signal: AbortSignal; accountScope: string }): Promise<RecoveryBackupClientSyncResult>;
  getAccountScope?: () => Promise<string | null> | string | null;
  now?: () => number;
  wait?: (milliseconds: number, signal: AbortSignal) => Promise<void>;
  maxAttempts?: number;
};

const MESSAGES: Record<AutomaticBackupReason, string> = {
  unsupported: "Automatic backup is unavailable on this platform.",
  "key-missing": "Enter your backup passphrase to enable automatic backup on this device.",
  "signed-out": "Sign in before uploading an automatic backup.",
  "cloud-unavailable": "Cloud backup is unavailable. Your recovery data stays on this device.",
  "storage-error": "The secure local backup key could not be accessed.",
  "encryption-error": "The recovery backup could not be encrypted on this device.",
  "upload-error": "The backup could not be uploaded. Recovery data remains on this device.",
  "retry-exhausted": "Backup upload retries ended. Recovery data remains on this device.",
  "account-changed": "The signed-in account changed. Try backup again after confirming your account."
};

/** One foreground-requested queue. Construction never reads storage or contacts an account/backend. */
export function createAutomaticBackupController(dependencies: AutomaticBackupDependencies) {
  let enabled = false;
  let resumeBlocked = false;
  let disposed = false;
  let generation = 0;
  let consentGeneration = 0;
  let running = false;
  let pending: { state: PortableAutomaticBackupState; exportedAt: string } | null = null;
  let activeAbort: AbortController | null = null;
  let keyTail: Promise<void> = Promise.resolve();
  let lastFingerprint: string | null = null;
  let lastAccountScope: string | null = null;
  let lastSyncedAt: string | null = null;
  let current: AutomaticBackupStatus = { phase: "disabled", enabled: false, attempts: 0, lastSyncedAt: null };
  const listeners = new Set<(status: AutomaticBackupStatus) => void>();
  const waiters: Array<{ generation: number; resolve: (result: AutomaticBackupSyncResult) => void }> = [];
  const requestedAttempts = dependencies.maxAttempts ?? 3;
  const maxAttempts = Number.isFinite(requestedAttempts) ? Math.max(1, Math.min(5, Math.floor(requestedAttempts))) : 3;
  const now = dependencies.now ?? Date.now;
  const wait = dependencies.wait ?? abortableWait;

  function publish(phase: AutomaticBackupPhase, attempts = 0, reason?: AutomaticBackupReason) {
    current = { phase, enabled, attempts, lastSyncedAt, ...(reason ? { reason, message: MESSAGES[reason] } : {}) };
    for (const listener of listeners) { try { listener({ ...current }); } catch { /* Observer errors cannot upload or retain recovery data. */ } }
  }
  function result(status: AutomaticBackupSyncResult["status"], attempts = 0, reason?: AutomaticBackupReason): AutomaticBackupSyncResult {
    return { ok: status === "synced" || status === "unchanged", status, attempts, lastSyncedAt, ...(reason ? { reason } : {}) };
  }
  function settle(epoch: number, value: AutomaticBackupSyncResult) {
    for (let index = waiters.length - 1; index >= 0; index -= 1) {
      if (waiters[index].generation === epoch) waiters.splice(index, 1)[0].resolve(value);
    }
  }
  function cancelWork() {
    const previous = generation++;
    pending = null;
    activeAbort?.abort();
    settle(previous, result("cancelled", current.attempts));
  }
  function keyOperation<Result>(operation: () => Promise<Result>): Promise<Result> {
    const operationPromise = keyTail.then(operation);
    keyTail = operationPromise.then(() => undefined, () => undefined);
    return operationPromise;
  }
  const active = (epoch: number) => generation === epoch && enabled && !disposed;

  async function processSnapshot(snapshot: { state: PortableAutomaticBackupState; exportedAt: string }, epoch: number, abort: AbortController): Promise<AutomaticBackupSyncResult> {
    let scope: string | null;
    let fingerprint: string;
    try {
      scope = dependencies.getAccountScope ? await dependencies.getAccountScope() : "local";
      if (!active(epoch)) return result("cancelled");
      if (!scope) { publish("unavailable", 0, "signed-out"); return result("unavailable", 0, "signed-out"); }
      fingerprint = await dependencies.fingerprint(JSON.stringify(canonicalValue(snapshot.state)));
      if (!active(epoch)) return result("cancelled");
      if (pending) return result("cancelled");
      if (lastFingerprint === fingerprint && lastAccountScope === scope) {
        publish("synced"); return result("unchanged");
      }
    } catch {
      if (!active(epoch)) return result("cancelled");
      publish("error", 0, "encryption-error"); return result("error", 0, "encryption-error");
    }
    let secret: string | null;
    try { secret = await dependencies.secretStore.read(); }
    catch {
      if (!active(epoch)) return result("cancelled");
      publish("unavailable", 0, "storage-error"); return result("unavailable", 0, "storage-error");
    }
    if (!active(epoch)) return result("cancelled");
    if (!secret || !usablePassphrase(secret)) {
      publish("unavailable", 0, "key-missing"); return result("unavailable", 0, "key-missing");
    }
    let ciphertext: string;
    try {
      publish("encrypting");
      ciphertext = await dependencies.encrypt(snapshot.state, secret, snapshot.exportedAt);
    } catch {
      if (!active(epoch)) return result("cancelled");
      publish("error", 0, "encryption-error"); return result("error", 0, "encryption-error");
    } finally { secret = null; }
    if (!active(epoch) || pending) return result("cancelled");

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      if (!active(epoch)) return result("cancelled", attempt - 1);
      try {
        if (dependencies.getAccountScope && await dependencies.getAccountScope() !== scope) {
          if (!active(epoch)) return result("cancelled", attempt - 1);
          publish("unavailable", attempt - 1, "account-changed"); return result("unavailable", attempt - 1, "account-changed");
        }
        if (!active(epoch)) return result("cancelled", attempt - 1);
        publish("uploading", attempt);
        const uploaded = await dependencies.upload(ciphertext, { signal: abort.signal, accountScope: scope });
        if (!active(epoch)) return result("cancelled", attempt);
        if (uploaded.ok && uploaded.status === "ok") {
          if (dependencies.getAccountScope && await dependencies.getAccountScope() !== scope) {
            publish("unavailable", attempt, "account-changed"); return result("unavailable", attempt, "account-changed");
          }
          if (!active(epoch)) return result("cancelled", attempt);
          lastFingerprint = fingerprint; lastAccountScope = scope;
          lastSyncedAt = uploaded.syncedAt && Number.isFinite(Date.parse(uploaded.syncedAt)) ? new Date(uploaded.syncedAt).toISOString() : new Date(now()).toISOString();
          publish("synced", attempt); return result("synced", attempt);
        }
        if (uploaded.status === "unconfigured" || uploaded.status === "unauthorized") {
          const reason = uploaded.status === "unauthorized" ? "signed-out" : "cloud-unavailable";
          publish("unavailable", attempt, reason); return result("unavailable", attempt, reason);
        }
        if (uploaded.status === "invalid") { publish("error", attempt, "upload-error"); return result("error", attempt, "upload-error"); }
      } catch {
        if (!active(epoch)) return result("cancelled", attempt);
      }
      if (pending) return result("cancelled", attempt);
      if (attempt === maxAttempts) { publish("error", attempt, "retry-exhausted"); return result("error", attempt, "retry-exhausted"); }
      publish("retrying", attempt);
      try { await wait(Math.min(2_000, 500 * 2 ** (attempt - 1)), abort.signal); }
      catch { return result("cancelled", attempt); }
    }
    return result("error", maxAttempts, "retry-exhausted");
  }

  function startDrain() {
    if (running || !pending || !enabled || disposed) return;
    running = true;
    const epoch = generation;
    void Promise.resolve().then(async () => {
      let finalResult = result("disabled");
      while (active(epoch) && pending) {
        const snapshot = pending;
        pending = null;
        const abort = new AbortController();
        activeAbort = abort;
        finalResult = await processSnapshot(snapshot, epoch, abort);
        if (activeAbort === abort) activeAbort = null;
      }
      if (active(epoch)) settle(epoch, finalResult);
    }).catch(() => {
      if (active(epoch)) { publish("error", 0, "upload-error"); settle(epoch, result("error", 0, "upload-error")); }
    }).finally(() => {
      running = false;
      startDrain();
    });
  }

  return {
    async enable(passphrase: string): Promise<void> {
      if (!usablePassphrase(passphrase)) throw new Error("Use a backup passphrase of 8 to 512 characters.");
      if (disposed) throw new Error("Automatic backup has been stopped.");
      const consent = ++consentGeneration;
      enabled = false; cancelWork(); publish("enabling");
      await keyOperation(async () => {
        if (consent !== consentGeneration || disposed) throw new Error("Automatic backup enabling was cancelled.");
        try { await dependencies.secretStore.write(passphrase); }
        catch {
          if (consent === consentGeneration) {
            resumeBlocked = true;
            try { await dependencies.secretStore.remove(); } catch { /* The failed enable remains disabled. */ }
            publish("error", 0, "storage-error");
          }
          throw new Error("The secure local backup key could not be saved.");
        }
        if (consent !== consentGeneration || disposed) throw new Error("Automatic backup enabling was cancelled.");
        enabled = true; resumeBlocked = false; lastFingerprint = null; lastAccountScope = null;
        publish("idle");
      });
    },
    async disable(): Promise<void> {
      const consent = ++consentGeneration;
      enabled = false; resumeBlocked = true; cancelWork(); publish("disabled");
      await keyOperation(async () => {
        try { await dependencies.secretStore.remove(); }
        catch {
          if (consent === consentGeneration) publish("error", 0, "storage-error");
          throw new Error("The secure local backup key could not be removed.");
        }
      });
    },
    sync(state: RecoveryState, persistedOptIn?: boolean, journal?: JournalTextBackup): Promise<AutomaticBackupSyncResult> {
      if (persistedOptIn === false) { enabled = false; cancelWork(); publish("disabled"); }
      if (disposed || resumeBlocked || persistedOptIn === false || (!enabled && persistedOptIn !== true)) return Promise.resolve(result("disabled"));
      enabled = true;
      try {
        const exportedAt = new Date(now()).toISOString();
        pending = { state: JSON.parse(JSON.stringify({ ...buildPortableRecoveryState(state, exportedAt), ...(journal ? { journal: validateJournalTextBackup(journal) } : {}) })) as PortableAutomaticBackupState, exportedAt };
      }
      catch { publish("error", 0, "encryption-error"); return Promise.resolve(result("error", 0, "encryption-error")); }
      const promise = new Promise<AutomaticBackupSyncResult>((resolve) => waiters.push({ generation, resolve }));
      publish("queued"); startDrain(); return promise;
    },
    cancel() { cancelWork(); publish(enabled ? "idle" : "disabled"); },
    dispose() { disposed = true; enabled = false; cancelWork(); publish("disabled"); listeners.clear(); },
    getStatus(): AutomaticBackupStatus { return { ...current }; },
    subscribe(listener: (status: AutomaticBackupStatus) => void): () => void {
      listeners.add(listener);
      try { listener({ ...current }); } catch { /* Subscription must not disrupt backup work. */ }
      return () => { listeners.delete(listener); };
    }
  };
}

export function createAutomaticBackupSecureKeyStore(sdk: {
  WHEN_UNLOCKED_THIS_DEVICE_ONLY: number;
  isAvailableAsync(): Promise<boolean>;
  getItemAsync(key: string, options: { keychainService: string; keychainAccessible: number; requireAuthentication: false }): Promise<string | null>;
  setItemAsync(key: string, value: string, options: { keychainService: string; keychainAccessible: number; requireAuthentication: false }): Promise<void>;
  deleteItemAsync(key: string, options: { keychainService: string; keychainAccessible: number; requireAuthentication: false }): Promise<void>;
}, ownerUid?: string): AutomaticBackupSecretStore {
  const key = ownerUid ? `FREED.automatic-backup.passphrase.v2.${Array.from(ownerUid).map(c => c.charCodeAt(0).toString(16).padStart(4, '0')).join('')}` : "FREED.automatic-backup.passphrase.v1";
  const options = { keychainService: "app.freed.recovery.automatic-backup.v1", keychainAccessible: sdk.WHEN_UNLOCKED_THIS_DEVICE_ONLY, requireAuthentication: false as const };
  const available = async () => { if (!(await sdk.isAvailableAsync())) throw new Error("Secure local backup storage is unavailable."); };
  return {
    read: async () => { await available(); return sdk.getItemAsync(key, options); },
    write: async (value) => { await available(); await sdk.setItemAsync(key, value, options); },
    remove: async () => { await available(); await sdk.deleteItemAsync(key, options); }
  };
}

function usablePassphrase(value: string): boolean { return typeof value === "string" && value.trim().length >= 8 && value.length <= 512; }
function canonicalValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalValue);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).sort(([left], [right]) => left.localeCompare(right)).map(([key, child]) => [key, canonicalValue(child)]));
  return value;
}
function abortableWait(milliseconds: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) { reject(new Error("Backup cancelled.")); return; }
    const abort = () => { clearTimeout(timer); signal.removeEventListener("abort", abort); reject(new Error("Backup cancelled.")); };
    const timer = setTimeout(() => { signal.removeEventListener("abort", abort); resolve(); }, milliseconds);
    signal.addEventListener("abort", abort, { once: true });
  });
}

export type AutomaticBackupRuntime = {
  enable(passphrase: string, ownerUid?: string): Promise<void>;
  disable(ownerUid?: string): Promise<void>;
  sync(state: RecoveryState, journal?: JournalTextBackup, ownerUid?: string): Promise<AutomaticBackupSyncResult>;
  cancel(): void;
  getStatus(): AutomaticBackupStatus;
  subscribe(listener: (status: AutomaticBackupStatus) => void): () => void;
};

let runtime: AutomaticBackupRuntime | null = null;
let runtimePromise: Promise<AutomaticBackupRuntime> | null = null;
let entryConsentGeneration = 0;
const ownerEntryConsent = new Map<string, number>();
let entryWorkGeneration = 0;
let entryStatus: AutomaticBackupStatus = { phase: "disabled", enabled: false, attempts: 0, lastSyncedAt: null };
const entryListeners = new Set<(status: AutomaticBackupStatus) => void>();

function publishEntryStatus(status: AutomaticBackupStatus) {
  entryStatus = { ...status };
  for (const listener of entryListeners) { try { listener({ ...entryStatus }); } catch { /* UI observers are isolated. */ } }
}

function loadAutomaticBackupRuntime(): Promise<AutomaticBackupRuntime> {
  if (!runtimePromise) {
    runtimePromise = import("./automatic-backup-runtime").then((module) => {
      runtime = module.getAutomaticBackupRuntime();
      runtime.subscribe(publishEntryStatus);
      return runtime;
    }).catch(() => {
      runtimePromise = null;
      publishEntryStatus({ phase: "unavailable", enabled: false, attempts: 0, lastSyncedAt: entryStatus.lastSyncedAt, reason: "unsupported", message: MESSAGES.unsupported });
      throw new Error(MESSAGES.unsupported);
    });
  }
  return runtimePromise;
}

export async function enableAutomaticBackup(passphrase: string, ownerUid?: string): Promise<void> {
  if (!usablePassphrase(passphrase)) throw new Error("Use a backup passphrase of 8 to 512 characters.");
  const consent = ownerUid ? (ownerEntryConsent.get(ownerUid) ?? 0) + 1 : ++entryConsentGeneration;
  if (ownerUid) ownerEntryConsent.set(ownerUid, consent);
  const loaded = await loadAutomaticBackupRuntime();
  if (consent !== (ownerUid ? ownerEntryConsent.get(ownerUid) : entryConsentGeneration)) throw new Error("Automatic backup enabling was cancelled.");
  await loaded.enable(passphrase, ownerUid);
}

export async function disableAutomaticBackup(ownerUid?: string): Promise<void> {
  if (ownerUid) ownerEntryConsent.set(ownerUid, (ownerEntryConsent.get(ownerUid) ?? 0) + 1);
  else {
    entryConsentGeneration += 1;
    entryWorkGeneration += 1;
    runtime?.cancel();
    publishEntryStatus({ phase: "disabled", enabled: false, attempts: 0, lastSyncedAt: entryStatus.lastSyncedAt });
  }
  await (await loadAutomaticBackupRuntime()).disable(ownerUid);
}

export async function syncAutomaticRecoveryBackup(state: RecoveryState, journal?: JournalTextBackup, ownerUid?: string): Promise<AutomaticBackupSyncResult> {
  if ((state as RecoveryState & { automaticBackupEnabled?: boolean }).automaticBackupEnabled !== true && !runtime) {
    return { ok: false, status: "disabled", attempts: 0, lastSyncedAt: entryStatus.lastSyncedAt };
  }
  const epoch = entryWorkGeneration;
  let loaded: AutomaticBackupRuntime;
  try { loaded = await loadAutomaticBackupRuntime(); }
  catch { return { ok: false, status: "unavailable", attempts: 0, lastSyncedAt: entryStatus.lastSyncedAt, reason: "unsupported" }; }
  if (epoch !== entryWorkGeneration) return { ok: false, status: "cancelled", attempts: 0, lastSyncedAt: entryStatus.lastSyncedAt };
  return loaded.sync(state, journal, ownerUid);
}

export function cancelAutomaticBackupSync(): void {
  entryWorkGeneration += 1;
  runtime?.cancel();
}

export function getAutomaticBackupStatus(): AutomaticBackupStatus { return { ...entryStatus }; }
export function subscribeAutomaticBackupStatus(listener: (status: AutomaticBackupStatus) => void): () => void {
  entryListeners.add(listener);
  try { listener({ ...entryStatus }); } catch { /* UI observers are isolated. */ }
  return () => { entryListeners.delete(listener); };
}
