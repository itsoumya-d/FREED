const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {spawnSync} = require('node:child_process');
const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'freed-earned-time-policy-'));
try {
 const binary = path.join(directory, 'cases');
 const sources = ['modules/freed-protection/ios/FreedAppGroupsPolicy.swift', 'modules/freed-protection/ios/FreedEarnedAppTimePolicy.swift','modules/freed-protection/ios/FreedChallengeEvidencePolicy.swift','modules/freed-protection/ios/FreedChallengeStepObserver.swift','modules/freed-protection/ios/FreedEarnedAppTimeTrustedClock.swift', 'modules/freed-protection/tests/EarnedAppTimePolicyCases.swift'];
 for (const [command, args] of [['xcrun', ['swiftc', '-parse-as-library', '-swift-version', '5', ...sources, '-o', binary]], [binary, []]]) {
  const result = spawnSync(command, args, {encoding: 'utf8', timeout: 60000});
  process.stdout.write(result.stdout + result.stderr);
  assert.equal(result.status, 0, `${command} failed`);
 }
} finally {
 fs.rmSync(directory, {recursive: true, force: true});
}
