const { existsSync, readdirSync, readFileSync, statSync } = require("node:fs");
const { join } = require("node:path");

const root = process.cwd();

const requiredArtifacts = [
  {
    id: "web-static-bundle",
    path: "dist",
    description: "Expo web static export"
  },
  {
    id: "android-embedded-bundle",
    path: "android/app/src/main/assets/index.android.bundle",
    description: "Android embedded React Native bundle"
  }
];

const forbiddenSnippets = [
  "SUPABASE_SERVICE_ROLE_KEY",
  "BACKEND_MAINTENANCE_SECRET",
  "CRON_SECRET",
  "UPSTASH_REDIS_REST_URL",
  "UPSTASH_REDIS_REST_TOKEN",
  "OPENAI_API_KEY",
  "GEMINI_API_KEY",
  "GOOGLE_API_KEY",
  "GOOGLE_GENAI_API_KEY",
  "APP_STORE_ISSUER_ID",
  "APP_STORE_KEY_ID",
  "APP_STORE_PRIVATE_KEY",
  "APP_STORE_PRIVATE_KEY_BASE64",
  "APP_STORE_SERVER_API_JWT",
  "GOOGLE_PLAY_SERVICE_ACCOUNT_JSON",
  "GOOGLE_PLAY_SERVICE_ACCOUNT_JSON_BASE64",
  "GOOGLE_PLAY_ACCESS_TOKEN",
  "REMOTE_NOTIFICATION_DISPATCH_SECRET",
  "FCM_SERVER_KEY",
  "FCM_ACCESS_TOKEN",
  "FIREBASE_PROJECT_ID",
  "FIREBASE_SERVICE_ACCOUNT_JSON",
  "FIREBASE_SERVICE_ACCOUNT_JSON_BASE64",
  "APNS_KEY_ID",
  "APNS_TEAM_ID",
  "APNS_PRIVATE_KEY",
  "APNS_PRIVATE_KEY_BASE64",
  "createAppleServerJwt",
  "createGooglePlayAccessToken",
  "verifyPurchasePayload",
  "createServerAiText",
  "sendRemoteNotification",
  "cleanupExpiredBackendRows",
  "raw-ios-receipt-secret",
  "smoke-secret-token"
];

function file(path) {
  return join(root, path);
}

function collectFiles(path) {
  const absolute = file(path);
  if (!existsSync(absolute)) return [];
  const stat = statSync(absolute);
  if (stat.isFile()) return [absolute];

  return readdirSync(absolute).flatMap((name) => {
    const child = join(path, name);
    const childAbsolute = file(child);
    const childStat = statSync(childAbsolute);
    if (childStat.isDirectory()) return collectFiles(child);
    return childStat.isFile() ? [childAbsolute] : [];
  });
}

function scanArtifact(path) {
  const files = collectFiles(path).filter((item) => /\.(bundle|js|html|json)$/i.test(item));
  const matches = [];

  for (const filePath of files) {
    const text = readFileSync(filePath, "utf8");
    for (const snippet of forbiddenSnippets) {
      if (text.includes(snippet)) {
        matches.push(`${filePath.replace(`${root}/`, "")}: ${snippet}`);
      }
    }
  }

  return { filesScanned: files.length, matches };
}

const checks = requiredArtifacts.map((artifact) => {
  const absolute = file(artifact.path);
  if (!existsSync(absolute)) {
    return {
      id: artifact.id,
      status: "fail",
      evidence: `${artifact.description} is missing at ${artifact.path}. Run the matching export script before release.`
    };
  }

  const result = scanArtifact(artifact.path);
  return {
    id: artifact.id,
    status: result.matches.length === 0 && result.filesScanned > 0 ? "pass" : "fail",
    evidence:
      result.filesScanned === 0
        ? `${artifact.description} had no scannable bundle files.`
        : result.matches.length === 0
          ? `${artifact.description} scanned ${result.filesScanned} files with no server-only store, AI, Supabase, Redis, notification, maintenance, or purchase verifier leakage.`
          : `Forbidden server-only strings found: ${result.matches.join("; ")}`
  };
});

const failed = checks.filter((entry) => entry.status === "fail");

console.log("# FREED client bundle secret audit");
console.log(`Result: ${checks.length - failed.length} pass, ${failed.length} fail`);
console.log("");
console.log("| Status | Gate | Evidence |");
console.log("| --- | --- | --- |");
for (const entry of checks) {
  console.log(`| ${entry.status.toUpperCase()} | ${entry.id} | ${entry.evidence.replace(/\|/g, "/")} |`);
}

if (failed.length > 0) process.exitCode = 1;
