import assert from 'node:assert/strict';
import {recoveryDnsAvailability,recoveryDnsAudienceResolution} from '../src/lib/recovery-dns-availability';
import {unavailableRecoveryDns,parseRecoveryDnsPilotReceipt} from '../modules/freed-protection/src/recovery-dns-pilot';
for(const reason of ['recovery-dns-unavailable','recovery-dns-malformed-receipt','recovery-dns-busy']){
 const receipt=unavailableRecoveryDns(reason);assert.equal(recoveryDnsAvailability(receipt),'pending');assert.equal(recoveryDnsAudienceResolution(receipt).resolved,false);
}
for(const reason of ['recovery-dns-pilot-build-gated','recovery-dns-internal-build-required','recovery-dns-native-method-unavailable']){
 const receipt=unavailableRecoveryDns(reason);assert.equal(recoveryDnsAvailability(receipt),'legacy');assert.deepEqual(recoveryDnsAudienceResolution(receipt),{resolved:true,audience:null});
}
const empty=parseRecoveryDnsPilotReceipt({schema:1,kind:'status',supported:true,staged:false,modeActivationSupported:true});
assert.equal(recoveryDnsAvailability(empty),'pilot');assert.deepEqual(recoveryDnsAudienceResolution(empty),{resolved:true,audience:null});
const current={...empty,staged:true,audience:'c'.repeat(32)};assert.equal(recoveryDnsAudienceResolution(current).audience,current.audience);
console.log('PASS: transient reads preserve protection and initial notification; absent pilot preserves reminder entry');
