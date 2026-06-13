#!/usr/bin/env node

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawn, spawnSync } = require("node:child_process");
const { loadEnvFile } = require("./lib/env-file-loader");
const { assertSafeReportPath } = require("./lib/report-path-safety");

const ROOT = path.resolve(__dirname, "..");
const ANDROID_DIR = path.join(ROOT, "android");
const DEFAULT_GRADLE_USER_HOME = path.join("/tmp", "freed-gradle-home");
const DEFAULT_GRADLE_MAX_WORKERS = 1;
const DEFAULT_NEW_ARCH_ENABLED = true;
const DEFAULT_NATIVE_BUILD_JOBS = 1;
const PREFERRED_CMAKE_VERSION = "3.31.0";
const PREFERRED_NDK_VERSION = "28.2.13676358";
const DEFAULT_BUILD_TIMEOUT_MS = 45 * 60 * 1000;
const DEFAULT_BUILD_IDLE_TIMEOUT_MS = 10 * 60 * 1000;
const DEFAULT_JAVA_HOMES = [
  "/Library/Java/JavaVirtualMachines/jdk-23.jdk/Contents/Home",
  "/Library/Java/JavaVirtualMachines/temurin-21.jdk/Contents/Home",
  "/Library/Java/JavaVirtualMachines/temurin-17.jdk/Contents/Home",
];
const DEFAULT_RELEASE_APK = path.join(ANDROID_DIR, "app", "build", "outputs", "apk", "release", "app-release.apk");
const DEFAULT_RELEASE_AAB = path.join(ANDROID_DIR, "app", "build", "outputs", "bundle", "release", "app-release.aab");
const DEFAULT_MERGED_RELEASE_MANIFEST = path.join(
  ANDROID_DIR,
  "app",
  "build",
  "intermediates",
  "merged_manifest",
  "release",
  "processReleaseMainManifest",
  "AndroidManifest.xml",
);
const HERMESC = path.join(ROOT, "node_modules", "hermes-compiler", "hermesc", "osx-bin", "hermesc");
const GOOGLE_SAMPLE_ADMOB_PUBLISHER = "ca-app-pub-3940256099942544";
const GOOGLE_SAMPLE_ADMOB_ANDROID_APP_ID = `${GOOGLE_SAMPLE_ADMOB_PUBLISHER}~3347511713`;
const ANDROID_DEBUG_CERT_SHA256 = "fac61745dc0903786fb9ede62a962b399f7348f0bb6f899b8332667591033b9c";
const ANDROID_PROTECTION_FLOW_ORDER = Object.freeze([
  "android-native-adult-domain-feed",
  "android-dns-guard",
  "android-usage-access",
  "android-accessibility",
  "android-doomscroll-apps",
  "activation-test",
]);
const ANDROID_PROTECTION_FLOW_DETAILS = Object.freeze([
  "android-native-adult-domain-feed: sync the reviewed adult-domain feed in FREED before OS permission prompts",
  "android-dns-guard: request Android VpnService consent for DNS-only adult-domain blocking",
  "android-usage-access: open Android Usage Access settings for aggregate selected-app timers",
  "android-accessibility: open the FREED Accessibility service details screen for browser and selected-app interruption",
  "android-doomscroll-apps: choose at least one supported app package and sync blocked-app config",
  "activation-test: verify adult-domain blocking, normal browsing allow behavior, and fresh native readiness before saving activation"
]);
const ANDROID_ACTIVATION_READINESS_RULE =
  "Activation is saved only after native status confirms DNS Guard, Usage Access, Accessibility, selected app packages, and the activation test confirms adult domains are blocked while normal browsing is allowed.";
const RN_GRADLE_PLUGIN_SETTINGS = path.join(
  ROOT,
  "node_modules",
  "@react-native",
  "gradle-plugin",
  "settings.gradle.kts",
);
const FOOJAY_OLD = 'id("org.gradle.toolchains.foojay-resolver-convention").version("0.5.0")';
const FOOJAY_NEW = 'id("org.gradle.toolchains.foojay-resolver-convention").version("1.0.0")';

function printHelp() {
  console.log(`Usage: npm run build:android-apk -- [options]

Builds the Android release APK or Play-ready AAB locally, pins Gradle to a
working JDK, probes Hermes before using it, and copies the resulting artifact
into Downloads by default.

Options:
  --artifact <apk|aab>       Release artifact type. Default: apk.
                             AAB builds are Play upload artifacts and require upload signing.
  --arch <abi-list>          Native ABI list. Default: arm64-v8a
                             Use "all" for armeabi-v7a,arm64-v8a,x86,x86_64.
  --engine <auto|hermes|jsc> JS engine for the release artifact. Default: auto.
                             Local auto builds may retry JSC; upload-signed builds do not.
  --java-home <path>         JDK home to use. Also honors JAVA_HOME.
  --gradle-user-home <path>  Isolated Gradle home. Default: ${DEFAULT_GRADLE_USER_HOME}
  --gradle-max-workers <n>   Gradle worker cap for local native release builds. Default: ${DEFAULT_GRADLE_MAX_WORKERS}
  --ndk-version <version>    Override Android NDK version for this release build.
                             Default: ${PREFERRED_NDK_VERSION} when installed, otherwise Gradle default.
  --cmake-version <version>  Override Android CMake version for this release build.
                             Default: ${PREFERRED_CMAKE_VERSION} when installed, otherwise Gradle default.
  --new-arch <true|false>    Enable React Native New Architecture. Default: ${DEFAULT_NEW_ARCH_ENABLED}
  --native-build-jobs <n>    CMake/Ninja native job cap. Default: ${DEFAULT_NATIVE_BUILD_JOBS}
  --build-timeout-ms <ms>    Wall-clock timeout for each Gradle attempt. Default: ${DEFAULT_BUILD_TIMEOUT_MS}
  --build-idle-timeout-ms <ms>
                             No-output timeout for each Gradle attempt. Default: ${DEFAULT_BUILD_IDLE_TIMEOUT_MS}
  --output-dir <path>        Copy destination. Default: ~/Downloads
  --stable-name <name>       Stable artifact filename. Default: FREED-release-<arch>.<ext>
  --timestamped-name <name>  Timestamped artifact filename.
  --env-file <path>          Load production build/signing env before parsing defaults.
                             Also honors FREED_RELEASE_ENV_FILE.
  --report <path>            Write a sanitized JSON build report.
  --skip-copy                Build only; do not copy artifact into output-dir.
  --dry-run                  Probe and print the Gradle command without building.
  --require-upload-signing   Fail unless Android upload signing env is present.
  --no-patch-foojay          Do not patch React Native's local Foojay resolver pin.
  --self-test                Run offline report/path checks.
  --help, -h                 Show this help.
`);
}

function expandHome(value) {
  if (!value || value === "~") return os.homedir();
  if (value.startsWith("~/")) return path.join(os.homedir(), value.slice(2));
  return value;
}

function resolvePath(value) {
  return path.resolve(expandHome(value));
}

function parseArgs(argv) {
  const options = {
    arch: process.env.FREED_ANDROID_RELEASE_ARCH || "arm64-v8a",
    artifact: (process.env.FREED_ANDROID_RELEASE_ARTIFACT || "apk").toLowerCase(),
    buildIdleTimeoutMs: Number(
      process.env.FREED_ANDROID_RELEASE_BUILD_IDLE_TIMEOUT_MS || DEFAULT_BUILD_IDLE_TIMEOUT_MS,
    ),
    buildTimeoutMs: Number(process.env.FREED_ANDROID_RELEASE_BUILD_TIMEOUT_MS || DEFAULT_BUILD_TIMEOUT_MS),
    cmakeVersion: process.env.FREED_ANDROID_RELEASE_CMAKE_VERSION || defaultInstalledSdkVersion("cmake", PREFERRED_CMAKE_VERSION),
    dryRun: false,
    engine: process.env.FREED_ANDROID_RELEASE_ENGINE || "auto",
    envFile: process.env.FREED_RELEASE_ENV_FILE || "",
    envFileLoaded: false,
    envFileSource: "",
    gradleMaxWorkers: Number(process.env.FREED_ANDROID_RELEASE_GRADLE_MAX_WORKERS || DEFAULT_GRADLE_MAX_WORKERS),
    gradleUserHome: process.env.FREED_ANDROID_RELEASE_GRADLE_USER_HOME || DEFAULT_GRADLE_USER_HOME,
    javaHome: process.env.JAVA_HOME || "",
    newArchEnabled:
      process.env.FREED_ANDROID_RELEASE_NEW_ARCH === undefined
        ? DEFAULT_NEW_ARCH_ENABLED
        : booleanOption(process.env.FREED_ANDROID_RELEASE_NEW_ARCH, "FREED_ANDROID_RELEASE_NEW_ARCH"),
    nativeBuildJobs: Number(process.env.FREED_ANDROID_RELEASE_NATIVE_BUILD_JOBS || DEFAULT_NATIVE_BUILD_JOBS),
    ndkVersion: process.env.FREED_ANDROID_RELEASE_NDK_VERSION || defaultInstalledSdkVersion("ndk", PREFERRED_NDK_VERSION),
    outputDir: process.env.FREED_ANDROID_RELEASE_OUTPUT_DIR || path.join(os.homedir(), "Downloads"),
    patchFoojay: true,
    requireUploadSigning:
      truthy(process.env.FREED_ANDROID_REQUIRE_UPLOAD_SIGNING) ||
      truthy(process.env.FREED_REQUIRE_ANDROID_RELEASE_SIGNING),
    reportPath: process.env.FREED_ANDROID_RELEASE_REPORT || "",
    selfTest: false,
    skipCopy: false,
    stableName: "",
    timestampedName: "",
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = () => {
      index += 1;
      if (index >= argv.length) throw new Error(`Missing value for ${arg}`);
      return argv[index];
    };

    if (arg === "--arch") {
      options.arch = next();
    } else if (arg === "--artifact") {
      options.artifact = next().toLowerCase();
    } else if (arg.startsWith("--artifact=")) {
      options.artifact = arg.slice("--artifact=".length).toLowerCase();
      if (!options.artifact) throw new Error("Missing value for --artifact");
    } else if (arg === "--build-idle-timeout-ms") {
      options.buildIdleTimeoutMs = Number(next());
    } else if (arg === "--build-timeout-ms") {
      options.buildTimeoutMs = Number(next());
    } else if (arg === "--cmake-version") {
      options.cmakeVersion = next();
    } else if (arg === "--dry-run") {
      options.dryRun = true;
    } else if (arg === "--engine") {
      options.engine = next();
    } else if (arg === "--env-file") {
      options.envFile = next();
    } else if (arg.startsWith("--env-file=")) {
      options.envFile = arg.slice("--env-file=".length);
      if (!options.envFile) throw new Error("Missing value for --env-file");
    } else if (arg === "--gradle-user-home") {
      options.gradleUserHome = next();
    } else if (arg === "--gradle-max-workers") {
      options.gradleMaxWorkers = Number(next());
    } else if (arg === "--java-home") {
      options.javaHome = next();
    } else if (arg === "--new-arch") {
      options.newArchEnabled = booleanOption(next(), "--new-arch");
    } else if (arg === "--native-build-jobs") {
      options.nativeBuildJobs = Number(next());
    } else if (arg === "--ndk-version") {
      options.ndkVersion = next();
    } else if (arg === "--no-patch-foojay") {
      options.patchFoojay = false;
    } else if (arg === "--output-dir") {
      options.outputDir = next();
    } else if (arg === "--require-upload-signing") {
      options.requireUploadSigning = true;
    } else if (arg === "--report") {
      options.reportPath = next();
    } else if (arg.startsWith("--report=")) {
      options.reportPath = arg.slice("--report=".length);
      if (!options.reportPath) throw new Error("Missing value for --report");
    } else if (arg === "--skip-copy") {
      options.skipCopy = true;
    } else if (arg === "--self-test") {
      options.selfTest = true;
    } else if (arg === "--stable-name") {
      options.stableName = next();
    } else if (arg === "--timestamped-name") {
      options.timestampedName = next();
    } else if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    } else {
      throw new Error(`Unknown option: ${arg}`);
    }
  }

  options.arch = normalizeArch(options.arch);
  options.engine = options.engine.toLowerCase();
  if (options.envFile) options.envFileSource = sanitizeEnvFileLabel(options.envFile);
  options.gradleUserHome = resolvePath(options.gradleUserHome);
  options.outputDir = resolvePath(options.outputDir);
  if (options.reportPath) options.reportPath = assertSafeReportPath(options.reportPath);
  if (options.javaHome) options.javaHome = resolvePath(options.javaHome);

  if (!["apk", "aab"].includes(options.artifact)) {
    throw new Error("--artifact must be apk or aab");
  }
  if (options.artifact === "aab") {
    options.requireUploadSigning = true;
  }
  if (!["auto", "hermes", "jsc"].includes(options.engine)) {
    throw new Error("--engine must be auto, hermes, or jsc");
  }
  if (!/^[A-Za-z0-9_.,-]+$/.test(options.arch)) {
    throw new Error("--arch may contain only letters, numbers, commas, dots, underscores, or dashes");
  }
  if (!Number.isInteger(options.buildTimeoutMs) || options.buildTimeoutMs < 60000) {
    throw new Error("--build-timeout-ms must be an integer of at least 60000");
  }
  if (!Number.isInteger(options.buildIdleTimeoutMs) || options.buildIdleTimeoutMs < 60000) {
    throw new Error("--build-idle-timeout-ms must be an integer of at least 60000");
  }
  if (!Number.isInteger(options.gradleMaxWorkers) || options.gradleMaxWorkers < 1 || options.gradleMaxWorkers > 16) {
    throw new Error("--gradle-max-workers must be an integer from 1 to 16");
  }
  if (!Number.isInteger(options.nativeBuildJobs) || options.nativeBuildJobs < 1 || options.nativeBuildJobs > 16) {
    throw new Error("--native-build-jobs must be an integer from 1 to 16");
  }
  if (options.cmakeVersion && !/^\d+(?:\.\d+){1,3}$/.test(options.cmakeVersion)) {
    throw new Error("--cmake-version must look like 3.31.0");
  }
  if (options.ndkVersion && !/^\d+(?:\.\d+){1,3}$/.test(options.ndkVersion)) {
    throw new Error("--ndk-version must look like 28.2.13676358");
  }
  const archLabel = safeArchLabel(options.arch);
  const extension = artifactExtension(options.artifact);
  if (!options.stableName) {
    options.stableName =
      options.artifact === "aab" ? `FREED-release-play-${archLabel}.aab` : `FREED-release-${archLabel}.apk`;
  }
  if (!options.timestampedName) {
    options.timestampedName =
      options.artifact === "aab"
        ? `FREED-release-play-${archLabel}-${timestampForFile(new Date())}.aab`
        : `FREED-release-${archLabel}-${timestampForFile(new Date())}.apk`;
  }
  validateArtifactName(options.stableName, "--stable-name", extension);
  validateArtifactName(options.timestampedName, "--timestamped-name", extension);

  return options;
}

