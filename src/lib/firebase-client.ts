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

export type FirebaseCallableName =
  | "ingestAggregateAnalytics"
  | "startEncryptedBackupUpload"
  | "finalizeEncryptedBackupUpload"
  | "getEncryptedBackupDownload"
  | "deleteEncryptedBackup"
  | "registerPushToken"
  | "requestAccountDeletion"
  | "getReviewedAdultDomainFeed"
  | "generateClaraReply"
  | "generateChallenges"
  | "generateRetentionPlan"
  | "backendReadiness";

export type FirebaseAiFallbackReason =
  | "provider-disabled"
  | "configuration-unavailable"
  | "crisis-support"
  | "duplicate-request"
  | "provider-unavailable"
  | "invalid-provider-response";

export type FirebaseRecoveryWindowSignal = "late-night" | "morning" | "afternoon" | "evening";
export type FirebaseCurrentRiskWindowSignal = FirebaseRecoveryWindowSignal | "sleep-mode" | "focus-protection";
export type FirebaseRecoveryTriggerSignal =
  | "stress"
  | "night-low-sleep"
  | "scrolling"
  | "boredom-isolation"
  | "connection-stress"
  | "urge"
  | "logged";
export type FirebaseRecoveryRiskDriverSignal =
  | "high-urge"
  | "moderate-urge"
  | "low-sleep"
  | "mood-support"
  | "no-check-in"
  | "protected-risk-today"
  | "weekly-risk-cluster"
  | "recent-risk"
  | "recent-slip"
  | "matches-slip-window"
  | "matches-risk-window"
  | "sleep-mode"
  | "risk-rising"
  | "reset-needed"
  | "no-elevated-risk";

export type FirebaseClaraRequest = {
  clientEventId: string;
  input: string;
  context: {
    streakDays: number | null;
    attemptsToday: number | null;
    premium: boolean | null;
    slipsThisWeek: number | null;
    slipWindow: FirebaseRecoveryWindowSignal | null;
    slipTrigger: FirebaseRecoveryTriggerSignal | null;
  };
};

export type FirebaseClaraResult =
  | { text: string; provider: "remote"; status: "ok" }
  | { text: string; provider: "fallback"; status: "fallback"; reason: FirebaseAiFallbackReason };

export type FirebaseRecoveryChallenge = {
  id: string;
  title: string;
  category: "physical" | "breathing" | "reflection" | "connection" | "reset";
  durationSec: number;
  intensity: "calm" | "medium" | "strong";
  premium: false;
  icon: string;
  steps: string[];
  why: string;
};

export type FirebaseChallengeRequest = {
  clientEventId: string;
  profile: {
    streakDays: number;
    premium: boolean;
    attemptsToday: number;
    mood: "low" | "steady" | "energized" | "stressed";
    hour: number;
    dayPart: "morning" | "afternoon" | "evening" | "late-night";
    isWeekend: boolean | null;
    timezoneOffsetMinutes: number | null;
    slipsThisWeek: number | null;
    slipWindow: FirebaseRecoveryWindowSignal | null;
    slipTrigger: FirebaseRecoveryTriggerSignal | null;
    interventionContext: {
      source: "browser" | "search" | "manual-check" | "panic-button" | "app";
      category: "adult" | "adult-search-intent" | "known-safe" | "unknown" | "self-reported";
      surface: "adult-site" | "adult-search" | "search" | "social" | "video" | "forum" | "self-urge" | "unknown";
      ruleFamily: string | null;
      sessionDurationBucket: "under-1m" | "1-5m" | "5-15m" | "15-30m" | "30m-plus" | null;
    } | null;
    disciplinePreferences: {
      challengeIntensity: "gentle" | "balanced" | "strong";
      outdoorFrequency: "low" | "balanced" | "high";
      exercisePreference: "low" | "balanced" | "high";
      socialFrequency: "off" | "low" | "balanced" | "high";
      emergencyStrictMode: boolean;
      sleepModeActive: boolean;
      deepFocusModeActive: boolean;
      weekendModeEnabled: boolean;
      unlockDurationMinutes: number;
      dailyLimitMinutes: number;
    } | null;
    contextSignals: {
      energyLevel: "low" | "steady" | "high" | null;
      urgeLevel: number | null;
      sleepQuality: number | null;
      locationPermission: "granted" | "denied" | "undetermined" | "unavailable" | "unknown" | null;
      weatherCondition: "clear" | "cloudy" | "rain" | "snow" | "storm" | "hot" | "cold" | "unknown" | null;
      temperatureC: number | null;
    } | null;
    riskForecast: {
      level: "low" | "elevated" | "high";
      score: number;
      confidence: "low" | "medium" | "high";
      currentWindow: FirebaseCurrentRiskWindowSignal | null;
      drivers: FirebaseRecoveryRiskDriverSignal[];
    } | null;
    recentFailureCount: number;
    preferredCategories: FirebaseRecoveryChallenge["category"][];
  };
  recentChallengeHistory: Array<{
    id: string;
    category: FirebaseRecoveryChallenge["category"];
    outcome: "helped" | "still-urging";
    completedAt: string;
  }>;
};

