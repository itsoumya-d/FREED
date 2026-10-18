const { spawnSync } = require("node:child_process");
const { existsSync, lstatSync, mkdirSync, readFileSync, writeFileSync } = require("node:fs");
const { createHash } = require("node:crypto");
const { isDeepStrictEqual } = require("node:util");
const { dirname, isAbsolute, relative, resolve } = require("node:path");
const { parseAdultDomainFeedSourceConfigWithIssues } = require("./lib/adult-domain-feed-source-contract");
const { expandEnvFileHome, loadEnvFile } = require("./lib/env-file-loader");
const { envFilePathIssue } = require("./lib/env-file-safety");
const { sanitizeLocalHomePaths } = require("./lib/local-path-privacy");
const { productionBlockerGroups } = require("./lib/release-blocker-groups");
const { assertSafeReportPath: assertSafeWorkspaceReportPath, reportPathIssue: sharedReportPathIssue } = require("./lib/report-path-safety");

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "0.0.0.0", "::", "::1"]);
const PLACEHOLDER_HOSTS = new Set(["example.com", "example.net", "example.org"]);
const RESERVED_TLDS = [".example", ".invalid", ".localhost", ".test"];
const GOOGLE_SAMPLE_ADMOB_PUBLISHER = "ca-app-pub-3940256099942544";
const ANDROID_DEBUG_CERT_SHA256 = "fac61745dc0903786fb9ede62a962b399f7348f0bb6f899b8332667591033b9c";
const FREED_AUTH_REDIRECT_SCHEMES = new Set(["freed:", "app.freed.recovery:"]);
const FORBIDDEN_PUBLIC_SERVER_SECRET_PREFIXES = [
  "EXPO_PUBLIC_SUPABASE_SERVICE_ROLE",
  "EXPO_PUBLIC_SUPABASE_JWT_SECRET",
  "EXPO_PUBLIC_SUPABASE_DB_PASSWORD",
  "EXPO_PUBLIC_BACKEND_MAINTENANCE_SECRET",
  "EXPO_PUBLIC_CRON_SECRET",
  "EXPO_PUBLIC_REDIS",
  "EXPO_PUBLIC_UPSTASH",
  "EXPO_PUBLIC_OPENAI",
  "EXPO_PUBLIC_GEMINI",
  "EXPO_PUBLIC_GOOGLE_API",
  "EXPO_PUBLIC_GOOGLE_GENAI",
  "EXPO_PUBLIC_APP_STORE_PRIVATE_KEY",
  "EXPO_PUBLIC_APP_STORE_SERVER_API_JWT",
  "EXPO_PUBLIC_GOOGLE_PLAY_SERVICE_ACCOUNT",
  "EXPO_PUBLIC_GOOGLE_PLAY_ACCESS_TOKEN",
  "EXPO_PUBLIC_FCM_SERVER",
  "EXPO_PUBLIC_FCM_ACCESS_TOKEN",
  "EXPO_PUBLIC_APPLE_STORE_PRIVATE_KEY",
  "EXPO_PUBLIC_APPLE_STORE_ROOT_CAS",
  "EXPO_PUBLIC_FIREBASE_SERVICE_ACCOUNT",
  "EXPO_PUBLIC_REMOTE_NOTIFICATION_DISPATCH_SECRET",
  "EXPO_PUBLIC_APNS"
];
const FIREBASE_PROJECT_ID = "freed-7d5ee";
const FIREBASE_FUNCTIONS_REGION = "asia-south1";
const FIREBASE_REQUIRED_SECRET_NAMES = ["APPLE_STORE_ISSUER_ID", "APPLE_STORE_KEY_ID", "APPLE_STORE_PRIVATE_KEY", "APPLE_STORE_APP_ID", "APPLE_STORE_ROOT_CAS_BASE64", "GOOGLE_PLAY_SERVICE_ACCOUNT_JSON"];
const FIREBASE_REQUIRED_CALLABLE_NAMES = ["backendReadiness", "verifyStorePurchase", "getPurchaseCheckoutContext", "getPremiumEntitlement", "fencePurchaseAccountLink", "getApplePurchaseCheckoutContext", "verifyAppleStorePurchase", "generateGoogleClaraReply", "getReviewedAdultDomainFeed", "ingestAggregateAnalytics", "startEncryptedBackupUpload", "finalizeEncryptedBackupUpload", "getEncryptedBackupDownload", "getLatestEncryptedBackupDownload", "deleteEncryptedBackup", "registerPushToken", "requestAccountDeletion"];
const FIREBASE_PREFLIGHT_IDS = ["firebase-backend-config", "firebase-native-app-identifiers", "firebase-server-secret-configuration", "firebase-production-runtime-evidence"];
const COMMON_PREFLIGHT_IDS = ["server-secret-public-leakage", "release-monetization-mode", "store-provider", "iap-product-ids", "android-release-signing", "revenuecat-fallback-keys", "admob-app-ids", "admob-rewarded-units", "admob-test-ads-disabled", "admob-request-country", "optional-challenge-weather-context"];
const LEGACY_PREFLIGHT_IDS = ["server-secret-public-leakage", "release-monetization-mode", "store-provider", "iap-product-ids", "purchase-verify-endpoint", "app-store-environment", "app-store-verification-credentials", "google-play-verification-credentials", "android-release-signing", "revenuecat-fallback-keys", "admob-app-ids", "admob-rewarded-units", "admob-test-ads-disabled", "admob-request-country", "ai-coach-mode", "ai-coach-endpoint", "ai-challenge-mode", "ai-challenge-endpoint", "adult-domain-feed-endpoint", "adult-domain-feed-sources", "supabase-backend-credentials", "redis-backend-infrastructure", "backend-readiness-endpoint", "remote-notification-provider-credentials", "optional-challenge-weather-context", "analytics-ingestion-endpoint", "optional-recovery-backup-sync-endpoint", "optional-supabase-auth-client", "optional-retention-endpoint", "server-ai-key"];

function getBackendProvider(env = process.env) {
  const value = (readEnv(env, "EXPO_PUBLIC_BACKEND_PROVIDER") || "firebase").toLowerCase();
  if (!["firebase", "legacy", "supabase"].includes(value)) throw new Error("EXPO_PUBLIC_BACKEND_PROVIDER must be firebase or legacy.");
  return value === "supabase" ? "legacy" : value;
}

function getPreflightCheckIds(provider = getBackendProvider()) {
  return provider === "firebase" ? [...COMMON_PREFLIGHT_IDS, ...FIREBASE_PREFLIGHT_IDS] : [...LEGACY_PREFLIGHT_IDS];
}

function firebaseLaunchProductIdIssues(env = process.env) {
  return [["EXPO_PUBLIC_IAP_PRODUCT_YEARLY", "freed_premium_yearly"], ["EXPO_PUBLIC_IAP_PRODUCT_MONTHLY", "freed_premium_monthly"]]
    .filter(([key, productId]) => (readEnv(env, key) || productId) !== productId)
    .map(([key]) => `${key} must match the approved Firebase launch product identifier`);
}

function getLegalUrls(env = process.env) {
  return Object.fromEntries(["privacy", "support", "account-deletion"].map(id => {
    const url = readEnv(env, `FREED_LEGAL_${id.toUpperCase().replace(/-/g, "_")}_URL`) || `https://freed-landing.web.app/${id}`;
    if (endpointIssues(url, "legal URL").length) throw new Error(`Invalid configured legal ${id} URL; use a production-safe HTTPS page.`);
    return [id, url];
  }));
}

function proofPathIsSafe(base, path, prefix) {
  const absolute = resolve(base, path);
  const relativePath = relative(base, absolute).replace(/\\/g, "/");
  if (!relativePath.startsWith(prefix) || relativePath.includes("..")) return false;
  let current = base;
  for (const segment of relativePath.split("/")) {
    current = resolve(current, segment);
    if (lstatSync(current).isSymbolicLink()) return false;
  }
  return lstatSync(absolute).isFile();
}

function readNativeFirebaseIdentities(base = process.cwd()) {
  const issues = [];
  let android = null;
  let ios = null;
  try {
    const data = JSON.parse(readFileSync(resolve(base, "android/app/google-services.json"), "utf8"));
    const client = data.client?.find(entry => entry.client_info?.android_client_info?.package_name === "app.freed.recovery");
    const appId = client?.client_info?.mobilesdk_app_id;
    if (data.project_info?.project_id !== FIREBASE_PROJECT_ID || !/^1:\d+:android:[a-f0-9]{20,40}$/.test(appId || "")) throw new Error();
    android = { appId, packageName: "app.freed.recovery" };
  } catch { issues.push("Android Google services must identify freed-7d5ee and app.freed.recovery with a native Android app ID"); }
  try {
    const source = readFileSync(resolve(base, "ios/FREED/GoogleService-Info.plist"), "utf8");
    const value = key => source.match(new RegExp(`<key>${key}</key>\\s*<string>([^<]+)</string>`))?.[1];
    const appId = value("GOOGLE_APP_ID");
    if (value("PROJECT_ID") !== FIREBASE_PROJECT_ID || value("BUNDLE_ID") !== "app.freed.recovery" || !/^1:\d+:ios:[a-f0-9]{20,40}$/.test(appId || "")) throw new Error();
    ios = { appId, bundleId: "app.freed.recovery" };
  } catch { issues.push("iOS Google services must identify freed-7d5ee and app.freed.recovery with a native iOS app ID"); }
  if (android && ios && android.appId.split(":")[1] !== ios.appId.split(":")[1]) issues.push("Firebase native apps must share the production project number");
  return { issues, android, ios };
}

function firebaseReportSecretIssue(text) {
  return /-----BEGIN (?:EC |RSA )?PRIVATE KEY-----|\bsk-(?:proj-)?[A-Za-z0-9_-]{20,}\b|\bAIza[0-9A-Za-z_-]{30,}\b|\bya29\.[A-Za-z0-9._-]{20,}\b|\bBearer\s+(?!\[?redacted)[A-Za-z0-9._~:/+=-]{16,}|\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]{16,}\.[A-Za-z0-9_-]{8,}|"(?:purchaseToken|receipt|idToken|accessToken|private_key|client_email|passphrase|privateNotes|rawUrl|browsingHistory|contacts|latitude|longitude)"\s*:|https?:\/\/[^/\s"'<>:@]+:[^/\s"'<>@]+@/i.test(text);
}

function onlyKnownKeys(value, keys) {
  return value && typeof value === "object" && !Array.isArray(value) && Object.keys(value).every(key => keys.includes(key));
}

function freshTimestamp(value, now = Date.now()) {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value) &&
    Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value && now - Date.parse(value) <= 24 * 60 * 60 * 1000 && Date.parse(value) <= now + 5 * 60 * 1000;
}

