const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { spawnSync } = require('node:child_process');
const { test } = require('node:test');
const vm = require('node:vm');
const esbuild = require('esbuild');

const bundle = esbuild.buildSync({ entryPoints: ['src/lib/protection-readiness.ts'],
  bundle: true, platform: 'node', format: 'cjs', write: false, logLevel: 'silent' }).outputFiles[0].text;
const sandbox = { module: { exports: {} }, process: { env: {} } };
vm.runInNewContext(bundle, sandbox);
const capability = { platform: 'android', accessibility: true, dnsFiltering: true,
  usageStats: true, localVpnFallback: true, screenTime: false, managedSettings: false };
const ready = { active: true, authorized: true, mode: 'dns', adultFilterActive: true,
  dnsGuardRuntimeReady: true, dnsGuardCaptivePaused: false,
  appInterventionAuthorized: true, usageStatsAuthorized: true,
  blockedApplications: 1, adultDomainFeedDomainCount: 10, adultDomainFeedVersion: 'reviewed-fixture' };
function readiness(extra) {
  return sandbox.module.exports.getProtectionSetupReadiness(capability, { ...ready, ...extra }, 1);
}

test('captive sign-in pauses adult filtering readiness and sign-in completion restores it', () => {
  const paused = readiness({ dnsGuardCaptivePaused: true });
  assert.equal(paused.adultFilterActive, false);
  assert.equal(paused.activationReady, false);
  assert.equal(paused.appInterventionReady, true);
  const resumed = readiness({ dnsGuardCaptivePaused: false, dnsGuardCoverageReady: true, privateDnsMode: 'off' });
  assert.equal(resumed.adultFilterActive, true);
  assert.equal(resumed.activationReady, true);
});

test('strict, opportunistic, and unknown DNS privacy cannot be advertised as active DNS filtering', () => {
  for (const privacy of [
    { privateDnsMode: 'hostname' }, { privateDnsMode: 'opportunistic' },
    { privateDnsMode: 'unknown' }, { privateDnsActive: true }, { dnsGuardCoverageReady: false }
  ]) {
    const state = readiness(privacy);
    assert.equal(state.adultFilterActive, false);
    assert.equal(state.activationReady, false);
    assert.equal(state.appInterventionReady, true);
  }
});

test('DNS-only VPN preserves ordinary IPv6 and routes current resolver addresses by family', () => {
  const manifest = readFileSync('modules/freed-protection/android/src/main/AndroidManifest.xml', 'utf8');
  assert.match(manifest, /android:name="android\.net\.VpnService\.SUPPORTS_ALWAYS_ON"\s+android:value="false"/);
  const service = readFileSync('modules/freed-protection/android/src/main/java/app/freed/protection/FreedVpnService.kt', 'utf8');
  const packetPolicy = readFileSync('modules/freed-protection/android/src/main/java/app/freed/protection/FreedDnsPacketPolicy.kt', 'utf8');
  assert.match(service, /\.allowFamily\(OsConstants\.AF_INET6\)/);
  assert.match(service, /captureCurrentNetworkResolverSnapshot\(\)/);
  assert.match(service, /manager\.getLinkProperties\(target\)\?\.dnsServers/);
  assert.match(service, /builder\.addRoute\(route\.address, route\.prefixLength\)/);
  assert.match(service, /FreedDnsPacketPolicy\.inspectIpv6\(packet, readLength\)/);
  assert.match(service, /dnsPacketHealth\.recordIpv6\(generation, inspected\)/);
  assert.match(service, /buildIcmpv6AdminProhibited/);
  assert.doesNotMatch(service, /addRoute\("(?:0\.0\.0\.0|::)",\s*0\)/);
  assert.match(packetPolicy, /raw\.size == 4\) 32 else 128/);
  assert.match(packetPolicy, /buildUdpResponse/);
  assert.match(packetPolicy, /MAX_EXTENSION_HEADERS/);
});

test('a deferred Safari shield does not cover an allowed route after pre-ready navigation', () => {
  const run = spawnSync(process.execPath,
    ['tests/fixtures/reproduce-safari-stale-route.cjs'],
    { encoding: 'utf8', timeout: 5000 });
  assert.equal(run.status, 0, run.stdout + run.stderr);
  assert.match(run.stdout, /Safari controlled pre-DOM navigation, pending native approval and reset guards passed/);
});


test('proven unsupported IPv6 DNS lowers coverage while service and app protection stay separate', () => {
  const degraded = readiness({ dnsGuardRuntimeReady: true, dnsGuardCoverageReady: false,
    dnsGuardCoverageIssueCode: 'android-ipv6-dns-format-unsupported', privateDnsMode: 'off' });
  assert.equal(degraded.adultFilterActive, false);
  assert.equal(degraded.activationReady, false);
  assert.equal(degraded.appInterventionReady, true);
  const source = readFileSync('modules/freed-protection/android/src/main/java/app/freed/protection/FreedProtectionModule.kt', 'utf8');
  const calls = [...source.matchAll(/FreedDnsGuardPolicy\.(?:filteringActive|issueCode)\([\s\S]*?\n\s*\)/g)];
  assert.equal(calls.length, 6);
  for (const [call] of calls) assert.match(call, /FreedVpnService\.dnsGuardIpv6UnsupportedPackets\.get\(\)/);
  for (const field of ['dnsGuardIpv6MalformedPackets', 'dnsGuardIpv6UnsupportedPackets',
    'dnsGuardIpv4ResolverRouteCount', 'dnsGuardIpv6ResolverRouteCount']) {
    assert.ok(source.includes(`enriched["${field}"]`) && source.includes(`payload["${field}"]`), field);
  }
});

test('actual service snapshot and rebuild methods preserve generation-bound coverage evidence', () => {
  const run = spawnSync(process.execPath, ['modules/freed-protection/tests/run-dualstack-dns-service-tests.js'],
    { encoding: 'utf8', timeout: 60000 });
  assert.equal(run.status, 0, run.error?.message || run.stdout + run.stderr);
  assert.match(run.stdout, /Actual dual-stack service snapshot/);
});