export type FirebaseChallengeResult =
  | { challenges: FirebaseRecoveryChallenge[]; provider: "remote"; status: "ok" }
  | { challenges: FirebaseRecoveryChallenge[]; provider: "fallback"; status: "fallback"; reason: FirebaseAiFallbackReason };

export type FirebaseRetentionRequest = {
  clientEventId: string;
  profile: {
    premium: boolean;
    streakDays: number;
    bestStreakDays: number;
    attemptsThisWeek: number;
    slipsThisWeek: number;
    checkInsThisWeek: number;
    completedChallengesThisWeek: number;
    averageUrge: number;
    averageSleep: number;
    steadyDays: number;
    riskWindow: FirebaseRecoveryWindowSignal | null;
    slipWindow: FirebaseRecoveryWindowSignal | null;
    slipTrigger: FirebaseRecoveryTriggerSignal | null;
    bestIntervention: FirebaseRecoveryChallenge["category"] | null;
    momentum: "needs-more-signal" | "risk-rising" | "risk-easing" | "stable";
    urgeRiskForecast: {
      level: "low" | "elevated" | "high";
      score: number;
      confidence: "low" | "medium" | "high";
      currentWindow: FirebaseCurrentRiskWindowSignal | null;
      drivers: FirebaseRecoveryRiskDriverSignal[];
    };
    enabledReminderKeys: Array<"morning" | "evening" | "guard">;
    smartGuardTime: string;
    smartGuardSource: "risk-window" | "slip-window" | "default";
    localDateKey: string;
    timezoneOffsetMinutes: number;
  };
};

export type FirebaseRetentionResult =
  | {
      headline: string;
      nextBestAction: string;
      checkInPrompt: string;
      suggestedGuardTime: string | null;
      focusTags: string[];
      provider: "remote";
      status: "ok";
    }
  | {
      headline: string;
      nextBestAction: string;
      checkInPrompt: string;
      suggestedGuardTime: string | null;
      focusTags: string[];
      provider: "fallback";
      status: "fallback";
      reason: FirebaseAiFallbackReason;
    };

export type FirebaseReviewedAdultDomainFeed = {
  version: string;
  generatedAt: string;
  publishedAt: string;
  checksum: string;
  source: { id: string; label: string; url: string };
  domains: string[];
};

export type FirebaseBackupUploadRequiredHeaders = Readonly<{
  "content-type": "application/octet-stream";
  "content-length": string;
  "x-goog-if-generation-match": string;
}>;

export type FirebaseCallableResult = {
  ok?: boolean;
  duplicate?: boolean;
  status?: string;
  signedUrl?: string;
  objectKey?: string;
  expiresAt?: string;
  requiredHeaders?: FirebaseBackupUploadRequiredHeaders;
  verifiedBytes?: number;
  version?: string;
  generatedAt?: string;
  publishedAt?: string;
  checksum?: string;
  source?: { id: string; label: string; url: string };
  domains?: string[];
};
export type FirebaseCallableTransport = {
  call: (name: FirebaseCallableName, data: unknown) => Promise<unknown>;
};
export type FirebaseAggregateAnalyticsPayload = {
  day: string;
  checkIns: number;
  completedChallenges: number;
  clientEventId: string;
};
export type FirebaseBackupMetadataPayload = {
  backupId: string;
  encryptedBytes: number;
  ciphertextSha256: string;
  clientEventId: string;
};
export type FirebaseBackupMutationPayload = { backupId: string; clientEventId: string };
export type FirebaseBackupDownloadPayload = { backupId: string };
export type FirebaseDeletionRequestPayload = { clientEventId: string };