function firebaseRuntimeEvidenceIssues(env = process.env, base = process.cwd()) {
  const path = readEnv(env, "FREED_FIREBASE_RUNTIME_EVIDENCE") || "docs/validation/evidence/firebase-production-runtime.json";
  const issues = [];
  let evidence;
  try {
    const absolute = resolve(base, path);
    const relativePath = relative(base, absolute).replace(/\\/g, "/");
    if (!proofPathIsSafe(base, path, "docs/validation/")) throw new Error();
    const raw = readFileSync(absolute, "utf8");
    if (raw.length > 2_000_000 || firebaseReportSecretIssue(raw)) return ["Firebase runtime evidence must be sanitized and must not contain raw credentials, receipts, or private recovery fields"];
    evidence = JSON.parse(raw);
  } catch { return ["Missing readable sanitized Firebase production runtime evidence (FREED_FIREBASE_RUNTIME_EVIDENCE)"]; }
  if (evidence.schemaVersion !== "freed-firebase-production-runtime-v2" || evidence.sanitized !== true || evidence.result !== "pass") issues.push("Firebase runtime evidence needs the production schema, sanitized=true, and result=pass");
  if (!onlyKnownKeys(evidence, ["schemaVersion", "generatedAt", "sanitized", "result", "source", "environment", "buildMode", "projectId", "functionsRegion", "nativeApps", "deployedCallables", "callableResults", "deployedSecretNames", "appCheck", "captureArtifacts", "claraEvidence"])) issues.push("Firebase runtime evidence contains unsupported fields rather than bounded sanitized capture metadata");
  if (!freshTimestamp(evidence.generatedAt)) issues.push("Firebase runtime evidence is stale or has an invalid/future timestamp; capture fresh proof within 24 hours");
  if (evidence.source !== "production-native" || evidence.environment !== "production" || evidence.buildMode !== "release") issues.push("Firebase runtime evidence must come from production-native release apps, not emulator, fixture, or configuration-only checks");
  if (evidence.projectId !== FIREBASE_PROJECT_ID || evidence.functionsRegion !== FIREBASE_FUNCTIONS_REGION) issues.push("Firebase runtime evidence must target freed-7d5ee in asia-south1");
  const identities = readNativeFirebaseIdentities(base);
  if (identities.issues.length || !isDeepStrictEqual(evidence.nativeApps, { android: identities.android, ios: identities.ios })) issues.push("Runtime evidence native app IDs must match the actual production Google service files");
  const deployed = Array.isArray(evidence.deployedCallables) ? evidence.deployedCallables : [];
  if (FIREBASE_REQUIRED_CALLABLE_NAMES.some(name => !deployed.includes(name))) issues.push("Missing deployed Firebase callable inventory for launch services");
  const smoke = Array.isArray(evidence.callableResults) ? evidence.callableResults : [];
  if (smoke.some(entry => !onlyKnownKeys(entry, ["name", "status", "authenticated", "appCheckAccepted", "contractValidated", "remoteProviderConfirmed"]))) issues.push("Firebase callable smoke proof must omit tokens, prompts, transcripts, and raw response bodies");
  if (FIREBASE_REQUIRED_CALLABLE_NAMES.some(name => !smoke.some(entry => entry.name === name && entry.status === "pass" && entry.authenticated === true && entry.appCheckAccepted === true && entry.contractValidated === true))) issues.push("Missing fresh authenticated, AppCheck-accepted Firebase callable smoke contract results");
  const clara = evidence.claraEvidence;
  try {
    if (!onlyKnownKeys(clara, ["path", "sha256"]) || !/^[a-f0-9]{64}$/.test(clara.sha256 || "")) throw new Error();
    const contract = require("./lib/google-clara-release-evidence");
    const raw = readFileSync(contract.safeFile(base, clara.path), "utf8");
    if (contract.sha(raw) !== clara.sha256) throw new Error();
    issues.push(...contract.reportIssues(JSON.parse(raw), base));
  } catch { issues.push("Missing checksummed current signed-client and attached Google CLARA runtime/provider proof"); }
  if (new Set(smoke.map(entry => entry.name)).size !== smoke.length) issues.push("Duplicate Firebase callable result names");
  if (!smoke.some(entry => entry.name === "generateGoogleClaraReply" && entry.remoteProviderConfirmed === true)) issues.push("Google CLARA requires genuine attached runtime remote provider success; fallback and owner-token smoke do not count");
  const secrets = Array.isArray(evidence.deployedSecretNames) ? evidence.deployedSecretNames : [];
  if (FIREBASE_REQUIRED_SECRET_NAMES.some(name => !secrets.includes(name))) issues.push("Missing deployed Firebase Secret Manager name inventory for Apple and Play credentials");
  const appCheck = evidence.appCheck;
  if (!onlyKnownKeys(appCheck, ["enforced", "debugTokensEnabled", "unauthenticatedRejected", "invalidAppCheckRejected", "iosProvider", "androidProvider"])) issues.push("AppCheck proof must contain sanitized enforcement metadata only");
  if (!appCheck || appCheck.enforced !== true || appCheck.debugTokensEnabled !== false || appCheck.unauthenticatedRejected !== true || appCheck.invalidAppCheckRejected !== true || appCheck.iosProvider !== "appAttestWithDeviceCheckFallback" || appCheck.androidProvider !== "playIntegrity") issues.push("Missing production AppCheck enforcement and rejection proofs for iOS and Android");
  for (const kind of ["nativeApps", "deployedCallables", "callableResults", "deployedSecretNames", "appCheck"]) {
    const artifact = Array.isArray(evidence.captureArtifacts) ? evidence.captureArtifacts.find(entry => entry.kind === kind) : null;
    try {
      if (!onlyKnownKeys(artifact, ["kind", "path", "sha256"]) || typeof artifact.path !== "string" || !/^[a-f0-9]{64}$/.test(artifact.sha256 || "")) throw new Error();
      const absolute = resolve(base, artifact.path);
      const relativePath = relative(base, absolute).replace(/\\/g, "/");
      if (!proofPathIsSafe(base, artifact.path, "docs/validation/artifacts/")) throw new Error();
      const raw = readFileSync(absolute, "utf8");
      if (raw.length > 2_000_000 || firebaseReportSecretIssue(raw) || createHash("sha256").update(raw).digest("hex") !== artifact.sha256) throw new Error();
      const capture = JSON.parse(raw);
      if (!onlyKnownKeys(capture, ["schemaVersion", "source", "sanitized", "generatedAt", "kind", "proof"]) || capture.schemaVersion !== "freed-firebase-native-capture-v1" || capture.source !== "production-native" || capture.sanitized !== true || !freshTimestamp(capture.generatedAt) || capture.kind !== kind || !isDeepStrictEqual(capture.proof, evidence[kind])) throw new Error();
    } catch { issues.push(`Missing fresh sanitized checksummed production capture artifact for ${kind}`); }
  }
  return issues;
}

function getFirebasePreflightChecks(env = process.env, base = process.cwd()) {
  const configIssues = [];
  if (getBackendProvider(env) !== "firebase") configIssues.push("EXPO_PUBLIC_BACKEND_PROVIDER must select firebase");
  if ((readEnv(env, "EXPO_PUBLIC_FIREBASE_ENV") || "production") !== "production") configIssues.push("EXPO_PUBLIC_FIREBASE_ENV must be production for release");
  if (readEnv(env, "EXPO_PUBLIC_FIREBASE_PROJECT_ID") && readEnv(env, "EXPO_PUBLIC_FIREBASE_PROJECT_ID") !== FIREBASE_PROJECT_ID) configIssues.push("Firebase public project ID must match freed-7d5ee");
  if (readEnv(env, "FREED_FIREBASE_FUNCTIONS_REGION") && readEnv(env, "FREED_FIREBASE_FUNCTIONS_REGION") !== FIREBASE_FUNCTIONS_REGION) configIssues.push("Firebase Functions region must be asia-south1");
  if (readEnv(env, "EXPO_PUBLIC_FIREBASE_APP_CHECK_DEBUG_PROVIDER") || readEnv(env, "EXPO_PUBLIC_FIREBASE_APP_CHECK_DEBUG_TOKEN")) configIssues.push("Firebase debug AppCheck is forbidden in production release configuration");
  try { if (JSON.parse(readFileSync(resolve(base, ".firebaserc"), "utf8")).projects?.default !== FIREBASE_PROJECT_ID) throw new Error(); }
  catch { configIssues.push(".firebaserc must select the actual freed-7d5ee production project"); }
  const identities = readNativeFirebaseIdentities(base);
  const missingSecrets = FIREBASE_REQUIRED_SECRET_NAMES.filter(name => !hasUsable(env, name));
  const malformed = [];
  if (hasUsable(env, "APPLE_STORE_ISSUER_ID") && !isAppleIssuerId(readEnv(env, "APPLE_STORE_ISSUER_ID"))) malformed.push("APPLE_STORE_ISSUER_ID");
  if (hasUsable(env, "APPLE_STORE_KEY_ID") && !isAppleKeyId(readEnv(env, "APPLE_STORE_KEY_ID"))) malformed.push("APPLE_STORE_KEY_ID");
  if (hasUsable(env, "APPLE_STORE_PRIVATE_KEY") && !isPrivateKeyPem(readEnv(env, "APPLE_STORE_PRIVATE_KEY").replace(/\\n/g, "\n"))) malformed.push("APPLE_STORE_PRIVATE_KEY");
  if (hasUsable(env, "APPLE_STORE_APP_ID") && !/^\d{6,20}$/.test(readEnv(env, "APPLE_STORE_APP_ID"))) malformed.push("APPLE_STORE_APP_ID");
  if (hasUsable(env, "APPLE_STORE_ROOT_CAS_BASE64")) {
    try { const roots = JSON.parse(readEnv(env, "APPLE_STORE_ROOT_CAS_BASE64")); if (!Array.isArray(roots) || roots.length < 1 || roots.length > 10 || roots.some(value => typeof value !== "string" || !/^[A-Za-z0-9+/]+={0,2}$/.test(value))) throw new Error(); }
    catch { malformed.push("APPLE_STORE_ROOT_CAS_BASE64"); }
  }
  if (hasUsable(env, "GOOGLE_PLAY_SERVICE_ACCOUNT_JSON")) { const account = readGoogleServiceAccount(env); if (!account || !isGoogleServiceAccountEmail(account.client_email) || !isPrivateKeyPem(account.private_key)) malformed.push("GOOGLE_PLAY_SERVICE_ACCOUNT_JSON"); }
  const evidenceIssues = firebaseRuntimeEvidenceIssues(env, base);
  const secretIssues = evidenceIssues.length === 0 ? [] : [...missingSecrets.map(name => `${name} is not configured in the server release environment`), ...malformed.map(name => `${name} is malformed`)];
  return [
    check("firebase-backend-config", configIssues.length === 0, configIssues.join("; ") || "Firebase production configuration selects freed-7d5ee / asia-south1; deployment is checked separately.", "Fix the Firebase production project, region, and AppCheck configuration."),
    check("firebase-native-app-identifiers", identities.issues.length === 0, identities.issues.join("; ") || "Native Google services identify the production iOS and Android apps; runtime proof is checked separately.", "Configure matching native Google service files for app.freed.recovery."),
    check("firebase-server-secret-configuration", secretIssues.length === 0, secretIssues.join("; ") || (evidenceIssues.length === 0 ? "Fresh production runtime evidence includes the deployed server-only Secret Manager inventory." : "Server secret names and local value shapes are configured; this does not prove deployed Secret Manager access."), `Configure server-only ${FIREBASE_REQUIRED_SECRET_NAMES.join(", ")}; never expose their values in reports or EXPO_PUBLIC variables.`),
    check("firebase-production-runtime-evidence", evidenceIssues.length === 0, evidenceIssues.join("; ") || "Fresh native runtime captures prove deployed callables, attached secret-name inventory, and production AppCheck enforcement.", "Capture sanitized production-native Firebase runtime evidence with checksummed native app, callable inventory/smoke, secret-name inventory, and AppCheck proof artifacts; set FREED_FIREBASE_RUNTIME_EVIDENCE.")
  ];
}
const ISO_3166_ALPHA2_COUNTRY_CODES = new Set(
  [
    "AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ",
    "CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR",
    "GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP",
    "KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ",
    "NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW",
    "SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ",
    "UA UG UM US UY UZ VA VC VE VG VI VN VU WF WS YE YT ZA ZM ZW",
  ].join(" ").split(" ")
);

