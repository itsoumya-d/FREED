const assert = require('node:assert/strict');
const fs = require('node:fs');
const { tmpdir } = require('node:os');
const { join, resolve } = require('node:path');
const { spawnSync } = require('node:child_process');
const root = resolve(__dirname, '../../..');
const source = 'modules/freed-protection/android/src/main/java/app/freed/protection/';
const test = 'modules/freed-protection/android/src/test/java/app/freed/protection/';
const dir = fs.mkdtempSync(join(tmpdir(), 'freed-task2-android-'));
function run(command, args) {
  const result = spawnSync(command, args, { cwd: root, encoding: 'utf8', timeout: 300000 });
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  assert.equal(result.status, 0, result.error?.message || `${command} failed`);
}
try {
  const names = ['FreedInstalledAppPolicy', 'FreedAppGroupPolicy', 'FreedAppGroupAuthorityPolicy', 'FreedAppGroupTransaction', 'FreedDynamicAppSelection'];
  const files = new Set(names.map(name => test + name + 'Cases.kt'));
  for (const name of [...names, 'FreedAppGuardModePolicy', 'FreedAppSchedulePolicy', 'FreedDoomscrollApps']) {
    const path = source + name + '.kt';
    if (fs.existsSync(join(root, path))) files.add(path);
  }
  const jar = join(dir, 'cases.jar');
  run('kotlinc', [...files, '-include-runtime', '-d', jar]);
  for (const name of names) run('java', ['-classpath', jar, 'app.freed.protection.' + name + 'CasesKt']);

} finally { fs.rmSync(dir, { recursive: true, force: true }); }
