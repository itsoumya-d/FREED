import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';
import * as Notifications from 'expo-notifications';
import { getApp } from '@react-native-firebase/app';
import { getId, getInstallations } from '@react-native-firebase/installations';
import { recoveryDnsPilot, isNativeAccountActionScopeCurrent } from 'freed-protection';
import type { RecoveryDnsPilotReceipt } from '../../modules/freed-protection/src/recovery-dns-pilot';
import { getFirebaseAccountScope, getFirebaseCallableContracts, registerFirebasePushTokenAfterPermission } from './firebase-native';
import { parseFirebaseRecoveryDnsReceipt } from './firebase-client';
import { createRecoveryDnsEnrollment, type RecoveryDnsPendingEnrollment } from './recovery-dns-enrollment';

const secureOptions = { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY };
const digest = (text: string) => Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, text);
const storageKey = async (owner: string) => `freed.recovery-dns.pending.v1.${await digest(owner)}`;
/** Device-only credentials are intentionally absent from recovery-state, sync, backups and logs. */
export function createRecoveryDnsNativeEnrollment(getActionScope: () => string | null) {
  const currentOwner = () => {
    const ownerId = getFirebaseAccountScope(), actionScope = getActionScope();
    return ownerId && actionScope && isNativeAccountActionScopeCurrent(actionScope) ? { ownerId, actionScope } : null;
  };
  const current = (owner: {ownerId: string; actionScope: string}) => {
    const now = currentOwner(); return now?.ownerId === owner.ownerId && now.actionScope === owner.actionScope;
  };
  const pending = {
    async load(owner: string): Promise<unknown> { const captured = currentOwner(); if (!captured || captured.ownerId !== owner) throw Error('owner-changed'); const key = await storageKey(owner); if (!current(captured)) throw Error('owner-changed'); const value = await SecureStore.getItemAsync(key, secureOptions); if (!current(captured)) throw Error('owner-changed'); return value === null ? null : JSON.parse(value); },
    async save(owner: string, value: RecoveryDnsPendingEnrollment) { const captured = currentOwner(); if (!captured || captured.ownerId !== owner) throw Error('owner-changed'); const key = await storageKey(owner); if (!current(captured)) throw Error('owner-changed'); await SecureStore.setItemAsync(key, JSON.stringify(value), secureOptions); if (!current(captured)) throw Error('owner-changed'); }
  };
  const controller = createRecoveryDnsEnrollment({
    currentOwner, pending,
    installationId: () => getId(getInstallations(getApp())),
    randomHex: async bytes => Array.from(await Crypto.getRandomBytesAsync(bytes), byte => byte.toString(16).padStart(2, '0')).join(''),
    uuid: () => Crypto.randomUUID(), hashSecret: digest,
    enroll: async (request, options) => {
      const owner = currentOwner(); if (!owner || !options.operationIsCurrent()) throw Error('owner-changed');
      const contracts = await getFirebaseCallableContracts({ ensureGuest: false, expectedAccountUid: owner.ownerId });
      if (!contracts || !current(owner) || !options.operationIsCurrent()) throw Error('owner-changed');
      return contracts.enrollRecoveryDns(request, { operationIsCurrent: () => current(owner) && options.operationIsCurrent() });
    },
    stage: input => recoveryDnsPilot.stage(input)
  });
  return {
    currentOwner,
    async enroll(consent: { dnsConsent: boolean; websiteAlertConsent: boolean; retentionAcknowledged: boolean }) {
      const owner = currentOwner();
      const consentSnapshot = { ...consent };
      if (!owner || consentSnapshot.dnsConsent !== true || consentSnapshot.retentionAcknowledged !== true || typeof consentSnapshot.websiteAlertConsent !== 'boolean') return { status: 'error' as const, reason: 'consent-required' };
      if (consentSnapshot.websiteAlertConsent) {
        try {
          const permission = await Notifications.requestPermissionsAsync({ ios: { allowAlert: true, allowBadge: false, allowSound: false } });
          if (!current(owner)) return { status: 'error' as const, reason: 'owner-changed' };
          if (!permission.granted || permission.ios && permission.ios.status !== Notifications.IosAuthorizationStatus.AUTHORIZED) return { status: 'error' as const, reason: 'notification-permission-required' };
          const registered = await registerFirebasePushTokenAfterPermission(true, { ensureGuest: false });
          if (!current(owner)) return { status: 'error' as const, reason: 'owner-changed' };
          if (registered.status !== 'registered') return { status: 'error' as const, reason: 'notification-registration-unavailable' };
        } catch { return { status: 'error' as const, reason: current(owner) ? 'notification-registration-unavailable' : 'owner-changed' }; }
      }
      return controller.enroll({ ...owner, consentVersion: '2026-10-18', dnsConsent: true, websiteAlertConsent: consentSnapshot.websiteAlertConsent, retentionAcknowledged: true });
    },
    async canActivate(): Promise<boolean> {
      const owner = currentOwner(); if (!owner) return false;
      try {
        const stored = await pending.load(owner.ownerId) as RecoveryDnsPendingEnrollment | null;
        if (!current(owner) || !stored || stored.ownerId !== owner.ownerId || stored.request?.websiteAlertConsent !== true || !stored.receipt) return false;
        const permission = await Notifications.getPermissionsAsync();
        if (!current(owner) || !permission.granted || permission.ios && permission.ios.status !== Notifications.IosAuthorizationStatus.AUTHORIZED) return false;
        const registered = await registerFirebasePushTokenAfterPermission(true, { ensureGuest: false });
        return current(owner) && registered.status === 'registered';
      } catch { return false; }
    },
    /** Same-owner native candidate binding only; this never asserts browser recovery. */
    async status(): Promise<RecoveryDnsPilotReceipt | null> {
      const owner = currentOwner(); if (!owner) return null;
      try {
        const raw = await pending.load(owner.ownerId); if (!current(owner)) return null;
        const local = raw as RecoveryDnsPendingEnrollment | null;
        if (!local || local.version !== 1 || local.ownerId !== owner.ownerId || !local.receipt) return null;
        const receipt = parseFirebaseRecoveryDnsReceipt(local.receipt);
        const native = await recoveryDnsPilot.status(owner.actionScope); if (!current(owner)) return null;
        return native.staged && native.credentialHash === receipt.credentialHash && native.audience === receipt.audience && native.ownerGeneration === receipt.ownerGeneration ? native : null;
      } catch { return null; }
    }
  };
}
