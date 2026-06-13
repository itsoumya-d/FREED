#!/usr/bin/env node

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { assertSafeArtifactOutputDir } = require("./lib/evidence-output-safety");
const { safeExternalHttpsEndpoint } = require("./lib/evidence-target-safety");
const { envFilePathIssue, isSafeEnvFilePath } = require("./lib/env-file-safety");
const { loadEnvFile } = require("./lib/env-file-loader");

const AI_ENDPOINT_PATHS = {
  coach: "/api/clara",
  challenge: "/api/challenges",
  retention: "/api/retention",
};
const SOURCE_ARTIFACT_PATHS = [
  "docs/validation/templates/ai-backend-smoke.template.json",
  "scripts/ai-backend-smoke-evidence.js",
  "scripts/ai-backend-smoke.ts",
  "scripts/ai-safety-eval.ts",
];
const FORBIDDEN_SENSITIVE_FIELDS = [
  "rawPrompt",
  "rawPrompts",
  "rawUserInput",
  "rawUserMessage",
  "rawCoachRequest",
  "rawChallengeRequest",
  "rawRetentionRequest",
  "rawModelResponse",
  "rawCoachResponse",
  "rawChallengeResponse",
  "rawRetentionResponse",
  "rawRetentionPlan",
  "promptText",
  "userText",
  "privateNotes",
  "slipNote",
  "fullConversation",
  "conversationTranscript",
  "sensitiveUrl",
  "sensitiveDomain",
  "latitude",
  "longitude",
  "rawLocation",
  "preciseLocation",
  "apiKey",
  "openaiApiKey",
  "geminiApiKey",
  "providerApiKey",
];

function parseArgs(argv) {
  const runId = new Date().toISOString().replace(/[:.]/g, "-");
  let outputDirProvided = Boolean(process.env.FREED_AI_BACKEND_OUTPUT);
  const explicit = new Set();
  const options = {
    challengeEndpoint: process.env.EXPO_PUBLIC_AI_CHALLENGE_ENDPOINT || "",
    coachEndpoint: process.env.EXPO_PUBLIC_AI_COACH_ENDPOINT || "",
    envFile: process.env.FREED_RELEASE_ENV_FILE || "",
    model: selectedAiModelFromEnv(process.env),
    outputDir: process.env.FREED_AI_BACKEND_OUTPUT || "",
    planOnly: false,
    retentionEndpoint: process.env.EXPO_PUBLIC_RETENTION_ENDPOINT || "",
    runId,
    selfTest: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = () => {
      index += 1;
      if (index >= argv.length) throw new Error(`Missing value for ${arg}`);
      return argv[index];
    };

    if (arg === "--challenge-endpoint") {
      options.challengeEndpoint = next();
      explicit.add("challengeEndpoint");
    } else if (arg === "--coach-endpoint") {
      options.coachEndpoint = next();
      explicit.add("coachEndpoint");
    } else if (arg === "--retention-endpoint") {
      options.retentionEndpoint = next();
      explicit.add("retentionEndpoint");
    } else if (arg === "--model") {
      options.model = next();
      explicit.add("model");
    } else if (arg === "--output-dir") {
      options.outputDir = next();
      outputDirProvided = true;
    } else if (arg === "--plan-only") {
      options.planOnly = true;
    } else if (arg === "--release-env-file") {
      options.envFile = next();
      explicit.add("envFile");
    } else if (arg === "--run-id") {
      options.runId = safeRunId(next());
    } else if (arg === "--self-test") {
      options.selfTest = true;
    } else if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    } else {
      throw new Error(`Unknown option: ${arg}`);
    }
  }

  if (!outputDirProvided) {
    options.outputDir = path.join("docs", "validation", "artifacts", options.runId, "ai-backend-smoke-capture");
  }
  options.outputDir = assertSafeArtifactOutputDir(options.outputDir, "--output-dir");
  if (options.selfTest) return options;
  const envFileIssue = options.envFile ? envFilePathIssue(options.envFile, "--release-env-file") : null;
  if (envFileIssue) {
    throw new Error(envFileIssue);
  }
  const releaseEnv = loadEnvFile(options.envFile, "--release-env-file");
  applyReleaseEnv(options, releaseEnv, explicit);
  options.releaseEnvFileLoaded = Boolean(options.envFile);
  for (const [label, value] of [
    ["--coach-endpoint", options.coachEndpoint],
    ["--challenge-endpoint", options.challengeEndpoint],
    ["--retention-endpoint", options.retentionEndpoint],
  ]) {
    if (value.trim()) {
      if (label === "--coach-endpoint") options.coachEndpoint = validateEndpoint(label, value);
      if (label === "--challenge-endpoint") options.challengeEndpoint = validateEndpoint(label, value);
      if (label === "--retention-endpoint") options.retentionEndpoint = validateEndpoint(label, value);
    }
  }
  if (options.model.trim() && !/^[A-Za-z0-9._:/@+-]{3,160}$/.test(options.model.trim())) {
    throw new Error("--model must look like a concrete remote provider model id.");
  }
  return options;
}

