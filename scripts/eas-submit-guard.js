#!/usr/bin/env node

const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const { existsSync, readFileSync } = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const APPROVAL_ENV = "FREED_STORE_PRODUCTION_SUBMIT_APPROVED";
const APPROVAL_TOKEN = "strict-release-evidence-pass";
const SAFE_ANDROID_TRACK = "internal";
const SAFE_ANDROID_RELEASE_STATUS = "draft";
const RISKY_IOS_SUBMIT_KEYS = [
  "autoRelease",
  "automaticRelease",
  "phasedRelease",
  "releaseAfterApproval",
  "shouldSubmitToReview",
  "submitForReview"
];

function printHelp() {
  console.log(`Usage: node scripts/eas-submit-guard.js --profile <internal|production> [--dry-run] [-- <eas args>]

Validates FREED's EAS submit profile before invoking eas submit. The production
profile is allowed only while it remains a draft/internal handoff, unless the
owner explicitly sets ${APPROVAL_ENV}=${APPROVAL_TOKEN} after all release
evidence and strict audits pass.

Options:
  --profile <name>    EAS submit profile. Default: production.
  --dry-run           Validate and print the eas command without running it.
  --self-test         Run offline guard checks.
  --help, -h          Show this help.
`);
}

function parseArgs(argv) {
  const options = {
    dryRun: false,
    forwardedArgs: [],
    profile: "production",
    selfTest: false
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = () => {
      index += 1;
      if (index >= argv.length) throw new Error(`Missing value for ${arg}`);
      return argv[index];
    };

    if (arg === "--") {
      options.forwardedArgs.push(...argv.slice(index + 1));
      break;
    } else if (arg === "--dry-run") {
      options.dryRun = true;
    } else if (arg === "--profile") {
      options.profile = next();
    } else if (arg.startsWith("--profile=")) {
      options.profile = arg.slice("--profile=".length);
      if (!options.profile) throw new Error("Missing value for --profile");
    } else if (arg === "--self-test") {
      options.selfTest = true;
    } else if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    } else {
      options.forwardedArgs.push(arg);
    }
  }

  if (!/^[A-Za-z0-9_.-]+$/.test(options.profile)) {
    throw new Error("--profile may contain only letters, numbers, dots, underscores, or dashes");
  }

  return options;
}

function loadEasConfig(root = ROOT) {
  const configPath = path.join(root, "eas.json");
  if (!existsSync(configPath)) throw new Error("Missing eas.json");
  try {
    return JSON.parse(readFileSync(configPath, "utf8"));
  } catch (error) {
    throw new Error(`Invalid eas.json: ${error instanceof Error ? error.message : "parse failed"}`);
  }
}

function approvalEnabled(env) {
  return env[APPROVAL_ENV] === APPROVAL_TOKEN;
}

function truthy(value) {
  return /^(1|true|yes|on)$/i.test(String(value ?? "").trim());
}

function riskyIosSubmitKeys(iosSubmit) {
  if (!iosSubmit || typeof iosSubmit !== "object") return [];
  return RISKY_IOS_SUBMIT_KEYS.filter((key) => truthy(iosSubmit[key]));
}

function validateSubmitProfile(eas, profile, env = process.env) {
  const issues = [];
  const submitProfile = eas?.submit?.[profile];
  const buildProfile = eas?.build?.[profile];
  const approved = approvalEnabled(env);

  if (eas?.cli?.appVersionSource !== "remote") {
    issues.push("eas.json cli.appVersionSource must stay remote for store builds.");
  }
  if (!buildProfile || typeof buildProfile !== "object") {
    issues.push(`eas.json build.${profile} profile is missing.`);
  }
  if (!submitProfile || typeof submitProfile !== "object") {
    issues.push(`eas.json submit.${profile} profile is missing.`);
  }

  const androidSubmit = submitProfile?.android ?? {};
  const iosSubmit = submitProfile?.ios ?? {};
  const liveAndroidSubmit =
    androidSubmit.track && androidSubmit.track !== SAFE_ANDROID_TRACK ||
    androidSubmit.releaseStatus && androidSubmit.releaseStatus !== SAFE_ANDROID_RELEASE_STATUS;
  const iosReviewKeys = riskyIosSubmitKeys(iosSubmit);

  if (profile === "internal") {
    if (androidSubmit.track && androidSubmit.track !== SAFE_ANDROID_TRACK) {
      issues.push("internal EAS submit must stay on the Play internal track.");
    }
    if (androidSubmit.releaseStatus && androidSubmit.releaseStatus !== SAFE_ANDROID_RELEASE_STATUS) {
      issues.push("internal EAS submit must keep Play releaseStatus as draft.");
    }
  }

  if (profile === "production") {
    if (!submitProfile?.android || typeof submitProfile.android !== "object") {
      issues.push("production EAS submit must include an Android submit profile.");
    }
    if (!submitProfile?.ios || typeof submitProfile.ios !== "object") {
      issues.push("production EAS submit must include an iOS submit profile placeholder.");
    }
    if (!approved) {
      if (androidSubmit.track !== SAFE_ANDROID_TRACK) {
        issues.push("production EAS submit must stay on the Play internal track before evidence approval.");
      }
      if (androidSubmit.releaseStatus !== SAFE_ANDROID_RELEASE_STATUS) {
        issues.push("production EAS submit must keep Play releaseStatus as draft before evidence approval.");
      }
      if (iosReviewKeys.length > 0) {
        issues.push(`production iOS submit must not request review automatically before evidence approval: ${iosReviewKeys.join(", ")}.`);
      }
    }
  }

  return {
    approved,
    issues,
    liveAndroidSubmit: Boolean(liveAndroidSubmit),
    profile,
    riskyIosSubmitKeys: iosReviewKeys
  };
}

