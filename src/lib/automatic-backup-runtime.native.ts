import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';
import { getApp } from '@react-native-firebase/app';
import { getAuth } from '@react-native-firebase/auth';
import { createAutomaticBackupController, createAutomaticBackupSecureKeyStore, type AutomaticBackupRuntime, type AutomaticBackupStatus } from './automatic-backup';
import { createEncryptedRecoveryBackup } from './recovery-backup';
import { uploadSerializedEncryptedRecoveryBackup } from './recovery-backup-client-sync';
import { getFirebaseNativeAuthAdapter } from './firebase-native';

function currentAccountScope(): string | null {
  try { const user = getAuth(getApp()).currentUser; return user && !user.isAnonymous ? user.uid : null; } catch { return null; }
}
const controllers = new Map<string, ReturnType<typeof createAutomaticBackupController>>();
const listeners = new Set<(status: AutomaticBackupStatus) => void>();
let activeOwner: string | null = null;
const disabled = (): AutomaticBackupStatus => ({ phase: 'disabled', enabled: false, attempts: 0, lastSyncedAt: null });
function getController(owner: string) {
  let controller = controllers.get(owner); if (controller) return controller;
  controller = createAutomaticBackupController({
    // Legacy unclaimed/global keys are intentionally never read for an account.
    secretStore: createAutomaticBackupSecureKeyStore(SecureStore, owner),
    getAccountScope: () => currentAccountScope() === owner ? owner : null,
    fingerprint: portable => Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, portable, { encoding: Crypto.CryptoEncoding.HEX }),
    encrypt: (portable, secret, exportedAt) => createEncryptedRecoveryBackup({ ...portable, premiumEntitlement: null }, secret, exportedAt, portable.journal),
    upload: (ciphertext, { signal, accountScope }) => uploadSerializedEncryptedRecoveryBackup(ciphertext, { signal, getAuthToken: async () => {
      if (currentAccountScope() !== owner || accountScope !== owner || signal.aborted) return null;
      const token = await getFirebaseNativeAuthAdapter().getCurrentIdToken(); return currentAccountScope() === owner && !signal.aborted ? token : null;
    } }), maxAttempts: 3
  });
  controller.subscribe(status => { if (activeOwner === owner) listeners.forEach(listener => listener(status)); });
  controllers.set(owner, controller); return controller;
}
function select(owner: string) { if (activeOwner !== owner) { for (const controller of controllers.values()) controller.cancel(); activeOwner = owner; } return getController(owner); }
const runtime: AutomaticBackupRuntime = {
  enable: async (passphrase, ownerUid) => { const owner = currentAccountScope(); if (!owner || (ownerUid && ownerUid !== owner)) throw new Error('Connect the original account before enabling automatic backup.');
    const controller = select(owner); await controller.enable(passphrase); if (currentAccountScope() !== owner) { controller.cancel(); throw new Error('The backup owner changed. Confirm your account and try again.'); } },
  disable: async ownerUid => { const owner = ownerUid ?? activeOwner ?? currentAccountScope(); if (owner) await getController(owner).disable(); },
  sync: (state, journal, ownerUid) => { const owner = currentAccountScope(); if (ownerUid && ownerUid !== owner) return Promise.resolve({ ok: false, status: 'cancelled', attempts: 0, lastSyncedAt: null }); return owner ? select(owner).sync(state, state.automaticBackupEnabled === true, journal)
    : Promise.resolve({ ok: false, status: 'unavailable', reason: 'signed-out', attempts: 0, lastSyncedAt: null }); },
  cancel: () => { for (const controller of controllers.values()) controller.cancel(); },
  getStatus: () => activeOwner && currentAccountScope() === activeOwner ? getController(activeOwner).getStatus() : disabled(),
  subscribe: listener => { listeners.add(listener); listener(runtime.getStatus()); return () => { listeners.delete(listener); }; }
};
/** Lazy native runtime: secrets and pending work are isolated by the original account. Never creates a guest. */
export function getAutomaticBackupRuntime(): AutomaticBackupRuntime { return runtime; }
