import type { FirebaseNotificationOpenOptions } from "./firebase-notification-flow";
import { INITIAL_JOURNEY_AUTH, type JourneyAuthSnapshot } from './user-journey';
import {
  createFirebaseAuthAdapter,
  createFirebaseCallableContracts,
  summarizeFirebaseAccount,
  type FirebaseAccountSummary,
  type FirebaseAuthNativeApi,
  type FirebaseMessagingRegistration
} from "@/lib/firebase-client";

export type FirebaseStartupResult = {
  status: "started" | "unconfigured" | "unsupported" | "error";
  reason?: string;
};

export type FirebaseBackendReadinessCallableResult = {
  ok: boolean;
  acceptsRecoveryContent: false;
  projectRegion: "asia-south1";
  appCheckRequired: true;
};

const WEB_UNSUPPORTED_REASON = "Firebase native modules require an iOS or Android custom build.";

/**
 * Web must never initialize or impersonate the native Firebase product. This
 * adapter preserves the public Auth shape while refusing every operation.
 */
const unsupportedWebAuthApi: FirebaseAuthNativeApi = {
  sendSignInLinkToEmail: async () => {
    throw new Error(WEB_UNSUPPORTED_REASON);
  },
  isSignInWithEmailLink: () => false,
  signInWithEmailLink: async () => {
    throw new Error(WEB_UNSUPPORTED_REASON);
  },
  createGoogleCredential: () => null,
  createAppleCredential: () => null,
  signInWithCredential: async () => {
    throw new Error(WEB_UNSUPPORTED_REASON);
  },
  currentUser: () => null
};

export async function startFirebaseClient(): Promise<FirebaseStartupResult> {
  return { status: "unsupported", reason: WEB_UNSUPPORTED_REASON };
}

export function getFirebaseNativeAuthAdapter() {
  return createFirebaseAuthAdapter(unsupportedWebAuthApi);
}

const webNativeSession=Object.freeze({status:'unavailable' as const,reason:WEB_UNSUPPORTED_REASON,admission:null,revision:0});
export const getFirebaseNativeAccountSessionSnapshot=()=>webNativeSession;
export const subscribeFirebaseNativeAccountSession=(_listener:()=>void)=>()=>undefined;
export const getFirebaseNativeAccountAdmission=()=>null;
export const retireFirebaseNativeAccountSession=(_reason?:string)=>undefined;
export const reconcileFirebaseNativeAccountSession=async()=>null;
export const withFirebaseNativeAccountCleanup=async<T>(_uid:string,_current:()=>boolean,_work:(admission:import('../../modules/freed-protection/src/native-account-contract').NativeAccountAdmission,current:()=>boolean,prepare:(scope:string,handle:string)=>Promise<import('../../modules/freed-protection/src/native-account-contract').NativeCleanupReceipt|null>)=>Promise<T>):Promise<T|null>=>null;
const webAuthSnapshot: JourneyAuthSnapshot = { ...INITIAL_JOURNEY_AUTH, status: "unavailable", reason: WEB_UNSUPPORTED_REASON };
export function getFirebaseAuthSnapshot(): JourneyAuthSnapshot { return webAuthSnapshot; }
export function subscribeFirebaseAuthSnapshot(_listener: () => void): () => void { return () => undefined; }
export function retryFirebaseAuthSnapshot(): void { /* Native service cannot be restored on web. */ }

export function getFirebaseAccountSummary(): FirebaseAccountSummary { return summarizeFirebaseAccount(null); }
export function getFirebaseAccountScope(): string | null { return null; }
export function stopFirebasePushTokenRotation(): void { /* No native token subscription exists on web. */ }
export function listenFirebaseNotificationOpens(_onCheckIn: () => void, _options: FirebaseNotificationOpenOptions = {}): () => void { return () => undefined; }

export async function getFirebaseMessagingRegistrationAfterPermission(
  _notificationsAuthorized: boolean
): Promise<FirebaseMessagingRegistration | null> {
  return null;
}

export async function registerFirebasePushTokenAfterPermission(
  _notificationsAuthorized: boolean,
  _options: { ensureGuest?: boolean } = {}
): Promise<{ status: "unavailable" }> {
  return { status: "unavailable" };
}

export async function callFirebaseBackendReadiness(): Promise<FirebaseBackendReadinessCallableResult | null> {
  return null;
}

export async function ensureFirebaseGuestSession(): Promise<never> { throw new Error(WEB_UNSUPPORTED_REASON); }
export async function signOutFirebaseAccount(): Promise<void> { /* Web has no native session. */ }
export async function revokeAppleAuthorizationForDeletion(): Promise<void> { /* Web has no Apple identity. */ }

export async function getFirebaseCallableContracts(_options: { ensureGuest?: boolean } = {}): Promise<ReturnType<typeof createFirebaseCallableContracts> | null> {
  return null;
}
