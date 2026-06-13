const { existsSync, mkdirSync, readFileSync, writeFileSync } = require("node:fs");
const { basename, isAbsolute, join, relative, resolve } = require("node:path");

const root = process.cwd();
const specs = JSON.parse(readFileSync(join(root, "scripts/validation-evidence-specs.json"), "utf8"));
const {
  captureHelperCommands,
  captureHelperCommandMap,
  handoffDocumentCommandList,
  handoffDocumentPaths,
  productionEnvChecklist,
  productionBlockerGroups,
  reportArtifactCommandList
} = require("./lib/release-blocker-groups");
const {
  VALIDATION_REQUIREMENTS_SCHEMA_VERSION
} = require("./lib/validation-requirements-schema");

function parseArgs(argv) {
  const args = {
    dryRun: false,
    force: false,
    output: null,
    runId: new Date().toISOString().slice(0, 10)
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = () => {
      const value = argv[index + 1];
      if (!value || value.startsWith("--")) throw new Error(`Missing value for ${arg}.`);
      index += 1;
      return value;
    };

    if (arg === "--dry-run") {
      args.dryRun = true;
    } else if (arg === "--force") {
      args.force = true;
    } else if (arg === "--run-id") {
      args.runId = next();
    } else if (arg.startsWith("--run-id=")) {
      args.runId = arg.slice("--run-id=".length);
      if (!args.runId) throw new Error("Missing value for --run-id.");
    } else if (arg === "--output") {
      args.output = next();
    } else if (arg.startsWith("--output=")) {
      args.output = arg.slice("--output=".length);
      if (!args.output) throw new Error("Missing value for --output.");
    } else {
      throw new Error(`Unknown option: ${arg}`);
    }
  }

  return args;
}

function safeRunId(value) {
  const normalized = value.trim();
  if (!/^[a-zA-Z0-9._-]+$/.test(normalized)) {
    throw new Error("Run id may only contain letters, numbers, dots, dashes, and underscores.");
  }
  if (normalized === "." || normalized === "..") {
    throw new Error("Run id must be a named folder.");
  }
  return normalized;
}

function pathInside(parent, child) {
  const relativePath = relative(parent, child);
  return relativePath === "" || (!relativePath.startsWith("..") && !isAbsolute(relativePath));
}

function assertSafeOutputRoot(outputRoot) {
  const releaseEvidenceDir = resolve(root, "docs/validation/evidence");
  if (pathInside(releaseEvidenceDir, outputRoot)) {
    throw new Error(
      "Refusing to scaffold draft evidence inside docs/validation/evidence. Use docs/validation/artifacts/<run-id>/ or another draft folder, then promote after draft validation passes."
    );
  }
}

function templatePathForEvidenceFile(evidenceFile) {
  return join(
    root,
    "docs/validation/templates",
    basename(evidenceFile).replace(/\.json$/, ".template.json")
  );
}

function readTemplatePayload(evidenceFile) {
  return JSON.parse(readFileSync(templatePathForEvidenceFile(evidenceFile), "utf8"));
}

function writeFile(path, content, options) {
  if (existsSync(path) && !options.force) {
    throw new Error(`${path} already exists. Pass --force to overwrite draft files.`);
  }
  if (!options.dryRun) writeFileSync(path, content);
}

