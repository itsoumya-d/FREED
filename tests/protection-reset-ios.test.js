const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const { test } = require('node:test');

test('iOS reset private-state, cross-process, native handler and Focus runtime boundaries', {
  skip: process.platform !== 'darwin' ? 'Requires Apple Swift/WebKit tooling; no device evidence is inferred.' : false,
}, () => {
  const result = spawnSync(process.execPath, ['modules/freed-protection/tests/run-ios-protection-reset-tests.js'], {
    encoding: 'utf8', timeout: 240_000,
  });
  assert.equal(result.status, 0, result.error?.message || result.stdout + result.stderr);
});