const REVIEWED_FEED_SOURCE = Object.freeze({
  id: "oisd-nsfw-small",
  label: "OISD NSFW Small",
  url: "https://nsfw-small.oisd.nl/"
});
const REVIEWED_FEED_KEYS = ["version", "generatedAt", "publishedAt", "checksum", "source", "domains"] as const;
const REVIEWED_FEED_SOURCE_KEYS = ["id", "label", "url"] as const;
const MAX_REVIEWED_FEED_DOMAINS = 100_000;
const MAX_REVIEWED_FEED_DOMAIN_BYTES = 2_000_000;
const REVIEWED_FEED_LABEL = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;
const AI_FALLBACK_REASONS = [
  "provider-disabled", "configuration-unavailable", "crisis-support", "duplicate-request",
  "provider-unavailable", "invalid-provider-response"
] as const;
const AI_CATEGORIES = ["physical", "breathing", "reflection", "connection", "reset"] as const;
const AI_INTENSITIES = ["calm", "medium", "strong"] as const;
const AI_RECOVERY_WINDOWS = ["late-night", "morning", "afternoon", "evening"] as const;
const AI_CURRENT_RISK_WINDOWS = [...AI_RECOVERY_WINDOWS, "sleep-mode", "focus-protection"] as const;
const AI_RECOVERY_TRIGGERS = ["stress", "night-low-sleep", "scrolling", "boredom-isolation", "connection-stress", "urge", "logged"] as const;
const AI_RECOVERY_RISK_DRIVERS = [
  "high-urge", "moderate-urge", "low-sleep", "mood-support", "no-check-in", "protected-risk-today",
  "weekly-risk-cluster", "recent-risk", "recent-slip", "matches-slip-window", "matches-risk-window",
  "sleep-mode", "risk-rising", "reset-needed", "no-elevated-risk"
] as const;
const AI_RECOVERY_MOMENTUM = ["needs-more-signal", "risk-rising", "risk-easing", "stable"] as const;
const AI_SAFE_ID = /^[A-Za-z0-9][A-Za-z0-9_-]{2,79}$/;
const AI_EVENT_ID = /^[A-Za-z0-9][A-Za-z0-9_-]{7,127}$/;
const AI_RAW_LINK = /https?:\/\/|\b(?:[a-z0-9-]+\.)+[a-z]{2,63}(?:\/\S*)?/i;

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

export function parseFirebaseReviewedAdultDomainFeed(value: unknown): FirebaseReviewedAdultDomainFeed {
  if (!isExactRecord(value, REVIEWED_FEED_KEYS)) throw new Error("Invalid reviewed adult-domain feed response.");
  const source = value.source;
  if (
    !isExactRecord(source, REVIEWED_FEED_SOURCE_KEYS) || source.id !== REVIEWED_FEED_SOURCE.id ||
    source.label !== REVIEWED_FEED_SOURCE.label || source.url !== REVIEWED_FEED_SOURCE.url
  ) {
    throw new Error("Invalid reviewed adult-domain feed response.");
  }
  if (
    typeof value.checksum !== "string" || !/^[a-f0-9]{64}$/.test(value.checksum) ||
    typeof value.version !== "string" || value.version !== `oisd-nsfw-small-${value.checksum.slice(0, 16)}` ||
    !isCanonicalIsoTimestamp(value.generatedAt) || !isCanonicalIsoTimestamp(value.publishedAt) ||
    Date.parse(value.publishedAt) < Date.parse(value.generatedAt) ||
    !Array.isArray(value.domains) || value.domains.length < 1 || value.domains.length > MAX_REVIEWED_FEED_DOMAINS
  ) {
    throw new Error("Invalid reviewed adult-domain feed response.");
  }

  let domainBytes = 0;
  let previous = "";
  const domains: string[] = [];
  for (const domain of value.domains) {
    if (typeof domain !== "string" || !isCanonicalFeedDomain(domain) || domain <= previous) {
      throw new Error("Invalid reviewed adult-domain feed response.");
    }
    domainBytes += domain.length + 1;
    if (domainBytes > MAX_REVIEWED_FEED_DOMAIN_BYTES) throw new Error("Invalid reviewed adult-domain feed response.");
    domains.push(domain);
    previous = domain;
  }
  return {
    version: value.version,
    generatedAt: value.generatedAt,
    publishedAt: value.publishedAt,
    checksum: value.checksum,
    source: { ...REVIEWED_FEED_SOURCE },
    domains
  };
}

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

/**
 * Mobile-side boundary for Firebase Functions. It intentionally exposes only
 * bounded aggregates and encrypted-backup metadata, never recovery content.
 */
