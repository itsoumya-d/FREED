const assert = require('node:assert/strict');
const { existsSync, mkdtempSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join, resolve } = require('node:path');
const { spawnSync } = require('node:child_process');
const root = resolve(__dirname, '../../..');
const source = 'modules/freed-protection/android/src/main/java/app/freed/protection/FreedDnsRuntimeOwnership.kt';
assert.ok(existsSync(join(root, source)), 'Reset must own and stop resolver race threads and UDP sockets.');
const workspace = mkdtempSync(join(tmpdir(), 'freed-dns-runtime-fixtures-'));
function run(command, args) {
  const result = spawnSync(command, args, { cwd: root, encoding: 'utf8', timeout: 120000 });
  assert.equal(result.status, 0, result.error?.message || result.stdout + result.stderr);
  if (result.stdout.trim()) process.stdout.write(result.stdout);
}
try {
  const jar = join(workspace, 'cases.jar');
  run('kotlinc', [source, 'modules/freed-protection/android/src/test/java/app/freed/protection/FreedDnsRuntimeOwnershipCases.kt', '-include-runtime', '-d', jar]);
  run('java', ['-jar', jar]);
} finally { rmSync(workspace, { recursive: true, force: true }); }
