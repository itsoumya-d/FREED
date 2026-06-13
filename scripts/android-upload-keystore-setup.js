#!/usr/bin/env node

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const ROOT = path.resolve(__dirname, "..");
const DEFAULT_ALIAS = "freed-upload";
const DEFAULT_DNAME = "CN=FREED Upload, OU=Release, O=FREED, L=Kolkata, ST=West Bengal, C=IN";
const DEFAULT_HOME_DIR = path.join(os.homedir(), ".freed", "android-upload");
const DEFAULT_STORE_FILE = path.join(DEFAULT_HOME_DIR, "freed-upload.jks");
const DEFAULT_ENV_OUTPUT = path.join(DEFAULT_HOME_DIR, "freed-upload.env");
const MIN_PASSWORD_LENGTH = 16;

function printHelp() {
  console.log(`Usage: npm run setup:android-upload-keystore -- [options]

Creates a non-debug Android upload keystore for Play Console release builds and
writes the FREED_ANDROID_UPLOAD_* env snippet outside the repository.

Options:
  --store-file <path>          Output keystore path. Default: ~/.freed/android-upload/freed-upload.jks
  --env-output <path>          Optional env snippet path. Default with --generate-passwords:
                               ~/.freed/android-upload/freed-upload.env
  --alias <name>               Key alias. Default: ${DEFAULT_ALIAS}
  --dname <name>               X.509 distinguished name.
  --store-password <value>     Store password. Required unless --generate-passwords.
  --key-password <value>       Key password. Required unless --generate-passwords.
  --generate-passwords         Generate store/key passwords and write them to --env-output.
  --overwrite                  Replace an existing keystore/env-output.
  --print-env                  Print the full env snippet to stdout. Use with care.
  --plan-only                  Print the resolved safe paths and keytool command without writing.
  --self-test                  Run offline argument/path checks.
`);
}

function resolveUserPath(value, fallback) {
  const raw = value && value.trim() ? value.trim() : fallback;
  if (!raw) throw new Error("Path is required.");
  if (raw.startsWith("~")) return path.resolve(os.homedir(), raw.slice(1));
  if (!path.isAbsolute(raw)) throw new Error(`${raw} must be an absolute path or start with ~/.`);
  return path.resolve(raw);
}