export function createFirebaseCallableContracts(transport: FirebaseCallableTransport) {
  return {
    ingestAggregateAnalytics: async (payload: FirebaseAggregateAnalyticsPayload) => {
      assertCallablePayload(payload, ["day", "checkIns", "completedChallenges", "clientEventId"]);
      return transport.call("ingestAggregateAnalytics", payload);
    },
    startBackupUpload: async (payload: FirebaseBackupMetadataPayload) => {
      assertCallablePayload(payload, ["backupId", "encryptedBytes", "ciphertextSha256", "clientEventId"]);
      return transport.call("startEncryptedBackupUpload", payload);
    },
    finalizeBackupUpload: async (payload: FirebaseBackupMutationPayload) => {
      assertCallablePayload(payload, ["backupId", "clientEventId"]);
      return transport.call("finalizeEncryptedBackupUpload", payload);
    },
    getBackupDownload: async (payload: FirebaseBackupDownloadPayload) => {
      assertCallablePayload(payload, ["backupId"]);
      return transport.call("getEncryptedBackupDownload", payload);
    },
    deleteBackup: async (payload: FirebaseBackupMutationPayload) => {
      assertCallablePayload(payload, ["backupId", "clientEventId"]);
      return transport.call("deleteEncryptedBackup", payload);
    },
    registerPushToken: async (payload: FirebaseMessagingRegistration & { clientEventId: string }) => {
      assertCallablePayload(payload, ["installationId", "token", "recoveryContentIncluded", "clientEventId"]);
      if (payload.recoveryContentIncluded !== false) throw new Error("Recovery content is not permitted in Firebase callable payloads.");
      return transport.call("registerPushToken", {
        installationId: payload.installationId,
        token: payload.token,
        clientEventId: payload.clientEventId
      });
    },
    requestAccountDeletion: async (payload: FirebaseDeletionRequestPayload) => {
      assertCallablePayload(payload, ["clientEventId"]);
      return transport.call("requestAccountDeletion", payload);
    },
    getReviewedAdultDomainFeed: async (): Promise<FirebaseReviewedAdultDomainFeed> =>
      parseFirebaseReviewedAdultDomainFeed(await transport.call("getReviewedAdultDomainFeed", undefined)),
    generateClaraReply: async (payload: FirebaseClaraRequest): Promise<FirebaseClaraResult> => {
      assertFirebaseClaraRequest(payload);
      return parseFirebaseClaraResult(await transport.call("generateClaraReply", payload));
    },
    generateChallenges: async (payload: FirebaseChallengeRequest): Promise<FirebaseChallengeResult> => {
      assertFirebaseChallengeRequest(payload);
      return parseFirebaseChallengeResult(await transport.call("generateChallenges", payload));
    },
    generateRetentionPlan: async (payload: FirebaseRetentionRequest): Promise<FirebaseRetentionResult> => {
      assertFirebaseRetentionRequest(payload);
      return parseFirebaseRetentionResult(await transport.call("generateRetentionPlan", payload));
    },
    backendReadiness: () => transport.call("backendReadiness", undefined)
  };
}

export function parseFirebaseClaraResult(value: unknown): FirebaseClaraResult {
  const fallback = isAiFallbackEnvelope(value);
  const allowed = fallback ? ["text", "provider", "status", "reason"] as const : ["text", "provider", "status"] as const;
  if (!isExactRecord(value, allowed) || !isSafeAiText(value.text, 1_000)) invalidAiResponse();
  if (fallback) {
    return { text: value.text, provider: "fallback", status: "fallback", reason: value.reason };
  }
  if (value.provider !== "remote" || value.status !== "ok") invalidAiResponse();
  return { text: value.text, provider: "remote", status: "ok" };
}

export function parseFirebaseChallengeResult(value: unknown): FirebaseChallengeResult {
  const fallback = isAiFallbackEnvelope(value);
  const allowed = fallback ? ["challenges", "provider", "status", "reason"] as const : ["challenges", "provider", "status"] as const;
  if (!isExactRecord(value, allowed) || !Array.isArray(value.challenges) || value.challenges.length !== 3) invalidAiResponse();
  const challenges = value.challenges.map(parseFirebaseChallenge);
  if (new Set(challenges.map((item) => item.id)).size !== 3) invalidAiResponse();
  if (fallback) return { challenges, provider: "fallback", status: "fallback", reason: value.reason };
  if (value.provider !== "remote" || value.status !== "ok") invalidAiResponse();
  return { challenges, provider: "remote", status: "ok" };
}