function firstEnv(env, keys) {
  for (const key of keys) {
    if (env[key] && String(env[key]).trim()) return String(env[key]);
  }
  return "";
}

function selectedAiModelFromEnv(env) {
  const provider = firstEnv(env, ["FREED_AI_PROVIDER", "AI_PROVIDER"]).trim().toLowerCase();
  const openAiKey = firstEnv(env, ["OPENAI_API_KEY"]);
  const geminiKey = firstEnv(env, ["GEMINI_API_KEY", "GOOGLE_API_KEY", "GOOGLE_GENAI_API_KEY"]);
  const openAiModel = firstEnv(env, ["OPENAI_MODEL"]);
  const geminiModel = firstEnv(env, ["GEMINI_MODEL"]);

  if (provider === "openai") return openAiModel;
  if (provider === "gemini") return geminiModel;
  if (openAiKey) return openAiModel;
  if (geminiKey) return geminiModel;
  return openAiModel || geminiModel;
}

function applyIfNotExplicit(options, explicit, field, value) {
  if (explicit.has(field) || !value.trim()) return;
  options[field] = value;
}

function applyReleaseEnv(options, env, explicit) {
  applyIfNotExplicit(options, explicit, "challengeEndpoint", firstEnv(env, ["EXPO_PUBLIC_AI_CHALLENGE_ENDPOINT"]));
  applyIfNotExplicit(options, explicit, "coachEndpoint", firstEnv(env, ["EXPO_PUBLIC_AI_COACH_ENDPOINT"]));
  applyIfNotExplicit(options, explicit, "retentionEndpoint", firstEnv(env, ["EXPO_PUBLIC_RETENTION_ENDPOINT"]));
  applyIfNotExplicit(options, explicit, "model", selectedAiModelFromEnv(env));
}

function printHelp() {
  console.log(`Usage: npm run evidence:ai-backend-smoke -- [options]

Creates a deployed-AI smoke QA capture folder for the AI backend validation gate.
It writes command handoffs, endpoint/model context, and a sanitized artifact
matrix. It never stores raw prompts, transcripts, private notes, sensitive URLs,
unredacted model responses, or provider API keys.

Options:
  --release-env-file <path>      Production env file used by preflight/eval/smoke commands.
  --coach-endpoint <url>         Deployed /api/clara endpoint.
  --challenge-endpoint <url>     Deployed /api/challenges endpoint.
  --retention-endpoint <url>     Optional deployed /api/retention endpoint.
  --model <id>                   Concrete remote provider model id.
  --output-dir <path>            Artifact output folder.
  --run-id <id>                  Machine-readable run id.
  --plan-only                    Print the capture plan without writing files.
  --self-test                    Run offline matrix and sanitizer checks.
`);
}

function safeRunId(value) {
  const normalized = String(value).trim();
  if (!/^[A-Za-z0-9._:-]+$/.test(normalized) || normalized === "." || normalized === "..") {
    throw new Error("Run id may only contain letters, numbers, dots, dashes, underscores, and colons.");
  }
  return normalized;
}

function validateEndpoint(label, value) {
  let expectedPath = "";
  if (label === "--coach-endpoint") expectedPath = AI_ENDPOINT_PATHS.coach;
  if (label === "--challenge-endpoint") expectedPath = AI_ENDPOINT_PATHS.challenge;
  if (label === "--retention-endpoint") expectedPath = AI_ENDPOINT_PATHS.retention;
  return validateEndpointPath(safeExternalHttpsEndpoint(value, label), label, expectedPath);
}

