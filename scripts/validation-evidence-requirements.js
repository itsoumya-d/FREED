const { readFileSync } = require("node:fs");
const { join } = require("node:path");

const specs = JSON.parse(readFileSync(join(process.cwd(), "scripts/validation-evidence-specs.json"), "utf8"));
const {
  handoffDocumentCommandList,
  handoffDocumentPaths,
  productionEnvChecklist,
  productionBlockerGroups,
  reportArtifactCommandList
} = require("./lib/release-blocker-groups");
const {
  VALIDATION_REQUIREMENTS_SCHEMA_VERSION
} = require("./lib/validation-requirements-schema");

const artifactRoot = "docs/validation/artifacts/<run-id>";
const reportArtifactCommands = reportArtifactCommandList(artifactRoot);
const requirements = specs.map((spec) => ({
  id: spec.id,
  file: spec.file,
  subjectLabel: spec.subjectLabel,
  requiredChecks: spec.requiredChecks,
  requiredFields: spec.requiredFields ?? [],
  requiredCommands: spec.requiredCommands ?? [],
  requiredProfileNumbers: spec.requiredProfileNumbers ?? [],
  next: spec.next
}));

console.log(
  JSON.stringify(
    {
      schemaVersion: VALIDATION_REQUIREMENTS_SCHEMA_VERSION,
      generatedAt: new Date().toISOString(),
      runId: "<run-id>",
      reportArtifactCommands,
      handoffDocuments: handoffDocumentPaths(),
      handoffDocumentCommands: handoffDocumentCommandList(artifactRoot, "<run-id>"),
      draftValidationCommand: `npm run evidence:validation:draft -- ${artifactRoot}/draft-evidence`,
      promotionCommand: `npm run evidence:promote -- --from ${artifactRoot}/draft-evidence`,
      releaseEvidenceValidationCommand: "npm run evidence:validation",
      finalVerificationCommand: `npm run verify:release -- --env-file <production-env-file> --artifact-dir ${artifactRoot}`,
      productionEnvChecklist: productionEnvChecklist(),
      productionBlockerGroups: productionBlockerGroups(artifactRoot, "<run-id>"),
      requirements
    },
    null,
    2
  )
);
