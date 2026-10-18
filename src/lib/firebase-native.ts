import { createAuthSnapshotObserver, type JourneyAuthSnapshot } from './user-journey';
import { Platform } from "react-native";
import Constants from 'expo-constants';
import { getApp } from "@react-native-firebase/app";
import {
  AppleAuthProvider,
  getAuth,
  connectAuthEmulator,
  GoogleAuthProvider,
  isSignInWithEmailLink,
  sendSignInLinkToEmail,
  signInWithCredential,
  signInWithEmailLink,
  signInAnonymously,
  linkWithCredential,
  reauthenticateWithCredential,
  signOut,
  EmailAuthProvider,
  revokeToken,
  OAuthProvider,
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  sendEmailVerification,
  reload
} from "@react-native-firebase/auth";
import { initializeAppCheck, ReactNativeFirebaseAppCheckProvider } from "@react-native-firebase/app-check";
import { connectFunctionsEmulator, getFunctions, httpsCallable } from "@react-native-firebase/functions";
import { getInstallations, getId } from "@react-native-firebase/installations";
import {
  AuthorizationStatus, getInitialNotification, getMessaging, getToken, hasPermission,
  isDeviceRegisteredForRemoteMessages, onNotificationOpenedApp, onTokenRefresh, registerDeviceForRemoteMessages
} from "@react-native-firebase/messaging";
import crashlyticsModule from "@react-native-firebase/crashlytics";
import perfModule from "@react-native-firebase/perf";
import remoteConfigModule from "@react-native-firebase/remote-config";
import { randomUUID } from "expo-crypto";
import {createNativeAccountSessionCoordinator} from "./native-account-session";
import {createNativeAccountSession} from "freed-protection";
import { configureFocusShieldRollout } from "freed-protection";
import { firebaseEmulatorRouting } from './firebase-emulator-routing';

import {
  createFirebaseAuthAdapter,
  createFirebaseCallableContracts,
  createFirebaseClientEventId,
  getFirebaseAppCheckProviderConfig,
  getFirebaseClientReadiness,
  getFirebaseEmailLinkReadiness,
  getFirebaseMessagingRegistrationContract,
  summarizeFirebaseAccount,
  type FirebaseAccountSummary,
  type FirebaseAuthNativeApi,
  type FirebaseMessagingRegistration
} from "@/lib/firebase-client";
import { AuthIdentityFlowError, createAuthIdentityCoordinator } from "@/lib/social-auth-flow";
import { configureFirebaseFeatureProviders } from "@/lib/firebase-feature-runtime";
import { createWebsiteRecoveryAlertInbox } from "@/lib/website-recovery-alert";
import { createFirebaseNotificationOpenListener, createFirebasePushTokenController, type FirebaseNotificationOpenOptions } from "@/lib/firebase-notification-flow";

let identityCoordinator: ReturnType<typeof createNativeIdentityCoordinator> | null = null;

function createNativeIdentityCoordinator() {
  const auth = getConfiguredAuth();
  return createAuthIdentityCoordinator<unknown, NonNullable<typeof auth.currentUser>>({
    currentUser: () => auth.currentUser,
    signInAnonymously: () => signInAnonymously(auth),
    signInWithCredential: (credential: unknown) => signInWithCredential(auth, credential as never),
    createEmailCredential: (email, password) => EmailAuthProvider.credential(email, password),
    createUserWithEmailAndPassword: (email, password) => createUserWithEmailAndPassword(auth, email, password),
    signInWithProvider: () => runAndroidApple("sign-in"),
    linkWithProvider: (user) => runAndroidApple("link", user.uid),
    reauthenticateWithProvider: (user, provider) => runAndroidApple("reauthenticate", user.uid,
      typeof provider === "object" && provider !== null && "revoke" in provider && provider.revoke === true),
    beforeLink: async (user) => {
      if (auth.currentUser?.uid !== user.uid) throw new AuthIdentityFlowError("user-changed");
      const contracts = await getFirebaseCallableContracts();
      if (!contracts) throw new AuthIdentityFlowError("link-unavailable");
      const result = await contracts.fencePurchaseAccountLink();
      if (result?.ok !== true || auth.currentUser?.uid !== user.uid) throw new AuthIdentityFlowError("link-unavailable");
    },
    linkWithCredential: (user: NonNullable<typeof auth.currentUser>, credential: unknown) => linkWithCredential(user, credential as never),
    reauthenticateWithCredential: (user: NonNullable<typeof auth.currentUser>, credential: unknown) => reauthenticateWithCredential(user, credential as never),
    signOut: () => signOut(auth)
  });
}

