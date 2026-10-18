const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { spawnSync } = require('node:child_process');

const digest = (value) => createHash('sha256').update(value).digest('hex');
function swiftInterface(sdk, framework) {
  const directory = path.join('System/Library/Frameworks', `${framework}.framework/Modules`, `${framework}.swiftmodule`);
  try {
    const files = fs.readdirSync(path.join(sdk, directory)).filter((name) => /^arm64e?-apple-ios\.swiftinterface$/.test(name)).sort();
    return files.length ? path.join(directory, files[0]) : null;
  } catch { return null; }
}
function inspect(base, relativePath, id, required, select) {
  if (!relativePath) return { id, status: 'unavailable', reason: 'No installed iPhoneOS Swift interface found.' };
  try {
    const absolute = path.join(base, relativePath);
    if (fs.statSync(absolute).size > 2_000_000) return { id, status: 'unavailable', reason: 'Declaration file exceeds bounded read size.' };
    const contents = fs.readFileSync(absolute, 'utf8');
    return {
      id, path: relativePath, sha256: digest(contents),
      status: required.every((pattern) => pattern.test(contents)) ? 'observed-declarations' : 'incomplete',
      excerpts: contents.split('\n').flatMap((line, index, lines) => select.test(line) ? [{ line: index + 1, text: lines.slice(Math.max(0, index - 1), index + 2).join('\n') }] : []).slice(0, 32)
    };
  } catch { return { id, path: relativePath, status: 'unavailable', reason: 'Declaration file cannot be read.' }; }
}

/** Reads declarations only. The absence of a callback here is not proof about every possible API. */
function probeInstalledSdk(sdk) {
  const declarations = [
    inspect(sdk, 'System/Library/Frameworks/NetworkExtension.framework/Headers/NEDNSSettingsManager.h', 'dns-settings',
      [/loadFromPreferencesWithCompletionHandler/, /saveToPreferencesWithCompletionHandler/, /removeFromPreferencesWithCompletionHandler/, /NEDNSSettingsConfigurationDidChangeNotification/],
      /NEDNSSettingsConfigurationDidChangeNotification|^[-+] \(|@property/),
    inspect(sdk, 'System/Library/Frameworks/NetworkExtension.framework/Headers/NEURLFilter.h', 'url-filter-participation',
      [/verdictForURL:/, /completionHandler:/], /verdictForURL|completionHandler/),
    inspect(sdk, swiftInterface(sdk, 'NetworkExtension'), 'url-filter-provider-and-manager',
      [/public protocol NEURLFilterControlProvider/, /fetchPrefilter\(/, /public class NEURLFilterManager/, /pirServerURL/, /pirPrivacyPassIssuerURL/, /handleStatusChange\(/],
      /NEURLFilterControlProvider|func (start|stop|fetchPrefilter)|NEURLFilterManager :|pirServerURL|pirPrivacyPassIssuerURL|handleStatusChange|handleConfigChange/),
    inspect(sdk, swiftInterface(sdk, 'ManagedSettings'), 'shield-app-open',
      [/public enum ShieldActionResponse/, /@available\(iOS 26\.5, \*\)/, /case openParentalControlsApp/],
      /@available\(iOS 26\.5, \*\)|case openParentalControlsApp|open func handle\(action: ManagedSettings.ShieldAction/)
  ];
  const unavailable = declarations.filter((entry) => entry.status === 'unavailable').map((entry) => entry.id);
  return {
    schemaVersion: 2, recoveryContractVersion: 2, capturedAt: new Date().toISOString(), sdkName: path.basename(sdk),
    status: unavailable.length ? 'unavailable' : declarations.every((entry) => entry.status === 'observed-declarations') ? 'observed-declarations' : 'incomplete',
    declarations, unavailable, nativeCompilation: 'unexecuted', deviceExecution: 'unexecuted', universalAutomaticEntry: 'not-established', universalRecoveryEntry: 'not-established',
    scope: 'Installed SDK declaration evidence only; preferences/status callbacks and caller-requested verdicts establish neither covered-attempt foreground recovery nor every-browser automatic-or-one-action entry. A shield declaration does not prove its action opens FREED on a device.'
  };
}

function probeNativeAdapters(repo) {
  return [
    ['modules/freed-protection/ios/FreedProtectionModule.swift', /NEDNSSettingsManager\.shared|saveToPreferences|loadFromPreferences/],
    ['ios/FREEDShieldAction/ShieldActionExtension.swift', /case \.primaryButtonPressed|#available\(iOS 26\.5|openParentalControlsApp|pendingInterventionNotification/],
    ['modules/freed-protection/android/src/main/java/app/freed/protection/FreedVpnService.kt', /PendingIntent\.getActivity|Notification\.VISIBILITY_PRIVATE|setContentIntent|notify\(INTERVENTION_NOTIFICATION_ID/],
    ['modules/freed-protection/android/src/main/java/app/freed/protection/FreedAccessibilityService.kt', /runCatching \{ startActivity\(intent\)|showAccessibilityInterventionNotification/]
  ].map(([relativePath, select]) => inspect(repo, relativePath, relativePath, [select], select));
}

if (require.main === module) {
  const lookup = spawnSync('xcrun', ['--sdk', 'iphoneos', '--show-sdk-path'], { encoding: 'utf8', timeout: 10_000, maxBuffer: 32_768 });
  const report = lookup.status === 0 && lookup.stdout.trim()
    ? { ...probeInstalledSdk(lookup.stdout.trim()), sourceAdapters: probeNativeAdapters(path.resolve(__dirname, '..')) }
    : { schemaVersion: 2, recoveryContractVersion: 2, status: 'unavailable', reason: 'Existing iPhoneOS SDK lookup failed; no installation attempted.', nativeCompilation: 'unexecuted', deviceExecution: 'unexecuted', universalAutomaticEntry: 'not-established', universalRecoveryEntry: 'not-established' };
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  process.exitCode = report.status === 'observed-declarations' ? 0 : 1;
}
module.exports = { probeInstalledSdk };