function envFileFromArgs(argv) {
  let envFile = process.env.FREED_RELEASE_ENV_FILE || "";
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--env-file") {
      index += 1;
      if (index >= argv.length) throw new Error("Missing value for --env-file");
      envFile = argv[index];
    } else if (arg.startsWith("--env-file=")) {
      envFile = arg.slice("--env-file=".length);
      if (!envFile) throw new Error("Missing value for --env-file");
    }
  }
  return envFile;
}

function sanitizeEnvFileLabel(envFile) {
  if (!envFile) return "";
  return reportPath(resolvePath(envFile));
}

function preloadEnvFileForDefaults(argv) {
  const envFile = envFileFromArgs(argv);
  if (!envFile) {
    return { envFile: "", loaded: false, sourceLabel: "process.env" };
  }
  const loadedEnv = loadEnvFile(envFile, "--env-file");
  Object.assign(process.env, loadedEnv, { FREED_RELEASE_ENV_FILE: envFile });
  return {
    envFile,
    loaded: true,
    sourceLabel: `${sanitizeEnvFileLabel(envFile)} merged with process.env`,
  };
}

function truthy(value) {
  return /^(1|true|yes|on)$/i.test(String(value ?? "").trim());
}

function booleanOption(value, optionName) {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "off"].includes(normalized)) return false;
  throw new Error(`${optionName} must be true or false`);
}

function isProductionAdMobAppId(value) {
  return (
    typeof value === "string" &&
    /^ca-app-pub-\d{16}~\d{10}$/.test(value) &&
    !value.includes(GOOGLE_SAMPLE_ADMOB_PUBLISHER)
  );
}

function isRuntimeAdMobAppId(value) {
  return typeof value === "string" && /^ca-app-pub-\d{16}~\d{10}$/.test(value);
}

function normalizeArch(value) {
  if (!value) throw new Error("--arch must not be empty");
  if (value === "all") return "armeabi-v7a,arm64-v8a,x86,x86_64";
  return value;
}

function safeArchLabel(value) {
  if (value === "armeabi-v7a,arm64-v8a,x86,x86_64") return "universal";
  if (value === "arm64-v8a") return "arm64";
  return value.replace(/[^A-Za-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "custom";
}

function timestampForFile(date) {
  const pad = (value) => String(value).padStart(2, "0");
  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
    "-",
    pad(date.getHours()),
    pad(date.getMinutes()),
    pad(date.getSeconds()),
  ].join("");
}

function validateApkName(name, optionName) {
  validateArtifactName(name, optionName, "apk");
}

function artifactExtension(artifact) {
  return artifact === "aab" ? "aab" : "apk";
}

function artifactLabel(artifact) {
  return artifact === "aab" ? "Android App Bundle" : "Release APK";
}

function artifactShortLabel(artifact) {
  return artifact === "aab" ? "AAB" : "APK";
}

function releaseArtifactPath(artifact) {
  return artifact === "aab" ? DEFAULT_RELEASE_AAB : DEFAULT_RELEASE_APK;
}

function validateArtifactName(name, optionName, extension) {
  if (!name.endsWith(`.${extension}`)) throw new Error(`${optionName} must end with .${extension}`);
  if (path.basename(name) !== name) throw new Error(`${optionName} must be a filename, not a path`);
}

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      env: { ...process.env, ...options.env },
      stdio: options.stdio || "pipe",
    });
    let stdout = "";
    let stderr = "";
    let timedOut = false;
    let timeoutReason = "";
    let timeout = null;
    let idleTimeout = null;

    const clearTimers = () => {
      if (timeout) clearTimeout(timeout);
      if (idleTimeout) clearTimeout(idleTimeout);
    };
    const killForTimeout = (reason) => {
      if (timedOut) return;
      timedOut = true;
      timeoutReason = reason;
      child.kill("SIGKILL");
    };
    const resetIdleTimeout = () => {
      if (!options.idleTimeoutMs) return;
      if (idleTimeout) clearTimeout(idleTimeout);
      idleTimeout = setTimeout(() => {
        killForTimeout(`timed out after ${options.idleTimeoutMs}ms without Gradle output`);
      }, options.idleTimeoutMs);
    };

    if (options.timeoutMs) {
      timeout = setTimeout(() => {
        killForTimeout(`timed out after ${options.timeoutMs}ms`);
      }, options.timeoutMs);
    }
    resetIdleTimeout();

    if (child.stdout) {
      child.stdout.on("data", (chunk) => {
        resetIdleTimeout();
        stdout += chunk.toString();
        if (options.echo) process.stdout.write(chunk);
      });
    }
    if (child.stderr) {
      child.stderr.on("data", (chunk) => {
        resetIdleTimeout();
        stderr += chunk.toString();
        if (options.echo) process.stderr.write(chunk);
      });
    }

    child.on("error", (error) => {
      clearTimers();
      reject(error);
    });
    child.on("exit", (code, signal) => {
      clearTimers();
      if (timedOut) {
        reject(new Error(`${command} ${args.join(" ")} ${timeoutReason}`));
        return;
      }
      if (code === 0) {
        resolve({ stdout, stderr });
        return;
      }
      const suffix = signal ? `signal ${signal}` : `exit code ${code}`;
      reject(new Error(`${command} ${args.join(" ")} failed with ${suffix}\n${stderr || stdout}`));
    });
  });
}

async function javaHomeWorks(javaHome) {
  const java = path.join(javaHome, "bin", "java");
  if (!fs.existsSync(java)) return false;
  try {
    await run(java, ["-version"], { timeoutMs: 5000 });
    return true;
  } catch {
    return false;
  }
}

async function resolveJavaHome(requested) {
  const candidates = [
    requested,
    process.env.JAVA_HOME,
    ...DEFAULT_JAVA_HOMES,
    await macJavaHome(),
  ]
    .filter(Boolean)
    .map(resolvePath);
  const uniqueCandidates = [...new Set(candidates)];

  for (const candidate of uniqueCandidates) {
    if (await javaHomeWorks(candidate)) return candidate;
  }

  throw new Error(
    `No working JDK found. Pass --java-home <path>; each candidate must complete "bin/java -version" within 5s.`,
  );
}

async function macJavaHome() {
  if (process.platform !== "darwin") return "";
  try {
    const result = await run("/usr/libexec/java_home", ["-v", "17+"], { timeoutMs: 5000 });
    return result.stdout.trim();
  } catch {
    return "";
  }
}

function prepareGradleUserHome(gradleUserHome, javaHome, gradleMaxWorkers, nativeBuildJobs) {
  fs.mkdirSync(gradleUserHome, { recursive: true });
  const propertiesPath = path.join(gradleUserHome, "gradle.properties");
  const properties = [
    "# Generated by scripts/build-android-release-apk.js.",
    "# Keeps local Android release builds away from stale JDK probes and local native-build OOMs.",
    "org.gradle.java.installations.auto-detect=false",
    `org.gradle.java.installations.paths=${javaHome.replace(/\\/g, "\\\\")}`,
    `org.gradle.workers.max=${gradleMaxWorkers}`,
    "org.gradle.parallel=false",
    "org.gradle.jvmargs=-Xmx2048m -XX:MaxMetaspaceSize=768m",
    `android.native.build.maxJobs=${nativeBuildJobs}`,
    "",
  ].join("\n");
  fs.writeFileSync(propertiesPath, properties);
  return propertiesPath;
}

function patchFoojayResolverIfNeeded(enabled) {
  if (!enabled) return "skipped";
  if (!fs.existsSync(RN_GRADLE_PLUGIN_SETTINGS)) return "missing";
  const before = fs.readFileSync(RN_GRADLE_PLUGIN_SETTINGS, "utf8");
  if (before.includes(FOOJAY_NEW)) return "already-compatible";
  if (!before.includes(FOOJAY_OLD)) return "unchanged";
  fs.writeFileSync(RN_GRADLE_PLUGIN_SETTINGS, before.replace(FOOJAY_OLD, FOOJAY_NEW));
  return "patched-node-modules";
}

async function hermesWorks() {
  if (!fs.existsSync(HERMESC)) {
    return { ok: false, reason: `Hermes compiler missing at ${relative(HERMESC)}` };
  }
  try {
    await run(HERMESC, ["-help"], { timeoutMs: 5000 });
    return { ok: true, reason: "hermesc responded within 5s" };
  } catch (error) {
    return { ok: false, reason: error.message.replace(/\s+/g, " ").trim() };
  }
}

async function resolveEngine(requestedEngine) {
  if (requestedEngine === "jsc") {
    return { engine: "jsc", hermesProbe: { ok: false, reason: "skipped because --engine jsc was requested" } };
  }

  const hermesProbe = await hermesWorks();
  if (hermesProbe.ok) return { engine: "hermes", hermesProbe };
  if (requestedEngine === "hermes") {
    throw new Error(`Hermes was requested but is not usable: ${hermesProbe.reason}`);
  }
  return { engine: "jsc", hermesProbe };
}

function canRetryWithJsc(options, finalEngine) {
  return options.engine === "auto" && finalEngine === "hermes" && !options.requireUploadSigning;
}

function assertUploadSignedEnginePolicy(options, engine, hermesProbe) {
  if (!options.requireUploadSigning || engine === "hermes") return;

  const probeReason = hermesProbe?.reason ? ` Hermes probe: ${hermesProbe.reason}` : "";
  throw new Error(
    `Android upload signing requires Hermes; --require-upload-signing forbids JavaScriptCore release artifacts.${probeReason}`,
  );
}

function buildGradleArgs(
  arch,
  engine,
  artifact = "apk",
  gradleMaxWorkers = DEFAULT_GRADLE_MAX_WORKERS,
  nativeBuildJobs = DEFAULT_NATIVE_BUILD_JOBS,
  newArchEnabled = DEFAULT_NEW_ARCH_ENABLED,
  ndkVersion = "",
  cmakeVersion = "",
) {
  const args = [
    artifact === "aab" ? ":app:bundleRelease" : ":app:assembleRelease",
    "--no-daemon",
    "--console=plain",
    `--max-workers=${gradleMaxWorkers}`,
    "-Dorg.gradle.parallel=false",
    `-Pandroid.native.build.maxJobs=${nativeBuildJobs}`,
    `-PnewArchEnabled=${newArchEnabled ? "true" : "false"}`,
    `-PreactNativeArchitectures=${arch}`,
    `-PhermesEnabled=${engine === "hermes" ? "true" : "false"}`,
  ];
  if (ndkVersion) args.push(`-Pfreed.androidNdkVersion=${ndkVersion}`);
  if (cmakeVersion) args.push(`-Pfreed.androidCmakeVersion=${cmakeVersion}`);
  return args;
}