function getIdentityCoordinator() {
  return identityCoordinator ??= createNativeIdentityCoordinator();
}

export async function ensureFirebaseGuestSession() {
  if (Platform.OS === "web" || (await startFirebaseClient()).status !== "started") {
    throw new Error("Firebase checkout is unavailable in this build.");
  }
  return getIdentityCoordinator().ensureGuest();
}

export async function signOutFirebaseAccount() {
  nativeAccountSession.invalidate('native-account-sign-out');
  stopFirebasePushTokenRotation();
  try { await getIdentityCoordinator().signOut(); }
  catch(error) { await nativeAccountSession.retry(); throw error; }
}

function appleOAuthProvider() {
  return new OAuthProvider("apple.com").addScope("email").addScope("name");
}

async function runAndroidApple(action: "sign-in" | "link" | "reauthenticate", expectedUid?: string, revoke = false) {
  if (Platform.OS !== "android") throw new AuthIdentityFlowError("unavailable");
  const { getFreedAppleAuthModule } = await import("../../modules/freed-apple-auth");
  const native = getFreedAppleAuthModule();
  const result = action === "sign-in" ? await native.signIn()
    : action === "link" ? await native.link(expectedUid!)
    : revoke ? await native.reauthenticateAndRevoke(expectedUid!) : await native.reauthenticate(expectedUid!);
  if (expectedUid && result.uid !== expectedUid) throw new AuthIdentityFlowError("user-changed");
  if (revoke && result.revoked !== true) throw new Error("Apple authorization revocation could not be confirmed. Check account service configuration and try again.");
  const auth = getConfiguredAuth();
  // Firebase's native listener and the Expo result use different event queues.
  // Await the existing auth observer before the coordinator confirms the UID.
  const user = auth.currentUser?.uid === result.uid ? auth.currentUser : await new Promise<NonNullable<typeof auth.currentUser>>((resolve, reject) => {
    let unsubscribe: (() => void) | null = null;
    let completed = false;
    const timeout = setTimeout(() => { unsubscribe?.(); reject(new AuthIdentityFlowError("user-changed")); }, 5_000);
    unsubscribe = onAuthStateChanged(auth, (current) => {
      if (current?.uid !== result.uid) return;
      completed = true;
      clearTimeout(timeout);
      unsubscribe?.();
      resolve(current);
    });
    if (completed) unsubscribe();
  });
  return { user };
}

export async function revokeAppleAuthorizationForDeletion() {
  const auth = getConfiguredAuth();
  const current = auth.currentUser;
  if (!current?.providerData.some(provider => provider.providerId === "apple.com")) return;
  if (Platform.OS === "android") {
    // Firebase Auth 24.1+ exposes revokeAccessToken on Android. The native
    // module captures a fresh Apple grant and revokes it inside the same queue.
    const reauthenticated = await getIdentityCoordinator().reauthenticateWithProvider({ revoke: true });
    if (!reauthenticated.ok) throw new Error(reauthenticated.message);
    if (auth.currentUser?.uid !== current.uid) throw new AuthIdentityFlowError("user-changed");
    return;
  }
  if (Platform.OS !== "ios") throw new Error("Apple account confirmation requires the native FREED app.");
  const originalUid = current.uid;
  const confirmation = await getIdentityCoordinator().performCurrentAccountAction(originalUid, async (user) => {
    const { signInWithApple } = await import("@/lib/social-login");
    const result = await signInWithApple();
    if (!result.ok || result.token.provider !== "apple" || !result.token.authorizationCode) {
      throw new Error("Confirm Apple sign-in to finish deleting your account.");
    }
    if (auth.currentUser?.uid !== originalUid) throw new AuthIdentityFlowError("user-changed");
    const credential = AppleAuthProvider.credential(result.token.identityToken, result.token.nonce);
    const reauthenticated = await reauthenticateWithCredential(user, credential);
    if (reauthenticated.user.uid !== originalUid || auth.currentUser?.uid !== originalUid) throw new AuthIdentityFlowError("user-changed");
    await revokeToken(auth, result.token.authorizationCode);
  });
  if (!confirmation.ok) throw new Error(confirmation.message);
}

export async function completeAppleRevocation(): Promise<void> {
  await revokeAppleAuthorizationForDeletion();
}

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

