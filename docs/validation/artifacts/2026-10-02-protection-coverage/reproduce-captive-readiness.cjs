// Read-only characterization of the readiness contract, with all permissions
// already granted and the native DNS guard intentionally paused for sign-in.
const esbuild = require('esbuild');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const bundle = esbuild.buildSync({ entryPoints: ['src/lib/protection-readiness.ts'],
  bundle: true, platform: 'node', format: 'cjs', write: false, logLevel: 'silent' }).outputFiles[0].text;
const sandbox = { module: { exports: {} }, process: { env: {} } };
vm.runInNewContext(bundle, sandbox);
const capability = { platform: 'android', accessibility: true, dnsFiltering: true,
  usageStats: true, localVpnFallback: true, screenTime: false, managedSettings: false };
const status = { active: true, authorized: true, mode: 'dns', adultFilterActive: true,
  dnsGuardRuntimeReady: true, dnsGuardCaptivePaused: true,
  appInterventionAuthorized: true, usageStatsAuthorized: true,
  blockedApplications: 1, adultDomainFeedDomainCount: 10, adultDomainFeedVersion: 'reviewed-fixture' };
const result = sandbox.module.exports.getProtectionSetupReadiness(capability, status, 1);
console.log(JSON.stringify({ captivePaused: status.dnsGuardCaptivePaused,
  adultFilterActive: result.adultFilterActive, activationReady: result.activationReady }, null, 2));
assert.equal(result.adultFilterActive, false, 'a paused DNS classifier must not report an active adult filter');
