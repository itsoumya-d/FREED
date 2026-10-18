const { mkdtempSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
const { spawnSync } = require('node:child_process');
const assert = require('node:assert/strict');
const workspace = mkdtempSync(join(tmpdir(), 'freed-lock-diagnostics-'));
try {
 const executable = join(workspace, 'cases');
 for (const [cmd,args] of [['xcrun',['swiftc','-parse-as-library','modules/freed-protection/ios/FreedProtectionConfigurationLock.swift','modules/freed-protection/tests/LockDiagnosticCases.swift','-o',executable]],[executable,[]]]) {
  const result=spawnSync(cmd,args,{encoding:'utf8',timeout:60000});
  assert.equal(result.status,0,`${cmd}: ${result.stdout}${result.stderr}`); process.stdout.write(result.stdout);
 }
} finally { rmSync(workspace,{recursive:true,force:true}); }