let startupPromise: Promise<FirebaseStartupResult> | null = null;
let appCheckPromise: Promise<void> | null = null;
let functionsEmulatorConnected = false;
let authEmulatorConnected = false;
function getEmulatorRouting() {
  const debugBuild = Platform.OS === 'ios' ? Constants.debugMode === true : typeof __DEV__ !== 'undefined' && __DEV__;
  return firebaseEmulatorRouting(process.env.EXPO_PUBLIC_FIREBASE_USE_EMULATORS === 'true', debugBuild, Platform.OS);
}
function getConfiguredAuth() {
  const auth = getAuth(getApp()); const routing = getEmulatorRouting();
  if (routing && !authEmulatorConnected) { connectAuthEmulator(auth, routing.authUrl); authEmulatorConnected = true; }
  return auth;
}
const FIREBASE_CALLABLE_TIMEOUT_MS = 10_000;

export type FirebasePushRegistrationStatus = {
  status: "registered" | "permission-not-authorized" | "unavailable" | "error";
};

/**
 * Native-only service initialization. It deliberately does not write Firestore
 * or Storage, attach a Firebase UID to crash reports, or log recovery content.
 */
export function startFirebaseClient(): Promise<FirebaseStartupResult> {
  if (!startupPromise) startupPromise = initializeFirebaseClient();
  return startupPromise;
}

export function getFirebaseNativeAuthAdapter() {
  const emailLinkReadiness = getFirebaseEmailLinkReadiness();
  return createFirebaseAuthAdapter(firebaseAuthNativeApi(), {
    emailLinkReady: emailLinkReadiness.ready,
    emailLinkDomain: emailLinkReadiness.linkDomain ?? undefined
  });
}

const nativeAccountSession=createNativeAccountSessionCoordinator({create:createNativeAccountSession,sdkOwner:getFirebaseAccountScope,observed:()=>journeyAuthObserver.getSnapshot(),uuid:randomUUID});
export const getFirebaseNativeAccountSessionSnapshot=nativeAccountSession.getSnapshot;
export const subscribeFirebaseNativeAccountSession=nativeAccountSession.subscribe;
export const getFirebaseNativeAccountAdmission=nativeAccountSession.getAdmission;
export const retireFirebaseNativeAccountSession=nativeAccountSession.invalidate;
export const reconcileFirebaseNativeAccountSession=nativeAccountSession.retry;
export const withFirebaseNativeAccountCleanup=nativeAccountSession.withCleanupAdmission;
const journeyAuthObserver = createAuthSnapshotObserver(listener => {
  if (Platform.OS === "web") throw new Error("Native account service unavailable.");
  if (!getFirebaseClientReadiness().ready) throw new Error("Firebase account service is not configured.");
  const auth = getConfiguredAuth();
  return onAuthStateChanged(auth, user => {
    const account = summarizeFirebaseAccount(user);
    // Ignore a superseded queued event after a sign-out or identity switch.
    if ((user?.uid ?? null) !== (auth.currentUser?.uid ?? null)) return;
    listener({ status: "ready", signedIn: account.signedIn, anonymous: account.anonymous,
      ownerUid: account.signedIn ? user?.uid ?? null : null, email: account.email });
  });
}, 8_000, next => { void nativeAccountSession.observe(next); });
export function getFirebaseAuthSnapshot(): JourneyAuthSnapshot { return journeyAuthObserver.getSnapshot(); }
export function subscribeFirebaseAuthSnapshot(listener: () => void): () => void { return journeyAuthObserver.subscribe(listener); }
export function retryFirebaseAuthSnapshot(): void { journeyAuthObserver.retry(); }

export function getFirebaseAccountSummary(): FirebaseAccountSummary {
  if (Platform.OS === "web") return summarizeFirebaseAccount(null);
  try { return summarizeFirebaseAccount(getConfiguredAuth().currentUser); }
  catch { return summarizeFirebaseAccount(null); }
}

/** Used only to discard stale account-scoped requests; never persisted or displayed. */
export function getFirebaseAccountScope(): string | null {
  if (Platform.OS === "web") return null;
  try { return getConfiguredAuth().currentUser?.uid ?? null; }
  catch { return null; }
}

let pushTokenController: ReturnType<typeof createFirebasePushTokenController> | null = null;
let pushConsentEpoch = 0;
const notificationOpenIds = new Set<string>();
const websiteRecoveryOpenInbox = createWebsiteRecoveryAlertInbox({ seenMessageIds: notificationOpenIds });