function isInside(parent, candidate) {
  const relative = path.relative(parent, candidate);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

function assertSafeSecretPath(filePath, label) {
  const resolved = path.resolve(filePath);
  if (isInside(ROOT, resolved)) {
    throw new Error(`${label} must stay outside this repository so release secrets cannot be committed.`);
  }
  if (/(^|[/\\])debug\.keystore$/i.test(resolved)) {
    throw new Error(`${label} must not point at Android's debug.keystore.`);
  }
  if (fs.existsSync(resolved) && !fs.statSync(resolved).isFile()) {
    throw new Error(`${label} must point to a file path, not a directory.`);
  }
  const parent = path.dirname(resolved);
  if (fs.existsSync(parent) && fs.lstatSync(parent).isSymbolicLink()) {
    throw new Error(`${label} parent directory must not be a symlink.`);
  }
  return resolved;
}

function safeAlias(value) {
  const alias = value || DEFAULT_ALIAS;
  if (!/^[A-Za-z0-9._-]{3,64}$/.test(alias)) {
    throw new Error("--alias must be 3-64 characters and contain only letters, numbers, dots, underscores, or hyphens.");
  }
  if (/androiddebugkey/i.test(alias)) throw new Error("--alias must not be androiddebugkey.");
  return alias;
}

function unsafePasswordReason(value, label) {
  if (typeof value !== "string" || !value) return `${label} is required.`;
  if (/^(android|password|changeme|freed|release)$/i.test(value)) return `${label} is too guessable.`;
  if (value.length < MIN_PASSWORD_LENGTH) return `${label} must be at least ${MIN_PASSWORD_LENGTH} characters.`;
  if (/\s/.test(value)) return `${label} must not contain whitespace.`;
  return null;
}

function generatePassword() {
  return crypto
    .randomBytes(24)
    .toString("base64")
    .replace(/[+/=]/g, "")
    .slice(0, 32);
}

function shellQuote(value) {
  if (/^[A-Za-z0-9_./:=@%+-]+$/.test(value)) return value;
  return `'${value.replace(/'/g, "'\\''")}'`;
}

function envSnippet({ storeFile, storePassword, keyAlias, keyPassword }) {
  return [
    "# FREED Android upload signing. Keep this file out of git and evidence artifacts.",
    `FREED_ANDROID_UPLOAD_STORE_FILE=${storeFile}`,
    `FREED_ANDROID_UPLOAD_STORE_PASSWORD=${storePassword}`,
    `FREED_ANDROID_UPLOAD_KEY_ALIAS=${keyAlias}`,
    `FREED_ANDROID_UPLOAD_KEY_PASSWORD=${keyPassword}`,
    "FREED_REQUIRE_ANDROID_RELEASE_SIGNING=true",
    ""
  ].join("\n");
}

function parseArgs(argv) {
  const options = {
    alias: DEFAULT_ALIAS,
    dname: DEFAULT_DNAME,
    envOutput: "",
    generatePasswords: false,
    keyPassword: "",
    overwrite: false,
    planOnly: false,
    printEnv: false,
    selfTest: false,
    storeFile: "",
    storePassword: ""
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = () => {
      index += 1;
      if (index >= argv.length) throw new Error(`Missing value for ${arg}`);
      return argv[index];
    };

    if (arg === "--alias") options.alias = next();
    else if (arg === "--dname") options.dname = next();
    else if (arg === "--env-output") options.envOutput = next();
    else if (arg === "--generate-passwords") options.generatePasswords = true;
    else if (arg === "--key-password") options.keyPassword = next();
    else if (arg === "--overwrite") options.overwrite = true;
    else if (arg === "--plan-only") options.planOnly = true;
    else if (arg === "--print-env") options.printEnv = true;
    else if (arg === "--self-test") options.selfTest = true;
    else if (arg === "--store-file") options.storeFile = next();
    else if (arg === "--store-password") options.storePassword = next();
    else if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    } else {
      throw new Error(`Unknown option: ${arg}`);
    }
  }

  if (options.selfTest) return options;

  const storeFile = assertSafeSecretPath(resolveUserPath(options.storeFile, DEFAULT_STORE_FILE), "--store-file");
  const envOutput = options.envOutput
    ? assertSafeSecretPath(resolveUserPath(options.envOutput, ""), "--env-output")
    : options.generatePasswords
      ? assertSafeSecretPath(DEFAULT_ENV_OUTPUT, "--env-output")
      : "";
  const alias = safeAlias(options.alias);
  const storePassword = options.generatePasswords ? generatePassword() : options.storePassword;
  const keyPassword = options.generatePasswords ? generatePassword() : options.keyPassword;
  const passwordIssues = [
    unsafePasswordReason(storePassword, "--store-password"),
    unsafePasswordReason(keyPassword, "--key-password")
  ].filter(Boolean);
  if (passwordIssues.length > 0) throw new Error(passwordIssues.join(" "));
  return {
    ...options,
    alias,
    envOutput,
    keyPassword,
    storeFile,
    storePassword
  };
}

function keytoolArgs(options) {
  return [
    "-genkeypair",
    "-v",
    "-storetype",
    "JKS",
    "-keystore",
    options.storeFile,
    "-alias",
    options.alias,
    "-keyalg",
    "RSA",
    "-keysize",
    "4096",
    "-validity",
    "10000",
    "-storepass",
    options.storePassword,
    "-keypass",
    options.keyPassword,
    "-noprompt",
    "-dname",
    options.dname
  ];
}

function redactedPlan(options) {
  return {
    alias: options.alias,
    envOutput: options.envOutput || "(not written)",
    keytoolCommand: ["keytool", ...keytoolArgs({ ...options, storePassword: "[redacted]", keyPassword: "[redacted]" })],
    storeFile: options.storeFile
  };
}

