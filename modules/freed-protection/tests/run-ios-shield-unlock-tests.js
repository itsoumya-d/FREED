const assert = require('node:assert/strict');
const { mkdtempSync, readFileSync, writeFileSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { resolve, join } = require('node:path');
const { spawnSync } = require('node:child_process');
const root = resolve(__dirname, '../../..');
const workspace = mkdtempSync(join(tmpdir(), 'freed-shield-unlock-'));
function run(command, args) {
  const result = spawnSync(command, args, { cwd: root, encoding: 'utf8', timeout: 60_000 });
  assert.equal(result.status, 0, `${command}: ${result.error?.message || ''}${result.stdout}${result.stderr}`);
  process.stdout.write(result.stdout);
}
function block(source, marker) {
  const start = source.indexOf(marker);
  assert.ok(start >= 0, marker);
  const open = source.indexOf('{', start);
  let depth = 1, end = open + 1;
  // Selected blocks contain no unbalanced braces in strings or comments.
  for (; depth && end < source.length; end++) {
    if (source[end] === '{') depth++;
    if (source[end] === '}') depth--;
  }
  return source.slice(start, end);
}
try {
  const shield = readFileSync(join(root, 'ios/FREEDShieldAction/ShieldActionExtension.swift'), 'utf8')
    .replace('import ManagedSettings', '').replace('import UserNotifications', '')
    .replaceAll('private ', '')
    .replaceAll('UserDefaults', 'ShieldDefaults')
    .replaceAll('JSONEncoder()', 'ShieldEncoder()')
    .replaceAll('#available(iOS 26.5, *)', 'ShieldRuntime.canOpenApp');
  const moduleSource = readFileSync(join(root, 'modules/freed-protection/ios/FreedProtectionModule.swift'), 'utf8');
  const grant = block(moduleSource, '    AsyncFunction("applyEarnedUnlockWindow")');
  const grantBody = grant.slice(grant.indexOf('      return self.withProtectionConfigurationAccess'), grant.lastIndexOf('}'));
  const methods = ['invalidateActiveEarnedUnlockLease', 'clearEarnedUnlockState', 'clearActiveEarnedUnlockState', 'activeEarnedUnlockExpiresAt',
    'isEarnedUnlockActive', 'refreshEarnedUnlockWindow', 'boundedEarnedUnlockExpiry', 'formatIsoDate', 'parseIsoDate',
    'consumePendingEarnedUnlockEnvelope', 'pendingEarnedUnlockEnvelope', 'activeEarnedUnlockScope', 'scopeStored',
    'earnedUnlockMessage', 'sanitizedPendingInterventionId', 'isScreenTimeUnlockSource', 'sanitizeHostForStorage', 'isValidHostLabel',
    'withProtectionConfigurationAccess', 'removePendingShieldInterventionNotifications',
    'pendingInterventionRecord', 'claimPendingIntervention', 'isFreshPendingIntervention',
    'markPendingInterventionConsumed', 'isPendingInterventionConsumed', 'pendingInterventionConsumedIds'];
  const harness = `final class UnlockHarness {\n`
    + ['InterventionScope', 'PendingEarnedUnlockEnvelope', 'PendingInterventionRecord', 'EarnedUnlockMonitoringSnapshot'].map(name => block(moduleSource, `  private struct ${name}`)).join('\n')
    + `\nfunc apply(_ expiresAt: String, _ sourceAttemptHost: String?, _ expectedInterventionId: String?) -> [String: Any] {\n${grantBody}\n}\n`
    + methods.map(name => block(moduleSource, `  private func ${name}(`)).join('\n')
    + '\n' + readFileSync(join(__dirname, 'ShieldUnlockHarnessMembers.swift'), 'utf8') + '\n}';
  const input = join(workspace, 'ProductionMethods.swift');
  writeFileSync(input, 'final class FreedAppGroupsRuntime { static let shared = FreedAppGroupsRuntime(); var v2Active=false; func hasActiveEarnedTimeBreak<Defaults>(_ defaults: Defaults) -> Bool { v2Active }; func issueScope(for token: ApplicationToken, _ defaults: ShieldDefaults) -> [String: Any]? { nil }; func stageClaim<Defaults>(id: String, scope: [String: Any], _ defaults: Defaults) -> Bool { false } }\n' + shield + '\n' + harness.replaceAll('private ', '').replaceAll('#if canImport(UserNotifications)', '#if true'));
  const executable = join(workspace, 'cases');
  run('xcrun', ['swiftc', '-parse-as-library', '-swift-version', '5', input,
    'modules/freed-protection/tests/ShieldUnlockCases.swift', '-o', executable]);
  run(executable, []);
  const helperInput = join(workspace, 'PersistenceBoundaryLock.swift');
  writeFileSync(helperInput, readFileSync(join(root, 'modules/freed-protection/ios/FreedProtectionConfigurationLock.swift'), 'utf8')
);
  const helperExecutable = join(workspace, 'shared-lock-persistence-cases');
  run('xcrun', ['swiftc', '-parse-as-library', '-swift-version', '5', helperInput,
    'modules/freed-protection/tests/SharedLockPersistenceCases.swift', '-o', helperExecutable]);
  run(helperExecutable, []);
  const sdk = spawnSync('xcrun', ['--sdk', 'iphoneos', '--show-sdk-path'], { encoding: 'utf8' }).stdout.trim();
  const cleanupInput = join(workspace, 'ResetNotificationCleanup.swift');
  writeFileSync(cleanupInput, 'import Foundation\nimport UserNotifications\nfinal class ResetNotificationCleanup {\n'
    + block(moduleSource, '  private func removePendingShieldInterventionNotifications(') + '\n}');
  run('xcrun', ['swiftc', '-typecheck', '-sdk', sdk, '-target', 'arm64-apple-ios15.1',
    'ios/FREEDShieldAction/ShieldActionExtension.swift', 'modules/freed-protection/ios/FreedAppGroupsPolicy.swift','modules/freed-protection/ios/FreedEarnedAppTimePolicy.swift','modules/freed-protection/ios/FreedChallengeEvidencePolicy.swift','modules/freed-protection/ios/FreedChallengeStepObserver.swift','modules/freed-protection/ios/FreedEarnedAppTimeTrustedClock.swift', 'modules/freed-protection/ios/FreedAppGroupsRuntime.swift', 'modules/freed-protection/ios/FreedProtectionConfigurationLock.swift', cleanupInput]);
  run('xcrun', ['swiftc', '-frontend', '-parse', 'modules/freed-protection/ios/FreedProtectionModule.swift']);
} finally { rmSync(workspace, { recursive: true, force: true }); }