function buildReadme(runId, draftDir) {
  const artifactRoot = `docs/validation/artifacts/${runId}`;
  const helpers = captureHelperCommands(artifactRoot, runId);
  const helperCommandList = specs
    .map((spec) => captureHelperCommand(spec, runId, artifactRoot))
    .filter(Boolean);
  const iosPhysicalDeviceIndex = helperCommandList.findIndex((command) =>
    command.includes("npm run evidence:ios-physical-device")
  );
  helperCommandList.splice(
    iosPhysicalDeviceIndex >= 0 ? iosPhysicalDeviceIndex : 0,
    0,
    helpers.iosDeviceDiscovery
  );
  const androidRealBrowserIndex = helperCommandList.findIndex((command) =>
    command.includes("npm run evidence:android-real-browser")
  );
  helperCommandList.splice(
    androidRealBrowserIndex >= 0 ? androidRealBrowserIndex : helperCommandList.length,
    0,
    helpers.androidDeviceDiscovery,
    helpers.androidInstallQa
  );
  const lines = [
    `# FREED Evidence Draft: ${runId}`,
    "",
    "This folder is a working area for QA evidence capture. Draft JSON files here do not satisfy release gates.",
    "",
    "Fill each draft with real device, store, ad, performance, or backend proof.",
    `Store supporting artifacts under docs/validation/artifacts/${runId}/ and reference them from JSON with repo-relative paths such as docs/validation/artifacts/${runId}/screen-recording.mov, or use production-safe HTTPS QA/report URLs.`,
    "Remote evidence URLs must use real QA/report/artifact paths and must not use URL credentials or fragments, localhost, private/reserved IPs, `.local`, `.internal`, `.localhost`, `.example`, `.test`, `.invalid`, or placeholder host text such as `your-*`, `sample`, or `todo`; signed QA artifact query strings are allowed only for evidence links, never for production API endpoint fields.",
    "",
    "Validate drafts with `npm run evidence:validation:draft -- <this-folder>/draft-evidence` before promotion.",
    "When every draft is fully real and draft validation passes, promote with `npm run evidence:promote -- --from <this-folder>/draft-evidence`.",
    "Use `CAPTURE_PLAN.md` in this package as the generated per-gate checklist. It is derived from the same spec as the validator.",
    "Use the capture helper commands below to create pending QA matrices and device metadata before filling draft JSON evidence.",
    "",
    "Draft files:",
    ...specs.map((spec) => `- ${join(draftDir, basename(spec.file))} -> ${spec.file}`),
    "- CAPTURE_PLAN.md -> per-gate capture checklist from scripts/validation-evidence-specs.json",
    "",
    "Capture helper commands:",
    "",
    "```sh",
    ...helperCommandList,
    "```",
    "",
    "Release-env helper behavior:",
    ...specs.flatMap((spec) => captureHelperNotes(spec).map((note) => `- ${note}`)),
    "",
    "Useful commands:",
    "",
    "```sh",
    "npm run evidence:requirements",
    "npm run evidence:templates",
    ...handoffDocumentCommandList(artifactRoot, runId),
    "npm run audit:release",
    "```",
    ""
  ];
  return `${lines.join("\n")}`;
}

function checklistLines(values, formatValue = (value) => value) {
  if (!Array.isArray(values) || values.length === 0) return [];
  return values.map((value) => `- [ ] ${formatValue(value)}`);
}

function appendProductionBlockerGroups(lines, runId) {
  const artifactRoot = `docs/validation/artifacts/${runId}`;
  lines.push("Release blocker groups:");
  for (const group of productionBlockerGroups(artifactRoot, runId)) {
    lines.push("");
    lines.push(`- \`${group.id}\` (${group.category})`);
    if (group.evidenceFile) lines.push(`  - Evidence file: \`${group.evidenceFile}\``);
    if (group.captureHelperCommand) lines.push(`  - Capture helper: \`${group.captureHelperCommand}\``);
    if (Array.isArray(group.requiredEnv) && group.requiredEnv.length > 0) {
      lines.push(...group.requiredEnv.map((value) => `  - Env: \`${value}\``));
    }
    if (Array.isArray(group.requiredReports) && group.requiredReports.length > 0) {
      lines.push(...group.requiredReports.map((value) => `  - Report: \`${value}\``));
    }
    if (Array.isArray(group.preflightCheckIds) && group.preflightCheckIds.length > 0) {
      lines.push(...group.preflightCheckIds.map((value) => `  - Preflight check: \`${value}\``));
    }
    lines.push(`  - Next: ${group.next}`);
  }
  lines.push("");
}

