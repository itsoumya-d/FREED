type Env = Record<string, string | undefined>;

export type FirebaseEnvironment = "production" | "staging";
export type FirebaseAppCheckPlatform = "android" | "ios";
export type FirebaseAppCheckProvider = "playIntegrity" | "appAttestWithDeviceCheckFallback" | "debug";
export type FirebaseAuthProvider = "apple" | "google";

export type FirebaseClientReadiness = {
  ready: boolean;
  environment: FirebaseEnvironment | null;
  projectId: string | null;
  functionsRegion: string | null;
  missing: string[];
  appCheckDebugEnabled: boolean;
  appCheckDebugToken: string | undefined;
  dataBoundary: string;
};

export type FirebaseAppCheckProviderConfig = {
  provider: FirebaseAppCheckProvider;
  debugToken: string | undefined;
};

export type FirebaseEmailLinkReadiness = {
  ready: boolean;
  callbackUrl: string;
  linkDomain: string | null;
  missing: string[];
};

export type FirebaseAuthActionResult = {
  ok: boolean;
  status: "sent" | "authenticated" | "invalid" | "error" | "unconfigured";
  reason?: string;
  uid?: string;
};

export type FirebaseNativeUser = {
  uid: string;
  getIdToken: (forceRefresh?: boolean) => Promise<string>;
};

export type FirebaseAuthNativeApi = {
  sendSignInLinkToEmail: (email: string, settings: FirebaseEmailLinkSettings) => Promise<void>;
  isSignInWithEmailLink: (link: string) => boolean | Promise<boolean>;
  signInWithEmailLink: (email: string, link: string) => Promise<{ user: FirebaseNativeUser }>;
  createGoogleCredential: (idToken: string, accessToken?: string) => unknown;
  createAppleCredential: (identityToken: string, nonce?: string) => unknown;
  signInWithCredential: (credential: unknown) => Promise<{ user: FirebaseNativeUser }>;
  currentUser: () => FirebaseNativeUser | null;
};

export type FirebaseEmailLinkSettings = {
  handleCodeInApp: true;
  url: string;
  linkDomain: string;
  android: {
    packageName: "app.freed.recovery";
    installApp: true;
  };
  iOS: {
    bundleId: "app.freed.recovery";
  };
};

export type FirebaseProviderCredentialInput = {
  idToken?: string;
  accessToken?: string;
  identityToken?: string;
  nonce?: string;
};

export type FirebaseMessagingRegistration = {
  installationId: string;
  token: string;
  recoveryContentIncluded: false;
};

const PRODUCTION_PROJECT_ID = "freed-7d5ee";
const STAGING_PROJECT_ID = "freed-staging-7d5ee";
const FUNCTIONS_REGION = "asia-south1";
const APP_CHECK_DEBUG_PROVIDER_ENV = "EXPO_PUBLIC_FIREBASE_APP_CHECK_DEBUG_PROVIDER";
const APP_CHECK_DEBUG_TOKEN_ENV = "EXPO_PUBLIC_FIREBASE_APP_CHECK_DEBUG_TOKEN";
const EMAIL_LINK_ASSOCIATION_READY_ENV = "EXPO_PUBLIC_FIREBASE_EMAIL_LINK_ASSOCIATION_READY";
const EMAIL_LINK_ASSOCIATION_READY_VALUE = "deployed-and-verified";
const EMAIL_LINK_DOMAIN_ENV = "EXPO_PUBLIC_FIREBASE_EMAIL_LINK_DOMAIN";
const FIREBASE_PUBLIC_SECRET_PATTERN = /(?:SERVICE_ACCOUNT|ADMIN|PRIVATE_KEY|SERVER_KEY|ACCESS_TOKEN|GOOGLE_APPLICATION_CREDENTIALS|CREDENTIAL)/i;
export const FIREBASE_EMAIL_LINK_CALLBACK_URL = "https://freed-7d5ee.web.app/auth/callback";
export const FIREBASE_EMAIL_LINK_DOMAIN = "freed-7d5ee.firebaseapp.com";
export const FIREBASE_EMAIL_LINK_PATH = "/__/auth/links";
const EMAIL_LINK_ASSOCIATION_UNCONFIGURED_REASON =
  "Firebase email-link sign-in is unavailable until Hosting app-link association is deployed and verified.";

