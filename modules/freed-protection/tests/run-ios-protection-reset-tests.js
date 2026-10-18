const evidence=process.argv.find(x=>x.startsWith("--evidence-dir="))?.slice(15);
const fs = require('node:fs'), path = require('node:path');
const assert = require('node:assert/strict');
const { mkdtempSync, readFileSync, writeFileSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { resolve, join } = require('node:path');
const { spawnSync } = require('node:child_process');

// Uses a fresh test-only preferences domain. No account calls, device installs,
// simulator state, production app preferences, or shared test runners are used.
const root = resolve(__dirname, '../../..');
const workspace = mkdtempSync(join(tmpdir(), 'freed-ios-reset-tests-'));
function run(command, args) {
  const result = spawnSync(command, args, { cwd: root, encoding: 'utf8', timeout: 60_000 });
  assert.equal(result.status, 0, `${command} failed:\n${result.error?.message || ''}${result.stdout}${result.stderr}`);
  if (result.stdout.trim()) process.stdout.write(result.stdout);
}


// Legacy controller cases intentionally use an explicitly empty protected-byte
// fixture. The extracted gate and Package A record reader are actual source;
// enrolled/corrupt/unavailable gate cases remain Task71/72 evidence.
const fixtureCoreSources = ['modules/freed-protection/ios/FreedFriendLockCore.swift', 'modules/freed-protection/ios/FreedFriendLockRecordStore.swift'];
const sdkAdultSources = [...fixtureCoreSources, 'modules/freed-protection/ios/FreedRetainedAdultProtection.swift', 'modules/freed-protection/ios/FreedAdultProtectionLockCoordinator.swift', 'modules/freed-protection/ios/FreedAdultProtectionOperationStore.swift', 'modules/freed-protection/ios/FreedNativeAdultMutationAdapter.swift', 'modules/freed-protection/ios/FreedFriendLockKeychain.swift'];
function legacyAdultFixture(directory, defaultsType = 'UserDefaults') {
  const host = fs.readFileSync('modules/freed-protection/ios/FreedAdultProtectionLockCoordinator.swift', 'utf8');
  let gate = host.slice(host.indexOf('enum FreedAdultLockIntegrationFailure'), host.indexOf('private enum FreedAdultExecutor'));
  gate = gate.replace('static var fixtureStore: FriendLockRecordStore?', 'static var fixtureStore: FriendLockRecordStore? = FriendLockRecordStore(bytes: LegacyUnenrolledBytes())');
  const seam = path.join(directory, 'LegacyAdultFixture.swift');
  fs.writeFileSync(seam, `import Foundation
final class LegacyUnenrolledBytes: FriendLockProtectedBytes {
  func read(_ key: String) throws -> Data? { nil }
  func write(_ key: String, _ data: Data) throws { throw FriendLockFailure.storageUnavailable }
  func remove(_ key: String) throws { throw FriendLockFailure.storageUnavailable }
}
enum FreedAdultProtectionNativeObservation {
  // Explicit known native fixture baseline: no filter or risk schedule installed.
  static func capture(_ defaults: ${defaultsType}) throws -> FreedRetainedAdultProtection.Policy {
    FreedRetainedAdultProtection.Policy(continuous: false, encryptedDNS: false, safari: false, riskEnabled: false)
  }
}
${gate}`);
  const retained = path.join(directory, 'RetainedAdultFixture.swift');
  fs.writeFileSync(retained, fs.readFileSync('modules/freed-protection/ios/FreedRetainedAdultProtection.swift', 'utf8').replaceAll('UserDefaults', defaultsType));
  return [...fixtureCoreSources, retained, seam];
}
try {
  const modulePath = 'modules/freed-protection/ios/FreedProtectionModule.swift';
  const source = readFileSync(join(root, modulePath), 'utf8');
  const start = source.indexOf('// MARK: - Protection configuration reset policy');
  const end = source.indexOf('// MARK: - Existing protection layers', start);
  assert.ok(start >= 0 && end > start, 'A strict native reset policy is required.');
  const fixtureSources = legacyAdultFixture(workspace);
  const input = join(workspace, 'ProtectionResetPolicy.swift');
  const executable = join(workspace, 'ios-protection-reset-cases');
  writeFileSync(input, 'import Foundation\n' + source.slice(start, end));
  run('xcrun', ['swiftc', '-parse-as-library', '-swift-version', '5', '-D', 'FREED_NATIVE_FIXTURES', ...fixtureSources, 'modules/freed-protection/ios/FreedProtectionConfigurationLock.swift', input,
    'modules/freed-protection/tests/ProtectionResetCases.swift', '-o', executable]);
  run(executable, []);
  const interleavingExecutable = join(workspace, 'ios-reset-interleaving-cases');
  run('xcrun', ['swiftc', '-parse-as-library', '-swift-version', '5', '-D', 'FREED_NATIVE_FIXTURES', ...fixtureSources, 'modules/freed-protection/ios/FreedProtectionConfigurationLock.swift', input,
    'modules/freed-protection/tests/ProtectionResetInterleavingCases.swift', '-o', interleavingExecutable]);
  run(interleavingExecutable, []);
  const focusSource = readFileSync(join(root, 'ios/FREEDSafariFocusShield/SafariWebExtensionHandler.swift'), 'utf8');
  const focusInput = join(workspace, 'FocusResetNativeHandler.swift');
  const focusDomain = `app.freed.tests.focus-reset.${process.pid}.${Date.now()}`;
  writeFileSync(focusInput, `import Foundation\nlet freedFocusTestDomain = "${focusDomain}"\nlet freedFocusTestContainer = URL(fileURLWithPath: "${workspace}")\n` + focusSource
    .replace('import SafariServices', '')
    .replace('"group.app.freed.recovery"', 'freedFocusTestDomain')
    .replaceAll('sharedDefaults()', 'sharedDefaults(containerOverride: freedFocusTestContainer, domain: freedFocusTestDomain)')
    .replaceAll('withExclusiveAccess {', 'withExclusiveAccess(containerOverride: freedFocusTestContainer, domain: freedFocusTestDomain) {'));
  const focusExecutable = join(workspace, 'focus-reset-native-cases');
  run('xcrun', ['swiftc', '-parse-as-library', '-swift-version', '5', focusInput,
    'modules/freed-protection/ios/FreedProtectionConfigurationLock.swift',
    'modules/freed-protection/tests/FocusResetNativeCases.swift', '-o', focusExecutable]);
  run(focusExecutable, []);
  const inertExecutable = join(workspace, 'inert-safari-rule-cases');
  run('xcrun', ['swiftc', '-parse-as-library', '-swift-version', '5', '-D', 'FREED_NATIVE_FIXTURES', ...fixtureSources, 'modules/freed-protection/ios/FreedProtectionConfigurationLock.swift', input,
    'modules/freed-protection/tests/InertSafariRuleCases.swift', '-o', inertExecutable]);
  run(inertExecutable, []);
  run('node', ['--test', 'modules/freed-protection/tests/ios-focus-reset.test.js']);
  run('xcrun', ['swiftc', '-frontend', '-parse', modulePath]);
  for (const file of ['ios/FREEDDeviceActivityMonitor/DeviceActivityMonitorExtension.swift',
    'ios/FREEDShieldAction/ShieldActionExtension.swift',
    'ios/FREEDSafariContentBlocker/ContentBlockerRequestHandler.swift',
    'ios/FREEDSafariFocusShield/SafariWebExtensionHandler.swift']) {
    run('xcrun', ['swiftc', '-frontend', '-parse', file]);
  }
} finally {
  if(evidence){fs.mkdirSync(evidence,{recursive:true});fs.cpSync(workspace,path.join(evidence,"fixture-artifacts"),{recursive:true});}
  rmSync(workspace, { recursive: true, force: true });
}
