import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";

function run(command: string, args: string[]) {
  return execFileSync(command, args, {
    cwd: process.cwd(),
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"]
  });
}

const androidSelfTest = run("node", ["scripts/android-install-qa.js", "--self-test"]);
assert.match(androidSelfTest, /android install qa self-test: pass/);

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
assert.match(releaseAudit, /48-hour route freshness enforcement/);

console.log("release audit repair test: pass");