function validateEndpointPath(endpoint, label, expectedPath) {
  if (!expectedPath) return endpoint;
  const pathname = new URL(endpoint).pathname.replace(/\/+$/, "");
  if (pathname !== expectedPath && !pathname.endsWith(expectedPath)) {
    throw new Error(`${label} must target ${expectedPath}.`);
  }
  return endpoint;
}

function releaseCommand(scriptName, envFile) {
  return envFile ? `npm run ${scriptName} -- --env-file ${envFile}` : `npm run ${scriptName}`;
}

function configuredSummary(options) {
  return {
    challengeEndpoint: options.challengeEndpoint.trim(),
    coachEndpoint: options.coachEndpoint.trim(),
    model: options.model.trim(),
    retentionEndpoint: options.retentionEndpoint.trim(),
  };
}

function requiredManualFlows(options) {
  const prefix = options.runId;
  const hasRetentionEndpoint = Boolean(options.retentionEndpoint.trim());
  const deployedEndpointSummary = hasRetentionEndpoint
    ? "deployed CLARA, challenge, and configured retention endpoint"
    : "deployed CLARA and challenge endpoints";
  return [
    {
      artifactField: "ai.releasePreflightArtifact",
      metricFields: "ai.releasePreflightCommand, ai.releasePreflightRunId, checks.releaseEnvPreflightPassed",
      runId: `${prefix}-release-env-preflight`,
      summary: `Run ${releaseCommand("preflight:release-env", options.envFile)} and attach the passing command log.`,
    },
    {
      artifactField: "ai.safetyEvalArtifact",
      metricFields: "ai.safetyEvalCommand, ai.safetyEvalCaseCount, ai.safetyEvalFailedCount",
      runId: `${prefix}-ai-safety-eval`,
      summary: `Run ${releaseCommand("eval:ai-safety", options.envFile)} and attach the safety report with zero failures.`,
    },
    {
      artifactField: "ai.smokeReportArtifact",
      metricFields: "ai.smokeCommand, ai.smokeEndpointPassCount, ai.smokeEndpointFailCount",
      runId: `${prefix}-ai-backend-smoke`,
      summary: `Run ${releaseCommand("smoke:ai-backend", options.envFile)} with --report docs/validation/artifacts/${prefix}/ai-backend-smoke-report.json against ${deployedEndpointSummary}, attach that local ai-backend-smoke-v1 JSON report with sanitized=true, contractProof as ai.smokeReportArtifact, but keep ai.smokeCommand in the sanctioned command shape.`,
    },
    {
      artifactField: "ai.coachSmokeArtifact",
      metricFields: "ai.coachSmokeRunId",
      runId: `${prefix}-coach-smoke`,
      summary: "Attach redacted CLARA smoke proof for a normal support request.",
    },
    {
      artifactField: "ai.challengeSmokeArtifact",
      metricFields: "ai.challengeSmokeRunId",
      runId: `${prefix}-challenge-smoke`,
      summary: "Attach redacted challenge-generation smoke proof.",
    },
    ...(hasRetentionEndpoint
      ? [
          {
            artifactField: "ai.retentionSmokeArtifact",
            metricFields: "ai.retentionSmokeRunId, checks.retentionAggregateOnlyVerified",
            runId: `${prefix}-retention-smoke`,
            summary: "Attach redacted aggregate-only retention route smoke proof with no raw notes, sensitive URLs/domains, or coordinate fields.",
          },
        ]
      : []),
    {
      artifactField: "ai.challengePersonalizationArtifact",
      metricFields: "ai.challengePersonalizationProfileCount, ai.challengeRiskForecastProfileCount, ai.challengeSessionDurationBucketProfileCount, ai.challengeRecentFailureProfileCount, ai.freeChallengePremiumCount, checks.riskForecastPersonalizationVerified, checks.sessionDurationBucketPersonalizationVerified, checks.recentFailureCountPersonalizationVerified",
      runId: `${prefix}-challenge-personalization`,
      summary: "Prove at least two context-rich profile shapes, including weather/location-permission, aggregate urge-risk forecast, coarse session-duration bucket, aggregate recent failed-reset count, zero coordinate fields, and zero premium-only challenges for a free profile.",
    },
    {
      artifactField: "ai.noCoordinateFieldsArtifact",
      metricFields: "ai.noCoordinateFieldsRunId, checks.noCoordinateFields",
      runId: `${prefix}-no-coordinate-fields`,
      summary: "Attach sanitized proof that challenge personalization requests/responses contain context signals but no latitude or longitude fields.",
    },
    {
      artifactField: "ai.noSensitiveEchoArtifact",
      metricFields: "ai.noSensitiveEchoSampleCount",
      runId: `${prefix}-no-sensitive-echo`,
      summary: "Attach at least two redacted samples proving no sensitive URL/domain/private-note echo.",
    },
    {
      artifactField: "ai.redactionArtifact",
      metricFields: "ai.redactionReportId",
      runId: `${prefix}-redaction-report`,
      summary: "Attach provider response redaction report with only sanitized excerpts or aggregate findings.",
    },
    {
      artifactField: "ai.crisisFallbackArtifact",
      metricFields: "ai.crisisFallbackRunId",
      runId: `${prefix}-crisis-fallback`,
      summary: "Prove crisis/self-harm language routes to immediate safe support behavior.",
    },
    {
      artifactField: "ai.providerFallbackArtifact",
      metricFields: "ai.providerFallbackRunId",
      runId: `${prefix}-provider-fallback`,
      summary: "Prove provider outage or missing-provider mode falls back to safe local support.",
    },
  ];
}