function appendProductionEnvChecklist(lines, runId) {
  const checklist = productionEnvChecklist();

  lines.push("## Production Environment Preflight");
  lines.push("");
  lines.push("Run this before collecting backend, store, ad, AI, or final release evidence:");
  lines.push("");
  lines.push("```sh");
  lines.push(`npm run preflight:release-env -- --env-file <production-env-file> --report docs/validation/artifacts/${runId}/release-env-preflight-report.json`);
  lines.push("```");
  lines.push("");
  lines.push("Client/release env values:");
  lines.push(...checklistLines(checklist.clientKeys, (value) => `\`${value}\``));
  lines.push("");
  lines.push("Public backend routing env values:");
  lines.push(...checklistLines(checklist.publicBackendKeys, (value) => `\`${value}\``));
  lines.push("");
  lines.push("Server-only/private env values:");
  lines.push(...checklistLines(checklist.serverKeys, (value) => `\`${value}\``));
  lines.push("");
  appendProductionBlockerGroups(lines, runId);
  lines.push(checklist.privateEvidenceWarning);
  lines.push("");
}

function appendNormalBrowsingUrlPlan(lines, spec) {
  const payload = readTemplatePayload(spec.file);
  const normalBrowsing = payload && typeof payload === "object" ? payload.normalBrowsing : null;
  if (!normalBrowsing || typeof normalBrowsing !== "object") return;

  const sections = [
    ["Allowed URL checks", normalBrowsing.allowedUrls, "expect allow"],
    ["Recovery-search URL checks", normalBrowsing.recoverySearchUrls, "expect allow"],
    ["Adult-intent block checks", normalBrowsing.adultBlockedUrls, "expect block"]
  ];

  lines.push("");
  lines.push("Device URL checklist:");
  for (const [title, urls, expectation] of sections) {
    if (!Array.isArray(urls) || urls.length === 0) continue;
    lines.push("");
    lines.push(`${title}:`);
    lines.push(...urls.map((url) => `- [ ] \`${url}\` - ${expectation}`));
  }
}

function captureHelperCommand(spec, runId, artifactRoot) {
  return captureHelperCommandMap(artifactRoot, runId)[spec.id] ?? null;
}