export function parseFirebaseRetentionResult(value: unknown): FirebaseRetentionResult {
  const fallback = isAiFallbackEnvelope(value);
  const base = ["headline", "nextBestAction", "checkInPrompt", "suggestedGuardTime", "focusTags", "provider", "status"] as const;
  const allowed = fallback ? [...base, "reason"] as const : base;
  if (
    !isExactRecord(value, allowed) ||
    !isSafeAiText(value.headline, 90) ||
    !isSafeAiText(value.nextBestAction, 180) ||
    !isSafeAiText(value.checkInPrompt, 140) ||
    !(value.suggestedGuardTime === null || (typeof value.suggestedGuardTime === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(value.suggestedGuardTime))) ||
    !Array.isArray(value.focusTags) || value.focusTags.length < 1 || value.focusTags.length > 4 ||
    value.focusTags.some((tag) => !isSafeAiText(tag, 32)) ||
    new Set(value.focusTags.map((tag) => String(tag).toLowerCase())).size !== value.focusTags.length
  ) {
    invalidAiResponse();
  }
  const plan = {
    headline: value.headline,
    nextBestAction: value.nextBestAction,
    checkInPrompt: value.checkInPrompt,
    suggestedGuardTime: value.suggestedGuardTime,
    focusTags: value.focusTags as string[]
  };
  if (fallback) return { ...plan, provider: "fallback", status: "fallback", reason: value.reason };
  if (value.provider !== "remote" || value.status !== "ok") invalidAiResponse();
  return { ...plan, provider: "remote", status: "ok" };
}

function assertFirebaseClaraRequest(value: FirebaseClaraRequest): void {
  const valid = isExactRecord(value, ["clientEventId", "input", "context"] as const) &&
    isAiEventId(value.clientEventId) && isBoundedString(value.input, 1, 1_200) &&
    isExactRecord(value.context, ["streakDays", "attemptsToday", "premium", "slipsThisWeek", "slipWindow", "slipTrigger"] as const) &&
    isNullableInteger(value.context.streakDays, 0, 10_000) &&
    isNullableInteger(value.context.attemptsToday, 0, 100) &&
    (value.context.premium === null || typeof value.context.premium === "boolean") &&
    isNullableInteger(value.context.slipsThisWeek, 0, 100) &&
    (value.context.slipWindow === null || isEnum(value.context.slipWindow, AI_RECOVERY_WINDOWS)) &&
    (value.context.slipTrigger === null || isEnum(value.context.slipTrigger, AI_RECOVERY_TRIGGERS)) &&
    aiPayloadBytes(value) <= 8 * 1024;
  if (!valid) invalidAiRequest();
}

function assertFirebaseChallengeRequest(value: FirebaseChallengeRequest): void {
  if (!isExactRecord(value, ["clientEventId", "profile", "recentChallengeHistory"] as const) || !isAiEventId(value.clientEventId)) {
    invalidAiRequest();
  }
  const profile = value.profile;
  const validProfile = isExactRecord(profile, [
    "streakDays", "premium", "attemptsToday", "mood", "hour", "dayPart", "isWeekend", "timezoneOffsetMinutes",
    "slipsThisWeek", "slipWindow", "slipTrigger", "interventionContext", "disciplinePreferences", "contextSignals",
    "riskForecast", "recentFailureCount", "preferredCategories"
  ] as const) &&
    isInteger(profile.streakDays, 0, 10_000) && typeof profile.premium === "boolean" &&
    isInteger(profile.attemptsToday, 0, 100) && isEnum(profile.mood, ["low", "steady", "energized", "stressed"] as const) &&
    isInteger(profile.hour, 0, 23) && isEnum(profile.dayPart, ["morning", "afternoon", "evening", "late-night"] as const) &&
    (profile.isWeekend === null || typeof profile.isWeekend === "boolean") &&
    isNullableInteger(profile.timezoneOffsetMinutes, -840, 840) && isNullableInteger(profile.slipsThisWeek, 0, 100) &&
    (profile.slipWindow === null || isEnum(profile.slipWindow, AI_RECOVERY_WINDOWS)) &&
    (profile.slipTrigger === null || isEnum(profile.slipTrigger, AI_RECOVERY_TRIGGERS)) &&
    isFirebaseIntervention(profile.interventionContext) && isFirebaseDiscipline(profile.disciplinePreferences) &&
    isFirebaseContextSignals(profile.contextSignals) && isFirebaseRisk(profile.riskForecast, true) &&
    isInteger(profile.recentFailureCount, 0, 10) && isEnumArray(profile.preferredCategories, AI_CATEGORIES, 5);
  const validHistory = Array.isArray(value.recentChallengeHistory) && value.recentChallengeHistory.length <= 10 &&
    value.recentChallengeHistory.every((entry) =>
      isExactRecord(entry, ["id", "category", "outcome", "completedAt"] as const) &&
      isAiIdentifier(entry.id) && isEnum(entry.category, AI_CATEGORIES) &&
      isEnum(entry.outcome, ["helped", "still-urging"] as const) && isCanonicalIsoTimestamp(entry.completedAt)
    );
  if (!validProfile || !validHistory || aiPayloadBytes(value) > 24 * 1024) invalidAiRequest();
}

