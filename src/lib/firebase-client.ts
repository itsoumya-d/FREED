import { parseReviewAccessSnapshot, type ReviewAccessSnapshot } from "./review-access";
import { getPublicClientEnvironment } from "@/lib/public-client-env";
import { getAuthIdentityFailureMessage, type AuthIdentityFailureReason } from "./social-auth-flow";

type Env = Record<string, string | undefined>;

export type FirebaseEnvironment = "production" | "staging";
export type FirebaseAppCheckPlatform = "android" | "ios";
export type FirebaseAppCheckProvider = "playIntegrity" | "appAttestWithDeviceCheckFallback" | "debug";
export type FirebaseAuthProvider = "apple" | "google" | "email";

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
  status: "sent" | "authenticated" | "linked" | "cancelled" | "invalid" | "error" | "unconfigured";
  code?: AuthIdentityFailureReason;
  reason?: string;
  uid?: string;
};

export type FirebaseNativeUser = {
  uid: string;
  isAnonymous?: boolean;
  email?: string | null;
  emailVerified?: boolean;
  providerData?: readonly { providerId: string }[];
  getIdToken: (forceRefresh?: boolean) => Promise<string>;
};

export type FirebaseAuthNativeApi = {
  sendSignInLinkToEmail: (email: string, settings: FirebaseEmailLinkSettings) => Promise<void>;
  isSignInWithEmailLink: (link: string) => boolean | Promise<boolean>;
  signInWithEmailLink: (email: string, link: string) => Promise<{ user: FirebaseNativeUser }>;
  createGoogleCredential: (idToken: string, accessToken?: string) => unknown;
  createAppleCredential: (identityToken: string, nonce?: string) => unknown;
  createEmailCredential?: (email: string, password: string) => unknown;
  createEmailLinkCredential?: (email: string, emailLink: string) => unknown;
  signInWithCredential: (credential: unknown) => Promise<{ user: FirebaseNativeUser }>;
  linkWithCredential?: (credential: unknown) => Promise<{ user: FirebaseNativeUser }>;
  reauthenticateWithCredential?: (credential: unknown) => Promise<{ user: FirebaseNativeUser }>;
  createEmailAccount?: (email: string, password: string) => Promise<{ user: FirebaseNativeUser }>;
  sendPasswordResetEmail?: (email: string) => Promise<void>;
  sendEmailVerification?: (user: FirebaseNativeUser) => Promise<void>;
  reloadCurrentUser?: (user: FirebaseNativeUser) => Promise<{ user: FirebaseNativeUser }>;
  signInWithAppleProvider?: (options: { linkExisting: boolean }) => Promise<{ user: FirebaseNativeUser }>;
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
  email?: string;
  password?: string;
  emailLink?: string;
};

export type FirebaseAccountSummary = { signedIn: boolean; anonymous: boolean; email: string | null; providers: string[]; emailVerified?: boolean };

export function summarizeFirebaseAccount(user: FirebaseNativeUser | null): FirebaseAccountSummary {
  if (!user || !isFirebaseAuthUid(user.uid)) return { signedIn: false, anonymous: false, email: null, providers: [] };
  const providers = new Set<string>();
  for (const entry of user.providerData ?? []) {
    if (entry && typeof entry.providerId === "string" && /^[A-Za-z0-9.-]{1,100}$/.test(entry.providerId)) providers.add(entry.providerId);
  }
  return { signedIn: true, anonymous: user.isAnonymous === true, email: typeof user.email === "string" ? sanitizeEmail(user.email) : null, providers: [...providers].sort(), ...(typeof user.emailVerified === "boolean" ? { emailVerified: user.emailVerified } : {}) };
}

export type FirebaseMessagingRegistration = {
  installationId: string;
  token: string;
  recoveryContentIncluded: false;
};

export type FirebaseCallableOptions = Readonly<{
  limitedUseAppCheckToken?: true;
  /** Local dispatch fence only; never serialized into callable data. */
  operationIsCurrent?: ()=>boolean;
}>;

export type FirebaseCallableName =
  | "ingestAggregateAnalytics"
  | "startEncryptedBackupUpload"
  | "finalizeEncryptedBackupUpload"
  | "getEncryptedBackupDownload"
  | "deleteEncryptedBackup"
  | "enrollRecoveryDns"
  | "revokeRecoveryDns"
  | "registerPushToken"
  | "requestAccountDeletion"
  | "getReviewAccess"
  | "getReviewedAdultDomainFeed"
  | "generateClaraReply"
  | "generateGoogleClaraReply"
  | "generateChallenges"
  | "generateRetentionPlan"
  | "verifyStorePurchase"
  | "getPurchaseCheckoutContext"
  | "verifyAppleStorePurchase"
  | "getApplePurchaseCheckoutContext"
  | "fencePurchaseAccountLink"
  | "getPremiumEntitlement"
  | "getJourneyOfferState"
  | "acknowledgeJourneyOffer"
  | "getLatestEncryptedBackupDownload"
  | "backendReadiness";

export type FirebaseJourneyOfferState = { offerVersion: 1; acknowledged: boolean };
export type FirebaseJourneyOfferRequest = { offerVersion: 1; decision: 'free' | 'purchased'; eventId: string };
function parseJourneyOfferState(value: unknown): FirebaseJourneyOfferState {
  if (!isExactRecord(value, ['offerVersion', 'acknowledged'] as const) || value.offerVersion !== 1 || typeof value.acknowledged !== 'boolean') throw new Error('Invalid journey offer response.');
  return { offerVersion: 1, acknowledged: value.acknowledged };
}

export type FirebaseCoreProductId =
  | "freed_premium_monthly"
  | "freed_premium_yearly"
  | "freed_premium_lifetime";