function matrixRows(options) {
  return requiredManualFlows(options).map((flow) => ({
    actualResult: "",
    artifact: "",
    artifactField: flow.artifactField,
    metricFields: flow.metricFields,
    notes: "",
    runId: flow.runId,
    status: "pending-manual-qa",
    summary: flow.summary,
  }));
}

function csvEscape(value) {
  const text = String(value ?? "");
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function toCsv(rows) {
  const header = ["runId", "artifactField", "metricFields", "actualResult", "artifact", "status", "notes", "summary"];
  return `${[header, ...rows.map((row) => header.map((field) => row[field]))]
    .map((row) => row.map(csvEscape).join(","))
    .join("\n")}\n`;
}

function repoRelative(filePath) {
  return path.relative(process.cwd(), path.resolve(filePath)).replace(/\\/g, "/");
}

function writeJsonArtifact(filePath, payload) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`);
}

function writeTextArtifact(filePath, content) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content || "\n");
}

function fileSha256Label(relativePath) {
  return `sha256-${crypto.createHash("sha256").update(fs.readFileSync(path.join(process.cwd(), relativePath))).digest("hex")}`;
}

function sourceArtifacts(paths = SOURCE_ARTIFACT_PATHS) {
  return paths.map((sourcePath) => ({
    path: sourcePath,
    sha256: fileSha256Label(sourcePath),
  }));
}

function buildNotes(manifest) {
  const lines = [
    `# AI Backend Smoke Capture: ${manifest.runId}`,
    "",
    "This folder contains a deployed-AI QA plan. It does not satisfy release evidence by itself.",
    "",
    "Never store these fields in evidence:",
    "",
    ...manifest.forbiddenSensitiveFields.map((field) => `- ${field}`),
    "",
    "Manual capture checklist:",
    "",
  ];
  for (const row of manifest.matrixRows) {
    lines.push(`- ${row.runId}: ${row.summary} Suggested artifact: \`${row.artifactField}\`. Metrics: \`${row.metricFields}\`.`);
  }
  lines.push(
    "",
    "`ai-backend-smoke-evidence-fill-template.json` mirrors the final evidence shape with configured non-secret endpoint, model, and command context. It intentionally leaves artifacts/counts blank and checks false until real deployed-endpoint QA fills them.",
    "",
    "After the real deployed-endpoint smoke runs, fill `ai-backend-smoke.json`, validate the draft with `npm run evidence:validation:draft -- docs/validation/artifacts/<run-id>/draft-evidence`, then promote only after every proof artifact exists and contains sanitized data.",
    "",
  );
  return `${lines.join("\n")}\n`;
}

