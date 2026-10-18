import assert from 'node:assert/strict';
import { isDnsGuardFiltering, dnsGuardCoverageMessage } from '../src/lib/dns-guard-health';

const active = { runtimeReady: true, adultFilterActive: true, dnsGuardCoverageReady: true, dnsGuardCaptivePaused: false };
assert.equal(isDnsGuardFiltering(active), true);
// A healthy service bit cannot mask a known rejected IPv6 DNS path.
assert.equal(isDnsGuardFiltering({ ...active, dnsGuardCoverageIssueCode: 'android-ipv6-dns-format-unsupported' }), false);
assert.equal(isDnsGuardFiltering({ ...active, dnsGuardIpv6UnsupportedPackets: 1 }), false);
assert.equal(isDnsGuardFiltering({ ...active, dnsGuardIpv6UnsupportedPackets: 0, dnsGuardIpv6MalformedPackets: 8 }), true);
assert.equal(isDnsGuardFiltering({ ...active, dnsGuardCoverageIssueCode: '' }), true);
assert.equal(dnsGuardCoverageMessage('android-ipv6-dns-format-unsupported'), dnsGuardCoverageMessage(undefined));
for (const update of [
  { runtimeReady: false }, { adultFilterActive: false }, { dnsGuardCoverageReady: false },
  { dnsGuardCaptivePaused: true }, { dnsGuardCoverageReady: undefined }
]) assert.equal(isDnsGuardFiltering({ ...active, ...update }), false);
assert.equal(isDnsGuardFiltering({ runtimeReady: true }), false);
assert.match(dnsGuardCoverageMessage('android-private-dns-encrypted-unsupported'), /cannot inspect/);
assert.doesNotMatch(dnsGuardCoverageMessage('android-private-dns-encrypted-unsupported'), /automatic/);
assert.match(dnsGuardCoverageMessage('android-dns-guard-captive-paused'), /paused/);
assert.match(dnsGuardCoverageMessage('android-private-dns-state-unknown'), /inactive/);
console.log('DNS guard health tests passed');