function writeSecretFile(filePath, contents, overwrite) {
  if (!overwrite && fs.existsSync(filePath)) throw new Error(`${filePath} already exists; pass --overwrite to replace it.`);
  fs.mkdirSync(path.dirname(filePath), { recursive: true, mode: 0o700 });
  fs.writeFileSync(filePath, contents, { mode: 0o600 });
  try {
    fs.chmodSync(filePath, 0o600);
  } catch {
    // Best effort on filesystems that do not support chmod.
  }
}

function createKeystore(options) {
  if (!options.overwrite && fs.existsSync(options.storeFile)) {
    throw new Error(`${options.storeFile} already exists; pass --overwrite to replace it.`);
  }
  fs.mkdirSync(path.dirname(options.storeFile), { recursive: true, mode: 0o700 });
  const result = spawnSync("keytool", keytoolArgs(options), {
    cwd: ROOT,
    encoding: "utf8",
    maxBuffer: 1024 * 1024,
    timeout: 30000
  });
  if (result.status !== 0) {
    throw new Error(`keytool failed: ${(result.stderr || result.stdout || "").trim()}`);
  }
  try {
    fs.chmodSync(options.storeFile, 0o600);
  } catch {
    // Best effort on filesystems that do not support chmod.
  }
}

function runSelfTest() {
  assert.equal(safeAlias("freed-upload"), "freed-upload");
  assert.throws(() => safeAlias("androiddebugkey"), /androiddebugkey/);
  assert.match(unsafePasswordReason("android", "--store-password") || "", /guessable/);
  assert.equal(unsafePasswordReason("A".repeat(16), "--store-password"), null);
  assert.throws(() => assertSafeSecretPath(path.join(ROOT, "freed-upload.jks"), "--store-file"), /outside this repository/);
  assert.throws(() => assertSafeSecretPath(path.join(os.homedir(), ".android", "debug.keystore"), "--store-file"), /debug\.keystore/);
  const parsed = parseArgs([
    "--store-file",
    path.join(os.homedir(), ".freed", "android-upload", "test-upload.jks"),
    "--store-password",
    "releaseUploadStorePassword123",
    "--key-password",
    "releaseUploadKeyPassword123",
    "--alias",
    "freed-upload",
    "--plan-only"
  ]);
  assert.equal(parsed.alias, "freed-upload");
  assert.equal(parsed.planOnly, true);
  assert.ok(keytoolArgs(parsed).includes("-genkeypair"));
  assert.ok(envSnippet({
    storeFile: "/secure/freed-upload.jks",
    storePassword: "releaseUploadStorePassword123",
    keyAlias: "freed-upload",
    keyPassword: "releaseUploadKeyPassword123"
  }).includes("FREED_ANDROID_UPLOAD_STORE_FILE=/secure/freed-upload.jks"));
  console.log("android-upload-keystore-setup self-test: pass");
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.selfTest) {
    runSelfTest();
    return;
  }

  if (options.planOnly) {
    console.log(JSON.stringify(redactedPlan(options), null, 2));
    return;
  }

  createKeystore(options);
  if (options.envOutput) {
    writeSecretFile(
      options.envOutput,
      envSnippet({
        storeFile: options.storeFile,
        storePassword: options.storePassword,
        keyAlias: options.alias,
        keyPassword: options.keyPassword
      }),
      options.overwrite
    );
  }

  console.log(`# FREED Android upload keystore`);
  console.log(`Keystore: ${options.storeFile}`);
  if (options.envOutput) console.log(`Env file: ${options.envOutput}`);
  console.log(`Alias: ${options.alias}`);
  console.log(`Next: npm run preflight:release-env -- --env-file ${shellQuote(options.envOutput || "<your-production-env-file>")}`);
  console.log(`Then: npm run build:android-aab:upload-signed -- --env-file ${shellQuote(options.envOutput || "<your-production-env-file>")} --report docs/validation/artifacts/<run-id>/android-aab-build-report.json`);
  if (options.printEnv) {
    console.log("");
    console.log(envSnippet({
      storeFile: options.storeFile,
      storePassword: options.storePassword,
      keyAlias: options.alias,
      keyPassword: options.keyPassword
    }));
  }
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
