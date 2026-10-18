import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { ProtectionCapability, ProtectionStatus } from 'freed-protection';
import { buildProtectionPermissionPlan, getProtectionPermissionProgress } from '../src/lib/protection-permissions';
import { getProtectionSetupReadiness } from '../src/lib/protection-readiness';
const android:ProtectionCapability={platform:'android',screenTime:false,managedSettings:false,accessibility:true,usageStats:true,dnsFiltering:true,localVpnFallback:true,notes:[]};
const ios:ProtectionCapability={platform:'ios',screenTime:true,managedSettings:true,accessibility:false,usageStats:false,dnsFiltering:true,localVpnFallback:false,safariContentBlocker:true,notes:[]};
const website:ProtectionStatus={authorized:false,active:true,adultFilterActive:true,mode:'dns',message:'Website filtering active',dnsGuardRuntimeReady:true,dnsGuardCoverageReady:true,privateDnsMode:'off',adultDomainFeedDomainCount:100,adultDomainFeedVersion:'reviewed-contract-v1',appInterventionAuthorized:false,usageStatsAuthorized:false,blockedApplications:0};
const apps:ProtectionStatus={authorized:true,active:false,adultFilterActive:false,mode:'accessibility',message:'App timer permissions active',appInterventionAuthorized:true,usageStatsAuthorized:true,blockedApplications:2,dnsGuardRuntimeReady:false,dnsGuardCoverageReady:false,adultDomainFeedDomainCount:0};
const iosWebsite:ProtectionStatus={authorized:true,active:true,adultFilterActive:true,mode:'screen-time',message:'Apple adult policy active',selectedScreenTimeTokenCount:0,appLimitScheduled:false,safariContentBlockerEnabled:false,safariContentBlockerRuleCount:0};
test('website-only setup is active without Android app permissions or packages',()=>{
 const value=getProtectionSetupReadiness(android,website,0,'websites');
 assert.equal(value.activationReady,true);
 assert.equal(value.websiteProtectionReady,true);
 assert.equal(value.appLimitsReady,false);
 assert.equal(value.websiteProtection.status,'On');
 assert.equal(value.appLimits.status,'Off');
 assert.equal(value.permissionProgress.ready,true);
 assert.ok(!value.permissionPlan.some(step=>['android-usage-access','android-accessibility','android-doomscroll-apps'].includes(step.id)));
 assert.equal(getProtectionSetupReadiness(android,website,0).activationReady,false,'legacy both still requires apps');
});
test('app-only setup is active without DNS permission, a feed, or adult filtering',()=>{
 const value=getProtectionSetupReadiness(android,apps,2,'apps');
 assert.equal(value.activationReady,true);
 assert.equal(value.appLimitsReady,true);
 assert.equal(value.websiteProtectionReady,false);
 assert.equal(value.appLimits.status,'On');
 assert.equal(value.websiteProtection.status,'Off');
 assert.deepEqual(value.permissionPlan.map(step=>step.id),['android-usage-access','android-accessibility','android-doomscroll-apps']);
 assert.match(value.appLimits.scope,/per.*package/i);
 assert.match(value.appLimits.explanation,/do(?:es)? not inspect.*content/i);
 assert.equal(getProtectionSetupReadiness(android,apps,2).activationReady,false);
});
test('Apple adult policy works without target selection and Safari remains separate optional coverage',()=>{
 const value=getProtectionSetupReadiness(ios,iosWebsite,0,'websites');
 assert.equal(value.activationReady,true);
 assert.equal(value.websiteProtectionReady,true);
 assert.equal(value.safariCoverageReady,false);
 assert.equal(value.safariCoverage.status,'Off');
 assert.equal(value.permissionPlan.find(step=>step.id==='ios-safari-content-blocker')?.required,false);
 assert.ok(!value.permissionPlan.some(step=>/targets|limit-monitor/.test(step.id)));
 assert.equal(getProtectionSetupReadiness(ios,iosWebsite,0).activationReady,false,'legacy full setup keeps Safari/apps requirements');
 const missing=getProtectionSetupReadiness({...ios,safariContentBlocker:false},iosWebsite,0,'websites');
 assert.equal(missing.activationReady,true);
 assert.equal(missing.safariCoverage.status,'Unavailable');
});
test('iOS app monitoring uses selected-target events without requiring adult or Safari filtering',()=>{
 const value=getProtectionSetupReadiness(ios,{...iosWebsite,active:false,adultFilterActive:false,selectedScreenTimeTokenCount:3,appLimitScheduled:true},0,'apps');
 assert.equal(value.activationReady,true);
 assert.equal(value.appLimits.status,'On');
 assert.deepEqual(value.permissionPlan.map(step=>step.id),['ios-screen-time','ios-screen-time-targets','ios-selected-app-limit-monitor']);
 assert.match(value.appLimits.scope,/selected.target.*event/i);
 assert.match(value.appLimits.explanation,/do(?:es)? not inspect.*content/i);
});
test('revoked app permission cannot be replaced by locally selected packages',()=>{
 for(const revoked of [{usageStatsAuthorized:false},{appInterventionAuthorized:false},{blockedApplications:0}]) {
  const value=getProtectionSetupReadiness(android,{...apps,...revoked},3,'apps');
  assert.equal(value.activationReady,false);
  assert.equal(value.appLimitsReady,false);
  assert.equal(value.appLimits.status,'Needs attention');
 }
 const revoked=getProtectionSetupReadiness(ios,{...iosWebsite,authorized:false,selectedScreenTimeTokenCount:2,appLimitScheduled:true},0,'apps');
 assert.equal(revoked.activationReady,false);
 assert.equal(revoked.appLimits.status,'Needs attention');
 assert.equal(getProtectionSetupReadiness(ios,{...iosWebsite,authorized:false},0,'websites').websiteProtectionReady,false);
});
test('preview and missing native capabilities report Unavailable despite stale active statuses',()=>{
 for(const cap of [null,{...android,platform:'web' as const},{...android,localVpnFallback:false,dnsFiltering:false,accessibility:false,usageStats:false}]) {
  const value=getProtectionSetupReadiness(cap,{...website,...apps,adultFilterActive:true},3,'both');
  assert.equal(value.websiteProtection.status,'Unavailable');
  assert.equal(value.appLimits.status,'Unavailable');
  assert.equal(value.activationReady,false);
 }
 assert.equal(getProtectionSetupReadiness({...ios,managedSettings:false},{...iosWebsite,selectedScreenTimeTokenCount:3,appLimitScheduled:true},0,'apps').activationReady,false);
});
test('DNS conflict, captive pause, incomplete coverage and unready runtime block only websites',()=>{
 for(const extra of [{privateDnsMode:'hostname' as const},{privateDnsMode:'opportunistic' as const},{privateDnsMode:'unknown' as const},{privateDnsActive:true},{dnsGuardCoverageReady:false},{dnsGuardCoverageReady:undefined},{dnsGuardCaptivePaused:true},{dnsGuardRuntimeReady:false}]) {
  const state={...website,...apps,active:true,adultFilterActive:true,dnsGuardRuntimeReady:true,dnsGuardCoverageReady:true,...extra};
  const web=getProtectionSetupReadiness(android,state,2,'websites');
  assert.equal(web.websiteProtectionReady,false);
  assert.equal(web.websiteProtection.status,'Needs attention');
  assert.equal(web.activationReady,false);
  assert.equal(getProtectionSetupReadiness(android,state,2,'apps').activationReady,true);
 }
});
test('reviewed provenance remains required when the existing release gate requires it',()=>{
 const previous=process.env.EXPO_PUBLIC_REQUIRE_REVIEWED_ADULT_DOMAIN_FEED;
 process.env.EXPO_PUBLIC_REQUIRE_REVIEWED_ADULT_DOMAIN_FEED='true';
 try {
  const value=getProtectionSetupReadiness(android,{...website,adultDomainFeedVersion:'freed-embedded-v1'},0,'websites');
  assert.equal(value.websiteProtectionReady,false);
  assert.equal(value.activationReady,false);
  assert.equal(value.websiteProtection.status,'Needs attention');
 } finally {if(previous===undefined)delete process.env.EXPO_PUBLIC_REQUIRE_REVIEWED_ADULT_DOMAIN_FEED;else process.env.EXPO_PUBLIC_REQUIRE_REVIEWED_ADULT_DOMAIN_FEED=previous;}
});
test('both remains the exact default plan and scoped progress counts only applicable requirements',()=>{
 assert.deepEqual(buildProtectionPermissionPlan(android,apps),buildProtectionPermissionPlan(android,apps,'both'));
 assert.equal(getProtectionPermissionProgress(buildProtectionPermissionPlan(android,apps,'apps')).required,3);
 assert.equal(getProtectionPermissionProgress(buildProtectionPermissionPlan(ios,iosWebsite,'websites')).required,2);
 const fullStatus={...website,...apps,active:true,adultFilterActive:true,dnsGuardRuntimeReady:true,dnsGuardCoverageReady:true,privateDnsMode:'off' as const,adultDomainFeedDomainCount:100,adultDomainFeedVersion:'reviewed-contract-v1'};
 assert.equal(getProtectionSetupReadiness(android,fullStatus,2).activationReady,true);
});

