import {
  createFirebaseAuthAdapter,
  createFirebaseCallableContracts,
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

export async function getFirebaseMessagingRegistrationAfterPermission(
  _notificationsAuthorized: boolean
): Promise<FirebaseMessagingRegistration | null> {
  return null;
}

export async function callFirebaseBackendReadiness(): Promise<FirebaseBackendReadinessCallableResult | null> {
  return null;
}

export function getFirebaseCallableContracts(): ReturnType<typeof createFirebaseCallableContracts> | null {
  return null;
}
