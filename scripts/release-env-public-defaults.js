#!/usr/bin/env node

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { sanitizeLocalHomePaths } = require("./lib/local-path-privacy");

const DEFAULT_ENV_FILE = "~/.freed/android-upload/freed-upload.env";
const PUBLIC_DEFAULTS = {
  EXPO_PUBLIC_MONETIZATION_MODE: "native",
  EXPO_PUBLIC_STORE_PROVIDER: "native-iap",
  EXPO_PUBLIC_PREMIUM_ENTITLEMENT_ID: "premium",
  EXPO_PUBLIC_IAP_PRODUCT_YEARLY: "freed_premium_yearly",
  EXPO_PUBLIC_IAP_PRODUCT_MONTHLY: "freed_premium_monthly",
  EXPO_PUBLIC_IAP_PRODUCT_LIFETIME: "freed_premium_lifetime",
  EXPO_PUBLIC_ADMOB_USE_TEST_ADS: "false",
  APP_STORE_BUNDLE_ID: "app.freed.recovery",
  APP_STORE_SERVER_API_ENV: "production",
  GOOGLE_PLAY_PACKAGE_NAME: "app.freed.recovery",
  EXPO_PUBLIC_REQUIRE_REVIEWED_ADULT_DOMAIN_FEED: "true",
  EXPO_PUBLIC_AI_COACH_MODE: "remote",
  EXPO_PUBLIC_AI_CHALLENGE_MODE: "remote",
  APNS_ENV: "production",
};

function printHelp() {
  console.log(`Usage: npm run setup:release-env-public-defaults -- [options]

Applies only non-secret public launch defaults to the private production env
file. This helper never writes credentials, endpoints, purchase tokens, service
accounts, private keys, Supabase service-role keys, Redis tokens, push
credentials, or AI provider keys.

Options:
  --env-file <path>   Private release env file outside the repo.
                      Default: ${DEFAULT_ENV_FILE}
  --write             Write changes. Without this flag, prints a sanitized dry run.
  --self-test         Run offline parser/writer checks.
`);
}

function expandHome(value) {
  const raw = String(value || "").trim();
  if (raw === "~") return os.homedir();
  if (raw.startsWith("~/")) return path.join(os.homedir(), raw.slice(2));
  return raw;
}

function repoRelative(filePath) {
  return path.relative(process.cwd(), path.resolve(filePath)).replace(/\\/g, "/");
}

function isInside(parent, child) {
  const relative = path.relative(parent, child);
  return relative === "" || (!!relative && !relative.startsWith("..") && !path.isAbsolute(relative));
}

function assertSafePrivateEnvPath(value, label) {
  const raw = String(value || "").trim();
  if (!raw) throw new Error(`${label} is required.`);
  if (raw.includes("\0") || raw.includes("\n") || raw.includes("\r")) {
    throw new Error(`${label} must be a plain env file path.`);
  }
  if (raw.startsWith("-") || /[;&|`$<>]/.test(raw.replace(/^~(?=\/|$)/, ""))) {
    throw new Error(`${label} must not contain shell syntax or flags.`);
  }

  const absolutePath = path.resolve(expandHome(raw));
  const normalized = absolutePath.replace(/\\/g, "/");
  const repoRoot = process.cwd();
  if (isInside(repoRoot, absolutePath)) {
    throw new Error(`${label} must point outside this repository so secrets are not committed.`);
  }
  if (/\/docs\/validation\/(artifacts|evidence)(\/|$)/i.test(normalized)) {
    throw new Error(`${label} must not point at validation evidence or artifact folders.`);
  }
  if (!normalized.endsWith(".env")) throw new Error(`${label} must end in .env.`);
  return absolutePath;
}

function parseArgs(argv) {
  const options = {
    envFile: DEFAULT_ENV_FILE,
    selfTest: false,
    write: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = () => {
      index += 1;
      if (index >= argv.length) throw new Error(`Missing value for ${arg}`);
      return argv[index];
    };

    if (arg === "--env-file") options.envFile = next();
    else if (arg === "--write") options.write = true;
    else if (arg === "--self-test") options.selfTest = true;
    else if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    } else {
      throw new Error(`Unknown option: ${arg}`);
    }
  }

  if (!options.selfTest) options.envFile = assertSafePrivateEnvPath(options.envFile, "--env-file");
  return options;
}

function activeEnvKey(line) {
  const match = String(line || "").match(/^\s*([A-Z0-9_]+)\s*=/);
  return match ? match[1] : null;
}

function applyPublicDefaultsToText(input) {
  const seen = new Set();
  const changedKeys = [];
  const addedKeys = [];
  const updatedKeys = [];
  const duplicateKeysDisabled = [];
  const lines = String(input || "").split(/\r?\n/);
  const output = [];

  for (const line of lines) {
    const key = activeEnvKey(line);
    if (!key || !Object.prototype.hasOwnProperty.call(PUBLIC_DEFAULTS, key)) {
      output.push(line);
      continue;
    }

    if (seen.has(key)) {
      duplicateKeysDisabled.push(key);
      output.push(`# disabled duplicate public launch default: ${line}`);
      continue;
    }

    seen.add(key);
    const nextLine = `${key}=${PUBLIC_DEFAULTS[key]}`;
    if (line !== nextLine) {
      changedKeys.push(key);
      updatedKeys.push(key);
    }
    output.push(nextLine);
  }

  const missingKeys = Object.keys(PUBLIC_DEFAULTS).filter((key) => !seen.has(key));
  if (missingKeys.length > 0) {
    const needsSpacer = output.some((line) => line.trim());
    if (needsSpacer && output[output.length - 1] !== "") output.push("");
    output.push("# FREED public launch defaults; values are non-secret and must match the Core 3 catalog.");
    for (const key of missingKeys) {
      output.push(`${key}=${PUBLIC_DEFAULTS[key]}`);
      changedKeys.push(key);
      addedKeys.push(key);
    }
  }

  while (output.length > 0 && output[output.length - 1] === "") output.pop();
  return {
    addedKeys,
    changed: changedKeys.length > 0 || duplicateKeysDisabled.length > 0,
    changedKeys: [...new Set(changedKeys)],
    duplicateKeysDisabled,
    output: `${output.join("\n")}\n`,
    updatedKeys,
  };
}