function assertFirebaseRetentionRequest(value: FirebaseRetentionRequest): void {
  if (!isExactRecord(value, ["clientEventId", "profile"] as const) || !isAiEventId(value.clientEventId)) invalidAiRequest();
  const profile = value.profile;
  const valid = isExactRecord(profile, [
    "premium", "streakDays", "bestStreakDays", "attemptsThisWeek", "slipsThisWeek", "checkInsThisWeek",
    "completedChallengesThisWeek", "averageUrge", "averageSleep", "steadyDays", "riskWindow", "slipWindow", "slipTrigger",
    "bestIntervention", "momentum", "urgeRiskForecast", "enabledReminderKeys", "smartGuardTime", "smartGuardSource",
    "localDateKey", "timezoneOffsetMinutes"
  ] as const) && typeof profile.premium === "boolean" && isInteger(profile.streakDays, 0, 10_000) &&
    isInteger(profile.bestStreakDays, 0, 10_000) && isInteger(profile.attemptsThisWeek, 0, 100) &&
    isInteger(profile.slipsThisWeek, 0, 100) && isInteger(profile.checkInsThisWeek, 0, 7) &&
    isInteger(profile.completedChallengesThisWeek, 0, 100) && isNumber(profile.averageUrge, 0, 5) &&
    isNumber(profile.averageSleep, 0, 5) && isInteger(profile.steadyDays, 0, 7) &&
    (profile.riskWindow === null || isEnum(profile.riskWindow, AI_RECOVERY_WINDOWS)) &&
    (profile.slipWindow === null || isEnum(profile.slipWindow, AI_RECOVERY_WINDOWS)) &&
    (profile.slipTrigger === null || isEnum(profile.slipTrigger, AI_RECOVERY_TRIGGERS)) &&
    (profile.bestIntervention === null || isEnum(profile.bestIntervention, AI_CATEGORIES)) &&
    isEnum(profile.momentum, AI_RECOVERY_MOMENTUM) && isFirebaseRisk(profile.urgeRiskForecast, false) &&
    isEnumArray(profile.enabledReminderKeys, ["morning", "evening", "guard"] as const, 3) &&
    new Set(profile.enabledReminderKeys).size === profile.enabledReminderKeys.length &&
    /^([01]\d|2[0-3]):[0-5]\d$/.test(profile.smartGuardTime) &&
    isEnum(profile.smartGuardSource, ["risk-window", "slip-window", "default"] as const) &&
    isCanonicalLocalDate(profile.localDateKey) && isInteger(profile.timezoneOffsetMinutes, -840, 840);
  if (!valid || aiPayloadBytes(value) > 16 * 1024) invalidAiRequest();
}

function parseFirebaseChallenge(value: unknown): FirebaseRecoveryChallenge {
  if (!isExactRecord(value, ["id", "title", "category", "durationSec", "intensity", "premium", "icon", "steps", "why"] as const)) {
    invalidAiResponse();
  }
  if (
    !isAiIdentifier(value.id) || !isSafeAiText(value.title, 64) || !isEnum(value.category, AI_CATEGORIES) ||
    !isInteger(value.durationSec, 30, 900) || !isEnum(value.intensity, AI_INTENSITIES) || value.premium !== false ||
    typeof value.icon !== "string" || !/^[A-Za-z][A-Za-z0-9]{0,39}$/.test(value.icon) ||
    !Array.isArray(value.steps) || value.steps.length < 2 || value.steps.length > 4 ||
    value.steps.some((step) => !isSafeAiText(step, 120)) || !isSafeAiText(value.why, 160)
  ) {
    invalidAiResponse();
  }
  return {
    id: value.id,
    title: value.title,
    category: value.category,
    durationSec: value.durationSec,
    intensity: value.intensity,
    premium: false,
    icon: value.icon,
    steps: value.steps as string[],
    why: value.why
  };
}

function isAiFallbackEnvelope(value: unknown): value is { provider: "fallback"; status: "fallback"; reason: FirebaseAiFallbackReason } & Record<string, unknown> {
  return Boolean(
    value && typeof value === "object" && !Array.isArray(value) &&
    (value as Record<string, unknown>).provider === "fallback" &&
    (value as Record<string, unknown>).status === "fallback" &&
    isEnum((value as Record<string, unknown>).reason, AI_FALLBACK_REASONS)
  );
}