async function runGradleBuild(gradleArgs, env, buildTimeoutMs, buildIdleTimeoutMs) {
  await run("./gradlew", gradleArgs, {
    cwd: ANDROID_DIR,
    echo: true,
    env,
    idleTimeoutMs: buildIdleTimeoutMs,
    stdio: "pipe",
    timeoutMs: buildTimeoutMs,
  });
}

function buildEnvironment(javaHome, gradleUserHome, nativeBuildJobs = DEFAULT_NATIVE_BUILD_JOBS) {
  const pathEntries = [
    path.dirname(process.execPath),
    "/opt/homebrew/bin",
    "/usr/local/bin",
    process.env.PATH || "",
  ]
    .join(path.delimiter)
    .split(path.delimiter)
    .filter(Boolean);
  const uniquePath = [...new Set(pathEntries)].join(path.delimiter);

  return {
    CI: "1",
    EXPO_NO_TELEMETRY: "1",
    CMAKE_BUILD_PARALLEL_LEVEL: String(nativeBuildJobs),
    GRADLE_USER_HOME: gradleUserHome,
    JAVA_HOME: javaHome,
    NODE_ENV: "production",
    NODE_BINARY: process.execPath,
    PATH: uniquePath,
  };
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
      /CN=Android Debug\b/i.test(certificateDn),
  };
}

function inspectUploadKeystore(storeFilePath, storePassword, keyAlias) {
  const result = spawnSync(
    "keytool",
    ["-list", "-v", "-keystore", storeFilePath, "-storepass", storePassword, "-alias", keyAlias],
    {
      encoding: "utf8",
      maxBuffer: 1024 * 1024,
      timeout: 30000,
    },
  );
  if (result.error || result.status !== 0) {
    throw new Error(
      "Android upload signing keystore could not be inspected with keytool; verify the store password, key alias, and keystore format.",
    );
  }
  const proof = parseKeytoolCertificateOutput(`${result.stdout || ""}\n${result.stderr || ""}`);
  if (!proof.certificateSha256Digest) {
    throw new Error("Android upload signing keystore inspection did not return a certificate SHA-256 digest.");
  }
  return proof;
}

function resolveSigningStatus(requireUploadSigning, env = process.env, keystoreInspector = inspectUploadKeystore) {
  const requiredKeys = [
    "FREED_ANDROID_UPLOAD_STORE_FILE",
    "FREED_ANDROID_UPLOAD_STORE_PASSWORD",
    "FREED_ANDROID_UPLOAD_KEY_ALIAS",
    "FREED_ANDROID_UPLOAD_KEY_PASSWORD",
  ];
  const missing = requiredKeys.filter((key) => !env[key]?.trim());
  const storeFile = env.FREED_ANDROID_UPLOAD_STORE_FILE?.trim() || "";
  const storePassword = env.FREED_ANDROID_UPLOAD_STORE_PASSWORD?.trim() || "";
  const keyAlias = env.FREED_ANDROID_UPLOAD_KEY_ALIAS?.trim() || "";
  const storeFilePath = storeFile ? resolvePath(storeFile) : "";
  const storeFileExists = Boolean(storeFilePath && fs.existsSync(storeFilePath));
  let uploadKeystore = {
    certificateDn: "",
    certificateSha256Digest: "",
    checked: false,
    debugSigned: false,
  };

  if (storeFilePath && !storeFileExists) {
    missing.push("FREED_ANDROID_UPLOAD_STORE_FILE existing file");
  }
  if (requireUploadSigning && missing.length > 0) {
    throw new Error(
      `Android upload signing is required, but missing: ${missing.join(", ")}. ` +
        "Set FREED_ANDROID_UPLOAD_STORE_FILE, FREED_ANDROID_UPLOAD_STORE_PASSWORD, FREED_ANDROID_UPLOAD_KEY_ALIAS, and FREED_ANDROID_UPLOAD_KEY_PASSWORD.",
    );
  }
  if (missing.length === 0) {
    uploadKeystore = {
      ...keystoreInspector(storeFilePath, storePassword, keyAlias),
      checked: true,
    };
    if (uploadKeystore.debugSigned) {
      throw new Error(
        "Android upload signing requires a non-debug upload keystore; FREED_ANDROID_UPLOAD_STORE_FILE resolves to the Android Debug certificate.",
      );
    }
  }

  return {
    missing,
    mode: missing.length === 0 ? "upload-signing" : "debug-key-fallback",
    required: requireUploadSigning,
    storeFileConfigured: Boolean(storeFile),
    storeFileExists,
    uploadKeystore,
  };
}

function resolveAdMobStatus(requireProduction, env = process.env) {
  const platformValue = env.EXPO_PUBLIC_ADMOB_APP_ID_ANDROID?.trim() || "";
  const sharedValue = env.EXPO_PUBLIC_ADMOB_APP_ID?.trim() || "";
  const androidAppId = platformValue || sharedValue;
  const androidAppIdSource = platformValue ? "EXPO_PUBLIC_ADMOB_APP_ID_ANDROID" : sharedValue ? "EXPO_PUBLIC_ADMOB_APP_ID" : "";
  const androidAppIdConfigured = Boolean(androidAppId);
  const sampleAppIdUsed = !androidAppIdConfigured || androidAppId.includes(GOOGLE_SAMPLE_ADMOB_PUBLISHER);
  const productionReady = isProductionAdMobAppId(androidAppId);
  const runtimeManifestAppId = androidAppId || GOOGLE_SAMPLE_ADMOB_ANDROID_APP_ID;

  if (requireProduction && !productionReady) {
    throw new Error(
      "Android upload signing requires a production Android AdMob app ID. " +
        "Set EXPO_PUBLIC_ADMOB_APP_ID_ANDROID or EXPO_PUBLIC_ADMOB_APP_ID to a non-sample ca-app-pub-0000000000000000~0000000000 value.",
    );
  }

  return {
    androidAppIdConfigured,
    androidAppIdSource,
    mode: productionReady ? "production" : "local-test-app-id",
    productionReady,
    runtimeManifestAppIdConfigured: isRuntimeAdMobAppId(runtimeManifestAppId),
    runtimeManifestAppIdMode: isProductionAdMobAppId(runtimeManifestAppId) ? "production" : "local-test-app-id",
    runtimeManifestAppIdSource: androidAppIdSource || "local-google-sample-test-id",
    sampleAppIdUsed,
  };
}

function numericVersionParts(value) {
  return String(value)
    .split(".")
    .map((part) => Number(part))
    .map((part) => (Number.isFinite(part) ? part : 0));
}

function compareAndroidBuildToolsVersions(left, right) {
  const leftParts = numericVersionParts(left);
  const rightParts = numericVersionParts(right);
  const length = Math.max(leftParts.length, rightParts.length);
  for (let index = 0; index < length; index += 1) {
    const diff = (leftParts[index] || 0) - (rightParts[index] || 0);
    if (diff !== 0) return diff;
  }
  return String(left).localeCompare(String(right));
}

function androidSdkCandidates() {
  return [
    process.env.ANDROID_HOME,
    process.env.ANDROID_SDK_ROOT,
    path.join(os.homedir(), "Library", "Android", "sdk"),
    path.join(os.homedir(), "Android", "Sdk"),
  ]
    .filter(Boolean)
    .map(resolvePath);
}

function defaultInstalledSdkVersion(componentDir, preferredVersion) {
  return androidSdkCandidates().some((sdkPath) => fs.existsSync(path.join(sdkPath, componentDir, preferredVersion)))
    ? preferredVersion
    : "";
}

function resolveApkSigner() {
  const directCandidates = androidSdkCandidates().flatMap((sdkPath) => {
    const buildToolsDir = path.join(sdkPath, "build-tools");
    if (!fs.existsSync(buildToolsDir)) return [];
    return fs
      .readdirSync(buildToolsDir)
      .filter((entry) => fs.existsSync(path.join(buildToolsDir, entry, "apksigner")))
      .sort(compareAndroidBuildToolsVersions)
      .reverse()
      .map((entry) => path.join(buildToolsDir, entry, "apksigner"));
  });
  const fallbackCandidates = ["/opt/homebrew/bin/apksigner", "/usr/local/bin/apksigner"];
  const candidate = [...directCandidates, ...fallbackCandidates].find((entry) => fs.existsSync(entry));
  if (!candidate) {
    throw new Error(
      "Could not locate Android SDK apksigner. Install Android build-tools or set ANDROID_HOME/ANDROID_SDK_ROOT before building APK reports.",
    );
  }
  return candidate;
}

function boolFromApkSignerLine(stdout, label) {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = stdout.match(new RegExp(`${escaped}:\\s+(true|false)`, "i"));
  return match ? match[1].toLowerCase() === "true" : false;
}

function firstApkSignerValue(stdout, label) {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = stdout.match(new RegExp(`${escaped}:\\s*(.+)`, "i"));
  return match ? match[1].trim() : "";
}

function parseApkSignatureOutput(stdout, toolPath) {
  const certificateSha256Digest = firstApkSignerValue(stdout, "Signer #1 certificate SHA-256 digest").toLowerCase();
  const certificateDn = firstApkSignerValue(stdout, "Signer #1 certificate DN");
  const numberOfSigners = Number(firstApkSignerValue(stdout, "Number of signers"));
  const keySizeBits = Number(firstApkSignerValue(stdout, "Signer #1 key size (bits)"));
  const verified = /^Verifies$/m.test(stdout);
  const debugSigned =
    certificateSha256Digest === ANDROID_DEBUG_CERT_SHA256 ||
    /CN=Android Debug\b/i.test(certificateDn);

  return {
    certificateDn,
    certificateSha256Digest,
    debugSigned,
    keyAlgorithm: firstApkSignerValue(stdout, "Signer #1 key algorithm"),
    keySizeBits: Number.isFinite(keySizeBits) ? keySizeBits : 0,
    numberOfSigners: Number.isFinite(numberOfSigners) ? numberOfSigners : 0,
    sourceStampVerified: boolFromApkSignerLine(stdout, "Verified for SourceStamp"),
    tool: reportPath(toolPath),
    v1SchemeVerified: boolFromApkSignerLine(stdout, "Verified using v1 scheme (JAR signing)"),
    v2SchemeVerified: boolFromApkSignerLine(stdout, "Verified using v2 scheme (APK Signature Scheme v2)"),
    v3SchemeVerified: boolFromApkSignerLine(stdout, "Verified using v3 scheme (APK Signature Scheme v3)"),
    v31SchemeVerified: boolFromApkSignerLine(stdout, "Verified using v3.1 scheme (APK Signature Scheme v3.1)"),
    v4SchemeVerified: boolFromApkSignerLine(stdout, "Verified using v4 scheme (APK Signature Scheme v4)"),
    verified,
  };
}

async function inspectApkSignature(apkPath) {
  const apkSigner = resolveApkSigner();
  const { stdout } = await run(apkSigner, ["verify", "--verbose", "--print-certs", apkPath], { timeoutMs: 30000 });
  return parseApkSignatureOutput(stdout, apkSigner);
}

async function inspectApk(apkPath) {
  return inspectAndroidZipArtifact(apkPath);
}

async function inspectAndroidZipArtifact(artifactPath) {
  const { stdout } = await run("unzip", ["-l", artifactPath], { timeoutMs: 30000 });
  const entries = stdout.split(/\r?\n/);
  const abiSet = new Set();
  for (const line of entries) {
    const match = line.match(/\s(?:base\/)?lib\/([^/]+)\//);
    if (match) abiSet.add(match[1]);
  }
  return {
    abis: [...abiSet].sort(),
    hasHermesBytecode: entries.some((line) => /(?:^|\s)(?:base\/)?assets\/index\.android\.bundle\.hbc\b/.test(line)),
    hasHermesRuntime: entries.some((line) => /\s(?:base\/)?lib\/[^/]+\/libhermes[^/]*\.so\b/.test(line)),
    hasJsBundle: entries.some((line) => /(?:^|\s)(?:base\/)?assets\/index\.android\.bundle\b/.test(line)),
    hasJscRuntime: entries.some((line) => /\s(?:base\/)?lib\/[^/]+\/libjsc[^/]*\.so\b/.test(line)),
  };
}

function extractManifestMetaDataValue(xml, name) {
  const metaDataRows = xml.match(/<meta-data\b[^>]*>/g) || [];
  for (const row of metaDataRows) {
    if (!row.includes(`android:name="${name}"`)) continue;
    const match = row.match(/\bandroid:value="([^"]*)"/);
    return match ? match[1] : "";
  }
  return "";
}