function easSubmitArgs(profile, forwardedArgs = []) {
  return ["submit", "--profile", profile, ...forwardedArgs];
}

function safeSummary(validation, args) {
  return {
    schemaVersion: "freed-eas-submit-guard-v1",
    result: validation.issues.length === 0 ? "pass" : "fail",
    profile: validation.profile,
    approvedForLiveSubmit: validation.approved,
    liveAndroidSubmit: validation.liveAndroidSubmit,
    riskyIosSubmitKeys: validation.riskyIosSubmitKeys,
    command: ["eas", ...args].join(" "),
    issues: validation.issues
  };
}

function runSelfTest() {
  const safeConfig = {
    cli: { appVersionSource: "remote" },
    build: { internal: {}, production: {} },
    submit: {
      internal: { android: { track: "internal", releaseStatus: "draft" } },
      production: { android: { track: "internal", releaseStatus: "draft" }, ios: {} }
    }
  };
  const liveConfig = {
    cli: { appVersionSource: "remote" },
    build: { production: {} },
    submit: {
      production: {
        android: { track: "production", releaseStatus: "completed" },
        ios: { submitForReview: true }
      }
    }
  };

  assert.deepEqual(validateSubmitProfile(safeConfig, "production").issues, []);
  assert.match(
    validateSubmitProfile(liveConfig, "production").issues.join("\n"),
    /Play internal track before evidence approval/
  );
  assert.match(
    validateSubmitProfile(liveConfig, "production").issues.join("\n"),
    /submitForReview/
  );
  assert.deepEqual(
    validateSubmitProfile(liveConfig, "production", { [APPROVAL_ENV]: APPROVAL_TOKEN }).issues,
    []
  );
  assert.match(validateSubmitProfile({ cli: {}, build: {}, submit: {} }, "production").issues.join("\n"), /appVersionSource/);
  assert.deepEqual(easSubmitArgs("production", ["--platform", "android"]), [
    "submit",
    "--profile",
    "production",
    "--platform",
    "android"
  ]);
  assert.equal(safeSummary(validateSubmitProfile(safeConfig, "production"), easSubmitArgs("production")).schemaVersion, "freed-eas-submit-guard-v1");
  console.log("eas submit guard self-test: pass");
}

function main() {
  let options;
  try {
    options = parseArgs(process.argv.slice(2));
  } catch (error) {
    console.error(error instanceof Error ? error.message : "Invalid arguments.");
    process.exit(1);
  }

  if (options.selfTest) {
    runSelfTest();
    return;
  }

  let eas;
  try {
    eas = loadEasConfig();
  } catch (error) {
    console.error(error instanceof Error ? error.message : "Unable to load eas.json.");
    process.exit(1);
  }

  const args = easSubmitArgs(options.profile, options.forwardedArgs);
  const validation = validateSubmitProfile(eas, options.profile);
  const summary = safeSummary(validation, args);

  if (validation.issues.length > 0) {
    console.error("EAS submit guard failed:");
    for (const issue of validation.issues) console.error(`- ${issue}`);
    console.error(`Set ${APPROVAL_ENV}=${APPROVAL_TOKEN} only after strict release evidence passes and the owner approves live submission.`);
    process.exit(1);
  }

  if (options.dryRun) {
    console.log(JSON.stringify(summary, null, 2));
    return;
  }

  const command = process.env.EAS_CLI_BIN || "eas";
  const result = spawnSync(command, args, {
    cwd: ROOT,
    env: process.env,
    stdio: "inherit"
  });
  if (result.error) {
    console.error(`Failed to run ${command}: ${result.error.message}`);
    process.exit(1);
  }
  process.exit(result.status ?? 1);
}

if (require.main === module) {
  main();
}

module.exports = {
  APPROVAL_ENV,
  APPROVAL_TOKEN,
  easSubmitArgs,
  riskyIosSubmitKeys,
  safeSummary,
  validateSubmitProfile
};