function timestampLabel(now = new Date()) {
  return now.toISOString().replace(/[:.]/g, "-");
}

function applyPublicDefaultsToFile(envFile, { write }) {
  const existed = fs.existsSync(envFile);
  const before = existed ? fs.readFileSync(envFile, "utf8") : "";
  const result = applyPublicDefaultsToText(before);
  const backupPath = `${envFile}.${timestampLabel()}.bak`;

  if (write && result.changed) {
    fs.mkdirSync(path.dirname(envFile), { recursive: true });
    if (existed) fs.copyFileSync(envFile, backupPath);
    fs.writeFileSync(envFile, result.output, { mode: 0o600 });
  }

  return {
    addedKeys: result.addedKeys,
    backupPath: write && result.changed && existed ? backupPath : "",
    changed: result.changed,
    changedKeys: result.changedKeys,
    duplicateKeysDisabled: result.duplicateKeysDisabled,
    envFile,
    existed,
    mode: write ? "write" : "dry-run",
    publicDefaultsChecked: Object.keys(PUBLIC_DEFAULTS),
    secretBoundary:
      "Only non-secret public launch defaults were applied. Endpoints, AdMob IDs, App Store keys, Play service accounts, Supabase/Redis secrets, push credentials, purchase tokens, and AI provider keys remain manual private-env inputs.",
    updatedKeys: result.updatedKeys,
    wouldWrite: !write && result.changed,
  };
}

function sanitizedReport(report) {
  return JSON.stringify(
    {
      ...report,
      backupPath: report.backupPath ? sanitizeLocalHomePaths(report.backupPath) : "",
      envFile: sanitizeLocalHomePaths(report.envFile),
    },
    null,
    2,
  );
}

function runSelfTest() {
  assert.throws(() => assertSafePrivateEnvPath("docs/validation/artifacts/prod.env", "--env-file"), /outside this repository|validation/);
  assert.throws(() => assertSafePrivateEnvPath("prod.txt", "--env-file"), /outside this repository|must end in \.env/);
  const sample = [
    "EXPO_PUBLIC_MONETIZATION_MODE=mock",
    "EXPO_PUBLIC_IAP_PRODUCT_YEARLY=old_yearly",
    "SECRET_KEY=keep-me",
    "EXPO_PUBLIC_IAP_PRODUCT_YEARLY=duplicate",
    "",
  ].join("\n");
  const applied = applyPublicDefaultsToText(sample);
  assert.equal(applied.changed, true);
  assert.match(applied.output, /EXPO_PUBLIC_MONETIZATION_MODE=native/);
  assert.match(applied.output, /EXPO_PUBLIC_PREMIUM_ENTITLEMENT_ID=premium/);
  assert.match(applied.output, /EXPO_PUBLIC_IAP_PRODUCT_YEARLY=freed_premium_yearly/);
  assert.match(applied.output, /EXPO_PUBLIC_IAP_PRODUCT_MONTHLY=freed_premium_monthly/);
  assert.match(applied.output, /EXPO_PUBLIC_IAP_PRODUCT_LIFETIME=freed_premium_lifetime/);
  assert.match(applied.output, /APP_STORE_BUNDLE_ID=app\.freed\.recovery/);
  assert.match(applied.output, /GOOGLE_PLAY_PACKAGE_NAME=app\.freed\.recovery/);
  assert.match(applied.output, /SECRET_KEY=keep-me/);
  assert.match(applied.output, /disabled duplicate public launch default/);
  assert.ok(applied.changedKeys.includes("EXPO_PUBLIC_MONETIZATION_MODE"));
  assert.ok(applied.addedKeys.includes("EXPO_PUBLIC_PREMIUM_ENTITLEMENT_ID"));
  const unchanged = applyPublicDefaultsToText(applied.output);
  assert.equal(unchanged.changed, false);
  assert.equal(unchanged.addedKeys.length, 0);
  console.log("release-env-public-defaults self-test: pass");
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.selfTest) {
    runSelfTest();
    return;
  }

  const report = applyPublicDefaultsToFile(options.envFile, { write: options.write });
  console.log(sanitizedReport(report));
}

if (require.main === module) {
  main();
}

module.exports = {
  PUBLIC_DEFAULTS,
  applyPublicDefaultsToText,
};
