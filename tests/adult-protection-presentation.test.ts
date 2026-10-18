import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getAdultProtectionPresentation, isAdultConfigurationReadbackCurrent } from '../src/lib/adult-protection-presentation';
const dns={supported:true,releaseEnabled:true,configured:true,enabled:true,healthy:true,reason:null,provider:'cloudflare-families',requiresSettings:false};
const input={platform:'ios' as const,nativeSupported:true,authorized:true,policyConfigured:true,dnsStatus:dns,configurationCheckedAt:100};
const observations={readbackAt:100,enablement:'observed-current' as const,routing:'observed-current' as const,adultBrowsing:'observed-blocked' as const,ordinaryBrowsing:'observed-allowed' as const};
test('saved policy, OS enablement and resolver health do not supply browsing observations',()=>{
 const actual=getAdultProtectionPresentation(input);assert.equal(actual.verified,false);assert.equal(actual.tone,'attention');assert.equal(actual.status,'Needs attention');assert.equal(actual.step,'browse');
});
test('all current observed facts are required for verified green',()=>{
 const actual=getAdultProtectionPresentation({...input,observations});assert.equal(actual.verified,true);assert.equal(actual.tone,'on');assert.equal(actual.status,'On');
 assert.equal(getAdultProtectionPresentation({...input,dnsStatus:{...dns,healthy:null},observations}).verified,true);
 for(const missing of ['enablement','routing','adultBrowsing','ordinaryBrowsing'] as const)assert.equal(getAdultProtectionPresentation({...input,observations:{...observations,[missing]:'unobserved'} as any}).verified,false,missing);
 for(const changed of [{...input,configurationCheckedAt:101},{...input,configurationCheckedAt:null},{...input,dnsStatus:{...dns,enabled:false}},{...input,dnsStatus:{...dns,healthy:false}},{...input,policyConfigured:false},{...input,error:'read-failed'},{...input,pending:true}])assert.equal(getAdultProtectionPresentation({...changed,observations}).verified,false);
 assert.equal(getAdultProtectionPresentation({...input,observations:{...observations,adultBrowsing:'link-opened'} as any}).verified,false);
});
test('the current task resumes from observed authorization, policy, save and enablement facts',()=>{
 for(const [change,step] of [
  [{authorized:false,policyConfigured:false},'authorize'],
  [{policyConfigured:false},'policy'],
  [{dnsStatus:{...dns,configured:false,enabled:false}},'save-dns'],
  [{dnsStatus:{...dns,enabled:false}},'enable-dns'],
  [{configurationCheckedAt:null},'readback'],
  [{},'browse'],
  [{observations},'complete'],
 ] as const)assert.equal(getAdultProtectionPresentation({...input,...change}).step,step);
});
test('unsupported is neutral and an available unconfigured device is off',()=>{
 const unavailable={...dns,supported:false,releaseEnabled:false,configured:false,enabled:false};
 assert.equal(getAdultProtectionPresentation({...input,nativeSupported:false,policyConfigured:false,dnsStatus:unavailable}).tone,'neutral');
 const off=getAdultProtectionPresentation({...input,authorized:false,policyConfigured:false,dnsStatus:{...dns,configured:false,enabled:false}});
 assert.equal(off.tone,'off');assert.equal(off.status,'Off');assert.equal(off.requested,false);
});
test('configuration check requires actual current native and DNS readback',()=>{
 const native={capability:{platform:'ios'},status:{authorized:true,adultFilterActive:true,adultWebPolicyConfigured:true}};
 assert.equal(isAdultConfigurationReadbackCurrent(native,dns,true),true);
 for(const value of [{},null,{...native,superseded:true},{...native,status:{authorized:true}},{...native,status:{...native.status,adultWebPolicyConfigured:false}}])assert.equal(isAdultConfigurationReadbackCurrent(value,dns,true),false);
 assert.equal(isAdultConfigurationReadbackCurrent(native,{...dns,reason:'native-status-refresh-failed'},true),false);
});