function inspectMergedReleaseManifest(manifestPath = DEFAULT_MERGED_RELEASE_MANIFEST) {
  if (!fs.existsSync(manifestPath)) {
    return {
      exists: false,
      googleMobileAdsApplicationIdConfigured: false,
      googleMobileAdsApplicationIdMode: "missing",
      path: reportPath(manifestPath),
      sampleAppIdUsed: false,
    };
  }

  const xml = fs.readFileSync(manifestPath, "utf8");
  const googleMobileAdsApplicationId = extractManifestMetaDataValue(
    xml,
    "com.google.android.gms.ads.APPLICATION_ID",
  );
  const configured = isRuntimeAdMobAppId(googleMobileAdsApplicationId);
  const sampleAppIdUsed = googleMobileAdsApplicationId.includes(GOOGLE_SAMPLE_ADMOB_PUBLISHER);
  const mode = configured
    ? sampleAppIdUsed
      ? "local-test-app-id"
      : "production"
    : "invalid-or-missing";

  return {
    exists: true,
    googleMobileAdsApplicationIdConfigured: configured,
    googleMobileAdsApplicationIdMode: mode,
    path: reportPath(manifestPath),
    sampleAppIdUsed,
  };
}

function sha256(filePath) {
  const hash = crypto.createHash("sha256");
  hash.update(fs.readFileSync(filePath));
  return hash.digest("hex");
}

function fileSizeMb(filePath) {
  return `${Math.round((fs.statSync(filePath).size / 1024 / 1024) * 10) / 10} MB`;
}

function fileSizeBytes(filePath) {
  return fs.statSync(filePath).size;
}

function copyOutputs(artifactPath, outputDir, stableName, timestampedName) {
  fs.mkdirSync(outputDir, { recursive: true });
  const stablePath = path.join(outputDir, stableName);
  const timestampedPath = path.join(outputDir, timestampedName);
  fs.copyFileSync(artifactPath, stablePath);
  fs.copyFileSync(artifactPath, timestampedPath);
  return { stablePath, timestampedPath };
}

function relative(filePath) {
  return path.relative(ROOT, filePath) || ".";
}

function reportPath(filePath) {
  if (!filePath) return "";
  const resolved = path.resolve(filePath);
  const workspaceRelative = path.relative(ROOT, resolved).replace(/\\/g, "/");
  if (!workspaceRelative.startsWith("..") && !path.isAbsolute(workspaceRelative)) {
    return workspaceRelative || ".";
  }
  const homeRelative = path.relative(os.homedir(), resolved).replace(/\\/g, "/");
  if (!homeRelative.startsWith("..") && !path.isAbsolute(homeRelative)) {
    return homeRelative ? `~/${homeRelative}` : "~";
  }
  return resolved;
}

function buildInstallHandoff(options, sourceArtifactPath, copied, generatedAt = new Date()) {
  const installArtifactPath = copied?.stablePath || sourceArtifactPath;
  const installQaRunId = `android-install-${timestampForFile(generatedAt)}`;
  const installQaOutputDir = `docs/validation/artifacts/${installQaRunId}/android-install-qa`;
  const protectionQaOutputDir = `docs/validation/artifacts/${installQaRunId}/android-real-browser-capture`;
  const base = {
    copiedStableArtifact: reportPath(copied?.stablePath),
    copiedTimestampedArtifact: reportPath(copied?.timestampedPath),
    activationReadinessRule: ANDROID_ACTIVATION_READINESS_RULE,
    deviceSelection: "Attach exactly one physical adb device, or add --device SERIAL to the command.",
    installQaOutputDir,
    localInstallSupported: options.artifact === "apk",
    playUploadArtifact: options.artifact === "aab",
    protectionFlowDetails: [...ANDROID_PROTECTION_FLOW_DETAILS],
    protectionFlowOrder: [...ANDROID_PROTECTION_FLOW_ORDER],
    protectionFlowOrderString: ANDROID_PROTECTION_FLOW_ORDER.join(">"),
  };
  if (options.artifact !== "apk") {
    return {
      ...base,
      installQaCommand: [],
      installQaCommandString: "",
      protectionQaCommand: [],
      protectionQaCommandString: "",
      note: "AAB artifacts are Play upload artifacts. Build an APK when physical-device local install and Android protection QA are needed.",
    };
  }
  const command = [
    "npm",
    "run",
    "qa:android-install",
    "--",
    "--apk",
    reportPath(installArtifactPath),
    "--run-id",
    installQaRunId,
    "--output-dir",
    installQaOutputDir,
    ...(options.requireUploadSigning ? ["--require-upload-signing"] : []),
  ];
  const protectionCommand = [
    "npm",
    "run",
    "evidence:android-real-browser",
    "--",
    "--device",
    "<serial>",
    "--adult-url",
    "<real-adult-url>",
    "--permission-proof",
    "--native-status-proof",
    "--dns-guard-proof",
    "--run-id",
    installQaRunId,
    "--output-dir",
    protectionQaOutputDir,
  ];
  return {
    ...base,
    installQaApk: reportPath(installArtifactPath),
    installQaCommand: command,
    installQaCommandString: command.map((part) => (/\s/.test(part) ? JSON.stringify(part) : part)).join(" "),
    protectionQaOutputDir,
    protectionQaRunId: installQaRunId,
    protectionQaCommand: protectionCommand,
    protectionQaCommandString: protectionCommand.map((part) => (/\s/.test(part) ? JSON.stringify(part) : part)).join(" "),
    protectionQaRequiredProofs: ["permission-proof", "native-status-proof", "dns-guard-proof"],
    note: "Run install QA first, then run protection QA on the same physical Android device before treating the APK as activation-ready.",
  };
}

function buildAndroidArtifactHandoffMarkdown(options, installHandoff, artifactReport, context) {
  const shortLabel = artifactShortLabel(options.artifact);
  const title = options.artifact === "apk" ? "FREED Android APK Install Handoff" : "FREED Android AAB Upload Handoff";
  const localQaOnly =
    options.artifact === "apk" &&
    (context.signingStatus.mode !== "upload-signing" ||
      context.adMobStatus.mode !== "production" ||
      artifactReport.signature?.debugSigned === true);
  const artifactPurpose =
    options.artifact === "apk"
      ? localQaOnly
        ? "Local Android side-load QA only. This APK is not a Play Console upload artifact."
        : "Upload-signed Android side-load QA artifact. Use an AAB, not this APK, for Play Console upload."
      : "Play Console upload artifact. AAB files cannot be directly installed with adb.";
  const qaSection =
    options.artifact === "apk"
      ? [
          "## Install And Protection QA",
          "",
          "1. Attach one physical Android device with USB debugging enabled, or pass a concrete `--device <serial>`.",
          "2. Run install QA:",
          "",
          "```sh",
          installHandoff.installQaCommandString,
          "```",
          "",
          "3. In FREED, complete the permission checklist in this order:",
          "",
          "```text",
          installHandoff.protectionFlowOrderString,
          "```",
          "",
          "FREED does not try to silently grant restricted Android permissions. Follow the exact handoff details below; FREED syncs the feed in-app, opens the closest supported OS consent/settings surface when Android requires it, refreshes on return, and continues to the next missing step.",
          "",
          ...installHandoff.protectionFlowDetails.map((detail) => `- ${detail}`),
          "",
          "4. Run protection QA on the same device:",
          "",
          "```sh",
          installHandoff.protectionQaCommandString,
          "```",
          "",
          `5. Activation rule: ${installHandoff.activationReadinessRule}`,
          "6. Do not treat the APK as activation-ready until install QA and Android protection evidence both pass.",
        ]
      : [
          "## Upload And QA",
          "",
          "1. Upload this AAB only after upload signing, production AdMob, and release preflight have passed.",
          "2. Use the Play internal track first and keep the release in draft until physical-device and store/ad sandbox evidence pass.",
          "3. Build an APK separately for local side-load install and protection QA.",
        ];

  return [
    `# ${title}`,
    "",
    "Generated by `scripts/build-android-release-apk.js`.",
    "",
    "## Artifact",
    "",
    `- Type: ${shortLabel}`,
    `- Path: \`${artifactReport.path}\``,
    artifactReport.stablePath ? `- Stable copy: \`${artifactReport.stablePath}\`` : "- Stable copy: not copied",
    artifactReport.timestampedPath ? `- Timestamped copy: \`${artifactReport.timestampedPath}\`` : "- Timestamped copy: not copied",
    `- SHA-256: \`${artifactReport.sha256}\``,
    `- Size: ${artifactReport.sizeMb}`,
    `- ABIs: ${artifactReport.abis.length > 0 ? artifactReport.abis.join(", ") : "none detected"}`,
    `- React Native bundle: ${artifactReport.hasReactNativeBundle ? "present" : "missing"}`,
    `- Hermes runtime: ${artifactReport.hasHermesRuntime ? "present" : "missing"}`,
    `- JavaScriptCore runtime: ${artifactReport.hasJscRuntime ? "present" : "absent"}`,
    "",
    "## Release Boundary",
    "",
    artifactPurpose,
    `Signing mode: \`${context.signingStatus.mode}\`.`,
    `AdMob mode: \`${context.adMobStatus.mode}\`.`,
    artifactReport.signature
      ? `APK signature verified: ${artifactReport.signature.verified ? "yes" : "no"}; debug certificate: ${artifactReport.signature.debugSigned ? "yes" : "no"}.`
      : "AAB signing is verified from the configured upload keystore; Play signs the delivered APKs after upload.",
    "",
    ...qaSection,
    "",
  ].join("\n");
}

function writeAndroidArtifactHandoff(options, installHandoff, artifactReport, context, copied) {
  const outputDir = copied?.stablePath
    ? path.dirname(copied.stablePath)
    : options.reportPath
      ? path.dirname(options.reportPath)
      : "";
  if (!outputDir) return "";
  const fileName = options.artifact === "apk" ? "ANDROID_APK_INSTALL_HANDOFF.md" : "ANDROID_AAB_UPLOAD_HANDOFF.md";
  const handoffPath = path.join(outputDir, fileName);
  fs.mkdirSync(outputDir, { recursive: true });
  fs.writeFileSync(handoffPath, buildAndroidArtifactHandoffMarkdown(options, installHandoff, artifactReport, context));
  return handoffPath;
}

function buildReportBase(options, context) {
  return {
    schema:
      options.artifact === "aab" ? "freed-android-release-build-report-v1" : "freed-android-apk-build-report-v1",
    artifactType: options.artifact,
    generatedAt: new Date().toISOString(),
    sanitized: true,
    requested: {
      arch: options.arch,
      artifact: options.artifact,
      buildIdleTimeoutMs: options.buildIdleTimeoutMs,
      buildTimeoutMs: options.buildTimeoutMs,
      cmakeVersion: options.cmakeVersion,
      engine: options.engine,
      envFileLoaded: Boolean(options.envFileLoaded),
      gradleMaxWorkers: options.gradleMaxWorkers,
      newArchEnabled: options.newArchEnabled,
      nativeBuildJobs: options.nativeBuildJobs,
      ndkVersion: options.ndkVersion,
      requireUploadSigning: options.requireUploadSigning,
      skipCopy: options.skipCopy,
    },
    adMob: {
      androidAppIdConfigured: context.adMobStatus.androidAppIdConfigured,
      androidAppIdSource: context.adMobStatus.androidAppIdSource,
      mode: context.adMobStatus.mode,
      productionReady: context.adMobStatus.productionReady,
      runtimeManifestAppIdConfigured: context.adMobStatus.runtimeManifestAppIdConfigured,
      runtimeManifestAppIdMode: context.adMobStatus.runtimeManifestAppIdMode,
      runtimeManifestAppIdSource: context.adMobStatus.runtimeManifestAppIdSource,
      sampleAppIdUsed: context.adMobStatus.sampleAppIdUsed,
    },
    environment: {
      releaseEnvFileLoaded: Boolean(options.envFileLoaded),
      releaseEnvFileSource: options.envFileSource || "",
      releaseEnvSecretValuesOmitted: true,
      javaHome: context.javaHome,
      gradleUserHome: reportPath(options.gradleUserHome),
      gradleMaxWorkers: options.gradleMaxWorkers,
      newArchEnabled: options.newArchEnabled,
      nativeBuildJobs: options.nativeBuildJobs,
      ndkVersion: options.ndkVersion,
      cmakeVersion: options.cmakeVersion,
      gradleProperties: reportPath(context.gradlePropertiesPath),
      foojayResolver: context.foojayStatus,
    },
    hermesProbe: context.hermesProbe,
    selectedEngine: context.engine,
    signing: signingReport(context.signingStatus),
    gradleCommand: ["./gradlew", ...context.gradleArgs],
  };
}

function signingReport(signingStatus) {
  if (!signingStatus) return null;
  return {
    missingInputs: signingStatus.missing,
    mode: signingStatus.mode,
    playConsoleReady: signingStatus.mode === "upload-signing",
    required: signingStatus.required,
    storeFileConfigured: signingStatus.storeFileConfigured,
    storeFileExists: signingStatus.storeFileExists,
    uploadKeystore: {
      certificateDn: signingStatus.uploadKeystore.certificateDn,
      certificateSha256Digest: signingStatus.uploadKeystore.certificateSha256Digest,
      checked: signingStatus.uploadKeystore.checked,
      debugSigned: signingStatus.uploadKeystore.debugSigned,
    },
  };
}

