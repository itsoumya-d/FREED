import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { basename, isAbsolute, join, relative, resolve } from "node:path";

import {
  getValidationEvidenceResults,
  type ValidationEvidenceResult,
  validationEvidenceSpecs
} from "./validation-evidence";

type PromotionOptions = {
  root?: string;
  from: string;
  targetDir?: string;
  dryRun?: boolean;
  force?: boolean;
};

type PromotedEvidenceFile = {
  from: string;
  to: string;
};

export type PromotionResult = {
  status: "pass" | "fail";
  evidenceDir: string;
  targetDir: string;
  dryRun: boolean;
  promoted: PromotedEvidenceFile[];
  failures: ValidationEvidenceResult[];
};

function pathInside(root: string, value: string, label: string): string {
  const trimmed = value.trim();
  if (!trimmed) throw new Error(`${label} is required.`);

  const absolute = isAbsolute(trimmed) ? resolve(trimmed) : resolve(root, trimmed);
  const relativePath = relative(root, absolute);
  if (!relativePath || relativePath.startsWith("..") || isAbsolute(relativePath)) {
    throw new Error(`${label} must be inside the current workspace.`);
  }
  return relativePath;
}

function isPathInside(parent: string, child: string) {
  const relativePath = relative(parent, child);
  return relativePath === "" || (!relativePath.startsWith("..") && !isAbsolute(relativePath));
}

function assertDraftSourceIsNotReleaseEvidence(root: string, evidenceDir: string, targetDir: string) {
  const absoluteEvidenceDir = resolve(root, evidenceDir);
  const releaseEvidenceDir = resolve(root, "docs/validation/evidence");
  const absoluteTargetDir = resolve(root, targetDir);

  if (isPathInside(releaseEvidenceDir, absoluteEvidenceDir)) {
    throw new Error(
      "Refusing to promote from docs/validation/evidence. Use a draft folder under docs/validation/artifacts/<run-id>/draft-evidence."
    );
  }

  if (isPathInside(absoluteTargetDir, absoluteEvidenceDir)) {
    throw new Error("Draft evidence source must be outside the promotion target directory.");
  }
}

export function promoteValidationEvidenceDraft(options: PromotionOptions): PromotionResult {
  const root = resolve(options.root ?? process.cwd());
  const evidenceDir = pathInside(root, options.from, "--from");
  const targetDir = pathInside(root, options.targetDir ?? "docs/validation/evidence", "--target-dir");
  assertDraftSourceIsNotReleaseEvidence(root, evidenceDir, targetDir);
  const results = getValidationEvidenceResults(root, { evidenceDir });
  const failures = results.filter((result) => result.status === "fail");

  if (failures.length > 0) {
    return {
      status: "fail",
      evidenceDir,
      targetDir,
      dryRun: Boolean(options.dryRun),
      promoted: [],
      failures
    };
  }

  const promoted = validationEvidenceSpecs.map((spec) => {
    const fileName = basename(spec.file);
    return {
      from: join(evidenceDir, fileName),
      to: join(targetDir, fileName)
    };
  });

  const conflicts = promoted.filter((file) => existsSync(join(root, file.to)));
  if (conflicts.length > 0 && !options.force) {
    throw new Error(
      `Refusing to overwrite existing evidence files without --force: ${conflicts.map((file) => file.to).join(", ")}`
    );
  }

  if (!options.dryRun) {
    mkdirSync(join(root, targetDir), { recursive: true });
    for (const file of promoted) {
      copyFileSync(join(root, file.from), join(root, file.to));
    }
  }

  return {
    status: "pass",
    evidenceDir,
    targetDir,
    dryRun: Boolean(options.dryRun),
    promoted,
    failures: []
  };
}

function parseArgs(argv: string[]): PromotionOptions {
  const options: Partial<PromotionOptions> = {
    dryRun: false,
    force: false
  };
  const nextValue = (name: string, index: number) => {
    const value = argv[index + 1];
    if (!value || value.startsWith("--")) throw new Error(`Missing value for ${name}.`);
    return value;
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--from") {
      options.from = nextValue(arg, index);
      index += 1;
    } else if (arg.startsWith("--from=")) {
      options.from = arg.slice("--from=".length);
      if (!options.from) throw new Error("Missing value for --from.");
    } else if (arg === "--target-dir") {
      options.targetDir = nextValue(arg, index);
      index += 1;
    } else if (arg.startsWith("--target-dir=")) {
      options.targetDir = arg.slice("--target-dir=".length);
      if (!options.targetDir) throw new Error("Missing value for --target-dir.");
    } else if (arg === "--dry-run") {
      options.dryRun = true;
    } else if (arg === "--force") {
      options.force = true;
    } else {
      throw new Error(`Unknown option: ${arg}`);
    }
  }

  const from = options.from;
  if (!from) throw new Error("Missing required --from <draft-evidence-dir>.");

  return {
    from,
    targetDir: options.targetDir,
    dryRun: Boolean(options.dryRun),
    force: Boolean(options.force)
  };
}

function printResult(result: PromotionResult) {
  console.log("# FREED validation evidence promotion");
  console.log(`Result: ${result.status}`);
  console.log(`Mode: ${result.dryRun ? "dry-run" : "write"}`);
  console.log(`Draft: ${result.evidenceDir}`);
  console.log(`Target: ${result.targetDir}`);
  console.log("");

  if (result.failures.length > 0) {
    console.log("Draft validation failed. No files were promoted.");
    console.log("");
    console.log("| Status | Gate | Evidence | Next |");
    console.log("| --- | --- | --- | --- |");
    for (const failure of result.failures) {
      console.log(
        `| FAIL | ${failure.id} | ${failure.evidence.replace(/\|/g, "/")} | ${(failure.next ?? "").replace(/\|/g, "/")} |`
      );
    }
    return;
  }

  console.log("| Draft file | Promoted file |");
  console.log("| --- | --- |");
  for (const file of result.promoted) {
    console.log(`| ${file.from} | ${file.to} |`);
  }
}

if (process.argv[1]?.endsWith("validation-evidence-promote.ts")) {
  try {
    const result = promoteValidationEvidenceDraft(parseArgs(process.argv.slice(2)));
    printResult(result);
    if (result.status === "fail") process.exitCode = 1;
  } catch (error) {
    console.error(error instanceof Error ? error.message : "Evidence promotion failed.");
    process.exitCode = 1;
  }
}