export function getFirebaseClientReadiness(env: Env = process.env): FirebaseClientReadiness {
  const requestedEnvironment = readEnv(env, "EXPO_PUBLIC_FIREBASE_ENV") ?? "production";
  const environment = isFirebaseEnvironment(requestedEnvironment) ? requestedEnvironment : null;
  const debugProviderEnabled = readEnv(env, APP_CHECK_DEBUG_PROVIDER_ENV) === "enabled";
  const debugToken = readEnv(env, APP_CHECK_DEBUG_TOKEN_ENV);
  const missing = [
    ...(environment ? [] : ["EXPO_PUBLIC_FIREBASE_ENV must be either production or staging"]),
    ...publicFirebaseSecretIssues(env),
    ...(environment === "staging"
      ? [
          `Firebase staging project ${STAGING_PROJECT_ID} is not provisioned (Google project-quota blocker). Do not use production credentials for staging.`
        ]
      : []),
    ...(environment === "production" && debugProviderEnabled
      ? [`${APP_CHECK_DEBUG_PROVIDER_ENV} is forbidden for production builds`]
      : []),
    ...(debugProviderEnabled && !debugToken ? [`${APP_CHECK_DEBUG_TOKEN_ENV} is required when debug App Check is enabled`] : [])
  ];

  return {
    ready: missing.length === 0,
    environment,
    projectId: environment === "production" ? PRODUCTION_PROJECT_ID : environment === "staging" ? STAGING_PROJECT_ID : null,
    functionsRegion: environment ? FUNCTIONS_REGION : null,
    missing,
    appCheckDebugEnabled: Boolean(environment && environment !== "production" && debugProviderEnabled),
    appCheckDebugToken: environment && environment !== "production" && debugProviderEnabled ? debugToken : undefined,
    dataBoundary:
      "Firebase Auth session persistence is native. The client must not create Firestore documents, upload local recovery content, or bundle Firebase Admin credentials. Messaging registration contains only installation and FCM token identifiers."
  };
}

/**
 * Email links are intentionally separate from base Firebase readiness: Auth and
 * provider credentials can be configured while Universal/App Link delivery is
 * still unsafe. The public marker is only set after the generated Hosting
 * associations are deployed and verified against signed native builds.
 */
export function getFirebaseEmailLinkReadiness(env: Env = process.env): FirebaseEmailLinkReadiness {
  const requestedEnvironment = readEnv(env, "EXPO_PUBLIC_FIREBASE_ENV") ?? "production";
  const configuredCallbackUrl = readEnv(env, "EXPO_PUBLIC_FIREBASE_AUTH_CONTINUE_URL");
  const configuredLinkDomain = readEnv(env, EMAIL_LINK_DOMAIN_ENV);
  const associationReady = readEnv(env, EMAIL_LINK_ASSOCIATION_READY_ENV);
  const missing = [
    ...(requestedEnvironment === "production" ? [] : ["Firebase email-link sign-in is only enabled for the production Firebase environment"]),
    ...(configuredCallbackUrl && configuredCallbackUrl !== FIREBASE_EMAIL_LINK_CALLBACK_URL
      ? [`EXPO_PUBLIC_FIREBASE_AUTH_CONTINUE_URL must equal ${FIREBASE_EMAIL_LINK_CALLBACK_URL}`]
      : []),
    ...(isFirebaseEmailLinkDomain(configuredLinkDomain)
      ? []
      : [`${EMAIL_LINK_DOMAIN_ENV} must equal the production-safe Firebase Auth link domain ${FIREBASE_EMAIL_LINK_DOMAIN} without a scheme, path, port, query, or fragment`]),
    ...(associationReady === EMAIL_LINK_ASSOCIATION_READY_VALUE
      ? []
      : [
          `${EMAIL_LINK_ASSOCIATION_READY_ENV} must equal ${EMAIL_LINK_ASSOCIATION_READY_VALUE} only after Hosting association deployment and signed-device verification`
        ])
  ];

  return {
    ready: missing.length === 0,
    callbackUrl: FIREBASE_EMAIL_LINK_CALLBACK_URL,
    linkDomain: isFirebaseEmailLinkDomain(configuredLinkDomain) ? configuredLinkDomain : null,
    missing
  };
}

export function isFirebaseEmailLinkDeliveryUrl(value: string | null | undefined) {
  if (!value) return false;
  try {
    const parsed = new URL(value);
    return (
      parsed.username === "" &&
      parsed.password === "" &&
      parsed.hash === "" &&
      parsed.protocol === "https:" &&
      parsed.hostname === FIREBASE_EMAIL_LINK_DOMAIN &&
      parsed.port === "" &&
      parsed.pathname === FIREBASE_EMAIL_LINK_PATH
    );
  } catch {
    return false;
  }
}

export function getFirebaseAppCheckProviderConfig(
  platform: FirebaseAppCheckPlatform,
  readiness: FirebaseClientReadiness
): FirebaseAppCheckProviderConfig {
  if (readiness.appCheckDebugEnabled) {
    return { provider: "debug", debugToken: readiness.appCheckDebugToken };
  }

  return {
    provider: platform === "android" ? "playIntegrity" : "appAttestWithDeviceCheckFallback",
    debugToken: undefined
  };
}

