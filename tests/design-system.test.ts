import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  getLayoutClass,
  getStatusPresentation,
  resolveTheme
} from "../src/design-system/theme";
import { ROOT_DESTINATIONS } from "../src/design-system/navigation";

assert.deepEqual(
  ROOT_DESTINATIONS.map((destination) => destination.id),
  ["today", "shield", "progress", "profile"],
  "root destinations keep the recovery-focused order"
);

for (const destination of ROOT_DESTINATIONS) {
  assert.ok(destination.accessibilityLabel.length > 0, `${destination.id} has an accessible label`);
  assert.ok(destination.compactLabel.length > 0, `${destination.id} has a compact label`);
}

assert.equal(getLayoutClass(320), "compact");
assert.equal(getLayoutClass(600), "medium");
assert.equal(getLayoutClass(840), "expanded");

const expectedStatusSemantics = {
  protected: { label: "Protection is active", icon: "shield-check" },
  attention: { label: "Protection needs attention", icon: "shield-alert" },
  unprotected: { label: "Protection is not active", icon: "shield-off" }
} as const;

for (const [status, expected] of Object.entries(expectedStatusSemantics)) {
  const presentation = getStatusPresentation(status as keyof typeof expectedStatusSemantics, resolveTheme("ios"));
  assert.equal(presentation.label, expected.label);
  assert.equal(presentation.icon, expected.icon);
  assert.notEqual(presentation.color, "", `${status} includes a semantic color alongside text and icon`);
}

const root = resolve(__dirname, "..");
const tokenSource = resolve(root, "design/freed.mobile.tokens.json");
const generatedDirectory = resolve(root, "src/design-system/generated");
const tokenTool = "/Users/soumyadebnath16/.codex/skills/mobile-native-design-system/scripts/mobile_tokens.py";
const sourceDocument = JSON.parse(readFileSync(tokenSource, "utf8"));

assert.ok(sourceDocument.$extensions["org.mobile-native"].profiles.ios);
assert.ok(sourceDocument.$extensions["org.mobile-native"].profiles.android);
assert.equal(sourceDocument.$extensions["org.mobile-native"].profiles.reducedMotion.overrides["motion.distance.standard"], 0);

const validation = execFileSync("python3", [tokenTool, "validate", tokenSource], { encoding: "utf8" });
const parity = execFileSync("python3", [tokenTool, "parity", tokenSource, generatedDirectory], { encoding: "utf8" });
assert.match(validation, /"ok": true/);
assert.match(parity, /"ok": true/);
assert.match(validation, /"token_count": 147/);