function parseArgs(argv) {
  const args = { envFile: process.env.FREED_RELEASE_ENV_FILE || null, report: null };
  const nextValue = (option, index) => {
    const value = argv[index + 1];
    if (!value) throw new Error(`Missing value for ${option}`);
    return value;
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--env-file") {
      args.envFile = nextValue(arg, index);
      index += 1;
    } else if (arg.startsWith("--env-file=")) {
      args.envFile = arg.slice("--env-file=".length);
      if (!args.envFile) throw new Error("Missing value for --env-file");
    } else if (arg === "--report") {
      args.report = nextValue(arg, index);
      index += 1;
    } else if (arg.startsWith("--report=")) {
      args.report = arg.slice("--report=".length);
      if (!args.report) throw new Error("Missing value for --report");
    } else {
      throw new Error(`Unknown option: ${arg}`);
    }
  }
  return args;
}

function normalizeHostname(hostname) {
  return hostname.replace(/^\[(.*)\]$/, "$1").toLowerCase();
}

function isPrivateOrReservedIpv4(hostname) {
  const match = hostname.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!match) return false;

  const octets = match.slice(1).map((part) => Number.parseInt(part, 10));
  if (octets.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return false;

  const [first, second, third] = octets;
  return (
    first === 10 ||
    first === 0 ||
    first === 127 ||
    (first === 100 && second >= 64 && second <= 127) ||
    (first === 169 && second === 254) ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && second === 168) ||
    (first === 192 && second === 0 && third === 2) ||
    (first === 198 && (second === 18 || second === 19)) ||
    (first === 198 && second === 51 && third === 100) ||
    (first === 203 && second === 0 && third === 113) ||
    first >= 224
  );
}

function isPrivateOrReservedIpv6(hostname) {
  if (!hostname.includes(":")) return false;
  return (
    hostname === "::" ||
    hostname === "::1" ||
    hostname.startsWith("fc") ||
    hostname.startsWith("fd") ||
    hostname.startsWith("fe8") ||
    hostname.startsWith("fe9") ||
    hostname.startsWith("fea") ||
    hostname.startsWith("feb") ||
    hostname.startsWith("ff") ||
    hostname.startsWith("2001:db8")
  );
}

function isPlaceholderHost(hostname) {
  return (
    [...PLACEHOLDER_HOSTS].some((host) => hostname === host || hostname.endsWith(`.${host}`)) ||
    RESERVED_TLDS.some((suffix) => hostname.endsWith(suffix)) ||
    hostname.includes("your-deployed-origin") ||
    hostname.includes("your-") ||
    hostname.includes("placeholder") ||
    hostname.includes("changeme") ||
    hostname.includes("sample") ||
    hostname.includes("todo")
  );
}

function endpointIssues(endpoint, label) {
  const value = endpoint && endpoint.trim();
  if (!value) return [`${label} is not configured`];

  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    return [`${label} is not a valid URL`];
  }

  const hostname = normalizeHostname(parsed.hostname);
  const issues = [];
  if (parsed.protocol !== "https:") issues.push(`${label} must use HTTPS`);
  if (parsed.username || parsed.password) issues.push(`${label} must not include URL credentials`);
  if (LOCAL_HOSTS.has(hostname) || hostname.endsWith(".local") || hostname.endsWith(".internal")) {
    issues.push(`${label} must not point to a local development host`);
  }
  if (isPrivateOrReservedIpv4(hostname) || isPrivateOrReservedIpv6(hostname)) {
    issues.push(`${label} must not point to a private or reserved network address`);
  }
  if (isPlaceholderHost(hostname)) {
    issues.push(`${label} must not use a placeholder or documentation host`);
  }
  if (!parsed.pathname || parsed.pathname === "/") {
    issues.push(`${label} must include a concrete API route path`);
  }
  if (parsed.search) issues.push(`${label} must not include query strings`);
  if (parsed.hash) issues.push(`${label} must not include URL fragments`);
  return issues;
}

function baseUrlIssues(baseUrl, label) {
  const value = baseUrl && baseUrl.trim();
  if (!value) return [`${label} is not configured`];

  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    return [`${label} is not a valid URL`];
  }

  const issues = endpointIssues(value, label).filter(
    (issue) => issue !== `${label} must include a concrete API route path`
  );
  if (parsed.pathname && parsed.pathname !== "/") {
    issues.push(`${label} must be an origin without a path`);
  }
  return issues;
}

function readEnv(env, key) {
  const value = env[key];
  return value && value.trim() ? value.trim() : null;
}

function isPlaceholderValue(value) {
  if (!value) return true;
  const normalized = value.trim().toLowerCase();
  const placeholderTokens = new Set(["test", "test-key", "sample", "mock", "local", "fallback", "dummy"]);
  return (
    normalized.includes("placeholder") ||
    normalized.includes("changeme") ||
    normalized.includes("your-") ||
    normalized.includes("example") ||
    placeholderTokens.has(normalized) ||
    normalized
      .split(/[^a-z0-9]+/)
      .filter(Boolean)
      .some((token) => placeholderTokens.has(token))
  );
}

function hasUsable(env, key) {
  return !isPlaceholderValue(readEnv(env, key));
}

function normalizeCertificateSha256(value) {
  return String(value || "")
    .replace(/[^a-f0-9]/gi, "")
    .toLowerCase();
}

function parseKeytoolCertificateOutput(stdout) {
  const certificateSha256Digest = normalizeCertificateSha256(stdout.match(/\bSHA256:\s*([A-F0-9:]+)/i)?.[1] || "");
  const certificateDn = (stdout.match(/^Owner:\s*(.+)$/m)?.[1] || "").trim();
  return {
    certificateDn,
    certificateSha256Digest,
    debugSigned:
      certificateSha256Digest === ANDROID_DEBUG_CERT_SHA256 ||
      /CN=Android Debug\b/i.test(certificateDn)
  };
}

function inspectAndroidUploadKeystore(storeFile, storePassword, keyAlias) {
  const result = spawnSync(
    "keytool",
    ["-list", "-v", "-keystore", storeFile, "-storepass", storePassword, "-alias", keyAlias],
    {
      encoding: "utf8",
      maxBuffer: 1024 * 1024,
      timeout: 30000
    }
  );
  if (result.error || result.status !== 0) {
    return {
      issue:
        "FREED_ANDROID_UPLOAD_STORE_FILE must be inspectable with keytool using the configured store password and key alias"
    };
  }
  const proof = parseKeytoolCertificateOutput(`${result.stdout || ""}\n${result.stderr || ""}`);
  if (!proof.certificateSha256Digest) {
    return { issue: "FREED_ANDROID_UPLOAD_STORE_FILE keytool inspection must return a certificate SHA-256 digest" };
  }
  if (proof.debugSigned) {
    return { issue: "FREED_ANDROID_UPLOAD_STORE_FILE must not use the Android debug keystore certificate" };
  }
  return { issue: null };
}

function androidReleaseSigningIssues(env) {
  const requiredKeys = [
    "FREED_ANDROID_UPLOAD_STORE_FILE",
    "FREED_ANDROID_UPLOAD_STORE_PASSWORD",
    "FREED_ANDROID_UPLOAD_KEY_ALIAS",
    "FREED_ANDROID_UPLOAD_KEY_PASSWORD"
  ];
  const issues = requiredKeys
    .filter((key) => !hasUsable(env, key))
    .map((key) => `${key} is not configured`);
  const storeFile = readEnv(env, "FREED_ANDROID_UPLOAD_STORE_FILE");
  const storeFilePath = storeFile ? resolve(storeFile) : "";
  if (storeFile && !existsSync(storeFilePath)) {
    issues.push("FREED_ANDROID_UPLOAD_STORE_FILE must point to an existing local upload keystore file");
  }
  if (issues.length === 0 && storeFilePath) {
    const inspection = inspectAndroidUploadKeystore(
      storeFilePath,
      readEnv(env, "FREED_ANDROID_UPLOAD_STORE_PASSWORD"),
      readEnv(env, "FREED_ANDROID_UPLOAD_KEY_ALIAS")
    );
    if (inspection.issue) issues.push(inspection.issue);
  }
  return issues;
}

function forbiddenPublicServerSecretIssues(env) {
  return Object.keys(env)
    .filter((key) => readEnv(env, key))
    .filter((key) => FORBIDDEN_PUBLIC_SERVER_SECRET_PREFIXES.some((prefix) => key.startsWith(prefix)) ||
      /^EXPO_PUBLIC_[A-Z0-9_]*(?:SERVICE_ACCOUNT|PRIVATE_KEY|SERVER_KEY|ACCESS_TOKEN|SECRET|ADMIN|CREDENTIAL|PASSWORD|ROOT_CAS)[A-Z0-9_]*$/i.test(key) ||
      FIREBASE_REQUIRED_SECRET_NAMES.some(name => key === `EXPO_PUBLIC_${name}`))
    .sort()
    .map((key) => `${key} must not be exposed in the client environment`);
}

function isAppleIssuerId(value) {
  return Boolean(
    value &&
      !isPlaceholderValue(value) &&
      !/^0{8}-0{4}-0{4}-0{4}-0{12}$/i.test(value.trim()) &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value.trim())
  );
}

function isAppleKeyId(value) {
  return Boolean(value && !isPlaceholderValue(value) && /^[A-Z0-9]{10}$/.test(value.trim()));
}

function isAppleTeamId(value) {
  return Boolean(value && !isPlaceholderValue(value) && /^[A-Z0-9]{10}$/.test(value.trim()));
}

function isBundleId(value) {
  return Boolean(value && !isPlaceholderValue(value) && /^[A-Za-z0-9][A-Za-z0-9.-]{2,120}$/.test(value.trim()));
}

function isFirebaseProjectId(value) {
  return Boolean(value && !isPlaceholderValue(value) && /^[a-z][a-z0-9-]{4,60}[a-z0-9]$/.test(value.trim()));
}