function manifestFor(options, result = "capture-plan-created") {
  const rows = matrixRows(options);
  return {
    commandHandoff: {
      releasePreflightCommand: releaseCommand("preflight:release-env", options.envFile),
      safetyEvalCommand: releaseCommand("eval:ai-safety", options.envFile),
      smokeCommand: releaseCommand("smoke:ai-backend", options.envFile),
    },
    configured: configuredSummary(options),
    forbiddenSensitiveFields: FORBIDDEN_SENSITIVE_FIELDS,
    generatedAt: new Date().toISOString(),
    manualVerificationRequired: true,
    matrixRows: rows,
    releaseGate: "ai-backend-smoke-validation",
    releaseEnvFileLoaded: Boolean(options.releaseEnvFileLoaded),
    result,
    runId: options.runId,
    sanitizedOnly: true,
    evidenceSatisfied: false,
    evidenceBoundary:
      "AI backend smoke capture packets are setup handoffs only. They do not prove deployed CLARA, challenge, retention, model, safety eval, no-sensitive-echo, personalization, crisis fallback, or provider fallback behavior until real deployed-endpoint QA fills and validates ai-backend-smoke.json.",
    schema: "freed-ai-backend-smoke-capture-v1",
    sourceArtifacts: sourceArtifacts(),
  };
}

function buildEvidenceFillTemplate(options, manifest) {
  const configured = configuredSummary(options);
  const prefix = options.runId;
  return {
    templateStatus: "pending-manual-qa",
    manualVerificationRequired: true,
    sanitizedOnly: true,
    instructions:
      "Copy this shape into ai-backend-smoke.json only after replacing blank fields with real deployed-endpoint artifacts, redacted report IDs, counts, and passing checks.",
    ai: {
      coachEndpoint: configured.coachEndpoint,
      challengeEndpoint: configured.challengeEndpoint,
      ...(configured.retentionEndpoint
        ? {
            retentionEndpoint: configured.retentionEndpoint,
            retentionSmokeRunId: `${prefix}-retention-smoke`,
            retentionSmokeArtifact: "",
          }
        : {}),
      model: configured.model,
      releasePreflightCommand: manifest.commandHandoff.releasePreflightCommand,
      releasePreflightRunId: `${prefix}-release-env-preflight`,
      releasePreflightArtifact: "",
      safetyEvalCommand: manifest.commandHandoff.safetyEvalCommand,
      smokeCommand: manifest.commandHandoff.smokeCommand,
      safetyEvalReportId: `${prefix}-ai-safety-eval`,
      safetyEvalArtifact: "",
      safetyEvalCaseCount: "",
      safetyEvalFailedCount: "",
      smokeReportId: `${prefix}-ai-backend-smoke`,
      smokeReportArtifact: "",
      coachSmokeRunId: `${prefix}-coach-smoke`,
      coachSmokeArtifact: "",
      challengeSmokeRunId: `${prefix}-challenge-smoke`,
      challengeSmokeArtifact: "",
      smokeEndpointPassCount: "",
      smokeEndpointFailCount: "",
      challengePersonalizationRunId: `${prefix}-challenge-personalization`,
      challengePersonalizationArtifact: "",
      challengePersonalizationProfileCount: "",
      challengeRiskForecastProfileCount: "",
      challengeSessionDurationBucketProfileCount: "",
      challengeRecentFailureProfileCount: "",
      freeChallengePremiumCount: "",
      noCoordinateFieldsRunId: `${prefix}-no-coordinate-fields`,
      noCoordinateFieldsArtifact: "",
      noSensitiveEchoSampleCount: "",
      noSensitiveEchoRunId: `${prefix}-no-sensitive-echo`,
      noSensitiveEchoArtifact: "",
      redactionReportId: `${prefix}-redaction-report`,
      redactionArtifact: "",
      crisisFallbackRunId: `${prefix}-crisis-fallback`,
      crisisFallbackArtifact: "",
      providerFallbackRunId: `${prefix}-provider-fallback`,
      providerFallbackArtifact: "",
    },
    checks: {
      aiSafetyEvalPassed: false,
      releaseEnvPreflightPassed: false,
      coachSmokePassed: false,
      challengeSmokePassed: false,
      challengePersonalizationVerified: false,
      riskForecastPersonalizationVerified: false,
      sessionDurationBucketPersonalizationVerified: false,
      recentFailureCountPersonalizationVerified: false,
      freeChallengePremiumExcluded: false,
      noCoordinateFields: false,
      noSensitiveEcho: false,
      ...(configured.retentionEndpoint ? { retentionAggregateOnlyVerified: false } : {}),
      crisisFallbackVerified: false,
      fallbackBehaviorVerified: false,
    },
  };
}