function summarizeReportResults(results) {
  return {
    passCount: results.filter((entry) => entry.status === "PASS").length,
    failCount: results.filter((entry) => entry.status === "FAIL").length,
  };
}

function reportResult(results) {
  return summarizeReportResults(results).failCount === 0 ? "pass" : "fail";
}

function buildLocalQaStatus(options, inspection, signature, manifestInspection) {
  const supported = options.artifact === "apk";
  const missing = [];
  if (!supported) missing.push("local Android install QA requires an APK artifact");
  if (!inspection.hasJsBundle) missing.push("React Native release bundle is missing");
  if (inspection.abis.length === 0) missing.push("native ABI payload is missing");
  if (supported && !signature?.verified) missing.push("APK signature is not verified");
  if (!manifestInspection?.googleMobileAdsApplicationIdConfigured) {
    missing.push("Google Mobile Ads application id is missing from the merged manifest");
  }
  const localInstallArtifactProduced = supported && missing.length === 0;
  return {
    result: supported ? (localInstallArtifactProduced ? "pass" : "fail") : "not-applicable",
    localInstallSupported: supported,
    localInstallArtifactProduced,
    sideLoadReady: localInstallArtifactProduced,
    activationEvidenceRequired: supported,
    releaseBoundary:
      "Local side-load QA proves installability only; Play upload still requires non-debug upload signing, production AdMob, release preflight, and physical-device evidence.",
    missing,
  };
}

function signingMissingInputs(signingStatus) {
  if (Array.isArray(signingStatus.missing)) return signingStatus.missing;
  if (Array.isArray(signingStatus.missingInputs)) return signingStatus.missingInputs;
  return [];
}

const RELEASE_ARTIFACT_RESULT_ID_MARKERS = Object.freeze([
  "android-apk-build",
  "android-apk-upload-signing",
  "android-apk-admob-app-id",
  "android-apk-admob-runtime-manifest",
  "android-apk-signature",
  "android-apk-react-native-bundle",
  "android-apk-abi",
  "android-aab-build",
  "android-aab-upload-signing",
  "android-aab-admob-app-id",
  "android-aab-admob-runtime-manifest",
  "android-aab-react-native-bundle",
  "android-aab-abi",
]);

function artifactResultId(artifact, suffix) {
  return `android-${artifact}-${suffix}`;
}

function signingResult(signingStatus, artifact = "apk") {
  const missing = signingMissingInputs(signingStatus);
  const missingDetail = missing.length > 0 ? missing.join(", ") : "upload signing inputs";
  const label = artifactLabel(artifact);
  return {
    id: artifactResultId(artifact, "upload-signing"),
    status: signingStatus.mode === "upload-signing" ? "PASS" : "FAIL",
    detail:
      signingStatus.mode === "upload-signing"
        ? `${label} used configured Android upload signing for Play Console artifacts.`
        : `${label} used debug-key fallback; missing ${missingDetail}.`,
  };
}

function dryRunReportResults(signingStatus, adMobStatus, artifact = "apk") {
  return [
    {
      id: artifactResultId(artifact, "build"),
      status: "PASS",
      detail: "Dry run completed without invoking Gradle.",
    },
    signingResult(signingStatus, artifact),
    adMobResult(adMobStatus, artifact),
  ];
}

function adMobResult(adMobStatus, artifact = "apk") {
  return {
    id: artifactResultId(artifact, "admob-app-id"),
    status: adMobStatus.productionReady ? "PASS" : "FAIL",
    detail: adMobStatus.productionReady
      ? "Android AdMob application id is production-formatted and non-sample."
      : "Android AdMob application id uses the local Google sample fallback; this is allowed only for local QA artifacts.",
  };
}

function signatureResult(signature, artifact = "apk") {
  const verified = Boolean(signature?.verified && signature.numberOfSigners > 0);
  const uploadReady = verified && signature.debugSigned === false;
  return {
    id: artifactResultId(artifact, "signature"),
    status: uploadReady ? "PASS" : "FAIL",
    detail: uploadReady
      ? "APK signature verifies with a non-debug signing certificate."
      : verified
        ? "APK signature verifies with the Android Debug certificate; this is allowed only for local QA artifacts."
        : "APK signature could not be verified with apksigner.",
  };
}

function adMobManifestResult(manifestInspection, artifact = "apk") {
  const configured = Boolean(manifestInspection?.googleMobileAdsApplicationIdConfigured);
  const mode = manifestInspection?.googleMobileAdsApplicationIdMode;
  return {
    id: artifactResultId(artifact, "admob-runtime-manifest"),
    status: configured ? "PASS" : "FAIL",
    detail: configured
      ? mode === "production"
        ? "Merged Android manifest contains a production-formatted Google Mobile Ads application id."
        : "Merged Android manifest contains Google's local sample Mobile Ads application id, so local QA APKs can boot."
      : "Merged Android manifest is missing a valid Google Mobile Ads application id; the APK will crash before startup.",
  };
}

function apkReportResults(signingStatus, inspection, adMobStatus, signature, manifestInspection) {
  return artifactReportResults("apk", signingStatus, inspection, adMobStatus, signature, manifestInspection);
}

function artifactReportResults(artifact, signingStatus, inspection, adMobStatus, signature, manifestInspection) {
  const label = artifactLabel(artifact);
  const results = [
    {
      id: artifactResultId(artifact, "build"),
      status: "PASS",
      detail: `${label} built successfully.`,
    },
    signingResult(signingStatus, artifact),
    adMobResult(adMobStatus, artifact),
    adMobManifestResult(manifestInspection, artifact),
  ];
  if (artifact === "apk") {
    results.push(signatureResult(signature, artifact));
  }
  results.push(
    {
      id: artifactResultId(artifact, "react-native-bundle"),
      status: inspection.hasJsBundle ? "PASS" : "FAIL",
      detail: inspection.hasJsBundle
        ? `React Native release bundle is packaged in the ${artifactShortLabel(artifact)}.`
        : `React Native release bundle is missing from the ${artifactShortLabel(artifact)}.`,
    },
    {
      id: artifactResultId(artifact, "abi"),
      status: inspection.abis.length > 0 ? "PASS" : "FAIL",
      detail: inspection.abis.length > 0 ? `Packaged native ABIs: ${inspection.abis.join(", ")}.` : "No native ABIs detected.",
    },
  );
  return results;
}