async function firebaseNotificationPermissionGranted(): Promise<boolean> {
  if (Platform.OS === "web") return false;
  try { return await hasPermission(getMessaging(getApp())) === AuthorizationStatus.AUTHORIZED; }
  catch { return false; }
}

function getPushTokenController() {
  if (pushTokenController) return pushTokenController;
  const app = getApp();
  const auth = getConfiguredAuth();
  const messaging = getMessaging(app);
  pushTokenController = createFirebasePushTokenController({
    permissionGranted: firebaseNotificationPermissionGranted,
    currentUid: () => auth.currentUser?.uid ?? null,
    prepareDevice: async () => {
      if (!isDeviceRegisteredForRemoteMessages(messaging)) await registerDeviceForRemoteMessages(messaging);
    },
    getToken: () => getToken(messaging),
    getInstallationId: () => getId(getInstallations(app)),
    onTokenRefresh: (listener) => onTokenRefresh(messaging, listener),
    register: async (registration, uid) => {
      if (auth.currentUser?.uid !== uid) return false;
      const contracts = await getFirebaseCallableContracts();
      if (!contracts || auth.currentUser?.uid !== uid || !(await firebaseNotificationPermissionGranted())) return false;
      if (auth.currentUser?.uid !== uid) return false;
      const result = await contracts.registerPushToken({ ...registration, clientEventId: createFirebaseClientEventId("push") });
      return result.ok === true;
    }
  });
  return pushTokenController;
}

export function stopFirebasePushTokenRotation(): void {
  pushConsentEpoch += 1;
  pushTokenController?.stop();
}

export function listenFirebaseNotificationOpens(onCheckIn: () => void, options: FirebaseNotificationOpenOptions = {}): () => void {
  if (Platform.OS === "web") return () => undefined;
  try {
    const messaging = getMessaging(getApp());
    return createFirebaseNotificationOpenListener({
      permissionGranted: firebaseNotificationPermissionGranted,
      getInitialNotification: () => getInitialNotification(messaging),
      onNotificationOpened: (listener) => onNotificationOpenedApp(messaging, listener),
      seenMessageIds: notificationOpenIds,
      websiteRecoveryInbox: websiteRecoveryOpenInbox
    }, onCheckIn, options);
  } catch { return () => undefined; }
}

export async function getFirebaseMessagingRegistrationAfterPermission(
  notificationsAuthorized: boolean
): Promise<FirebaseMessagingRegistration | null> {
  if (!notificationsAuthorized || Platform.OS === "web") return null;

  const app = getApp();
  if (!getConfiguredAuth().currentUser || !(await firebaseNotificationPermissionGranted())) return null;
  const messaging = getMessaging(app);
  if (!isDeviceRegisteredForRemoteMessages(messaging)) {
    await registerDeviceForRemoteMessages(messaging);
  }

  const [installationId, token] = await Promise.all([
    getId(getInstallations(app)),
    getToken(messaging)
  ]);
  return getFirebaseMessagingRegistrationContract({ installationId, token });
}

/**
 * Registers an FCM token only after another user-initiated flow has confirmed
 * OS notification authorization. This helper never requests permission.
 */
export async function registerFirebasePushTokenAfterPermission(
  notificationsAuthorized: boolean,
  options: { ensureGuest?: boolean } = {}
): Promise<FirebasePushRegistrationStatus> {
  if (!notificationsAuthorized) { stopFirebasePushTokenRotation(); return { status: "permission-not-authorized" }; }
  if (Platform.OS === "web") return { status: "unavailable" };
  const epoch = pushConsentEpoch;

  try {
    if ((await startFirebaseClient()).status !== "started" || epoch !== pushConsentEpoch) return { status: "unavailable" };
    if (!(await firebaseNotificationPermissionGranted())) { stopFirebasePushTokenRotation(); return { status: "permission-not-authorized" }; }
    if (options.ensureGuest === true && !getFirebaseAccountScope()) await ensureFirebaseGuestSession();
    if (epoch !== pushConsentEpoch || !getFirebaseAccountScope()) return { status: "unavailable" };
    return await getPushTokenController().start(true);
  } catch {
    return { status: "error" };
  }
}

/**
 * Calls the deployed Auth + App Check protected readiness endpoint only after
 * native App Check initialization. Authentication/App Check errors propagate
 * rather than being converted into a less-protected fallback request.
 */