function isApnsProductionEnvironment(value) {
  return value === "production";
}

function isPrivateKeyPem(value) {
  return Boolean(
    value &&
      !isPlaceholderValue(value) &&
      /-----BEGIN (?:EC |RSA )?PRIVATE KEY-----/.test(value) &&
      /-----END (?:EC |RSA )?PRIVATE KEY-----/.test(value)
  );
}

function isJwt(value) {
  return Boolean(value && !isPlaceholderValue(value) && /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(value.trim()));
}

function isServerSecret(value, minLength = 24) {
  return Boolean(
    value &&
      !isPlaceholderValue(value) &&
      value.trim().length >= minLength &&
      /^[\x21-\x7e]+$/.test(value.trim())
  );
}

function isSupabaseServiceRoleKey(value) {
  return isJwt(value) || isServerSecret(value, 32);
}

function isRedisRestToken(value) {
  return isServerSecret(value, 24);
}

function isMaintenanceSecret(value) {
  return isServerSecret(value, 24);
}

function isGoogleServiceAccountEmail(value) {
  return Boolean(
    value &&
      !isPlaceholderValue(value) &&
      /^[^@\s]+@[^@\s]+\.iam\.gserviceaccount\.com$/i.test(value.trim())
  );
}

function isGoogleAccessToken(value) {
  return Boolean(value && !isPlaceholderValue(value) && (value.trim().startsWith("ya29.") || value.trim().length >= 40));
}

function isFcmServerKey(value) {
  return Boolean(value && !isPlaceholderValue(value) && /^[A-Za-z0-9:_-]{40,}$/.test(value.trim()));
}

function isGoogleAiApiKey(value) {
  return Boolean(value && !isPlaceholderValue(value) && /^AIza[0-9A-Za-z_-]{30,}$/.test(value.trim()));
}

function isOpenAiApiKey(value) {
  return Boolean(value && !isPlaceholderValue(value) && /^sk-(?:proj-)?[0-9A-Za-z_-]{20,}$/.test(value.trim()));
}

function readPrivateKey(env, directKey, base64Key) {
  const direct = readEnv(env, directKey);
  if (direct) return direct.replace(/\\n/g, "\n");
  const encoded = readEnv(env, base64Key);
  if (!encoded) return null;
  try {
    return Buffer.from(encoded, "base64").toString("utf8");
  } catch {
    return null;
  }
}

function readGoogleServiceAccount(env) {
  return readJsonSecret(env, "GOOGLE_PLAY_SERVICE_ACCOUNT_JSON", "GOOGLE_PLAY_SERVICE_ACCOUNT_JSON_BASE64");
}

function readFirebaseServiceAccount(env) {
  return readJsonSecret(env, "FIREBASE_SERVICE_ACCOUNT_JSON", "FIREBASE_SERVICE_ACCOUNT_JSON_BASE64");
}

function readJsonSecret(env, directKey, base64Key) {
  const raw = readEnv(env, directKey);
  const encoded = readEnv(env, base64Key);
  const value = raw || (encoded ? Buffer.from(encoded, "base64").toString("utf8") : null);
  if (!value) return null;
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function isAdMobAppId(value) {
  return Boolean(
    value &&
      !isPlaceholderValue(value) &&
      !value.includes(GOOGLE_SAMPLE_ADMOB_PUBLISHER) &&
      /^ca-app-pub-\d{16}~\d{10}$/.test(value)
  );
}

function isRewardedAdUnitId(value) {
  return Boolean(
    value &&
      !isPlaceholderValue(value) &&
      !value.includes(GOOGLE_SAMPLE_ADMOB_PUBLISHER) &&
      /^ca-app-pub-\d{16}\/\d{10}$/.test(value)
  );
}

function isOptionalCountryCode(value) {
  return !value || ISO_3166_ALPHA2_COUNTRY_CODES.has(value.trim().toUpperCase());
}

function check(id, condition, detail, next) {
  return {
    id,
    status: condition ? "pass" : "fail",
    detail,
    next: condition ? "" : next
  };
}

function endpointPathIssue(endpoint, label, expectedPath) {
  if (!endpoint || !expectedPath) return null;
  try {
    const pathname = new URL(endpoint).pathname.replace(/\/+$/, "");
    const normalizedExpected = expectedPath.replace(/\/+$/, "");
    if (pathname !== normalizedExpected && !pathname.endsWith(normalizedExpected)) {
      return `${label} must target ${normalizedExpected}`;
    }
  } catch {
    // endpointIssues already reports malformed URLs.
  }
  return null;
}

function endpointRouteIssues(endpoint, label, expectedPath) {
  return [
    ...endpointIssues(endpoint, label),
    endpointPathIssue(endpoint, label, expectedPath)
  ].filter(Boolean);
}

function checkEndpoint(id, env, key, label, expectedPath = null) {
  const issues = expectedPath
    ? endpointRouteIssues(readEnv(env, key), label, expectedPath)
    : endpointIssues(readEnv(env, key), label);
  return check(
    id,
    issues.length === 0,
    issues.length === 0 ? `${label} is production-safe.` : issues.join(", "),
    `Configure ${key} as an HTTPS non-local deployed API route.`
  );
}

function checkEndpointWithTimeout(id, env, key, label, timeoutKey, min, max, expectedPath = null) {
  const issues = [
    ...(expectedPath
      ? endpointRouteIssues(readEnv(env, key), label, expectedPath)
      : endpointIssues(readEnv(env, key), label)),
    ...boundedIntegerEnvIssues(env, timeoutKey, min, max)
  ];
  return check(
    id,
    issues.length === 0,
    issues.length === 0 ? `${label} is production-safe and optional timeout is bounded.` : issues.join(", "),
    `Configure ${key} as an HTTPS non-local deployed API route, and keep optional ${timeoutKey} within documented bounds.`
  );
}

function optionalChallengeWeatherContextIssues(env) {
  const issues = [
    ...boundedIntegerEnvIssues(env, "EXPO_PUBLIC_CHALLENGE_WEATHER_CONTEXT_TIMEOUT_MS", 500, 15_000),
    ...boundedIntegerEnvIssues(env, "EXPO_PUBLIC_CHALLENGE_WEATHER_CONTEXT_RESPONSE_MAX_BYTES", 1_024, 1_000_000)
  ];
  const enabled = readEnv(env, "EXPO_PUBLIC_CHALLENGE_WEATHER_CONTEXT_ENABLED");
  if (!enabled || enabled === "false") return issues;
  if (enabled !== "true") return [...issues, "EXPO_PUBLIC_CHALLENGE_WEATHER_CONTEXT_ENABLED must be true or false"];
  return [
    ...issues,
    ...endpointIssues(readEnv(env, "EXPO_PUBLIC_CHALLENGE_WEATHER_CONTEXT_ENDPOINT"), "challenge weather endpoint")
  ];
}

function remoteAnalyticsEndpointIssues(env) {
  const endpoint = readEnv(env, "EXPO_PUBLIC_ANALYTICS_ENDPOINT");
  const issues = endpointIssues(endpoint, "remote analytics endpoint");
  try {
    const pathname = new URL(endpoint).pathname.replace(/\/+$/, "");
    if (pathname !== "/api/analytics" && !pathname.endsWith("/api/analytics")) {
      issues.push("remote analytics endpoint must target the aggregate analytics API route (/api/analytics)");
    }
  } catch {
    // endpointIssues already reports malformed URLs.
  }
  return issues;
}

function deriveBackendReadinessEndpoint(env) {
  const explicit = readEnv(env, "EXPO_PUBLIC_BACKEND_READINESS_ENDPOINT");
  if (explicit) return explicit;
  const source = [
    "EXPO_PUBLIC_ANALYTICS_ENDPOINT",
    "EXPO_PUBLIC_ADULT_DOMAIN_FEED_ENDPOINT",
    "EXPO_PUBLIC_AI_COACH_ENDPOINT",
    "EXPO_PUBLIC_AI_CHALLENGE_ENDPOINT",
    "EXPO_PUBLIC_PURCHASE_VERIFY_ENDPOINT",
    "EXPO_PUBLIC_RECOVERY_BACKUP_SYNC_ENDPOINT"
  ].map((key) => readEnv(env, key)).find(Boolean);
  if (!source) return null;
  if (endpointIssues(source, "backend readiness derivation source endpoint").length > 0) {
    return source;
  }
  try {
    const parsed = new URL(source);
    return new URL("/api/backend/readiness", parsed.origin).toString();
  } catch {
    return source;
  }
}

function backendReadinessEndpointIssues(env) {
  const endpoint = deriveBackendReadinessEndpoint(env);
  const issues = [
    ...endpointIssues(endpoint, "backend readiness endpoint"),
    ...boundedIntegerEnvIssues(env, "EXPO_PUBLIC_BACKEND_READINESS_TIMEOUT_MS", 500, 15_000),
    ...boundedIntegerEnvIssues(env, "FREED_BACKEND_READINESS_SMOKE_TIMEOUT_MS", 500, 15_000)
  ];
  try {
    const pathname = new URL(endpoint).pathname.replace(/\/+$/, "");
    if (pathname !== "/api/backend/readiness" && !pathname.endsWith("/api/backend/readiness")) {
      issues.push("backend readiness endpoint must target /api/backend/readiness");
    }
  } catch {
    // endpointIssues already reports malformed URLs.
  }
  return issues;
}

function adultDomainFeedSourceIssues(env) {
  const raw = readEnv(env, "FREED_ADULT_DOMAIN_FEED_SOURCE_URLS");
  if (!raw || isPlaceholderValue(raw)) return ["FREED_ADULT_DOMAIN_FEED_SOURCE_URLS must include at least one reviewed HTTPS source feed"];

  const parsed = parseAdultDomainFeedSourceConfigWithIssues(raw);
  const { sources } = parsed;
  const issues = [...parsed.issues];
  if (sources.length === 0) {
    issues.push("FREED_ADULT_DOMAIN_FEED_SOURCE_URLS must use id|label|https://source-url lines");
  }
  for (const source of sources) {
    issues.push(...endpointIssues(source.url, `${source.label} adult-domain feed source`));
  }
  return issues;
}

function boundedIntegerEnvIssues(env, key, min, max) {
  const raw = readEnv(env, key);
  if (!raw) return [];
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isInteger(parsed) || String(parsed) !== raw || parsed < min || parsed > max) {
    return [`${key} must be an integer between ${min} and ${max}`];
  }
  return [];
}