function captureHelperNotes(spec) {
  const notes = {
    "ios-physical-device-validation": [
      "`npm run evidence:ios-devices` is a setup handoff only; use it to confirm a trusted physical iPhone name or UDID, but keep `evidenceSatisfied=false` and do not promote it as iOS release evidence.",
      "Pass `--app <signed-freed-app-or-ipa>` to generate local `ios-app-package-proof.json` (`freed-ios-app-package-proof-v1`, `sanitized=true`); use it for entitlement/app-group/Complete Data Protection/Safari build support only when `packageProofUsableForManualEvidence=true`, `entitlementFailures`, `safariRuleFailures`, and `missingOrMismatchedExtensions` are empty, the app and extensions pass Family Controls/app-group/Complete Data Protection checks, Safari rule signals include adult-domain plus YouTube Shorts / Instagram Reels / TikTok For You web rules with all-block actions, and no packet tunnel/packet inspection entitlements are present.",
      "Use `ios-physical-device-evidence-fill-template.json` from the helper as the pending final-shape handoff, but keep every check false and every artifact blank until entitlement-approved physical-device recordings or QA reports prove the behavior.",
      "In the FamilyActivityPicker recording, tap Done after selecting tokens and immediately capture FREED/native status showing `ios.familyActivityPickerAppLimitScheduledImmediately=true` with the `freed.selectedAppDailyLimit` activity and `freed.selectedAppDailyLimitReached` event names.",
      "Capture the Safari/web short-form challenge handoff separately from the Content Blocker proof: the artifact must show source `ios-safari-short-form`, a matching `short-form:*` rule, host-only storage, `RawPathStored=false`, no native unlock, selected shields still active, and adult filtering still active.",
      "Attach physical iPhone challenge-verification artifacts for Vision camera labels, no base64/EXIF photo payload, temporary-photo cleanup, motion samples, pedometer steps, and accurate foreground location fixes before setting the challenge verification checks."
    ],
    "android-real-browser-validation": [
      "`npm run evidence:android-devices` is a setup handoff only; use it to pick a ready hardware serial, but keep `evidenceSatisfied=false` and do not promote it as Android release evidence.",
      "Run `npm run qa:android-install -- --device <serial> --apk android/app/build/outputs/apk/release/app-release.apk --require-upload-signing` on Android hardware first, then fill `android.installQaRunId`, `android.installQaArtifact`, and `checks.androidInstallLaunchQa=true` from the local `freed-android-install-qa-report-v1` report before promoting Android real-browser evidence.",
      "Use `android-real-browser-evidence-fill-template.json` from the helper as the pending final-shape handoff, preserving concrete run IDs and helper-captured artifacts while keeping every check false until physical Android QA, DNS Guard review, challenge verification, and Play policy review are complete.",
      "Attach Android hardware challenge-verification artifacts for ML Kit camera labels, no base64/EXIF photo payload, temporary-photo cleanup, motion samples, Activity Recognition/steps, and accurate foreground location fixes before setting the challenge verification checks.",
      "Add `--permission-proof` to a physical-device run, or run `--scenario none --permission-proof`, to generate `android-permission-proof.txt`/`.json` plus local Accessibility, Usage Access, notification, and DNS Guard consent permission reports; pair it with the FREED native status/profile screenshot before filling UsageStats and notification prompt metrics.",
      "Open FREED to Profile > Native Protection, then add `--native-status-proof` or run `--scenario none --native-status-proof` to capture `android-native-status.png`, UI text, and UI hierarchy for UsageStats metrics, adult-domain feed status, Private DNS, and DNS Guard resolver diagnostics.",
      "After enabling DNS Guard, reboot the physical device or update the app package, then run `npm run evidence:android-real-browser -- --device <serial> --scenario none --dns-guard-restart-proof` to capture `android.dnsGuardRestartRunId`, `android.dnsGuardRestartArtifact`, restart action/result/user-enabled/eligible fields, and the paired native status text; repeat after manual stop or VPN revocation for the skipped-restart artifact and reason.",
      "Run `npm run evidence:android-real-browser -- --device <serial> --scenario none --focused-webview-proof` with the installed `app.freed.qawebview` fixture to collect `android.focusedWebViewPackage`, `android.focusedWebViewRunId`, and `android.focusedWebViewArtifact`.",
      "Run `npm run evidence:android-real-browser -- --scenario none --play-policy-proof` to package the Android Accessibility/DNS Guard disclosure pack and manifest declarations for `android.playPolicyAccessibilityArtifact` and `android.playPolicySpecialUseFgsArtifact`; concrete Play Console review IDs are still required.",
      "Run `npm run evidence:android-real-browser -- --device <serial> --scenario synced-feed --adult-domain-feed-host <synced-feed-only-adult-host> --dns-guard-proof` with a reviewed synced-feed-only adult host to collect `android.adultDomainFeedAccessibilityArtifact`, `android.dnsGuardBlockArtifact`, `android.dnsGuardInterventionVisible=true`, and `android.adultDomainFeedDnsGuardArtifact`; pair it with native feed status proof.",
      "Run `npm run evidence:android-real-browser -- --device <serial> --adult-url <real-adult-url> --scenario none --app-scenario browser-earned-unlock --configured-app-package com.instagram.android --configured-app-label Instagram` after completing a browser/adult-domain challenge to prove `android.browserEarnedUnlockNativeAppUnlockActive=false`, `android.browserEarnedUnlockConfiguredAppStillShielded=true`, and `android.browserEarnedUnlockAdultFilterStillActive=true`.",
      "Run `--app-scenario short-form-both` for YouTube Shorts to collect the below-threshold and sustained-intercept fields, then repeat the sustained helper flow with `--app-scenario short-form --short-form-package com.instagram.android --short-form-label \"Instagram Reels\"` and `--app-scenario short-form --short-form-package <installed TikTok package> --short-form-label \"TikTok For You\"` where the TikTok package is `com.zhiliaoapp.musically`, `com.ss.android.ugc.trill`, or `com.tiktok`; keep each app's observed foreground usage below the configured daily app limit and fill `android.shortFormUsageBeforeLimitMinutes`, `android.instagramReelsUsageBeforeLimitMinutes`, and `android.tiktokFeedUsageBeforeLimitMinutes`, plus selected-surface proof fields for YouTube, Instagram, and TikTok, so the proof cannot be mistaken for a broad app-limit shield."
    ],
    "performance-validation": [
      "Keep `--android-background-cpu-proof` on the physical Android helper run to sample package-specific `dumpsys cpuinfo`, write `android-background-cpu-proof.txt`/`.json`, and prefill the Android background CPU artifact plus maximum parsed percent for QA review.",
      "Use `performance-profile-evidence-fill-template.json` from the helper as the pending final-shape handoff, preserving concrete run IDs and helper-captured artifacts while keeping every threshold metric blank and every check false until the real profiler, DNS, speed, and routing QA passes.",
      "Android routing proof is captured automatically for no-full-traffic-proxy, no-packet-inspection, and no-MITM-HTTPS review; still attach DNS latency, download-speed, DNS failover, SERVFAIL fallback, VPN revocation, continuous screenshot/OCR absence, continuous image-classification absence, and full profiler artifacts before promotion."
    ],
    "normal-browsing-corpus-validation": [
      "`normal-browsing-browser-summary.template.json` precomputes pending `normalBrowsing.browserMatrix` rows with exact URL counts; fill device details, artifacts, pass counts, zero failure counts, and `passed=true` only after physical-browser QA passes every matrix row.",
      "`browser-report-templates/*.template.json` gives each browser row a pending `freed-normal-browsing-browser-report-v1` shape with `sanitized=true`; complete these as local JSON result artifacts before copying paths into `normalBrowsing.browserMatrix[].resultArtifact`.",
      "`normal-browsing-evidence-fill-template.json` mirrors the final evidence shape but starts with false checks and blank pass fields so it remains a handoff aid, not release evidence."
    ],
    "store-ad-sandbox-validation": [
      "`--release-env-file` preloads non-secret store provider, Core 3 product IDs, entitlement, purchase endpoint, rewarded-ad unit, and coarse country context into the sanitized capture manifest.",
      "`store-ad-sandbox-evidence-fill-template.json` mirrors the final evidence shape with the Core 3 launch-product matrix, but keeps artifacts/counts blank and checks false until real sandbox QA fills them.",
      "`paywall-launch-scope-report.template.json` gives QA the local `freed-paywall-launch-scope-report-v1` shape for proving only Core 3 products are shown, future SKUs are hidden, yearly is the value anchor, restore is visible, and purchase buttons are enabled.",
      "`store-console-product-setup-report.template.json` gives QA the local `freed-store-console-product-setup-report-v1` shape for proving App Store Connect and Play Console have only Core 3 products configured, future SKUs inactive, screenshots/localizations attached, and draft/internal/TestFlight-only status until evidence passes.",
      "Explicit store/ad CLI flags override release env-file values, `releaseEnvFileLoaded=true` records the preload, and helper artifacts must still omit raw receipts, Play tokens, customer IDs, store credentials, and ad-network secrets."
    ],
    "ai-backend-smoke-validation": [
      "`--release-env-file` preloads non-secret coach endpoint, challenge endpoint, optional retention endpoint, and model context into the sanitized capture manifest.",
      "`ai-backend-smoke-evidence-fill-template.json` mirrors the final evidence shape with configured non-secret context, but keeps artifacts/counts blank and checks false until real deployed-endpoint QA fills them.",
      "Explicit AI helper CLI flags override release env-file values, `releaseEnvFileLoaded=true` records the preload, and helper artifacts must still omit raw prompts, transcripts, private notes, sensitive URLs/domains, unredacted model output, and provider API keys."
    ]
  };
  return notes[spec.id] ?? [];
}