export type FirebaseVerifyStorePurchaseRequest =
  | {
      platform: "ios";
      productId: FirebaseCoreProductId;
      transactionId: string;
      signedTransactionInfo?: string;
      clientEventId: string;
      restore: boolean;
    }
  | {
      platform: "android";
      productId: FirebaseCoreProductId;
      purchaseToken: string;
      clientEventId: string;
      restore: boolean;
    };

export type FirebaseVerifyStorePurchaseResult = {
  active: boolean;
  entitlementId: "premium";
  productId: FirebaseCoreProductId;
  platform: "ios" | "android";
  status: "verified" | "inactive" | "rejected" | "unavailable";
  expiresAt: string | null;
};

export type FirebasePushRegistrationResult = {
  ok: true;
  duplicate: boolean;
};

export type FirebaseAccountDeletionResult = {
  ok: true;
  status: "deleting" | "processing" | "completed";
};

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
  locale?: 'en' | 'hi' | 'ko' | 'es' | 'pt' | 'fr' | 'de' | 'ar' | 'ja' | 'zh-Hans';
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
  call: (name: FirebaseCallableName, data: unknown, options?: FirebaseCallableOptions) => Promise<unknown>;
};
export type FirebaseLegacyAggregateAnalyticsPayload = {
  day: string;
  checkIns: number;
  completedChallenges: number;
  clientEventId: string;
};
export type FirebaseAggregateAnalyticsSnapshotPayload = {
  schemaVersion: "aggregate-snapshot-v1";
  lineageId: string;
  baseRevision: number;
  snapshotId: string;
  days: Array<{ day: string; checkIns: number; completedChallenges: number }>;
  consentVersion: "analytics-consent-v1";
  userOptedInAt: string;
  dataRetentionDays: number;
};
export type FirebaseAggregateAnalyticsPayload = FirebaseLegacyAggregateAnalyticsPayload | FirebaseAggregateAnalyticsSnapshotPayload;
export type FirebaseBackupMetadataPayload = {
  backupId: string;
  encryptedBytes: number;
  ciphertextSha256: string;
  clientEventId: string;
};
export type FirebaseBackupMutationPayload = { backupId: string; clientEventId: string };
export type FirebaseBackupDownloadPayload = { backupId: string };
export type FirebaseDeletionRequestPayload = { clientEventId: string; expectedAccountUid: string };

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
const FIREBASE_CORE_PRODUCT_IDS = [
  "freed_premium_monthly", "freed_premium_yearly", "freed_premium_lifetime"
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
const AI_REMOTE_CLARA_COPY = [
  "Put the phone down and take three slow breaths. A brief pause gives you room to choose the next action.",
  "Put the phone down and move to another room for two minutes. Changing place interrupts the automatic loop.",
  "Keep the phone out of reach and let the urge rise and fall for two minutes. You only need to protect the next choice.",
  "Unclench your hands, exhale slowly, and choose one small task for the next five minutes. A simple action can lower the pressure.",
  "Lower stimulation and move the phone away from where you rest. Tired moments need a gentler boundary, not more pressure.",
  "Move the phone out of reach and contact a trusted person for a brief check-in. Support can make the next safe action easier."
] as const;
const AI_APPROVED_CHALLENGES: readonly FirebaseRecoveryChallenge[] = [
  {
    id: "breathing-reset", title: "Take three slow breaths", category: "breathing", durationSec: 60, intensity: "calm",
    premium: false, icon: "Waves", steps: ["Put the phone down.", "Breathe in slowly, then exhale longer."],
    why: "Slower breathing creates a short pause before the next action."
  },
  {
    id: "change-room", title: "Change your environment", category: "reset", durationSec: 120, intensity: "medium",
    premium: false, icon: "Footprints", steps: ["Stand up and leave the current room.", "Keep the phone out of reach for two minutes."],
    why: "Changing place interrupts the cue and gives the urge time to settle."
  },
  {
    id: "next-safe-step", title: "Name the next safe step", category: "reflection", durationSec: 90, intensity: "calm",
    premium: false, icon: "Notebook", steps: ["Name what you need for the next ten minutes.", "Choose one small action that supports it."],
    why: "A specific next step makes the automatic loop less powerful."
  },
  {
    id: "cool-water-pause", title: "Take a cool water pause", category: "reset", durationSec: 90, intensity: "calm",
    premium: false, icon: "GlassWater", steps: ["Put the phone down.", "Drink a glass of cool water slowly."],
    why: "A simple physical pause creates distance from the automatic tap."
  },
  {
    id: "phone-boundary", title: "Move the phone out of reach", category: "reset", durationSec: 120, intensity: "medium",
    premium: false, icon: "Shield", steps: ["Place the phone across the room.", "Stay where you are for two quiet minutes."],
    why: "Physical distance adds enough friction to make the next choice deliberate."
  },
  {
    id: "trusted-check-in", title: "Make a trusted check-in", category: "connection", durationSec: 180, intensity: "calm",
    premium: false, icon: "Users", steps: ["Choose one trusted person.", "Send a brief message asking for a check-in."],
    why: "A small connection can make the next safe step easier."
  }
] as const;
const AI_REMOTE_RETENTION_HEADLINES = [
  "Protect today's progress and the next clean day.", "Start with the next clean hour.",
  "Use the pattern without judging yourself.", "Add friction before the pattern builds.",
  "Protect sleep and lower stimulation tonight."
] as const;
const AI_REMOTE_RETENTION_ACTIONS = [
  "Set the guard reminder, then keep the phone outside the highest-risk room tonight.",
  "Complete one honest check-in, then choose one small action for the next hour.",
  "Start one short breathing or environment reset now, then keep the phone out of reach.",
  "Put the phone outside the bedroom before the evening wind-down begins.",
  "Repeat one previously helpful reset before the next risk window."
] as const;
const AI_REMOTE_RETENTION_CHECK_INS = [
  "What is the smallest change that would make the next hour easier?",
  "What is one small action you can complete now?",
  "What is the first safer move when the pattern appears?",
  "What small barrier would make the next risky tap less automatic?"
] as const;
const AI_REMOTE_RETENTION_TAGS = [
  "guard time", "phone boundary", "reset", "check-in", "sleep", "early friction", "body reset", "support"
] as const;
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

export function getFirebaseClientReadiness(env: Env = getPublicClientEnvironment()): FirebaseClientReadiness {
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
export function getFirebaseEmailLinkReadiness(env: Env = getPublicClientEnvironment()): FirebaseEmailLinkReadiness {
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
  async function prepareCredential(provider: FirebaseAuthProvider, input: FirebaseProviderCredentialInput): Promise<{ credential: unknown } | { failure: FirebaseAuthActionResult }> {
    if (provider === "email") {
      const email = typeof input.email === "string" ? sanitizeEmail(input.email) : null;
      if (!email || (input.password !== undefined && input.emailLink !== undefined)) return { failure: invalidResult("A single valid email credential is required.") };
      if (input.emailLink !== undefined) {
        if (!emailLinkReady) return { failure: emailLinkUnconfiguredResult() };
        if (!isUsableEmailLink(input.emailLink) || !isSupportedEmailCredentialLink(input.emailLink, emailLinkDomain) ||
            !(await nativeAuth.isSignInWithEmailLink(input.emailLink))) return { failure: invalidResult("This is not a valid Firebase email sign-in link.") };
        if (!nativeAuth.createEmailLinkCredential) return { failure: authFailureResult("unavailable") };
        return { credential: nativeAuth.createEmailLinkCredential(email, input.emailLink) };
      }
      if (typeof input.password !== "string" || input.password.length < 6 || input.password.length > 1024) return { failure: invalidResult("A valid account email and password are required.") };
      if (!nativeAuth.createEmailCredential) return { failure: authFailureResult("unavailable") };
      return { credential: nativeAuth.createEmailCredential(email, input.password) };
    }
    const credential = providerCredential(nativeAuth, provider, input);
    return credential ? { credential } : { failure: invalidResult(`A valid ${provider} identity credential is required.`) };
  }
  return {
    async reauthenticateProviderCredential(provider: FirebaseAuthProvider, input: FirebaseProviderCredentialInput): Promise<FirebaseAuthActionResult> {
      const current = nativeAuth.currentUser();
      if (!current || current.isAnonymous) return authFailureResult("sign-in-required");
      if (!nativeAuth.reauthenticateWithCredential) return authFailureResult("unavailable");
      const originalUid = current.uid;
      try {
        const prepared = await prepareCredential(provider, input);
        if ("failure" in prepared) return prepared.failure;
        if (nativeAuth.currentUser()?.uid !== originalUid) return authFailureResult("user-changed");
        const { user } = await nativeAuth.reauthenticateWithCredential(prepared.credential);
        if (user.uid !== originalUid || nativeAuth.currentUser()?.uid !== originalUid) return authFailureResult("user-changed");
        return authenticatedResult(user);
      } catch (error) { return authErrorResult(error, "Account confirmation could not be completed. Try again."); }
    },

    async createEmailAccount(input: { email: string; password: string }, options: { linkExisting?: boolean } = {}): Promise<FirebaseAuthActionResult> {
      const email = sanitizeEmail(input.email);
      if (!email) return invalidResult("Enter a valid email address.");
      if (typeof input.password !== "string" || input.password.length < 8 || input.password.length > 1024) return invalidResult("Use a password with at least 8 characters.");
      if (options.linkExisting) return this.linkProviderCredential("email", { email, password: input.password });
      if (nativeAuth.currentUser()?.isAnonymous === false) return authFailureResult("sign-out-required");
      if (!nativeAuth.createEmailAccount) return authFailureResult("unavailable");
      try {
        const current = nativeAuth.currentUser();
        const { user } = await nativeAuth.createEmailAccount(email, input.password);
        if (current && user.uid !== current.uid) return authFailureResult("user-changed");
        return authenticatedResult(user);
      } catch (error) { return authErrorResult(error, "Your email account could not be created. Try again."); }
    },

    async signInWithEmailPassword(input: { email: string; password: string }, options: { linkExisting?: boolean } = {}): Promise<FirebaseAuthActionResult> {
      return options.linkExisting ? this.linkProviderCredential("email", input) : this.exchangeProviderCredential("email", input);
    },

    async requestPasswordReset(email: string): Promise<FirebaseAuthActionResult> {
      const normalizedEmail = sanitizeEmail(email);
      if (!normalizedEmail) return invalidResult("Enter a valid email address.");
      if (!nativeAuth.sendPasswordResetEmail) return authFailureResult("unavailable");
      try {
        await nativeAuth.sendPasswordResetEmail(normalizedEmail);
        return { ok: true, status: "sent" };
      } catch (error) {
        const code = isRecord(error) ? error.code : null;
        if (code === "auth/user-not-found") return { ok: true, status: "sent" };
        return authErrorResult(error, "The reset email could not be sent. Try again.");
      }
    },

    async sendEmailVerification(): Promise<FirebaseAuthActionResult> {
      const user = nativeAuth.currentUser();
      if (!user || user.isAnonymous) return authFailureResult("sign-in-required");
      if (!user.email) return invalidResult("Connect an email address before requesting verification.");
      if (!nativeAuth.sendEmailVerification) return authFailureResult("unavailable");
      try {
        await nativeAuth.sendEmailVerification(user);
        if (nativeAuth.currentUser()?.uid !== user.uid) return authFailureResult("user-changed");
        return { ok: true, status: "sent" };
      } catch (error) { return authErrorResult(error, "The verification email could not be sent. Try again."); }
    },

    async reloadAccount(): Promise<FirebaseAuthActionResult> {
      const current = nativeAuth.currentUser();
      if (!current || current.isAnonymous) return authFailureResult("sign-in-required");
      if (!nativeAuth.reloadCurrentUser) return authFailureResult("unavailable");
      try {
        const { user } = await nativeAuth.reloadCurrentUser(current);
        if (user.uid !== current.uid || nativeAuth.currentUser()?.uid !== current.uid) return authFailureResult("user-changed");
        return authenticatedResult(user);
      } catch (error) { return authErrorResult(error, "Your account could not be refreshed. Try again."); }
    },

    async signInWithAppleProvider(options: { linkExisting?: boolean } = {}): Promise<FirebaseAuthActionResult> {
      if (!nativeAuth.signInWithAppleProvider) return authFailureResult("unavailable");
      try {
        const current = nativeAuth.currentUser();
        if (current?.isAnonymous === false && !options.linkExisting) return authFailureResult("sign-out-required");
        const { user } = await nativeAuth.signInWithAppleProvider({ linkExisting: options.linkExisting === true });
        if (current && user.uid !== current.uid) return authFailureResult("user-changed");
        return { ...authenticatedResult(user), ...(options.linkExisting ? { status: "linked" as const } : {}) };
      } catch (error) { return authErrorResult(error, "Apple sign-in could not be completed. Try again."); }
    },

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
        if (nativeAuth.currentUser()?.isAnonymous === false) return authFailureResult("sign-out-required");
        const result = await nativeAuth.signInWithEmailLink(normalizedEmail, input.emailLink.trim());
        return authenticatedResult(result.user);
      } catch (error) {
        return authErrorResult(error, "Firebase email link could not be completed.");
      }
    },

    async exchangeProviderCredential(
      provider: FirebaseAuthProvider,
      input: FirebaseProviderCredentialInput
    ): Promise<FirebaseAuthActionResult> {
      try {
        const current = nativeAuth.currentUser();
        if (current?.isAnonymous === false) return authFailureResult("sign-out-required");
        const prepared = await prepareCredential(provider, input);
        if ("failure" in prepared) return prepared.failure;
        const { user } = await nativeAuth.signInWithCredential(prepared.credential);
        if (current?.isAnonymous === true && user.uid !== current.uid) return authFailureResult("user-changed");
        return authenticatedResult(user);
      } catch (error) {
        return authErrorResult(error, `Firebase ${provider} sign-in could not be completed.`);
      }
    },

    async linkProviderCredential(provider: FirebaseAuthProvider, input: FirebaseProviderCredentialInput): Promise<FirebaseAuthActionResult> {
      try {
        const current = nativeAuth.currentUser();
        if (!current) return authFailureResult("sign-in-required");
        if (!nativeAuth.linkWithCredential) return authFailureResult("link-unavailable");
        const originalUid = current.uid;
        const prepared = await prepareCredential(provider, input);
        if ("failure" in prepared) return prepared.failure;
        if (nativeAuth.currentUser()?.uid !== originalUid) return authFailureResult("user-changed");
        const { user } = await nativeAuth.linkWithCredential(prepared.credential);
        if (user.uid !== originalUid || nativeAuth.currentUser()?.uid !== originalUid) return authFailureResult("user-changed");
        const authenticated = authenticatedResult(user);
        return authenticated.ok ? { ...authenticated, status: "linked" } : authenticated;
      } catch (error) { return authErrorResult(error, `Firebase ${provider} linking could not be completed.`); }
    },

    getAccountSummary(): FirebaseAccountSummary { return summarizeFirebaseAccount(nativeAuth.currentUser()); },

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
  if (!isExactRecord(input, ["installationId", "token"] as const) ||
      !isToken(input.installationId) || !isFcmRegistrationToken(input.token)) return null;
  return {
    installationId: input.installationId,
    token: input.token,
    recoveryContentIncluded: false
  };
}

export function createFirebaseClientEventId(
  prefix: string,
  fillRandom: (bytes: Uint8Array) => Uint8Array = fillSecureRandom
): string {
  if (!/^[a-z][a-z0-9]{1,15}$/.test(prefix)) {
    throw new Error("Firebase client event ID prefix is invalid.");
  }
  const random = fillRandom(new Uint8Array(16));
  if (!(random instanceof Uint8Array) || random.byteLength !== 16) {
    throw new Error("Secure randomness is unavailable for this Firebase operation.");
  }
  return `${prefix}_${Array.from(random, (byte) => byte.toString(16).padStart(2, "0")).join("")}`;
}

/**
 * Mobile-side boundary for Firebase Functions. It intentionally exposes only
 * bounded aggregates and encrypted-backup metadata, never recovery content.
 */
export type FirebaseRecoveryDnsEnrollment = {
  credentialHash: string; installationId: string; audience: string; clientEventId: string;
  consentVersion: '2026-10-18'; dnsConsent: true; websiteAlertConsent: boolean; retentionAcknowledged: true;
};
export type FirebaseRecoveryDnsReceipt = {
  status: 'enrolled'; installationId: string; ownerGeneration: string; audience: string;
  endpointHost: 'freedrecovery.web.app'; credentialHash: string;
};
export type FirebaseRecoveryDnsAuthority = { installationId: string; credentialHash: string; ownerGeneration: string };
export type FirebaseRecoveryDnsRevocation = { status: 'revoked'; installationId: string; ownerGeneration: string };
export type FirebaseRecoveryDnsOptions = FirebaseCallableOptions & { operationIsCurrent: () => boolean };
const DNS_CLIENT_HASH = /^[a-f0-9]{64}$/;
const DNS_CLIENT_AUDIENCE = /^[a-f0-9]{32}$/;
const DNS_CLIENT_FID = /^[cdef][A-Za-z0-9_-]{21}$/;
const DNS_CLIENT_UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
const dnsMatches = (pattern: RegExp, value: unknown): value is string => typeof value === 'string' && pattern.test(value);
export function assertFirebaseRecoveryDnsEnrollment(value: unknown): asserts value is FirebaseRecoveryDnsEnrollment {
  if (!isExactRecord(value, ['credentialHash', 'installationId', 'audience', 'clientEventId', 'consentVersion', 'dnsConsent', 'websiteAlertConsent', 'retentionAcknowledged']) ||
    !dnsMatches(DNS_CLIENT_HASH, value.credentialHash) || !dnsMatches(DNS_CLIENT_FID, value.installationId) || !dnsMatches(DNS_CLIENT_AUDIENCE, value.audience) || !dnsMatches(DNS_CLIENT_UUID, value.clientEventId) ||
    value.consentVersion !== '2026-10-18' || value.dnsConsent !== true || typeof value.websiteAlertConsent !== 'boolean' || value.retentionAcknowledged !== true) throw new Error('Invalid recovery DNS enrollment metadata.');
}
export function parseFirebaseRecoveryDnsReceipt(value: unknown): FirebaseRecoveryDnsReceipt {
  if (!isExactRecord(value, ['status', 'installationId', 'ownerGeneration', 'audience', 'endpointHost', 'credentialHash']) || value.status !== 'enrolled' || value.endpointHost !== 'freedrecovery.web.app' ||
    !dnsMatches(DNS_CLIENT_FID, value.installationId) || !dnsMatches(DNS_CLIENT_UUID, value.ownerGeneration) || !dnsMatches(DNS_CLIENT_AUDIENCE, value.audience) || !dnsMatches(DNS_CLIENT_HASH, value.credentialHash)) throw new Error('Invalid recovery DNS enrollment receipt.');
  return { status: 'enrolled', installationId: value.installationId, ownerGeneration: value.ownerGeneration, audience: value.audience, endpointHost: 'freedrecovery.web.app', credentialHash: value.credentialHash };
}
function assertDnsAuthority(value: unknown): asserts value is FirebaseRecoveryDnsAuthority {
  if (!isExactRecord(value, ['installationId', 'credentialHash', 'ownerGeneration']) || !dnsMatches(DNS_CLIENT_FID, value.installationId) || !dnsMatches(DNS_CLIENT_HASH, value.credentialHash) || !dnsMatches(DNS_CLIENT_UUID, value.ownerGeneration)) throw new Error('Invalid recovery DNS revocation metadata.');
}
function assertDnsOperation(options: FirebaseRecoveryDnsOptions) {
  if (!options || typeof options.operationIsCurrent !== 'function' || !options.operationIsCurrent()) throw new Error('Recovery DNS account changed.');
}

export function createFirebaseCallableContracts(transport: FirebaseCallableTransport) {
  return {
    enrollRecoveryDns: async (payload: FirebaseRecoveryDnsEnrollment, options: FirebaseRecoveryDnsOptions): Promise<FirebaseRecoveryDnsReceipt> => {
      assertFirebaseRecoveryDnsEnrollment(payload); assertDnsOperation(options);
      const value = await transport.call('enrollRecoveryDns', { ...payload }, { limitedUseAppCheckToken: true, operationIsCurrent: options.operationIsCurrent });
      assertDnsOperation(options);
      const receipt = parseFirebaseRecoveryDnsReceipt(value);
      if (receipt.installationId !== payload.installationId || receipt.credentialHash !== payload.credentialHash || receipt.audience !== payload.audience) throw new Error('Recovery DNS enrollment receipt does not match.');
      return receipt;
    },
    revokeRecoveryDns: async (payload: FirebaseRecoveryDnsAuthority, options: FirebaseRecoveryDnsOptions): Promise<FirebaseRecoveryDnsRevocation> => {
      assertDnsAuthority(payload); assertDnsOperation(options);
      const value = await transport.call('revokeRecoveryDns', { ...payload }, { limitedUseAppCheckToken: true, operationIsCurrent: options.operationIsCurrent });
      assertDnsOperation(options);
      if (!isExactRecord(value, ['status', 'installationId', 'ownerGeneration']) || value.status !== 'revoked' || value.installationId !== payload.installationId || value.ownerGeneration !== payload.ownerGeneration) throw new Error('Invalid recovery DNS revocation receipt.');
      return { status: 'revoked', installationId: payload.installationId, ownerGeneration: payload.ownerGeneration };
    },
    getJourneyOfferState: async (input?: null): Promise<FirebaseJourneyOfferState> => {
      if (input !== undefined && input !== null) throw new Error('Journey read accepts no payload.');
      return parseJourneyOfferState(await transport.call('getJourneyOfferState', input));
    },
    acknowledgeJourneyOffer: async (input: FirebaseJourneyOfferRequest): Promise<FirebaseJourneyOfferState> => {
      if (!isExactRecord(input, ['offerVersion', 'decision', 'eventId'] as const) || input.offerVersion !== 1 ||
        (input.decision !== 'free' && input.decision !== 'purchased') || typeof input.eventId !== 'string' || !/^journey_[0-9a-f]{32}$/.test(input.eventId)) throw new Error('Invalid journey offer decision.');
      return parseJourneyOfferState(await transport.call('acknowledgeJourneyOffer', { offerVersion: 1, decision: input.decision, eventId: input.eventId }));
    },
    fencePurchaseAccountLink: async (): Promise<{ ok: true }> => {
      const result = await transport.call("fencePurchaseAccountLink", undefined);
      if (!isRecord(result) || Object.keys(result).length !== 1 || result.ok !== true) throw new Error("Account linking safety check is unavailable.");
      return { ok: true };
    },
    getCheckoutContext: async (options: {platform?: 'ios'|'android'} = {}): Promise<{ appAccountToken: string; obfuscatedAccountId: string }> => {
      const value = await transport.call(options.platform === 'ios' ? 'getApplePurchaseCheckoutContext' : "getPurchaseCheckoutContext", undefined);
      if (!isRecord(value) || typeof value.appAccountToken !== "string" ||
        !/^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value.appAccountToken) ||
        typeof value.obfuscatedAccountId !== "string" || !/^[0-9a-f]{64}$/.test(value.obfuscatedAccountId)) {
        throw new Error("Invalid purchase identity response.");
      }
      return { appAccountToken: value.appAccountToken, obfuscatedAccountId: value.obfuscatedAccountId };
    },
    getPremiumEntitlement: async () => {
      const value = await transport.call("getPremiumEntitlement", undefined);
      if (!isExactRecord(value, ["entitlement"] as const)) throw new Error("Invalid membership response.");
      if (value.entitlement === null) return { entitlement: null };
      const proof = value.entitlement;
      if (!isExactRecord(proof, ["productId", "platform", "expiresAt", "verifiedAt", "status"] as const) ||
        !isEnum(proof.productId, FIREBASE_CORE_PRODUCT_IDS) || !isEnum(proof.platform, ["ios", "android"]) ||
        !isEnum(proof.status, ["verified", "inactive", "revoked"]) ||
        typeof proof.verifiedAt !== "string" || !Number.isFinite(Date.parse(proof.verifiedAt)) ||
        (proof.expiresAt !== null && (typeof proof.expiresAt !== "string" || !Number.isFinite(Date.parse(proof.expiresAt)))) ||
        (proof.status === "verified" && proof.expiresAt === null && proof.productId !== "freed_premium_lifetime")) {
        throw new Error("Invalid membership response.");
      }
      return { entitlement: { productId: proof.productId, platform: proof.platform, expiresAt: proof.expiresAt,
        verifiedAt: proof.verifiedAt, status: proof.status } };
    },
    getLatestBackupDownload: () => transport.call("getLatestEncryptedBackupDownload", undefined),
    ingestAggregateAnalytics: async (payload: FirebaseAggregateAnalyticsPayload) => {
      if (!("schemaVersion" in payload)) {
        assertCallablePayload(payload, ["day", "checkIns", "completedChallenges", "clientEventId"]);
        return transport.call("ingestAggregateAnalytics", payload);
      }
      assertCallablePayload(payload, ["schemaVersion", "lineageId", "baseRevision", "snapshotId", "days", "consentVersion", "userOptedInAt", "dataRetentionDays"]);
      if (payload.schemaVersion !== "aggregate-snapshot-v1" || !/^lin_[a-f0-9]{32}$/.test(payload.lineageId) ||
          !/^snap_[a-f0-9]{64}$/.test(payload.snapshotId) || !Number.isSafeInteger(payload.baseRevision) || payload.baseRevision < 0 ||
          payload.consentVersion !== "analytics-consent-v1" || typeof payload.userOptedInAt !== "string" || !Number.isFinite(Date.parse(payload.userOptedInAt)) ||
          payload.dataRetentionDays !== 14 || !Array.isArray(payload.days) || payload.days.length !== 14) throw new Error("Invalid aggregate analytics snapshot.");
      for (const [index, bucket] of payload.days.entries()) {
        assertCallablePayload(bucket, ["day", "checkIns", "completedChallenges"]);
        const timestamp = Date.parse(`${bucket.day}T00:00:00.000Z`);
        if (!/^\d{4}-\d{2}-\d{2}$/.test(bucket.day) || !Number.isFinite(timestamp) || new Date(timestamp).toISOString().slice(0, 10) !== bucket.day ||
            !Number.isSafeInteger(bucket.checkIns) || bucket.checkIns < 0 || !Number.isSafeInteger(bucket.completedChallenges) || bucket.completedChallenges < 0 ||
            (index > 0 && timestamp - Date.parse(`${payload.days[index - 1].day}T00:00:00.000Z`) !== 86_400_000)) throw new Error("Invalid aggregate analytics day counts.");
      }
      const response = await transport.call("ingestAggregateAnalytics", payload);
      if (isExactRecord(response, ["ok", "schemaVersion", "lineageId", "baseRevision", "snapshotId", "recovery"]) && response.ok === false &&
          response.schemaVersion === payload.schemaVersion && response.lineageId === payload.lineageId && response.snapshotId === payload.snapshotId &&
          response.baseRevision === payload.baseRevision && (response.recovery === "refresh-window" || response.recovery === "new-lineage")) return response;
      if (!isExactRecord(response, ["ok", "schemaVersion", "lineageId", "snapshotId", "acceptedRevision", "duplicate"]) || response.ok !== true ||
          response.schemaVersion !== payload.schemaVersion || response.lineageId !== payload.lineageId || response.snapshotId !== payload.snapshotId ||
          response.acceptedRevision !== payload.baseRevision + 1 || typeof response.duplicate !== "boolean") throw new Error("Firebase has not acknowledged this aggregate snapshot schema and revision.");
      return response;
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
    registerPushToken: async (payload: FirebaseMessagingRegistration & { clientEventId: string }): Promise<FirebasePushRegistrationResult> => {
      assertCallablePayload(payload, ["installationId", "token", "recoveryContentIncluded", "clientEventId"]);
      if (payload.recoveryContentIncluded !== false) throw new Error("Recovery content is not permitted in Firebase callable payloads.");
      return parseFirebasePushRegistrationResult(await transport.call("registerPushToken", {
        installationId: payload.installationId,
        token: payload.token,
        clientEventId: payload.clientEventId
      }));
    },
    requestAccountDeletion: async (payload: FirebaseDeletionRequestPayload): Promise<FirebaseAccountDeletionResult> => {
      assertCallablePayload(payload, ["clientEventId", "expectedAccountUid"]);
      if (!isFirebaseAuthUid(payload.expectedAccountUid)) throw new Error("Confirm the current account before deleting hosted data.");
      return parseFirebaseAccountDeletionResult(await transport.call(
        "requestAccountDeletion",
        payload,
        { limitedUseAppCheckToken: true }
      ));
    },
    verifyStorePurchase: async (payload: FirebaseVerifyStorePurchaseRequest): Promise<FirebaseVerifyStorePurchaseResult> => {
      assertFirebaseVerifyStorePurchaseRequest(payload);
      return parseFirebaseVerifyStorePurchaseResult(await transport.call(
        payload.platform === 'ios' ? 'verifyAppleStorePurchase' : "verifyStorePurchase",
        payload,
        { limitedUseAppCheckToken: true }
      ));
    },
    getReviewAccess: async (payload?: null): Promise<ReviewAccessSnapshot> => {
      if (payload !== undefined && payload !== null) throw new Error("Review access accepts no payload.");
      return parseReviewAccessSnapshot(await transport.call("getReviewAccess", payload));
    },
    getReviewedAdultDomainFeed: async (): Promise<FirebaseReviewedAdultDomainFeed> =>
      parseFirebaseReviewedAdultDomainFeed(await transport.call("getReviewedAdultDomainFeed", undefined)),
    generateClaraReply: async (payload: FirebaseClaraRequest): Promise<FirebaseClaraResult> => {
      assertFirebaseClaraRequest(payload);
      return parseFirebaseClaraResult(await transport.call("generateClaraReply", payload));
    },
    generateGoogleClaraReply: async (payload:ClaraCloudPayload,operationIsCurrent:()=>boolean) => {
      if(!operationIsCurrent())throw new Error('Cloud-chat operation changed.');
      if(Object.keys(payload).sort().join(',')!=='clientEventId,consentVersion,conversation,input,locale' || payload.consentVersion!=='clara-cloud-v1')throw new Error('Invalid cloud-chat request.');
      return parseClaraCloudResult(await transport.call('generateGoogleClaraReply',payload,{limitedUseAppCheckToken:true,operationIsCurrent}));
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

export function parseFirebasePushRegistrationResult(value: unknown): FirebasePushRegistrationResult {
  if (!isExactRecord(value, ["ok", "duplicate"] as const) || value.ok !== true || typeof value.duplicate !== "boolean") {
    throw new Error("Invalid Firebase push registration response.");
  }
  return { ok: true, duplicate: value.duplicate };
}

export function parseFirebaseAccountDeletionResult(value: unknown): FirebaseAccountDeletionResult {
  if (!isExactRecord(value, ["ok", "status"] as const) || value.ok !== true || !isEnum(value.status, ["deleting", "processing", "completed"] as const)) {
    throw new Error("Invalid Firebase account deletion response.");
  }
  return { ok: true, status: value.status };
}

export function parseFirebaseVerifyStorePurchaseResult(value: unknown): FirebaseVerifyStorePurchaseResult {
  if (!isExactRecord(value, ["active", "entitlementId", "productId", "platform", "status", "expiresAt"] as const) ||
    typeof value.active !== "boolean" || value.entitlementId !== "premium" ||
    !isEnum(value.productId, FIREBASE_CORE_PRODUCT_IDS) || !isEnum(value.platform, ["ios", "android"] as const) ||
    !isEnum(value.status, ["verified", "inactive", "rejected", "unavailable"] as const)) {
    invalidPurchaseResponse();
  }
  const verified = value.status === "verified";
  const lifetime = value.productId === "freed_premium_lifetime";
  const validExpiry = verified
    ? lifetime
      ? value.expiresAt === null
      : isCanonicalFutureIsoTimestamp(value.expiresAt)
    : value.expiresAt === null;
  if (value.active !== verified || !validExpiry) invalidPurchaseResponse();
  const expiresAt = value.expiresAt as string | null;
  return {
    active: value.active,
    entitlementId: "premium",
    productId: value.productId,
    platform: value.platform,
    status: value.status,
    expiresAt
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
  if (!isEnum(value.text, AI_REMOTE_CLARA_COPY)) invalidAiResponse();
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
  if (challenges.some((challenge) => !matchesApprovedFirebaseChallenge(challenge))) invalidAiResponse();
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
  if (
    !isEnum(plan.headline, AI_REMOTE_RETENTION_HEADLINES) ||
    !isEnum(plan.nextBestAction, AI_REMOTE_RETENTION_ACTIONS) ||
    !isEnum(plan.checkInPrompt, AI_REMOTE_RETENTION_CHECK_INS) ||
    !plan.focusTags.every((tag) => isEnum(tag, AI_REMOTE_RETENTION_TAGS))
  ) {
    invalidAiResponse();
  }
  return { ...plan, provider: "remote", status: "ok" };
}

function assertFirebaseClaraRequest(value: FirebaseClaraRequest): void {
  const valid = isExactRecord(value, (value.locale === undefined ? ["clientEventId", "input", "context"] : ["clientEventId", "input", "context", "locale"]) as readonly string[]) &&
    (value.locale === undefined || ['en','hi','es','pt','fr','de','ar','ja','ko','zh-Hans'].includes(value.locale)) &&
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

function assertFirebaseVerifyStorePurchaseRequest(value: FirebaseVerifyStorePurchaseRequest): void {
  const common = isRecord(value) && isEnum(value.productId, FIREBASE_CORE_PRODUCT_IDS) &&
    isAiEventId(value.clientEventId) && typeof value.restore === "boolean";
  if (value.platform === "ios") {
    const keys = value.signedTransactionInfo === undefined
      ? ["platform", "productId", "transactionId", "clientEventId", "restore"] as const
      : ["platform", "productId", "transactionId", "clientEventId", "restore", "signedTransactionInfo"] as const;
    const proofValid = value.signedTransactionInfo === undefined ||
      (typeof value.signedTransactionInfo === "string" && value.signedTransactionInfo.length <= 64 * 1024 &&
        /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(value.signedTransactionInfo));
    if (!common || !isExactRecord(value, keys) || !proofValid || purchasePayloadBytes(value) > 72 * 1024 ||
      typeof value.transactionId !== "string" || !/^\d{8,32}$/.test(value.transactionId)) invalidPurchaseRequest();
    return;
  }
  if (value.platform === "android") {
    if (!common || purchasePayloadBytes(value) > 16 * 1024 || !isExactRecord(value, ["platform", "productId", "purchaseToken", "clientEventId", "restore"] as const) ||
      typeof value.purchaseToken !== "string" || value.purchaseToken.length < 16 || value.purchaseToken.length > 4096 ||
      !/^[\x21-\x7E]+$/.test(value.purchaseToken) || value.purchaseToken.includes("://")) invalidPurchaseRequest();
    return;
  }
  invalidPurchaseRequest();
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

function matchesApprovedFirebaseChallenge(value: FirebaseRecoveryChallenge): boolean {
  const approved = AI_APPROVED_CHALLENGES.find((item) => item.id === value.id);
  return Boolean(
    approved && value.title === approved.title && value.category === approved.category &&
    value.durationSec === approved.durationSec && value.intensity === approved.intensity &&
    value.premium === false && value.icon === approved.icon && value.why === approved.why &&
    value.steps.length === approved.steps.length && value.steps.every((step, index) => step === approved.steps[index])
  );
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isCanonicalIsoTimestamp(value: unknown): value is string {
  if (typeof value !== "string" || value.length !== 24) return false;
  const milliseconds = Date.parse(value);
  return Number.isFinite(milliseconds) && new Date(milliseconds).toISOString() === value;
}

function isCanonicalFutureIsoTimestamp(value: unknown): value is string {
  return isCanonicalIsoTimestamp(value) && Date.parse(value) > Date.now();
}

function purchasePayloadBytes(value: unknown): number {
  try {
    return new TextEncoder().encode(JSON.stringify(value)).byteLength;
  } catch {
    return Number.POSITIVE_INFINITY;
  }
}

function invalidPurchaseRequest(): never {
  throw new Error("This data is not permitted in Firebase purchase callable payloads.");
}

function invalidPurchaseResponse(): never {
  throw new Error("Invalid Firebase purchase callable response.");
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
  return isFirebaseAuthUid(user.uid) ? { ok: true, status: "authenticated", uid: user.uid } : { ok: false, status: "error", reason: "Firebase did not return a user identity." };
}

function isFirebaseAuthUid(value: unknown): value is string { return typeof value === "string" && value.trim().length >= 1 && value.length <= 128; }

function authFailureResult(code: AuthIdentityFailureReason): FirebaseAuthActionResult {
  return { ok: false, status: "error", code, reason: getAuthIdentityFailureMessage(code) };
}

function isSupportedEmailCredentialLink(link: string, domain: string | undefined): boolean {
  if (!isFirebaseEmailLinkDomain(domain)) return false;
  try {
    const parsed = new URL(link);
    return parsed.protocol === "https:" && parsed.hostname === domain && parsed.username === "" && parsed.password === "" &&
      parsed.port === "" && parsed.hash === "" && [FIREBASE_EMAIL_LINK_PATH, "/__/auth/action"].includes(parsed.pathname);
  } catch { return false; }
}

function authErrorResult(error: unknown, fallback: string): FirebaseAuthActionResult {
  const code = error && typeof error === "object" && "code" in error ? error.code : null;
  const codes: Record<string, AuthIdentityFailureReason> = {
    "auth/credential-already-in-use": "account-conflict", "auth/account-exists-with-different-credential": "account-conflict",
    "auth/email-already-in-use": "account-conflict", "auth/user-mismatch": "account-conflict",
    "auth/provider-already-linked": "provider-already-linked", "account-conflict": "account-conflict",
    "provider-already-linked": "provider-already-linked", "user-changed": "user-changed", "sign-in-required": "sign-in-required",
    "sign-out-required": "sign-out-required", "link-unavailable": "link-unavailable", unavailable: "unavailable"
  };
  if (["auth/web-context-cancelled", "auth/web-context-canceled", "auth/user-cancelled"].includes(String(code))) return { ok: false, status: "cancelled", reason: "Sign-in was cancelled." };
  const messages: Record<string, string> = {
    "auth/invalid-credential": "The email or password is incorrect. Try again or reset your password.",
    "auth/wrong-password": "The email or password is incorrect. Try again or reset your password.",
    "auth/user-not-found": "The email or password is incorrect. Try again or reset your password.",
    "auth/invalid-email": "Enter a valid email address.",
    "auth/weak-password": "Choose a stronger password with at least 8 characters.",
    "auth/too-many-requests": "Too many attempts. Wait a little before trying again.",
    "auth/network-request-failed": "Check your connection and try again.",
    "auth/operation-not-allowed": "This sign-in method is unavailable right now. Try another method.",
    "auth/user-disabled": "This account is unavailable. Contact FREED support."
  };
  if (typeof code === "string" && Object.prototype.hasOwnProperty.call(messages, code)) return { ok: false, status: "error", reason: messages[code] };
  return typeof code === "string" && Object.prototype.hasOwnProperty.call(codes, code) ? authFailureResult(codes[code])
    : { ok: false, status: "error", reason: fallback };
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

function isFcmRegistrationToken(value: unknown): value is string {
  return typeof value === "string" && value.trim() === value && /^[A-Za-z0-9:_-]{20,4096}$/.test(value) &&
    !/(?:placeholder|replace(?:[_-]?me)?|example|your[_-]?fcm|test[_-]?token|dummy)/i.test(value) &&
    !/^([A-Za-z0-9])\1{19,}$/.test(value);
}

function fillSecureRandom(bytes: Uint8Array): Uint8Array {
  if (typeof globalThis.crypto?.getRandomValues !== "function") {
    throw new Error("Secure randomness is unavailable for this Firebase operation.");
  }
  globalThis.crypto.getRandomValues(bytes);
  return bytes;
}
import {parseClaraCloudResult,type ClaraCloudPayload} from './clara-conversation';