export function createFirebaseAuthAdapter(
  nativeAuth: FirebaseAuthNativeApi,
  options: { emailLinkReady?: boolean; emailLinkDomain?: string } = {}
) {
  const emailLinkReady = options.emailLinkReady === true;
  const emailLinkDomain = options.emailLinkDomain;
  return {
    async requestEmailLink(
      email: string,
      options: { continueUrl: string }
    ): Promise<FirebaseAuthActionResult> {
      if (!emailLinkReady || !isFirebaseEmailLinkDomain(emailLinkDomain)) return emailLinkUnconfiguredResult();
      const normalizedEmail = sanitizeEmail(email);
      if (!normalizedEmail) return invalidResult("Enter a valid account email address.");
      if (!isSafeContinueUrl(options.continueUrl)) return invalidResult("Firebase email links must return to the FREED auth callback.");

      try {
        await nativeAuth.sendSignInLinkToEmail(normalizedEmail, {
          handleCodeInApp: true,
          url: options.continueUrl.trim(),
          linkDomain: emailLinkDomain,
          android: { packageName: "app.freed.recovery", installApp: true },
          iOS: { bundleId: "app.freed.recovery" }
        });
        return { ok: true, status: "sent" };
      } catch {
        return { ok: false, status: "error", reason: "Firebase email link could not be sent." };
      }
    },

    async completeEmailLink(input: { email: string; emailLink: string }): Promise<FirebaseAuthActionResult> {
      if (!emailLinkReady) return emailLinkUnconfiguredResult();
      const normalizedEmail = sanitizeEmail(input.email);
      if (!normalizedEmail) return invalidResult("Enter the email address used for the link.");
      if (!isUsableEmailLink(input.emailLink) || !(await nativeAuth.isSignInWithEmailLink(input.emailLink.trim()))) {
        return invalidResult("This is not a valid Firebase email sign-in link.");
      }

      try {
        const result = await nativeAuth.signInWithEmailLink(normalizedEmail, input.emailLink.trim());
        return authenticatedResult(result.user);
      } catch {
        return { ok: false, status: "error", reason: "Firebase email link could not be completed." };
      }
    },

    async exchangeProviderCredential(
      provider: FirebaseAuthProvider,
      input: FirebaseProviderCredentialInput
    ): Promise<FirebaseAuthActionResult> {
      const credential = providerCredential(nativeAuth, provider, input);
      if (!credential) return invalidResult(`A valid ${provider} identity credential is required.`);

      try {
        return authenticatedResult((await nativeAuth.signInWithCredential(credential)).user);
      } catch {
        return { ok: false, status: "error", reason: `Firebase ${provider} sign-in could not be completed.` };
      }
    },

    async getCurrentIdToken(forceRefresh = false): Promise<string | null> {
      const user = nativeAuth.currentUser();
      if (!user) return null;
      try {
        const token = await user.getIdToken(forceRefresh);
        return isToken(token) ? token : null;
      } catch {
        return null;
      }
    }
  };
}

export function getFirebaseMessagingRegistrationContract(input: {
  installationId: string;
  token: string;
}): FirebaseMessagingRegistration | null {
  if (!isToken(input.installationId) || !isToken(input.token)) return null;
  return {
    installationId: input.installationId,
    token: input.token,
    recoveryContentIncluded: false
  };
}

function providerCredential(
  nativeAuth: FirebaseAuthNativeApi,
  provider: FirebaseAuthProvider,
  input: FirebaseProviderCredentialInput
) {
  if (provider === "google" && isToken(input.idToken)) {
    return nativeAuth.createGoogleCredential(input.idToken, isToken(input.accessToken) ? input.accessToken : undefined);
  }
  if (provider === "apple" && isToken(input.identityToken)) {
    return nativeAuth.createAppleCredential(input.identityToken, isToken(input.nonce) ? input.nonce : undefined);
  }
  return null;
}

function authenticatedResult(user: FirebaseNativeUser): FirebaseAuthActionResult {
  return isToken(user.uid) ? { ok: true, status: "authenticated", uid: user.uid } : { ok: false, status: "error", reason: "Firebase did not return a user identity." };
}

function invalidResult(reason: string): FirebaseAuthActionResult {
  return { ok: false, status: "invalid", reason };
}

function emailLinkUnconfiguredResult(): FirebaseAuthActionResult {
  return { ok: false, status: "unconfigured", reason: EMAIL_LINK_ASSOCIATION_UNCONFIGURED_REASON };
}

function publicFirebaseSecretIssues(env: Env) {
  return Object.keys(env)
    .filter((key) => key.startsWith("EXPO_PUBLIC_") && FIREBASE_PUBLIC_SECRET_PATTERN.test(key))
    .sort()
    .map((key) => `server secret must not be public: ${key}`);
}

function isFirebaseEnvironment(value: string): value is FirebaseEnvironment {
  return value === "production" || value === "staging";
}

function readEnv(env: Env, key: string) {
  const value = env[key];
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function sanitizeEmail(value: string) {
  const normalized = value.trim().toLowerCase();
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(normalized) && normalized.length <= 254 ? normalized : null;
}

function isSafeContinueUrl(value: string) {
  return value.trim() === FIREBASE_EMAIL_LINK_CALLBACK_URL;
}

function isFirebaseEmailLinkDomain(value: string | undefined): value is typeof FIREBASE_EMAIL_LINK_DOMAIN {
  return value === FIREBASE_EMAIL_LINK_DOMAIN;
}

function isUsableEmailLink(value: string) {
  try {
    const parsed = new URL(value.trim());
    return parsed.protocol === "https:" && parsed.searchParams.has("oobCode");
  } catch {
    return false;
  }
}

function isToken(value: unknown): value is string {
  return typeof value === "string" && value.trim().length >= 8 && value.trim().length <= 16_384 && !/\s/.test(value);
}