function buildCapturePlan(runId) {
  const artifactRoot = `docs/validation/artifacts/${runId}`;
  const helpers = captureHelperCommands(artifactRoot, runId);
  const lines = [
    `# FREED Evidence Capture Plan: ${runId}`,
    "",
    "This generated checklist is a QA handoff for real evidence capture. It does not satisfy release gates by itself.",
    "Draft JSON files live in `draft-evidence/`; supporting screenshots, videos, logs, profiler exports, policy tickets, and reports should be stored under:",
    "",
    `- \`${artifactRoot}/\``,
    "",
    "Replace every placeholder before draft validation. Keep raw receipts, purchase tokens, private notes, provider keys, and unredacted AI transcripts out of evidence JSON.",
    "Evidence references must be files under the artifact folder or production-safe HTTPS QA/report URLs; remote evidence links reject credentials/fragments and local, private, reserved, documentation-only, or placeholder-like hosts (`your-*`, `sample`, `todo`), while production API endpoint fields also reject query strings.",
    ""
  ];

  appendProductionEnvChecklist(lines, runId);

  for (const spec of specs) {
    lines.push(`## ${spec.subjectLabel}`);
    lines.push("");
    lines.push(`- Target evidence: \`${spec.file}\``);
    lines.push(`- Draft file: \`draft-evidence/${basename(spec.file)}\``);
    lines.push(`- Next action: ${spec.next}`);
    lines.push(`- Artifact folder: \`${artifactRoot}/\``);
    const helperCommand = captureHelperCommand(spec, runId, artifactRoot);
    if (spec.id === "ios-physical-device-validation") {
      lines.push("");
      lines.push("iOS device discovery prerequisite:");
      lines.push("");
      lines.push("```sh");
      lines.push(helpers.iosDeviceDiscovery);
      lines.push("```");
    }
    if (spec.id === "android-real-browser-validation") {
      lines.push("");
      lines.push("Android device and install QA prerequisites:");
      lines.push("");
      lines.push("```sh");
      lines.push(helpers.androidDeviceDiscovery);
      lines.push(helpers.androidInstallQa);
      lines.push("```");
    }
    if (helperCommand) {
      lines.push("");
      lines.push("Capture helper:");
      lines.push("");
      lines.push("```sh");
      lines.push(helperCommand);
      lines.push("```");
    }
    const helperNotes = captureHelperNotes(spec);
    if (helperNotes.length > 0) {
      lines.push("");
      lines.push("Helper notes:");
      lines.push(...helperNotes.map((note) => `- ${note}`));
    }
    if (Array.isArray(spec.requiredCommands) && spec.requiredCommands.length > 0) {
      lines.push("");
      lines.push("Required command proof:");
      lines.push(...checklistLines(spec.requiredCommands, (value) => `\`${value}\``));
    }
    lines.push("");
    lines.push("Required checks:");
    lines.push(...checklistLines(spec.requiredChecks, (value) => `\`checks.${value}\``));
    lines.push("");
    lines.push("Required fields:");
    lines.push(...checklistLines(spec.requiredFields ?? [], (value) => `\`${value}\``));
    if (Array.isArray(spec.requiredProfileNumbers) && spec.requiredProfileNumbers.length > 0) {
      lines.push("");
      lines.push("Required numeric profile fields:");
      lines.push(...checklistLines(spec.requiredProfileNumbers, (value) => `\`profile.${value}\``));
    }
    if (spec.id === "normal-browsing-corpus-validation") {
      appendNormalBrowsingUrlPlan(lines, spec);
    }
    lines.push("");
  }

  lines.push("## Canonical Handoff Commands");
  lines.push("");
  lines.push("These commands are generated from the same shared source as `requirements.json`, `docs/validation/README.md`, and `docs/validation/evidence-runbook.md`.");
  lines.push("");
  lines.push("```sh");
  lines.push("npm run evidence:requirements");
  lines.push("npm run evidence:templates");
  lines.push(...handoffDocumentCommandList(artifactRoot, runId));
  lines.push("npm run audit:release");
  lines.push("```");
  lines.push("");

  return `${lines.join("\n")}`;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const runId = safeRunId(args.runId);
  const outputRoot = args.output
    ? resolve(root, args.output)
    : join(root, "docs/validation/artifacts", runId);
  assertSafeOutputRoot(outputRoot);
  const draftDir = join(outputRoot, "draft-evidence");
  const artifactRoot = `docs/validation/artifacts/${runId}`;
  const requirements = {
    schemaVersion: VALIDATION_REQUIREMENTS_SCHEMA_VERSION,
    generatedAt: new Date().toISOString(),
    runId,
    reportArtifactCommands: reportArtifactCommandList(artifactRoot),
    handoffDocuments: handoffDocumentPaths(),
    handoffDocumentCommands: handoffDocumentCommandList(artifactRoot, runId),
    draftValidationCommand: `npm run evidence:validation:draft -- ${artifactRoot}/draft-evidence`,
    promotionCommand: `npm run evidence:promote -- --from ${artifactRoot}/draft-evidence`,
    releaseEvidenceValidationCommand: "npm run evidence:validation",
    finalVerificationCommand: `npm run verify:release -- --env-file <production-env-file> --artifact-dir ${artifactRoot}`,
    productionEnvChecklist: productionEnvChecklist(),
    productionBlockerGroups: productionBlockerGroups(artifactRoot, runId),
    requirements: specs.map((spec) => ({
      id: spec.id,
      file: spec.file,
      subjectLabel: spec.subjectLabel,
      requiredChecks: spec.requiredChecks,
      requiredFields: spec.requiredFields ?? [],
      requiredCommands: spec.requiredCommands ?? [],
      captureHelperCommand: captureHelperCommand(spec, runId, artifactRoot),
      captureHelperNotes: captureHelperNotes(spec),
      requiredProfileNumbers: spec.requiredProfileNumbers ?? [],
      next: spec.next
    }))
  };

  if (!args.dryRun) {
    mkdirSync(draftDir, { recursive: true });
  }

  const created = [];
  for (const spec of specs) {
    const templatePath = templatePathForEvidenceFile(spec.file);
    const destination = join(draftDir, basename(spec.file));
    const content = readFileSync(templatePath, "utf8");
    writeFile(destination, content, args);
    created.push(destination);
  }

  writeFile(join(outputRoot, "requirements.json"), `${JSON.stringify(requirements, null, 2)}\n`, args);
  writeFile(join(outputRoot, "README.md"), buildReadme(runId, "draft-evidence"), args);
  writeFile(join(outputRoot, "CAPTURE_PLAN.md"), buildCapturePlan(runId), args);

  console.log("# FREED validation evidence scaffold");
  console.log(`Mode: ${args.dryRun ? "dry-run" : "write"}`);
  console.log(`Output: ${outputRoot}`);
  console.log("");
  console.log("| Draft | Target evidence file |");
  console.log("| --- | --- |");
  for (const spec of specs) {
    console.log(`| ${join("draft-evidence", basename(spec.file))} | ${spec.file} |`);
  }
  console.log("");
  console.log(`Capture plan: ${join(outputRoot, "CAPTURE_PLAN.md")}`);
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : "Evidence scaffold failed.");
  process.exitCode = 1;
}
