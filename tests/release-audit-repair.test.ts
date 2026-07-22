import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

function run(command: string, args: string[]) {
  return execFileSync(command, args, {
    cwd: process.cwd(),
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"]
  });
}

const androidSelfTest = run("node", ["scripts/android-install-qa.js", "--self-test"]);
assert.match(androidSelfTest, /android install qa self-test: pass/);

const releaseSelfTest = run("node", ["scripts/run-ts-entry.js", "scripts/release-readiness.ts", "--self-test"]);
assert.match(releaseSelfTest, /release readiness self-test: pass/);

const legalAudit = run("npm", ["run", "audit:store-legal"]);
assert.match(legalAudit, /"result": "pass"/);

const releaseAudit = run("npm", ["run", "audit:release"]);
for (const gate of [
  "adult-only-classifier",
  "ios-screen-time-scaffold",
  "discipline-configuration-contract",
  "privacy-safety-contract",
  "backend-architecture-contract",
  "adult-domain-feed-smoke-harness",
  "store-launch-config"
]) {
  assert.match(releaseAudit, new RegExp(`\\| PASS \\| ${gate} \\|`));
}
assert.match(
  releaseAudit,
  /adult-domain-feed-smoke-harness \| The smoke-harness audit passes, including the adult-domain feed smoke-harness self-test, 48-hour route freshness enforcement/
);
assert.doesNotMatch(
  releaseAudit,
  /adult-only-classifier \|[^\n]*48-hour route freshness enforcement/
);

const swiftInterpolation = '"url": "https://\\(host)"';
const overEscapedSwiftInterpolation = '"url": "https://\\\\(host)"';
assert.equal(overEscapedSwiftInterpolation.includes(swiftInterpolation), false);
assert.ok(
  readFileSync("scripts/release-readiness.ts", "utf8").includes(`module.includes('"url": "https://\\\\(host)"')`),
  "release audit must look for the one-backslash Swift interpolation emitted by the native source"
);

console.log("release audit repair test: pass");