test('feature website readiness requires reviewed provenance even in the legacy fallback configuration',()=>{
 const previous=process.env.EXPO_PUBLIC_REQUIRE_REVIEWED_ADULT_DOMAIN_FEED;
 process.env.EXPO_PUBLIC_REQUIRE_REVIEWED_ADULT_DOMAIN_FEED='false';
 try {
  const fallback={...website,...apps,active:true,adultFilterActive:true,dnsGuardRuntimeReady:true,dnsGuardCoverageReady:true,privateDnsMode:'off' as const,adultDomainFeedDomainCount:100,adultDomainFeedVersion:'freed-embedded-v1'};
  const scoped=getProtectionSetupReadiness(android,fallback,2,'websites');
  assert.equal(scoped.websiteProtectionReady,false);
  assert.equal(scoped.activationReady,false);
  assert.equal(scoped.permissionPlan.find(step=>step.id==='android-native-adult-domain-feed')?.status,'needed');
  assert.equal(getProtectionSetupReadiness(android,fallback,2).activationReady,true,'legacy fallback activation calculation is preserved');
 } finally {if(previous===undefined)delete process.env.EXPO_PUBLIC_REQUIRE_REVIEWED_ADULT_DOMAIN_FEED;else process.env.EXPO_PUBLIC_REQUIRE_REVIEWED_ADULT_DOMAIN_FEED=previous;}
});
test('scoped plans downgrade dependent Apple policy and monitor after shared authorization is revoked',()=>{
 const revoked={...iosWebsite,authorized:false,appLimitScheduled:true,selectedScreenTimeTokenCount:3};
 assert.equal(buildProtectionPermissionPlan(ios,revoked,'websites').find(step=>step.id==='ios-adult-web-filter')?.status,'needed');
 assert.equal(buildProtectionPermissionPlan(ios,revoked,'apps').find(step=>step.id==='ios-selected-app-limit-monitor')?.status,'needed');
});
test('a cancelled DNS consent cannot be inferred granted from stale active flags',()=>{
 const cancelled={...website,vpnConsentRequired:true};
 const value=getProtectionSetupReadiness(android,cancelled,0,'websites');
 assert.equal(value.activationReady,false);
 assert.equal(value.websiteProtection.status,'Needs attention');
 assert.equal(value.permissionPlan.find(step=>step.id==='android-dns-guard')?.status,'needed');
});
test('an unavailable other feature does not prevent purpose-specific setup',()=>{
 const web=getProtectionSetupReadiness({...android,accessibility:false,usageStats:false},website,0,'websites');
 assert.equal(web.activationReady,true);
 assert.equal(web.appLimits.status,'Unavailable');
 const app=getProtectionSetupReadiness({...android,dnsFiltering:false,localVpnFallback:false},apps,2,'apps');
 assert.equal(app.activationReady,true);
 assert.equal(app.websiteProtection.status,'Unavailable');
});
test('feature website status does not infer its adult policy from a combined active flag',()=>{
 const state={...iosWebsite,adultFilterActive:undefined,selectedScreenTimeTokenCount:2,appLimitScheduled:true};
 const value=getProtectionSetupReadiness(ios,state,0,'apps');
 assert.equal(value.appLimitsReady,true);
 assert.equal(value.websiteProtectionReady,false);
 assert.equal(value.websiteProtection.status,'Needs attention');
 assert.equal(getProtectionSetupReadiness(ios,state,0,'websites').activationReady,false);
 assert.equal(value.adultFilterActive,true,'legacy adult filter inference remains available to old callers');
});