function adultDomainFeedRuntimeIssues(env) {
  return [
    readEnv(env, "EXPO_PUBLIC_REQUIRE_REVIEWED_ADULT_DOMAIN_FEED") === "true"
      ? null
      : "EXPO_PUBLIC_REQUIRE_REVIEWED_ADULT_DOMAIN_FEED must be true for production release verification",
    ...boundedIntegerEnvIssues(env, "EXPO_PUBLIC_ADULT_DOMAIN_FEED_SYNC_TIMEOUT_MS", 50, 15_000),
    ...boundedIntegerEnvIssues(env, "EXPO_PUBLIC_ADULT_DOMAIN_FEED_RESPONSE_MAX_BYTES", 100_000, 10_000_000),
    ...boundedIntegerEnvIssues(env, "FREED_ADULT_DOMAIN_FEED_SMOKE_TIMEOUT_MS", 50, 15_000),
    ...boundedIntegerEnvIssues(env, "FREED_ADULT_DOMAIN_FEED_CACHE_TTL_SECONDS", 60, 86_400),
    ...boundedIntegerEnvIssues(env, "FREED_ADULT_DOMAIN_FEED_SOURCE_TIMEOUT_MS", 50, 15_000),
    ...boundedIntegerEnvIssues(env, "FREED_ADULT_DOMAIN_FEED_SOURCE_MAX_BYTES", 10_000, 5_000_000)
  ].filter(Boolean);
}

function analyticsRuntimeIssues(env) {
  return [
    ...boundedIntegerEnvIssues(env, "EXPO_PUBLIC_ANALYTICS_TIMEOUT_MS", 250, 15_000),
    ...boundedIntegerEnvIssues(env, "EXPO_PUBLIC_ANALYTICS_RESPONSE_MAX_BYTES", 1_024, 2_000_000),
    ...boundedIntegerEnvIssues(env, "FREED_ANALYTICS_SMOKE_TIMEOUT_MS", 250, 15_000),
    ...boundedIntegerEnvIssues(env, "FREED_ANALYTICS_SUPABASE_TIMEOUT_MS", 250, 15_000)
  ];
}

function optionalRecoveryBackupSyncEndpointIssues(env) {
  const endpoint = readEnv(env, "EXPO_PUBLIC_RECOVERY_BACKUP_SYNC_ENDPOINT");
  const issues = [
    ...boundedIntegerEnvIssues(env, "EXPO_PUBLIC_RECOVERY_BACKUP_SYNC_TIMEOUT_MS", 500, 15_000),
    ...boundedIntegerEnvIssues(env, "EXPO_PUBLIC_RECOVERY_BACKUP_SYNC_RESPONSE_MAX_BYTES", 1_024, 5_000_000)
  ];
  if (endpoint) issues.push(...endpointRouteIssues(endpoint, "recovery backup sync endpoint", "/api/recovery-backup/sync"));
  return issues;
}

function optionalSupabaseAuthClientIssues(env) {
  const backupEndpoint = readEnv(env, "EXPO_PUBLIC_RECOVERY_BACKUP_SYNC_ENDPOINT");
  const supabaseUrl = readEnv(env, "EXPO_PUBLIC_SUPABASE_URL");
  const anonKey = readEnv(env, "EXPO_PUBLIC_SUPABASE_ANON_KEY");
  const redirectUrl = readEnv(env, "EXPO_PUBLIC_SUPABASE_AUTH_REDIRECT_URL");
  const publicSecretKeys = [
    "EXPO_PUBLIC_SUPABASE_SERVICE_ROLE_KEY",
    "EXPO_PUBLIC_SUPABASE_SERVICE_ROLE",
    "EXPO_PUBLIC_SUPABASE_JWT_SECRET",
    "EXPO_PUBLIC_SUPABASE_DB_PASSWORD"
  ].filter((key) => readEnv(env, key));
  const configured = Boolean(backupEndpoint || supabaseUrl || anonKey || redirectUrl || publicSecretKeys.length > 0);
  if (!configured) return [];

  const issues = publicSecretKeys.map((key) => `${key} must not be exposed in the client environment`);
  issues.push(
    ...boundedIntegerEnvIssues(env, "EXPO_PUBLIC_SUPABASE_AUTH_TIMEOUT_MS", 500, 15_000),
    ...boundedIntegerEnvIssues(env, "EXPO_PUBLIC_SUPABASE_AUTH_RESPONSE_MAX_BYTES", 1_024, 1_000_000)
  );
  if (!supabaseUrl) {
    issues.push("EXPO_PUBLIC_SUPABASE_URL is required when hosted recovery backup sync is configured");
  } else {
    issues.push(...supabaseAuthEndpointIssues(supabaseUrl));
  }
  if (!anonKey) {
    issues.push("EXPO_PUBLIC_SUPABASE_ANON_KEY is required when hosted recovery backup sync is configured");
  } else if (!isPublicSupabaseAnonKey(anonKey)) {
    issues.push("EXPO_PUBLIC_SUPABASE_ANON_KEY must be a public anon JWT, not a service-role credential");
  }
  if (redirectUrl) {
    issues.push(...supabaseAuthRedirectIssues(redirectUrl));
  }
  return issues;
}

function supabaseAuthEndpointIssues(supabaseUrl) {
  const baseIssues = baseUrlIssues(supabaseUrl, "Supabase Auth base URL");
  if (baseIssues.length > 0) return baseIssues;
  try {
    return endpointIssues(new URL("/auth/v1/user", supabaseUrl).toString(), "Supabase Auth endpoint");
  } catch {
    return ["EXPO_PUBLIC_SUPABASE_URL is not a valid Supabase URL"];
  }
}

function supabaseAuthRedirectIssues(redirectUrl) {
  try {
    const parsed = new URL(redirectUrl);
    if (FREED_AUTH_REDIRECT_SCHEMES.has(parsed.protocol)) {
      const callbackPath = parsed.hostname === "auth" && parsed.pathname === "/callback";
      const tripleSlashCallback = !parsed.hostname && parsed.pathname === "/auth/callback";
      return callbackPath || tripleSlashCallback ? [] : ["EXPO_PUBLIC_SUPABASE_AUTH_REDIRECT_URL must target the FREED auth callback path"];
    }
    return endpointIssues(redirectUrl, "Supabase Auth redirect URL");
  } catch {
    return ["EXPO_PUBLIC_SUPABASE_AUTH_REDIRECT_URL is not a valid redirect URL"];
  }
}

