const assert = require('node:assert/strict');
const { mkdtempSync, readFileSync, writeFileSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { resolve, join } = require('node:path');
const { spawnSync } = require('node:child_process');

// Compiles real production policies into isolated command-line harnesses.
// It never loads app preferences, boots a simulator, installs an app, or signs.
const root = resolve(__dirname, '../../..');
const workspace = mkdtempSync(join(tmpdir(), 'freed-encrypted-dns-tests-'));
function run(command, args) {
  const result = spawnSync(command, args, { cwd: root, encoding: 'utf8', timeout: 60_000 });
  assert.equal(result.status, 0, `${command} failed:\n${result.error?.message || ''}${result.stdout}${result.stderr}`);
  if (result.stdout.trim()) process.stdout.write(result.stdout);
}

try {
  const source = readFileSync(join(root, 'modules/freed-protection/ios/FreedProtectionModule.swift'), 'utf8');
  const start = source.indexOf('// MARK: - Optional encrypted DNS');
  const end = source.indexOf('// MARK: - Protection configuration reset policy', start);
  assert.ok(start >= 0 && end > start, 'The native DNS implementation must remain separable from account and UI state.');
  const input = join(workspace, 'EncryptedDns.swift');
  const executable = join(workspace, 'encrypted-dns-ios-cases');
  writeFileSync(input, 'import Foundation\n#if canImport(NetworkExtension)\nimport NetworkExtension\n#endif\n' + source.slice(start, end));
  run('xcrun', ['swiftc', '-parse-as-library', '-swift-version', '5', 'modules/freed-protection/ios/FreedProtectionConfigurationLock.swift', input,
    'modules/freed-protection/tests/EncryptedDnsCases.swift', '-o', executable]);
  run(executable, []);

  // The reset policy has its own actual-method runner and dependencies.
  // Allow the iOS-only native compiler reservation to stay within its scope.
  if (!process.argv.includes('--ios-only')) {
  const kotlinRoot = 'modules/freed-protection/android/src/main/java/app/freed/protection/';
  const jar = join(workspace, 'encrypted-dns-android-cases.jar');
  run('kotlinc', ['FreedDnsGuardPolicy.kt', 'FreedDnsPacketPolicy.kt', 'FreedEncryptedDnsPolicy.kt', 'FreedDohPolicy.kt', 'FreedProtectedSocketFactory.kt']
    .map((file) => kotlinRoot + file).concat([
      'modules/freed-protection/android/src/test/java/app/freed/protection/FreedEncryptedDnsCases.kt',
      'modules/freed-protection/android/src/test/java/app/freed/protection/FreedIpv6DnsPacketCases.kt',
      'modules/freed-protection/android/src/test/java/app/freed/protection/FreedDnsGuardPolicyCases.kt',
      '-include-runtime', '-d', jar
    ]));
  run('java', ['-cp', jar, 'app.freed.protection.FreedEncryptedDnsCasesKt']);
  run('java', ['-cp', jar, 'app.freed.protection.FreedIpv6DnsPacketCasesKt']);
  run('java', ['-cp', jar, 'app.freed.protection.FreedDnsGuardPolicyCasesKt']);
  }
} finally {
  rmSync(workspace, { recursive: true, force: true });
}
