const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { probeInstalledSdk } = require('../scripts/interception-api-probe');

test('a missing installed SDK cannot produce successful API-declaration evidence', () => {
  const result = probeInstalledSdk('/path/that/does/not/exist');
  assert.equal(result.status, 'unavailable');
  assert.ok(result.unavailable.length > 0);
  assert.equal(result.deviceExecution, 'unexecuted');
});

test('readable but incomplete declarations cannot be reported as a successful probe', () => {
  const sdk = fs.mkdtempSync(path.join(os.tmpdir(), 'freed-api-probe-'));
  try {
    const header = path.join(sdk, 'System/Library/Frameworks/NetworkExtension.framework/Headers/NEDNSSettingsManager.h');
    fs.mkdirSync(path.dirname(header), { recursive: true }); fs.writeFileSync(header, '@interface NEDNSSettingsManager : NSObject\n@end\n');
    const result = probeInstalledSdk(sdk);
    assert.notEqual(result.status, 'observed-declarations');
    assert.equal(result.declarations[0].status, 'incomplete');
    assert.equal(result.universalAutomaticEntry, 'not-established');
    assert.equal(result.universalRecoveryEntry, 'not-established');
    assert.equal(result.recoveryContractVersion, 2);
  } finally { fs.rmSync(sdk, { recursive: true, force: true }); }
});

test('available matching SDK declarations produce hashed excerpts while device execution stays unexecuted', () => {
  const sdk = fs.mkdtempSync(path.join(os.tmpdir(), 'freed-api-probe-'));
  const files = {
    'NetworkExtension.framework/Headers/NEDNSSettingsManager.h': 'loadFromPreferencesWithCompletionHandler saveToPreferencesWithCompletionHandler removeFromPreferencesWithCompletionHandler NEDNSSettingsConfigurationDidChangeNotification',
    'NetworkExtension.framework/Headers/NEURLFilter.h': '+ (void)verdictForURL:(NSURL *)url\n completionHandler:(void (^)(int result))completionHandler;',
    'NetworkExtension.framework/Modules/NetworkExtension.swiftmodule/arm64e-apple-ios.swiftinterface': 'public protocol NEURLFilterControlProvider {\nfunc fetchPrefilter()\n}\npublic class NEURLFilterManager {\npirServerURL\npirPrivacyPassIssuerURL\nfunc handleStatusChange()\n}',
    'ManagedSettings.framework/Modules/ManagedSettings.swiftmodule/arm64e-apple-ios.swiftinterface': 'public enum ShieldActionResponse {\n@available(iOS 26.5, *)\ncase openParentalControlsApp\n}'
  };
  try {
    for (const [relative, content] of Object.entries(files)) {
      const target = path.join(sdk, 'System/Library/Frameworks', relative);
      fs.mkdirSync(path.dirname(target), { recursive: true }); fs.writeFileSync(target, content);
    }
    const result = probeInstalledSdk(sdk);
    assert.equal(result.status, 'observed-declarations');
    assert.equal(result.declarations.length, 4);
    assert.ok(result.declarations.every((entry) => /^[a-f0-9]{64}$/.test(entry.sha256) && entry.excerpts.length > 0));
    assert.equal(result.deviceExecution, 'unexecuted');
    assert.equal(result.nativeCompilation, 'unexecuted');
    assert.equal(result.universalAutomaticEntry, 'not-established');
    assert.equal(result.universalRecoveryEntry, 'not-established');
    assert.equal(result.recoveryContractVersion, 2);
  } finally { fs.rmSync(sdk, { recursive: true, force: true }); }
});