function isFirebaseIntervention(value: unknown): boolean {
  if (value === null) return true;
  return isExactRecord(value, ["source", "category", "surface", "ruleFamily", "sessionDurationBucket"] as const) &&
    isEnum(value.source, ["browser", "search", "manual-check", "panic-button", "app"] as const) &&
    isEnum(value.category, ["adult", "adult-search-intent", "known-safe", "unknown", "self-reported"] as const) &&
    isEnum(value.surface, ["adult-site", "adult-search", "search", "social", "video", "forum", "self-urge", "unknown"] as const) &&
    (value.ruleFamily === null || isAiIdentifier(value.ruleFamily)) &&
    (value.sessionDurationBucket === null || isEnum(value.sessionDurationBucket, ["under-1m", "1-5m", "5-15m", "15-30m", "30m-plus"] as const));
}

function isFirebaseDiscipline(value: unknown): boolean {
  if (value === null) return true;
  return isExactRecord(value, [
    "challengeIntensity", "outdoorFrequency", "exercisePreference", "socialFrequency", "emergencyStrictMode", "sleepModeActive",
    "deepFocusModeActive", "weekendModeEnabled", "unlockDurationMinutes", "dailyLimitMinutes"
  ] as const) && isEnum(value.challengeIntensity, ["gentle", "balanced", "strong"] as const) &&
    isEnum(value.outdoorFrequency, ["low", "balanced", "high"] as const) &&
    isEnum(value.exercisePreference, ["low", "balanced", "high"] as const) &&
    isEnum(value.socialFrequency, ["off", "low", "balanced", "high"] as const) &&
    typeof value.emergencyStrictMode === "boolean" && typeof value.sleepModeActive === "boolean" &&
    typeof value.deepFocusModeActive === "boolean" && typeof value.weekendModeEnabled === "boolean" &&
    isInteger(value.unlockDurationMinutes, 5, 60) && isInteger(value.dailyLimitMinutes, 5, 240);
}

function isFirebaseContextSignals(value: unknown): boolean {
  if (value === null) return true;
  return isExactRecord(value, ["energyLevel", "urgeLevel", "sleepQuality", "locationPermission", "weatherCondition", "temperatureC"] as const) &&
    (value.energyLevel === null || isEnum(value.energyLevel, ["low", "steady", "high"] as const)) &&
    isNullableInteger(value.urgeLevel, 0, 5) && isNullableInteger(value.sleepQuality, 1, 5) &&
    (value.locationPermission === null || isEnum(value.locationPermission, ["granted", "denied", "undetermined", "unavailable", "unknown"] as const)) &&
    (value.weatherCondition === null || isEnum(value.weatherCondition, ["clear", "cloudy", "rain", "snow", "storm", "hot", "cold", "unknown"] as const)) &&
    isNullableInteger(value.temperatureC, -60, 60);
}

function isFirebaseRisk(value: unknown, nullable: boolean): boolean {
  if (value === null) return nullable;
  return isExactRecord(value, ["level", "score", "confidence", "currentWindow", "drivers"] as const) &&
    isEnum(value.level, ["low", "elevated", "high"] as const) && isInteger(value.score, 0, 100) &&
    isEnum(value.confidence, ["low", "medium", "high"] as const) &&
    (value.currentWindow === null || isEnum(value.currentWindow, AI_CURRENT_RISK_WINDOWS)) &&
    isEnumArray(value.drivers, AI_RECOVERY_RISK_DRIVERS, 4);
}

function isAiEventId(value: unknown): value is string {
  return typeof value === "string" && AI_EVENT_ID.test(value);
}

function isAiIdentifier(value: unknown): value is string {
  return typeof value === "string" && AI_SAFE_ID.test(value) && !AI_RAW_LINK.test(value);
}

function isBoundedString(value: unknown, min: number, max: number): value is string {
  return typeof value === "string" && value.trim().length >= min && value.length <= max;
}

function isSafeAiText(value: unknown, max: number): value is string {
  return isBoundedString(value, 1, max) && !AI_RAW_LINK.test(value) && !isUnsafeFirebaseAiOutput(value);
}

function isInteger(value: unknown, min: number, max: number): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= min && value <= max;
}

function isNullableInteger(value: unknown, min: number, max: number): value is number | null {
  return value === null || isInteger(value, min, max);
}

function isNumber(value: unknown, min: number, max: number): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= min && value <= max;
}

function isEnum<const T extends readonly string[]>(value: unknown, allowed: T): value is T[number] {
  return typeof value === "string" && allowed.includes(value);
}

function isEnumArray<const T extends readonly string[]>(value: unknown, allowed: T, max: number): value is T[number][] {
  return Array.isArray(value) && value.length <= max && value.every((item) => isEnum(item, allowed));
}