test('a reset latch overrides cached active flags without claiming permission revocation',()=>{
 const cached={...iosWebsite,protectionConfigurationResetDisabled:true,selectedScreenTimeTokenCount:3,appLimitScheduled:true};
 for(const intent of ['websites','apps','both'] as const){const state=getProtectionSetupReadiness(ios,cached,0,intent);assert.equal(state.activationReady,false);assert.equal(state.websiteProtectionReady,false);assert.equal(state.appLimitsReady,false);assert.equal(state.websiteProtection.status,'Off');assert.equal(state.appLimits.status,'Off');}
});

test('saved Android package choices cannot replace a native configuration status', () => {
 const value=getProtectionSetupReadiness(android,null,3,'apps');
 assert.equal(value.appLimits.status,'Off');
 assert.equal(value.appLimits.ready,false);
 assert.equal(value.activationReady,false);
 assert.equal(value.appCount,3,'saved selection remains available for the picker');
});
test('compiled iOS capabilities without OS authorization or policy evidence never report On', () => {
 const value=getProtectionSetupReadiness(ios,{authorized:false,active:false,mode:'prototype',message:'Signing and OS permission unknown'},0,'websites');
 assert.equal(value.websiteProtection.status,'Off');
 assert.equal(value.websiteProtectionReady,false);
 assert.equal(value.activationReady,false);
});