function writeJsonReport(filePath, payload) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`);
}

function sanitizeBuildFailureMessage(error) {
  const raw = error instanceof Error ? error.message : String(error || "Android release build failed.");
  return raw
    .replace(new RegExp(os.homedir().replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g"), "~")
    .replace(/(PASSWORD|PRIVATE_KEY|ACCESS_TOKEN|SERVICE_ACCOUNT_JSON|API_KEY|SECRET)(=|:)\S+/gi, "$1$2[redacted]")
    .slice(0, 2000);
}

function buildFailureDiagnostics(error) {
  const raw = error instanceof Error ? error.message : String(error || "");
  const failedTask = raw.match(/Execution failed for task '([^']+)'/)?.[1] || "";
  const hostTotalMemoryMb = Math.round(os.totalmem() / 1024 / 1024);
  const cmakeExit137 = /exit value 137|exits? 137|exit code 137|signal SIGKILL/i.test(raw);
  return {
    cmakeConfigureFailed: /configureCMake/i.test(raw) || /CXX1429/i.test(raw),
    cmakeExit137,
    failedTask,
    hostMemoryConstrainedLikely: cmakeExit137 && hostTotalMemoryMb <= 8192,
    hostTotalMemoryMb,
    newArchDisabledUnsupported: /newArchEnabled=false[\s\S]{0,400}not\s+supported\s+anymore\s+since\s+React\s+Native\s+0\.82/i.test(raw),
    reactNativeNewArchForced: /New Architecture enabled by default/i.test(raw),
  };
}

function writeBlockedBuildReport(options, stage, error, context = {}) {
  if (!options.reportPath) return "";
  const failureMessage = sanitizeBuildFailureMessage(error);
  const diagnostics = buildFailureDiagnostics(error);
  const resultId = artifactResultId(options.artifact, "pre-gradle-prerequisites");
  const results = [
    {
      id: resultId,
      status: "FAIL",
      detail: failureMessage,
    },
  ];
  writeJsonReport(options.reportPath, {
    schema:
      options.artifact === "aab" ? "freed-android-release-build-report-v1" : "freed-android-apk-build-report-v1",
    artifactType: options.artifact,
    generatedAt: new Date().toISOString(),
    sanitized: true,
    requested: {
      arch: options.arch,
      artifact: options.artifact,
      buildIdleTimeoutMs: options.buildIdleTimeoutMs,
      buildTimeoutMs: options.buildTimeoutMs,
      engine: options.engine,
      envFileLoaded: Boolean(options.envFileLoaded),
      requireUploadSigning: options.requireUploadSigning,
      skipCopy: options.skipCopy,
    },
    buildResult: "blocked-before-gradle",
    result: "fail",
    blockedStage: stage,
    diagnostics,
    summary: summarizeReportResults(results),
    results,
    signing: signingReport(context.signingStatus),
    releaseBoundary: {
      gradleInvoked: false,
      releaseEnvFileLoaded: Boolean(options.envFileLoaded),
      releaseEnvFileSource: options.envFileSource || "",
      releaseEnvSecretValuesOmitted: true,
      uploadSignedBuildProduced: false,
      playUploadReady: false,
      localInstallArtifactProduced: false,
      reason: failureMessage,
    },
    apk: null,
    aab: null,
  });
  return options.reportPath;
}

function writeGradleFailureBuildReport(options, error, context) {
  if (!options.reportPath) return "";
  const failureMessage = sanitizeBuildFailureMessage(error);
  const diagnostics = buildFailureDiagnostics(error);
  const results = [
    {
      id: artifactResultId(options.artifact, "build"),
      status: "FAIL",
      detail: failureMessage,
    },
  ];
  writeJsonReport(options.reportPath, {
    ...buildReportBase(options, context),
    buildResult: "failed-during-gradle",
    result: "fail",
    failedStage: "gradle-build",
    diagnostics,
    summary: summarizeReportResults(results),
    results,
    releaseBoundary: {
      gradleInvoked: true,
      releaseEnvFileLoaded: Boolean(options.envFileLoaded),
      releaseEnvFileSource: options.envFileSource || "",
      releaseEnvSecretValuesOmitted: true,
      uploadSignedBuildProduced: false,
      playUploadReady: false,
      localInstallArtifactProduced: false,
      reason: failureMessage,
    },
    apk: null,
    aab: null,
  });
  return options.reportPath;
}

function runSelfTest() {
  const tempDir = fs.mkdtempSync(path.join(ROOT, "docs", "validation", "artifacts", "android-apk-build-self-test-"));
  const envTempDir = fs.mkdtempSync(path.join(os.tmpdir(), "freed-android-build-env-"));
  const reportFile = path.join(tempDir, "android-apk-build-report.json");
  try {
    assert.throws(
      () => parseArgs(["--report", "docs/validation/evidence/android-apk-build-report.json"]),
      /docs\/validation\/evidence/,
    );
    const options = parseArgs(["--self-test", "--dry-run", "--engine", "jsc", "--report", reportFile]);
    assert.equal(reportPath(path.join(ROOT, "android", "app", "build.gradle")), "android/app/build.gradle");
    assert.equal(reportPath(path.join(os.homedir(), "Downloads", "FREED-release-arm64.apk")), "~/Downloads/FREED-release-arm64.apk");
    assert.equal(reportPath(os.homedir()), "~");
    const buildEnv = buildEnvironment(
      "/Library/Java/JavaVirtualMachines/self-test.jdk/Contents/Home",
      "/tmp/freed-gradle-home",
      DEFAULT_NATIVE_BUILD_JOBS,
    );
    assert.equal(buildEnv.NODE_BINARY, process.execPath);
    assert.equal(buildEnv.CMAKE_BUILD_PARALLEL_LEVEL, String(DEFAULT_NATIVE_BUILD_JOBS));
    assert.ok(buildEnv.PATH.split(path.delimiter).includes(path.dirname(process.execPath)));
    const envKeysToRestore = [
      "FREED_RELEASE_ENV_FILE",
      "FREED_ANDROID_RELEASE_ARCH",
      "FREED_ANDROID_RELEASE_CMAKE_VERSION",
      "FREED_ANDROID_RELEASE_ENGINE",
      "FREED_ANDROID_RELEASE_GRADLE_MAX_WORKERS",
      "FREED_ANDROID_RELEASE_NEW_ARCH",
      "FREED_ANDROID_RELEASE_NATIVE_BUILD_JOBS",
      "FREED_ANDROID_RELEASE_NDK_VERSION",
      "FREED_ANDROID_RELEASE_OUTPUT_DIR",
    ];
    const envSnapshot = new Map(envKeysToRestore.map((key) => [key, process.env[key]]));
    try {
      for (const key of envKeysToRestore) delete process.env[key];
      const selfTestEnvFile = path.join(envTempDir, "freed-android-build.env");
      fs.writeFileSync(
        selfTestEnvFile,
        [
          "FREED_ANDROID_RELEASE_ARCH=all",
          "FREED_ANDROID_RELEASE_CMAKE_VERSION=3.31.0",
          "FREED_ANDROID_RELEASE_ENGINE=jsc",
          "FREED_ANDROID_RELEASE_GRADLE_MAX_WORKERS=2",
          "FREED_ANDROID_RELEASE_NEW_ARCH=true",
          "FREED_ANDROID_RELEASE_NATIVE_BUILD_JOBS=3",
          "FREED_ANDROID_RELEASE_NDK_VERSION=28.2.13676358",
          "FREED_ANDROID_RELEASE_OUTPUT_DIR=/tmp/freed-android-env-output",
        ].join("\n"),
      );
      const envPreload = preloadEnvFileForDefaults(["--env-file", selfTestEnvFile]);
      assert.equal(envPreload.loaded, true);
      assert.equal(envPreload.envFile, selfTestEnvFile);
      assert.match(envPreload.sourceLabel, /freed-android-build\.env merged with process\.env/);
      const envFileOptions = parseArgs([
        "--env-file",
        selfTestEnvFile,
        "--dry-run",
        "--report",
        path.join(tempDir, "android-env-file-build-report.json"),
      ]);
      envFileOptions.envFileLoaded = envPreload.loaded;
      envFileOptions.envFileSource = envPreload.sourceLabel;
      assert.equal(envFileOptions.arch, "armeabi-v7a,arm64-v8a,x86,x86_64");
      assert.equal(envFileOptions.engine, "jsc");
      assert.equal(envFileOptions.cmakeVersion, "3.31.0");
      assert.equal(envFileOptions.gradleMaxWorkers, 2);
      assert.equal(envFileOptions.newArchEnabled, true);
      assert.equal(envFileOptions.nativeBuildJobs, 3);
      assert.equal(envFileOptions.ndkVersion, "28.2.13676358");
      assert.equal(envFileOptions.envFileSource.includes(os.homedir()), false);
      const envFileBase = buildReportBase(envFileOptions, {
        engine: "jsc",
        foojayStatus: "self-test",
        gradleArgs: buildGradleArgs(
          envFileOptions.arch,
          "jsc",
          envFileOptions.artifact,
          envFileOptions.gradleMaxWorkers,
          envFileOptions.nativeBuildJobs,
          envFileOptions.newArchEnabled,
          envFileOptions.ndkVersion,
          envFileOptions.cmakeVersion,
        ),
        gradlePropertiesPath: path.join(envFileOptions.gradleUserHome, "gradle.properties"),
        adMobStatus: resolveAdMobStatus(false, {}),
        hermesProbe: { ok: false, reason: "skipped because --engine jsc was requested" },
        javaHome: "/Library/Java/JavaVirtualMachines/self-test.jdk/Contents/Home",
        signingStatus: {
          missing: ["FREED_ANDROID_UPLOAD_STORE_FILE"],
          mode: "debug-key-fallback",
          required: false,
          storeFileConfigured: false,
          storeFileExists: false,
          uploadKeystore: {
            certificateDn: "",
            certificateSha256Digest: "",
            checked: false,
            debugSigned: false,
          },
        },
      });
      assert.equal(envFileBase.requested.envFileLoaded, true);
      assert.equal(envFileBase.environment.releaseEnvFileLoaded, true);
      assert.equal(envFileBase.environment.releaseEnvSecretValuesOmitted, true);
      assert.match(envFileBase.environment.releaseEnvFileSource, /freed-android-build\.env merged with process\.env/);
      assert.equal(JSON.stringify(envFileBase).includes(os.homedir()), false);
    } finally {
      for (const [key, value] of envSnapshot.entries()) {
        if (value === undefined) {
          delete process.env[key];
        } else {
          process.env[key] = value;
        }
      }
    }
    const installHandoff = buildInstallHandoff(
      options,
      DEFAULT_RELEASE_APK,
      {
        stablePath: path.join(os.homedir(), "Downloads", "FREED-release-arm64.apk"),
        timestampedPath: path.join(os.homedir(), "Downloads", "FREED-release-arm64-20260524-124004.apk"),
      },
      new Date(2026, 4, 24, 12, 40, 4),
    );
    assert.equal(installHandoff.localInstallSupported, true);
    assert.equal(installHandoff.playUploadArtifact, false);
    assert.deepEqual(installHandoff.protectionFlowOrder, [
      "android-native-adult-domain-feed",
      "android-dns-guard",
      "android-usage-access",
      "android-accessibility",
      "android-doomscroll-apps",
      "activation-test",
    ]);
    assert.equal(
      installHandoff.protectionFlowOrderString,
      "android-native-adult-domain-feed>android-dns-guard>android-usage-access>android-accessibility>android-doomscroll-apps>activation-test",
    );
    assert.deepEqual(installHandoff.protectionFlowDetails, [
      "android-native-adult-domain-feed: sync the reviewed adult-domain feed in FREED before OS permission prompts",
      "android-dns-guard: request Android VpnService consent for DNS-only adult-domain blocking",
      "android-usage-access: open Android Usage Access settings for aggregate selected-app timers",
      "android-accessibility: open the FREED Accessibility service details screen for browser and selected-app interruption",
      "android-doomscroll-apps: choose at least one supported app package and sync blocked-app config",
      "activation-test: verify adult-domain blocking, normal browsing allow behavior, and fresh native readiness before saving activation",
    ]);
    assert.match(installHandoff.activationReadinessRule, /adult domains are blocked while normal browsing is allowed/);
    assert.equal(installHandoff.installQaApk, "~/Downloads/FREED-release-arm64.apk");
    assert.equal(installHandoff.installQaOutputDir, "docs/validation/artifacts/android-install-20260524-124004/android-install-qa");
    assert.deepEqual(installHandoff.installQaCommand.slice(0, 4), ["npm", "run", "qa:android-install", "--"]);
    assert.ok(installHandoff.installQaCommand.includes("--apk"));
    assert.ok(installHandoff.installQaCommand.includes("~/Downloads/FREED-release-arm64.apk"));
    assert.match(installHandoff.installQaCommandString, /npm run qa:android-install -- --apk ~\/Downloads\/FREED-release-arm64\.apk/);
    assert.equal(installHandoff.protectionQaOutputDir, "docs/validation/artifacts/android-install-20260524-124004/android-real-browser-capture");
    assert.equal(installHandoff.protectionQaRunId, "android-install-20260524-124004");
    assert.deepEqual(installHandoff.protectionQaCommand.slice(0, 4), ["npm", "run", "evidence:android-real-browser", "--"]);
    assert.ok(installHandoff.protectionQaCommand.includes("--permission-proof"));
    assert.ok(installHandoff.protectionQaCommand.includes("--native-status-proof"));
    assert.ok(installHandoff.protectionQaCommand.includes("--dns-guard-proof"));
    assert.match(installHandoff.protectionQaCommandString, /npm run evidence:android-real-browser -- --device <serial> --adult-url <real-adult-url> --permission-proof --native-status-proof --dns-guard-proof/);
    const selfTestArtifactReport = {
      abis: ["arm64-v8a"],
      copied: true,
      hasHermesBytecode: false,
      hasHermesRuntime: true,
      hasReactNativeBundle: true,
      hasJscRuntime: false,
      path: "~/Downloads/FREED-release-arm64.apk",
      sha256: "0".repeat(64),
      sizeBytes: 1024,
      sizeMb: "0 MB",
      sourcePath: "android/app/build/outputs/apk/release/app-release.apk",
      stablePath: "~/Downloads/FREED-release-arm64.apk",
      timestampedPath: "~/Downloads/FREED-release-arm64-20260524-124004.apk",
      signature: {
        debugSigned: true,
        verified: true,
      },
    };
    const selfTestHandoffDocument = writeAndroidArtifactHandoff(
      options,
      installHandoff,
      selfTestArtifactReport,
      {
        adMobStatus: resolveAdMobStatus(false, {}),
        signingStatus: {
          missing: ["FREED_ANDROID_UPLOAD_STORE_FILE"],
          mode: "debug-key-fallback",
          required: false,
          storeFileConfigured: false,
          storeFileExists: false,
          uploadKeystore: {
            certificateDn: "",
            certificateSha256Digest: "",
            checked: false,
            debugSigned: false,
          },
        },
      },
      { stablePath: path.join(tempDir, "FREED-release-arm64.apk") },
    );
    assert.equal(reportPath(selfTestHandoffDocument).startsWith("docs/validation/artifacts/"), true);
    const selfTestHandoffMarkdown = fs.readFileSync(selfTestHandoffDocument, "utf8");
    assert.match(selfTestHandoffMarkdown, /FREED Android APK Install Handoff/);
    assert.match(selfTestHandoffMarkdown, /Local Android side-load QA only/);
    assert.match(selfTestHandoffMarkdown, /npm run qa:android-install/);
    assert.match(selfTestHandoffMarkdown, /npm run evidence:android-real-browser/);
    assert.match(
      selfTestHandoffMarkdown,
      /android-native-adult-domain-feed>android-dns-guard>android-usage-access>android-accessibility>android-doomscroll-apps>activation-test/,
    );
    assert.match(selfTestHandoffMarkdown, /FREED syncs the feed in-app/);
    assert.match(selfTestHandoffMarkdown, /sync the reviewed adult-domain feed in FREED before OS permission prompts/);
    assert.match(selfTestHandoffMarkdown, /request Android VpnService consent for DNS-only adult-domain blocking/);
    assert.match(selfTestHandoffMarkdown, /open Android Usage Access settings/);
    assert.match(selfTestHandoffMarkdown, /open the FREED Accessibility service details screen/);
    assert.match(selfTestHandoffMarkdown, /Activation rule:/);
    assert.equal(options.buildTimeoutMs, DEFAULT_BUILD_TIMEOUT_MS);
    assert.equal(options.buildIdleTimeoutMs, DEFAULT_BUILD_IDLE_TIMEOUT_MS);
    assert.equal(options.cmakeVersion, defaultInstalledSdkVersion("cmake", PREFERRED_CMAKE_VERSION));
    assert.equal(options.gradleMaxWorkers, DEFAULT_GRADLE_MAX_WORKERS);
    assert.equal(options.newArchEnabled, DEFAULT_NEW_ARCH_ENABLED);
    assert.equal(options.nativeBuildJobs, DEFAULT_NATIVE_BUILD_JOBS);
    assert.equal(options.ndkVersion, defaultInstalledSdkVersion("ndk", PREFERRED_NDK_VERSION));
    assert.throws(() => parseArgs(["--build-idle-timeout-ms", "5000"]), /--build-idle-timeout-ms/);
    assert.throws(() => parseArgs(["--gradle-max-workers", "0"]), /--gradle-max-workers/);
    assert.throws(() => parseArgs(["--cmake-version", "latest"]), /--cmake-version/);
    assert.throws(() => parseArgs(["--new-arch", "sometimes"]), /--new-arch/);
    assert.throws(() => parseArgs(["--native-build-jobs", "0"]), /--native-build-jobs/);
    assert.throws(() => parseArgs(["--ndk-version", "latest"]), /--ndk-version/);
    assert.deepEqual(
      buildFailureDiagnostics(
        new Error(
          [
            "WARNING: Setting `newArchEnabled=false` in your `gradle.properties` file is not supported anymore since React Native 0.82.",
            "The application will run with the New Architecture enabled by default.",
            "Execution failed for task ':app:configureCMakeRelWithDebInfo[arm64-v8a]'.",
            "Process 'command cmake' finished with non-zero exit value 137",
          ].join("\n"),
        ),
      ),
      {
        cmakeConfigureFailed: true,
        cmakeExit137: true,
        failedTask: ":app:configureCMakeRelWithDebInfo[arm64-v8a]",
        hostMemoryConstrainedLikely: os.totalmem() <= 8 * 1024 * 1024 * 1024,
        hostTotalMemoryMb: Math.round(os.totalmem() / 1024 / 1024),
        newArchDisabledUnsupported: true,
        reactNativeNewArchForced: true,
      },
    );
    assert.ok(RELEASE_ARTIFACT_RESULT_ID_MARKERS.includes("android-apk-signature"));
    assert.ok(RELEASE_ARTIFACT_RESULT_ID_MARKERS.includes("android-aab-build"));
    const aabOptions = parseArgs([
      "--artifact",
      "aab",
      "--dry-run",
      "--report",
      path.join(tempDir, "android-aab-build-report.json"),
    ]);
    assert.equal(aabOptions.artifact, "aab");
    assert.equal(aabOptions.requireUploadSigning, true);
    assert.equal(aabOptions.stableName, "FREED-release-play-arm64.aab");
    assert.equal(aabOptions.timestampedName.endsWith(".aab"), true);
    const aabInstallHandoff = buildInstallHandoff(
      aabOptions,
      DEFAULT_RELEASE_AAB,
      {
        stablePath: path.join(os.homedir(), "Downloads", "FREED-release-play-arm64.aab"),
        timestampedPath: path.join(os.homedir(), "Downloads", "FREED-release-play-arm64-20260524-124004.aab"),
      },
      new Date(2026, 4, 24, 12, 40, 4),
    );
    assert.equal(aabInstallHandoff.localInstallSupported, false);
    assert.equal(aabInstallHandoff.playUploadArtifact, true);
    assert.equal(
      aabInstallHandoff.protectionFlowOrderString,
      "android-native-adult-domain-feed>android-dns-guard>android-usage-access>android-accessibility>android-doomscroll-apps>activation-test",
    );
    assert.ok(aabInstallHandoff.protectionFlowDetails.includes("android-native-adult-domain-feed: sync the reviewed adult-domain feed in FREED before OS permission prompts"));
    assert.deepEqual(aabInstallHandoff.installQaCommand, []);
    assert.match(aabInstallHandoff.note, /Play upload artifacts/);
    assert.deepEqual(buildGradleArgs(
      aabOptions.arch,
      "hermes",
      aabOptions.artifact,
      aabOptions.gradleMaxWorkers,
      aabOptions.nativeBuildJobs,
      aabOptions.newArchEnabled,
      aabOptions.ndkVersion,
      aabOptions.cmakeVersion,
    ).slice(0, 2), [
      ":app:bundleRelease",
      "--no-daemon",
    ]);
    assert.equal(releaseArtifactPath("aab"), DEFAULT_RELEASE_AAB);
    assert.throws(() => parseArgs(["--artifact", "aab", "--stable-name", "FREED-release-arm64.apk"]), /must end with \.aab/);
    const debugKeystoreProof = parseKeytoolCertificateOutput(
      [
        "Owner: CN=Android Debug, OU=Android, O=Unknown, L=Unknown, ST=Unknown, C=US",
        "Certificate fingerprints:",
        "         SHA256: FA:C6:17:45:DC:09:03:78:6F:B9:ED:E6:2A:96:2B:39:9F:73:48:F0:BB:6F:89:9B:83:32:66:75:91:03:3B:9C",
      ].join("\n"),
    );
    assert.equal(debugKeystoreProof.debugSigned, true);
    assert.equal(debugKeystoreProof.certificateSha256Digest, ANDROID_DEBUG_CERT_SHA256);
    const uploadSigningEnv = {
      FREED_ANDROID_UPLOAD_STORE_FILE: "android/app/debug.keystore",
      FREED_ANDROID_UPLOAD_STORE_PASSWORD: "android",
      FREED_ANDROID_UPLOAD_KEY_ALIAS: "androiddebugkey",
      FREED_ANDROID_UPLOAD_KEY_PASSWORD: "android",
    };
    assert.throws(
      () => resolveSigningStatus(true, uploadSigningEnv, () => debugKeystoreProof),
      /non-debug upload keystore/,
    );
    const releaseKeystoreProof = {
      certificateDn: "CN=FREED Upload, O=FREED Recovery, C=US",
      certificateSha256Digest: "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
      debugSigned: false,
    };
    assert.equal(
      resolveSigningStatus(true, uploadSigningEnv, () => releaseKeystoreProof).uploadKeystore.checked,
      true,
    );
    assert.deepEqual(resolveAdMobStatus(false, {}), {
      androidAppIdConfigured: false,
      androidAppIdSource: "",
      mode: "local-test-app-id",
      productionReady: false,
      runtimeManifestAppIdConfigured: true,
      runtimeManifestAppIdMode: "local-test-app-id",
      runtimeManifestAppIdSource: "local-google-sample-test-id",
      sampleAppIdUsed: true,
    });
    assert.equal(
      resolveAdMobStatus(true, {
        EXPO_PUBLIC_ADMOB_APP_ID_ANDROID: "ca-app-pub-1234567890123456~1234567890",
      }).productionReady,
      true,
    );
    assert.throws(() => resolveAdMobStatus(true, {}), /production Android AdMob app ID/);
    assert.throws(
      () =>
        resolveAdMobStatus(true, {
          EXPO_PUBLIC_ADMOB_APP_ID_ANDROID: "ca-app-pub-3940256099942544~3347511713",
        }),
      /production Android AdMob app ID/,
    );
    const debugSignature = parseApkSignatureOutput(
      [
        "Verifies",
        "Verified using v1 scheme (JAR signing): false",
        "Verified using v2 scheme (APK Signature Scheme v2): true",
        "Verified using v3 scheme (APK Signature Scheme v3): false",
        "Verified using v3.1 scheme (APK Signature Scheme v3.1): false",
        "Verified using v4 scheme (APK Signature Scheme v4): false",
        "Verified for SourceStamp: false",
        "Number of signers: 1",
        "Signer #1 certificate DN: CN=Android Debug, OU=Android, O=Unknown, L=Unknown, ST=Unknown, C=US",
        `Signer #1 certificate SHA-256 digest: ${ANDROID_DEBUG_CERT_SHA256}`,
        "Signer #1 key algorithm: RSA",
        "Signer #1 key size (bits): 2048",
      ].join("\n"),
      "/android-sdk/build-tools/36.0.0/apksigner",
    );
    assert.equal(debugSignature.verified, true);
    assert.equal(debugSignature.debugSigned, true);
    assert.equal(debugSignature.v2SchemeVerified, true);
    assert.equal(signatureResult(debugSignature).status, "FAIL");
    const uploadSignature = {
      ...debugSignature,
      certificateDn: "CN=FREED Upload, O=FREED Recovery, C=US",
      certificateSha256Digest: "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
      debugSigned: false,
    };
    assert.equal(signatureResult(uploadSignature).status, "PASS");
    const adMobStatus = resolveAdMobStatus(false, {});
    const results = dryRunReportResults(
      {
        missing: ["FREED_ANDROID_UPLOAD_STORE_FILE"],
        mode: "debug-key-fallback",
        required: false,
        storeFileConfigured: false,
        storeFileExists: false,
        uploadKeystore: {
          certificateDn: "",
          certificateSha256Digest: "",
          checked: false,
          debugSigned: false,
        },
      },
      adMobStatus,
    );
    const report = {
      ...buildReportBase(options, {
        engine: "jsc",
        foojayStatus: "self-test",
        gradleArgs: buildGradleArgs(
          options.arch,
          "jsc",
          options.artifact,
          options.gradleMaxWorkers,
          options.nativeBuildJobs,
          options.newArchEnabled,
          options.ndkVersion,
          options.cmakeVersion,
        ),
        gradlePropertiesPath: path.join(options.gradleUserHome, "gradle.properties"),
        adMobStatus,
        hermesProbe: { ok: false, reason: "skipped because --engine jsc was requested" },
        javaHome: "/Library/Java/JavaVirtualMachines/self-test.jdk/Contents/Home",
        signingStatus: {
          missing: ["FREED_ANDROID_UPLOAD_STORE_FILE"],
          mode: "debug-key-fallback",
          required: false,
          storeFileConfigured: false,
          storeFileExists: false,
          uploadKeystore: {
            certificateDn: "",
            certificateSha256Digest: "",
            checked: false,
            debugSigned: false,
          },
        },
      }),
      result: "dry-run",
      summary: summarizeReportResults(results),
      results,
      apk: null,
      aab: null,
    };
    writeJsonReport(options.reportPath, report);
    const parsed = JSON.parse(fs.readFileSync(options.reportPath, "utf8"));
    assert.equal(parsed.schema, "freed-android-apk-build-report-v1");
    assert.equal(parsed.artifactType, "apk");
    assert.equal(parsed.sanitized, true);
    assert.equal(parsed.result, "dry-run");
    assert.equal(parsed.adMob.mode, "local-test-app-id");
    assert.equal(parsed.adMob.sampleAppIdUsed, true);
    assert.equal(parsed.requested.buildIdleTimeoutMs, DEFAULT_BUILD_IDLE_TIMEOUT_MS);
    assert.equal(parsed.summary.passCount, 1);
    assert.equal(parsed.summary.failCount, 2);
    assert.ok(parsed.results.some((entry) => entry.id === "android-apk-upload-signing" && entry.status === "FAIL"));
    assert.ok(parsed.results.some((entry) => entry.id === "android-apk-admob-app-id" && entry.status === "FAIL"));
    const aabDryRunResults = dryRunReportResults(parsed.signing, parsed.adMob, "aab");
    assert.ok(aabDryRunResults.some((entry) => entry.id === "android-aab-build" && entry.status === "PASS"));
    assert.ok(aabDryRunResults.some((entry) => entry.id === "android-aab-upload-signing" && entry.status === "FAIL"));
    const aabBase = buildReportBase(aabOptions, {
      engine: "hermes",
      foojayStatus: "self-test",
      gradleArgs: buildGradleArgs(
        aabOptions.arch,
        "hermes",
        aabOptions.artifact,
        aabOptions.gradleMaxWorkers,
        aabOptions.nativeBuildJobs,
        aabOptions.newArchEnabled,
        aabOptions.ndkVersion,
        aabOptions.cmakeVersion,
      ),
      gradlePropertiesPath: path.join(aabOptions.gradleUserHome, "gradle.properties"),
      adMobStatus,
      hermesProbe: { ok: true, reason: "self-test" },
      javaHome: "/Library/Java/JavaVirtualMachines/self-test.jdk/Contents/Home",
      signingStatus: {
        missing: [],
        mode: "upload-signing",
        required: true,
        storeFileConfigured: true,
        storeFileExists: true,
        uploadKeystore: { ...releaseKeystoreProof, checked: true },
      },
    });
    assert.equal(aabBase.schema, "freed-android-release-build-report-v1");
    assert.equal(aabBase.artifactType, "aab");
    assert.deepEqual(aabBase.gradleCommand.slice(0, 2), ["./gradlew", ":app:bundleRelease"]);
    const localAdMobManifest = {
      exists: true,
      googleMobileAdsApplicationIdConfigured: true,
      googleMobileAdsApplicationIdMode: "local-test-app-id",
      path: "android/app/build/intermediates/merged_manifest/release/processReleaseMainManifest/AndroidManifest.xml",
      sampleAppIdUsed: true,
    };
    const productionAdMobManifest = {
      ...localAdMobManifest,
      googleMobileAdsApplicationIdMode: "production",
      sampleAppIdUsed: false,
    };
    const localQaStatus = buildLocalQaStatus(
      options,
      { abis: ["arm64-v8a"], hasJsBundle: true },
      debugSignature,
      localAdMobManifest,
    );
    assert.equal(localQaStatus.result, "pass");
    assert.equal(localQaStatus.localInstallArtifactProduced, true);
    assert.equal(localQaStatus.sideLoadReady, true);
    assert.match(localQaStatus.releaseBoundary, /Play upload still requires non-debug upload signing/);
    assert.equal(
      buildLocalQaStatus(aabOptions, { abis: ["arm64-v8a"], hasJsBundle: true }, null, productionAdMobManifest).result,
      "not-applicable",
    );
    assert.equal(
      buildLocalQaStatus(options, { abis: [], hasJsBundle: true }, debugSignature, localAdMobManifest).result,
      "fail",
    );
    assert.equal(adMobManifestResult(localAdMobManifest).status, "PASS");
    assert.equal(adMobManifestResult({ ...localAdMobManifest, googleMobileAdsApplicationIdConfigured: false }).status, "FAIL");
    assert.equal(
      reportResult(
        apkReportResults(parsed.signing, { abis: ["arm64-v8a"], hasJsBundle: true }, parsed.adMob, debugSignature, localAdMobManifest),
      ),
      "fail",
    );
    assert.equal(
      reportResult(
        apkReportResults(
          {
            ...parsed.signing,
            missing: [],
            mode: "upload-signing",
            required: true,
            uploadKeystore: { ...releaseKeystoreProof, checked: true },
          },
          { abis: ["arm64-v8a"], hasJsBundle: true },
          {
            androidAppIdConfigured: true,
            androidAppIdSource: "EXPO_PUBLIC_ADMOB_APP_ID_ANDROID",
            mode: "production",
            productionReady: true,
            runtimeManifestAppIdConfigured: true,
            runtimeManifestAppIdMode: "production",
            runtimeManifestAppIdSource: "EXPO_PUBLIC_ADMOB_APP_ID_ANDROID",
            sampleAppIdUsed: false,
          },
          uploadSignature,
          productionAdMobManifest,
        ),
      ),
      "pass",
    );
    assert.equal(parsed.signing.playConsoleReady, false);
    assert.equal(parsed.signing.mode, "debug-key-fallback");
    assert.deepEqual(parsed.gradleCommand.slice(0, 2), ["./gradlew", ":app:assembleRelease"]);
    assert.equal(JSON.stringify(parsed).includes("release-upload-store-password"), false);
    writeBlockedBuildReport(options, "pre-gradle-prerequisite", new Error("Android upload signing is required, but missing: FREED_ANDROID_UPLOAD_STORE_FILE."));
    const blockedReport = JSON.parse(fs.readFileSync(options.reportPath, "utf8"));
    assert.equal(blockedReport.schema, "freed-android-apk-build-report-v1");
    assert.equal(blockedReport.sanitized, true);
    assert.equal(blockedReport.result, "fail");
    assert.equal(blockedReport.buildResult, "blocked-before-gradle");
    assert.equal(blockedReport.releaseBoundary.gradleInvoked, false);
    assert.equal(blockedReport.releaseBoundary.uploadSignedBuildProduced, false);
    assert.equal(blockedReport.results[0].id, "android-apk-pre-gradle-prerequisites");
    assert.equal(JSON.stringify(blockedReport).includes(os.homedir()), false);
    assert.equal(canRetryWithJsc({ engine: "auto", requireUploadSigning: false }, "hermes"), true);
    assert.equal(canRetryWithJsc({ engine: "auto", requireUploadSigning: true }, "hermes"), false);
    assert.equal(canRetryWithJsc({ engine: "hermes", requireUploadSigning: false }, "hermes"), false);
    assert.equal(canRetryWithJsc({ engine: "auto", requireUploadSigning: false }, "jsc"), false);
    assert.doesNotThrow(() =>
      assertUploadSignedEnginePolicy({ requireUploadSigning: true }, "hermes", { ok: true, reason: "self-test" }),
    );
    assert.doesNotThrow(() =>
      assertUploadSignedEnginePolicy({ requireUploadSigning: false }, "jsc", {
        ok: false,
        reason: "local QA JSC self-test",
      }),
    );
    assert.throws(
      () =>
        assertUploadSignedEnginePolicy({ requireUploadSigning: true }, "jsc", {
          ok: false,
          reason: "skipped because --engine jsc was requested",
        }),
      /requires Hermes/,
    );
    console.log("android release APK build helper self-test: pass");
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
    fs.rmSync(envTempDir, { recursive: true, force: true });
  }
}