function aiPayloadBytes(value: unknown): number {
  return new TextEncoder().encode(JSON.stringify(value)).byteLength;
}

function isUnsafeFirebaseAiOutput(value: string): boolean {
  const lower = value.toLowerCase();
  const punitive = /\b(?:punishment|punish yourself|punitive)\b/i.test(lower) &&
    !/\b(?:avoid|never|do not|don't|without)\s+(?:(?:use|using)\s+)?(?:punishment|punish(?:ing)? yourself|punitive)\b/i.test(lower);
  return (
    /\b(?:you(?:'re| are)|this makes you)\s+(?:disgusting|pathetic|weak|dirty|bad|a failure)\b|\b(?:prove|show)\s+you(?:'re| are)?\s+not\s+(?:a\s+)?failure\b|\b(?:should|need to)\s+be\s+ashamed\b/i.test(value) ||
    /\b(?:porn|sexual|sexually|explicit sexual|nsfw)\b/i.test(value) ||
    /\b(?:take|stop|skip|double|increase|decrease|change|inject)\b[^.!?]{0,35}\b(?:medication|medicine|dose|pills?|drug)\b|\b(?:diagnose|diagnosis|medical treatment|replace professional care)\b/i.test(value) ||
    /\b(?:drive|driving|fasting|starve|scald|boiling)\b/i.test(value) ||
    /\b(?:sprint|run|exercise|plank|push[- ]?ups?|sit[- ]?ups?|squats?|burpees?)\b[^.!?]{0,60}\buntil\s+(?:you\s+)?(?:vomit(?:ing)?|throw up|collapse|pass out|hurt|feel pain|exhausted|cannot continue|can't continue)\b/i.test(value) ||
    /\b[1-9]\d{2,}\s*(?:push[- ]?ups?|sit[- ]?ups?|squats?|burpees?|repetitions?|reps?)\b/i.test(value) ||
    /\b(?:plank|sprint|burpees?|push[- ]?ups?)\b[^.!?\d]{0,35}\b(?:[1-9]\d|[2-9]\d{2,})\s*(?:minutes?|mins?)\b/i.test(value) ||
    /\b(?:[1-9]\d|[2-9]\d{2,})\s*[- ]?(?:minutes?|mins?)(?:\s+of)?\s+(?:a\s+)?(?:plank|sprinting|burpees?|push[- ]?ups?)\b/i.test(value) ||
    /(?:hot|warm)\s+(?:bath|shower|water)[^.!?]{0,30}(?:4[2-9]|[5-9]\d)\s*°?c/i.test(value) ||
    /hold\s+(?:your\s+)?breath[^.!?]{0,30}(?:minutes?|until)/i.test(value) || punitive
  );
}

function isCanonicalLocalDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const timestamp = Date.parse(`${value}T00:00:00.000Z`);
  return Number.isFinite(timestamp) && new Date(timestamp).toISOString().slice(0, 10) === value;
}

function invalidAiRequest(): never {
  throw new Error("This data is not permitted in Firebase AI callable payloads.");
}

function invalidAiResponse(): never {
  throw new Error("Invalid Firebase AI callable response.");
}

function assertCallablePayload(payload: object, allowed: readonly string[]) {
  for (const key of Object.keys(payload)) {
    if (
      !allowed.includes(key) ||
      (/(?:url|host|recovery|receipt|note|accessibility|envelope|content|text|body)/i.test(key) &&
        key !== "recoveryContentIncluded" && key !== "ciphertextSha256")
    ) {
      throw new Error("This data is not permitted in Firebase callable payloads.");
    }
  }
}

function isExactRecord<const Keys extends readonly string[]>(
  value: unknown,
  allowedKeys: Keys
): value is Record<Keys[number], unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const keys = Object.keys(value);
  return keys.length === allowedKeys.length && keys.every((key) => allowedKeys.includes(key));
}

function isCanonicalIsoTimestamp(value: unknown): value is string {
  if (typeof value !== "string" || value.length !== 24) return false;
  const milliseconds = Date.parse(value);
  return Number.isFinite(milliseconds) && new Date(milliseconds).toISOString() === value;
}

function isCanonicalFeedDomain(value: string): boolean {
  if (value.length > 253 || value !== value.toLowerCase() || !/^[a-z0-9.-]+$/.test(value)) return false;
  const labels = value.split(".");
  if (labels.length < 2 || labels.some((label) => !REVIEWED_FEED_LABEL.test(label))) return false;
  return /^(?:[a-z]{2,63}|xn--[a-z0-9-]{2,59})$/.test(labels.at(-1) ?? "");
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