export async function callFirebaseBackendReadiness(): Promise<FirebaseBackendReadinessCallableResult | null> {
  const readiness = getFirebaseClientReadiness();
  if (!readiness.ready || Platform.OS === "web" || !readiness.functionsRegion) return null;
  const startup = await startFirebaseClient();
  if (startup.status !== "started") return null;
  if (!getConfiguredAuth().currentUser) return null;

  const callable = httpsCallable<undefined, FirebaseBackendReadinessCallableResult>(
    getConfiguredFunctions(),
    "backendReadiness",
    { timeout: FIREBASE_CALLABLE_TIMEOUT_MS }
  );
  const result = await callable(undefined);
  return result.data;
}

/**
 * Callable transport is native-only and region-pinned. Consumers receive the
 * allowlisted contracts from firebase-client rather than raw callable access.
 */
export async function getFirebaseCallableContracts(options: { ensureGuest?: boolean; expectedAccountUid?:string } = {}) {
  const readiness = getFirebaseClientReadiness();
  if (!readiness.ready || Platform.OS === "web") return null;
  const startup = await startFirebaseClient();
  if (startup.status !== "started") return null;
  const nativeAuth = getConfiguredAuth();
  if (options.ensureGuest && !nativeAuth.currentUser) await ensureFirebaseGuestSession();
  if (!nativeAuth.currentUser) return null;
  if(options.expectedAccountUid && nativeAuth.currentUser.uid!==options.expectedAccountUid)return null;
  const accountScope = nativeAuth.currentUser.uid;
  const functions = getConfiguredFunctions();
  return createFirebaseCallableContracts({
    async call(name, data, options): Promise<unknown> {
      const currentStartup = await startFirebaseClient();
      if (currentStartup.status !== "started" || nativeAuth.currentUser?.uid !== accountScope || options?.operationIsCurrent?.()===false) {
        throw new Error("Authenticated Firebase services are unavailable.");
      }
      const callable = httpsCallable<unknown, unknown>(functions, name, {
        timeout: FIREBASE_CALLABLE_TIMEOUT_MS,
        ...(options?.limitedUseAppCheckToken ? { limitedUseAppCheckTokens: true } : {})
      });
      const result = await callable(data);
      if (nativeAuth.currentUser?.uid !== accountScope || options?.operationIsCurrent?.()===false) throw new Error("The recovery account changed. Try this action again.");
      return result.data;
    }
  });
}

async function initializeFirebaseClient(): Promise<FirebaseStartupResult> {
  // Drop stale runtime permission before any startup failure or config fetch.
  if (Platform.OS === "android") await configureFocusShieldRollout(false).catch(() => undefined);
  const readiness = getFirebaseClientReadiness();
  if (!readiness.ready) {
    return { status: "unconfigured", reason: readiness.missing[0] ?? "Firebase is not configured." };
  }
  if (Platform.OS === "web") {
    return { status: "unsupported", reason: "Firebase native modules require an iOS or Android custom build." };
  }

  try {
    if (getEmulatorRouting()) {
      getConfiguredAuth(); getConfiguredFunctions();
      configureFirebaseFeatureProviders(expectedAccountUid => getFirebaseCallableContracts({ ensureGuest: false,expectedAccountUid }));
      return { status: 'started' };
    }
    await initializeFirebaseAppCheck();
    configureFirebaseFeatureProviders(expectedAccountUid => getFirebaseCallableContracts({ ensureGuest: false,expectedAccountUid }));
    const crashlytics = crashlyticsModule();
    const performance = perfModule();
    const remoteConfig = remoteConfigModule();

    // No user ID, custom attributes, or user-entered recovery text is attached.
    await Promise.allSettled([
      crashlytics.setCrashlyticsCollectionEnabled(false),
      performance.setPerformanceCollectionEnabled(false),
      remoteConfig.setConfigSettings({
        minimumFetchIntervalMillis: 12 * 60 * 60 * 1000
      }),
      remoteConfig.setDefaults({
        firebase_foundation_enabled: false,
        app_check_enforcement_enabled: false,
        android_surface_interception_enabled: false
      })
    ]);
    void remoteConfig.fetchAndActivate().then(async () => {
      if (Platform.OS !== "android") return;
      const rollout = remoteConfig.getValue("android_surface_interception_enabled");
      await configureFocusShieldRollout(rollout.getSource() === "remote" && rollout.asBoolean());
    }).catch(() => undefined);
    getConfiguredFunctions();

    return { status: "started" };
  } catch {
    return { status: "error", reason: "Firebase native startup could not complete." };
  }
}

