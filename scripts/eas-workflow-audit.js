#!/usr/bin/env node

const assert = require("node:assert/strict");
const { existsSync, readFileSync } = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const WORKFLOW_DIR = ".eas/workflows";
const INTERNAL_WORKFLOW = "freed-internal-builds.yml";
const STORE_WORKFLOW = "freed-store-builds.yml";
const PACKAGE_JSON = "package.json";
const APPROVAL_TOKEN = "strict-release-evidence-pass";

function readWorkflow(root, name) {
  const workflowPath = path.join(root, WORKFLOW_DIR, name);
  if (!existsSync(workflowPath)) return null;
  return readFileSync(workflowPath, "utf8");
}

function hasLine(text, needle) {
  return text.split(/\r?\n/).some((line) => line.trim() === needle);
}

function includesAll(text, needles) {
  return needles.every((needle) => text.includes(needle));
}

function workflowChecks(root = ROOT) {
  const internal = readWorkflow(root, INTERNAL_WORKFLOW);
  const store = readWorkflow(root, STORE_WORKFLOW);
  const packageJsonPath = path.join(root, PACKAGE_JSON);
  const packageJson = existsSync(packageJsonPath) ? JSON.parse(readFileSync(packageJsonPath, "utf8")) : null;
  const scripts = packageJson?.scripts || {};
  const checks = [
    {
      id: "workflow-directory",
      ok: existsSync(path.join(root, WORKFLOW_DIR)),
      detail: `${WORKFLOW_DIR} exists`
    },
    {
      id: "internal-workflow-file",
      ok: Boolean(internal),
      detail: `${INTERNAL_WORKFLOW} exists`
    },
    {
      id: "store-workflow-file",
      ok: Boolean(store),
      detail: `${STORE_WORKFLOW} exists`
    },
    {
      id: "eas-build-scripts-use-pinned-runner",
      ok:
        String(scripts["eas:build:internal"] || "").includes("npx eas-cli@latest build --profile internal") &&
        String(scripts["eas:build:production"] || "").includes("npx eas-cli@latest build --profile production"),
      detail: "package EAS build scripts invoke npx eas-cli@latest instead of relying on a global eas binary"
    }
  ];

  if (internal) {
    checks.push(
      {
        id: "internal-manual-only",
        ok:
          internal.includes("workflow_dispatch:") &&
          !hasLine(internal, "push:") &&
          !hasLine(internal, "pull_request:"),
        detail: "internal workflow is manually triggered"
      },
      {
        id: "internal-build-profiles",
        ok:
          includesAll(internal, [
            "profile: internal",
            "platform: android",
            "platform: ios",
            "refresh_ad_hoc_provisioning_profile: true"
          ]) && hasLine(internal, "type: build"),
        detail: "internal workflow builds Android APK and iOS internal artifacts"
      },
      {
        id: "internal-local-gates",
        ok: includesAll(internal, [
          "npm run audit:eas-workflows",
          "npm run typecheck",
          "npm run evidence:templates",
          "npm run eas:submit:internal -- --dry-run"
        ]),
        detail: "internal workflow runs local launch guards before builds"
      },
      {
        id: "internal-android-cmake-137-handoff",
        ok: includesAll(internal, [
          "CMake exit 137",
          ":app:configureCMakeRelWithDebInfo[arm64-v8a]",
          "preferred current-source artifact for physical QA",
          "Do not use any older side-load APK as proof of the latest native code"
        ]),
        detail: "internal workflow documents EAS Android APK fallback when local CMake exit 137 blocks current artifacts"
      }
    );
  }

  if (store) {
    checks.push(
      {
        id: "store-manual-only",
        ok:
          store.includes("workflow_dispatch:") &&
          !hasLine(store, "push:") &&
          !hasLine(store, "pull_request:"),
        detail: "store workflow is manually triggered"
      },
      {
        id: "store-build-profiles",
        ok:
          includesAll(store, ["profile: production", "platform: android", "platform: ios"]) &&
          hasLine(store, "type: build"),
        detail: "store workflow builds Android Play and iOS App Store artifacts"
      },
      {
        id: "store-local-gates",
        ok: includesAll(store, [
          "npm run audit:eas-workflows",
          "npm run typecheck",
          "npm run evidence:templates",
          "npm run audit:smoke-harnesses",
          "npm run eas:submit:production -- --dry-run"
        ]),
        detail: "store workflow runs release guards before builds"
      },
      {
        id: "store-no-submit-job",
        ok: !hasLine(store, "type: submit"),
        detail: "store workflow does not contain an EAS submit job"
      },
      {
        id: "store-submit-boundary",
        ok:
          store.includes(APPROVAL_TOKEN) &&
          store.includes("Do not run live production submission from EAS Workflows") &&
          store.includes("npm run verify:release"),
        detail: "store workflow documents the strict evidence boundary before submit"
      },
      {
        id: "store-android-cmake-137-handoff",
        ok: includesAll(store, [
          "CMake exit 137",
          ":app:configureCMakeRelWithDebInfo[arm64-v8a]",
          "preferred current-source store artifact",
          "EAS build URL",
          "Do not treat any older side-load APK as evidence for the latest native code"
        ]),
        detail: "store workflow documents EAS Android AAB fallback when local CMake exit 137 blocks current artifacts"
      }
    );
  }

  return checks;
}

function runAudit(root = ROOT) {
  return workflowChecks(root).map((check) => ({
    ...check,
    status: check.ok ? "PASS" : "FAIL"
  }));
}

function printResults(results) {
  const passCount = results.filter((result) => result.status === "PASS").length;
  const failCount = results.length - passCount;

  console.log("# FREED EAS workflow audit");
  console.log(`Result: ${passCount} pass, ${failCount} fail`);
  console.log("");
  for (const result of results) {
    console.log(`- ${result.status}: ${result.id} - ${result.detail}`);
  }

  return failCount;
}

function runSelfTest() {
  assert.equal(hasLine("  type: build\n  profile: production\n", "type: build"), true);
  assert.equal(hasLine("  prototype: submitter\n", "type: submit"), false);
  assert.equal(includesAll("a b c", ["a", "c"]), true);
  assert.equal(includesAll("a b c", ["a", "d"]), false);

  const results = runAudit();
  assert.ok(results.find((result) => result.id === "store-no-submit-job"));
  assert.ok(results.find((result) => result.id === "eas-build-scripts-use-pinned-runner"));
  assert.ok(results.find((result) => result.id === "store-submit-boundary"));
  assert.ok(results.find((result) => result.id === "internal-local-gates"));
  assert.ok(results.find((result) => result.id === "internal-android-cmake-137-handoff"));
  assert.ok(results.find((result) => result.id === "store-android-cmake-137-handoff"));
  console.log("eas workflow audit self-test: pass");
}

function main() {
  if (process.argv.includes("--self-test")) {
    runSelfTest();
    return;
  }
  const failCount = printResults(runAudit());
  if (failCount > 0) process.exit(1);
}

if (require.main === module) {
  main();
}

module.exports = {
  INTERNAL_WORKFLOW,
  STORE_WORKFLOW,
  WORKFLOW_DIR,
  hasLine,
  includesAll,
  runAudit,
  workflowChecks
};