function isPublicSupabaseAnonKey(value) {
  const token = value && value.trim();
  if (!isJwt(token) || /service[_-]?role|jwt[_-]?secret/i.test(token)) return false;
  const parts = token.split(".");
  try {
    const payload = JSON.parse(Buffer.from(parts[1].replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8"));
    return !payload.role || payload.role === "anon";
  } catch {
    return true;
  }
}

function optionalRetentionEndpointIssues(env) {
  const mode = (readEnv(env, "EXPO_PUBLIC_RETENTION_MODE") || "local").toLowerCase();
  const endpoint = readEnv(env, "EXPO_PUBLIC_RETENTION_ENDPOINT");
  const issues = [
    ...boundedIntegerEnvIssues(env, "EXPO_PUBLIC_RETENTION_TIMEOUT_MS", 1_000, 12_000)
  ];
  if (mode !== "local" && mode !== "remote") {
    issues.push("EXPO_PUBLIC_RETENTION_MODE must be local or remote");
  }
  if (mode === "remote" && !endpoint) {
    issues.push("remote retention endpoint is not configured");
  }
  if (endpoint) {
    issues.push(...endpointRouteIssues(endpoint, "remote retention endpoint", "/api/retention"));
  }
  return issues;
}

function supabaseBackendIssues(env) {
  const supabaseUrl = readEnv(env, "SUPABASE_URL");
  const serviceRoleKey = readEnv(env, "SUPABASE_SERVICE_ROLE_KEY");
  const publicSupabaseUrl = readEnv(env, "EXPO_PUBLIC_SUPABASE_URL");
  const publicAnonKey = readEnv(env, "EXPO_PUBLIC_SUPABASE_ANON_KEY");
  const maintenanceSecret = readEnv(env, "BACKEND_MAINTENANCE_SECRET") || readEnv(env, "CRON_SECRET");
  const issues = [
    ...boundedIntegerEnvIssues(env, "FREED_BACKEND_PROVIDER_TIMEOUT_MS", 500, 15_000),
    ...boundedIntegerEnvIssues(env, "FREED_BACKEND_PROVIDER_RESPONSE_MAX_BYTES", 1_024, 5_000_000),
    ...boundedIntegerEnvIssues(env, "FREED_SUPABASE_SCHEMA_SMOKE_TIMEOUT_MS", 500, 15_000)
  ];

  if (supabaseUrl) {
    const baseIssues = baseUrlIssues(supabaseUrl, "Supabase backend base URL");
    issues.push(...baseIssues);
    if (baseIssues.length === 0) {
      issues.push(...endpointIssues(supabaseRestUrl(supabaseUrl), "Supabase backend REST endpoint"));
    }
  } else {
    issues.push("SUPABASE_URL is not configured");
  }
  if (!isSupabaseServiceRoleKey(serviceRoleKey)) {
    issues.push("SUPABASE_SERVICE_ROLE_KEY must be a production-shaped service-role secret");
  }
  if (publicSupabaseUrl) {
    issues.push(...supabaseAuthEndpointIssues(publicSupabaseUrl));
  } else {
    issues.push("EXPO_PUBLIC_SUPABASE_URL is required for Supabase public anon lockout proof and hosted auth");
  }
  if (!isPublicSupabaseAnonKey(publicAnonKey)) {
    issues.push("EXPO_PUBLIC_SUPABASE_ANON_KEY must be a public anon JWT for Supabase schema public-client lockout proof");
  }
  if (!isMaintenanceSecret(maintenanceSecret)) {
    issues.push("BACKEND_MAINTENANCE_SECRET or CRON_SECRET must be a production-shaped maintenance secret");
  }
  return issues;
}

function redisBackendIssues(env) {
  const redisUrl = readEnv(env, "UPSTASH_REDIS_REST_URL");
  const redisToken = readEnv(env, "UPSTASH_REDIS_REST_TOKEN");
  const issues = [];

  if (redisUrl) {
    const baseIssues = baseUrlIssues(redisUrl, "Redis backend base URL");
    issues.push(...baseIssues);
    if (baseIssues.length === 0) {
      issues.push(...endpointIssues(redisPipelineUrl(redisUrl), "Redis backend REST endpoint"));
    }
  } else {
    issues.push("UPSTASH_REDIS_REST_URL is not configured");
  }
  if (!isRedisRestToken(redisToken)) {
    issues.push("UPSTASH_REDIS_REST_TOKEN must be a production-shaped Redis REST token");
  }
  return issues;
}

function notificationBackendIssues(env) {
  const firebaseServiceAccount = readFirebaseServiceAccount(env);
  const firebaseClientEmail =
    typeof firebaseServiceAccount?.client_email === "string" ? firebaseServiceAccount.client_email.trim() : null;
  const firebasePrivateKey =
    typeof firebaseServiceAccount?.private_key === "string" ? firebaseServiceAccount.private_key.trim() : null;
  const firebaseProjectId =
    readEnv(env, "FIREBASE_PROJECT_ID") ??
    (typeof firebaseServiceAccount?.project_id === "string" ? firebaseServiceAccount.project_id.trim() : null);
  const fcmReady =
    isFcmServerKey(readEnv(env, "FCM_SERVER_KEY")) ||
    (isGoogleAccessToken(readEnv(env, "FCM_ACCESS_TOKEN")) && isFirebaseProjectId(firebaseProjectId)) ||
    (isGoogleServiceAccountEmail(firebaseClientEmail) && isPrivateKeyPem(firebasePrivateKey) && isFirebaseProjectId(firebaseProjectId));
  const apnsPrivateKey = readPrivateKey(env, "APNS_PRIVATE_KEY", "APNS_PRIVATE_KEY_BASE64");
  const apnsReady =
    isAppleKeyId(readEnv(env, "APNS_KEY_ID")) &&
    isAppleTeamId(readEnv(env, "APNS_TEAM_ID")) &&
    isBundleId(readEnv(env, "APNS_BUNDLE_ID")) &&
    isApnsProductionEnvironment(readEnv(env, "APNS_ENV")) &&
    isPrivateKeyPem(apnsPrivateKey);
  const issues = [
    ...boundedIntegerEnvIssues(env, "FREED_REMOTE_NOTIFICATION_PROVIDER_TIMEOUT_MS", 500, 15_000),
    ...boundedIntegerEnvIssues(env, "FREED_REMOTE_NOTIFICATION_PROVIDER_RESPONSE_MAX_BYTES", 1_024, 2_000_000),
    ...boundedIntegerEnvIssues(env, "FREED_REMOTE_NOTIFICATION_SMOKE_TIMEOUT_MS", 500, 15_000)
  ];

  if (!isServerSecret(readEnv(env, "REMOTE_NOTIFICATION_DISPATCH_SECRET"))) {
    issues.push("REMOTE_NOTIFICATION_DISPATCH_SECRET must be a production-shaped dispatch secret");
  }
  if (!fcmReady) {
    issues.push("FCM credentials must include a production FCM server key, Firebase service account JSON with project_id, or FCM_ACCESS_TOKEN plus FIREBASE_PROJECT_ID");
  }
  if (!apnsReady) {
    issues.push("APNs credentials must include production APNS_KEY_ID, APNS_TEAM_ID, APNS_BUNDLE_ID, APNS_ENV=production, and APNS_PRIVATE_KEY(_BASE64)");
  }
  return issues;
}

function supabaseRestUrl(baseUrl) {
  try {
    return new URL("/rest/v1/recovery_analytics_events", baseUrl).toString();
  } catch {
    return baseUrl;
  }
}

function redisPipelineUrl(baseUrl) {
  try {
    return new URL("/pipeline", baseUrl).toString();
  } catch {
    return baseUrl;
  }
}

function reportPathIssue(value) {
  return sharedReportPathIssue(value, "release preflight report");
}

function assertSafeReportPath(reportPath) {
  return assertSafeWorkspaceReportPath(reportPath, "release preflight report");
}

function writeReport(reportPath, payload) {
  const absolute = assertSafeReportPath(reportPath);
  mkdirSync(dirname(absolute), { recursive: true });
  writeFileSync(absolute, `${JSON.stringify(payload, null, 2)}\n`);
}

function artifactRootForReport(reportPath) {
  if (!reportPath) return "docs/validation/artifacts/<run-id>";
  const absoluteRoot = dirname(resolve(process.cwd(), reportPath));
  const workspaceRelative = relative(process.cwd(), absoluteRoot).replace(/\\/g, "/");
  if (workspaceRelative && !workspaceRelative.startsWith("..") && !isAbsolute(workspaceRelative)) {
    return workspaceRelative;
  }
  return absoluteRoot;
}

function getProductionBlockerGroups(artifactRoot, provider = getBackendProvider()) {
  const groups = productionBlockerGroups(artifactRoot, undefined, provider);
  if (provider !== "firebase") return groups;
  return groups.map(group => {
    if (group.category === "production-env" && group.id !== "production-android-signing") {
      return { ...group, requiredEnv: ["EXPO_PUBLIC_BACKEND_PROVIDER=firebase", "EXPO_PUBLIC_FIREBASE_ENV=production", ...FIREBASE_REQUIRED_SECRET_NAMES],
        requiredReports: [`${artifactRoot}/release-env-preflight-report.json`],
        preflightCheckIds: group.id === "production-monetization"
          ? COMMON_PREFLIGHT_IDS.filter(id => id !== "optional-challenge-weather-context").concat(FIREBASE_PREFLIGHT_IDS)
          : FIREBASE_PREFLIGHT_IDS,
        next: "Configure the selected Firebase native backend and server secret names, then capture fresh production-native callable, Secrets, and AppCheck evidence. Files alone do not prove deployment." };
    }
    if (group.category === "deployed-evidence") {
      return { ...group, requiredReports: [`${artifactRoot}/release-env-preflight-report.json`],
        next: group.next.replace(/Core 3-only/g, "monthly/yearly-only").replace(/deployed CLARA\/challenge smoke reports/g, "production-native Firebase CLARA/challenge capture reports") };
    }
    return { ...group, next: group.next.replace(/Core 3-only/g, "monthly/yearly-only") };
  });
}

function buildPreflightBlockerGroups(checks, artifactRoot, provider = getBackendProvider()) {
  const checksById = new Map(checks.map((entry) => [entry.id, entry]));
  return getProductionBlockerGroups(artifactRoot, provider).map((group) => {
    const preflightCheckIds = Array.isArray(group.preflightCheckIds) ? group.preflightCheckIds : [];
    const matchedChecks = preflightCheckIds.map((id) => checksById.get(id)).filter(Boolean);
    const failedChecks = matchedChecks.filter((entry) => entry.status === "fail");
    const missingCheckIds = preflightCheckIds.filter((id) => !checksById.has(id));
    const status =
      preflightCheckIds.length === 0
        ? "external"
        : failedChecks.length === 0 && missingCheckIds.length === 0
          ? "pass"
          : "fail";

    return {
      id: group.id,
      category: group.category,
      status,
      requiredEnv: group.requiredEnv ?? [],
      requiredReports: group.requiredReports ?? [],
      captureHelperCommand: group.captureHelperCommand ?? null,
      evidenceFile: group.evidenceFile ?? null,
      preflightCheckIds,
      missingPreflightCheckIds: missingCheckIds,
      failedPreflightChecks: failedChecks.map((entry) => ({
        id: entry.id,
        detail: entry.detail,
        next: entry.next
      })),
      next: group.next
    };
  });
}

function sanitizeReportText(value) {
  return sanitizeLocalHomePaths(String(value || ""));
}

function sanitizeReportCheck(entry) {
  return {
    ...entry,
    detail: sanitizeReportText(entry.detail),
    next: sanitizeReportText(entry.next)
  };
}

function buildReport(sourceLabel, checks, options = {}) {
  const sanitizedChecks = checks.map(sanitizeReportCheck);
  const failed = sanitizedChecks.filter((entry) => entry.status === "fail");
  const report = {
    checks: sanitizedChecks,
    failCount: failed.length,
    generatedAt: new Date().toISOString(),
    passCount: sanitizedChecks.length - failed.length,
    result: failed.length === 0 ? "pass" : "fail",
    sanitized: true,
    schema: "freed-release-env-preflight-report-v1",
    backendProvider: options.backendProvider ?? getBackendProvider(),
    source: sanitizeReportText(sourceLabel),
  };
  if (options.includeBlockerGroups) {
    report.blockerGroups = buildPreflightBlockerGroups(sanitizedChecks, options.artifactRoot, report.backendProvider);
  }
  return report;
}

function printReport(report) {
  console.log("# FREED release environment preflight");
  console.log(`Source: ${report.source}`);
  console.log(`Result: ${report.passCount} pass, ${report.failCount} fail`);
  console.log("");
  console.log("| Status | Gate | Detail | Next |");
  console.log("| --- | --- | --- | --- |");
  for (const entry of report.checks) {
    console.log(
      `| ${entry.status.toUpperCase()} | ${entry.id} | ${entry.detail.replace(/\|/g, "/")} | ${entry.next.replace(/\|/g, "/")} |`
    );
  }
  if (Array.isArray(report.blockerGroups) && report.blockerGroups.length > 0) {
    console.log("");
    console.log("| Status | Release blocker group | Failed preflight checks | Next |");
    console.log("| --- | --- | --- | --- |");
    for (const group of report.blockerGroups) {
      const failed = group.failedPreflightChecks.map((entry) => entry.id).join(", ") || "none";
      console.log(
        `| ${group.status.toUpperCase()} | ${group.id} | ${failed.replace(/\|/g, "/")} | ${group.next.replace(/\|/g, "/")} |`
      );
    }
  }
}

function runPreflight(env, sourceLabel, reportPath) {
  const storeProvider = (readEnv(env, "EXPO_PUBLIC_STORE_PROVIDER") || "native-iap").toLowerCase();
  const applePrivateKey = readPrivateKey(env, "APP_STORE_PRIVATE_KEY", "APP_STORE_PRIVATE_KEY_BASE64");
  const googleServiceAccount = readGoogleServiceAccount(env);
  const googleClientEmail =
    typeof googleServiceAccount?.client_email === "string" && googleServiceAccount.client_email.trim();
  const googlePrivateKey =
    typeof googleServiceAccount?.private_key === "string" && googleServiceAccount.private_key.trim();
  const aiProvider = (readEnv(env, "FREED_AI_PROVIDER") || readEnv(env, "AI_PROVIDER") || "").toLowerCase();
  const openAiReady = isOpenAiApiKey(readEnv(env, "OPENAI_API_KEY")) && hasUsable(env, "OPENAI_MODEL");
  const geminiReady =
    isGoogleAiApiKey(readEnv(env, "GEMINI_API_KEY") || readEnv(env, "GOOGLE_API_KEY") || readEnv(env, "GOOGLE_GENAI_API_KEY")) &&
    hasUsable(env, "GEMINI_MODEL");
  const aiProviderAllowed = !aiProvider || aiProvider === "openai" || aiProvider === "gemini";
  const aiServerReady = aiProviderAllowed && (aiProvider === "openai" ? openAiReady : aiProvider === "gemini" ? geminiReady : openAiReady || geminiReady);
  const aiServerIssues = [
    ...boundedIntegerEnvIssues(env, "FREED_AI_PROVIDER_TIMEOUT_MS", 500, 60_000),
    ...boundedIntegerEnvIssues(env, "FREED_AI_PROVIDER_RESPONSE_MAX_BYTES", 10_000, 5_000_000)
  ];
  const optionalWeatherIssues = optionalChallengeWeatherContextIssues(env);
  const analyticsIssues = [...remoteAnalyticsEndpointIssues(env), ...analyticsRuntimeIssues(env)];
  const backendReadinessIssues = backendReadinessEndpointIssues(env);
  const adultFeedSourceIssues = [...adultDomainFeedSourceIssues(env), ...adultDomainFeedRuntimeIssues(env)];
  const optionalBackupSyncIssues = optionalRecoveryBackupSyncEndpointIssues(env);
  const optionalSupabaseAuthIssues = optionalSupabaseAuthClientIssues(env);
  const optionalRetentionIssues = optionalRetentionEndpointIssues(env);
  const publicServerSecretIssues = forbiddenPublicServerSecretIssues(env);
  const supabaseIssues = supabaseBackendIssues(env);
  const redisIssues = redisBackendIssues(env);
  const notificationIssues = notificationBackendIssues(env);
  const androidSigningIssues = androidReleaseSigningIssues(env);
  const purchaseVerifyIssues = [
    ...endpointRouteIssues(readEnv(env, "EXPO_PUBLIC_PURCHASE_VERIFY_ENDPOINT"), "purchase verify endpoint", "/api/purchases/verify"),
    ...boundedIntegerEnvIssues(env, "EXPO_PUBLIC_PURCHASE_VERIFY_TIMEOUT_MS", 500, 15_000),
    ...boundedIntegerEnvIssues(env, "EXPO_PUBLIC_PURCHASE_VERIFY_RESPONSE_MAX_BYTES", 1_024, 2_000_000),
    ...boundedIntegerEnvIssues(env, "FREED_PURCHASE_VERIFY_PROVIDER_TIMEOUT_MS", 500, 15_000),
    ...boundedIntegerEnvIssues(env, "FREED_PURCHASE_VERIFY_PROVIDER_RESPONSE_MAX_BYTES", 1_024, 2_000_000)
  ];

  const releaseMonetizationIssues = [
    ...(readEnv(env, "EXPO_PUBLIC_MONETIZATION_MODE") === "native" ? [] : ["EXPO_PUBLIC_MONETIZATION_MODE is not native."]),
    ...(readEnv(env, "EXPO_PUBLIC_BUILD_CHANNEL") === "internal-testflight"
      ? ["The internal-testflight build channel cannot pass production release verification."]
      : [])
  ];

  const revenueCatSelected = storeProvider === "revenuecat";
  const appleIssuerTripletReady =
    isAppleIssuerId(readEnv(env, "APP_STORE_ISSUER_ID")) &&
    isAppleKeyId(readEnv(env, "APP_STORE_KEY_ID")) &&
    isPrivateKeyPem(applePrivateKey);
  const appleJwtReady = isJwt(readEnv(env, "APP_STORE_SERVER_API_JWT"));
  const googleServiceAccountReady =
    Boolean(googleClientEmail && googlePrivateKey) &&
    isGoogleServiceAccountEmail(googleServiceAccount.client_email) &&
    isPrivateKeyPem(googleServiceAccount.private_key);
  const googleTokenReady = isGoogleAccessToken(readEnv(env, "GOOGLE_PLAY_ACCESS_TOKEN"));

  const checks = [
    check(
      "server-secret-public-leakage",
      publicServerSecretIssues.length === 0,
      publicServerSecretIssues.length === 0
        ? "No server-only store, AI, Supabase, Redis, notification, maintenance, or purchase-verifier secrets are exposed as EXPO_PUBLIC_*."
        : publicServerSecretIssues.join(", "),
      "Move server-only store, AI, Supabase, Redis, notification, maintenance, and purchase-verifier credentials out of EXPO_PUBLIC_* before release."
    ),
    check(
      "release-monetization-mode",
      releaseMonetizationIssues.length === 0,
      releaseMonetizationIssues.length === 0
        ? "Native monetization mode is enabled."
        : releaseMonetizationIssues.join(" "),
      "Set EXPO_PUBLIC_MONETIZATION_MODE=native and remove the internal-testflight build channel for signed production release verification."
    ),
    check(
      "store-provider",
      storeProvider === "native-iap" || revenueCatSelected,
      `Store provider resolves to ${storeProvider || "native-iap"}.`,
      "Use EXPO_PUBLIC_STORE_PROVIDER=native-iap, or revenuecat only with real fallback SDK keys."
    ),
    check(
      "iap-product-ids",
      [
        "EXPO_PUBLIC_IAP_PRODUCT_YEARLY",
        "EXPO_PUBLIC_IAP_PRODUCT_MONTHLY"
      ].every((key) => hasUsable(env, key)),
      "Launch monthly and yearly product identifiers are checked for non-placeholder values.",
      "Configure EXPO_PUBLIC_IAP_PRODUCT_YEARLY and EXPO_PUBLIC_IAP_PRODUCT_MONTHLY with the launch App Store / Play product IDs."
    ),
    check(
      "purchase-verify-endpoint",
      purchaseVerifyIssues.length === 0,
      purchaseVerifyIssues.length === 0
        ? "purchase verify endpoint is production-safe and optional timeout/response-size bounds are configured."
        : purchaseVerifyIssues.join(", "),
      "Configure EXPO_PUBLIC_PURCHASE_VERIFY_ENDPOINT as an HTTPS non-local deployed API route, and keep optional purchase verification timeout and response-size values within documented bounds."
    ),
    check(
      "app-store-environment",
      readEnv(env, "APP_STORE_SERVER_API_ENV") === "production",
      readEnv(env, "APP_STORE_SERVER_API_ENV") === "production"
        ? "App Store Server API environment is production."
        : "APP_STORE_SERVER_API_ENV is not production.",
      "Set APP_STORE_SERVER_API_ENV=production for the final release preflight."
    ),
    check(
      "app-store-verification-credentials",
      hasUsable(env, "APP_STORE_BUNDLE_ID") && (appleIssuerTripletReady || appleJwtReady),
      appleIssuerTripletReady
        ? "App Store issuer/key/private-key credentials are configured server-side."
        : appleJwtReady
          ? "App Store pre-minted JWT fallback is configured server-side."
          : "App Store bundle ID plus issuer/key/private-key credentials or JWT fallback are missing.",
      "Configure APP_STORE_BUNDLE_ID and either APP_STORE_ISSUER_ID + APP_STORE_KEY_ID + APP_STORE_PRIVATE_KEY(_BASE64), or APP_STORE_SERVER_API_JWT."
    ),
    check(
      "google-play-verification-credentials",
      hasUsable(env, "GOOGLE_PLAY_PACKAGE_NAME") && (googleServiceAccountReady || googleTokenReady),
      googleServiceAccountReady
        ? "Google Play service account credentials are configured server-side."
        : googleTokenReady
          ? "Google Play pre-minted access-token fallback is configured server-side."
          : "Google Play package name plus service account credentials or access-token fallback are missing.",
      "Configure GOOGLE_PLAY_PACKAGE_NAME and either GOOGLE_PLAY_SERVICE_ACCOUNT_JSON(_BASE64), or GOOGLE_PLAY_ACCESS_TOKEN."
    ),
    check(
      "android-release-signing",
      androidSigningIssues.length === 0,
      androidSigningIssues.length === 0
        ? "Android upload signing keystore path and key credentials are configured for Play release artifacts."
        : androidSigningIssues.join(", "),
      "Configure FREED_ANDROID_UPLOAD_STORE_FILE, FREED_ANDROID_UPLOAD_STORE_PASSWORD, FREED_ANDROID_UPLOAD_KEY_ALIAS, and FREED_ANDROID_UPLOAD_KEY_PASSWORD with secure production upload signing values."
    ),
    check(
      "revenuecat-fallback-keys",
      !revenueCatSelected ||
        (hasUsable(env, "EXPO_PUBLIC_REVENUECAT_API_KEY_IOS") &&
          hasUsable(env, "EXPO_PUBLIC_REVENUECAT_API_KEY_ANDROID") &&
          (hasUsable(env, "EXPO_PUBLIC_REVENUECAT_ENTITLEMENT_ID") ||
            hasUsable(env, "EXPO_PUBLIC_PREMIUM_ENTITLEMENT_ID"))),
      revenueCatSelected
        ? "RevenueCat fallback provider is selected, so platform SDK keys and entitlement are required."
        : "RevenueCat fallback is not selected.",
      "Add real RevenueCat iOS/Android SDK keys and entitlement, or switch back to EXPO_PUBLIC_STORE_PROVIDER=native-iap."
    ),
    check(
      "admob-app-ids",
      isAdMobAppId(readEnv(env, "EXPO_PUBLIC_ADMOB_APP_ID_IOS")) &&
        isAdMobAppId(readEnv(env, "EXPO_PUBLIC_ADMOB_APP_ID_ANDROID")),
      "iOS and Android AdMob app IDs are checked for production format and non-sample publisher IDs.",
      "Configure EXPO_PUBLIC_ADMOB_APP_ID_IOS and EXPO_PUBLIC_ADMOB_APP_ID_ANDROID with real ca-app-pub IDs."
    ),
    check(
      "admob-rewarded-units",
      isRewardedAdUnitId(readEnv(env, "EXPO_PUBLIC_ADMOB_REWARDED_RESET_UNIT_ID_IOS")) &&
        isRewardedAdUnitId(readEnv(env, "EXPO_PUBLIC_ADMOB_REWARDED_RESET_UNIT_ID_ANDROID")),
      "iOS and Android rewarded reset units are checked for production format and non-sample publisher IDs.",
      "Configure real rewarded unit IDs for both platforms."
    ),
    check(
      "admob-test-ads-disabled",
      readEnv(env, "EXPO_PUBLIC_ADMOB_USE_TEST_ADS") === "false",
      readEnv(env, "EXPO_PUBLIC_ADMOB_USE_TEST_ADS") === "false"
        ? "AdMob test ads are explicitly disabled."
        : "EXPO_PUBLIC_ADMOB_USE_TEST_ADS is not explicitly false.",
      "Set EXPO_PUBLIC_ADMOB_USE_TEST_ADS=false for production release verification."
    ),
    check(
      "admob-request-country",
      isOptionalCountryCode(readEnv(env, "EXPO_PUBLIC_ADMOB_REQUEST_COUNTRY")),
      readEnv(env, "EXPO_PUBLIC_ADMOB_REQUEST_COUNTRY")
        ? "Optional AdMob request country is a recognized ISO 3166-1 alpha-2 code."
        : "Optional AdMob request country is unset.",
      "Use a recognized ISO 3166-1 alpha-2 code such as US, or leave EXPO_PUBLIC_ADMOB_REQUEST_COUNTRY unset."
    ),
    check(
      "ai-coach-mode",
      readEnv(env, "EXPO_PUBLIC_AI_COACH_MODE") === "remote",
      readEnv(env, "EXPO_PUBLIC_AI_COACH_MODE") === "remote"
        ? "Remote CLARA mode is enabled."
        : "EXPO_PUBLIC_AI_COACH_MODE is not remote.",
      "Set EXPO_PUBLIC_AI_COACH_MODE=remote for deployed backend verification."
    ),
    checkEndpointWithTimeout(
      "ai-coach-endpoint",
      env,
      "EXPO_PUBLIC_AI_COACH_ENDPOINT",
      "CLARA endpoint",
      "EXPO_PUBLIC_AI_COACH_TIMEOUT_MS",
      1_000,
      12_000,
      "/api/clara"
    ),
    check(
      "ai-challenge-mode",
      readEnv(env, "EXPO_PUBLIC_AI_CHALLENGE_MODE") === "remote",
      readEnv(env, "EXPO_PUBLIC_AI_CHALLENGE_MODE") === "remote"
        ? "Remote challenge generation mode is enabled."
        : "EXPO_PUBLIC_AI_CHALLENGE_MODE is not remote.",
      "Set EXPO_PUBLIC_AI_CHALLENGE_MODE=remote for deployed backend verification."
    ),
    checkEndpointWithTimeout(
      "ai-challenge-endpoint",
      env,
      "EXPO_PUBLIC_AI_CHALLENGE_ENDPOINT",
      "challenge endpoint",
      "EXPO_PUBLIC_AI_CHALLENGE_TIMEOUT_MS",
      1_000,
      12_000,
      "/api/challenges"
    ),
    checkEndpoint(
      "adult-domain-feed-endpoint",
      env,
      "EXPO_PUBLIC_ADULT_DOMAIN_FEED_ENDPOINT",
      "adult domain feed endpoint",
      "/api/adult-domain-feed"
    ),
    check(
      "adult-domain-feed-sources",
      adultFeedSourceIssues.length === 0,
      adultFeedSourceIssues.length === 0
        ? "Reviewed adult-domain feed source URLs and optional feed runtime bounds are configured with production-safe values."
        : adultFeedSourceIssues.join(", "),
      "Configure FREED_ADULT_DOMAIN_FEED_SOURCE_URLS with reviewed id|label|https://source-url entries such as OISD NSFW or StevenBlack-style adult lists, and keep optional feed cache/timeout/size values within documented bounds."
    ),
    check(
      "supabase-backend-credentials",
      supabaseIssues.length === 0,
      supabaseIssues.length === 0
        ? "Supabase backend URL, public auth URL, service-role key, public anon lockout proof key, maintenance secret, and optional provider timeout/response-size bounds are configured with production shape."
        : supabaseIssues.join(", "),
      "Configure SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, EXPO_PUBLIC_SUPABASE_URL, EXPO_PUBLIC_SUPABASE_ANON_KEY, BACKEND_MAINTENANCE_SECRET or CRON_SECRET, and optional FREED_BACKEND_PROVIDER_TIMEOUT_MS / FREED_BACKEND_PROVIDER_RESPONSE_MAX_BYTES / FREED_SUPABASE_SCHEMA_SMOKE_TIMEOUT_MS with production values."
    ),
    check(
      "redis-backend-infrastructure",
      redisIssues.length === 0,
      redisIssues.length === 0
        ? "Redis/Upstash REST URL and token are configured with production shape for route limits and locks."
        : redisIssues.join(", "),
      "Configure UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN with server-only production values."
    ),
    check(
      "backend-readiness-endpoint",
      backendReadinessIssues.length === 0,
      backendReadinessIssues.length === 0
        ? "Backend readiness endpoint targets the deployed no-secret readiness route and optional smoke timeout is bounded."
        : backendReadinessIssues.join(", "),
      "Configure EXPO_PUBLIC_BACKEND_READINESS_ENDPOINT as the deployed /api/backend/readiness route, or let the smoke command derive it from another deployed app endpoint, and keep optional timeout values bounded."
    ),
    check(
      "remote-notification-provider-credentials",
      notificationIssues.length === 0,
      notificationIssues.length === 0
        ? "Remote notification dispatch secret, optional provider timeout/response-size/smoke bounds, and FCM/APNs provider credentials are production-shaped."
        : notificationIssues.join(", "),
      "Configure REMOTE_NOTIFICATION_DISPATCH_SECRET, optional FREED_REMOTE_NOTIFICATION_PROVIDER_TIMEOUT_MS, FREED_REMOTE_NOTIFICATION_PROVIDER_RESPONSE_MAX_BYTES, and FREED_REMOTE_NOTIFICATION_SMOKE_TIMEOUT_MS, FCM credentials with FIREBASE_PROJECT_ID or Firebase service-account project_id, and APNs production signing credentials for server-authorized recovery-safe push dispatch."
    ),
    check(
      "optional-challenge-weather-context",
      optionalWeatherIssues.length === 0,
      optionalWeatherIssues.length === 0
        ? "Optional challenge weather context is disabled or points to a production-safe endpoint with bounded transport."
        : optionalWeatherIssues.join(", "),
      "Leave EXPO_PUBLIC_CHALLENGE_WEATHER_CONTEXT_ENABLED=false, or configure EXPO_PUBLIC_CHALLENGE_WEATHER_CONTEXT_ENDPOINT as an HTTPS non-local deployed weather API route after privacy review with bounded timeout/response-size values."
    ),
    check(
      "analytics-ingestion-endpoint",
      analyticsIssues.length === 0,
      analyticsIssues.length === 0
        ? "Remote analytics endpoint points at the aggregate analytics route and optional analytics timeout/response-size bounds are configured."
        : analyticsIssues.join(", "),
      "Configure EXPO_PUBLIC_ANALYTICS_ENDPOINT as the deployed aggregate-only app/api/analytics route after privacy review; runtime sharing still requires explicit user consent, and optional analytics timeout/response-size values must stay within documented bounds."
    ),
    check(
      "optional-recovery-backup-sync-endpoint",
      optionalBackupSyncIssues.length === 0,
      optionalBackupSyncIssues.length === 0
        ? "Optional recovery backup sync endpoint is blank or production-safe with bounded sync timeout/response-size values."
        : optionalBackupSyncIssues.join(", "),
      "Leave EXPO_PUBLIC_RECOVERY_BACKUP_SYNC_ENDPOINT blank, or point it at the deployed encrypted-backup sync route after Supabase Auth and privacy review with optional sync timeout/response-size values within documented bounds."
    ),
    check(
      "optional-supabase-auth-client",
      optionalSupabaseAuthIssues.length === 0,
      optionalSupabaseAuthIssues.length === 0
        ? "Optional Supabase Auth client config is blank or uses a public URL plus anon key only with bounded auth timeout/response-size values."
        : optionalSupabaseAuthIssues.join(", "),
      "When hosted backup sync is enabled, set EXPO_PUBLIC_SUPABASE_URL plus EXPO_PUBLIC_SUPABASE_ANON_KEY, keep service-role/JWT secrets server-only, and keep optional Supabase Auth timeout/response-size values within documented bounds."
    ),
    check(
      "optional-retention-endpoint",
      optionalRetentionIssues.length === 0,
      optionalRetentionIssues.length === 0
        ? "Optional retention orchestration is local or points to a production-safe timeout-bounded endpoint."
        : optionalRetentionIssues.join(", "),
      "Keep EXPO_PUBLIC_RETENTION_MODE=local, or configure EXPO_PUBLIC_RETENTION_ENDPOINT as the deployed aggregate-only app/api/retention route after privacy review with optional EXPO_PUBLIC_RETENTION_TIMEOUT_MS within documented bounds."
    ),
    check(
      "server-ai-key",
      aiServerReady && aiServerIssues.length === 0,
      aiServerReady && aiServerIssues.length === 0
        ? aiProvider
          ? `Server-only ${aiProvider} AI provider key and model are configured with production shape.`
          : "Server-only OpenAI or Google/Gemini AI provider key and model are configured with production shape."
        : aiServerIssues.length > 0
          ? aiServerIssues.join(", ")
          : "OPENAI_API_KEY and OPENAI_MODEL, or GEMINI_API_KEY/GOOGLE_API_KEY/GOOGLE_GENAI_API_KEY and GEMINI_MODEL, are missing or malformed.",
      "Configure a real OpenAI or Google/Gemini API key plus concrete model only in the server environment, never as EXPO_PUBLIC_*, and keep optional server AI provider timeout and response-size values within documented bounds."
    )
  ];

  const backendProvider = getBackendProvider(env);
  const productIssues = firebaseLaunchProductIdIssues(env);
  const selectedChecks = backendProvider === "firebase"
    ? COMMON_PREFLIGHT_IDS.map(id => id === "iap-product-ids"
      ? check(id, productIssues.length === 0, productIssues.join("; ") || "Resolved launch identifiers use the actual freed_premium_yearly and freed_premium_monthly defaults; live store setup is verified separately.", "Use the approved monthly/yearly identifiers; no lifetime or trial product is part of launch.")
      : checks.find(entry => entry.id === id)).concat(getFirebasePreflightChecks(env))
    : checks;
  const report = buildReport(sourceLabel, selectedChecks, {
    backendProvider,
    artifactRoot: artifactRootForReport(reportPath),
    includeBlockerGroups: true
  });
  printReport(report);
  if (reportPath) writeReport(reportPath, report);

  if (report.failCount > 0) process.exitCode = 1;
}

function main() {
let args;
try {
  args = parseArgs(process.argv.slice(2));
  if (args.report) {
    const issue = reportPathIssue(args.report);
    if (issue) throw new Error(issue);
  }
} catch (error) {
  const report = buildReport("invalid arguments", [
    check(
      "release-env-arguments",
      false,
      error instanceof Error ? error.message : "Invalid release environment preflight arguments.",
      "Use npm run preflight:release-env, optionally with -- --env-file <path> and --report <path>."
    )
  ]);
  printReport(report);
  process.exitCode = 1;
  return;
}
let env = { ...process.env };
let sourceLabel = "process.env";

if (args.envFile) {
  const envFileIssue = envFilePathIssue(args.envFile, "release env file");
  const absolute = resolve(process.cwd(), expandEnvFileHome(args.envFile));
  if (envFileIssue) {
    const report = buildReport("invalid env file", [
      check(
        "release-env-file",
        false,
        envFileIssue,
        "Pass a local production env file path without URLs, flags, shell syntax, or template placeholders."
      )
    ]);
    printReport(report);
    if (args.report) writeReport(args.report, report);
    process.exitCode = 1;
  } else if (!existsSync(absolute)) {
    const report = buildReport("missing env file", [
      check(
        "release-env-file",
        false,
        `Env file not found: ${args.envFile}`,
        "Pass a local production env file path that exists."
      )
    ]);
    printReport(report);
    if (args.report) writeReport(args.report, report);
    process.exitCode = 1;
  } else {
    try {
      env = { ...process.env, ...loadEnvFile(args.envFile, "release env file") };
      sourceLabel = `${args.envFile} merged with process.env`;
      runPreflight(env, sourceLabel, args.report);
    } catch (error) {
      const report = buildReport("invalid env file contents", [
        check(
          "release-env-file",
          false,
          error instanceof Error ? error.message : "release env file could not be parsed",
          "Fix malformed non-comment lines before rerunning release preflight."
        )
      ]);
      printReport(report);
      if (args.report) writeReport(args.report, report);
      process.exitCode = 1;
    }
  }
} else {
  runPreflight(env, sourceLabel, args.report);
}
}

module.exports = { getBackendProvider, getPreflightCheckIds, getFirebasePreflightChecks, firebaseRuntimeEvidenceIssues, firebaseLaunchProductIdIssues, getProductionBlockerGroups, getLegalUrls, FIREBASE_PREFLIGHT_IDS, COMMON_PREFLIGHT_IDS, FIREBASE_REQUIRED_CALLABLE_NAMES, FIREBASE_REQUIRED_SECRET_NAMES };
if (require.main === module) {
  try { main(); } catch (error) { console.error(sanitizeReportText(error instanceof Error ? error.message : "Release preflight failed.")); process.exitCode = 1; }
}
