const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createRequire } = require('node:module');

// Evaluate the real report functions, excluding only the CLI's invocation.
// These fixtures test acceptance gates; they are not signed-binary evidence.
const script = path.resolve('scripts/build-ios-release-archive.js');
const source = fs.readFileSync(script, 'utf8');
const mainStart = source.lastIndexOf('\nmain().catch(');
assert.ok(mainStart > 0);
const context = { require: createRequire(script), __dirname: path.dirname(script), process, console, Buffer, module: { exports: {} } };
vm.runInNewContext(source.slice(0, mainStart) + '\nmodule.exports = { buildReport, entitlementsString, EXPECTED_EXTENSIONS };', context, { filename: script });
const { buildReport, entitlementsString, EXPECTED_EXTENSIONS } = context.module.exports;
const bundle = 'app.freed.recovery';
const all = [bundle, ...EXPECTED_EXTENSIONS.map(e => e.bundleId)];
const archive = {
  appBundleIdentifier: bundle, appAttestEnvironment: 'production',
  appGroupEntitledBundleIds: all, appleDistributionSignedBundleIds: all,
  completeDataProtectionEntitledBundleIds: all, debugSignedBundleIds: [],
  familyControlsEntitledBundleIds: all, embeddedExtensionBundleIds: all.slice(1),
  embeddedExtensionNames: EXPECTED_EXTENSIONS.map(e => e.bundleName),
  missingOrMismatchedExtensions: [], signedBundleTeamIds: ['R5RX8WP8ZC'],
  packetInspectionEntitled: false, packetTunnelProviderEntitled: false,
  safariRuleList: { usableForManualEvidence: true },
  safariFocusShield: { usableForManualEvidence: true }
};
const options = { bundleId: bundle, teamId: 'R5RX8WP8ZC', codeSignStyle: 'Manual', logPath: path.resolve('ios/build/fixture.log') };
const ipa = { exists: true, hasPayloadApp: true, embeddedExtensionNames: archive.embeddedExtensionNames };
function report(value) {
  return buildReport(options, { generated: true, path: path.resolve('ios/build/fixture.plist'), provisioningProfileBundleIds: [] }, value, ipa, {});
}

test('a production App Attest app environment retains the other release gates', () => {
  assert.equal(report(archive).summary.failCount, 0);
  assert.equal(report({ ...archive, packetTunnelProviderEntitled: true }).results.find(e => e.id === 'ios-release-entitlements').status, 'FAIL');
});

test('missing, sandbox/development and profile-style App Attest environments cannot pass release acceptance', () => {
  for (const environment of [undefined, '', 'development', ['development', 'production']]) {
    const result = report({ ...archive, appAttestEnvironment: environment });
    assert.equal(result.results.find(e => e.id === 'ios-release-entitlements').status, 'FAIL', `Reject ${JSON.stringify(environment)}`);
  }
});

test('signed entitlement parsing requires the app scalar, not the provisioning profile allowance', () => {
  const key = 'com.apple.developer.devicecheck.appattest-environment';
  assert.equal(entitlementsString(`<key>${key}</key><string>production</string>`, key), 'production');
  assert.notEqual(entitlementsString(`<key>${key}</key><array><string>development</string><string>production</string></array>`, key), 'production');
});