function capture(options) {
  const manifest = manifestFor(options, options.planOnly ? "plan-only" : "capture-plan-created");
  if (options.planOnly) {
    console.log(JSON.stringify(manifest, null, 2));
    return;
  }

  const matrixPath = path.join(options.outputDir, "ai-backend-smoke-matrix.csv");
  const evidenceFillTemplatePath = path.join(options.outputDir, "ai-backend-smoke-evidence-fill-template.json");
  const manifestPath = path.join(options.outputDir, "capture-manifest.json");
  const notesPath = path.join(options.outputDir, "CAPTURE_NOTES.md");
  writeTextArtifact(matrixPath, toCsv(manifest.matrixRows));
  writeJsonArtifact(evidenceFillTemplatePath, buildEvidenceFillTemplate(options, manifest));
  writeJsonArtifact(manifestPath, {
    ...manifest,
    evidenceFillTemplateArtifact: repoRelative(evidenceFillTemplatePath),
    matrixArtifact: repoRelative(matrixPath),
  });
  writeTextArtifact(notesPath, buildNotes(manifest));
  console.log(
    JSON.stringify(
      {
        ...manifest,
        evidenceFillTemplateArtifact: repoRelative(evidenceFillTemplatePath),
        manifestArtifact: repoRelative(manifestPath),
        matrixArtifact: repoRelative(matrixPath),
        notesArtifact: repoRelative(notesPath),
      },
      null,
      2,
    ),
  );
}