function initializeFirebaseAppCheck() {
  if (getEmulatorRouting()) return Promise.resolve();
  if (!appCheckPromise) {
    const readiness = getFirebaseClientReadiness();
    const android = getFirebaseAppCheckProviderConfig("android", readiness);
    const apple = getFirebaseAppCheckProviderConfig("ios", readiness);
    const androidProvider = android.provider === "debug" ? "debug" : "playIntegrity";
    const appleProvider = apple.provider === "debug" ? "debug" : "appAttestWithDeviceCheckFallback";
    const provider = new ReactNativeFirebaseAppCheckProvider();
    provider.configure({
      android: {
        provider: androidProvider,
        ...(android.debugToken ? { debugToken: android.debugToken } : {})
      },
      apple: {
        provider: appleProvider,
        ...(apple.debugToken ? { debugToken: apple.debugToken } : {})
      }
    });
    appCheckPromise = initializeAppCheck(getApp(), {
      provider,
      isTokenAutoRefreshEnabled: true
    }).then(() => undefined);
  }
  return appCheckPromise;
}

function getConfiguredFunctions() {
  const readiness = getFirebaseClientReadiness();
  const functions = getFunctions(getApp(), readiness.functionsRegion ?? "asia-south1");
  const routing = getEmulatorRouting();
  if (routing && !functionsEmulatorConnected) {
    connectFunctionsEmulator(functions, routing.functionsHost, routing.functionsPort);
    functionsEmulatorConnected = true;
  }
  return functions;
}

function firebaseAuthNativeApi(): FirebaseAuthNativeApi {
  const nativeAuth = getConfiguredAuth();
  return {
    sendSignInLinkToEmail: (email, settings) => sendSignInLinkToEmail(nativeAuth, email, settings),
    isSignInWithEmailLink: (link) => isSignInWithEmailLink(nativeAuth, link),
    signInWithEmailLink: async (email, link) => {
      const credential = EmailAuthProvider.credentialWithLink(email, link);
      const result = await getIdentityCoordinator().signInWithCredential(credential);
      if (!result.ok) throw new AuthIdentityFlowError(result.reason);
      return { user: result.user };
    },
    createGoogleCredential: (idToken, accessToken) => GoogleAuthProvider.credential(idToken, accessToken),
    createAppleCredential: (identityToken, nonce) => AppleAuthProvider.credential(identityToken, nonce),
    createEmailCredential: (email, password) => EmailAuthProvider.credential(email, password),
    createEmailLinkCredential: (email, link) => EmailAuthProvider.credentialWithLink(email, link),
    createEmailAccount: async (email, password) => {
      const result = await getIdentityCoordinator().createEmailAccount(email, password);
      if (!result.ok) throw new AuthIdentityFlowError(result.reason);
      return { user: result.user };
    },
    sendPasswordResetEmail: (email) => sendPasswordResetEmail(nativeAuth, email),
    sendEmailVerification: (user) => sendEmailVerification(user as never),
    reloadCurrentUser: async (user) => {
      if (nativeAuth.currentUser?.uid !== user.uid) throw new AuthIdentityFlowError("user-changed");
      await reload(nativeAuth.currentUser);
      if (!nativeAuth.currentUser || nativeAuth.currentUser.uid !== user.uid) throw new AuthIdentityFlowError("user-changed");
      return { user: nativeAuth.currentUser };
    },
    signInWithAppleProvider: async (options) => {
      if (Platform.OS !== "android") throw new AuthIdentityFlowError("unavailable");
      const result = await getIdentityCoordinator().signInWithProvider(appleOAuthProvider(), options);
      if (!result.ok) throw new AuthIdentityFlowError(result.reason);
      return { user: result.user };
    },
    signInWithCredential: async (credential) => {
      const result = await getIdentityCoordinator().signInWithCredential(credential);
      if (!result.ok) throw new AuthIdentityFlowError(result.reason);
      return { user: result.user };
    },
    linkWithCredential: async (credential) => {
      const result = await getIdentityCoordinator().linkCurrentCredential(credential);
      if (!result.ok) throw new AuthIdentityFlowError(result.reason);
      return { user: result.user };
    },
    reauthenticateWithCredential: async (credential) => {
      const result = await getIdentityCoordinator().reauthenticateWithCredential(credential);
      if (!result.ok) throw new AuthIdentityFlowError(result.reason);
      return { user: result.user };
    },
    currentUser: () => nativeAuth.currentUser
  };
}
