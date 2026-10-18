const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const { test } = require('node:test');

test('iOS app guard modes execute production rules and native boundaries', {
  skip: process.platform !== 'darwin' ? 'Requires the Apple Swift toolchain; does not imply device enforcement evidence.' : false,
}, () => {
  const result = spawnSync(process.execPath, ['modules/freed-protection/tests/run-ios-app-guard-tests.js'], {
    encoding: 'utf8', timeout: 120_000,
  });
  assert.equal(result.status, 0, result.error?.message || result.stdout + result.stderr);
});