async function main() {
  const argv = process.argv.slice(2);
  const envPreload = preloadEnvFileForDefaults(argv);
  const options = parseArgs(argv);
  options.envFile = envPreload.envFile || options.envFile;
  options.envFileLoaded = envPreload.loaded;
  options.envFileSource = envPreload.loaded ? envPreload.sourceLabel : "";
  if (options.selfTest) {
    runSelfTest();
    return;
  }
  let javaHome = "";
  let gradlePropertiesPath = "";
  let foojayStatus = "";
  let engine = "";
  let hermesProbe = null;
  let finalEngine = "";
  let gradleArgs = [];
  let env = {};
  let signingStatus = null;
  let adMobStatus = null;
  try {
    javaHome = await resolveJavaHome(options.javaHome);
    gradlePropertiesPath = prepareGradleUserHome(
      options.gradleUserHome,
      javaHome,
      options.gradleMaxWorkers,
      options.nativeBuildJobs,
    );
    foojayStatus = patchFoojayResolverIfNeeded(options.patchFoojay);
    ({ engine, hermesProbe } = await resolveEngine(options.engine));
    assertUploadSignedEnginePolicy(options, engine, hermesProbe);
    finalEngine = engine;
    gradleArgs = buildGradleArgs(
      options.arch,
      finalEngine,
      options.artifact,
      options.gradleMaxWorkers,
      options.nativeBuildJobs,
      options.newArchEnabled,
      options.ndkVersion,
      options.cmakeVersion,
    );
    env = buildEnvironment(javaHome, options.gradleUserHome, options.nativeBuildJobs);
    if (options.requireUploadSigning) env.FREED_REQUIRE_ANDROID_RELEASE_SIGNING = "true";
    signingStatus = resolveSigningStatus(options.requireUploadSigning);
    adMobStatus = resolveAdMobStatus(options.requireUploadSigning);
  } catch (error) {
    const reportPath = writeBlockedBuildReport(options, "pre-gradle-prerequisite", error, { signingStatus, adMobStatus });
    if (reportPath) console.error(`Build report: ${reportPath}`);
    throw error;
  }
  const sourceArtifactPath = releaseArtifactPath(options.artifact);
  const label = artifactLabel(options.artifact);
  const shortLabel = artifactShortLabel(options.artifact);

  console.log(`# FREED Android release ${shortLabel} build`);
  console.log(`Java home: ${javaHome}`);
  console.log(`Gradle user home: ${options.gradleUserHome}`);
  console.log(`Gradle properties: ${gradlePropertiesPath}`);
  console.log(`Artifact: ${options.artifact}`);
  console.log(`Foojay resolver: ${foojayStatus}`);
  console.log(`Requested engine: ${options.engine}`);
  console.log(`Selected engine: ${engine}`);
  console.log(`Hermes probe: ${hermesProbe.ok ? "pass" : "fail"} - ${hermesProbe.reason}`);
  console.log(`Architectures: ${options.arch}`);
  console.log(`Build timeout: ${options.buildTimeoutMs}ms per attempt`);
  console.log(`Build idle timeout: ${options.buildIdleTimeoutMs}ms without Gradle output`);
  console.log(`Android AdMob app id mode: ${adMobStatus.mode}`);
  console.log(
    `Signing mode: ${signingStatus.mode}` +
      (signingStatus.mode === "upload-signing"
        ? " (upload keystore env present)"
        : " (local QA artifact; not for Play Console upload)"),
  );
  console.log(`Require upload signing: ${signingStatus.required ? "yes" : "no"}`);
  console.log(`Gradle command: ./gradlew ${gradleArgs.join(" ")}`);

  if (options.dryRun) {
    if (options.reportPath) {
      const results = dryRunReportResults(signingStatus, adMobStatus, options.artifact);
      writeJsonReport(
        options.reportPath,
        {
          ...buildReportBase(options, {
            engine,
            foojayStatus,
            gradleArgs,
            gradlePropertiesPath,
            adMobStatus,
            hermesProbe,
            javaHome,
            signingStatus,
          }),
          result: "dry-run",
          summary: summarizeReportResults(results),
          results,
          apk: null,
          aab: null,
        },
      );
      console.log(`Build report: ${options.reportPath}`);
    }
    console.log(`Dry run complete; no ${shortLabel} was built.`);
    return;
  }

  try {
    await runGradleBuild(gradleArgs, env, options.buildTimeoutMs, options.buildIdleTimeoutMs);
  } catch (error) {
    if (!canRetryWithJsc(options, finalEngine)) {
      const context = {
        engine: finalEngine,
        foojayStatus,
        gradleArgs,
        gradlePropertiesPath,
        adMobStatus,
        hermesProbe,
        javaHome,
        signingStatus,
      };
      const reportPath = writeGradleFailureBuildReport(options, error, context);
      if (reportPath) console.error(`Build report: ${reportPath}`);
      if (options.requireUploadSigning && options.engine === "auto" && finalEngine === "hermes") {
        throw new Error(
          `Hermes release build failed and --require-upload-signing forbids JavaScriptCore fallback for Play Console artifacts.\n${error.message}`,
        );
      }
      throw error;
    }

    console.warn("");
    console.warn(`Hermes release build failed in auto mode: ${error.message.split(/\r?\n/)[0]}`);
    console.warn("Retrying once with JavaScriptCore so a local APK can still be produced.");
    finalEngine = "jsc";
    gradleArgs = buildGradleArgs(
      options.arch,
      finalEngine,
      options.artifact,
      options.gradleMaxWorkers,
      options.nativeBuildJobs,
      options.newArchEnabled,
      options.ndkVersion,
      options.cmakeVersion,
    );
    console.log(`Gradle command: ./gradlew ${gradleArgs.join(" ")}`);
    try {
      await runGradleBuild(gradleArgs, env, options.buildTimeoutMs, options.buildIdleTimeoutMs);
    } catch (fallbackError) {
      const context = {
        engine: finalEngine,
        foojayStatus,
        gradleArgs,
        gradlePropertiesPath,
        adMobStatus,
        hermesProbe,
        javaHome,
        signingStatus,
      };
      const reportPath = writeGradleFailureBuildReport(options, fallbackError, context);
      if (reportPath) console.error(`Build report: ${reportPath}`);
      throw fallbackError;
    }
  }

  if (!fs.existsSync(sourceArtifactPath)) {
    throw new Error(`${label} was not produced at ${relative(sourceArtifactPath)}`);
  }

  const copied = options.skipCopy
    ? { stablePath: "", timestampedPath: "" }
    : copyOutputs(sourceArtifactPath, options.outputDir, options.stableName, options.timestampedName);
  const finalArtifact = copied.stablePath || sourceArtifactPath;
  const installHandoff = buildInstallHandoff(options, sourceArtifactPath, copied);
  const inspection = await inspectAndroidZipArtifact(finalArtifact);
  const manifestInspection = inspectMergedReleaseManifest();
  const signature = options.artifact === "apk" ? await inspectApkSignature(finalArtifact) : null;
  const hash = sha256(finalArtifact);
  const sizeBytes = fileSizeBytes(finalArtifact);
  const sizeMb = fileSizeMb(finalArtifact);
  const results = artifactReportResults(options.artifact, signingStatus, inspection, adMobStatus, signature, manifestInspection);
  const summary = summarizeReportResults(results);
  const artifactReport = {
    abis: inspection.abis,
    copied: !options.skipCopy,
    hasHermesBytecode: inspection.hasHermesBytecode,
    hasHermesRuntime: inspection.hasHermesRuntime,
    hasReactNativeBundle: inspection.hasJsBundle,
    hasJscRuntime: inspection.hasJscRuntime,
    path: reportPath(finalArtifact),
    sha256: hash,
    sizeBytes,
    sizeMb,
    sourcePath: reportPath(sourceArtifactPath),
    stablePath: reportPath(copied.stablePath),
    timestampedPath: reportPath(copied.timestampedPath),
  };
  if (signature) artifactReport.signature = signature;
  const handoffDocumentPath = writeAndroidArtifactHandoff(
    options,
    installHandoff,
    artifactReport,
    { adMobStatus, signingStatus },
    copied,
  );
  const installHandoffWithDocument = {
    ...installHandoff,
    handoffDocument: reportPath(handoffDocumentPath),
    handoffDocumentWritten: Boolean(handoffDocumentPath),
  };
  if (options.reportPath) {
    writeJsonReport(
      options.reportPath,
      {
        ...buildReportBase(options, {
          engine,
          foojayStatus,
          gradleArgs,
          gradlePropertiesPath,
          adMobStatus,
          hermesProbe,
          javaHome,
          signingStatus,
        }),
        buildResult: "pass",
        result: reportResult(results),
        localQa: buildLocalQaStatus(options, inspection, signature, manifestInspection),
        summary,
        results,
        finalEngine,
        androidManifest: manifestInspection,
        installHandoff: installHandoffWithDocument,
        apk: options.artifact === "apk" ? artifactReport : null,
        aab: options.artifact === "aab" ? artifactReport : null,
      },
    );
  }

  console.log("");
  console.log(`# ${shortLabel} output`);
  if (options.skipCopy) {
    console.log(`${shortLabel}: ${sourceArtifactPath}`);
  } else {
    console.log(`Stable ${shortLabel}: ${copied.stablePath}`);
    console.log(`Timestamped ${shortLabel}: ${copied.timestampedPath}`);
  }
  if (options.reportPath) console.log(`Build report: ${options.reportPath}`);
  if (installHandoffWithDocument.handoffDocument) {
    console.log(`Install handoff: ${handoffDocumentPath}`);
  }
  if (installHandoffWithDocument.installQaCommandString) {
    console.log(`Install QA: ${installHandoffWithDocument.installQaCommandString}`);
  } else {
    console.log(`Install QA: ${installHandoffWithDocument.note}`);
  }
  console.log(`Size: ${sizeMb}`);
  console.log(`SHA-256: ${hash}`);
  console.log(`Final engine: ${finalEngine}`);
  console.log(`Signing mode: ${signingStatus.mode}`);
  if (signature) {
    console.log(`Signature verified: ${signature.verified ? "yes" : "no"}`);
    console.log(`Debug certificate: ${signature.debugSigned ? "yes" : "no"}`);
  } else {
    console.log("Signature verified: n/a (AAB upload signing is validated from the configured upload keystore)");
    console.log("Debug certificate: n/a (AAB is Play-signed after upload)");
  }
  console.log(`ABIs: ${inspection.abis.length > 0 ? inspection.abis.join(", ") : "none detected"}`);
  console.log(`React Native bundle: ${inspection.hasJsBundle ? "present" : "missing"}`);
  console.log(`Hermes bytecode bundle: ${inspection.hasHermesBytecode ? "present" : "absent"}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Android release APK build failed.");
  process.exitCode = 1;
});
