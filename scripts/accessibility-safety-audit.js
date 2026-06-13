const { readFileSync } = require("node:fs");
const { join } = require("node:path");

const root = process.cwd();

function read(path) {
  return readFileSync(join(root, path), "utf8");
}

function check(id, condition, evidence) {
  return {
    id,
    status: condition ? "pass" : "fail",
    evidence
  };
}

const appSurface = read("src/features/freed-app.tsx");

const checks = [
  check(
    "shared-pill-buttons-are-named",
    appSurface.includes('accessibilityRole="button"') &&
      appSurface.includes("accessibilityLabel={accessibilityLabel ?? label}") &&
      appSurface.includes("accessibilityState={{ disabled: Boolean(disabled) }}"),
    "Shared pill buttons expose button role, label text, and disabled state."
  ),
  check(
    "onboarding-choices-are-radios",
    appSurface.includes('accessibilityRole="radio"') &&
      appSurface.includes("Selects ${option} for ${step.question}") &&
      appSurface.includes("accessibilityState={{ selected: isSelected }}"),
    "Onboarding answer choices expose radio semantics and selected state."
  ),
  check(
    "paywall-plans-are-named-radios",
    appSurface.includes("${item.label} premium plan, ${item.price}") &&
      appSurface.includes("accessibilityHint={item.sub}") &&
      appSurface.includes("accessibilityState={{ selected: active }}"),
    "Premium plan choices expose plan name, price, hint copy, and selected state."
  ),
  check(
    "bottom-navigation-tabs-are-named",
    appSurface.includes("const navLabels: Record<Tab, string>") &&
      appSurface.includes('accessibilityRole="tab"') &&
      appSurface.includes("${navLabels[id]} tab") &&
      appSurface.includes("accessibilityState={{ selected: active }}"),
    "Bottom navigation exposes named tab roles with selected state."
  ),
  check(
    "panic-action-is-explicit",
    appSurface.includes('accessibilityLabel="Open urge support"') &&
      appSurface.includes("Starts an immediate recovery intervention without an ad."),
    "Floating urgent-support action is announced as immediate urge support."
  ),
  check(
    "icon-only-controls-have-purpose",
    appSurface.includes('accessibilityLabel="Go back"') &&
      appSurface.includes('accessibilityLabel="Close premium offer"'),
    "Key icon-only onboarding and paywall controls expose spoken labels."
  )
];

const failed = checks.filter((entry) => entry.status === "fail");

console.log("# FREED accessibility safety audit");
console.log(`Result: ${checks.length - failed.length} pass, ${failed.length} fail`);
console.log("");
console.log("| Status | Gate | Evidence |");
console.log("| --- | --- | --- |");
for (const entry of checks) {
  console.log(`| ${entry.status.toUpperCase()} | ${entry.id} | ${entry.evidence.replace(/\|/g, "/")} |`);
}

if (failed.length > 0) {
  process.exitCode = 1;
}