function runSelfTest() {
  assert.equal(safeRunId("ai-backend-2026-05-15"), "ai-backend-2026-05-15");
  assert.throws(() => safeRunId("../bad"));
  assert.throws(() => parseArgs(["--self-test", "--output-dir", "docs/validation/evidence"]), /docs\/validation\/evidence/);
  assert.throws(() => parseArgs(["--self-test", "--output-dir", "../outside-artifacts"]), /current workspace/);
  assert.equal(isSafeEnvFilePath("secrets/prod.env"), true);
  assert.equal(isSafeEnvFilePath(".env.production.example"), false);
  assert.throws(() => parseArgs(["--release-env-file", "docs/validation/evidence/prod.env"]), /docs\/validation\/evidence/);
  assert.throws(() => parseArgs(["--release-env-file", "docs/validation/artifacts/run/prod.env"]), /docs\/validation\/artifacts/);
  const envRoot = fs.mkdtempSync(path.join(os.tmpdir(), "freed-ai-env-"));
  try {
    const malformedEnv = path.join(envRoot, "malformed.env");
    const duplicateEnv = path.join(envRoot, "duplicate.env");
    fs.writeFileSync(malformedEnv, ["GOOD=value", "# spacer", "", "MISSING_EQUALS"].join("\n"));
    fs.writeFileSync(duplicateEnv, ["GOOD=value", "# spacer", "", "GOOD=again"].join("\n"));
    assert.throws(() => parseArgs(["--release-env-file", malformedEnv]), /--release-env-file line 4 must use KEY=value syntax/);
    assert.throws(() => parseArgs(["--release-env-file", duplicateEnv]), /--release-env-file line 4 repeats GOOD from line 1/);
  } finally {
    fs.rmSync(envRoot, { recursive: true, force: true });
  }
  assert.doesNotThrow(() => validateEndpoint("--coach-endpoint", "https://api.freedrecovery.app/api/clara"));
  assert.doesNotThrow(() => validateEndpoint("--challenge-endpoint", "https://api.freedrecovery.app/api/challenges"));
  assert.doesNotThrow(() => validateEndpoint("--retention-endpoint", "https://api.freedrecovery.app/api/retention"));
  assert.throws(() => validateEndpoint("--coach-endpoint", "http://localhost:3000/api/coach"));
  assert.throws(() => validateEndpoint("--coach-endpoint", "https://10.0.0.2/api/coach"), /private|reserved/);
  assert.throws(() => validateEndpoint("--coach-endpoint", "https://example.com/api/coach"), /placeholder|reserved/);
  assert.throws(() => validateEndpoint("--coach-endpoint", "https://api.freedrecovery.app"), /concrete route path/);
  assert.throws(() => validateEndpoint("--coach-endpoint", "https://api.freedrecovery.app/api/coach"), /\/api\/clara/);
  assert.throws(() => validateEndpoint("--challenge-endpoint", "https://api.freedrecovery.app/api/challenges/generate"), /\/api\/challenges/);
  assert.throws(() => validateEndpoint("--retention-endpoint", "https://api.freedrecovery.app/api/retention/sync"), /\/api\/retention/);
  assert.throws(() => validateEndpoint("--coach-endpoint", "https://user:pass@api.freedrecovery.app/api/clara"), /URL credentials/);
  assert.throws(() => validateEndpoint("--challenge-endpoint", "https://api.freedrecovery.app/api/challenges?token=secret"), /query strings/);
  assert.throws(() => validateEndpoint("--retention-endpoint", "https://api.freedrecovery.app/api/retention#access_token=secret"), /URL fragments/);

  const options = {
    challengeEndpoint: "https://api.freedrecovery.app/api/challenges",
    coachEndpoint: "https://api.freedrecovery.app/api/clara",
    envFile: "secrets/prod.env",
    model: "gemini-2.5-flash",
    retentionEndpoint: "https://api.freedrecovery.app/api/retention",
    runId: "self-test",
  };
  const manifest = manifestFor(options, "self-test");
  assert.equal(manifest.matrixRows.length, 12);
  assert.equal(manifest.sanitizedOnly, true);
  assert.equal(manifest.evidenceSatisfied, false);
  assert.deepEqual(
    manifest.sourceArtifacts.map((artifact) => artifact.path),
    SOURCE_ARTIFACT_PATHS,
  );
  assert.ok(manifest.sourceArtifacts.every((artifact) => /^sha256-[0-9a-f]{64}$/.test(artifact.sha256)));
  assert.match(manifest.evidenceBoundary, /setup handoffs only/);
  assert.ok(manifest.forbiddenSensitiveFields.includes("rawPrompt"));
  assert.ok(manifest.forbiddenSensitiveFields.includes("rawRetentionRequest"));
  assert.ok(manifest.forbiddenSensitiveFields.includes("latitude"));
  assert.ok(manifest.forbiddenSensitiveFields.includes("preciseLocation"));
  assert.ok(!JSON.stringify(manifest.matrixRows).includes("privateNotes"));
  assert.match(JSON.stringify(manifest.matrixRows), /retentionAggregateOnlyVerified/);
  assert.match(toCsv(manifest.matrixRows), /pending-manual-qa/);
  const fillTemplate = buildEvidenceFillTemplate(options, manifest);
  assert.equal(fillTemplate.templateStatus, "pending-manual-qa");
  assert.equal(fillTemplate.ai.releasePreflightCommand, "npm run preflight:release-env -- --env-file secrets/prod.env");
  assert.equal(fillTemplate.ai.safetyEvalCommand, "npm run eval:ai-safety -- --env-file secrets/prod.env");
  assert.equal(fillTemplate.ai.smokeCommand, "npm run smoke:ai-backend -- --env-file secrets/prod.env");
  assert.equal(fillTemplate.ai.model, "gemini-2.5-flash");
  assert.equal(fillTemplate.ai.retentionEndpoint, "https://api.freedrecovery.app/api/retention");
  assert.equal(fillTemplate.ai.retentionSmokeRunId, "self-test-retention-smoke");
  assert.equal(fillTemplate.checks.aiSafetyEvalPassed, false);
  assert.equal(fillTemplate.checks.retentionAggregateOnlyVerified, false);
  assert.equal(JSON.stringify(fillTemplate).includes("rawPrompt"), false);
  console.log("ai-backend-smoke-evidence self-test: pass");
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.selfTest) {
    runSelfTest();
    return;
  }
  capture(options);
}

main();
