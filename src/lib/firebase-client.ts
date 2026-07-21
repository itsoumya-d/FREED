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
const FIREBASE_PUBLIC_SECRET_PATTERN = /(?:SERVICE_ACCOUNT|ADMIN|PRIVATE_KEY|SERVER_KEY|ACCESS_TOKEN|GOOGLE_APPLICATION_CREDENTIALS|CREDENTIAL)/i;
const SAFE_CONTINUE_SCHEMES = new Set(["freed:", "app.freed.recovery:"]);
const SAFE_FIREBASE_AUTH_CONTINUE_HOSTS = new Set(["freed-7d5ee.web.app", "freed-7d5ee.firebaseapp.com"]);

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

export function createFirebaseAuthAdapter(nativeAuth: FirebaseAuthNativeApi) {
  return {
    async requestEmailLink(
      email: string,
      options: { continueUrl: string }
    ): Promise<FirebaseAuthActionResult> {
      const normalizedEmail = sanitizeEmail(email);
      if (!normalizedEmail) return invalidResult("Enter a valid account email address.");
      if (!isSafeContinueUrl(options.continueUrl)) return invalidResult("Firebase email links must return to the FREED auth callback.");

      try {
        await nativeAuth.sendSignInLinkToEmail(normalizedEmail, {
          handleCodeInApp: true,
          url: options.continueUrl.trim(),
          android: { packageName: "app.freed.recovery", installApp: true },
          iOS: { bundleId: "app.freed.recovery" }
        });
        return { ok: true, status: "sent" };
      } catch {
        return { ok: false, status: "error", reason: "Firebase email link could not be sent." };
      }
    },

    async completeEmailLink(input: { email: string; emailLink: string }): Promise<FirebaseAuthActionResult> {
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
  try {
    const parsed = new URL(value.trim());
    if (parsed.protocol === "https:" && SAFE_FIREBASE_AUTH_CONTINUE_HOSTS.has(parsed.hostname)) {
      return parsed.pathname === "/auth/callback" && !parsed.username && !parsed.password && !parsed.search && !parsed.hash;
    }
    if (!SAFE_CONTINUE_SCHEMES.has(parsed.protocol)) return false;
    const callbackPath = parsed.hostname === "auth" && parsed.pathname === "/callback";
    const tripleSlashCallback = !parsed.hostname && parsed.pathname === "/auth/callback";
    return callbackPath || tripleSlashCallback;
  } catch {
    return false;
  }
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
